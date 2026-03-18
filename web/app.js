/* ============================================================
   Swetha's Product Design Agent — app.js
   All UI logic, state management, and API communication.
   ============================================================ */

mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  themeVariables: { background: '#1E1E2D', primaryColor: '#7B5FF5', edgeLabelBackground: '#1E1E2D' }
});

// ── Constants ────────────────────────────────────────────────────────────────
const SKILL_SEQ = [
  'research_plan','ux_literature_review','competitor_analysis',
  'ux_interview_guide','simulated_interviewee','uxr_synthesis',
  'ux_ideation','prd_generator','ux_user_flow','ux_information_architecture',
  'ux_brand_guidelines','ux_design_system','ux_prototype_generator',
  'ux_usability_test_guide','simulated_usability_participant'
];

const SKILL_NAMES = {
  research_plan:'Project Plan', ux_literature_review:'Literature Review',
  competitor_analysis:'Competitor Analysis', ux_interview_guide:'Interview Guide',
  simulated_interviewee:'Simulated Interviews', uxr_synthesis:'UXR Synthesis',
  ux_ideation:'Design Ideation', prd_generator:'Product Requirements (PRD)',
  ux_user_flow:'User Flow', ux_information_architecture:'Information Architecture',
  ux_brand_guidelines:'Brand Guidelines', ux_design_system:'Design System',
  ux_prototype_generator:'Interactive Prototype', ux_usability_test_guide:'Usability Test Guide',
  simulated_usability_participant:'Simulated Usability Testing'
};

const SKILL_ICONS = {
  research_plan:'🔬', ux_literature_review:'📚', competitor_analysis:'🏆',
  ux_interview_guide:'🎤', simulated_interviewee:'🤖', uxr_synthesis:'🧩',
  ux_ideation:'💡', prd_generator:'📋', ux_user_flow:'🗺️',
  ux_information_architecture:'🏗️', ux_brand_guidelines:'🎨', ux_design_system:'⚙️',
  ux_prototype_generator:'🖥️', ux_usability_test_guide:'🧪',
  simulated_usability_participant:'👤'
};

// ── Dashboard helpers ──────────────────────────────────────────────────────────
let _timerInterval = null;
let _startTime = null;

function startTimer(){
  _startTime = Date.now();
  _timerInterval && clearInterval(_timerInterval);
  _timerInterval = setInterval(()=>{
    const s = Math.floor((Date.now()-_startTime)/1000);
    const m = Math.floor(s/60), sec = s%60;
    const el = document.getElementById('dash-elapsed');
    if(el) el.textContent = m+':'+(sec<10?'0':'')+sec;
  },1000);
}

function updateDashStats(){
  const total = S.todoList.length||0;
  const done = S.totalCompleted;
  const pct = total>0 ? Math.round(done/total*100) : 0;
  const qaArr = Object.values(S.skillMeta).filter(m=>m.qa);
  const passes = qaArr.filter(m=>m.qa.score==='PASS').length;
  const qaRate = qaArr.length>0 ? Math.round(passes/qaArr.length*100)+'%' : '—';

  const $ = id => document.getElementById(id);
  if($('dash-pct')) $('dash-pct').textContent = pct+'%';
  if($('dash-steps')) $('dash-steps').textContent = done+'/'+total;
  if($('dash-qa')) $('dash-qa').textContent = qaRate;
  if($('dash-bar-fill')) $('dash-bar-fill').style.width = pct+'%';
  $('prog-fill').style.width = pct+'%';
  $('prog-label').textContent = done+' / '+total+' steps';
  // Mirror stats to right panel
  const rpp=document.getElementById('rp-pct'); if(rpp) rpp.textContent=pct+'%';
  const rpq=document.getElementById('rp-qa'); if(rpq) rpq.textContent=qaRate;
  const rpe=document.getElementById('rp-eta');
  if(rpe){ const el2=document.getElementById('dash-elapsed'); if(el2) rpe.textContent=el2.textContent; }
  const rps=document.getElementById('rp-spend'); if(rps) rps.textContent='$'+S.apiSpend.toFixed(2);
  const dsp=document.getElementById('dash-spend'); if(dsp) dsp.textContent='$'+S.apiSpend.toFixed(2);
}

function addDeliverableCard(skillName, qaScore){
  const grid = document.getElementById('deliverables-grid');
  const area = document.getElementById('deliverables-area');
  if(!grid) return;
  const name = SKILL_NAMES[skillName]||skillName;
  const icon = SKILL_ICONS[skillName]||'📄';
  const scoreLabel = qaScore==='PASS'?'✓ Pass':qaScore==='NEEDS_IMPROVEMENT'?'~ Review':qaScore==='FAIL'?'✗ Fail':'';
  const card = document.createElement('div');
  card.className='deliv-card';
  card.onclick = ()=>viewSkillOutput(skillName);
  card.innerHTML = `<div class="deliv-icon">${icon}</div><div class="deliv-name">${name}</div>`
    +(qaScore?`<span class="deliv-qa ${qaScore}">${scoreLabel}</span>`:'');
  grid.appendChild(card);
  if(area) area.style.display='';
}

function toggleLiveOutput(){
  const wrap = document.getElementById('stream-wrap');
  const toggle = document.getElementById('live-toggle');
  const text = document.getElementById('live-toggle-text');
  const open = toggle.classList.toggle('open');
  wrap.classList.toggle('open', open);
  text.textContent = open ? 'Hide live output' : 'Show live output';
}

function updateReviewStrip(skillName){
  const dotsEl = document.getElementById('review-dots');
  if(!dotsEl||!S.todoList.length) return;
  const idx = S.todoList.indexOf(skillName);
  dotsEl.innerHTML = S.todoList.slice(0,Math.min(S.todoList.length,20)).map((s,i)=>{
    const cls = i<idx?'done':i===idx?'active':'';
    return `<div class="review-dot ${cls}" title="${SKILL_NAMES[s]||s}"></div>`;
  }).join('');
}

// ── Pause / Resume / Restart ──────────────────────────────────────────────────
function updatePauseBtn(){
  const btn = document.getElementById('btn-pause');
  if(!btn) return;
  if(S.paused){
    btn.textContent='▶ Resume';
    btn.className='btn btn-sm pause-paused';
  } else if(S.pauseRequested){
    btn.textContent='⏸ Pausing…';
    btn.className='btn btn-sm pause-pending';
  } else {
    btn.textContent='⏸ Pause';
    btn.className='btn btn-ghost btn-sm';
  }
}

function togglePause(){
  if(S.paused){
    S.paused=false; S.pauseRequested=false;
    updatePauseBtn();
    const logo=document.getElementById('hdr-logo');
    if(logo) logo.classList.add('running');
    setStatus('running','Resuming…');
    toast('Resumed ▶','info');
  } else {
    S.pauseRequested=true;
    updatePauseBtn();
    toast('Will pause after current step…','warn');
  }
}

async function checkPause(){
  if(S.pauseRequested){
    S.paused=true; S.pauseRequested=false;
    updatePauseBtn();
    const logo=document.getElementById('hdr-logo');
    if(logo) logo.classList.remove('running');
    setStatus('idle','Paused');
    toast('Agent paused — press Resume to continue.','warn');
    while(S.paused) await sleep(500);
    setStatus('running','Resuming…');
    if(logo) logo.classList.add('running');
  }
}

function restartAgent(){
  if(!confirm('Restart from the beginning? All current progress will be cleared.')) return;
  if(_timerInterval){ clearInterval(_timerInterval); _timerInterval=null; }
  S.paused=false; S.pauseRequested=false;
  S.todoList=[]; S.context={}; S.skillMeta={};
  S.logbook=[]; S.logbookSummary=''; S.logbookContext='';
  S.totalCompleted=0; S.currentSkillIdx=-1; S.approvalResolve=null;
  S.prototypeHtml=null;
  const pb=document.getElementById('btn-dl-prototype');
  if(pb) pb.style.display='none';
  const pauseBtn=document.getElementById('btn-pause');
  const restartBtn=document.getElementById('btn-restart');
  if(pauseBtn){ pauseBtn.style.display='none'; pauseBtn.textContent='⏸ Pause'; pauseBtn.className='btn btn-ghost btn-sm'; }
  if(restartBtn) restartBtn.style.display='none';
  const logo=document.getElementById('hdr-logo');
  if(logo) logo.classList.remove('running');
  const progFill=document.getElementById('prog-fill');
  const progLabel=document.getElementById('prog-label');
  if(progFill) progFill.style.width='0%';
  if(progLabel) progLabel.textContent='Ready';
  const grid=document.getElementById('deliverables-grid');
  if(grid) grid.innerHTML='';
  const area=document.getElementById('deliverables-area');
  if(area) area.style.display='none';
  const ids=['dash-pct','dash-steps','dash-qa','dash-elapsed'];
  ids.forEach((id,i)=>{ const el=document.getElementById(id); if(el) el.textContent=['0%','0/0','—','0:00'][i]; });
  S.apiSpend=0;
  S.brandIntakeSelections=null; S.brandIntakeContext=null;
  S.iaIntakeSelections=null; S.iaIntakeContext=null;
  S.ufIntakeSelections=null; S.ufIntakeContext=null;
  rpUpdateBrandDirection();
  rpUpdateIADirection();
  rpUpdateUFDirection();
  const spendEl=document.getElementById('dash-spend'); if(spendEl) spendEl.textContent='$0.00';
  const fill=document.getElementById('dash-bar-fill');
  if(fill) fill.style.width='0%';
  showScreen('screen-brief');
  setStatus('idle','Idle');
  toast('Agent restarted — enter a new project brief.','info');
}

