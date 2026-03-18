# 🎨 Product Designer Agent

> An AI agent that orchestrates the **complete UX design lifecycle** — from a raw problem statement to a validated, interactive prototype — with built-in intake gates so every output is shaped by your specific creative direction, not a generic AI default.

Built on the [Anthropic Python SDK](https://github.com/anthropics/anthropic-sdk-python) and powered by Claude.

---

## What it does

You give the agent a project brief. It reads the brief, decides which design skills are actually needed for your project, and executes only those — in the right order. Not every project needs every step. A rebrand skips research and goes straight to brand guidelines. A validation task jumps to usability testing. The agent figures out the right sequence from your brief.

```
Your Project Brief
        ↓
  Project Plan  ←  agent reads brief, selects only the relevant skills
        ↓
  [ Intake Gate ]  ←  before certain skills, pauses to ask 2–6 quick questions
        ↓                 so the output matches your creative intent
  [ Skill runs with your direction baked in ]
        ↓
  Auto QA → Auto-Revise → Approve
        ↓
  Agent Logbook & Self-Reflection
```

**Available skills the agent can draw from:**

| Phase | Skills |
|---|---|
| Research | Literature Review, Competitor Analysis |
| User Research | Interview Guide, Simulated Interviews, UXR Synthesis |
| Design | Ideation, PRD, User Flow, Information Architecture, Brand Guidelines, Design System |
| Build | Interactive HTML/CSS/JS Prototype |
| Validation | Usability Test Guide, Simulated Usability Testing |

**How the agent runs each skill:**

1. For skills with an intake gate, pauses to ask a few quick questions (see below)
2. Streams the output to you live as it generates
3. Runs an automated QA check (completeness · UX principles · WCAG · brief alignment)
4. If QA passes → auto-approves and moves to the next skill immediately
5. If QA finds issues → automatically revises using the QA recommendations, re-runs, re-checks — no human needed
6. Only asks for your input if the output still falls short after auto-revision attempts, or if a fundamental decision requires human judgment
7. Logs a self-reflection learning entry after every skill

**You stay in control** — you can review every completed deliverable in the sidebar at any time and request a manual revision. Your creative direction inputs are shown in the right panel as editable cards throughout the session.

---

## Intake Gates — how the agent avoids generic output

Before running three specific skills, the agent pauses and asks you a short set of targeted questions. Your answers are passed to the skill as hard constraints so the output reflects your product's actual identity, not a Claude default.

### 🎨 Brand Guidelines gate (6 questions)

Asked immediately before the Brand Guidelines skill runs.

| # | Question | Format |
|---|---|---|
| 1 | What world or mood should the brand feel like? | Pill select (max 2) |
| 2 | What aesthetics should be actively avoided? | Pill multi-select |
| 3 | What should the typography feel like? | Pill single-select |
| 4 | What colour quality should it have? | Pill single-select |
| 5 | How dense should the information feel? | Pill single-select |
| 6 | What app must this never be mistaken for? | Text (required) |

### 🗺️ Information Architecture gate (2 questions)

Asked immediately before the Information Architecture skill runs.

| # | Question | Format |
|---|---|---|
| 1 | What navigation pattern(s) suit this product? | Pill multi-select |
| 2 | Name an app whose navigation feels wrong for yours | Text (required) |

### 🚦 User Flow gate (2 questions)

Asked immediately before the User Flow skill runs. Q1 options are **dynamically generated** per project — the agent calls Claude with your brief and accumulated research context to suggest realistic, product-specific entry points rather than a generic static list.

| # | Question | Format |
|---|---|---|
| 1 | How does someone first arrive in this flow? | Dynamically generated pills, multi-select |
| 2 | Name an app whose flow-start feels wrong for yours | Text (required) |

All intake answers are saved to the right panel as editable cards (🎨 Brand Direction, 🗺️ Navigation Direction, 🚦 Flow Entry Direction). You can revise them at any point and the updated direction will be applied on the next run of that skill.

---

## Two ways to use it

| | Web Interface | CLI |
|---|---|---|
| **Best for** | Visual work, sharing with teammates | Power users, scripting, automation |
| **Location** | `web/` | repo root |
| **How to start** | `bash web/start.sh` then open browser | `python agent.py` |
| **Output** | Rendered markdown in browser + download buttons | Markdown files in `outputs/` |

---

## Prerequisites

- **Python 3.11+**
- An **Anthropic API key** — get one at [console.anthropic.com](https://console.anthropic.com)

---

## Quick Start — Web Interface (recommended)

```bash
# 1. Clone the repo
git clone https://github.com/YOUR_USERNAME/product-designer-agent.git
cd product-designer-agent

# 2. Install web dependencies
pip install -r web/requirements-web.txt

# 3. Start the server
bash web/start.sh          # Mac / Linux
web\start.bat              # Windows

# 4. Open http://localhost:8000 in your browser
```

The browser app walks you through:
1. **API key** — paste your `sk-ant-...` key (used only in your session, never stored)
2. **Project brief** — describe your product or paste a design brief
3. **Data choices** — tell the agent if you have interview transcripts / usability data, or whether to simulate them

Then click **Start Design Process** and the agent takes over.

---

## Quick Start — CLI

```bash
# 1. Clone the repo
git clone https://github.com/YOUR_USERNAME/product-designer-agent.git
cd product-designer-agent

# 2. Install CLI dependencies
pip install -r requirements.txt

# 3. Set your API key
cp .env.example .env
# Edit .env → ANTHROPIC_API_KEY=sk-ant-...

# 4. Run
python agent.py
```

The CLI will prompt you for your brief and data choices, then run the full workflow in your terminal with colour output.

---

## Project Structure

```
product-designer-agent/
│
├── agent.py              ← CLI entry point — run this
├── config.py             ← Agent identity, rules, skill sequence
├── workflow.py           ← Workflow state management
├── logbook.py            ← Self-learning logbook
├── human_loop.py         ← Terminal approval interface
├── qa_checker.py         ← Automated QA officer
├── skills_loader.py      ← Loads skill prompts from files
├── requirements.txt      ← CLI dependencies
│
├── skills/               ← One .md file per skill (the system prompts)
│   ├── research_plan.md
│   ├── ux_literature_review.md
│   ├── competitor_analysis.md
│   ├── ux_interview_guide.md
│   ├── simulated_interviewee.md
│   ├── uxr_synthesis.md
│   ├── ux_ideation.md
│   ├── prd_generator.md
│   ├── ux_user_flow.md
│   ├── ux_information_architecture.md
│   ├── ux_brand_guidelines.md
│   ├── ux_design_system.md
│   ├── ux_prototype_generator.md
│   ├── ux_usability_test_guide.md
│   └── simulated_usability_participant.md
│
├── web/                  ← Browser-based interface
│   ├── index.html        ← HTML shell (links style.css + app.js)
│   ├── style.css         ← All styles (design tokens, layout, animations)
│   ├── app.js            ← All JavaScript (state machine, streaming, UI, intake gates)
│   ├── server.py         ← FastAPI backend (serves static files, skill API, entry point suggestions)
│   ├── requirements-web.txt
│   ├── start.sh          ← Mac/Linux launcher
│   └── start.bat         ← Windows launcher
│
├── outputs/              ← Generated per session (gitignored)
│   └── project_YYYYMMDD_HHMMSS/
│       ├── research_plan.md
│       ├── ux_literature_review.md
│       ├── ... (one file per completed skill)
│       ├── logbook.md
│       └── logbook.json
│
├── LEARNINGS.md          ← Agent's cumulative session learnings
├── .env.example
└── .gitignore
```

---

## Skills Reference

| Skill | File | Intake gate | What it produces |
|---|---|---|---|
| Project Plan | `skills/research_plan.md` | — | Structured research plan + ordered to-do list |
| Literature Review | `skills/ux_literature_review.md` | — | Cited evidence review with design implications |
| Competitor Analysis | `skills/competitor_analysis.md` | — | Competitive landscape, UX benchmarks, opportunities |
| Interview Guide | `skills/ux_interview_guide.md` | — | Moderator-ready discussion guide with probes |
| Simulated Interviewee | `skills/simulated_interviewee.md` | — | Realistic virtual user persona + transcript |
| UXR Synthesis | `skills/uxr_synthesis.md` | — | Affinity map, insights, opportunity areas, personas |
| Design Ideation | `skills/ux_ideation.md` | — | HMW reframes, concept directions, design principles |
| PRD | `skills/prd_generator.md` | — | MoSCoW requirements with acceptance criteria |
| User Flow | `skills/ux_user_flow.md` | 🚦 Entry point gate | Step-by-step flows + Mermaid diagram, rendered in-browser |
| Information Architecture | `skills/ux_information_architecture.md` | 🗺️ Navigation gate | Screen hierarchy, content inventory, nav patterns |
| Brand Guidelines | `skills/ux_brand_guidelines.md` | 🎨 Brand gate | Full brand identity: colours, type, voice, motion |
| Design System | `skills/ux_design_system.md` | — | Design tokens + component library specification |
| Interactive Prototype | `skills/ux_prototype_generator.md` | — | Self-contained accessible HTML prototype, rendered in-browser |
| Usability Test Guide | `skills/ux_usability_test_guide.md` | — | Task scenarios, SUS, observation framework |
| Simulated Usability Testing | `skills/simulated_usability_participant.md` | — | Virtual participant think-aloud session |

---

## How the QA and approval loop works

After every skill the agent runs an automated QA check and handles the result autonomously:

| QA result | What happens |
|---|---|
| **PASS** | Auto-approved. Agent logs the result and moves to the next skill immediately — no human input needed. |
| **NEEDS IMPROVEMENT** | Agent extracts the QA recommendations and uses them as revision feedback, re-runs the skill, re-checks QA. Repeats automatically up to 2 times. |
| **Still not passing after 2 attempts** | Escalates to you — shows the output and QA findings and asks for your input. |
| **FAIL** | Escalates to you immediately — a fundamental issue requires human judgment. |

You can also manually request a revision on any deliverable at any time from the sidebar, even after it has been auto-approved.

---

## How the self-learning logbook works

After each skill completes, the agent:
- Generates a 2-sentence reflection: what worked, and one rule to adopt
- Logs it with a timestamp

At the end of the session the agent:
- Compiles all log entries into a structured logbook (performance per skill, user feedback patterns, improvement areas, recommended rule updates)
- Presents it to you for approval
- On approval, appends the session learnings to `LEARNINGS.md`

Over multiple sessions, `LEARNINGS.md` becomes the agent's institutional memory.

---

## Customising skills

Each skill is a plain Markdown file in `skills/`. The file content becomes the Claude system prompt for that skill. To change how a skill behaves, just edit the file.

**To add a new skill:**

1. Create `skills/my_new_skill.md` with a detailed system prompt
2. Add the skill name to `SKILL_SEQUENCE` in `config.py`
3. Add a display name to `SKILL_DISPLAY_NAMES` in `config.py`

**To add an intake gate for an existing skill:**

The intake gate pattern lives entirely in `web/app.js` and `web/index.html`. Each gate is three things:
- A modal overlay with pill-button and/or text-input questions
- A gate block in `executeSkillAndApprove()` that awaits the modal before the skill runs
- A right-panel card that displays the saved answers and lets the user re-edit them

See the `showBrandIntake()`, `showIAIntake()`, and `showUserFlowIntake()` functions for working examples to copy from.

---

## Configuration

| Variable | Default | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | **Required.** Your Anthropic API key. |
| `CLAUDE_MODEL` | `claude-sonnet-4-5-20250929` | Override the Claude model. |

---

## Data & privacy

- Your API key is used only to call the Anthropic API and is never logged or stored beyond your session
- In the web interface, the key is held in browser memory only — it is never written to disk
- All generated outputs are saved locally in the `outputs/` folder on your own machine

---

## Contributing

Contributions welcome. The highest-impact areas:

- **Improving skill prompts** in `skills/` — better instructions → better outputs
- **Adding intake gates** for more skills (e.g. ideation direction, prototype tone)
- **Adding new skills** (e.g. content strategy, accessibility audit, motion design spec)
- **Adding a session resume** feature (pick up from a checkpoint)
- **Figma MCP integration** to write design system tokens live into Figma

---

## Licence

MIT — free to use, modify, and distribute.
