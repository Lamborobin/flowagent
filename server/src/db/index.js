const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data/flowagent.db');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

function initDb() {
  const db = getDb();

  db.exec(`
    -- Columns (kanban columns, customizable)
    CREATE TABLE IF NOT EXISTS columns (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      position INTEGER NOT NULL,
      color TEXT DEFAULT '#6366f1',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Agent roles
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL UNIQUE,
      model TEXT DEFAULT 'claude-opus-4-5',
      description TEXT,
      permissions TEXT NOT NULL DEFAULT '[]',
      prompt_file TEXT,
      color TEXT DEFAULT '#6366f1',
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Tasks
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      column_id TEXT NOT NULL REFERENCES columns(id),
      assigned_agent_id TEXT REFERENCES agents(id),
      priority TEXT DEFAULT 'medium' CHECK(priority IN ('low','medium','high','critical')),
      complexity TEXT DEFAULT 'medium' CHECK(complexity IN ('low','medium','high')),
      recommended_model TEXT,
      tags TEXT DEFAULT '[]',
      progress INTEGER DEFAULT 0 CHECK(progress >= 0 AND progress <= 100),
      requires_human_action INTEGER DEFAULT 0,
      human_action_reason TEXT,
      retry_count INTEGER DEFAULT 0,
      max_retries INTEGER DEFAULT 1,
      metadata TEXT DEFAULT '{}',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Task activity log
    CREATE TABLE IF NOT EXISTS task_logs (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      agent_id TEXT REFERENCES agents(id),
      action TEXT NOT NULL,
      from_column TEXT,
      to_column TEXT,
      message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Secrets (keys/env vars that need human approval)
    CREATE TABLE IF NOT EXISTS secrets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      task_id TEXT REFERENCES tasks(id),
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending','provided','rejected')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Trigger: update tasks.updated_at
    CREATE TRIGGER IF NOT EXISTS tasks_updated_at
      AFTER UPDATE ON tasks
      BEGIN
        UPDATE tasks SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END;

    -- Trigger: update agents.updated_at
    CREATE TRIGGER IF NOT EXISTS agents_updated_at
      AFTER UPDATE ON agents
      BEGIN
        UPDATE agents SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END;
  `);

  // Seed default columns if empty
  const colCount = db.prepare('SELECT COUNT(*) as c FROM columns').get();
  if (colCount.c === 0) {
    const insertCol = db.prepare('INSERT INTO columns (id, name, position, color) VALUES (?, ?, ?, ?)');
    const cols = [
      ['col_backlog',      'Backlog',       0, '#64748b'],
      ['col_inprogress',   'In Progress',   1, '#3b82f6'],
      ['col_testing',      'Testing',       2, '#8b5cf6'],
      ['col_humanaction',  'Human Action',  3, '#f59e0b'],
      ['col_humanreview',  'Human Review',  4, '#ec4899'],
      ['col_done',         'Done',          5, '#10b981'],
    ];
    cols.forEach(c => insertCol.run(...c));
    console.log('✅ Default columns seeded');
  }

  // Seed default agents if empty
  const agentCount = db.prepare('SELECT COUNT(*) as c FROM agents').get();
  if (agentCount.c === 0) {
    const insertAgent = db.prepare(`
      INSERT INTO agents (id, name, role, model, description, permissions, prompt_file, color)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const defaultAgents = [
      [
        'agent_pm', 'Project Manager', 'pm',
        'claude-opus-4-5',
        'Plans and manages tasks. Creates, updates, and prioritizes work.',
        JSON.stringify(['task:create','task:read','task:update','task:delete','task:move','task:assign']),
        'agents/pm.md', '#6366f1'
      ],
      [
        'agent_dev', 'Developer', 'developer',
        'claude-sonnet-4-5',
        'Implements features and fixes bugs. Can update task status and add notes.',
        JSON.stringify(['task:read','task:move','task:update:status','task:update:progress','task:log']),
        'agents/developer.md', '#3b82f6'
      ],
      [
        'agent_test', 'Tester', 'tester',
        'claude-sonnet-4-5',
        'Runs tests and validates implementations. Can flag tasks for human action.',
        JSON.stringify(['task:read','task:move','task:update:status','task:update:progress','task:log','task:request_human']),
        'agents/tester.md', '#8b5cf6'
      ],
    ];
    defaultAgents.forEach(a => insertAgent.run(...a));
    console.log('✅ Default agents seeded');
  }

  console.log('✅ Database initialized at', DB_PATH);
  return db;
}

module.exports = { getDb, initDb };
