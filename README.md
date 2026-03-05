# 🎨 Product Designer Agent

> An AI agent that orchestrates the **complete UX design lifecycle** — from a raw problem statement to a validated, interactive prototype.

Built on the [Anthropic Python SDK](https://github.com/anthropics/anthropic-sdk-python) and powered by Claude.

---

## What it does

The agent takes a product brief and autonomously runs every stage of the UX design process, one skill at a time. After each step it runs an automated QA check, presents the output to you for review, and waits for your explicit approval before continuing. At the end of every session it writes a self-assessment logbook and updates its own rules based on what it learned.

```
Problem Brief
     ↓
 Project Plan  (generates the ordered to-do list)
     ↓
 Literature Review  →  Competitor Analysis
     ↓
 Interview Guide  →  Simulated Interviews  (or use your own data)
     ↓
 UXR Synthesis & Affinity Map
     ↓
 Design Ideation  →  PRD  →  User Flow  →  Information Architecture
     ↓
 Brand Guidelines  →  Design System
     ↓
 Interactive HTML Prototype
     ↓
 Usability Test Guide  →  Simulated Usability Testing  (or use your own data)
     ↓
 Agent Logbook & Self-Update
```

**At every step the agent:**
- Runs the skill and streams the output to you live
- Executes an automated QA check (completeness · UX principles · WCAG · brief alignment)
- Waits for your explicit approval before moving on
- If you request a revision: collects your feedback, re-runs, re-checks QA, asks again
- Logs a self-reflection learning entry

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
│   ├── app.js            ← All JavaScript (state machine, streaming, UI)
│   ├── server.py         ← FastAPI backend (serves static files + API)
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

| Skill | File | What it produces |
|---|---|---|
| Project Plan | `skills/research_plan.md` | Structured research plan + ordered to-do list |
| Literature Review | `skills/ux_literature_review.md` | Cited evidence review with design implications |
| Competitor Analysis | `skills/competitor_analysis.md` | Competitive landscape, UX benchmarks, opportunities |
| Interview Guide | `skills/ux_interview_guide.md` | Moderator-ready discussion guide with probes |
| Simulated Interviewee | `skills/simulated_interviewee.md` | Realistic virtual user persona + transcript |
| UXR Synthesis | `skills/uxr_synthesis.md` | Affinity map, insights, opportunity areas, personas |
| Design Ideation | `skills/ux_ideation.md` | HMW reframes, concept directions, design principles |
| PRD | `skills/prd_generator.md` | MoSCoW requirements with acceptance criteria |
| User Flow | `skills/ux_user_flow.md` | Step-by-step flows + Mermaid diagrams |
| Information Architecture | `skills/ux_information_architecture.md` | Screen hierarchy, content inventory, nav patterns |
| Brand Guidelines | `skills/ux_brand_guidelines.md` | Full brand identity: colours, type, voice, motion |
| Design System | `skills/ux_design_system.md` | Design tokens + component library specification |
| Interactive Prototype | `skills/ux_prototype_generator.md` | Self-contained accessible HTML prototype |
| Usability Test Guide | `skills/ux_usability_test_guide.md` | Task scenarios, SUS, observation framework |
| Simulated Usability Testing | `skills/simulated_usability_participant.md` | Virtual participant think-aloud session |

---

## How the human approval loop works

After every skill the agent:

1. Shows the full output (rendered markdown in the browser, or printed to terminal in CLI)
2. Shows the QA assessment — score (PASS / NEEDS IMPROVEMENT / FAIL), issues, recommendations
3. Asks: *"Do you have any suggestions or improvements?"* — you can add notes even when approving
4. Asks: *"Approve and continue?"*
   - **Approve** → saves the output as context for the next skill, moves on
   - **Request revision** → you provide feedback, the agent re-runs the skill with your notes, re-checks QA, asks again

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
- **Adding new skills** (e.g. content strategy, accessibility audit, motion design spec)
- **Adding a session resume** feature (pick up from a checkpoint)
- **Figma MCP integration** to write design system tokens live into Figma

---

## Licence

MIT — free to use, modify, and distribute.