// ── State ────────────────────────────────────────────────────────────────────
const S = {
  apiKey:'', model:'claude-sonnet-4-5-20250929', projectName:'', brief:'',
  interviewData:null, usabilityData:null,
  useSimulatedInterviews:false, useSimulatedUsability:false,
  todoList:[], currentSkillIdx:-1,
  context:{}, skillMeta:{},
  logbook:[], logbookSummary:'',
  approvalResolve:null, totalCompleted:0,
  paused:false, pauseRequested:false,
  prototypeHtml:null,
  isRunning:false,
  viewingSkill:null,
  apiSpend:0,
  brandIntakeSelections:null,
  brandIntakeContext:null,
  iaIntakeSelections:null,
  iaIntakeContext:null,
  ufIntakeSelections:null,
  ufIntakeContext:null
};

// ── Screen router ─────────────────────────────────────────────────────────────
function showScreen(id){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}
function showState(id){
  document.querySelectorAll('.state').forEach(s=>s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ── Radio card interactions ───────────────────────────────────────────────────
document.querySelectorAll('.radio-group').forEach(grp=>{
  grp.querySelectorAll('.radio-card').forEach(card=>{
    card.addEventListener('click',()=>{
      grp.querySelectorAll('.radio-card').forEach(c=>c.classList.remove('selected'));
      card.classList.add('selected');
      card.querySelector('input').checked=true;
      const val=card.dataset.val;
      const grpId=grp.id;
      if(grpId==='rg-interviews') document.getElementById('paste-interviews').classList.toggle('visible',val==='have');
      if(grpId==='rg-usability')  document.getElementById('paste-usability').classList.toggle('visible',val==='have');
    });
  });
  grp.querySelector('.radio-card').classList.add('selected');
});
document.getElementById('paste-interviews').classList.add('visible');
document.getElementById('paste-usability').classList.add('visible');

// ── Onboarding flow ───────────────────────────────────────────────────────────
function goToBrief(){
  const key=document.getElementById('inp-key').value.trim();
  if(!key){toast('Please enter your Anthropic API key.','error');return;}
  S.apiKey=key;
  S.projectName=document.getElementById('inp-project').value.trim()||'Untitled Project';
  showScreen('screen-brief');
}
function goToData(){
  const brief=document.getElementById('inp-brief').value.trim();
  if(!brief){toast('Please enter a project brief.','error');return;}
  S.brief=brief;
  showScreen('screen-data');
}

// ── Start agent ───────────────────────────────────────────────────────────────
async function startAgent(){
  const intVal=document.querySelector('input[name=interviews]:checked').value;
  const usbVal=document.querySelector('input[name=usability]:checked').value;
  if(intVal==='have') S.interviewData=document.getElementById('inp-interview-data').value.trim()||null;
  S.useSimulatedInterviews=intVal==='simulate';
  if(usbVal==='have') S.usabilityData=document.getElementById('inp-usability-data').value.trim()||null;
  S.useSimulatedUsability=usbVal==='simulate';

  showScreen('screen-main');
  document.getElementById('hdr-project').textContent=S.projectName;
  setStatus('running','Initialising…');
  showState('state-idle');
  startTimer();
  const pauseBtn=document.getElementById('btn-pause');
  const restartBtn=document.getElementById('btn-restart');
  if(pauseBtn) pauseBtn.style.display='';
  if(restartBtn) restartBtn.style.display='';
  const logo=document.getElementById('hdr-logo');
  if(logo) logo.classList.add('running');
  addLog('SESSION_START','Agent session started',{project:S.projectName});
  toast('Agent started — generating Project Plan first.','info');

  await sleep(600);
  await runWorkflow();
}

// ── Main workflow ─────────────────────────────────────────────────────────────
async function runWorkflow(){
  S.isRunning=true;
  try{
    await executeSkillAndApprove('research_plan');

    setStatus('running','Parsing workflow plan…');
    const planText=S.context['research_plan']||'';
    const res=await api('parse-todo',{research_plan:planText});
    S.todoList=res.todo||SKILL_SEQ;
    renderSidebar(S.todoList);
    updateProgress(0,S.todoList.length);
    updateDashStats();
    toast('Research plan approved — workflow plan ready.','success');
    addLog('PLAN_PARSED','Workflow plan extracted',{skills:S.todoList});
    await _runSkillLoop(1);
  }catch(e){
    console.error(e);
    toast('An error occurred: '+e.message,'error');
    setStatus('idle','Error');
    const logoEl2=document.getElementById('hdr-logo');
    if(logoEl2) logoEl2.classList.remove('running');
  }finally{
    S.isRunning=false;
  }
}

async function _runSkillLoop(startIdx){
  for(let i=startIdx;i<S.todoList.length;i++){
    const skill=S.todoList[i];
    if(skill==='research_plan') continue;
    if(shouldSkip(skill)){
      setSkillStatus(skill,'skipped');
      addLog('SKILL_SKIP',`Skipped: ${skill}`,{reason:'User data provided or simulation declined'});
      continue;
    }
    await checkPause();
    await executeSkillAndApprove(skill);
    updateProgress(S.totalCompleted,S.todoList.length);
  }
  await generateLogbook();
  const logoEl=document.getElementById('hdr-logo');
  if(logoEl) logoEl.classList.remove('running');
  const pb=document.getElementById('btn-pause');
  if(pb) pb.style.display='none';
}

function shouldSkip(skill){
  if(skill==='ux_interview_guide' && S.interviewData) return true;
  if(skill==='simulated_interviewee' && !S.useSimulatedInterviews) return true;
  if(skill==='simulated_usability_participant' && !S.useSimulatedUsability) return true;
  return false;
}

// ── Execute skill + auto-QA loop (human escalation only when needed) ──────────
// Behaviour:
//   PASS               → auto-approve, move on immediately
//   NEEDS_IMPROVEMENT  → auto-revise up to MAX_AUTO_REVISIONS using QA recommendations
//   FAIL               → escalate to human immediately
//   Still not PASS after MAX_AUTO_REVISIONS → escalate to human
const MAX_AUTO_REVISIONS = 2;

async function executeSkillAndApprove(skillName){
  const display=SKILL_NAMES[skillName]||skillName;

  // ── Brand intake gate: pause before brand guidelines to collect visual direction
  let brandIntakeContext=null;
  if(skillName==='ux_brand_guidelines'){
    brandIntakeContext=await showBrandIntake();
  }

  // ── IA intake gate: pause before IA to collect navigation direction
  let iaIntakeContext=null;
  if(skillName==='ux_information_architecture'){
    iaIntakeContext=await showIAIntake();
  }

  // ── User flow intake gate: pause before user flow to collect entry point direction
  let ufIntakeContext=null;
  if(skillName==='ux_user_flow'){
    ufIntakeContext=await showUserFlowIntake();
  }

  setSkillStatus(skillName,'running');
  S.currentSkillIdx=S.todoList.indexOf(skillName);
  setStatus('running','Running: '+display);
  addLog('SKILL_START','Started: '+skillName,{skill:skillName});

  let iterations=0;
  // Seed initial feedback with intake answers so the skill gets them on first call
  let feedback=brandIntakeContext||iaIntakeContext||ufIntakeContext||null;
  let autoRevisions=0;

  while(true){
    iterations++;
    const output=await streamSkill(skillName,feedback);
    S.context[skillName]=output;
    S.skillMeta[skillName]={status:'completed',output,iterations,qa:null};

    setStatus('running','Running QA on '+display+'…');
    showExecutingStatus('Running QA check…');
    const qa=await runQA(skillName,output);
    S.skillMeta[skillName].qa=qa;
    addLog('QA_RESULT','QA for '+skillName+': '+qa.score,{skill:skillName,score:qa.score,issues:qa.issues});

    try{
      const lr=await api('reflect',{skill_name:skillName,qa_score:qa.score,iterations,user_feedback:feedback});
      addLog('LEARNING',lr.learning||'',{skill:skillName,category:skillName.toUpperCase()});
    }catch(_){}

    // ── PASS: auto-approve, no human needed ───────────────────────────────────
    if(qa.score==='PASS'){
      autoApproveSkill(skillName,output,qa,iterations);
      toast(display+' ✅ QA passed — continuing automatically','success');
      break;
    }

    // ── NEEDS IMPROVEMENT + auto-revisions remaining: revise silently ─────────
    if(qa.score==='NEEDS_IMPROVEMENT' && autoRevisions < MAX_AUTO_REVISIONS){
      autoRevisions++;
      // Build feedback from QA recommendations + issues
      const recs=(qa.recommendations||[]).join('\n');
      const issues=(qa.issues||[]).join('\n');
      feedback=`QA identified the following issues to fix:\n${issues}\n\nRecommended fixes:\n${recs}`;
      addLog('AUTO_REVISION',`Auto-revising ${skillName} (attempt ${autoRevisions}/${MAX_AUTO_REVISIONS})`,{reason:feedback});
      setSkillStatus(skillName,'running');
      showExecutingStatus(`QA found issues — auto-revising (${autoRevisions}/${MAX_AUTO_REVISIONS})…`);
      toast(`QA: issues found — auto-revising ${display} (${autoRevisions}/${MAX_AUTO_REVISIONS})…`,'warn');
      continue;
    }

    // ── FAIL or exhausted auto-revisions: escalate to human ──────────────────
    const reason = qa.score==='FAIL'
      ? '⚠️ QA score is FAIL — your input is needed to resolve a fundamental issue.'
      : `⚠️ Still not passing after ${MAX_AUTO_REVISIONS} auto-revision attempts — your guidance is needed.`;
    addLog('HUMAN_ESCALATION',`Escalating ${skillName} to human: ${qa.score}`,{iterations,autoRevisions});
    toast(reason,'error');

    showReviewState(skillName,output,qa,iterations,reason);
    const {approved,userFeedback}=await waitForApproval();
    if(userFeedback) addLog('USER_SUGGESTION','User suggestion for '+skillName,{feedback:userFeedback});

    if(approved){
      autoApproveSkill(skillName,output,qa,iterations);
      break;
    }else{
      feedback=userFeedback;
      autoRevisions=0; // reset auto-revision counter after human provides direction
      addLog('ITERATION','Human revision requested for '+skillName,{reason:feedback});
      setSkillStatus(skillName,'running');
      toast('Revising '+display+' with your feedback…','warn');
    }
  }
}

// Shared logic for marking a skill complete (used by both auto-approve and human approve)
function autoApproveSkill(skillName,output,qa,iterations){
  S.totalCompleted++;
  setSkillStatus(skillName,'completed',qa.score);
  if(skillName==='ux_prototype_generator'){
    const html=extractPrototypeHtml(output);
    if(html){
      S.prototypeHtml=html;
      const pb=document.getElementById('btn-dl-prototype');
      if(pb) pb.style.display='';
    }
  }
  addLog('SKILL_COMPLETE','Completed: '+skillName,{skill:skillName,qa_score:qa.score,iterations,approved:true});
  addHistoryItem(skillName,output,qa);
  addDeliverableCard(skillName,qa.score);
  updateDashStats();
}

// ── Streaming skill call ───────────────────────────────────────────────────────
async function streamSkill(skillName,feedback=null){
  const display=SKILL_NAMES[skillName]||skillName;
  showState('state-executing');
  document.getElementById('exec-label').textContent=display;
  document.getElementById('exec-status-text').textContent='Generating…';
  const heroIcon=document.getElementById('hero-icon');
  if(heroIcon) heroIcon.textContent=SKILL_ICONS[skillName]||'📄';
  const stepLabel=document.getElementById('exec-step-label');
  if(stepLabel){
    const idx=S.todoList.indexOf(skillName);
    stepLabel.textContent=idx>=0?`Step ${idx+1} of ${S.todoList.length}`:'Running';
  }
  const box=document.getElementById('stream-box');
  box.innerHTML='';
  const cursor=document.createElement('span');
  cursor.className='cursor';
  box.appendChild(cursor);
  let accumulated='';

  const body=JSON.stringify({
    api_key:S.apiKey, skill_name:skillName, brief:S.brief,
    context:buildContextForAPI(skillName),
    interview_data:S.interviewData, usability_data:S.usabilityData,
    feedback:feedback, model:S.model
  });

  const resp=await fetch('/api/skill/stream',{method:'POST',headers:{'Content-Type':'application/json'},body});
  if(!resp.ok) throw new Error('Skill API error: '+resp.status);

  const reader=resp.body.getReader();
  const decoder=new TextDecoder();
  let buf='';

  while(true){
    const {done,value}=await reader.read();
    if(done) break;
    buf+=decoder.decode(value,{stream:true});
    const lines=buf.split('\n');
    buf=lines.pop();
    for(const line of lines){
      if(!line.startsWith('data: ')) continue;
      const raw=line.slice(6).trim();
      if(!raw) continue;
      try{
        const msg=JSON.parse(raw);
        if(msg.type==='text'){
          accumulated+=msg.text;
          cursor.insertAdjacentText('beforebegin',msg.text);
          box.scrollTop=box.scrollHeight;
        }else if(msg.type==='done'){
          cursor.remove();
          document.getElementById('exec-status-text').textContent='Complete';
        }else if(msg.type==='error'){
          throw new Error(msg.message);
        }
      }catch(_){}
    }
  }
  return accumulated;
}

// ── QA call ───────────────────────────────────────────────────────────────────
async function runQA(skillName,output){
  return await api('qa',{skill_name:skillName,output,brief:S.brief,context:buildContextForAPI(skillName)});
}

// ── Show review state ─────────────────────────────────────────────────────────
function showReviewState(skillName,output,qa,iterations,escalationReason=null){
  document.getElementById('state-review').classList.remove('view-mode');
  S.viewingSkill=null;
  const _backBtn=document.getElementById('btn-back-to-live');
  if(_backBtn) _backBtn.style.display='none';
  const _saveBtn=document.getElementById('btn-save-rerun');
  if(_saveBtn) _saveBtn.style.display='none';

  showState('state-review');
  const display=SKILL_NAMES[skillName]||skillName;

  // Show escalation banner if this was triggered by auto-QA failure
  const banner=document.getElementById('review-escalation-banner');
  if(banner){
    if(escalationReason){
      banner.textContent=escalationReason;
      banner.style.display='';
    }else{
      banner.style.display='none';
    }
  }
  document.getElementById('review-title').textContent=display;
  document.getElementById('step-num').textContent=S.todoList.indexOf(skillName)+1;
  document.getElementById('step-total').textContent=S.todoList.length;
  updateReviewStrip(skillName);
  updateDashStats();
  rpUpdateBrief();
  rpUpdateBrandDirection();
  rpUpdateIADirection();
  rpUpdateUFDirection();
  updateQASuggestions(qa);

  // Show / hide skill-specific viewers
  const flowCard=document.getElementById('flow-viewer-card');
  const protoCard=document.getElementById('proto-viewer-card');
  if(skillName==='ux_user_flow'){
    if(flowCard){ flowCard.style.display=''; initFlowViewer(output); }
    if(protoCard) protoCard.style.display='none';
  } else if(skillName==='ux_prototype_generator'){
    if(protoCard){ protoCard.style.display=''; initProtoViewer(); }
    if(flowCard) flowCard.style.display='none';
  } else {
    if(flowCard) flowCard.style.display='none';
    if(protoCard) protoCard.style.display='none';
  }

  const outEl=document.getElementById('review-output');
  outEl.innerHTML=renderMd(output);
  postRenderMermaid(outEl);

  const badge=document.getElementById('review-qa-badge');
  badge.className='qa-badge '+qa.score;
  badge.textContent=qa.score==='NEEDS_IMPROVEMENT'?'⚠ Needs Improvement':qa.score==='PASS'?'✅ Pass':'❌ Fail';

  document.getElementById('qa-badge-detail').className='qa-badge '+qa.score;
  document.getElementById('qa-badge-detail').textContent=badge.textContent;
  document.getElementById('qa-alignment').textContent=qa.brief_alignment||'';
  document.getElementById('qa-alignment').className='chip '+(qa.brief_alignment==='ALIGNED'?'green':qa.brief_alignment==='MISALIGNED'?'':'ac');
  document.getElementById('qa-meta').textContent=qa.summary||'';

  const issuesList=document.getElementById('qa-issues');
  issuesList.innerHTML=(qa.issues||[]).map(i=>`<li>${escHtml(i)}</li>`).join('')||'<li style="color:var(--t3)">No issues found</li>';
  const recsList=document.getElementById('qa-recs');
  recsList.innerHTML=(qa.recommendations||[]).map(r=>`<li>${escHtml(r)}</li>`).join('')||'<li style="color:var(--t3)">No recommendations</li>';

  document.getElementById('inp-suggestions').value='';
  document.getElementById('inp-feedback').value='';
  document.getElementById('feedback-area').classList.remove('visible');
}

function showExecutingStatus(msg){
  document.getElementById('exec-status-text').textContent=msg;
}

// ── Approval flow ─────────────────────────────────────────────────────────────
function waitForApproval(){
  return new Promise(resolve=>{ S.approvalResolve=resolve; });
}
function handleApprove(){
  const suggestions=document.getElementById('inp-suggestions').value.trim();
  if(S.approvalResolve) S.approvalResolve({approved:true,userFeedback:suggestions});
}
function handleRevise(){
  document.getElementById('feedback-area').classList.add('visible');
  const feedback=document.getElementById('inp-feedback').value.trim();
  if(!feedback){ document.getElementById('inp-feedback').focus(); toast('Please describe what needs to change.','warn'); return; }
  if(S.approvalResolve) S.approvalResolve({approved:false,userFeedback:feedback});
}

// ── Logbook ───────────────────────────────────────────────────────────────────
async function generateLogbook(){
  setStatus('running','Generating session logbook…');
  showState('state-executing');
  document.getElementById('exec-label').textContent='Session Logbook';
  document.getElementById('exec-status-text').textContent='Reflecting…';
  document.getElementById('stream-box').textContent='Generating agent logbook and learnings…';

  const result=await api('logbook',{entries:S.logbook});
  S.logbookSummary=result.summary||'No summary generated.';

  document.getElementById('logbook-output').innerHTML=renderMd(S.logbookSummary);
  postRenderMermaid(document.getElementById('logbook-output'));
  showState('state-logbook');
  setStatus('done','Logbook ready');
  toast('Design process complete! Review your logbook.','success');
}
function approveLogbook(){
  addLog('LOGBOOK_APPROVED','User approved logbook and learnings',{});
  toast('Learnings saved ✅','success');
  showDone();
}
function skipLogbook(){ showDone(); }
function downloadLogbook(){
  downloadText(S.logbookSummary,'agent-logbook.md','text/markdown');
}

// ── Done state ─────────────────────────────────────────────────────────────────
function showDone(){
  const completed=Object.values(S.skillMeta).filter(m=>m.status==='completed').length;
  const passes=Object.values(S.skillMeta).filter(m=>m.qa&&m.qa.score==='PASS').length;
  const statsEl=document.getElementById('done-stats');
  statsEl.innerHTML=[
    {n:completed,l:'Skills Complete'},
    {n:passes,l:'QA Passes'},
    {n:S.logbook.filter(e=>e.event_type==='LEARNING').length,l:'Learnings'}
  ].map(s=>`<div class="done-stat"><div class="done-stat-n">${s.n}</div><div class="done-stat-l">${s.l}</div></div>`).join('');
  showState('state-done');
  setStatus('done','Complete');
}

async function downloadAll(){
  const outputs=Object.entries(S.context);
  if(!outputs.length){toast('No outputs to download.','warn');return;}
  toast('Building zip — packaging full repo + outputs…','info');

  // Build outputs payload: skill key → markdown content
  const outputsObj={};
  outputs.forEach(([k,v])=>outputsObj[k]=v);

  try{
    const res=await fetch('/api/download-zip',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        project_name: S.projectName||'design-project',
        outputs: outputsObj,
        prototype_html: S.prototypeHtml||null
      })
    });
    if(!res.ok) throw new Error(`Server error ${res.status}`);
    const blob=await res.blob();
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download='product-designer-agent.zip';
    a.click();
    URL.revokeObjectURL(a.href);
    toast('Downloaded ✅  Unzip → git init → git add . → git commit → git push','success');
  }catch(err){
    console.error('Zip download failed:',err);
    toast('Zip failed: '+err.message,'error');
  }
}

