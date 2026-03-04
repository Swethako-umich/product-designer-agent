"""
skills_loader.py — Skill Prompt Loader
Reads skill system prompts from the /skills directory.
Each skill is a Markdown file whose content becomes the Claude system prompt.
"""

from pathlib import Path
from typing import Optional, List


class SkillsLoader:
    """Loads and caches skill prompts from the skills/ directory."""

    def __init__(self, skills_dir: Path = None):
        self.skills_dir = skills_dir or (Path(__file__).parent / "skills")
        self._cache: dict[str, str] = {}

    def load(self, skill_name: str) -> Optional[str]:
        """Load a skill prompt by canonical name (e.g. 'ux_user_flow')."""
        if skill_name in self._cache:
            return self._cache[skill_name]

        candidates = [
            self.skills_dir / f"{skill_name}.md",
            self.skills_dir / f"{skill_name.replace('_', '-')}.md",
        ]

        for path in candidates:
            if path.exists():
                content = path.read_text(encoding="utf-8").strip()
                self._cache[skill_name] = content
                return content

        return None

    def list_available(self) -> List[str]:
        """Return canonical names of all loaded skill files."""
        return [
            f.stem.replace("-", "_")
            for f in sorted(self.skills_dir.glob("*.md"))
        ]

    def exists(self, skill_name: str) -> bool:
        return self.load(skill_name) is not None
