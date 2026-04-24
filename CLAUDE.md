# FlowAgent — Claude Code Orientation

**What This Is**: Autonomous AI agent task orchestration system — a kanban board where AI agents (PM, Developer, Tester) work through tasks autonomously with human checkpoints. Built for full ownership without third-party dependencies.

## Tech Stack
- **Backend**: Node.js + Express + SQLite (better-sqlite3)
- **Frontend**: React + Tailwind + Vite
- **Drag & Drop**: @dnd-kit
- **State**: Zustand
- **Future**: Docker for test environments

## Monorepo Structure
```
flowagent/
├── server/                  # Node.js + Express + SQLite API (port 3001)
│   └── src/
│       ├── db/index.js      # Schema, init, seeding
│       ├── middleware/auth.js
│       └── routes/          # tasks.js, agents.js, columns.js, secrets.js
├── app/                     # React frontend (Vite, port 5173)
│   └── src/
│       ├── api/index.js     # Axios API client
│       ├── store/index.js   # Zustand global state
│       └── components/      # Sidebar, Column, TaskCard, TaskDetail, Modals
├── agents/                  # System prompts + config
│   ├── pm.md
│   ├── developer.md
│   ├── tester.md
│   └── config.json
├── data/                    # SQLite DB (auto-created)
└── README.md
```

## Pipeline
```
Backlog → In Progress → Testing → Human Review → Done
            ↑              |
            └──────────────┘  (1 retry on failure)
                           ↓
                    Human Action  (blocked: secrets, errors, max retries)
```

### Column IDs
| Column | ID |
|---|---|
| Backlog | `col_backlog` |
| In Progress | `col_inprogress` |
| Testing | `col_testing` |
| Human Action | `col_humanaction` |
| Human Review | `col_humanreview` |
| Done | `col_done` |

## Agent Roles & Permissions

Agents identify via HTTP header: `X-Agent-Id: <agent_id>`

### Project Manager (`agent_pm`)
- **Model**: claude-opus-4-5
- **Permissions**: Full CRUD on tasks, move, assign, log
- **Role**: Break down features into tasks, write detailed descriptions, assign to correct agent

### Developer (`agent_dev`)
- **Model**: claude-sonnet-4-5
- **Permissions**: Read, move, update status/progress, log, request human
- **Role**: Implement tasks, update progress, move to Testing when done

### Tester (`agent_test`)
- **Model**: claude-sonnet-4-5
- **Permissions**: Read, move, update status/progress, log, request human
- **Role**: Validate implementations, run tests, pass to Human Review or send back to Dev

### Human (`X-Agent-Id: human`)
- Full access to everything
- Only one who can: create/edit/delete agents, create/edit columns, view/resolve secrets, make final approvals

## Model Assignment Strategy
| Complexity | Model |
|---|---|
| low | claude-haiku-4-5-20251001 |
| medium | claude-sonnet-4-5 |
| high | claude-opus-4-5 |

## Secrets / Human Action Flow
1. Agent discovers it needs a secret → calls `POST /api/tasks/:id/request_human`
2. Task moves to `col_humanaction`
3. Human adds secret to environment
4. Human resolves via UI (`/api/secrets/:id/resolve`)
5. Agent continues

## Design Principles
- You own everything — no third-party services beyond Anthropic
- Human stays in control — agents can't approve their own work or touch secrets
- Customizable by design — agents are markdown files, columns are database rows, permissions are JSON arrays
- One retry by default — prevents infinite loops while allowing self-correction
- Agents talk to API (the database is the shared state), not to each other directly

## Running the Project
```bash
npm run install:all        # Install all dependencies
npm run dev                # Start frontend + backend

# Frontend: http://localhost:5173
# API: http://localhost:3001/api
```

## Running Agents via Claude Code
```bash
claude --system-prompt agents/pm.md
claude --system-prompt agents/developer.md
claude --system-prompt agents/tester.md
```

## API Reference
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/tasks | List all tasks |
| POST | /api/tasks | Create task (PM/human) |
| PATCH | /api/tasks/:id | Update task |
| POST | /api/tasks/:id/move | Move to column |
| POST | /api/tasks/:id/log | Add activity log |
| POST | /api/tasks/:id/request_human | Flag for human action |
| DELETE | /api/tasks/:id | Delete task |
| GET | /api/agents | List agents |
| POST | /api/agents | Create agent (human only) |
| GET | /api/columns | List columns |
| POST | /api/columns | Create column (human only) |
| GET | /api/secrets | List secrets (human only) |
| POST | /api/secrets | Request secret |

## Not Yet Built
- Claude Code runner script (autonomous agent polling)
- Docker test environment (isolated Linux for Tester agent)
- Secrets management UI panel
- Webhooks / desktop notifications
- CTO/Reviewer agent (optional code review before Human Review)
- Column customization UI
