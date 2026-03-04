"""
logbook.py — Agent Self-Learning Logbook
Records every action, user interaction, learning, and improvement note.
This is the agent's memory of how it performed and what it should do better.
"""

import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional


class Logbook:
    """
    A living record of everything the agent does, learns, and is told.
    At session end the logbook is summarised and used to update the agent's rules.
    """

    def __init__(self):
        self.entries: List[Dict] = []
        self.project_dir: Optional[Path] = None
        self.session_start: datetime = datetime.now()

    # ── Lifecycle ─────────────────────────────────────────────────────────────

    def initialize(self, project_dir: Path):
        self.project_dir = project_dir
        self.add_entry(
            "SESSION_START",
            "Agent session started",
            {"start_time": self.session_start.isoformat()},
        )

    # ── Core logging ─────────────────────────────────────────────────────────

    def add_entry(
        self,
        event_type: str,
        description: str,
        data: Dict[str, Any] = None,
    ):
        entry = {
            "id":          len(self.entries) + 1,
            "timestamp":   datetime.now().isoformat(),
            "event_type":  event_type,
            "description": description,
            "data":        data or {},
        }
        self.entries.append(entry)
        self._save_json()

    # ── Convenience helpers ───────────────────────────────────────────────────

    def log_skill_start(self, skill_name: str):
        self.add_entry("SKILL_START", f"Started: {skill_name}", {"skill": skill_name})

    def log_skill_complete(
        self,
        skill_name: str,
        qa_score: str,
        approved: bool,
        iterations: int,
        output_preview: str = "",
    ):
        self.add_entry(
            "SKILL_COMPLETE",
            f"Completed: {skill_name}",
            {
                "skill":          skill_name,
                "qa_score":       qa_score,
                "human_approved": approved,
                "iterations":     iterations,
                "output_preview": output_preview[:400],
            },
        )

    def log_skill_skip(self, skill_name: str, reason: str):
        self.add_entry("SKILL_SKIP", f"Skipped: {skill_name}", {"skill": skill_name, "reason": reason})

    def log_qa_result(self, skill_name: str, score: str, issues: List[str], recs: List[str]):
        self.add_entry(
            "QA_RESULT",
            f"QA for {skill_name}: {score}",
            {"skill": skill_name, "score": score, "issues": issues, "recommendations": recs},
        )

    def log_user_feedback(self, skill_name: str, feedback: str):
        self.add_entry(
            "USER_FEEDBACK",
            f"User gave feedback on {skill_name}",
            {"skill": skill_name, "feedback": feedback},
        )

    def log_user_suggestion(self, skill_name: str, suggestion: str):
        self.add_entry(
            "USER_SUGGESTION",
            f"User suggested improvement for {skill_name}",
            {"skill": skill_name, "suggestion": suggestion},
        )

    def log_learning(self, learning: str, category: str = "GENERAL"):
        self.add_entry(
            f"LEARNING",
            learning,
            {"category": category},
        )

    def log_clarification(self, question: str, answer: str):
        self.add_entry(
            "CLARIFICATION",
            "Agent asked for clarification",
            {"question": question, "answer": answer},
        )

    def log_iteration(self, skill_name: str, reason: str):
        self.add_entry(
            "ITERATION",
            f"Revision requested for {skill_name}",
            {"skill": skill_name, "reason": reason},
        )

    # ── Queries ───────────────────────────────────────────────────────────────

    def get_all_entries(self) -> List[Dict]:
        return self.entries

    def get_learnings(self) -> List[Dict]:
        return [e for e in self.entries if e["event_type"] == "LEARNING"]

    def get_user_feedback_entries(self) -> List[Dict]:
        return [
            e for e in self.entries
            if e["event_type"] in ("USER_FEEDBACK", "USER_SUGGESTION", "CLARIFICATION")
        ]

    def get_qa_failures(self) -> List[Dict]:
        return [
            e for e in self.entries
            if e["event_type"] == "QA_RESULT" and e["data"].get("score") == "FAIL"
        ]

    def get_iterations(self) -> List[Dict]:
        return [e for e in self.entries if e["event_type"] == "ITERATION"]

    def session_duration_minutes(self) -> float:
        return (datetime.now() - self.session_start).total_seconds() / 60

    # ── Persistence ───────────────────────────────────────────────────────────

    def _save_json(self):
        if self.project_dir:
            path = self.project_dir / "logbook.json"
            path.write_text(json.dumps(self.entries, indent=2))

    def save_markdown(self, content: str):
        if self.project_dir:
            path = self.project_dir / "logbook.md"
            path.write_text(content)
            return path
        return None
