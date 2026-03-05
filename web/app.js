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
  prototypeHtml:null
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

    for(let i=0;i<S.todoList.length;i++){
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

  }catch(e){
    console.error(e);
    toast('An error occurred: '+e.message,'error');
    setStatus('idle','Error');
    const logoEl2=document.getElementById('hdr-logo');
    if(logoEl2) logoEl2.classList.remove('running');
  }
}

function shouldSkip(skill){
  if(skill==='ux_interview_guide' && S.interviewData) return true;
  if(skill==='simulated_interviewee' && !S.useSimulatedInterviews) return true;
  if(skill==='simulated_usability_participant' && !S.useSimulatedUsability) return true;
  return false;
}

// ── Execute skill + QA + approval loop ────────────────────────────────────────
async function executeSkillAndApprove(skillName){
  const display=SKILL_NAMES[skillName]||skillName;
  setSkillStatus(skillName,'running');
  S.currentSkillIdx=S.todoList.indexOf(skillName);
  setStatus('running','Running: '+display);
  addLog('SKILL_START','Started: '+skillName,{skill:skillName});

  let iterations=0;
  let feedback=null;

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

    showReviewState(skillName,output,qa,iterations);
    const {approved,userFeedback}=await waitForApproval();
    if(userFeedback) addLog('USER_SUGGESTION','User suggestion for '+skillName,{feedback:userFeedback});

    if(approved){
      S.totalCompleted++;
      setSkillStatus(skillName,'completed',qa.score);
      // Extract and store prototype HTML so it can be saved as .html in the zip
      if(skillName==='ux_prototype_generator'){
        const html=extractPrototypeHtml(output);
        if(html){
          S.prototypeHtml=html;
          // Show dedicated prototype download button on Done screen
          const pb=document.getElementById('btn-dl-prototype');
          if(pb) pb.style.display='';
        }
      }
      addLog('SKILL_COMPLETE','Completed: '+skillName,{skill:skillName,qa_score:qa.score,iterations,approved:true});
      addHistoryItem(skillName,output,qa);
      addDeliverableCard(skillName,qa.score);
      updateDashStats();
      toast(display+' approved ✅','success');
      break;
    }else{
      feedback=userFeedback;
      addLog('ITERATION','Revision requested for '+skillName,{reason:feedback});
      setSkillStatus(skillName,'running');
      toast('Revising '+display+'…','warn');
    }
  }
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
function showReviewState(skillName,output,qa,iterations){
  showState('state-review');
  const display=SKILL_NAMES[skillName]||skillName;
  document.getElementById('review-title').textContent=display;
  document.getElementById('step-num').textContent=S.todoList.indexOf(skillName)+1;
  document.getElementById('step-total').textContent=S.todoList.length;
  updateReviewStrip(skillName);
  updateDashStats();

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
  showReviewState(skill,meta.output,meta.qa||{score:'PASS',issues:[],recommendations:[]},meta.iterations||1);
  document.getElementById('btn-approve').disabled=true;
  document.getElementById('btn-revise').disabled=true;
  setTimeout(()=>{ document.getElementById('btn-approve').disabled=false; document.getElementById('btn-revise').disabled=false; },100);
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

// ── Enter key shortcuts ───────────────────────────────────────────────────────
document.getElementById('inp-key').addEventListener('keydown',e=>{ if(e.key==='Enter') goToBrief(); });
document.getElementById('inp-project').addEventListener('keydown',e=>{ if(e.key==='Enter') goToBrief(); });