function downloadPrototype(){
  if(!S.prototypeHtml){toast('No prototype available.','warn');return;}
  downloadText(S.prototypeHtml,'interactive-prototype.html','text/html');
}

// ── Sidebar rendering ─────────────────────────────────────────────────────────
function renderSidebar(todoList){
  const el=document.getElementById('sidebar-skills');
  el.innerHTML=todoList.map(skill=>{
    const name=SKILL_NAMES[skill]||skill;
    return `<div class="skill-row pending" id="srow-${skill}" onclick="viewSkillOutput('${skill}')">
      <div class="skill-dot pending" id="sdot-${skill}"></div>
      <span class="skill-name">${name}</span>
      <span class="skill-qa hidden" id="sqa-${skill}"></span>
    </div>`;
  }).join('');
}

function setSkillStatus(skill,status,qaScore=null){
  const row=document.getElementById('srow-'+skill);
  const dot=document.getElementById('sdot-'+skill);
  const qa=document.getElementById('sqa-'+skill);
  if(!row) return;
  row.className='skill-row '+status;
  dot.className='skill-dot '+status;
  if(qaScore&&qa){qa.className='skill-qa '+qaScore;qa.textContent=qaScore==='PASS'?'✓':qaScore==='NEEDS_IMPROVEMENT'?'~':'✗';qa.classList.remove('hidden');}
  if(S.skillMeta[skill]) S.skillMeta[skill].status=status;
}

