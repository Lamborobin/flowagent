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
├── instructions/            # Agent system prompts + context files (selectable in UI)
│   ├── pm.md                # PM agent system prompt
│   ├── developer.md         # Developer agent system prompt
│   ├── tester.md            # Tester agent system prompt
│   ├── project.md           # Full project context (tech stack, conventions, state)
│   └── client.md            # Client context (priorities, expectations, style)
├── server/                  # Node.js + Express + SQLite API (port 3001)
│   └── src/
│       ├── db/index.js      # Schema, init, seeding, migrations
│       ├── middleware/auth.js
│       ├── services/agentRunner.js
│       └── routes/          # tasks.js, other.js (agents/columns/secrets/instructions/agent-templates)
├── app/                     # React frontend (Vite, port 5173)
│   └── src/
│       ├── api/index.js     # Axios API client
│       ├── store/index.js   # Zustand global state
│       └── components/      # Sidebar, Column, TaskCard, TaskDetail, Modals, AgentForm, TemplatesModal
├── data/                    # SQLite DB (auto-created)
└── README.md
```

## Pipeline
```
Backlog → In Progress → Testing → Human Review → Done
  (PM Q&A)   (Dev branch)            ↑
             ↑      |         (Tester passes)
             └──────┘  (1 retry on failure)
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
- **Role**: Conversational planning — ask clarifying questions until task is crystal-clear, then approve
- **Trigger**: Assigned to task in Backlog → starts Q&A conversation immediately
- **Gate**: Both PM approval + human sign-off required before task can move to In Progress

### Developer (`agent_dev`)
- **Model**: claude-sonnet-4-5
- **Permissions**: Read, move, update status/progress, log, request human
- **Role**: Implement tasks, create feature branch, commit + push, move to Testing
- **Trigger**: Assigned to task in In Progress → creates `feature/task-{id}` branch immediately
- **Git flow**: `git checkout -b feature/task-{id}` → implement → `git commit` → `git push` → move to Testing

### Tester (`agent_test`)
- **Model**: claude-sonnet-4-5
- **Permissions**: Read, move, update status/progress, log, request human
- **Role**: Validate implementations, run tests, pass to Human Review or send back to Dev

### Human (`X-Agent-Id: human`)
- Full access to everything
- Participates in PM planning conversation (answers PM questions in task detail)
- Gives final sign-off after PM approves
- Only one who can: create/edit/delete agents, create/edit columns, view/resolve secrets

## PM Planning Conversation Flow
```
1. Human creates task in Backlog with PM assigned
2. pm_approval_status → 'pending' (auto-set)
3. PM reads description + context.md
4. PM asks clarifying question → pm_approval_status = 'questioning'
5. Human sees question in task detail, types reply
6. PM reads answer, may ask follow-up or approve
7. Loop until PM satisfied → POST /api/tasks/:id/pm_review { approved: true }
8. Human sees "PM satisfied" → clicks Approve & unlock In Progress
9. Task can now be dragged to In Progress
```

## Assignment Rules (enforced by API)
| Column | Allowed agents |
|---|---|
| Backlog | agent_pm, human |
| In Progress | agent_dev, human |
| Testing | agent_test, human |
| Human Action | human |
| Human Review | human |
| Done | human |

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
- PM conversations create shared understanding — not just rubber-stamping

## Running the Project
```bash
npm run install:all        # Install all dependencies
npm run dev                # Start frontend + backend

# Frontend: http://localhost:5173
# API: http://localhost:3001/api
```

## Agent Instruction File System
Each agent has two layers of files:
1. **`prompt_file`** — the agent's primary system prompt (e.g. `instructions/pm.md`)
2. **`instruction_files`** — JSON array of additional context files (e.g. `["instructions/client.md","instructions/project.md"]`)
3. **Global files** — `CLAUDE.md` and `README.md` are always loaded for every agent automatically

All files are resolved from the project root. The `GET /api/instructions` endpoint lists all available `.md` files in the `instructions/` folder for selection in the UI.

Default assignments:
- **PM**: prompt=`instructions/pm.md`, context=`[client.md, project.md]`
- **Developer**: prompt=`instructions/developer.md`, context=`[project.md]`
- **Tester**: prompt=`instructions/tester.md`, context=`[project.md]`

## Running Agents via Claude Code
```bash
claude --system-prompt instructions/pm.md
claude --system-prompt instructions/developer.md
claude --system-prompt instructions/tester.md
```

## API Reference

### Tasks
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/tasks | List all tasks (filter: column_id, assigned_agent_id) |
| POST | /api/tasks | Create task |
| PATCH | /api/tasks/:id | Update task fields |
| POST | /api/tasks/:id/move | Move to column (enforces approval gate) |
| POST | /api/tasks/:id/log | Add activity log entry |
| POST | /api/tasks/:id/request_human | Flag for human action |
| DELETE | /api/tasks/:id | Delete task |

