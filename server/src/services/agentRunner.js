const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db');

const PROJECT_ROOT = path.join(__dirname, '../../..');

// Global files always included for every agent
const GLOBAL_FILES = ['CLAUDE.md', 'README.md'];

// Lazy-init so dotenv has time to load before we read the key
let _client = null;
function getClient() {
  if (!_client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is not set in server/.env');
    }
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _client;
}

// Tools the PM agent can call
const PM_TOOLS = [
  {
    name: 'ask_question',
    description: 'Ask the human a single focused clarifying question about the task. Use when the description is ambiguous, incomplete, or missing key details a developer would need.',
    input_schema: {
      type: 'object',
      properties: {
        question: {
          type: 'string',
          description: 'One specific, actionable question for the human.'
        }
      },
      required: ['question']
    }
  },
  {
    name: 'approve_task',
    description: 'Approve the task when you are fully satisfied it is clear, scoped, and ready for a developer to start without needing to ask anything.',
    input_schema: {
      type: 'object',
      properties: {
        comment: {
          type: 'string',
          description: "A concise developer brief summarising what to build, any constraints agreed during planning, and what 'done' looks like."
        }
      },
      required: ['comment']
    }
  }
];

function readFile(filePath) {
  try {
    return fs.readFileSync(path.join(PROJECT_ROOT, filePath), 'utf8');
  } catch {
    return '';
  }
}

function buildContextBlock(agent) {
  const instructionFiles = JSON.parse(agent.instruction_files || '[]');
  const allContextFiles = [...GLOBAL_FILES, ...instructionFiles];
  const sections = [];

  for (const filePath of allContextFiles) {
    const content = readFile(filePath);
    if (content) {
      const label = path.basename(filePath, '.md').toUpperCase();
      sections.push(`## [${label}]\n${content}`);
    }
  }

  return sections.join('\n\n---\n\n');
}

function buildSystemPrompt(agent) {
  const promptFileContent = readFile(agent.prompt_file || '');

  if (agent.is_template) {
    // Template agents: internal behavioural prompt + role-specific prompt file
    const internalPrompt = agent.system_prompt_override || agent.template_system_prompt || '';
    return [internalPrompt, promptFileContent].filter(Boolean).join('\n\n---\n\n');
  }

  return promptFileContent;
}

async function runPmAgent(taskId) {
  const db = getDb();
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);

  if (!task) return;
  if (task.pm_approval_status === 'approved') return;
  // Don't re-run while waiting for human to answer
  if (task.pm_pending_question) return;

  const pmAgent = db.prepare("SELECT * FROM agents WHERE id = 'agent_pm'").get();
  if (!pmAgent) return;

  // Get conversation history (questions + answers only)
  const conversationLogs = db.prepare(`
    SELECT action, message, created_at FROM task_logs
    WHERE task_id = ? AND action IN ('pm_question', 'human_answer')
    ORDER BY created_at ASC
  `).all(taskId);

  const systemPrompt = buildSystemPrompt(pmAgent);
  const contextBlock = buildContextBlock(pmAgent);

  // Build a clear picture of the task + conversation so far
  const conversationText = conversationLogs.length === 0
    ? '(No conversation yet — this is your first look at the task.)'
    : conversationLogs.map(l =>
        l.action === 'pm_question'
          ? `PM asked: ${l.message}`
          : `Human answered: ${l.message}`
      ).join('\n\n');

  const userMessage = [
    contextBlock ? `## Context Files\n${contextBlock}` : '',
    `## Task to Review`,
    `ID: ${task.id}`,
    `Title: ${task.title}`,
    `Description: ${task.description || '(no description provided)'}`,
    `Priority: ${task.priority} | Complexity: ${task.complexity}`,
    ``,
    `## Planning Conversation So Far`,
    conversationText,
    ``,
    `## Your Turn`,
    conversationLogs.length === 0
      ? `Review the description. If it gives a developer everything they need, approve it. If not, ask your first clarifying question.`
      : `The human just answered your last question. Based on everything above, either ask a follow-up question or approve the task.`
  ].filter(Boolean).join('\n');

  let response;
  try {
    response = await getClient().messages.create({
      model: pmAgent.model || 'claude-opus-4-5',
      max_tokens: 1024,
      system: systemPrompt,
      tools: PM_TOOLS,
      messages: [{ role: 'user', content: userMessage }]
    });
  } catch (err) {
    console.error(`[AgentRunner] PM agent API error for task ${taskId}:`, err.message);
    return;
  }

  // Execute whichever tool the PM chose
  for (const block of response.content) {
    if (block.type !== 'tool_use') continue;

    if (block.name === 'ask_question') {
      const question = block.input.question;
      db.prepare(`UPDATE tasks SET pm_approval_status = 'questioning', pm_pending_question = ? WHERE id = ?`)
        .run(question, taskId);
      db.prepare(`INSERT INTO task_logs (id, task_id, agent_id, action, message) VALUES (?, ?, ?, ?, ?)`)
        .run(uuidv4(), taskId, 'agent_pm', 'pm_question', question);
      console.log(`[AgentRunner] PM asked question on task ${taskId}`);

    } else if (block.name === 'approve_task') {
      const comment = block.input.comment;
      db.prepare(`
        UPDATE tasks SET pm_approval_status = 'approved', pm_review_comment = ?, pm_review_date = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(comment, taskId);
      db.prepare(`INSERT INTO task_logs (id, task_id, agent_id, action, message) VALUES (?, ?, ?, ?, ?)`)
        .run(uuidv4(), taskId, 'agent_pm', 'pm_reviewed', `PM approved — ${comment}`);
      console.log(`[AgentRunner] PM approved task ${taskId}`);
    }
  }

  // If the model replied with text only (no tool call), log it as a question fallback
  if (!response.content.some(b => b.type === 'tool_use')) {
    const text = response.content.find(b => b.type === 'text')?.text;
    if (text) {
      db.prepare(`UPDATE tasks SET pm_approval_status = 'questioning', pm_pending_question = ? WHERE id = ?`)
        .run(text, taskId);
      db.prepare(`INSERT INTO task_logs (id, task_id, agent_id, action, message) VALUES (?, ?, ?, ?, ?)`)
        .run(uuidv4(), taskId, 'agent_pm', 'pm_question', text);
    }
  }
}

// Fire-and-forget wrapper — never blocks the HTTP request
function triggerPmAgent(taskId) {
  setImmediate(() => {
    runPmAgent(taskId).catch(err =>
      console.error(`[AgentRunner] Unhandled error for task ${taskId}:`, err)
    );
  });
}

module.exports = { triggerPmAgent };
