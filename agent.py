#!/usr/bin/env python3
"""
🎨 Product Designer Agent
─────────────────────────────────────────────────────────────────────────────
An AI orchestrator that runs the complete UX design lifecycle end-to-end.

Workflow
  1. Receives problem statement / design brief from user
  2. Asks whether interview and usability data exist (or should be simulated)
  3. Executes the UX Research Plan skill to produce an ordered to-do list
  4. Works through the to-do list, calling the right skill at each step
  5. After every skill: runs QA → shows output → gets human approval
  6. If not approved: collects feedback, revises, and re-evaluates
  7. Passes approved output as context to the next skill
  8. Maintains a live logbook of learnings throughout
  9. At the end: presents the logbook → user approves → agent updates its rules

Usage
  python agent.py
─────────────────────────────────────────────────────────────────────────────
"""

import json
import sys
import os
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional

import anthropic
from rich.console import Console
from rich.markdown import Markdown
from rich.panel import Panel
from rich.progress import Progress, SpinnerColumn, TextColumn
from rich.prompt import Confirm
from rich.table import Table

from config import AgentConfig, SKILL_DISPLAY_NAMES, SKILL_SEQUENCE
from workflow import WorkflowManager, SkillStatus
from logbook import Logbook
from human_loop import HumanLoop
from qa_checker import QAChecker
from skills_loader import SkillsLoader


# ─────────────────────────────────────────────────────────────────────────────
# Agent
# ─────────────────────────────────────────────────────────────────────────────

