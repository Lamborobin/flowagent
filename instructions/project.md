# Project Context — FlowAgent

This file gives all agents background knowledge about the project so they can ask smarter questions, implement correctly, and test accurately.

## What Is FlowAgent?
An autonomous AI agent task orchestration system — a kanban board where AI agents (PM, Developer, Tester) work through software tasks autonomously. The human stays in the loop at key checkpoints. The goal is to reduce repetitive manual work while keeping humans in control of decisions that matter.

## Tech Stack
- **Backend**: Node.js + Express + SQLite (better-sqlite3) — port 3001
- **Frontend**: React + Tailwind CSS + Vite — port 5173
- **State**: Zustand
- **Drag & Drop**: @dnd-kit
- **DB**: SQLite via better-sqlite3 (no ORM)
- **AI**: Anthropic SDK (Claude models)

## Project Structure
```
flowagent/
├── instructions/          # Agent system prompts and context files
│   ├── pm.md              # PM agent system prompt
│   ├── developer.md       # Developer agent system prompt
│   ├── tester.md          # Tester agent system prompt
│   ├── project.md         # This file — project context
│   └── client.md          # Client context and expectations
├── server/src/
│   ├── db/index.js          # Schema + seeding + migrations
│   ├── middleware/auth.js   # Agent auth via X-Agent-Id header
│   ├── routes/              # tasks.js, other.js (agents/columns/secrets/instructions)
│   └── services/agentRunner.js  # PM agent Anthropic SDK runner
├── app/src/
│   ├── api/index.js         # Axios API client
│   ├── store/index.js       # Zustand global state
│   └── components/          # React UI components
├── data/                    # SQLite DB (auto-created at runtime)
├── CLAUDE.md                # Claude Code orientation guide
└── README.md
```

## Coding Conventions
- Backend: plain Node.js CommonJS (`require`/`module.exports`), no TypeScript
- Frontend: React functional components with hooks, JSX, Tailwind utility classes
- No ORM — raw SQL via `db.prepare().run()` / `.get()` / `.all()`
- API always returns JSON; errors use `{ error: "message" }` shape
- Agent auth: every API request needs `X-Agent-Id` header matching an agent in DB
- SQLite timestamps are UTC; convert to local time in the browser with `new Date(ts + 'Z')`

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

## Agent System
Each agent has:
- A **system prompt file** (e.g., `instructions/pm.md`) defining their behavior
- **Instruction files** (e.g., `instructions/project.md`, `instructions/client.md`) giving them context
- **Global files** always loaded: `CLAUDE.md`, `README.md`
- A **model** (Opus for PM, Sonnet for Dev/Tester)
- **Permissions** — a JSON array of allowed API actions

## Current State (as of 2026-04-27)
The following is built and working:
- Kanban board with 6 columns
- Task CRUD with priority, complexity, tags, progress tracking, acceptance criteria
- Task locking during PM planning phase (amber border, no drag, content protected)
- Task archive + bypass PM checks (human override)
- Agent management (PM, Developer, Tester) with instruction file references
- PM planning conversation workflow (real Q&A before tasks go to In Progress)
- Approval gate: both PM + human must approve before Backlog → In Progress
- Developer git workflow: create branch, commit, push on task assignment
- Column-based assignment restrictions (PM in Backlog, Dev in Progress, etc.)
- Activity log on every task
- PM agent auto-triggers via Anthropic SDK when assigned
- Agent Template system: template library, save-as-template, 3 default templates seeded
  - Templates have optional Template Behaviour Prompt (propagated to agents on creation)
  - T badge on agents created from templates or with is_template flag
  - Amber T badge when origin template has been archived

## Agent Template vs Template Agent
- **Agent Template** (`agent_templates` table): blueprint for creating new agents; editing it only affects future creations
- **Template Agent** (`is_template = 1` on agent): has a built-in behavioural framework prompt shown alongside the system prompt (e.g. PM agent)
- An agent can be both: created from a template that had a template_system_prompt → gets is_template=1 automatically

## Not Yet Built
- Developer and Tester auto-triggers via Anthropic SDK
- Docker isolated test environment for Tester
- Secrets management UI panel
- Webhooks / real-time notifications
- GitHub PR creation via API
- CTO/Reviewer agent (optional code review before Human Review)
- Column customization UI

## Design Principles
1. Human stays in control — agents can't approve their own work or touch secrets
2. No third-party services beyond Anthropic API
3. Everything is customizable — agents are markdown files, columns are DB rows
4. One retry by default — prevents infinite loops
5. Agents talk to the API (the database is the shared state), not to each other directly

## When Reviewing or Implementing Tasks, Consider:
- Does the task fit within the existing React + Express + SQLite stack?
- Is it scoped to a single concern (not mixing frontend + backend + DB in one task)?
- Does the developer need to know about any existing components or API patterns?
- Is there a dependency on something not yet built (e.g., auth, Docker, webhooks)?
- Is the scope right for one PR / one branch?