function viewSkillOutput(skill){
  const meta=S.skillMeta[skill];
  if(!meta||!meta.output) return;
  S.viewingSkill=skill;
  showReviewState(skill,meta.output,meta.qa||{score:'PASS',issues:[],recommendations:[]},meta.iterations||1);
  // Switch to view mode
  document.getElementById('state-review').classList.add('view-mode');
  // Reset edit area to preview mode
  const editArea=document.getElementById('review-edit-area');
  const outputDiv=document.getElementById('review-output');
  const editBtn=document.getElementById('btn-edit-toggle');
  const saveBtn=document.getElementById('btn-save-rerun');
  if(editArea){editArea.style.display='none';editArea.value='';}
  if(outputDiv) outputDiv.style.display='';
  if(editBtn) editBtn.textContent='✏️ Edit';
  if(saveBtn) saveBtn.style.display='none';
  // Show back-to-live if agent is running
  const backBtn=document.getElementById('btn-back-to-live');
  if(backBtn) backBtn.style.display=S.isRunning?'':'none';
}

function returnToLive(){
  S.viewingSkill=null;
  showState('state-executing');
}

function toggleEditMode(){
  const editArea=document.getElementById('review-edit-area');
  const outputDiv=document.getElementById('review-output');
  const editBtn=document.getElementById('btn-edit-toggle');
  const saveBtn=document.getElementById('btn-save-rerun');
  const inEditMode=editArea&&editArea.style.display!=='none';
  if(!inEditMode){
    // Enter edit mode
    if(editArea){
      editArea.value=S.context[S.viewingSkill]||'';
      editArea.style.display='';
      editArea.oninput=()=>{
        const changed=editArea.value!==(S.context[S.viewingSkill]||'');
        if(saveBtn) saveBtn.style.display=changed?'':'none';
      };
    }
    if(outputDiv) outputDiv.style.display='none';
    if(editBtn) editBtn.textContent='👁 Preview';
  }else{
    // Exit edit mode — refresh preview
    const newContent=editArea?editArea.value:'';
    if(outputDiv){outputDiv.innerHTML=renderMd(newContent);postRenderMermaid(outputDiv);outputDiv.style.display='';}
    if(editArea) editArea.style.display='none';
    if(editBtn) editBtn.textContent='✏️ Edit';
    const changed=newContent!==(S.context[S.viewingSkill]||'');
    if(saveBtn) saveBtn.style.display=changed?'':'none';
  }
}

async function saveAndRerun(){
  const skill=S.viewingSkill;
  if(!skill){toast('No step selected.','warn');return;}
  const editArea=document.getElementById('review-edit-area');
  // Grab content from edit area if open, otherwise from context
  const inEditMode=editArea&&editArea.style.display!=='none';
  const edited=inEditMode?editArea.value.trim():(S.context[skill]||'').trim();
  if(!edited){toast('Nothing to save.','warn');return;}
  if(S.isRunning){
    if(!confirm('The agent is currently running. Saving will interrupt it and re-run from this point. Continue?')) return;
    S.paused=true;
    await sleep(800);
  }
  const idx=S.todoList.indexOf(skill);
  if(idx<0){toast('Could not find skill in workflow.','error');return;}
  // Save edited content
  S.context[skill]=edited;
  if(S.skillMeta[skill]) S.skillMeta[skill].output=edited;
  // Reset all subsequent skills
  for(let i=idx+1;i<S.todoList.length;i++){
    const s=S.todoList[i];
    setSkillStatus(s,'pending');
    delete S.context[s];
    delete S.skillMeta[s];
  }
  // Recalculate completed count
  S.totalCompleted=S.todoList.slice(0,idx+1).filter(s=>S.skillMeta[s]&&S.skillMeta[s].status==='completed').length;
  updateDashStats();
  updateProgress(S.totalCompleted,S.todoList.length);
  // Rebuild history accordion from remaining completed skills only
  const acc=document.getElementById('history-accordion');
  if(acc){
    acc.innerHTML='';
    S.todoList.slice(0,idx+1).forEach(s=>{
      const m=S.skillMeta[s];
      if(m&&m.status==='completed') addHistoryItem(s,m.output,m.qa);
    });
  }
  S.viewingSkill=null;
  S.paused=false;
  const nextName=S.todoList[idx+1]?(SKILL_NAMES[S.todoList[idx+1]]||S.todoList[idx+1]):'next step';
  toast(`Edits saved — re-running from ${nextName}…`,'info');
  addLog('MANUAL_EDIT',`User edited ${skill} and triggered re-run from index ${idx+1}`,{skill,startIdx:idx+1});
  // Set up running state
  S.isRunning=true;
  const logo=document.getElementById('hdr-logo');
  if(logo) logo.classList.add('running');
  const pb=document.getElementById('btn-pause');
  const rb=document.getElementById('btn-restart');
  if(pb){pb.style.display='';updatePauseBtn();}
  if(rb) rb.style.display='';
  setStatus('running','Resuming workflow…');
  showState('state-executing');
  try{
    await _runSkillLoop(idx+1);
  }catch(e){
    console.error(e);
    toast('Error during re-run: '+e.message,'error');
    setStatus('idle','Error');
    const logoEl=document.getElementById('hdr-logo');
    if(logoEl) logoEl.classList.remove('running');
  }finally{
    S.isRunning=false;
  }
}

