"""
qa_checker.py — QA Officer
Runs automated quality assurance checks on every skill output before human review.
"""

import json
import re
from typing import Dict, Any, List

import anthropic
from config import AgentConfig


QA_SYSTEM_PROMPT = """
You are a senior UX QA Officer with 15+ years of experience reviewing design artefacts.
Your job is to evaluate each UX deliverable fairly and constructively before it advances
to the next stage. Your goal is to surface real, actionable problems — not to penalise
outputs for things that are intentionally out of scope or that will be addressed by a
later step in the pipeline.

IMPORTANT CALIBRATION RULES — read these before evaluating:

• SCOPE-RELATIVE COMPLETENESS: Judge completeness ONLY against what this specific skill
  is supposed to deliver at this stage of the project. Do NOT flag missing elements that
  belong to a different skill or a later pipeline step (e.g., do not flag "no wireframes"
  in a research plan, or "no personas" in an ideation document).

• NO OUT-OF-SCOPE FLAGS: If something is missing but it is clearly outside the remit of
  this skill, do not list it as an issue. Silence on out-of-scope items is correct QA.

• PASS THRESHOLD: Award PASS whenever the output adequately covers its intended scope,
  is coherent, is grounded in the brief, and gives the next step enough to work from.
  Do not reserve PASS only for "perfect" outputs — good enough to proceed is a PASS.

• NEEDS_IMPROVEMENT: Use this only when there are specific, fixable gaps that genuinely
  block the next step or misrepresent the brief, and those gaps are within scope.

• FAIL: Reserve for outputs that are fundamentally off-brief, incoherent, or so
  incomplete that the next step cannot proceed at all.

For each artefact, evaluate against these dimensions (scope-relative):

1. COMPLETENESS — Does it cover everything this skill is scoped to deliver? (Not more.)
2. UX PRINCIPLES — Does it follow established UX research and design best practices?
3. WCAG ACCESSIBILITY — Are accessibility considerations present where relevant to scope?
4. BRIEF ALIGNMENT — Does it address the original project brief and user problem?
5. CROSS-ARTEFACT INTEGRITY — Is it consistent with the outputs of previous stages?
6. QUALITY & PROFESSIONALISM — Is the content substantive, coherent, and non-generic?
7. ACTIONABILITY — Can the next stage proceed using this output?

Return ONLY a valid JSON object (no markdown fences) with this exact schema:
{
  "score": "PASS" | "NEEDS_IMPROVEMENT" | "FAIL",
  "issues": ["specific in-scope issue 1", "specific in-scope issue 2"],
  "recommendations": ["specific fix 1", "specific fix 2"],
  "issues_count": <integer>,
  "accessibility_note": "one sentence on accessibility status (or 'Not applicable at this stage')",
  "brief_alignment": "ALIGNED" | "PARTIALLY_ALIGNED" | "MISALIGNED",
  "summary": "one sentence overall verdict"
}

When in doubt between PASS and NEEDS_IMPROVEMENT, choose PASS if the output is coherent
and moves the project forward. Be fair, specific, and constructive.
"""


class QAChecker:
    """Invokes Claude as a QA Officer to evaluate skill outputs."""

    def __init__(self, client: anthropic.Anthropic, config: AgentConfig):
        self.client = client
        self.config = config

    def check(
        self,
        skill_name: str,
        output: str,
        context: Dict[str, Any],
    ) -> Dict:
        """
        Synchronously run a QA check on a skill output.
        Returns a structured QA result dict.
        """
        brief        = context.get("brief", "")[:600]
        prev_outputs = self._build_previous_outputs_summary(skill_name, context)

        user_message = f"""
Skill being evaluated: {skill_name}

Project Brief (excerpt):
{brief}

Previous artefacts summary (for cross-artefact consistency check):
{prev_outputs}

Output to evaluate:
{output[:5000]}

Evaluate this output strictly and return only the JSON QA result.
""".strip()

        try:
            response = self.client.messages.create(
                model=self.config.model,
                max_tokens=1024,
                system=QA_SYSTEM_PROMPT,
                messages=[{"role": "user", "content": user_message}],
            )
            raw = response.content[0].text.strip()
            return self._parse_json(raw)

        except Exception as e:
            return {
                "score":              "NEEDS_IMPROVEMENT",
                "issues":             [f"Automated QA encountered an error: {str(e)}"],
                "recommendations":    ["Please review this output manually."],
                "issues_count":       1,
                "accessibility_note": "Could not assess automatically.",
                "brief_alignment":    "UNKNOWN",
                "summary":            "QA could not be completed automatically.",
            }

    # ── Private helpers ───────────────────────────────────────────────────────

    def _build_previous_outputs_summary(
        self, current_skill: str, context: Dict[str, Any]
    ) -> str:
        from config import SKILL_SEQUENCE, SKILL_DISPLAY_NAMES
        parts = []
        for skill in SKILL_SEQUENCE:
            if skill == current_skill:
                break
            if skill in context and isinstance(context[skill], str):
                snippet = context[skill][:300].replace("\n", " ")
                parts.append(f"• {SKILL_DISPLAY_NAMES.get(skill, skill)}: {snippet}…")
        return "\n".join(parts) if parts else "No previous artefacts yet."

    def _parse_json(self, raw: str) -> Dict:
        # Strip markdown fences if present
        clean = re.sub(r"```(?:json)?", "", raw).replace("```", "").strip()
        try:
            return json.loads(clean)
        except json.JSONDecodeError:
            # Fallback: return a safe default
            return {
                "score":              "NEEDS_IMPROVEMENT",
                "issues":             ["QA response was not valid JSON — manual review recommended."],
                "recommendations":    ["Re-run QA or review the output manually."],
                "issues_count":       1,
                "accessibility_note": "Could not assess.",
                "brief_alignment":    "UNKNOWN",
                "summary":            "Automated QA parse error.",
            }

    @staticmethod
    def score_color(score: str) -> str:
        return {"PASS": "green", "NEEDS_IMPROVEMENT": "yellow", "FAIL": "red"}.get(score, "white")

    @staticmethod
    def score_emoji(score: str) -> str:
        return {"PASS": "✅", "NEEDS_IMPROVEMENT": "⚠️ ", "FAIL": "❌"}.get(score, "❓")
