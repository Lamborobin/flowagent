const { getDb } = require('../db');

/**
 * Middleware to verify an agent has a specific permission.
 * Agents identify themselves via X-Agent-Id header.
 * Humans can pass X-Agent-Id: human to bypass permission checks.
 */
function requirePermission(permission) {
  return (req, res, next) => {
    const agentId = req.headers['x-agent-id'];

    // Human override — full access
    if (agentId === 'human') {
      req.agent = { id: 'human', role: 'human', permissions: ['*'] };
      return next();
    }

    if (!agentId) {
      return res.status(401).json({ error: 'Missing X-Agent-Id header' });
    }

    const db = getDb();
    const agent = db.prepare('SELECT * FROM agents WHERE id = ? AND active = 1').get(agentId);

    if (!agent) {
      return res.status(401).json({ error: 'Unknown or inactive agent' });
    }

    const permissions = JSON.parse(agent.permissions || '[]');
    const hasPermission = permissions.includes(permission) || permissions.includes('*');

    if (!hasPermission) {
      return res.status(403).json({
        error: `Agent "${agent.name}" (${agent.role}) lacks permission: ${permission}`,
        agent: agent.role,
        required: permission,
        available: permissions
      });
    }

    req.agent = { ...agent, permissions };
    next();
  };
}

/**
 * Soft auth — attaches agent to req if header present, but doesn't block
 */
function attachAgent(req, res, next) {
  const agentId = req.headers['x-agent-id'];
  if (!agentId) return next();

  if (agentId === 'human') {
    req.agent = { id: 'human', role: 'human', permissions: ['*'] };
    return next();
  }

  const db = getDb();
  const agent = db.prepare('SELECT * FROM agents WHERE id = ? AND active = 1').get(agentId);
  if (agent) {
    req.agent = { ...agent, permissions: JSON.parse(agent.permissions || '[]') };
  }
  next();
}

module.exports = { requirePermission, attachAgent };
