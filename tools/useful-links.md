# Useful Links

GitHub repos reviewed for potential relevance to the Sales Dashboard project.
Sorted by relevance: High → Medium → Low.

---

## HIGH RELEVANCE

### UI/UX Pro Max Skill
- **Repo:** https://github.com/nextlevelbuilder/ui-ux-pro-max-skill.git
- **What:** Design reasoning engine — maps 161 product categories to design patterns, 25 chart types, 99 UX guidelines, 67 UI styles, React performance patterns. 16.9k stars.

| Feature | Relevance | Why |
|---------|-----------|-----|
| Chart type recommendations (25 types) | High | Grouped bars for YoY, line charts for trends, bullet charts for KPIs — with accessibility grades |
| Charting library guidance | High | Recommends Recharts, ApexCharts, D3, Chart.js — validates Recharts as our best fit |
| 99 UX guidelines | High | Layout, touch targets, spacing, navigation — directly applies to master-detail dashboard |
| React performance patterns | High | memo, Suspense, lazy loading, re-render optimization — critical for data-heavy dashboard |
| Pre-delivery accessibility checklist | High | 4.5:1 contrast, focus states, reduced motion, breakpoint testing (375px–1440px) |
| Animation rules | Medium | 150-300ms micro-interactions, transform/opacity only, respect prefers-reduced-motion |
| Design system compatibility check | Medium | Our warm palette maps to "Trust + Warmth" category — no conflicts |
| 161 product category mappings | Low | We already know our category (data-dense business dashboard) |
| 67 UI styles catalog | Low | We have our design system locked down |
| 57 font pairings | Low | We use system fonts |
| Landing page patterns (34) | Low | Not building a marketing site |
| React Native patterns | Skip | Web only |

---

### Claude Skills (alirezarezvani)
- **Repo:** https://github.com/alirezarezvani/claude-skills.git
- **What:** 205+ production-ready skills with actual implementations (SKILL.md + scripts + templates). Backend/infra-heavy.

| Skill | Relevance | Why |
|-------|-----------|-----|
| Docker Development | High | Multi-stage Node.js/TS build patterns — directly applies to our Railway Dockerfile |
| CI/CD Pipeline Builder | High | GitHub Actions automation for Railway deploy pipeline |
| API Design Reviewer | Medium | REST API validation patterns for Express backend routes |
| API Test Suite Builder | Medium | Testing patterns for backend API endpoints |
| Performance Profiler | Medium | Redis cache optimization — cache is critical to this project |
| Secrets Vault Manager | Medium | Environment secrets handling (Priority ERP creds, Upstash Redis keys) |
| Database Designer | Low-Medium | Redis key schema patterns, index optimization |
| PR Review Expert | Low | Code review — we already have `superpowers` for this |
| Tech Debt Tracker | Low | Useful later in maintenance phase |

- **Not covered:** React 19, Tailwind v4, TanStack Query, Zod, Framer Motion, OData, charts

---

### Awesome Claude Code Toolkit
- **Repo:** https://github.com/rohitg00/awesome-claude-code-toolkit.git
- **What:** Massive extension library — 135 agents, 150+ plugins, 35 skills, 42 commands, 20 hooks, 7 CLAUDE.md templates

| Skill / Resource | Relevance | Why |
|-----------------|-----------|-----|
| Hooks library (20) | High | Auto-enforce LLM code rules: file size < 200 lines, intent blocks, import order |
| CLAUDE.md templates (7) | Medium | Validate our CLAUDE.md structure against enterprise templates |
| DevOps commands | Medium | Railway deploy workflows, Docker build checks |
| TDD skills | Medium | Test-driven development for Express backend |
| Infrastructure agents | Medium | Redis caching strategies and patterns |
| TypeScript/React agents | Medium | Pre-built personas for fullstack development sessions |

- **Skip:** Most of 135 agents are for unrelated domains (blockchain, ML, game dev)

---

### Awesome Claude Code (jqueryscript)
- **Repo:** https://github.com/jqueryscript/awesome-claude-code.git
- **What:** Comprehensive ecosystem index covering 11 categories — broadest coverage of all repos reviewed

| Tool / Skill | Stars | Relevance | Why |
|-------------|-------|-----------|-----|
| `claude-code-spec-workflow` | 3.3k | High | Spec → Design → Tasks → Implementation — matches our exact development workflow |
| `ui-ux-pro-max-skill` | 16.9k | High | Professional UI/UX design skill for React 19 + Tailwind v4 frontend |
| `SuperClaude` | 20k | Medium | Specialized commands & methodologies for coding infrastructure |
| `claude-context-mode` | 2.2k | Medium | 98% context reduction — handles large Priority ERP API responses |
| `claude-mem` | 13.1k | Medium | Auto-captures & compresses context for long integration sessions |
| `claude-code-hooks-multi-agent-observability` | 893 | Medium | Real-time monitoring for parallel backend/frontend agent sessions |
| `planning-with-files` | 9.7k | Medium | Persistent markdown planning for complex integrations |
| `claudebox` | 795 | Low-Medium | Docker dev environment for local Express + React development |
| `ccpm` | 6k | Low-Medium | GitHub Issues + Git worktrees workflow |
| `cctrace` | 140 | Low | Export sessions to markdown — document integration patterns |

