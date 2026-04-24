const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db');
const { requirePermission, attachAgent } = require('../middleware/auth');

// ── Agents ────────────────────────────────────────────────────────────────────
const agentsRouter = express.Router();

agentsRouter.get('/', attachAgent, (req, res) => {
  const db = getDb();
  const agents = db.prepare('SELECT * FROM agents ORDER BY created_at ASC').all();
  res.json(agents.map(a => ({ ...a, permissions: JSON.parse(a.permissions) })));
});

agentsRouter.get('/:id', attachAgent, (req, res) => {
  const db = getDb();
  const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(req.params.id);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });
  res.json({ ...agent, permissions: JSON.parse(agent.permissions) });
});

agentsRouter.post('/', (req, res) => {
  const agentId = req.headers['x-agent-id'];
  if (agentId !== 'human') return res.status(403).json({ error: 'Only humans can create agents' });

  const db = getDb();
  const { name, role, model = 'claude-sonnet-4-5', description, permissions = [], prompt_file, color = '#6366f1' } = req.body;
  if (!name || !role) return res.status(400).json({ error: 'name and role are required' });

  const existing = db.prepare('SELECT id FROM agents WHERE role = ?').get(role);
  if (existing) return res.status(409).json({ error: `Agent with role "${role}" already exists` });

  const id = 'agent_' + role.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  db.prepare(`
    INSERT INTO agents (id, name, role, model, description, permissions, prompt_file, color)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, name, role, model, description, JSON.stringify(permissions), prompt_file, color);

  const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(id);
  res.status(201).json({ ...agent, permissions: JSON.parse(agent.permissions) });
});

agentsRouter.patch('/:id', (req, res) => {
  const agentId = req.headers['x-agent-id'];
  if (agentId !== 'human') return res.status(403).json({ error: 'Only humans can modify agents' });

  const db = getDb();
  const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(req.params.id);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });

  const { name, model, description, permissions, color, active, prompt_file } = req.body;
  const allowed = {};
  if (name !== undefined) allowed.name = name;
  if (model !== undefined) allowed.model = model;
  if (description !== undefined) allowed.description = description;
  if (permissions !== undefined) allowed.permissions = JSON.stringify(permissions);
  if (color !== undefined) allowed.color = color;
  if (active !== undefined) allowed.active = active ? 1 : 0;
  if (prompt_file !== undefined) allowed.prompt_file = prompt_file;

  if (Object.keys(allowed).length === 0) return res.status(400).json({ error: 'Nothing to update' });

  const setClauses = Object.keys(allowed).map(k => `${k} = ?`).join(', ');
  db.prepare(`UPDATE agents SET ${setClauses} WHERE id = ?`).run(...Object.values(allowed), agent.id);

  const updated = db.prepare('SELECT * FROM agents WHERE id = ?').get(agent.id);
  res.json({ ...updated, permissions: JSON.parse(updated.permissions) });
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

module.exports = { agentsRouter, columnsRouter, secretsRouter };
