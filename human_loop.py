"""
human_loop.py — Human-in-the-Loop Interface
All terminal interactions with the user go through this module.
"""

import sys
from rich.console import Console
from rich.panel import Panel
from rich.markdown import Markdown
from rich.prompt import Confirm, Prompt
from rich.rule import Rule


class HumanLoop:
    """Manages all human approval gates and user input collection."""

    def __init__(self, console: Console):
        self.console = console

    # ── Input helpers ─────────────────────────────────────────────────────────

    def get_multiline_input(self, prompt: str, hint: str = "Press Enter twice to finish") -> str:
        """Collect multi-line text from the user."""
        self.console.print(f"\n[bold]{prompt}[/bold]")
        self.console.print(f"[dim]{hint}[/dim]\n")

        lines = []
        empty_count = 0
        try:
            while True:
                line = input()
                if line == "":
                    empty_count += 1
                    if empty_count >= 2:
                        break
                else:
                    empty_count = 0
                    lines.append(line)
        except (EOFError, KeyboardInterrupt):
            pass

        return "\n".join(lines).strip()

    def get_single_input(self, prompt: str, default: str = "") -> str:
        """Collect a single-line response."""
        if default:
            return Prompt.ask(prompt, default=default, console=self.console)
        return Prompt.ask(prompt, console=self.console)

    def confirm(self, message: str, default: bool = True) -> bool:
        """Yes/no confirmation prompt."""
        return Confirm.ask(message, default=default, console=self.console)

    def choose(self, prompt: str, choices: list) -> str:
        """Let the user pick from a list."""
        for i, choice in enumerate(choices, 1):
            self.console.print(f"  [cyan]{i}.[/cyan] {choice}")
        while True:
            raw = Prompt.ask(prompt, console=self.console)
            if raw.isdigit() and 1 <= int(raw) <= len(choices):
                return choices[int(raw) - 1]
            self.console.print("[red]Invalid choice. Try again.[/red]")

    # ── Display helpers ───────────────────────────────────────────────────────

    def display_output(self, title: str, content: str, border_style: str = "blue"):
        """Render a skill output in a styled panel."""
        preview = content if len(content) <= 6000 else content[:6000] + "\n\n[dim]…(truncated for display — full output saved to file)[/dim]"
        try:
            self.console.print(Panel(Markdown(preview), title=f"[bold]{title}[/bold]", border_style=border_style))
        except Exception:
            self.console.print(Panel(preview, title=f"[bold]{title}[/bold]", border_style=border_style))

    def section(self, title: str):
        self.console.print()
        self.console.print(Rule(f"[bold blue]{title}[/bold blue]"))
        self.console.print()

    def success(self, message: str):
        self.console.print(f"[bold green]✅ {message}[/bold green]")

    def warning(self, message: str):
        self.console.print(f"[bold yellow]⚠️  {message}[/bold yellow]")

    def info(self, message: str):
        self.console.print(f"[dim]ℹ️  {message}[/dim]")

    def error(self, message: str):
        self.console.print(f"[bold red]❌ {message}[/bold red]")

    # ── Approval gate ─────────────────────────────────────────────────────────

    def approval_gate(self, skill_display_name: str) -> tuple[bool, str]:
        """
        Standard approval gate shown after every skill execution.
        Returns (approved: bool, feedback: str).
        """
        self.section(f"Human Approval — {skill_display_name}")

        has_suggestions = self.confirm("Do you have any suggestions or improvements for this output?", default=False)
        feedback = ""
        if has_suggestions:
            feedback = self.get_multiline_input("Enter your suggestions or changes")

        approved = self.confirm(f"✅ Approve this output and proceed to the next step?", default=True)
        return approved, feedback
