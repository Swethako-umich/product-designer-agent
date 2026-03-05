# Agent Learnings

This file is automatically updated at the end of each session when the user approves the logbook.
It is the agent's living memory — tracking how it performed, what it learned, and how its rules evolved.

---

<!-- Session entries will be appended below by the agent -->

---

## Session — UMich VIP Football App Research Planning
**Date:** 2026-03-05
**Skills completed:** 1 (research_plan) · **Iterations:** 2 · **QA scores:** 2× NEEDS_IMPROVEMENT

### Executive Summary
This session focused on creating a comprehensive research plan for a University of Michigan VIP football app project. The agent completed one skill (`research_plan`) across two iterations, ultimately receiving "NEEDS_IMPROVEMENT" QA scores both times before user approval to proceed. The session revealed significant challenges in aligning deliverables with project context, completing documents thoroughly, and including operational research components. Despite structural strengths in organising research methods, the agent struggled with fundamental issues: misalignment with the actual project brief (confusing Atomic Object's general services brief with a UMich football app), incomplete method descriptions, and missing critical sections like recruitment strategy, analysis plans, and risk mitigation.

### Most Important Insight
**Contextual grounding must precede methodological planning.** The agent demonstrated strong capabilities in structuring research methods and organising complex information, but these strengths became liabilities when applied to an incorrect project context. This reveals a fundamental sequence error: diving into detailed planning before establishing what project is actually being planned for. Without an explicit validation gate at the start of any planning skill, even sophisticated planning capabilities produce unusable deliverables.

### Key Learnings

1. **Always validate document completeness before submission** — Mid-sentence cutoffs occurred in both iterations, indicating a failure to review generated content end-to-end before QA submission.
2. **Brief alignment is the first validation checkpoint** — Before developing any research plan details, confirm the project context matches the provided brief; fabricating project details leads to fundamentally unusable deliverables.
3. **Research plans require operational components, not just methodological design** — Recruitment strategy, analysis plans, risk mitigation, and validation approaches are equally essential to research methods themselves.
4. **Acknowledge absence of information explicitly** — When "no previous outputs yet" exists, state assumptions clearly rather than proceeding as if project knowledge is established.
5. **Ethical considerations must be proactive, not reactive** — Any research involving human participants requires upfront consent protocols and ethical frameworks before method design.
6. **Success metrics need dual definition** — Distinguish between research execution metrics (recruitment success, completion rates) and research outcome metrics (insight quality, actionability).
7. **Budget and timeline constraints require mitigation strategies** — Acknowledging limitations without addressing how to work within them demonstrates incomplete planning.
8. **Accessibility cannot be an afterthought** — Research participation requirements and deliverable formats must consider accessibility from initial design.
9. **AI assistance claims need measurement frameworks** — When AI-assisted prototyping is mentioned as an objective, specify how AI contribution will be evaluated and validated.
10. **Organisational values should inform methodology** — When working with specific clients, align research approaches with their stated values (partnership, multi-disciplinary collaboration, early client involvement).

### Rule Updates Adopted

1. **Implement mandatory brief alignment check before generating any research plan content** — Extract project name, client, key stakeholders, and objectives from provided materials and validate against user's stated project before proceeding.
2. **Establish document completeness validation as final step** — Before submitting any multi-section document for QA, verify no sections end mid-sentence and all outlined components are present.
3. **Require explicit assumption documentation when working with limited context** — When gaps exist, create an "Assumptions & Information Needs" section stating what's known versus assumed.
4. **Always include operational sections in research plans** — Treat recruitment strategy, analysis/synthesis approach, risk register, timeline, validation plan, and ethical considerations as mandatory components, not optional additions.
5. **Distinguish research execution metrics from product success metrics** — Every research plan must define how research quality itself will be measured, separate from what the research aims to discover.
6. **Front-load ethical considerations for human-subjects research** — Any plan involving interviews, observations, diary studies, or usability testing must include consent protocols and ethical frameworks before method details.
7. **Connect methodology to organisational values when client is specified** — Review client's stated values/approach and explicitly align research methods with their working principles.
8. **Define measurement frameworks when AI assistance is claimed** — Any mention of AI-assisted work must include specific metrics for how AI contribution will be evaluated.
9. **Create mitigation strategies for every acknowledged constraint** — Budget limitations, timeline pressure, or resource restrictions must be accompanied by specific approaches to work within those constraints.
10. **Build validation checkpoints into research timelines** — Include explicit gates where findings will be tested, reviewed, or validated before proceeding to subsequent phases.