function downloadStep(skill){
  if(!skill) return;
  if(skill==='ux_prototype_generator'&&S.prototypeHtml){
    downloadText(S.prototypeHtml,'interactive-prototype.html','text/html');
  }else{
    const content=S.context[skill]||'';
    const safeName=(SKILL_NAMES[skill]||skill).toLowerCase().replace(/[^a-z0-9]+/g,'-');
    downloadText(content,`${safeName}.md`,'text/markdown');
  }
}

// ── History accordion ──────────────────────────────────────────────────────────
function addHistoryItem(skill,output,qa){
  const name=SKILL_NAMES[skill]||skill;
  const acc=document.getElementById('history-accordion');
  const score=qa?qa.score:'?';
  const div=document.createElement('div');
  div.className='history-item';
  div.innerHTML=`
    <div class="history-head" onclick="this.parentElement.classList.toggle('open')">
      <span class="skill-dot completed" style="flex-shrink:0"></span>
      <span class="history-head-name">${name}</span>
      <span class="qa-badge ${score}" style="font-size:10px;padding:2px 8px">${score}</span>
      <span class="history-chevron">▾</span>
    </div>
    <div class="history-body md">${renderMd(output)}</div>`;
  acc.prepend(div);
  postRenderMermaid(div);
}

// ── Progress ──────────────────────────────────────────────────────────────────
function updateProgress(done,total){
  const pct=total>0?Math.round((done/total)*100):0;
  document.getElementById('prog-fill').style.width=pct+'%';
  document.getElementById('prog-label').textContent=`${done} / ${total} steps`;
}
function setStatus(type,text){
  document.getElementById('status-text').textContent=text;
  const dot=document.getElementById('status-dot');
  dot.className='status-dot '+type;
}

// ── Log drawer ────────────────────────────────────────────────────────────────
function addLog(type,desc,data={}){
  const entry={id:S.logbook.length+1,timestamp:new Date().toISOString(),event_type:type,description:desc,data};
  S.logbook.push(entry);
  const countEl=document.getElementById('log-count');
  countEl.textContent=S.logbook.length;
  const entries=document.getElementById('log-entries');
  const time=new Date().toLocaleTimeString();
  const div=document.createElement('div');
  div.className=`log-entry ${type}`;
  div.innerHTML=`<div class="log-entry-type">${type.replace(/_/g,' ')}</div><div class="log-entry-desc">${escHtml(desc)}</div><div class="log-entry-time">${time}</div>`;
  entries.prepend(div);
}
let logOpen=false;
function toggleLogDrawer(){
  logOpen=!logOpen;
  document.getElementById('log-drawer').classList.toggle('open',logOpen);
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function toast(msg,type='info'){
  const icons={info:'ℹ️',success:'✅',error:'❌',warn:'⚠️'};
  const el=document.createElement('div');
  el.className=`toast ${type}`;
  el.textContent=icons[type]+' '+msg;
  document.getElementById('toasts').prepend(el);
  setTimeout(()=>{ el.classList.add('out'); setTimeout(()=>el.remove(),300); },3500);
}

// ── API helper ────────────────────────────────────────────────────────────────
async function api(endpoint,body){
  const res=await fetch(`/api/${endpoint}`,{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({...body,api_key:S.apiKey,model:S.model})
  });
  if(!res.ok){ const t=await res.text(); throw new Error(`API error ${res.status}: ${t}`); }
  return res.json();
}

// ── Markdown rendering ────────────────────────────────────────────────────────
function renderMd(text){
  if(!text) return '';
  marked.setOptions({breaks:true,gfm:true});
  let html=marked.parse(text);
  html=html.replace(/<pre><code class="language-mermaid">([\s\S]*?)<\/code><\/pre>/g,
    (_,code)=>`<div class="mermaid">${unescHtml(code)}</div>`);
  return html;
}
async function postRenderMermaid(container){
  const nodes=container.querySelectorAll('.mermaid');
  if(nodes.length) try{ await mermaid.run({nodes}); }catch(e){ console.warn('Mermaid error:',e); }
}
function unescHtml(s){ const t=document.createElement('textarea'); t.innerHTML=s; return t.value; }
function escHtml(s){ const t=document.createElement('textarea'); t.textContent=s; return t.innerHTML; }

// ── Context builder ───────────────────────────────────────────────────────────
function buildContextForAPI(currentSkill){
  const ctx={};
  for(const s of SKILL_SEQ){
    if(s===currentSkill) break;
    if(S.context[s]) ctx[s]=S.context[s];
  }
  return ctx;
}

// ── Prototype HTML extractor & splitter ───────────────────────────────────────
// Pulls the raw HTML out of the prototype skill's markdown output.
// The skill wraps the prototype in a ```html ... ``` code block.
function extractPrototypeHtml(markdownOutput){
  // Match fenced ```html ... ``` block — pick the longest one (full prototype)
  const matches=[...markdownOutput.matchAll(/```html\s*([\s\S]*?)```/gi)];
  if(matches.length){
    return matches.reduce((a,b)=>b[1].length>a[1].length?b:a)[1].trim();
  }
  // Fallback: output itself is raw HTML
  const stripped=markdownOutput.trim();
  if(/^<!DOCTYPE|^<html/i.test(stripped)) return stripped;
  return null;
}

// Splits a self-contained prototype HTML into { html, css, js }.
// The returned html references prototype-styles.css and prototype-scripts.js.
function splitPrototype(htmlString){
  // Extract all <style> blocks
  const cssBlocks=[];
  let htmlNoCss=htmlString.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi,(_,c)=>{
    cssBlocks.push(c.trim()); return '';
  });

  // Extract all inline <script> blocks (skip those with a src= attribute)
  const jsBlocks=[];
  let htmlNoJs=htmlNoCss.replace(/<script(?![^>]*\bsrc\b)[^>]*>([\s\S]*?)<\/script>/gi,(_,c)=>{
    jsBlocks.push(c.trim()); return '';
  });

  const css=cssBlocks.join('\n\n');
  const js=jsBlocks.join('\n\n');

  // Inject external file references back into the HTML
  let html=htmlNoJs
    .replace(/(<\/head>)/i,`  <link rel="stylesheet" href="prototype-styles.css">\n$1`)
    .replace(/(<\/body>)/i,`  <script src="prototype-scripts.js"><\/script>\n$1`);

  return {html, css, js};
}

// ── Download helpers ──────────────────────────────────────────────────────────
function downloadCurrent(){
  const skill=S.todoList[S.currentSkillIdx]||'output';
  if(skill==='ux_prototype_generator'&&S.prototypeHtml){
    downloadText(S.prototypeHtml,'interactive-prototype.html','text/html');
  }else{
    downloadText(S.context[skill]||'',skill+'.md','text/markdown');
  }
}
function copyCurrent(){
  const skill=S.todoList[S.currentSkillIdx]||'output';
  navigator.clipboard.writeText(S.context[skill]||'').then(()=>toast('Copied to clipboard!','success'));
}
function downloadText(text,filename,mime='text/plain'){
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([text],{type:mime}));
  a.download=filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ── Utility ───────────────────────────────────────────────────────────────────
function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }

