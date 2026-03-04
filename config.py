"""
config.py — Agent Configuration
Stores the agent's identity, rules, and runtime settings.
This file is updated by the agent at the end of each session with new learnings.
"""

import os
from dataclasses import dataclass, field
from typing import List
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

# ─────────────────────────────────────────────
# AGENT IDENTITY — updated after each session
# ─────────────────────────────────────────────

AGENT_VERSION = "1.0.0"

AGENT_DESCRIPTION = """
End-to-End Product Designer Agent v1.0

An AI orchestrator that runs the complete UX design lifecycle — from a raw problem
statement to a validated, interactive prototype — using specialised sub-skills at
every phase. It enforces human approval gates between every step, runs QA after every
output, maintains a living logbook of its own learnings, and updates its own rules at
the end of each session.
"""

AGENT_RULES = [
    "Always get explicit human approval before proceeding to the next step.",
    "Run QA checks on every skill output before showing it to the user.",
    "Never make assumptions — ask for clarification rather than guessing.",
    "Feed the verified output of each skill as context to the next skill.",
    "Allow the user to iterate on any output before marking it approved.",
    "Log a learning after every skill execution and every user correction.",
    "At session end, present the full logbook for user approval before updating rules.",
    "If a skill output fails QA, offer a revision cycle before moving on.",
    "Track whether the user provided interview / usability data upfront.",
    "If no data is provided, always ask whether to simulate or skip.",
]

SKILL_SEQUENCE = [
    "research_plan",
    "ux_literature_review",
    "competitor_analysis",
    "ux_interview_guide",
    "simulated_interviewee",
    "uxr_synthesis",
    "ux_ideation",
    "prd_generator",
    "ux_user_flow",
    "ux_information_architecture",
    "ux_brand_guidelines",
    "ux_design_system",
    "ux_prototype_generator",
    "ux_usability_test_guide",
    "simulated_usability_participant",
]

SKILL_DISPLAY_NAMES = {
    "research_plan":                   "UX Research Plan",
    "ux_literature_review":            "Literature Review",
    "competitor_analysis":             "Competitor Analysis",
    "ux_interview_guide":              "Interview Guide",
    "simulated_interviewee":           "Simulated User Interviews",
    "uxr_synthesis":                   "UXR Synthesis & Affinity Map",
    "ux_ideation":                     "Design Ideation",
    "prd_generator":                   "Product Requirements Document (PRD)",
    "ux_user_flow":                    "User Flow",
    "ux_information_architecture":     "Information Architecture (IA)",
    "ux_brand_guidelines":             "Brand Guidelines",
    "ux_design_system":                "Design System",
    "ux_prototype_generator":          "Interactive Prototype",
    "ux_usability_test_guide":         "Usability Test Guide",
    "simulated_usability_participant": "Simulated Usability Testing",
}


@dataclass
class AgentConfig:
    api_key: str = field(
        default_factory=lambda: os.environ.get("ANTHROPIC_API_KEY", "")
    )
    model: str = field(
        default_factory=lambda: os.environ.get(
            "CLAUDE_MODEL", "claude-sonnet-4-5-20250929"
        )
    )
    max_tokens: int = 8096
    skills_dir: Path = field(
        default_factory=lambda: Path(__file__).parent / "skills"
    )
    outputs_dir: Path = field(
        default_factory=lambda: Path(__file__).parent / "outputs"
    )
    description: str = AGENT_DESCRIPTION
    rules: List[str] = field(default_factory=lambda: AGENT_RULES.copy())

    def __post_init__(self):
        if not self.api_key:
            raise ValueError(
                "ANTHROPIC_API_KEY is not set.\n"
                "Run: export ANTHROPIC_API_KEY=your_key_here"
            )
        self.outputs_dir.mkdir(parents=True, exist_ok=True)
