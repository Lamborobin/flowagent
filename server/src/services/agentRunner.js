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

const CHECKLIST_ITEM_SCHEMA = {
  type: 'object',
  properties: {
    item: { type: 'string', description: 'Short label for this requirement (e.g. "Acceptance criteria defined")' },
    resolved: { type: 'boolean', description: 'True if this requirement is now confirmed by the conversation' }
  },
  required: ['item', 'resolved']
};

// Tools the PM agent can call
const PM_TOOLS = [
  {
    name: 'ask_question',
    description: 'Ask the human one focused clarifying question. Always provide the full checklist showing which items are now resolved. On first call, generate all checklist items. On subsequent calls, re-evaluate and mark resolved items — do not add new items unless truly necessary.',
    input_schema: {
      type: 'object',
      properties: {
        question: {
          type: 'string',
          description: 'One specific, actionable question for the human.'
        },
        checklist: {
          type: 'array',
          description: 'Full list of all planning requirements. Mark resolved: true for items confirmed by the conversation so far.',
          items: CHECKLIST_ITEM_SCHEMA
        }
      },
      required: ['question', 'checklist']
    }
  },
  {
    name: 'approve_task',
    description: 'Approve the task when ALL checklist items are resolved and you are fully satisfied it is clear, scoped, and ready for a developer.',
    input_schema: {
      type: 'object',
      properties: {
        comment: {
          type: 'string',
          description: "A concise developer brief summarising what to build, any constraints agreed during planning, and what 'done' looks like."
        },
        checklist: {
          type: 'array',
          description: 'Final checklist with all items marked resolved: true.',
          items: CHECKLIST_ITEM_SCHEMA
        }
      },
      required: ['comment', 'checklist']
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

  const currentChecklist = task.pm_checklist ? JSON.parse(task.pm_checklist) : null;
  const checklistBlock = currentChecklist && currentChecklist.length > 0
    ? `## Current Checklist State\n${currentChecklist.map(i => `- [${i.resolved ? 'x' : ' '}] ${i.item}`).join('\n')}\n\nRe-evaluate each item based on the conversation and mark any newly resolved items.`
    : '';

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
    checklistBlock,
    `## Your Turn`,
    conversationLogs.length === 0
      ? `Review the description. Generate a checklist of all requirements that must be confirmed before a developer can start. Mark any already satisfied by the description. Then either approve (if all resolved) or ask your first question.`
      : `The human just answered your last question. Re-evaluate the checklist, mark any newly resolved items, then either ask a follow-up or approve if all items are resolved.`
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
      const { question, checklist = [] } = block.input;
      db.prepare(`UPDATE tasks SET pm_approval_status = 'questioning', pm_pending_question = ?, pm_checklist = ? WHERE id = ?`)
        .run(question, JSON.stringify(checklist), taskId);
      db.prepare(`INSERT INTO task_logs (id, task_id, agent_id, action, message) VALUES (?, ?, ?, ?, ?)`)
        .run(uuidv4(), taskId, 'agent_pm', 'pm_question', question);
      console.log(`[AgentRunner] PM asked question on task ${taskId}`);

    } else if (block.name === 'approve_task') {
      const { comment, checklist = [] } = block.input;
      const resolvedChecklist = checklist.map(i => ({ ...i, resolved: true }));
      db.prepare(`
        UPDATE tasks SET pm_approval_status = 'approved', pm_review_comment = ?, pm_review_date = CURRENT_TIMESTAMP, pm_checklist = ?
        WHERE id = ?
      `).run(comment, JSON.stringify(resolvedChecklist), taskId);
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
