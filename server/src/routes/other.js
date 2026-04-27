const express = require('express');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const { getDb } = require('../db');
const { requirePermission, attachAgent } = require('../middleware/auth');

const PROJECT_ROOT = path.join(__dirname, '../../..');

// ── Agents ────────────────────────────────────────────────────────────────────
const agentsRouter = express.Router();

function parseAgent(a) {
  return {
    ...a,
    permissions: JSON.parse(a.permissions || '[]'),
    instruction_files: JSON.parse(a.instruction_files || '[]'),
    is_template: a.is_template === 1,
  };
}

function parseTemplate(t) {
  return {
    ...t,
    instruction_files: JSON.parse(t.instruction_files || '[]'),
    permissions: JSON.parse(t.permissions || '[]'),
    tags: JSON.parse(t.tags || '[]'),
  };
}

agentsRouter.get('/', attachAgent, (req, res) => {
  const db = getDb();
  const agents = db.prepare('SELECT * FROM agents ORDER BY created_at ASC').all();
  res.json(agents.map(parseAgent));
});

agentsRouter.get('/:id', attachAgent, (req, res) => {
  const db = getDb();
  const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(req.params.id);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });
  res.json(parseAgent(agent));
});

agentsRouter.post('/', (req, res) => {
  const agentId = req.headers['x-agent-id'];
  if (agentId !== 'human') return res.status(403).json({ error: 'Only humans can create agents' });

  const db = getDb();
  const {
    name, role, model = 'claude-sonnet-4-5', description,
    permissions = [], prompt_file, instruction_files = [], color = '#6366f1',
    created_from_template_id,
  } = req.body;
  if (!name || !role) return res.status(400).json({ error: 'name and role are required' });

  const existing = db.prepare('SELECT id FROM agents WHERE role = ?').get(role);
  if (existing) return res.status(409).json({ error: `Agent with role "${role}" already exists` });

  const id = 'agent_' + role.replace(/[^a-z0-9]/gi, '_').toLowerCase();

  // If created from a template that has a template_system_prompt, propagate it
  let is_template_flag = 0;
  let template_system_prompt_val = null;
  if (created_from_template_id) {
    const tpl = db.prepare('SELECT * FROM agent_templates WHERE id = ?').get(created_from_template_id);
    if (tpl?.template_system_prompt) {
      is_template_flag = 1;
      template_system_prompt_val = tpl.template_system_prompt;
    }
  }

  db.prepare(`
    INSERT INTO agents (id, name, role, model, description, permissions, prompt_file, instruction_files, color, created_from_template_id, is_template, template_system_prompt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, name, role, model, description, JSON.stringify(permissions), prompt_file, JSON.stringify(instruction_files), color, created_from_template_id || null, is_template_flag, template_system_prompt_val);

  const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(id);
  res.status(201).json(parseAgent(agent));
});

agentsRouter.post('/:id/save-as-template', (req, res) => {
  const agentId = req.headers['x-agent-id'];
  if (agentId !== 'human') return res.status(403).json({ error: 'Only humans can save templates' });

  const db = getDb();
  const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(req.params.id);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });

  const { name, system_prompt_content = '' } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const id = 'tpl_' + uuidv4().replace(/-/g, '').slice(0, 12);
  db.prepare(`
    INSERT INTO agent_templates (id, name, description, model, color, suggested_role, system_prompt_content, template_system_prompt, instruction_files, permissions, tags, source_agent_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', ?)
  `).run(id, name, agent.description, agent.model, agent.color, agent.role,
    system_prompt_content, agent.template_system_prompt || null,
    agent.instruction_files, agent.permissions, agent.id);

  const tpl = db.prepare('SELECT * FROM agent_templates WHERE id = ?').get(id);
  res.status(201).json(parseTemplate(tpl));
});

agentsRouter.patch('/:id', (req, res) => {
  const agentId = req.headers['x-agent-id'];
  if (agentId !== 'human') return res.status(403).json({ error: 'Only humans can modify agents' });

  const db = getDb();
  const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(req.params.id);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });

  const { name, model, description, permissions, color, active, prompt_file, instruction_files, system_prompt_override } = req.body;
  const allowed = {};
  if (name !== undefined) allowed.name = name;
  if (model !== undefined) allowed.model = model;
  if (description !== undefined) allowed.description = description;
  if (permissions !== undefined) allowed.permissions = JSON.stringify(permissions);
  if (color !== undefined) allowed.color = color;
  if (active !== undefined) allowed.active = active ? 1 : 0;
  if (prompt_file !== undefined) allowed.prompt_file = prompt_file;
  if (instruction_files !== undefined) allowed.instruction_files = JSON.stringify(instruction_files);
  // null explicitly clears the override (reset to template default)
  if (Object.prototype.hasOwnProperty.call(req.body, 'system_prompt_override')) {
    allowed.system_prompt_override = system_prompt_override ?? null;
  }

  if (Object.keys(allowed).length === 0) return res.status(400).json({ error: 'Nothing to update' });

  const setClauses = Object.keys(allowed).map(k => `${k} = ?`).join(', ');
  db.prepare(`UPDATE agents SET ${setClauses} WHERE id = ?`).run(...Object.values(allowed), agent.id);

  const updated = db.prepare('SELECT * FROM agents WHERE id = ?').get(agent.id);
  res.json(parseAgent(updated));
});

agentsRouter.delete('/:id', (req, res) => {
  const agentId = req.headers['x-agent-id'];
  if (agentId !== 'human') return res.status(403).json({ error: 'Only humans can delete agents' });

  const db = getDb();
  db.prepare('UPDATE agents SET active = 0 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ── Columns ───────────────────────────────────────────────────────────────────
const columnsRouter = express.Router();

columnsRouter.get('/', attachAgent, (req, res) => {
  const db = getDb();
  const columns = db.prepare('SELECT * FROM columns ORDER BY position ASC').all();

  // Attach task counts
  const counts = db.prepare('SELECT column_id, COUNT(*) as count FROM tasks GROUP BY column_id').all();
  const countMap = Object.fromEntries(counts.map(c => [c.column_id, c.count]));

  res.json(columns.map(c => ({ ...c, task_count: countMap[c.id] || 0 })));
});

columnsRouter.post('/', (req, res) => {
  const agentId = req.headers['x-agent-id'];
  if (agentId !== 'human') return res.status(403).json({ error: 'Only humans can create columns' });

  const db = getDb();
  const { name, color = '#6366f1' } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const maxPos = db.prepare('SELECT MAX(position) as m FROM columns').get();
  const position = (maxPos.m || 0) + 1;
  const id = 'col_' + name.toLowerCase().replace(/[^a-z0-9]/g, '') + '_' + Date.now();

  db.prepare('INSERT INTO columns (id, name, position, color) VALUES (?, ?, ?, ?)').run(id, name, position, color);
  res.status(201).json(db.prepare('SELECT * FROM columns WHERE id = ?').get(id));
});

columnsRouter.patch('/:id', (req, res) => {
  const agentId = req.headers['x-agent-id'];
  if (agentId !== 'human') return res.status(403).json({ error: 'Only humans can modify columns' });

  const db = getDb();
  const { name, color, position } = req.body;
  const allowed = {};
  if (name) allowed.name = name;
  if (color) allowed.color = color;
  if (position !== undefined) allowed.position = position;

  if (Object.keys(allowed).length === 0) return res.status(400).json({ error: 'Nothing to update' });
  const setClauses = Object.keys(allowed).map(k => `${k} = ?`).join(', ');
  db.prepare(`UPDATE columns SET ${setClauses} WHERE id = ?`).run(...Object.values(allowed), req.params.id);
  res.json(db.prepare('SELECT * FROM columns WHERE id = ?').get(req.params.id));
});

columnsRouter.delete('/:id', (req, res) => {
  const agentId = req.headers['x-agent-id'];
  if (agentId !== 'human') return res.status(403).json({ error: 'Only humans can delete columns' });

  const db = getDb();
  const tasks = db.prepare('SELECT COUNT(*) as c FROM tasks WHERE column_id = ?').get(req.params.id);
  if (tasks.c > 0) return res.status(409).json({ error: 'Cannot delete column with tasks. Move tasks first.' });

  db.prepare('DELETE FROM columns WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ── Secrets ───────────────────────────────────────────────────────────────────
const secretsRouter = express.Router();

secretsRouter.get('/', (req, res) => {
  const agentId = req.headers['x-agent-id'];
  if (agentId !== 'human') return res.status(403).json({ error: 'Only humans can view secrets' });

  const db = getDb();
  res.json(db.prepare('SELECT * FROM secrets ORDER BY created_at DESC').all());
});

secretsRouter.post('/', attachAgent, (req, res) => {
  const db = getDb();
  const { name, description, task_id } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const id = 'secret_' + uuidv4().slice(0, 8);
  db.prepare('INSERT OR IGNORE INTO secrets (id, name, description, task_id) VALUES (?, ?, ?, ?)').run(id, name, description, task_id);

  // Move task to Human Action if provided
  if (task_id) {
    db.prepare(`UPDATE tasks SET column_id = 'col_humanaction', requires_human_action = 1, human_action_reason = ? WHERE id = ?`)
      .run(`Secret required: ${name}`, task_id);
  }

  res.status(201).json(db.prepare('SELECT * FROM secrets WHERE id = ?').get(id));
});

secretsRouter.patch('/:id/resolve', (req, res) => {
  const agentId = req.headers['x-agent-id'];
  if (agentId !== 'human') return res.status(403).json({ error: 'Only humans can resolve secrets' });

  const db = getDb();
  const { status } = req.body; // 'provided' or 'rejected'
  if (!['provided', 'rejected'].includes(status)) return res.status(400).json({ error: 'status must be provided or rejected' });

  db.prepare('UPDATE secrets SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, req.params.id);
  res.json({ ok: true });
});

// ── Instructions ──────────────────────────────────────────────────────────────
const instructionsRouter = express.Router();

// GET /api/instructions — list all .md files in instructions/ folder
instructionsRouter.get('/', attachAgent, (req, res) => {
  const instructionsDir = path.join(PROJECT_ROOT, 'instructions');
  try {
    const files = fs.readdirSync(instructionsDir)
      .filter(f => f.endsWith('.md'))
      .map(f => ({
        path: `instructions/${f}`,
        name: f.replace('.md', ''),
        label: f.replace('.md', '').replace(/_/g, ' '),
      }));
    res.json(files);
  } catch {
    res.json([]);
  }
});

// POST /api/instructions — create a new .md file in instructions/
instructionsRouter.post('/', (req, res) => {
  const agentId = req.headers['x-agent-id'];
  if (agentId !== 'human') return res.status(403).json({ error: 'Only humans can create instruction files' });

  const { name, content = '' } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  // Sanitise: lowercase, alphanumeric + underscores/hyphens only, max 100 chars
  const safeName = name.trim().toLowerCase()
    .replace(/\.md$/i, '')
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 100);

  if (!safeName) return res.status(400).json({ error: 'Invalid file name' });

  const filename = `${safeName}.md`;
  const filePath = path.join(PROJECT_ROOT, 'instructions', filename);

  if (fs.existsSync(filePath)) {
    return res.status(409).json({ error: `File "${filename}" already exists` });
  }

  fs.writeFileSync(filePath, content, 'utf8');
  res.status(201).json({ path: `instructions/${filename}`, name: safeName });
});

// ── Agent Templates ───────────────────────────────────────────────────────────
const agentTemplatesRouter = express.Router();

agentTemplatesRouter.get('/', attachAgent, (req, res) => {
  const db = getDb();
  const includeArchived = req.query.include_archived === 'true';
  const where = includeArchived ? '' : 'WHERE archived_at IS NULL';
  const templates = db.prepare(`SELECT * FROM agent_templates ${where} ORDER BY created_at DESC`).all();
  res.json(templates.map(parseTemplate));
});

agentTemplatesRouter.post('/', (req, res) => {
  const agentId = req.headers['x-agent-id'];
  if (agentId !== 'human') return res.status(403).json({ error: 'Only humans can create templates' });

  const db = getDb();
  const {
    name, description, model = 'claude-sonnet-4-5', color = '#6366f1',
    suggested_role, system_prompt_content = '', template_system_prompt,
    instruction_files = [], permissions = [], tags = [],
  } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const id = 'tpl_' + uuidv4().replace(/-/g, '').slice(0, 12);
  db.prepare(`
    INSERT INTO agent_templates (id, name, description, model, color, suggested_role, system_prompt_content, template_system_prompt, instruction_files, permissions, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, name, description, model, color, suggested_role, system_prompt_content,
    template_system_prompt || null,
    JSON.stringify(instruction_files), JSON.stringify(permissions), JSON.stringify(tags));

  const tpl = db.prepare('SELECT * FROM agent_templates WHERE id = ?').get(id);
  res.status(201).json(parseTemplate(tpl));
});

agentTemplatesRouter.patch('/:id', (req, res) => {
  const agentId = req.headers['x-agent-id'];
  if (agentId !== 'human') return res.status(403).json({ error: 'Only humans can modify templates' });

  const db = getDb();
  const tpl = db.prepare('SELECT * FROM agent_templates WHERE id = ?').get(req.params.id);
  if (!tpl) return res.status(404).json({ error: 'Template not found' });

  const { name, description, model, color, suggested_role, system_prompt_content, template_system_prompt, instruction_files, permissions, tags } = req.body;
  const allowed = {};
  if (name !== undefined) allowed.name = name;
  if (description !== undefined) allowed.description = description;
  if (model !== undefined) allowed.model = model;
  if (color !== undefined) allowed.color = color;
  if (suggested_role !== undefined) allowed.suggested_role = suggested_role;
  if (system_prompt_content !== undefined) allowed.system_prompt_content = system_prompt_content;
  if (Object.prototype.hasOwnProperty.call(req.body, 'template_system_prompt')) {
    allowed.template_system_prompt = template_system_prompt ?? null;
  }
  if (instruction_files !== undefined) allowed.instruction_files = JSON.stringify(instruction_files);
  if (permissions !== undefined) allowed.permissions = JSON.stringify(permissions);
  if (tags !== undefined) allowed.tags = JSON.stringify(tags);

  if (Object.keys(allowed).length === 0) return res.status(400).json({ error: 'Nothing to update' });

  const setClauses = Object.keys(allowed).map(k => `${k} = ?`).join(', ');
  db.prepare(`UPDATE agent_templates SET ${setClauses} WHERE id = ?`).run(...Object.values(allowed), tpl.id);

  const updated = db.prepare('SELECT * FROM agent_templates WHERE id = ?').get(tpl.id);
  res.json(parseTemplate(updated));
});

agentTemplatesRouter.post('/:id/archive', (req, res) => {
  const agentId = req.headers['x-agent-id'];
  if (agentId !== 'human') return res.status(403).json({ error: 'Only humans can archive templates' });

  const db = getDb();
  db.prepare('UPDATE agent_templates SET archived_at = CURRENT_TIMESTAMP WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

agentTemplatesRouter.post('/:id/unarchive', (req, res) => {
  const agentId = req.headers['x-agent-id'];
  if (agentId !== 'human') return res.status(403).json({ error: 'Only humans can unarchive templates' });

  const db = getDb();
  db.prepare('UPDATE agent_templates SET archived_at = NULL WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = { agentsRouter, columnsRouter, secretsRouter, instructionsRouter, agentTemplatesRouter };