class ProductDesignerAgent:
    """End-to-end Product Designer Agent."""

    BANNER = """[bold blue]
╔══════════════════════════════════════════════════════════════╗
║          🎨  Product Designer Agent  v1.0                    ║
║  Research → Synthesis → Ideation → PRD → Design → Prototype ║
╚══════════════════════════════════════════════════════════════╝
[/bold blue]"""

    def __init__(self):
        self.config       = AgentConfig()
        self.client       = anthropic.Anthropic(api_key=self.config.api_key)
        self.console      = Console()
        self.workflow     = WorkflowManager()
        self.logbook      = Logbook()
        self.hl           = HumanLoop(self.console)
        self.qa           = QAChecker(self.client, self.config)
        self.skills       = SkillsLoader(self.config.skills_dir)
        self.context: Dict[str, Any] = {}
        self.project_dir: Optional[Path] = None

    # ─── Entry point ─────────────────────────────────────────────────────────

    def run(self):
        try:
            self._initialize()
            self._gather_project_info()
            self._execute_workflow()
            self._finalize()
        except KeyboardInterrupt:
            self.console.print("\n\n[yellow]Interrupted — saving state…[/yellow]")
            self._save_state()
            sys.exit(0)
        except Exception as exc:
            self.console.print(f"\n[bold red]Fatal error: {exc}[/bold red]")
            self.logbook.add_entry("FATAL_ERROR", str(exc))
            self._save_state()
            raise

    # ─── Initialization ───────────────────────────────────────────────────────

    def _initialize(self):
        self.console.print(self.BANNER)

        stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        self.project_dir = self.config.outputs_dir / f"project_{stamp}"
        self.project_dir.mkdir(parents=True, exist_ok=True)
        (self.project_dir / ".gitkeep").touch()

        self.logbook.initialize(self.project_dir)
        self.console.print(f"[dim]Project outputs → {self.project_dir}[/dim]\n")

    # ─── Project info gathering ───────────────────────────────────────────────

    def _gather_project_info(self):
        self.hl.section("Step 1 — Project Brief")

        brief = self.hl.get_multiline_input(
            "Describe your product problem or paste your design brief"
        )
        if not brief:
            self.hl.error("A project brief is required. Please re-run and provide one.")
            sys.exit(1)

        self.context["brief"] = brief
        self.logbook.add_entry("BRIEF", "Project brief received", {"brief": brief[:300]})

        # ── Interview data ────────────────────────────────────────────────────
        self.hl.section("Step 2 — Interview Data")
        has_interviews = self.hl.confirm("Do you already have user interview transcripts or notes?", default=False)

        if has_interviews:
            data = self.hl.get_multiline_input("Paste your interview transcripts or notes")
            self.context["interview_data"] = data
            self.context["use_simulated_interviews"] = False
            self.logbook.add_entry("DATA", "Interview data provided by user")
            self.hl.success("Interview data received.")
        else:
            simulate = self.hl.confirm(
                "Would you like the agent to simulate user interviews with a virtual participant?",
                default=True,
            )
            self.context["use_simulated_interviews"] = simulate
            if not simulate:
                self.hl.warning("UXR Synthesis will be limited without interview data.")
                self.logbook.add_entry("DATA", "No interview data; simulation declined — synthesis will be limited.")
            else:
                self.logbook.add_entry("DATA", "No interview data; will simulate with sub-agent.")

        # ── Usability data ────────────────────────────────────────────────────
        self.hl.section("Step 3 — Usability Testing Data")
        has_usability = self.hl.confirm("Do you already have usability testing data or session notes?", default=False)

        if has_usability:
            data = self.hl.get_multiline_input("Paste your usability testing notes")
            self.context["usability_data"] = data
            self.context["use_simulated_usability"] = False
            self.logbook.add_entry("DATA", "Usability data provided by user")
            self.hl.success("Usability data received.")
        else:
            simulate = self.hl.confirm(
                "Would you like the agent to simulate usability testing with a virtual participant?",
                default=True,
            )
            self.context["use_simulated_usability"] = simulate
            if not simulate:
                self.hl.warning("Usability step will use only the test guide (no simulated sessions).")
                self.logbook.add_entry("DATA", "No usability data; simulation declined.")
            else:
                self.logbook.add_entry("DATA", "No usability data; will simulate with sub-agent.")

    # ─── Workflow execution ───────────────────────────────────────────────────

    def _execute_workflow(self):
        # ── Phase 1: Research Plan ────────────────────────────────────────────
        self.hl.section("Phase 1 — UX Research Plan")
        self._run_skill("research_plan")

        # ── Explicit checkpoint: user must confirm before workflow begins ─────
        self.hl.section("Project Plan Approved — Ready to Execute")
        self.console.print(
            "[dim]The research plan above has been finalised.\n"
            "The agent will now parse it into a step-by-step workflow and begin\n"
            "executing each deliverable in sequence — one at a time, with your\n"
            "approval at every step.[/dim]\n"
        )
        if not self.hl.confirm(
            "▶  Proceed and begin the full workflow execution?", default=False
        ):
            self.console.print(
                "[yellow]Workflow execution cancelled. "
                "Restart the agent to begin with a new or updated brief.[/yellow]"
            )
            return

        # ── Parse to-do list from research plan ───────────────────────────────
        todo = self._parse_todo_list(self.context.get("research_plan", ""))
        self.context["todo_list"] = todo
        self.workflow.set_todo_list(todo, SKILL_DISPLAY_NAMES)

        self._display_workflow_plan(todo)

        if not self.hl.confirm("\nProceed with this workflow plan?", default=True):
            mods = self.hl.get_multiline_input("Describe any changes to the plan")
            self.context["workflow_modifications"] = mods
            self.logbook.add_entry("PLAN_MODIFIED", "User modified the workflow plan", {"modifications": mods})
            # Re-parse with modifications
            todo = self._parse_todo_list(
                self.context.get("research_plan", "") + "\n\nUser modifications:\n" + mods
            )
            self.context["todo_list"] = todo
            self.workflow.set_todo_list(todo, SKILL_DISPLAY_NAMES)

        # ── Phase 2: Execute remaining skills ────────────────────────────────
        for skill_name in todo:
            if skill_name == "research_plan":
                continue  # already done

            # Skip logic based on user's data choices
            if skill_name == "ux_interview_guide" and self.context.get("interview_data"):
                self.workflow.skip_skill(skill_name, "User provided interview data")
                self.logbook.log_skill_skip(skill_name, "User provided interview data")
                continue

            if skill_name == "simulated_interviewee":
                if not self.context.get("use_simulated_interviews"):
                    self.workflow.skip_skill(skill_name, "Simulation declined by user")
                    self.logbook.log_skill_skip(skill_name, "Simulation declined by user")
                    continue

            if skill_name == "simulated_usability_participant":
                if not self.context.get("use_simulated_usability"):
                    self.workflow.skip_skill(skill_name, "Simulation declined by user")
                    self.logbook.log_skill_skip(skill_name, "Simulation declined by user")
                    continue

            display = SKILL_DISPLAY_NAMES.get(skill_name, skill_name)
            self.hl.section(f"Running — {display}")
            self._run_skill(skill_name)

    # ─── Single skill execution ───────────────────────────────────────────────

    def _run_skill(self, skill_name: str, max_qa_rounds: int = 2):
        """Execute one skill: call Claude → QA → display → human approval loop.

        Each step is limited to ``max_qa_rounds`` QA iterations.  If the user
        has not approved after the final round the best output is accepted
        automatically so the pipeline can keep moving.
        """
        display = SKILL_DISPLAY_NAMES.get(skill_name, skill_name)
        self.workflow.start_skill(skill_name)
        self.logbook.log_skill_start(skill_name)

        iteration  = 0
        feedback   = None
        qa_result  = {}   # carries last QA result into next revision call

        while True:
            iteration += 1
            output = self._call_skill(skill_name, feedback=feedback, qa_result=qa_result)

            # Save to file
            out_file = self.project_dir / f"{skill_name}.md"
            out_file.write_text(output, encoding="utf-8")
            self.hl.info(f"Output saved → {out_file.name}")

            # Run QA only within the allowed round limit
            if iteration <= max_qa_rounds:
                self.console.print(
                    f"\n[bold yellow]🔍 Running QA on {display}"
                    f" (round {iteration}/{max_qa_rounds})…[/bold yellow]"
                )
                qa_result = self.qa.check(skill_name, output, self.context)
                self.logbook.log_qa_result(
                    skill_name,
                    qa_result.get("score", "?"),
                    qa_result.get("issues", []),
                    qa_result.get("recommendations", []),
                )
                self._display_qa_result(qa_result, display)
            else:
                # QA rounds exhausted — skip automated check, go straight to human review
                self.console.print(
                    f"\n[dim]⚡  QA limit reached — skipping automated check.\n"
                    f"    Please review the output below and approve when ready.[/dim]\n"
                )

            # Display output
            self.hl.display_output(display, output)

            # Let the user know they can manually edit the file before approving
            self.console.print(
                f"\n[dim]📝  You can manually edit the saved file before approving:\n"
                f"    {out_file}\n"
                f"    Any edits you save will be picked up automatically.[/dim]\n"
            )

            # If QA passed, use a fast-path confirmation instead of the full gate
            qa_passed = qa_result.get("score") == "PASS"
            if qa_passed:
                self.console.print(
                    f"\n[bold green]✅  QA passed[/bold green] — {qa_result.get('summary', '')}"
                )
                approved = self.hl.confirm(
                    f"Proceed to the next step?", default=True
                )
                user_feedback = ""
                if not approved:
                    user_feedback = self.hl.get_multiline_input(
                        "What would you like changed?"
                    )
            else:
                # Full approval gate for non-passing QA
                approved, user_feedback = self.hl.approval_gate(display)

            if user_feedback:
                self.logbook.log_user_feedback(skill_name, user_feedback)

            if approved:
                # Re-read from disk so any manual edits the user made are captured
                try:
                    output = out_file.read_text(encoding="utf-8")
                except Exception:
                    pass  # fall back to in-memory output if read fails
                self.context[skill_name] = output
                self.workflow.complete_skill(skill_name, qa_result.get("score"), approved=True)
                self.logbook.log_skill_complete(
                    skill_name,
                    qa_result.get("score", "?"),
                    True,
                    iteration,
                    output[:400],
                )

                # Log a learning after every successful skill
                self._reflect_and_log(skill_name, qa_result, iteration, user_feedback)
                self.hl.success(f"{display} approved — moving to the next step.")
                break
            else:
                self.logbook.log_iteration(skill_name, user_feedback)
                self.workflow.increment_iteration(skill_name)
                feedback = user_feedback

                if iteration >= max_qa_rounds:
                    # Round limit reached — do NOT regenerate again.
                    # Present the current output and wait until the user approves.
                    self.console.print(
                        f"\n[bold yellow]⚡  Revision limit reached ({max_qa_rounds}/{max_qa_rounds}).[/bold yellow]\n"
                        f"[dim]No further regeneration. Review the output below,\n"
                        f"edit the file if needed, then approve to continue.[/dim]\n"
                    )
                    while True:
                        self.hl.display_output(display, output)
                        self.console.print(
                            f"\n[dim]📝  You can manually edit the saved file before approving:\n"
                            f"    {out_file}\n"
                            f"    Any edits you save will be picked up automatically.[/dim]\n"
                        )
                        approved, user_feedback = self.hl.approval_gate(display)
                        if user_feedback:
                            self.logbook.log_user_feedback(skill_name, user_feedback)
                        if approved:
                            try:
                                output = out_file.read_text(encoding="utf-8")
                            except Exception:
                                pass
                            self.context[skill_name] = output
                            self.workflow.complete_skill(skill_name, qa_result.get("score"), approved=True)
                            self.logbook.log_skill_complete(
                                skill_name,
                                qa_result.get("score", "?"),
                                True,
                                iteration,
                                output[:400],
                            )
                            self._reflect_and_log(skill_name, qa_result, iteration, user_feedback)
                            self.hl.success(f"{display} approved — moving to the next step.")
                            return  # exit _run_skill entirely

                # Make it explicit: ONLY this step is being revised.
                # Previously approved steps are untouched; execution will
                # resume from the step AFTER this one once it is approved.
                self.console.print(
                    f"\n[bold yellow]↩  Revising [white]{display}[/white] only.[/bold yellow]\n"
                    f"[dim]All previously approved steps are preserved.\n"
                    f"Once this step is approved, the workflow will continue\n"
                    f"from the next step with the updated output.[/dim]\n"
                )

    # ─── Claude call ─────────────────────────────────────────────────────────

    def _call_skill(
        self,
        skill_name: str,
        feedback: str = None,
        qa_result: dict = None,
    ) -> str:
        """Call Claude with the skill system prompt + accumulated context.

        When ``qa_result`` is provided (revision round ≥ 2), the QA issues and
        recommendations from the *previous* round are injected into the prompt
        so Claude knows exactly what to fix — not just what the user typed.
        """
        system_prompt = self.skills.load(skill_name)
        if not system_prompt:
            return f"[Skill '{skill_name}' not found in the skills directory — please add {skill_name}.md]"

        context_str = self._build_context_str(skill_name)
        display     = SKILL_DISPLAY_NAMES.get(skill_name, skill_name)

        user_msg = (
            f"## Project Brief\n{self.context.get('brief', '')}\n\n"
            f"## Accumulated Context from Previous Steps\n{context_str}\n\n"
        )
        if self.context.get("interview_data"):
            user_msg += f"## User-Provided Interview Data\n{self.context['interview_data'][:3000]}\n\n"
        if self.context.get("usability_data"):
            user_msg += f"## User-Provided Usability Data\n{self.context['usability_data'][:3000]}\n\n"

        # Inject QA issues + recommendations so Claude knows exactly what to fix
        if qa_result:
            issues  = qa_result.get("issues", [])
            recs    = qa_result.get("recommendations", [])
            qa_note = qa_result.get("summary", "")
            if issues or recs:
                user_msg += "## QA Issues to Address in This Revision\n"
                if qa_note:
                    user_msg += f"QA summary: {qa_note}\n\n"
                if issues:
                    user_msg += "Issues flagged:\n"
                    for iss in issues:
                        user_msg += f"- {iss}\n"
                if recs:
                    user_msg += "\nRecommendations:\n"
                    for rec in recs:
                        user_msg += f"- {rec}\n"
                user_msg += "\n"

        if feedback:
            user_msg += f"## Revision Feedback from User\n{feedback}\n\n"

        user_msg += f"Please now execute the **{display}** deliverable based on all the above."

        with Progress(
            SpinnerColumn(),
            TextColumn(f"[blue]Executing {display}…[/blue]"),
            console=self.console,
            transient=True,
        ) as progress:
            progress.add_task("running", total=None)
            response = self.client.messages.create(
                model=self.config.model,
                max_tokens=self.config.max_tokens,
                system=system_prompt,
                messages=[{"role": "user", "content": user_msg}],
            )

        return response.content[0].text.strip()

    # ─── Helpers ─────────────────────────────────────────────────────────────

    def _build_context_str(self, current_skill: str) -> str:
        parts = []
        for skill in SKILL_SEQUENCE:
            if skill == current_skill:
                break
            val = self.context.get(skill)
            if isinstance(val, str) and val:
                display = SKILL_DISPLAY_NAMES.get(skill, skill)
                snippet = val[:1500] + ("…" if len(val) > 1500 else "")
                parts.append(f"### {display}\n{snippet}")
        return "\n\n".join(parts) if parts else "No previous outputs yet."

    def _parse_todo_list(self, research_plan_text: str) -> List[str]:
        """Ask Claude to extract the ordered skill list from the research plan."""
        valid_skills = json.dumps(SKILL_SEQUENCE)
        response = self.client.messages.create(
            model=self.config.model,
            max_tokens=512,
            system=(
                "You extract an ordered list of UX skill names from a research plan. "
                f"Return ONLY a JSON array of skill names chosen from: {valid_skills}. "
                "No explanation, no markdown — just the JSON array."
            ),
            messages=[{
                "role": "user",
                "content": f"Extract the skill execution order from this research plan:\n\n{research_plan_text[:3000]}",
            }],
        )
        raw = response.content[0].text.strip()
        # Strip markdown fences
        import re
        raw = re.sub(r"```(?:json)?", "", raw).replace("```", "").strip()
        try:
            parsed = json.loads(raw)
            # Validate each entry is in SKILL_SEQUENCE
            valid = [s for s in parsed if s in SKILL_SEQUENCE]
            # Always include research_plan at the start if not present
            if "research_plan" not in valid:
                valid.insert(0, "research_plan")
            return valid if valid else SKILL_SEQUENCE
        except (json.JSONDecodeError, TypeError):
            return SKILL_SEQUENCE

    def _display_workflow_plan(self, todo: List[str]):
        table = Table(title="📋 Planned Workflow", border_style="blue", show_lines=True)
        table.add_column("#",       style="cyan",  width=4)
        table.add_column("Skill",   style="white", min_width=35)
        table.add_column("Status",  style="dim",   width=14)
        for i, skill in enumerate(todo, 1):
            name = SKILL_DISPLAY_NAMES.get(skill, skill)
            table.add_row(str(i), name, "⏳ Pending")
        self.console.print(table)

    def _display_qa_result(self, qa: dict, display_name: str):
        score = qa.get("score", "?")
        color = QAChecker.score_color(score)
        emoji = QAChecker.score_emoji(score)
        issues = qa.get("issues", [])
        recs   = qa.get("recommendations", [])
        a11y   = qa.get("accessibility_note", "")
        align  = qa.get("brief_alignment", "")
        summ   = qa.get("summary", "")

        lines = [f"{emoji} [bold {color}]{score}[/bold {color}]  — {summ}"]
        if align:
            lines.append(f"Brief alignment: [italic]{align}[/italic]")
        if a11y:
            lines.append(f"Accessibility: [italic]{a11y}[/italic]")
        if issues:
            lines.append("\n[red]Issues:[/red]")
            for iss in issues[:5]:
                lines.append(f"  • {iss}")
        if recs:
            lines.append("\n[yellow]Recommendations:[/yellow]")
            for rec in recs[:5]:
                lines.append(f"  • {rec}")

        self.console.print(Panel(
            "\n".join(lines),
            title=f"QA — {display_name}",
            border_style=color,
        ))

    def _reflect_and_log(self, skill_name: str, qa: dict, iterations: int, feedback: str):
        """Generate a brief self-reflection after each skill and log it."""
        reflection_prompt = (
            f"Skill just completed: {skill_name}\n"
            f"QA score: {qa.get('score')}\n"
            f"QA issues: {qa.get('issues', [])}\n"
            f"Number of iterations needed: {iterations}\n"
            f"User feedback: {feedback or 'None'}\n\n"
            "In 1-3 sentences, describe: what went well, what the agent could improve, "
            "and one specific rule the agent should remember for future sessions."
        )
        try:
            resp = self.client.messages.create(
                model=self.config.model,
                max_tokens=256,
                system="You are the agent's internal self-improvement module. Be concise, specific, and honest.",
                messages=[{"role": "user", "content": reflection_prompt}],
            )
            learning = resp.content[0].text.strip()
            self.logbook.log_learning(learning, category=skill_name.upper())
        except Exception:
            pass  # Non-critical

    # ─── Finalization ─────────────────────────────────────────────────────────

    def _finalize(self):
        self.hl.section("🎉 Project Complete — Agent Logbook & Learnings")

        summary_md = self._generate_logbook_summary()
        logbook_path = self.logbook.save_markdown(summary_md)
        self.console.print(Markdown(summary_md))

        if logbook_path:
            self.hl.info(f"Full logbook saved → {logbook_path.name}")

        # Workflow summary table
        table = Table(title="Final Workflow Summary", border_style="green", show_lines=True)
        table.add_column("#",          style="cyan",  width=4)
        table.add_column("Skill",      style="white", min_width=35)
        table.add_column("Status",     style="green", width=16)
        table.add_column("QA",         style="yellow",width=10)
        table.add_column("Approved",   style="green", width=10)
        table.add_column("Iterations", style="dim",   width=12)
        for row in self.workflow.get_table_rows():
            table.add_row(*row)
        self.console.print(table)

        # User approval of learnings + self-update
        if self.hl.confirm(
            "\n✅ Approve these learnings and update the agent's rules for future sessions?",
            default=True,
        ):
            self._update_learnings_file(summary_md)
            self.hl.success("Agent learnings saved to LEARNINGS.md — agent rules updated.")

        self.console.print(
            f"\n[bold green]All outputs saved to:[/bold green] {self.project_dir}"
        )

    def _generate_logbook_summary(self) -> str:
        entries_json = json.dumps(self.logbook.get_all_entries(), indent=2)
        prompt = (
            "You are the agent's self-reflection module. "
            "Produce a comprehensive logbook summary in Markdown."
        )
        user_msg = f"""Based on these session log entries, write a detailed agent logbook with these sections:

## 1. Executive Summary
What was accomplished this session?

## 2. Skill-by-Skill Performance
For each skill that ran: what worked, what issues arose, how many iterations were needed.

## 3. User Interactions & Feedback
What did the user approve, modify, or push back on? What does this reveal?

## 4. Key Learnings
Numbered list of specific things the agent learned about itself this session.

## 5. Improvement Areas
Where is the agent weakest? What concrete changes would make it better?

## 6. Most Important Insight
One paragraph — the single biggest takeaway from this session.

## 7. Recommended Rule Updates
Specific new rules the agent should adopt, written as imperative statements.

Log entries:
{entries_json[:8000]}
"""
        resp = self.client.messages.create(
            model=self.config.model,
            max_tokens=4096,
            system=prompt,
            messages=[{"role": "user", "content": user_msg}],
        )
        return resp.content[0].text.strip()

    def _update_learnings_file(self, summary: str):
        learnings_file = Path(__file__).parent / "LEARNINGS.md"
        existing = learnings_file.read_text(encoding="utf-8") if learnings_file.exists() else "# Agent Learnings\n\n"
        stamp = datetime.now().strftime("%Y-%m-%d %H:%M")
        learnings_file.write_text(
            existing + f"\n---\n## Session: {stamp}\n\n{summary}\n",
            encoding="utf-8",
        )

    def _save_state(self):
        if self.project_dir:
            state = {
                "context_keys": list(self.context.keys()),
                "workflow":     self.workflow.get_state(),
                "timestamp":    datetime.now().isoformat(),
            }
            (self.project_dir / "state.json").write_text(json.dumps(state, indent=2))


# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    agent = ProductDesignerAgent()
    agent.run()