### PM Planning Conversation
| Method | Endpoint | Who | Description |
|--------|----------|-----|-------------|
| POST | /api/tasks/:id/pm_question | agent_pm | PM posts a clarifying question |
| POST | /api/tasks/:id/answer | human | Human answers PM's pending question |
| POST | /api/tasks/:id/pm_review | agent_pm | PM approves or rejects (final) |
| POST | /api/tasks/:id/request_pm_review | human | Manually trigger PM review |

### Human Approval
| Method | Endpoint | Who | Description |
|--------|----------|-----|-------------|
| POST | /api/tasks/:id/approve | human | Human gives sign-off (after PM approves) |
| POST | /api/tasks/:id/reject | human | Human rejects (resets cycle) |

### Agents / Columns / Secrets
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/agents | List agents |
| POST | /api/agents | Create agent (human only) |
| POST | /api/agents/:id/archive | Soft-archive agent (human only) |
| POST | /api/agents/:id/unarchive | Restore archived agent (human only) |
| DELETE | /api/agents/:id | Hard delete if no tasks; 409 if has tasks |
| GET | /api/columns | List columns (`?include_archived=true`) |
| POST | /api/columns | Create column (human only) |
| POST | /api/columns/:id/archive | Soft-archive column (human only) |
| POST | /api/columns/:id/unarchive | Restore archived column (human only) |
| DELETE | /api/columns/:id | Hard delete if no tasks; 409 if has tasks |
| GET | /api/secrets | List secrets (human only) |
| POST | /api/secrets | Request secret |

## Task Schema (key fields)
```json
{
  "id": "task_xxxxxxxxxxxx",
  "title": "...",
  "description": "...",
  "column_id": "col_backlog",
  "assigned_agent_id": "agent_pm",
  "priority": "low|medium|high|critical",
  "complexity": "low|medium|high",
  "progress": 0,
  "pm_approval_status": "pending|questioning|approved|rejected",
  "pm_pending_question": "Current unanswered PM question (null if none)",
  "pm_review_comment": "PM's final summary for the developer",
  "human_approval_status": "pending|approved|rejected",
  "tags": [],
  "metadata": {}
}
```

## Task Log Action Types
| Action | Who | Meaning |
|--------|-----|---------|
| created | system | Task was created |
| updated | any | Fields changed |
| moved | any | Column changed |
| pm_review_requested | human | PM review triggered |
| pm_question | agent_pm | PM asked a clarifying question |
| human_answer | human | Human answered PM's question |
| pm_reviewed | agent_pm | PM gave final approval |
| human_approved | human | Human gave sign-off |
| human_rejected | human | Human rejected |
| developer_assigned | system | Developer assigned in In Progress |
| branch_created | agent_dev | Git branch created and pushed |
| human_action_requested | any | Blocked, needs human |

## Environment Setup
Add to `server/.env`:
```
ANTHROPIC_API_KEY=sk-ant-...   # Required for agent auto-triggering
```

## Agent Template System

Two distinct but related concepts — do not confuse them:

### 1. Agent Templates (`agent_templates` table)
Reusable blueprints for creating new agents. Managed in the Templates modal (Sidebar → Templates button).