// ── Right panel: brief ────────────────────────────────────────────────────────
function rpUpdateBrief(){
  const el=document.getElementById('rpBriefRead');
  if(el) el.textContent=S.brief||'No brief entered.';
  const ta=document.getElementById('rpBriefTextarea');
  if(ta) ta.value=S.brief||'';
}
function rpEditBrief(){
  document.getElementById('rpBriefRead').style.display='none';
  document.getElementById('rpBriefEdit').style.display='block';
  document.getElementById('rpBriefBody').style.maxHeight='300px';
  document.getElementById('rpBriefEditBtn').style.visibility='hidden';
  document.getElementById('rpBriefTextarea').focus();
}
function rpSaveBrief(){
  const newBrief=document.getElementById('rpBriefTextarea').value.trim();
  if(newBrief) S.brief=newBrief;
  rpUpdateBrief();
  _rpCloseBriefEdit();
}
function rpCancelBrief(){ _rpCloseBriefEdit(); }
function _rpCloseBriefEdit(){
  document.getElementById('rpBriefRead').style.display='block';
  document.getElementById('rpBriefEdit').style.display='none';
  document.getElementById('rpBriefBody').style.maxHeight='300px';
  document.getElementById('rpBriefEditBtn').style.visibility='visible';
}
function rpToggleBrief(){
  const body=document.getElementById('rpBriefBody');
  const btn=document.getElementById('rpCollapseBtn');
  const isOpen=btn.getAttribute('aria-expanded')==='true';
  body.style.maxHeight=isOpen?'0px':'300px';
  btn.textContent=isOpen?'▸':'▾';
  btn.setAttribute('aria-expanded',String(!isOpen));
}

// ── Brand Direction right-panel card ─────────────────────────────────────────
function rpUpdateBrandDirection(){
  const card=document.getElementById('rp-brand-direction');
  if(!card) return;
  if(!S.brandIntakeSelections){ card.style.display='none'; return; }
  card.style.display='';
  const sel=S.brandIntakeSelections;
  const rows=[];
  if(sel.q1&&sel.q1.length) rows.push({l:'World',v:sel.q1.map(v=>v.split('(')[0].trim()).join(', ')});
  if(sel.q2&&sel.q2.length) rows.push({l:'Avoid',v:sel.q2.map(v=>v.split('—')[0].trim()).join(', ')});
  if(sel.q3) rows.push({l:'Type',v:sel.q3.split('—')[0].trim()});
  if(sel.q4) rows.push({l:'Colour',v:sel.q4.split('—')[0].trim()});
  if(sel.q5) rows.push({l:'Density',v:sel.q5.split('—')[0].trim()});
  if(sel.q6) rows.push({l:'Never',v:`"${sel.q6}"`});
  const body=document.getElementById('rp-brand-direction-body');
  if(body) body.innerHTML=rows.map(r=>`<div class="rp-bd-row"><span class="rp-bd-label">${escHtml(r.l)}</span><span class="rp-bd-value">${escHtml(r.v)}</span></div>`).join('');
}

function editBrandDirection(){
  showBrandIntake().then(answers=>{
    S.brandIntakeContext=answers;
    toast('Brand direction updated. Changes apply to the next skill run.','success');
  });
}

// ── Approve bar: changes panel toggle ────────────────────────────────────────
function toggleApproveChanges(){
  const panel=document.getElementById('approve-changes-panel');
  const btn=document.getElementById('approve-changes-toggle');
  const isOpen=panel.classList.contains('open');
  panel.classList.toggle('open');
  btn.classList.toggle('active',!isOpen);
  btn.textContent=isOpen?'⚠ Changes ▾':'⚠ Changes ▴';
}

// ── QA suggestions chips ──────────────────────────────────────────────────────
function updateQASuggestions(qa){
  const row=document.getElementById('qa-suggestions-row');
  const chipsEl=document.getElementById('qa-chips-row');
  if(!row||!chipsEl) return;
  const items=(qa.recommendations||[]).slice(0,4);
  if(items.length===0){ row.style.display='none'; return; }
  row.style.display='block';
  chipsEl.innerHTML=items.map((r,i)=>`<button class="qa-chip-btn" onclick="applyQAChip(this,'${escHtml(r)}')">${escHtml(r.length>40?r.slice(0,38)+'…':r)}</button>`).join('');
}
function applyQAChip(el,text){
  if(el.disabled) return;
  el.classList.add('applied');
  el.textContent='✓ '+el.textContent;
  el.disabled=true;
  const ta=document.getElementById('inp-suggestions');
  if(ta) ta.value=(ta.value?ta.value+'\n':'')+text;
}

// ── Direct edit mode on output ────────────────────────────────────────────────
let _directEditOrig='';
function toggleEditMode(){
  const out=document.getElementById('review-output');
  const banner=document.getElementById('editModeBanner');
  const btn=document.getElementById('btn-edit-toggle');
  if(!out||!banner) return;
  const isEditing=out.contentEditable==='true';
  if(!isEditing){
    _directEditOrig=out.innerHTML;
    out.contentEditable='true';
    out.focus();
    banner.classList.add('visible');
    if(btn){ btn.classList.add('active'); btn.textContent='✎ Editing…'; }
  } else { _exitDirectEdit(); }
}
function saveDirectEdit(){ _exitDirectEdit(); }
function discardDirectEdit(){
  const out=document.getElementById('review-output');
  if(out) out.innerHTML=_directEditOrig;
  _exitDirectEdit();
}
function _exitDirectEdit(){
  const out=document.getElementById('review-output');
  const banner=document.getElementById('editModeBanner');
  const btn=document.getElementById('btn-edit-toggle');
  if(out) out.contentEditable='false';
  if(banner) banner.classList.remove('visible');
  if(btn){ btn.classList.remove('active'); btn.textContent='✎ Edit'; }
}

// ── Brand Intake Modal ─────────────────────────────────────────────────────────
let _brandIntakeResolve=null;

function showBrandIntake(){
  return new Promise(resolve=>{
    _brandIntakeResolve=resolve;
    // Reset all selections first
    document.querySelectorAll('.bi-opt').forEach(b=>b.classList.remove('sel'));
    document.querySelectorAll('.bi-text-input').forEach(i=>{ i.value=''; if(i.id!=='bi-q6') i.style.display='none'; });
    // Pre-populate from saved selections if editing
    if(S.brandIntakeSelections){
      const sel=S.brandIntakeSelections;
      // Q1, Q2 (multi)
      ['q1','q2'].forEach(q=>{
        const vals=sel[q]||[];
        vals.forEach(v=>{
          const btn=document.querySelector(`.bi-opt[data-q="${q}"][data-v="${v}"]`);
          if(btn) btn.classList.add('sel');
          // Show "other" text if needed
          const otherBtn=document.querySelector(`.bi-opt-other[data-q="${q}"]`);
          if(otherBtn && otherBtn.classList.contains('sel') && otherBtn.dataset.target){
            const inp=document.getElementById(otherBtn.dataset.target);
            if(inp){ inp.style.display=''; inp.value=sel[q+'_other']||''; }
          }
        });
      });
      // Q3, Q4, Q5 (single)
      ['q3','q4','q5'].forEach(q=>{
        if(sel[q]){
          const btn=document.querySelector(`.bi-opt[data-q="${q}"][data-v="${sel[q]}"]`);
          if(btn) btn.classList.add('sel');
        }
      });
      // Q6
      const q6=document.getElementById('bi-q6');
      if(q6 && sel.q6) q6.value=sel.q6;
    }
    document.getElementById('brand-intake-overlay').style.display='flex';
    const body=document.querySelector('.bi-body');
    if(body) body.scrollTop=0;
    // Wire up option buttons
    document.querySelectorAll('.bi-opt').forEach(btn=>{
      btn.onclick=null;
      btn.addEventListener('click',_biHandleOpt,{once:false});
    });
  });
}

function _biHandleOpt(e){
  const btn=e.currentTarget;
  const q=btn.dataset.q;
  const v=btn.dataset.v;
  const isSingle=btn.closest('.bi-single');
  const isOther=btn.classList.contains('bi-opt-other');
  const targetId=btn.dataset.target;

  if(isSingle){
    // Deselect all in this group, select only this one
    btn.closest('.bi-options').querySelectorAll('.bi-opt').forEach(b=>b.classList.remove('sel'));
    btn.classList.add('sel');
  } else {
    // Multi: enforce max 2 for Q1
    const selected=btn.closest('.bi-options').querySelectorAll('.bi-opt.sel');
    if(!btn.classList.contains('sel') && q==='q1' && selected.length>=2) return;
    btn.classList.toggle('sel');
  }

  // Show/hide "other" text input
  if(isOther && targetId){
    const input=document.getElementById(targetId);
    if(input) input.style.display=btn.classList.contains('sel')?'':'none';
  }
}

