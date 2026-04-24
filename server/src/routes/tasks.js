const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db');
const { requirePermission, attachAgent } = require('../middleware/auth');

const router = express.Router();

// GET /tasks — list all tasks (optionally filter by column)
router.get('/', attachAgent, (req, res) => {
  const db = getDb();
  const { column_id, assigned_agent_id } = req.query;

  let query = 'SELECT * FROM tasks WHERE 1=1';
  const params = [];

  if (column_id) { query += ' AND column_id = ?'; params.push(column_id); }
  if (assigned_agent_id) { query += ' AND assigned_agent_id = ?'; params.push(assigned_agent_id); }

  query += ' ORDER BY created_at DESC';
  const tasks = db.prepare(query).all(...params);

  res.json(tasks.map(t => ({
    ...t,
    tags: JSON.parse(t.tags || '[]'),
    metadata: JSON.parse(t.metadata || '{}'),
  })));
});

// GET /tasks/:id
router.get('/:id', attachAgent, (req, res) => {
  const db = getDb();
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const logs = db.prepare(`
    SELECT tl.*, a.name as agent_name, a.role as agent_role
    FROM task_logs tl
    LEFT JOIN agents a ON tl.agent_id = a.id
    WHERE tl.task_id = ?
    ORDER BY tl.created_at ASC
  `).all(task.id);

  res.json({
    ...task,
    tags: JSON.parse(task.tags || '[]'),
    metadata: JSON.parse(task.metadata || '{}'),
    logs
  });
});

// POST /tasks — create task (PM or human only)
router.post('/', requirePermission('task:create'), (req, res) => {
  const db = getDb();
  const {
    title, description, column_id = 'col_backlog',
    assigned_agent_id, priority = 'medium', complexity = 'medium',
    tags = [], metadata = {}
  } = req.body;

  if (!title) return res.status(400).json({ error: 'title is required' });

  // Verify column exists
  const col = db.prepare('SELECT id FROM columns WHERE id = ?').get(column_id);
  if (!col) return res.status(400).json({ error: 'Invalid column_id' });

  const id = 'task_' + uuidv4().replace(/-/g, '').slice(0, 12);

  db.prepare(`
    INSERT INTO tasks (id, title, description, column_id, assigned_agent_id, priority, complexity, tags, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, title, description, column_id, assigned_agent_id || null, priority, complexity,
    JSON.stringify(tags), JSON.stringify(metadata));

  // Log it
  db.prepare(`
    INSERT INTO task_logs (id, task_id, agent_id, action, to_column, message)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(uuidv4(), id, req.agent?.id || null, 'created', column_id, `Task created by ${req.agent?.name || req.agent?.role || 'unknown'}`);

  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  res.status(201).json({ ...task, tags: JSON.parse(task.tags), metadata: JSON.parse(task.metadata) });
});

// PATCH /tasks/:id — update task fields
router.patch('/:id', requirePermission('task:update'), (req, res) => {
  const db = getDb();
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const agent = req.agent;
  const permissions = agent.permissions;
  const allowed = {};

  // PM/human can update everything
  if (permissions.includes('task:update') && !permissions.includes('task:update:status')) {
    const { title, description, priority, complexity, tags, metadata, assigned_agent_id, recommended_model } = req.body;
    if (title !== undefined) allowed.title = title;
    if (description !== undefined) allowed.description = description;
    if (priority !== undefined) allowed.priority = priority;
    if (complexity !== undefined) allowed.complexity = complexity;
    if (tags !== undefined) allowed.tags = JSON.stringify(tags);
    if (metadata !== undefined) allowed.metadata = JSON.stringify(metadata);
    if (assigned_agent_id !== undefined) allowed.assigned_agent_id = assigned_agent_id;
    if (recommended_model !== undefined) allowed.recommended_model = recommended_model;
  }

  // All agents with update:status
  const { progress } = req.body;
  if (progress !== undefined && (permissions.includes('task:update:progress') || permissions.includes('task:update'))) {
    allowed.progress = Math.min(100, Math.max(0, parseInt(progress)));
  }

  if (Object.keys(allowed).length === 0) {
    return res.status(400).json({ error: 'No updatable fields provided' });
  }

  const setClauses = Object.keys(allowed).map(k => `${k} = ?`).join(', ');
  db.prepare(`UPDATE tasks SET ${setClauses} WHERE id = ?`).run(...Object.values(allowed), task.id);

  db.prepare(`INSERT INTO task_logs (id, task_id, agent_id, action, message) VALUES (?, ?, ?, ?, ?)`)
    .run(uuidv4(), task.id, agent.id, 'updated', `Fields updated: ${Object.keys(allowed).join(', ')}`);

  const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(task.id);
  res.json({ ...updated, tags: JSON.parse(updated.tags), metadata: JSON.parse(updated.metadata) });
});

// POST /tasks/:id/move — move task to a different column
router.post('/:id/move', requirePermission('task:move'), (req, res) => {
  const db = getDb();
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const { column_id, message } = req.body;
  if (!column_id) return res.status(400).json({ error: 'column_id is required' });

  const col = db.prepare('SELECT id FROM columns WHERE id = ?').get(column_id);
  if (!col) return res.status(400).json({ error: 'Invalid column_id' });

  const fromColumn = task.column_id;
  db.prepare('UPDATE tasks SET column_id = ? WHERE id = ?').run(column_id, task.id);

  db.prepare(`INSERT INTO task_logs (id, task_id, agent_id, action, from_column, to_column, message) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(uuidv4(), task.id, req.agent.id, 'moved', fromColumn, column_id, message || `Moved by ${req.agent.name || req.agent.role}`);

  const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(task.id);
  res.json({ ...updated, tags: JSON.parse(updated.tags), metadata: JSON.parse(updated.metadata) });
});

// POST /tasks/:id/log — add a log entry
router.post('/:id/log', requirePermission('task:log'), (req, res) => {
  const db = getDb();
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const { action = 'note', message } = req.body;
  if (!message) return res.status(400).json({ error: 'message is required' });

  db.prepare(`INSERT INTO task_logs (id, task_id, agent_id, action, message) VALUES (?, ?, ?, ?, ?)`)
    .run(uuidv4(), task.id, req.agent.id, action, message);

  res.json({ ok: true });
});

// POST /tasks/:id/request_human — flag task for human action
router.post('/:id/request_human', requirePermission('task:request_human'), (req, res) => {
  const db = getDb();
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const { reason } = req.body;
  const fromColumn = task.column_id;

  db.prepare(`UPDATE tasks SET column_id = 'col_humanaction', requires_human_action = 1, human_action_reason = ? WHERE id = ?`)
    .run(reason || 'Human action required', task.id);

  db.prepare(`INSERT INTO task_logs (id, task_id, agent_id, action, from_column, to_column, message) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(uuidv4(), task.id, req.agent.id, 'human_action_requested', fromColumn, 'col_humanaction', reason || 'Human action required');

  res.json({ ok: true, message: 'Task flagged for human action' });
});

// DELETE /tasks/:id
router.delete('/:id', requirePermission('task:delete'), (req, res) => {
  const db = getDb();
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
