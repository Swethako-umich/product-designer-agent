#!/usr/bin/env python3
"""
server.py — Product Designer Agent · Web Server
FastAPI backend that proxies to Anthropic API and streams skill outputs.
Run: python server.py  →  open http://localhost:8000
"""

import json
import re
import os
from pathlib import Path
from typing import Optional, Dict, List

import anthropic
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

app = FastAPI(title="Product Designer Agent")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Paths ─────────────────────────────────────────────────────────────────────
BASE_DIR   = Path(__file__).parent
SKILLS_DIR = BASE_DIR.parent / "product-designer-agent" / "skills"

SKILL_SEQUENCE = [
    "research_plan", "ux_literature_review", "competitor_analysis",
    "ux_interview_guide", "simulated_interviewee", "uxr_synthesis",
    "ux_ideation", "prd_generator", "ux_user_flow",
    "ux_information_architecture", "ux_brand_guidelines", "ux_design_system",
    "ux_prototype_generator", "ux_usability_test_guide",
    "simulated_usability_participant",
]

QA_SYSTEM_PROMPT = """You are a senior UX QA Officer. Evaluate this deliverable strictly.
Return ONLY valid JSON (no markdown fences, no extra text) matching this exact schema:
{
  "score": "PASS" or "NEEDS_IMPROVEMENT" or "FAIL",
  "issues": ["specific issue 1"],
  "recommendations": ["fix 1"],
  "issues_count": 0,
  "accessibility_note": "one sentence",
  "brief_alignment": "ALIGNED" or "PARTIALLY_ALIGNED" or "MISALIGNED",
  "summary": "one sentence verdict"
}"""

# ── Pydantic models ───────────────────────────────────────────────────────────

class SkillRequest(BaseModel):
    api_key: str
    skill_name: str
    brief: str
    context: Dict[str, str] = {}
    interview_data: Optional[str] = None
    usability_data: Optional[str] = None
    feedback: Optional[str] = None
    model: str = "claude-sonnet-4-5-20250929"

class QARequest(BaseModel):
    api_key: str
    skill_name: str
    output: str
    brief: str
    context: Dict[str, str] = {}
    model: str = "claude-sonnet-4-5-20250929"

class ParseTodoRequest(BaseModel):
    api_key: str
    research_plan: str
    model: str = "claude-sonnet-4-5-20250929"

class LogbookRequest(BaseModel):
    api_key: str
    entries: List[Dict]
    model: str = "claude-sonnet-4-5-20250929"

class ReflectionRequest(BaseModel):
    api_key: str
    skill_name: str
    qa_score: str
    iterations: int
    user_feedback: Optional[str] = None
    model: str = "claude-sonnet-4-5-20250929"

# ── Helpers ───────────────────────────────────────────────────────────────────

def load_skill(name: str) -> Optional[str]:
    for path in [
        SKILLS_DIR / f"{name}.md",
        SKILLS_DIR / f"{name.replace('_', '-')}.md",
    ]:
        if path.exists():
            return path.read_text(encoding="utf-8")
    return None

def build_context(current: str, context: Dict[str, str]) -> str:
    parts = []
    for s in SKILL_SEQUENCE:
        if s == current:
            break
        if s in context and context[s]:
            label = s.replace("_", " ").title()
            parts.append(f"### {label}\n{context[s][:1500]}…")
    return "\n\n".join(parts) or "No previous outputs yet."

def strip_json_fences(text: str) -> str:
    return re.sub(r"```(?:json)?", "", text).replace("```", "").strip()

# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/")
def serve_index():
    index = BASE_DIR / "index.html"
    if index.exists():
        return FileResponse(index)
    return HTMLResponse("<h1>index.html not found</h1>", status_code=404)


@app.post("/api/skill/stream")
async def stream_skill(req: SkillRequest):
    prompt = load_skill(req.skill_name)
    if not prompt:
        raise HTTPException(404, f"Skill '{req.skill_name}' not found in {SKILLS_DIR}")

    ctx = build_context(req.skill_name, req.context)
    display = req.skill_name.replace("_", " ").title()

    msg = f"## Project Brief\n{req.brief}\n\n## Context from Previous Steps\n{ctx}\n\n"
    if req.interview_data:
        msg += f"## User-Provided Interview Data\n{req.interview_data[:3000]}\n\n"
    if req.usability_data:
        msg += f"## User-Provided Usability Data\n{req.usability_data[:3000]}\n\n"
    if req.feedback:
        msg += f"## Revision Feedback from User\n{req.feedback}\n\n"
    msg += f"Please execute the **{display}** deliverable based on all the above."

    async def generate():
        client = anthropic.AsyncAnthropic(api_key=req.api_key)
        try:
            async with client.messages.stream(
                model=req.model,
                max_tokens=8096,
                system=prompt,
                messages=[{"role": "user", "content": msg}],
            ) as stream:
                async for text in stream.text_stream:
                    payload = json.dumps({"type": "text", "text": text})
                    yield f"data: {payload}\n\n"
            yield f"data: {json.dumps({'type': 'done'})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.post("/api/qa")