function submitBrandIntake(){
  const q6=document.getElementById('bi-q6').value.trim();
  if(!q6){ document.getElementById('bi-q6').focus(); toast('Please complete the last question.','warn'); return; }

  const collectVals=(groupId,otherId)=>{
    const vals=[], otherVals=[];
    document.querySelectorAll(`#${groupId} .bi-opt.sel`).forEach(b=>{
      if(b.dataset.v==='other'){
        const t=otherId?document.getElementById(otherId).value.trim():'';
        if(t) otherVals.push(t);
      } else { vals.push(b.dataset.v); }
    });
    return {vals:[...vals,...otherVals], other:otherVals[0]||''};
  };

  const r1=collectVals('bi-q1','bi-q1-other');
  const r2=collectVals('bi-q2','bi-q2-other');
  const r3=collectVals('bi-q3',null);
  const r4=collectVals('bi-q4',null);
  const r5=collectVals('bi-q5',null);

  // Save raw selections so modal can be pre-populated on edit
  S.brandIntakeSelections={
    q1: document.querySelectorAll('#bi-q1 .bi-opt.sel:not(.bi-opt-other)').length
      ? [...document.querySelectorAll('#bi-q1 .bi-opt.sel:not(.bi-opt-other)')].map(b=>b.dataset.v) : [],
    q1_other: r1.other,
    q2: document.querySelectorAll('#bi-q2 .bi-opt.sel:not(.bi-opt-other)').length
      ? [...document.querySelectorAll('#bi-q2 .bi-opt.sel:not(.bi-opt-other)')].map(b=>b.dataset.v) : [],
    q2_other: r2.other,
    q3: r3.vals[0]||'',
    q4: r4.vals[0]||'',
    q5: r5.vals[0]||'',
    q6
  };

  const lines=[
    '=== BRAND DIRECTION (from user — apply these constraints strictly) ===',
    '',
    r1.vals.length ? `Brand world / mood reference: ${r1.vals.join(', ')}` : null,
    r2.vals.length ? `Aesthetics to AVOID (do NOT use these): ${r2.vals.join(', ')}` : null,
    r3.vals.length ? `Typography feel: ${r3.vals[0]}` : null,
    r4.vals.length ? `Colour quality: ${r4.vals[0]}` : null,
    r5.vals.length ? `Information density: ${r5.vals[0]}` : null,
    `Must never be mistaken for: "${q6}"`,
    '',
    'These are hard constraints. Do not default to purple, violet, or generic dark-mode AI aesthetics unless explicitly aligned with the answers above.',
    '=================================================================',
  ].filter(l=>l!==null).join('\n');

  S.brandIntakeContext=lines;

  document.getElementById('brand-intake-overlay').style.display='none';
  rpUpdateBrandDirection();

  if(_brandIntakeResolve){ _brandIntakeResolve(lines); _brandIntakeResolve=null; }
  else { toast('Brand direction saved.','success'); }
}

// ── IA Navigation Intake Modal ─────────────────────────────────────────────────
let _iaIntakeResolve=null;

function showIAIntake(){
  return new Promise(resolve=>{
    _iaIntakeResolve=resolve;
    // Reset
    document.querySelectorAll('#ia-intake-overlay .bi-opt').forEach(b=>b.classList.remove('sel'));
    const q1other=document.getElementById('ia-q1-other');
    const q2=document.getElementById('ia-q2');
    if(q1other){ q1other.style.display='none'; q1other.value=''; }
    if(q2) q2.value='';
    // Pre-populate from saved selections
    if(S.iaIntakeSelections){
      const sel=S.iaIntakeSelections;
      (sel.q1||[]).forEach(v=>{
        const btn=document.querySelector(`#ia-intake-overlay .bi-opt[data-q="ia-q1"][data-v="${v}"]`);
        if(btn) btn.classList.add('sel');
      });
      const otherBtn=document.querySelector('#ia-intake-overlay .bi-opt-other[data-q="ia-q1"]');
      if(otherBtn && sel.q1_other){
        otherBtn.classList.add('sel');
        if(q1other){ q1other.style.display=''; q1other.value=sel.q1_other; }
      }
      if(q2 && sel.q2) q2.value=sel.q2;
    }
    document.getElementById('ia-intake-overlay').style.display='flex';
    const body=document.querySelector('#ia-intake-overlay .bi-body');
    if(body) body.scrollTop=0;
    // Wire option buttons
    document.querySelectorAll('#ia-intake-overlay .bi-opt').forEach(btn=>{
      btn.onclick=null;
      btn.addEventListener('click',_iaHandleOpt,{once:false});
    });
  });
}

function _iaHandleOpt(e){
  const btn=e.currentTarget;
  const isOther=btn.classList.contains('bi-opt-other');
  const targetId=btn.dataset.target;
  btn.classList.toggle('sel');
  if(isOther && targetId){
    const input=document.getElementById(targetId);
    if(input) input.style.display=btn.classList.contains('sel')?'':'none';
  }
}

function submitIAIntake(){
  const q2val=document.getElementById('ia-q2').value.trim();
  if(!q2val){ document.getElementById('ia-q2').focus(); toast('Please name a navigation anti-reference.','warn'); return; }

  const q1vals=[];
  let q1other='';
  document.querySelectorAll('#ia-q1 .bi-opt.sel').forEach(b=>{
    if(b.dataset.v==='other'){
      q1other=document.getElementById('ia-q1-other').value.trim();
      if(q1other) q1vals.push(q1other);
    } else { q1vals.push(b.dataset.v); }
  });

  // Save raw selections for re-edit
  S.iaIntakeSelections={
    q1:[...document.querySelectorAll('#ia-q1 .bi-opt.sel:not(.bi-opt-other)')].map(b=>b.dataset.v),
    q1_other: q1other,
    q2: q2val
  };

  const lines=[
    '=== NAVIGATION DIRECTION (from user — apply these constraints strictly) ===',
    '',
    q1vals.length ? `Navigation pattern(s) the user wants: ${q1vals.join(', ')}` : 'Navigation pattern: not specified — infer from user flow and research',
    `Navigation must NEVER feel like: ${q2val}`,
    '',
    'Design the navigation model around these constraints. Do not default to a standard tab bar or sidebar unless it is explicitly listed above.',
    '=================================================================',
  ].join('\n');

  S.iaIntakeContext=lines;
  document.getElementById('ia-intake-overlay').style.display='none';
  rpUpdateIADirection();

  if(_iaIntakeResolve){ _iaIntakeResolve(lines); _iaIntakeResolve=null; }
  else { toast('Navigation direction saved.','success'); }
}

function rpUpdateIADirection(){
  const card=document.getElementById('rp-ia-direction');
  if(!card) return;
  if(!S.iaIntakeSelections){ card.style.display='none'; return; }
  card.style.display='';
  const sel=S.iaIntakeSelections;
  const rows=[];
  const navVals=[...(sel.q1||[])];
  if(sel.q1_other) navVals.push(sel.q1_other);
  if(navVals.length) rows.push({l:'Nav',v:navVals.map(v=>v.split('—')[0].split('(')[0].trim()).join(', ')});
  if(sel.q2) rows.push({l:'Never',v:`"${sel.q2}"`});
  const body=document.getElementById('rp-ia-direction-body');
  if(body) body.innerHTML=rows.map(r=>`<div class="rp-bd-row"><span class="rp-bd-label">${escHtml(r.l)}</span><span class="rp-bd-value">${escHtml(r.v)}</span></div>`).join('');
}

function editIADirection(){
  showIAIntake().then(answers=>{
    S.iaIntakeContext=answers;
    toast('Navigation direction updated. Changes apply to the next skill run.','success');
  });
}

// ── User Flow Entry Point Intake Modal ────────────────────────────────────────
let _ufIntakeResolve=null;

async function showUserFlowIntake(){
  return new Promise(async resolve=>{
    _ufIntakeResolve=resolve;
    // Reset Q2
    const q2=document.getElementById('uf-q2');
    if(q2) q2.value='';
    // Show modal immediately
    document.getElementById('uf-intake-overlay').style.display='flex';
    const body=document.querySelector('#uf-intake-overlay .bi-body');
    if(body) body.scrollTop=0;
    // Pre-populate Q2 if editing
    if(S.ufIntakeSelections && q2) q2.value=S.ufIntakeSelections.q2||'';
    // Load entry point options into Q1
    const q1=document.getElementById('uf-q1');
    if(q1){
      if(S.ufIntakeSelections && S.ufIntakeSelections._options && S.ufIntakeSelections._options.length){
        // Re-use cached options so we don't re-fetch on edit
        _ufRenderOptions(q1,S.ufIntakeSelections._options,S.ufIntakeSelections.q1||[]);
      } else {
        // Show animated skeleton while fetching
        q1.innerHTML='<div class="bi-loading-skeleton">'
          +['120px','90px','150px','85px','115px','105px'].map(w=>`<div class="bi-skel-pill" style="width:${w}"></div>`).join('')
          +'</div>';
        try{
          const res=await fetch('/api/suggest-entry-points',{
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({api_key:S.apiKey,brief:S.brief,context:buildContextForAPI('ux_user_flow'),model:S.model})
          });
          const data=await res.json();
          _ufRenderOptions(q1,data.options||[],[]);
        }catch(err){
          console.warn('Entry point suggestion failed, using fallback:',err);
          _ufRenderOptions(q1,[
            'Open the app directly',
            'Tap a push notification',
            'Follow a link from a message',
            'Tap a home screen widget',
            'Follow steps the app suggests',
            'Already in the app, switching task',
          ],[]);
        }
      }
    }
  });
}