- **Already covered by other repos:** Superpowers (installed), claude-d3js-skill (reviewed), claude-code-sandbox (overlaps alirezarezvani Docker skills)

---

### Awesome Claude Code (hesreallyhim)
- **Repo:** https://github.com/hesreallyhim/awesome-claude-code.git
- **What:** Most comprehensive ecosystem index — 150+ resources, 9 categories. Production-oriented: autonomous loops, orchestration, observability, 70+ slash commands.

| Tool / Resource | Relevance | Why |
|----------------|-----------|-----|
| Ralph Wiggum Loop Framework | High | Autonomous development guardrails — automate build/test/fix cycles during implementation |
| 70+ slash commands library | High | Pre-built commands for git, testing, deployment, docs — saves setup time |
| Fullstack Dev Skills (65 skills) | High | Full-stack Express + React + TypeScript development patterns |
| TypeScript Quality Hooks | Medium | Quality checks for TypeScript projects — enforces strict mode rules |
| Claude Squad | Medium | Terminal app managing multiple agents — parallel server/client sessions |
| agnix | Medium | Linter for agent config files — validates CLAUDE.md and hook configs |
| claude-devtools | Medium | Desktop observability app — monitor agent sessions during parallel dev |
| parry | Medium | Prompt injection scanner for hooks — security for hook configs |
| run-claude-docker / viwo-cli | Medium | Docker runners with workspace forwarding — Railway-compatible development |
| Rulesync | Low | Config generation across agents — useful for multi-AI reviewer workflow |

- **Overlap:** Superpowers, ui-ux-pro-max-skill, SuperClaude, claude-mem all already cataloged above

---

## MEDIUM RELEVANCE

### D3.js Skill for Claude Code
- **Repo:** https://github.com/chrisvoncsefalvay/claude-d3js-skill.git
- **What:** Claude Code skill with React + D3 templates, color schemes, scale references

| Skill / Asset | Relevance | Why |
|--------------|-----------|-----|
| Bar chart template (`chart-template.jsx`) | Medium | `scaleBand` + `scaleLinear` — matches our YoY comparison bar charts |
| Interactive template (`interactive-template.jsx`) | Medium | Tooltips, hover states, zoom — enhances chart interactivity |
| React + D3 integration pattern | Medium | `useRef` + `useEffect` + D3 rendering — standard approach for D3 in React |
| Color scheme reference (`colour-schemes.md`) | Low | Accessibility guidance for diverging scales (we already have a design system) |
| Scale reference (`scale-reference.md`) | Low | Standard D3 scale docs — available anywhere |

- **When to use:** Only if we choose D3.js over a React-native charting library (Recharts, Nivo). Our mockup charts are standard bar/trend types — D3 may be overkill.

---

### Claude Code (Development Tool)
- **Repo:** https://github.com/anthropics/claude-code.git
- **What:** CLI agentic development tool — the tool we use to build this project

| Feature | Relevance | Why |
|---------|-----------|-----|
| Worktree isolation | Medium | Parallel backend/frontend agents on isolated branches — fits our parallel session rules |
| PreToolUse hooks | Medium | Could auto-enforce project rules (file size limits, intent blocks, import order) |
| Agent teams | Medium | Coordinate independent server/ and client/ development |
| `/loop` command | Low | Monitor Railway deploys, watch for TS build errors |
| Cron scheduling | Low | Automated cache warming or health checks post-deploy |

- **Not a code reference:** This is our development tool's source code and docs, not reusable libraries.

---

## LOW RELEVANCE

### Awesome Claude Skills (travisvn)
- **Repo:** https://github.com/travisvn/awesome-claude-skills.git
- **What:** Curated directory of Claude Code skills — official + community. Discovery index, not a toolkit.

| Skill | Relevance | Why |
|-------|-----------|-----|
| `webapp-testing` (Playwright) | Medium | E2E testing for the React frontend when we need it |
| `frontend-design` | Already installed | Guides distinctive React + Tailwind interfaces |
| `obra/superpowers` | Already installed | TDD, debugging, planning, code review |
| `web-artifacts-builder` | Low | React + Tailwind + shadcn/ui artifacts — could prototype components |
| `mcp-builder` | Low | Only if we expose Priority ERP via MCP |

- **Low priority overall:** Most listed skills are already known or installed.

---

### Awesome Claude Skills (Composio)
- **Repo:** https://github.com/ComposioHQ/awesome-claude-skills.git
- **What:** 33+ skills focused on SaaS app integrations via Composio connector platform

| Skill | Relevance | Why |
|-------|-----------|-----|
| `webapp-testing` | Medium | End-to-end testing for the dashboard |
| `mcp-builder` | Low | Only if we expose Priority ERP data via MCP |
| `theme-factory` | Low | Theme generation — we already have a locked-down design system |

- **Low relevance overall:** Most skills are SaaS automations (Slack, email, CRM) — not software development. Composio dependency adds unnecessary coupling.
