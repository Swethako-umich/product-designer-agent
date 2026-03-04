"""
workflow.py — Workflow State Manager
Tracks the status of every skill in the pipeline and provides a summary view.
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional
from enum import Enum
from datetime import datetime


class SkillStatus(Enum):
    PENDING      = "⏳ Pending"
    IN_PROGRESS  = "🔄 In Progress"
    COMPLETED    = "✅ Completed"
    SKIPPED      = "⏭️  Skipped"
    FAILED       = "❌ Failed"
    NEEDS_REVIEW = "🔍 Needs Review"


@dataclass
class SkillExecution:
    skill_name: str
    display_name: str = ""
    status: SkillStatus = SkillStatus.PENDING
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    qa_score: Optional[str] = None
    human_approved: bool = False
    iterations: int = 0
    skip_reason: str = ""
    user_feedback: str = ""

    def duration_seconds(self) -> Optional[float]:
        if self.started_at and self.completed_at:
            return (self.completed_at - self.started_at).total_seconds()
        return None


class WorkflowManager:
    """Manages the ordered execution of skills and tracks their state."""

    def __init__(self):
        self.skills: Dict[str, SkillExecution] = {}
        self.todo_list: List[str] = []
        self.current_skill: Optional[str] = None
        self._started_at: datetime = datetime.now()

    # ── Setup ────────────────────────────────────────────────────────────────

    def set_todo_list(self, todo_list: List[str], display_names: Dict[str, str] = None):
        self.todo_list = todo_list
        for skill in todo_list:
            name = (display_names or {}).get(skill, skill.replace("_", " ").title())
            self.skills[skill] = SkillExecution(skill_name=skill, display_name=name)

    # ── Transitions ──────────────────────────────────────────────────────────

    def start_skill(self, skill_name: str):
        if skill_name not in self.skills:
            self.skills[skill_name] = SkillExecution(skill_name=skill_name)
        self.skills[skill_name].status = SkillStatus.IN_PROGRESS
        self.skills[skill_name].started_at = datetime.now()
        self.current_skill = skill_name

    def complete_skill(
        self,
        skill_name: str,
        qa_score: str = None,
        approved: bool = True,
    ):
        if skill_name in self.skills:
            self.skills[skill_name].status = SkillStatus.COMPLETED
            self.skills[skill_name].completed_at = datetime.now()
            self.skills[skill_name].qa_score = qa_score
            self.skills[skill_name].human_approved = approved
            self.skills[skill_name].iterations += 1

    def skip_skill(self, skill_name: str, reason: str = ""):
        if skill_name not in self.skills:
            self.skills[skill_name] = SkillExecution(skill_name=skill_name)
        self.skills[skill_name].status = SkillStatus.SKIPPED
        self.skills[skill_name].skip_reason = reason

    def fail_skill(self, skill_name: str):
        if skill_name in self.skills:
            self.skills[skill_name].status = SkillStatus.FAILED
            self.skills[skill_name].completed_at = datetime.now()

    def increment_iteration(self, skill_name: str):
        if skill_name in self.skills:
            self.skills[skill_name].iterations += 1

    def record_feedback(self, skill_name: str, feedback: str):
        if skill_name in self.skills:
            self.skills[skill_name].user_feedback = feedback

    # ── Queries ──────────────────────────────────────────────────────────────

    def get_state(self) -> dict:
        return {
            skill: {
                "status": exec.status.value,
                "qa_score": exec.qa_score,
                "human_approved": exec.human_approved,
                "iterations": exec.iterations,
                "duration_s": exec.duration_seconds(),
            }
            for skill, exec in self.skills.items()
        }

    def get_progress_summary(self) -> str:
        total     = len(self.skills)
        completed = sum(1 for s in self.skills.values() if s.status == SkillStatus.COMPLETED)
        skipped   = sum(1 for s in self.skills.values() if s.status == SkillStatus.SKIPPED)
        return f"{completed} completed, {skipped} skipped / {total} total"

    def all_done(self) -> bool:
        return all(
            s.status in (SkillStatus.COMPLETED, SkillStatus.SKIPPED, SkillStatus.FAILED)
            for s in self.skills.values()
        )

    def get_table_rows(self) -> List[tuple]:
        """Returns (step, display_name, status_str, qa, approved, iterations) tuples."""
        rows = []
        for i, skill_name in enumerate(self.todo_list, 1):
            if skill_name not in self.skills:
                continue
            s = self.skills[skill_name]
            rows.append((
                str(i),
                s.display_name or skill_name,
                s.status.value,
                s.qa_score or "—",
                "✅" if s.human_approved else ("—" if s.status == SkillStatus.PENDING else "❌"),
                str(s.iterations),
            ))
        return rows
