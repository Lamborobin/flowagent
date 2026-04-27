# Client Context

This file describes who is using AutoKan and what they care about. Use this when planning tasks to ensure the work aligns with real client needs and priorities.

## About the Client
AutoKan is currently being developed for internal use and as a platform product. The primary user is a technical founder / solo developer who:
- Manages their own software projects
- Wants AI agents to reduce repetitive development tasks
- Stays hands-on at key decision points (approvals, secrets, final review)
- Values speed and clarity over ceremony

## Client Priorities (in order)
1. **Correctness** — agents do what they're supposed to do, no surprises
2. **Visibility** — the human always knows what's happening and why
3. **Control** — no agent should take irreversible action without human sign-off
4. **Speed** — reduce the time from "idea" to "working code" substantially
5. **Customizability** — agents and columns can be tailored to any project

## Communication Style Preferences
- Direct and concise — no filler
- Technical when appropriate — the client understands code
- Surface trade-offs — don't hide complexity, explain it briefly
- Client-friendly tone when summarising for non-technical stakeholders

## What the Client Considers Done
A task is "done" when:
- It works as described in the requirements
- It doesn't break existing functionality
- The human has reviewed and approved it
- It's merged (or ready to merge) into the main branch

## Things the Client Cares About
- Agents that ask smart, focused questions (not generic ones)
- Clear activity logs — knowing what each agent actually did
- The PM who reads client context and understands business intent, not just tech specs
- Minimal ceremony — no unnecessary approvals or gate-keeping
- Transparency about blockers — flag early, not late

## Things to Avoid
- Over-engineering simple tasks
- Asking obvious questions just to appear thorough
- Moving tasks forward without the required approvals
- Silent failures — always log what went wrong