function _ufRenderOptions(container,options,selectedVals){
  container.innerHTML='';
  // Store the options list on the container for later save
  container.dataset.options=JSON.stringify(options);
  options.forEach(opt=>{
    const btn=document.createElement('button');
    btn.className='bi-opt'+(selectedVals.includes(opt)?' sel':'');
    btn.dataset.q='uf-q1';
    btn.dataset.v=opt;
    btn.textContent=opt;
    btn.addEventListener('click',_ufHandleOpt);
    container.appendChild(btn);
  });
}

function _ufHandleOpt(e){
  e.currentTarget.classList.toggle('sel');
}

function submitUserFlowIntake(){
  const q2val=document.getElementById('uf-q2').value.trim();
  if(!q2val){ document.getElementById('uf-q2').focus(); toast('Please name a flow anti-reference.','warn'); return; }

  const q1container=document.getElementById('uf-q1');
  const allOptions=q1container.dataset.options?JSON.parse(q1container.dataset.options):[];
  const q1vals=[];
  q1container.querySelectorAll('.bi-opt.sel').forEach(b=>q1vals.push(b.dataset.v));

  // Save raw selections so the modal can be pre-populated on re-edit
  S.ufIntakeSelections={
    q1: q1vals,
    q2: q2val,
    _options: allOptions
  };

  const lines=[
    '=== USER FLOW DIRECTION (from user — apply these constraints strictly) ===',
    '',
    q1vals.length
      ? `Entry point(s) to map in this flow: ${q1vals.join(', ')}`
      : 'Entry point: infer from research — do not default to generic Onboarding/Login',
    `Flow must NEVER feel like it starts the same way as: ${q2val}`,
    '',
    'Map the user flow starting from the specified entry point(s). Do not default to Onboarding → Login as the first nodes unless explicitly listed above.',
    '=================================================================',
  ].join('\n');

  S.ufIntakeContext=lines;
  document.getElementById('uf-intake-overlay').style.display='none';
  rpUpdateUFDirection();

  if(_ufIntakeResolve){ _ufIntakeResolve(lines); _ufIntakeResolve=null; }
  else { toast('Flow direction saved.','success'); }
}

function rpUpdateUFDirection(){
  const card=document.getElementById('rp-uf-direction');
  if(!card) return;
  if(!S.ufIntakeSelections){ card.style.display='none'; return; }
  card.style.display='';
  const sel=S.ufIntakeSelections;
  const rows=[];
  if(sel.q1&&sel.q1.length) rows.push({l:'Start',v:sel.q1.join(', ')});
  if(sel.q2) rows.push({l:'Never',v:`"${sel.q2}"`});
  const body=document.getElementById('rp-uf-direction-body');
  if(body) body.innerHTML=rows.map(r=>`<div class="rp-bd-row"><span class="rp-bd-label">${escHtml(r.l)}</span><span class="rp-bd-value">${escHtml(r.v)}</span></div>`).join('');
}

function editUFDirection(){
  showUserFlowIntake().then(answers=>{
    S.ufIntakeContext=answers;
    toast('Flow direction updated. Changes apply to the next skill run.','success');
  });
}

// ── Flow Viewer ────────────────────────────────────────────────────────────────
function initFlowViewer(output){
  const canvas=document.getElementById('flow-canvas-area');
  if(!canvas) return;
  // Try to extract a mermaid block from the markdown output
  const mermaidMatch=output.match(/```mermaid\n([\s\S]*?)```/);
  if(mermaidMatch && typeof mermaid!=='undefined'){
    const code=mermaidMatch[1].trim();
    const div=document.createElement('div');
    div.className='mermaid';
    div.textContent=code;
    canvas.innerHTML='';
    canvas.appendChild(div);
    mermaid.init(undefined, div);
  } else {
    // Fallback: render full markdown (which will trigger postRenderMermaid)
    canvas.innerHTML='<div class="md">'+renderMd(output)+'</div>';
    postRenderMermaid(canvas);
  }
}

function downloadFlowSvg(){
  const svg=document.querySelector('#flow-canvas-area svg');
  if(!svg){ toast('No SVG diagram available yet.','warn'); return; }
  const blob=new Blob([svg.outerHTML],{type:'image/svg+xml'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='user-flow.svg';
  a.click();
  URL.revokeObjectURL(a.href);
}

// ── Prototype Viewer ───────────────────────────────────────────────────────────
let _protoBlobUrl=null;

function initProtoViewer(){
  const iframe=document.getElementById('proto-iframe');
  if(!iframe) return;
  // Revoke previous blob URL
  if(_protoBlobUrl){ URL.revokeObjectURL(_protoBlobUrl); _protoBlobUrl=null; }
  if(S.prototypeHtml){
    const blob=new Blob([S.prototypeHtml],{type:'text/html'});
    _protoBlobUrl=URL.createObjectURL(blob);
    iframe.src=_protoBlobUrl;
  } else {
    // Prototype HTML not extracted yet — show placeholder
    iframe.src='about:blank';
    iframe.contentDocument&&(iframe.contentDocument.body.innerHTML='<div style="font:13px sans-serif;color:#666;padding:20px">Prototype loading…</div>');
  }
  // Update clock
  const clock=document.getElementById('proto-clock');
  if(clock){ const n=new Date(); clock.textContent=`${n.getHours()}:${String(n.getMinutes()).padStart(2,'0')}`; }
  // Init welcome message in chat
  const msgs=document.getElementById('protoChatMessages');
  if(msgs && msgs.children.length===0){
    const name=S.projectName||'your product';
    msgs.innerHTML=`<div class="proto-msg agent"><div class="proto-msg-bubble">Your <strong>${escHtml(name)}</strong> prototype is ready! Browse all screens, then tell me what you'd like to change. 🎨</div><div class="proto-msg-time">Just now</div></div>`;
  }
}

const _PROTO_REPLIES=[
  'Done! Applied that change — refresh the prototype to see it ✓',
  'Great idea! I\'ve noted your feedback. Hit Revise below to regenerate with it applied.',
  'Change noted ✓ — click Revise & Continue to rebuild the prototype with this update.',
  'Updated! Navigate through the screens to review it 🎨',
  'Noted that change. Use the Revise button below to regenerate with your suggestion.',
];

function sendProtoChat(){
  const input=document.getElementById('protoChatInput');
  const msgs=document.getElementById('protoChatMessages');
  if(!input||!msgs) return;
  const text=input.value.trim();
  if(!text) return;
  const n=new Date(); const t=`${n.getHours()}:${String(n.getMinutes()).padStart(2,'0')}`;
  // User bubble
  const uMsg=document.createElement('div');
  uMsg.className='proto-msg user';
  uMsg.innerHTML=`<div class="proto-msg-bubble">${escHtml(text)}</div><div class="proto-msg-time">${t}</div>`;
  msgs.appendChild(uMsg);
  input.value='';
  msgs.scrollTop=msgs.scrollHeight;
  // Typing indicator
  const typing=document.createElement('div');
  typing.className='proto-msg agent';
  typing.innerHTML='<div class="proto-msg-bubble" style="color:var(--t3)">…</div>';
  msgs.appendChild(typing);
  msgs.scrollTop=msgs.scrollHeight;
  // Reply after short delay
  setTimeout(()=>{
    typing.remove();
    const reply=_PROTO_REPLIES[Math.floor(Math.random()*_PROTO_REPLIES.length)];
    const aMsg=document.createElement('div');
    aMsg.className='proto-msg agent';
    aMsg.innerHTML=`<div class="proto-msg-bubble">${escHtml(reply)}</div><div class="proto-msg-time">${t}</div>`;
    msgs.appendChild(aMsg);
    msgs.scrollTop=msgs.scrollHeight;
    // Pre-fill the suggestions field so user can just click Revise
    const sugg=document.getElementById('inp-suggestions');
    if(sugg && !sugg.value) sugg.value=text;
    toast('Change noted — click ⚠ Changes or Revise to regenerate.','info');
  }, 900);
}

// ── Thought starter rotation ───────────────────────────────────────────────────
const _thoughts=[
  'What\'s one thing your users most want to complete faster?',
  'Which competitor feature do your target users secretly love?',
  'What would a first-time user be confused about on screen 1?',
  'What emotion do you want users to feel when they first open the app?',
  'If you removed 50% of features, which half would users keep?',
  'What\'s the most common support ticket you\'d get at launch?',
  'Which user need is so obvious it\'s easy to forget?',
  'What would make a user recommend this to a friend unprompted?',
];
let _thoughtIdx=0;
setInterval(()=>{
  const el=document.getElementById('rp-thought-q');
  if(!el) return;
  el.style.opacity='0';
  setTimeout(()=>{
    _thoughtIdx=(_thoughtIdx+1)%_thoughts.length;
    el.textContent=_thoughts[_thoughtIdx];
    el.style.opacity='1';
  },400);
},8000);

// ── Enter key shortcuts ───────────────────────────────────────────────────────
document.getElementById('inp-key').addEventListener('keydown',e=>{ if(e.key==='Enter') goToBrief(); });
document.getElementById('inp-project').addEventListener('keydown',e=>{ if(e.key==='Enter') goToBrief(); });