- Each template has: name, description, model, color, suggested_role, system_prompt_content, template_system_prompt, instruction_files, permissions, tags
- `system_prompt_content` — markdown text that prefills the inline prompt editor when creating an agent from this template
- `template_system_prompt` — optional behavioural framework prompt (like PM's). If set, agents created from this template get `is_template = 1` and this prompt propagated automatically; they show a `T` badge
- Templates can be archived; editing a template only affects future agent creations
- 3 default templates seeded on first run: Project Manager, Developer, Tester
- **API**: `GET /api/agent-templates`, `POST`, `PATCH /:id`, `POST /:id/archive`, `POST /:id/unarchive`, `DELETE /:id`
- Delete is hard-delete only when no agents were created from the template; otherwise 409 → archive instead
- **API**: `POST /api/agents/:id/save-as-template` — snapshot an existing agent into a new template

### 2. Template Agents (`is_template` flag on agents)
Agents with a built-in behavioural framework prompt (e.g. PM). These show:
- **Template Behaviour Prompt** (readonly by default, "Customize" / "Reset to default" toggle)
- **System Prompt File** (the role-specific instructions)

An agent gets `is_template = 1` either by seeding (PM) or by being created from an agent template that has `template_system_prompt`.

### T Badge
Shows on an agent in the Sidebar when `agent.is_template || agent.created_from_template_id`. Turns amber if the origin template was archived.

## Tasks — Additional Fields
- `acceptance_criteria TEXT` — concrete, testable done conditions
- `archived_at DATETIME` — soft-archive (excluded from default task list)
- `is_locked` (computed) — true when PM planning is in progress (pm_approval_status set but not both approvals done)
  - Locked tasks: amber border, drag disabled, move buttons hidden, content edits blocked for non-humans
- **API**: `POST /api/tasks/:id/archive`, `POST /api/tasks/:id/bypass_pm`

## Monorepo Structure (updated)
```
flowagent/
├── instructions/            # Agent system prompts + context files (selectable in UI)
│   ├── pm.md                # PM agent system prompt
│   ├── developer.md         # Developer agent system prompt
│   ├── tester.md            # Tester agent system prompt
│   ├── project.md           # Full project context (tech stack, conventions, state)
│   └── client.md            # Client context (priorities, expectations, style)
├── server/                  # Node.js + Express + SQLite API (port 3001)
│   └── src/
│       ├── db/index.js      # Schema, init, seeding, migrations
│       ├── middleware/auth.js
│       ├── services/agentRunner.js  # PM AI auto-trigger via Anthropic SDK
│       └── routes/          # tasks.js, other.js (agents/columns/secrets/instructions/agent-templates)
├── app/                     # React frontend (Vite, port 5173)
│   └── src/
│       ├── api/index.js     # Axios API client
│       ├── store/index.js   # Zustand global state
│       └── components/      # Sidebar, Column, TaskCard, TaskDetail, Modals, AgentForm, TemplatesModal
├── data/                    # SQLite DB (auto-created)
└── README.md
```

## Not Yet Built
- Developer agent auto-trigger via Anthropic API (same pattern as PM runner, not yet wired)
- Tester agent auto-trigger
- Docker test environment (isolated Linux for Tester agent)
- Secrets management UI panel
- Webhooks / desktop notifications
- GitHub PR creation via API (branches pushed, PRs created manually)
- CTO/Reviewer agent (optional code review before Human Review)
- Column customization UI
- Agent assignment dropdown restricted to allowed agents per column in the UI (API enforces it, but UI doesn't filter yet)

## Archive / Delete Convention (applies everywhere in the codebase)

**Rule: has dependencies → archive; no dependencies → delete.**

This is a hard project convention. Every entity must have both archive and delete. When adding a new entity or endpoint, always follow this pattern:

| Condition | Action |
|---|---|
| Entity has no relations/dependents | Hard delete (remove from DB) |
| Entity has dependents (tasks, agents, etc.) | Archive only (soft delete — set `archived_at`, preserve in DB) |

### Per-entity rules
| Entity | Delete condition | Archive condition |
|---|---|---|
| **Task** | `human_approval_status != 'approved'` (never worked on) | Has been approved and moved to pipeline |
| **Agent** | No tasks assigned (`assigned_agent_id` count = 0) | Has assigned tasks |
| **Agent Template** | No agents created from it (`created_from_template_id` count = 0) | Agents exist that were created from it |
| **Column** | No tasks in column | Has tasks |

### Implementation pattern (server)
- `POST /api/:resource/:id/archive` — set `archived_at = CURRENT_TIMESTAMP` (+ `active = 0` for agents)
- `POST /api/:resource/:id/unarchive` — set `archived_at = NULL` (+ `active = 1` for agents)
- `DELETE /api/:resource/:id` — hard delete if no dependents; return `409 { error: '...', has_dependencies: true }` if blocked
- GET endpoints accept `?include_archived=true` to return soft-deleted records

### Implementation pattern (frontend)
- Always show both Archive and Delete buttons/options
- If DELETE returns `409 { has_dependencies: true }`, show the error message and nudge toward archive
- Archived items are fetched on `load()` (with `include_archived=true`) so they can be restored in the UI
- Each entity has a restore path (unarchive) visible somewhere in the UI

### DB schema fields
- `archived_at DATETIME` — present on: tasks, agent_templates, agents, columns
- `agents.active INTEGER` — also used for agents (alongside `archived_at`); Sidebar filters by `active = 1`

## Session Notes (2026-04-27)
This session established the core PM → Human → Developer pipeline and the agent template system:
- PM is now a real AI conversation, not a rubber-stamp — it reads context.md and asks questions
- Human answers inline in the task detail panel; PM auto-resumes after each answer
- Both PM approval + human sign-off strictly required before Backlog → In Progress
- Developer agent receives git workflow instructions: branch per task, commit with task ID, push
- Timestamps fixed to display in local browser timezone (SQLite UTC → JS Date fix)
- New task modal defaults to PM agent
- PM agent auto-triggers via Anthropic SDK (agentRunner.js) when PM is assigned or human answers
- agentRunner uses lazy client init (`getClient()`) so dotenv loads before API key is read
- dotenv loads with `override: true` so Windows system env vars don't shadow .env values
- PM uses structured tool use: `ask_question` / `approve_task` tools guarantee valid structured response
- Task locking during PM planning: locked = amber border, drag disabled, content edits blocked
- Bypass PM checks button (two-step confirm) + Archive task (two-step confirm) added to TaskDetail
- Acceptance criteria field added to tasks + NewTaskModal
- Agent template system: Templates modal, save-as-template, 3 seeded templates, T badge
- Editing a template only affects future agents, not existing ones

## Known Issues / Blockers
- Anthropic API account needs credits before agents can actually respond (billing issue, not code)
- Developer agent auto-trigger not yet wired (only logs `developer_assigned`, doesn't call Anthropic API)