def qa_check(req: QARequest):
    client = anthropic.Anthropic(api_key=req.api_key)
    prev = build_context(req.skill_name, req.context)
    user_msg = (
        f"Skill: {req.skill_name}\n"
        f"Brief: {req.brief[:500]}\n"
        f"Previous artefacts summary:\n{prev}\n\n"
        f"Output to evaluate:\n{req.output[:5000]}"
    )
    try:
        resp = client.messages.create(
            model=req.model, max_tokens=1024, system=QA_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_msg}],
        )
        raw = strip_json_fences(resp.content[0].text)
        return json.loads(raw)
    except Exception as e:
        return {
            "score": "NEEDS_IMPROVEMENT",
            "issues": [f"QA error: {e}"],
            "recommendations": ["Manual review recommended."],
            "issues_count": 1,
            "accessibility_note": "Could not assess.",
            "brief_alignment": "UNKNOWN",
            "summary": "Automated QA encountered an error.",
        }


@app.post("/api/parse-todo")
def parse_todo(req: ParseTodoRequest):
    client = anthropic.Anthropic(api_key=req.api_key)
    valid_json = json.dumps(SKILL_SEQUENCE)
    resp = client.messages.create(
        model=req.model,
        max_tokens=512,
        system=(
            "Extract the ordered UX skill list from a research plan. "
            f"Return ONLY a JSON array using names from: {valid_json}. "
            "No explanation, no markdown fences — raw JSON array only."
        ),
        messages=[{
            "role": "user",
            "content": f"Extract skill execution order:\n\n{req.research_plan[:3000]}",
        }],
    )
    raw = strip_json_fences(resp.content[0].text)
    try:
        parsed = json.loads(raw)
        valid = [s for s in parsed if s in SKILL_SEQUENCE]
        if "research_plan" not in valid:
            valid.insert(0, "research_plan")
        return {"todo": valid}
    except Exception:
        return {"todo": SKILL_SEQUENCE}


@app.post("/api/logbook")
def generate_logbook(req: LogbookRequest):
    client = anthropic.Anthropic(api_key=req.api_key)
    entries_str = json.dumps(req.entries, indent=2)[:8000]
    resp = client.messages.create(
        model=req.model,
        max_tokens=4096,
        system="You are the agent's self-reflection module. Write in Markdown. Be honest and specific.",
        messages=[{
            "role": "user",
            "content": (
                "Write a comprehensive agent session logbook from these entries.\n"
                "Include these sections:\n"
                "## 1. Executive Summary\n"
                "## 2. Skill-by-Skill Performance\n"
                "## 3. User Interactions & Feedback\n"
                "## 4. Key Learnings (numbered list of specific, actionable insights)\n"
                "## 5. Improvement Areas (where the agent struggled or fell short)\n"
                "## 6. Most Important Insight (one focused paragraph)\n"
                "## 7. Recommended Rule Updates (imperative statements for future sessions)\n\n"
                f"Log entries:\n{entries_str}"
            ),
        }],
    )
    return {"summary": resp.content[0].text.strip()}


@app.post("/api/reflect")
def reflect(req: ReflectionRequest):
    client = anthropic.Anthropic(api_key=req.api_key)
    resp = client.messages.create(
        model=req.model,
        max_tokens=200,
        system="You are the agent's internal self-improvement module. Be concise, honest, specific.",
        messages=[{
            "role": "user",
            "content": (
                f"Skill: {req.skill_name}\n"
                f"QA score: {req.qa_score}\n"
                f"Iterations needed: {req.iterations}\n"
                f"User feedback: {req.user_feedback or 'None'}\n\n"
                "In 2 sentences: what went well, and one specific rule to adopt for future sessions."
            ),
        }],
    )
    return {"learning": resp.content[0].text.strip()}


# ── Run ───────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    print("\n🎨  Product Designer Agent — Web Interface")
    print("   Server: http://localhost:8000\n")
    uvicorn.run(app, host="0.0.0.0", port=8000)
