// ═══════════════════════════════════════════════════════
//  MY WORKOUT — app logic
// ═══════════════════════════════════════════════════════

// ── SUPABASE ──
const SB_URL='https://nfvkxfmcyyxvdnyinvvu.supabase.co';
const SB_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5mdmt4Zm1jeXl4dmRueWludnZ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5NDY2MzAsImV4cCI6MjA5NDUyMjYzMH0.8I5timGc5AjKAPsOrJdMKD1P8j57iy-voi2D1lkgi2o';
const SB_HDR={'apikey':SB_KEY,'Authorization':'Bearer '+SB_KEY,'Content-Type':'application/json'};

async function sbSet(key,value){
  try{const r=await fetch(`${SB_URL}/rest/v1/workout_data`,{method:'POST',headers:{...SB_HDR,'Prefer':'resolution=merge-duplicates'},body:JSON.stringify({key,value,updated_at:new Date().toISOString()})});return r.ok;}catch(e){return false;}
}
async function sbGetAll(){
  try{const r=await fetch(`${SB_URL}/rest/v1/workout_data?select=key,value`,{headers:SB_HDR});if(!r.ok)return null;const d=await r.json();const o={};d.forEach(x=>o[x.key]=x.value);return o;}catch(e){return null;}
}

// ── DEFAULT PROGRAM ──
const DEFAULT_PROGRAM=[
  {id:'upper_strength',title:'Upper Strength',exercises:[
    {id:'chest_press_30',name:'30° Chest Press',target:'4 × 6–8',sets:4,rMin:6,rMax:8},
    {id:'barbell_row',name:'Barbell Row',target:'4 × 6–8',sets:4,rMin:6,rMax:8},
    {id:'cgp_smith',name:'Smith CG Press',target:'3 × 6–8',sets:3,rMin:6,rMax:8},
    {id:'pullups',name:'Wide Grip Pull-Ups',target:'3 × 6–8',sets:3,rMin:6,rMax:8},
    {id:'lat_raise',name:'Lateral Raise',target:'3 × 10–12',sets:3,rMin:10,rMax:12},
  ]},
  {id:'lower_strength',title:'Lower Strength',exercises:[
    {id:'calf_stand',name:'Standing Calf Raise',target:'2 × 15',sets:2,rMin:15,rMax:15},
    {id:'calf_sit',name:'Seated Calf Raise',target:'2 × 15',sets:2,rMin:15,rMax:15},
    {id:'front_squat',name:'Smith Front Squat',target:'4 × 6–8',sets:4,rMin:6,rMax:8},
    {id:'rdl',name:'Romanian Deadlift',target:'4 × 6–8',sets:4,rMin:6,rMax:8},
    {id:'leg_press_s',name:'Leg Press',target:'3 × 8–10',sets:3,rMin:8,rMax:10},
    {id:'db_curls',name:'Dumbbell Curls',target:'3 × 6–8',sets:3,rMin:6,rMax:8},
  ]},
  {id:'upper_hyper',title:'Upper Hypertrophy',exercises:[
    {id:'mach_chest',name:'Machine Chest Press',target:'3 × 10–15',sets:3,rMin:10,rMax:15},
    {id:'pec_dec',name:'Pec Dec',target:'3 × 10–15',sets:3,rMin:10,rMax:15},
    {id:'cable_lat',name:'Cable Lateral Raise',target:'3 × 10–15',sets:3,rMin:10,rMax:15},
    {id:'lat_pull',name:'Lat Pulldown',target:'3 × 8–10',sets:3,rMin:8,rMax:10},
    {id:'cs_row',name:'Chest Supported Row',target:'3 × 8–10',sets:3,rMin:8,rMax:10},
    {id:'rev_tri',name:'Reverse Tricep Ext.',target:'3 × 30–45 sec',sets:3,rMin:null,rMax:null},
    {id:'kick_back',name:'Cable Kick Back',target:'3 × 10–12',sets:3,rMin:10,rMax:12},
    {id:'preacher',name:'Preacher Curl',target:'3 × 30–45 sec',sets:3,rMin:null,rMax:null},
    {id:'bench_curls',name:'30° Bench Bicep Curls',target:'3 × 30–45 sec',sets:3,rMin:null,rMax:null},
  ]},
  {id:'lower_hyper',title:'Lower Hypertrophy',exercises:[
    {id:'ham_curl',name:'Hamstring Curl',target:'3 × 10–15',sets:3,rMin:10,rMax:15},
    {id:'leg_ext',name:'Leg Extensions',target:'3 × 10–15',sets:3,rMin:10,rMax:15},
    {id:'leg_press_g',name:'Leg Press (Glute)',target:'3 × 10–15',sets:3,rMin:10,rMax:15},
    {id:'abs_mach',name:'Abs Machine',target:'3 × 15–20',sets:3,rMin:15,rMax:20},
  ]},
];

// ── STATE ──
const K={cfg:'mw_cfg',W:'mw_W',R:'mw_R',s:'mw_s',BW:'mw_BW',
  PROG:'mw_PROG',STEPS:'mw_STEPS',NOTES:'mw_NOTES',GOALS:'mw_GOALS',BWGOAL:'mw_BWGOAL'};
let cfg=null,W={},R={},BW=[],oldStep=2.5,bwGoal=null;
let PROG=null,STEPS={},NOTES={},GOALS={};
let activeTab=0,lastSynced=null;
let undoSnapshot=null;
let editingNoteEx=null,editingRepEx=null,editingExBlock=null,editingExId=null;

const ls={get(k){try{return JSON.parse(localStorage.getItem(k))}catch(e){return null}},set(k,v){localStorage.setItem(k,JSON.stringify(v))}};

function allExercises(){return PROG.flatMap(b=>b.exercises);}
function exById(id){return allExercises().find(e=>e.id===id);}
function targetStr(ex){
  if(ex.rMin===null)return`${ex.sets} × ${ex.timedLabel||'30–45 sec'}`;
  return ex.rMin===ex.rMax?`${ex.sets} × ${ex.rMin}`:`${ex.sets} × ${ex.rMin}–${ex.rMax}`;
}

// ═══════════════════════════════════════════════════════
//  SYNC
// ═══════════════════════════════════════════════════════
function setSync(status,msg){const d=document.getElementById('syncDot'),t=document.getElementById('syncTxt');if(!d)return;d.className='sync-dot '+status;t.textContent=msg;}

async function pushAll(){
  await Promise.all([
    sbSet('mw_cfg',cfg),sbSet('mw_W',W),sbSet('mw_R',R),sbSet('mw_BW',BW),
    sbSet('mw_PROG',PROG),sbSet('mw_STEPS',STEPS),sbSet('mw_NOTES',NOTES),
    sbSet('mw_GOALS',GOALS),sbSet('mw_BWGOAL',bwGoal),
  ]);
}

function persist(){
  ls.set(K.cfg,cfg);ls.set(K.W,W);ls.set(K.R,R);ls.set(K.BW,BW);
  ls.set(K.PROG,PROG);ls.set(K.STEPS,STEPS);ls.set(K.NOTES,NOTES);
  ls.set(K.GOALS,GOALS);ls.set(K.BWGOAL,bwGoal);
  setSync('syncing','Saving…');
  pushAll().then(ok=>{lastSynced=new Date();setSync(ok?'synced':'offline',ok?'Synced '+lastSynced.toLocaleTimeString():'Offline — saved locally');});
}

async function syncNow(){
  setSync('syncing','Syncing…');
  try{
    const r=await sbGetAll();
    if(!r){setSync('offline','Offline — changes saved locally');return;}
    let changed=false;
    const map={
      'mw_cfg':'cfg','mw_W':'W','mw_R':'R','mw_BW':'BW',
      'mw_PROG':'PROG','mw_STEPS':'STEPS','mw_NOTES':'NOTES',
      'mw_GOALS':'GOALS','mw_BWGOAL':'bwGoal'
    };
    for(const[rk,lk]of Object.entries(map)){
      if(r[rk]!==null&&r[rk]!==undefined){
        ls.set(rk,r[rk]);
        if(lk==='cfg')cfg=r[rk];else if(lk==='W')W=r[rk];else if(lk==='R')R=r[rk];
        else if(lk==='BW')BW=r[rk];else if(lk==='PROG')PROG=r[rk];else if(lk==='STEPS')STEPS=r[rk];
        else if(lk==='NOTES')NOTES=r[rk];else if(lk==='GOALS')GOALS=r[rk];else if(lk==='bwGoal')bwGoal=r[rk];
        changed=true;
      }
    }
    await pushAll();
    lastSynced=new Date();setSync('synced','Synced '+lastSynced.toLocaleTimeString());
    if(changed){backfillSuggestions();render();restoreTab();}
  }catch(e){setSync('offline','Offline — changes saved locally');}
}

// ═══════════════════════════════════════════════════════
//  BOOT + MIGRATION
// ═══════════════════════════════════════════════════════
async function boot(){
  cfg=ls.get(K.cfg)||null;
  W=ls.get(K.W)||{};R=ls.get(K.R)||{};BW=ls.get(K.BW)||[];oldStep=ls.get(K.s)||2.5;
  PROG=ls.get(K.PROG)||null;STEPS=ls.get(K.STEPS)||null;
  NOTES=ls.get(K.NOTES)||{};GOALS=ls.get(K.GOALS)||{};bwGoal=ls.get(K.BWGOAL)??null;
  migrateRepsFormat();
  if(!cfg){
    document.getElementById('setupDate').value=isoToday();
    document.getElementById('setupBg').classList.add('open');
    setSync('syncing','Checking cloud…');
    const r=await sbGetAll();
    if(r&&r['mw_cfg']){loadFromRemote(r);runMigration();backfillSuggestions();document.getElementById('setupBg').classList.remove('open');checkWeekPrompt();render();setSync('synced','Synced from cloud');}
    else setSync('local','Not set up yet');
    return;
  }
  runMigration();backfillSuggestions();checkWeekPrompt();render();
  syncNow();setInterval(syncNow,30000);
}

function loadFromRemote(r){
  cfg=r['mw_cfg'];W=r['mw_W']||{};R=r['mw_R']||{};BW=r['mw_BW']||[];
  oldStep=parseFloat(r['mw_step'])||2.5;
  PROG=r['mw_PROG']||null;STEPS=r['mw_STEPS']||null;
  NOTES=r['mw_NOTES']||{};GOALS=r['mw_GOALS']||{};bwGoal=r['mw_BWGOAL']??null;
  ls.set(K.cfg,cfg);ls.set(K.W,W);ls.set(K.R,R);ls.set(K.BW,BW);
  migrateRepsFormat();
}

function runMigration(){
  let migrated=false;
  if(!PROG){PROG=JSON.parse(JSON.stringify(DEFAULT_PROGRAM));migrated=true;}
  PROG.forEach(b=>b.exercises.forEach(ex=>{ex.target=targetStr(ex);}));
  if(!STEPS){STEPS={};migrated=true;}
  allExercises().forEach(ex=>{if(STEPS[ex.id]===undefined)STEPS[ex.id]=oldStep||2.5;});
  if(migrated){ls.set(K.PROG,PROG);ls.set(K.STEPS,STEPS);pushAll();}
}

function migrateRepsFormat(){
  Object.keys(R).forEach(wk=>Object.keys(R[wk]).forEach(id=>{
    if(typeof R[wk][id]==='number'){R[wk][id]={reps:R[wk][id],suggested:R[wk][id],isOverride:false};}
  }));
}

// Restore missing suggested rep for current week from last recorded week
function backfillSuggestions(){
  if(!cfg||!PROG)return;
  const wk=cfg.currentWeek;
  if(!R[wk])R[wk]={};
  // find last week with actual data (may not be wk-1 if weeks were skipped)
  const lastDataWk=Math.max(...Object.keys(W).map(Number).filter(w=>w<wk),0);
  const pR=lastDataWk>0?(R[lastDataWk]||{}):{};
  let filled=false;
  allExercises().forEach(ex=>{
    if(ex.rMin===null)return;
    if(W[wk]?.[ex.id]===undefined)return;
    const cur=R[wk][ex.id];
    if(cur&&cur.suggested!=null)return;
    const prd=pR[ex.id];
    const prevLogged=prd?.reps??null;
    const prevSugg=prd?.suggested??ex.rMin;
    let ns;
    if(prevLogged!==null&&prevLogged>=ex.rMax)ns=ex.rMin;
    else{const base=prevLogged!==null?prevLogged:prevSugg;ns=Math.min(base+1,ex.rMax);}
    R[wk][ex.id]={reps:cur?.reps??null,suggested:ns,isOverride:cur?.isOverride??false};
    filled=true;
  });
  if(filled){ls.set(K.R,R);pushAll();}
}

function finishSetup(){
  const wk=parseInt(document.getElementById('setupWeek').value)||1;
  const dt=document.getElementById('setupDate').value;
  cfg={currentWeek:wk,weekStartTs:dt?new Date(dt).getTime():Date.now()};
  PROG=JSON.parse(JSON.stringify(DEFAULT_PROGRAM));
  PROG.forEach(b=>b.exercises.forEach(ex=>ex.target=targetStr(ex)));
  STEPS={};allExercises().forEach(ex=>STEPS[ex.id]=2.5);
  if(!W[wk]){W[wk]={};allExercises().forEach(ex=>{const d=DEFAULT_W20[ex.id];if(d!==undefined)W[wk][ex.id]=d;});}
  if(!R[wk]){R[wk]={};allExercises().forEach(ex=>{if(ex.rMin!==null)R[wk][ex.id]={reps:null,suggested:ex.rMin,isOverride:false};});}
  persist();document.getElementById('setupBg').classList.remove('open');render();
}
const DEFAULT_W20={chest_press_30:32,barbell_row:72.5,cgp_smith:37.5,pullups:10,lat_raise:32.5,calf_stand:50,calf_sit:75,front_squat:57.5,rdl:72.5,leg_press_s:92.5,db_curls:20,mach_chest:62.5,pec_dec:65,cable_lat:6.25,lat_pull:84,cs_row:42.5,rev_tri:16.25,kick_back:6.25,preacher:32.5,bench_curls:16,ham_curl:60,leg_ext:65,leg_press_g:90,abs_mach:45};

// ═══════════════════════════════════════════════════════
//  WEEK MANAGEMENT — with skip/keep/progress options
// ═══════════════════════════════════════════════════════
function checkWeekPrompt(){
  if(!cfg)return;
  const elapsed=Date.now()-cfg.weekStartTs;
  const weeksGone=Math.floor(elapsed/(7*24*3600*1000));
  if(weeksGone<1)return;

  // Find the last week that actually has real data
  const recordedWks=Object.keys(W).map(Number).filter(w=>Object.keys(W[w]||{}).length>0);
  const lastRecorded=recordedWks.length?Math.max(...recordedWks):cfg.currentWeek;
  const targetWk=cfg.currentWeek+weeksGone;

  const timeStr=weeksGone===1?'A week has passed':weeksGone+' weeks have passed';
  document.getElementById('mondayDesc').innerHTML=
    `${timeStr}. You are now on <b>Week ${targetWk}</b>.<br>
     Last recorded workout: <b>Week ${lastRecorded}</b>.<br>
     <span style="font-size:11px;color:var(--muted)">Either way, Week ${targetWk} inherits ${lastRecorded}'s weights.</span>`;
  document.getElementById('mondayWeeksGone').value=weeksGone;
  setTimeout(()=>document.getElementById('mondayModal').classList.add('open'),600);
}

function dismissMonday(){
  // Snooze for 24h — don't advance week number
  cfg.weekStartTs=Date.now()-(6*24*3600*1000); // keep it close so it re-prompts tomorrow
  persist();closeModal('mondayModal');
}

function confirmMondayProgress(){
  const weeksGone=parseInt(document.getElementById('mondayWeeksGone').value)||1;
  closeModal('mondayModal');
  // Advance one week with full progression
  doAdvance(true);
  // If more than 1 week gone, advance remaining weeks keeping same weights (no extra progression)
  for(let i=1;i<weeksGone;i++)doAdvance(false);
  persist();render();showToast('Week '+cfg.currentWeek+' started!');
}

function confirmMondayKeep(){
  const weeksGone=parseInt(document.getElementById('mondayWeeksGone').value)||1;
  closeModal('mondayModal');
  // Advance to correct week number but carry weights/reps as-is (no progression)
  for(let i=0;i<weeksGone;i++)doAdvance(false);
  persist();render();showToast('Week '+cfg.currentWeek+' — same weights carried forward');
}

function openWeekModal(){document.getElementById('modalNext').textContent='Week '+(cfg.currentWeek+1);document.getElementById('weekModal').classList.add('open');}
function advanceWeekProgress(){closeModal('weekModal');doAdvance(true);persist();render();showToast('Week '+cfg.currentWeek+' started!');}
function advanceWeekKeep(){closeModal('weekModal');doAdvance(false);persist();render();showToast('Week '+cfg.currentWeek+' — same weights');}

// ── Core advance logic ──
// progress=true  → auto-increment weights/reps based on last week's performance
// progress=false → carry weights/reps exactly as-is (skipped week / travel)
function doAdvance(progress){
  const prev=cfg.currentWeek,next=prev+1;
  // Find the last week that actually has data (handles multi-week gaps)
  const dataWks=Object.keys(W).map(Number).filter(w=>w<=prev);
  const srcWk=dataWks.length?Math.max(...dataWks):prev;
  const pW=W[srcWk]||{},pR=R[srcWk]||{};

  if(!W[next]){
    W[next]={};R[next]={};
    allExercises().forEach(ex=>{
      const w=pW[ex.id];if(w===undefined)return;
      const step=STEPS[ex.id]||2.5;
      const rd=pR[ex.id];
      const logged=rd?.reps??null;
      const prevSugg=rd?.suggested??ex.rMin;

      if(ex.rMin===null){
        // Timed — always just carry weight
        W[next][ex.id]=w;
        return;
      }

      if(!progress){
        // Keep same weight, same suggestion
        W[next][ex.id]=w;
        R[next][ex.id]={reps:null,suggested:prevSugg??ex.rMin,isOverride:false};
        return;
      }

      // Progress mode: only bump weight if user actually logged hitting rMax
      const hitTop=logged!==null&&logged>=ex.rMax;
      W[next][ex.id]=hitTop?Math.round((w+step)*1000)/1000:w;
      let ns;
      if(hitTop){
        ns=ex.rMin; // reset reps when weight bumps
      } else {
        // Increment rep suggestion by 1 from what was actually logged (or previous suggestion)
        const base=logged!==null?logged:prevSugg;
        ns=Math.min((base??ex.rMin)+1,ex.rMax);
      }
      R[next][ex.id]={reps:null,suggested:ns,isOverride:false};
    });
  }
  cfg.currentWeek=next;cfg.weekStartTs=Date.now();
}

// ═══════════════════════════════════════════════════════
//  UNDO
// ═══════════════════════════════════════════════════════
function snapshot(){return JSON.stringify({W,R,BW,PROG,STEPS,NOTES,GOALS,bwGoal,cfg});}
function pushUndo(label){undoSnapshot=snapshot();showToastUndo(label);}
function doUndo(){
  if(!undoSnapshot)return;
  const s=JSON.parse(undoSnapshot);
  W=s.W;R=s.R;BW=s.BW;PROG=s.PROG;STEPS=s.STEPS;NOTES=s.NOTES;GOALS=s.GOALS;bwGoal=s.bwGoal;cfg=s.cfg;
  undoSnapshot=null;persist();render();restoreTab();hideToast();showToast('Undone');
}

// ═══════════════════════════════════════════════════════
//  RENDER SHELL
// ═══════════════════════════════════════════════════════
function render(){
  document.getElementById('weekPill').textContent='Week '+cfg.currentWeek;
  const te=document.getElementById('tabs');te.innerHTML='';
  PROG.forEach((sec,i)=>{
    const t=document.createElement('button');t.className='tab'+(i===activeTab?' on':'');
    t.textContent=sec.title;t.onclick=()=>switchTab(i);te.appendChild(t);
  });
  [['📋 Progress','progress'],['⚖️ Body','bw']].forEach(([label,cls],i)=>{
    const t=document.createElement('button');t.className=`tab ${cls}`;t.textContent=label;
    t.onclick=()=>switchTab(PROG.length+i);te.appendChild(t);
  });
  const cnt=document.getElementById('content');cnt.innerHTML='';
  PROG.forEach((sec,si)=>{
    const div=document.createElement('div');div.className='section'+(si===activeTab?' on':'');div.id='sec-'+si;
    div.innerHTML=`<div class="sec-hd"><div><div class="sec-title">${sec.title}</div><div class="sec-sub">${sec.exercises.length} exercises · Week ${cfg.currentWeek}</div></div><button class="sec-add" onclick="openAddExercise(${si})">+ Add exercise</button></div>`;
    div.appendChild(buildPrevWeekPanel(si));
    sec.exercises.forEach((_,ei)=>div.appendChild(buildCard(si,ei)));
    cnt.appendChild(div);
  });
  ['progressSection','bwSection'].forEach(id=>{const el=document.getElementById(id);if(el)el.className=id.replace('Section','-section');});
  buildExPicker();rebuildWeekSels();
}

function switchTab(i){
  activeTab=i;
  document.querySelectorAll('.tab').forEach((t,j)=>t.classList.toggle('on',j===i));
  document.querySelectorAll('.section').forEach((s,j)=>s.classList.toggle('on',j===i));
  const pl=PROG.length;
  const extras=[{id:'progressSection',fn:renderProgress},{id:'bwSection',fn:renderBW}];
  extras.forEach(({id,fn},j)=>{
    const el=document.getElementById(id);if(!el)return;
    if(i===pl+j){el.classList.add('on');fn();}
    else el.classList.remove('on');
  });
  window.scrollTo({top:0,behavior:'smooth'});
}
function restoreTab(){
  const i=activeTab;
  document.querySelectorAll('.tab').forEach((t,j)=>t.classList.toggle('on',j===i));
  document.querySelectorAll('.section').forEach((s,j)=>s.classList.toggle('on',j===i));
  const pl=PROG.length;
  [{id:'progressSection'},{id:'bwSection'}].forEach(({id},j)=>{
    const el=document.getElementById(id);if(el)el.classList.toggle('on',i===pl+j);
  });
}

// ═══════════════════════════════════════════════════════
//  PREV WEEK PANEL
// ═══════════════════════════════════════════════════════
function buildPrevWeekPanel(si){
  const sec=PROG[si],wk=cfg.currentWeek;
  // find last week with data (handles gaps)
  const dataWks=Object.keys(W).map(Number).filter(w=>w<wk);
  const pWk=dataWks.length?Math.max(...dataWks):null;
  const pW=pWk?W[pWk]||{}:{},pR=pWk?R[pWk]||{}:{};
  const has=pWk&&sec.exercises.some(ex=>pW[ex.id]!==undefined);
  const wrap=document.createElement('div');wrap.className='prev-week-panel';
  if(!has){wrap.innerHTML=`<div class="prev-week-hd"><div class="prev-week-hd-left"><span class="prev-week-label">Last week</span><span class="prev-week-badge">No data yet</span></div></div>`;return wrap;}
  let rows='';
  sec.exercises.forEach(ex=>{const w=pW[ex.id];if(w===undefined)return;const rd=pR[ex.id];const r=rd?.reps??null,sg=rd?.suggested??null;const rt=r!=null?`${r} reps`:(sg!=null?`target: ${sg}`:'—');rows+=`<tr><td class="pname">${ex.name}</td><td class="pwt">${fmt(w)} kg</td><td class="preps">${rt}</td></tr>`;});
  wrap.innerHTML=`<div class="prev-week-hd" onclick="togglePrev(this)"><div class="prev-week-hd-left"><span class="prev-week-label">Week ${pWk}</span><span class="prev-week-badge">Last recorded</span></div><span class="prev-week-arr">▼</span></div><div class="prev-week-body"><table class="prev-tbl"><tbody>${rows}</tbody></table></div>`;
  return wrap;
}
function togglePrev(hd){const body=hd.nextElementSibling,arr=hd.querySelector('.prev-week-arr');const open=body.classList.toggle('open');if(arr)arr.style.transform=open?'rotate(180deg)':'';}

// ═══════════════════════════════════════════════════════
//  EXERCISE CARD
// ═══════════════════════════════════════════════════════
function getRD(wk,id){return R[wk]?.[id]??{reps:null,suggested:null,isOverride:false};}

function buildCard(si,ei){
  const sec=PROG[si],ex=sec.exercises[ei],wk=cfg.currentWeek;
  const curW=W[wk]?.[ex.id]??null;
  // Find previous recorded week
  const dataWks=Object.keys(W).map(Number).filter(w=>w<wk);
  const pWk=dataWks.length?Math.max(...dataWks):null;
  const prevW=pWk?W[pWk]?.[ex.id]??null:null;
  const rd=getRD(wk,ex.id);
  const step=STEPS[ex.id]||2.5;
  const isProg=curW!==null&&prevW!==null&&Math.abs(curW-prevW-step)<0.001&&curW>prevW;
  const isAdj=curW!==null&&prevW!==null&&curW!==prevW&&!isProg;
  let badge='';
  if(curW!==null&&prevW!==null){const d=Math.round((curW-prevW)*100)/100;if(d>0)badge=`<span class="chg-badge up">+${fmt(d)} kg ↑</span>`;else if(d<0)badge=`<span class="chg-badge dn">${fmt(d)} kg</span>`;}
  const hasNote=NOTES[ex.id]&&NOTES[ex.id].trim().length>0;
  const card=document.createElement('div');card.id=`c-${si}-${ei}`;card.className='card'+(isAdj?' adj':'')+(isProg?' progressed':'');
  const wHTML=curW!==null?`<div class="ww"><button class="wbtn" onclick="adjW('${ex.id}',-1)">−</button><div class="wc" onclick="editW('${ex.id}')"><div class="wval${isAdj?' ch':''}" id="wv-${ex.id}">${fmt(curW)}</div><div class="wunit">kg</div></div><button class="wbtn" onclick="adjW('${ex.id}',1)">+</button></div>`:'';
  let planLine=ex.target;
  if(prevW!==null&&curW!==null)planLine=`<span class="plan-prev">${fmt(prevW)} kg last</span><span class="plan-arr">→</span>${fmt(curW)} kg`;
  const progHint=isProg?`<span class="prog-hint">↑ progressed</span>`:'';
  const rstHTML=isAdj?`<span class="rst" onclick="rstW('${ex.id}')">↩ Reset</span>`:'';
  const repsHTML=buildRepsHTML(ex,rd);
  const so=v=>step===v?' on':'';
  card.innerHTML=`
    <div class="card-main">
      <div class="ex-info">
        <div class="ex-name-row">
          <span class="ex-name">${ex.name}</span>
          <button class="note-btn ${hasNote?'has-note':''}" onclick="openNote('${ex.id}')" title="Notes">📝${hasNote?'<span class="note-dot"></span>':''}</button>
          ${badge}
        </div>
        <div class="ex-tgt">${ex.target}</div>
      </div>
      ${wHTML}
    </div>
    <div class="card-foot"><div class="plan-txt">${planLine} ${progHint}</div>${rstHTML}</div>
    ${repsHTML}
    <div class="step-row">
      <span class="step-lbl">Step (kg):</span>
      <div class="step-opts">
        <span class="sopt${so(1.25)}" onclick="setStep('${ex.id}',1.25)">1.25</span>
        <span class="sopt${so(2.5)}"  onclick="setStep('${ex.id}',2.5)">2.5</span>
        <span class="sopt${so(5)}"    onclick="setStep('${ex.id}',5)">5</span>
      </div>
      <span class="edit-reps-link" onclick="openRepEdit('${ex.id}')">✎ reps</span>
    </div>`;
  return card;
}

function buildRepsHTML(ex,rd){
  const{reps:sel,suggested:sugg,isOverride}=rd;
  if(ex.rMin===null){
    return `<div class="reps-row"><span class="reps-lbl">Reps/secs</span><div class="reps-btns"><button class="rep-btn cust${sel!=null?' sel':''}" onclick="editRepsCustom('${ex.id}')">${sel!=null?sel+' ✎':'✎ type'}</button></div></div>`;
  }
  let btns='';
  for(let r=ex.rMin;r<=ex.rMax;r++){const isSel=sel===r,isSugg=sugg===r&&!isSel;let cls='rep-btn'+(isSel?' sel':isSugg?' sugg':'');btns+=`<button class="${cls}" onclick="setReps('${ex.id}',${r})">${r}</button>`;}
  const hasCustom=sel!=null&&(sel<ex.rMin||sel>ex.rMax);
  btns+=`<button class="rep-btn cust${hasCustom?' sel':''}" onclick="editRepsCustom('${ex.id}')">${hasCustom?sel+' ✎':'✎'}</button>`;
  let nextHint='';
  if(sugg!==null){const ns=sugg>=ex.rMax?`weight ↑ + reset to ${ex.rMin}`:`${Math.min(sugg+1,ex.rMax)} reps`;nextHint=`<div class="prog-next-hint">Next week: <b>${ns}</b></div>`;}
  const ov=isOverride?`<div class="override-note">⚡ Manual override</div>`:'';
  return `<div class="reps-row"><span class="reps-lbl">Reps done</span><div class="reps-btns">${btns}</div>${ov}${nextHint}</div>`;
}

function findCardIdx(exId){for(let si=0;si<PROG.length;si++){const ei=PROG[si].exercises.findIndex(e=>e.id===exId);if(ei>=0)return[si,ei];}return[-1,-1];}
function rebuildCardById(exId){const[si,ei]=findCardIdx(exId);if(si<0)return;const old=document.getElementById(`c-${si}-${ei}`);if(old)old.replaceWith(buildCard(si,ei));}

function adjW(exId,dir){const wk=cfg.currentWeek,step=STEPS[exId]||2.5;const cur=W[wk]?.[exId]??0;const nxt=Math.round((cur+dir*step)*1000)/1000;if(nxt<0)return;if(!W[wk])W[wk]={};W[wk][exId]=nxt;persist();rebuildCardById(exId);}
function rstW(exId){const wk=cfg.currentWeek;const dataWks=Object.keys(W).map(Number).filter(w=>w<wk);const pWk=dataWks.length?Math.max(...dataWks):null;const prev=pWk?W[pWk]?.[exId]:undefined;if(prev!==undefined){if(!W[wk])W[wk]={};W[wk][exId]=prev;}persist();rebuildCardById(exId);}
function editW(exId){const wk=cfg.currentWeek,el=document.getElementById(`wv-${exId}`);if(!el)return;const cur=W[wk]?.[exId]??0;const inp=document.createElement('input');inp.type='number';inp.step='0.25';inp.min='0';inp.value=cur;inp.className='winput';el.replaceWith(inp);inp.focus();inp.select();const commit=()=>{const v=parseFloat(inp.value);if(!isNaN(v)&&v>=0){if(!W[wk])W[wk]={};W[wk][exId]=Math.round(v*1000)/1000;persist();}rebuildCardById(exId);};inp.addEventListener('blur',commit);inp.addEventListener('keydown',e=>{if(e.key==='Enter')inp.blur();if(e.key==='Escape'){inp.removeEventListener('blur',commit);rebuildCardById(exId);}});}
function setStep(exId,v){STEPS[exId]=v;persist();rebuildCardById(exId);}
function setReps(exId,r){const wk=cfg.currentWeek;if(!R[wk])R[wk]={};const rd=getRD(wk,exId);const isOv=rd.suggested!==null&&r!==rd.suggested;R[wk][exId]={reps:rd.reps===r?null:r,suggested:rd.suggested,isOverride:rd.reps!==r&&isOv};persist();rebuildCardById(exId);}
function editRepsCustom(exId){const ex=exById(exId),wk=cfg.currentWeek;const cur=getRD(wk,exId).reps??'';const val=prompt(`Reps for ${ex.name}:`,cur);if(val===null)return;const n=parseInt(val);if(!R[wk])R[wk]={};const rd=getRD(wk,exId);R[wk][exId]={reps:isNaN(n)||n<0?null:n,suggested:rd.suggested,isOverride:true};persist();rebuildCardById(exId);}

// ═══════════════════════════════════════════════════════
//  NOTES
// ═══════════════════════════════════════════════════════
function openNote(exId){editingNoteEx=exId;const ex=exById(exId);document.getElementById('noteTitle').textContent='📝 '+ex.name;document.getElementById('noteText').value=NOTES[exId]||'';document.getElementById('noteModal').classList.add('open');setTimeout(()=>document.getElementById('noteText').focus(),100);}
function saveNote(){const v=document.getElementById('noteText').value.trim();if(v)NOTES[editingNoteEx]=v;else delete NOTES[editingNoteEx];persist();closeModal('noteModal');rebuildCardById(editingNoteEx);showToast('Note saved');}

// ═══════════════════════════════════════════════════════
//  EDIT REP RANGE
// ═══════════════════════════════════════════════════════
function openRepEdit(exId){editingRepEx=exId;const ex=exById(exId);document.getElementById('repTitle').textContent='Rep Range · '+ex.name;document.getElementById('repMin').value=ex.rMin??'';document.getElementById('repMax').value=ex.rMax??'';document.getElementById('repSets').value=ex.sets;document.getElementById('repModal').classList.add('open');}
function saveRepRange(){
  const ex=exById(editingRepEx);const mn=document.getElementById('repMin').value,mx=document.getElementById('repMax').value,st=parseInt(document.getElementById('repSets').value)||ex.sets;
  ex.sets=st;if(mn===''||mx===''){ex.rMin=null;ex.rMax=null;}else{ex.rMin=parseInt(mn);ex.rMax=parseInt(mx);if(ex.rMax<ex.rMin)ex.rMax=ex.rMin;}
  ex.target=targetStr(ex);persist();closeModal('repModal');render();restoreTab();showToast('Rep range updated');
}

// ═══════════════════════════════════════════════════════
//  ADD / REMOVE / REORDER EXERCISES
// ═══════════════════════════════════════════════════════
function openAddExercise(blockIdx){editingExBlock=blockIdx;editingExId=null;document.getElementById('exModalTitle').textContent='Add Exercise · '+PROG[blockIdx].title;document.getElementById('exName').value='';document.getElementById('exSets').value=3;document.getElementById('exWeight').value='';document.getElementById('exRMin').value=8;document.getElementById('exRMax').value=12;document.getElementById('exModal').classList.add('open');setTimeout(()=>document.getElementById('exName').focus(),100);}
function saveExercise(){
  const name=document.getElementById('exName').value.trim();if(!name){showToast('Enter a name');return;}
  const sets=parseInt(document.getElementById('exSets').value)||3;const wt=parseFloat(document.getElementById('exWeight').value);
  const mn=document.getElementById('exRMin').value,mx=document.getElementById('exRMax').value;
  const id='custom_'+Date.now().toString(36);const ex={id,name,sets,rMin:mn===''?null:parseInt(mn),rMax:mx===''?null:parseInt(mx)};ex.target=targetStr(ex);
  PROG[editingExBlock].exercises.push(ex);STEPS[id]=2.5;
  const wk=cfg.currentWeek;if(!isNaN(wt)){if(!W[wk])W[wk]={};W[wk][id]=Math.round(wt*1000)/1000;}
  if(ex.rMin!==null){if(!R[wk])R[wk]={};R[wk][id]={reps:null,suggested:ex.rMin,isOverride:false};}
  persist();closeModal('exModal');render();restoreTab();renderManager();showToast('Exercise added');
}
function removeExercise(exId){const ex=exById(exId);if(!confirm(`Remove "${ex.name}"? Past data is kept.`))return;pushUndo('Exercise removed');PROG.forEach(b=>{b.exercises=b.exercises.filter(e=>e.id!==exId);});persist();render();restoreTab();renderManager();}
function openExerciseManager(){closeMenu();renderManager();document.getElementById('mgrModal').classList.add('open');}
function renderManager(){
  const c=document.getElementById('mgrContent');if(!c)return;let html='';
  PROG.forEach((b,bi)=>{
    html+=`<div class="mgr-block"><div class="mgr-block-title">${b.title}</div>`;
    b.exercises.forEach((ex,ei)=>{
      const meta=ex.rMin===null?`${ex.sets}× timed`:`${ex.sets}×${ex.rMin}–${ex.rMax}`;
      html+=`<div class="mgr-ex"><div class="mgr-reorder"><button class="mgr-arrow" ${ei===0?'disabled':''} onclick="moveExercise(${bi},${ei},-1)">▲</button><button class="mgr-arrow" ${ei===b.exercises.length-1?'disabled':''} onclick="moveExercise(${bi},${ei},1)">▼</button></div><div class="mgr-ex-name">${ex.name}<div class="mgr-ex-meta">${meta} · step ${fmt(STEPS[ex.id]||2.5)}kg</div></div><button class="mgr-ex-btn" onclick="openRepEditFromMgr('${ex.id}')">✎</button><button class="mgr-ex-btn del" onclick="removeExercise('${ex.id}')">🗑</button></div>`;
    });
    html+=`<button class="mgr-add-btn" onclick="openAddExerciseFromMgr(${bi})">+ Add to ${b.title}</button></div>`;
  });
  c.innerHTML=html;
}
function moveExercise(bi,ei,dir){const list=PROG[bi].exercises;const ni=ei+dir;if(ni<0||ni>=list.length)return;[list[ei],list[ni]]=[list[ni],list[ei]];persist();renderManager();render();restoreTab();}
function openRepEditFromMgr(exId){openRepEdit(exId);}
function openAddExerciseFromMgr(bi){closeModal('mgrModal');openAddExercise(bi);}

// ═══════════════════════════════════════════════════════
//  PROGRESS TAB (merged charts + history)
// ═══════════════════════════════════════════════════════
function allWeeks(){return[...new Set(Object.keys(W).map(Number))].sort((a,b)=>b-a);}
function rebuildWeekSels(){
  const wks=allWeeks();
  ['histWkSel','cmpA','cmpB'].forEach(id=>{const sel=document.getElementById(id);if(!sel)return;const prev=sel.value;sel.innerHTML=id==='histWkSel'?'<option value="all">All weeks</option>':'<option value="">Select week</option>';wks.forEach(w=>{const o=document.createElement('option');o.value=w;o.textContent='Week '+w+(w===cfg.currentWeek?' (current)':'');sel.appendChild(o);});if(prev)sel.value=prev;});
}
function buildExPicker(){const sel=document.getElementById('exPicker');if(!sel)return;const prev=sel.value;sel.innerHTML='<option value="all">All exercises</option>';PROG.forEach(sec=>{const g=document.createElement('optgroup');g.label=sec.title;sec.exercises.forEach(ex=>{const o=document.createElement('option');o.value=ex.id;o.textContent=ex.name;g.appendChild(o);});sel.appendChild(g);});if(prev)sel.value=prev;}

function renderProgress(){
  rebuildWeekSels();buildExPicker();
  renderCharts();renderHistory();
}

function renderCharts(){
  const pick=document.getElementById('exPicker')?.value||'all';
  const cnt=document.getElementById('chartContent');if(!cnt)return;
  const wks=allWeeks().sort((a,b)=>a-b);
  if(wks.length<2){
    const wk=wks[0]??cfg.currentWeek,wD=W[wk]||{};
    const exL=pick==='all'?allExercises():[exById(pick)].filter(Boolean);
    let html=`<div class="chart-card"><div class="chart-title" style="font-size:14px">Week ${wk} — Starting baseline</div><div class="chart-sub" style="margin-bottom:10px">Charts appear once you have 2+ weeks of data.</div><table style="width:100%;border-collapse:collapse;font-size:12px"><tbody>`;
    exL.forEach(ex=>{const w=wD[ex.id];if(w===undefined)return;html+=`<tr><td style="padding:6px 0;border-bottom:1px solid var(--border)">${ex.name}</td><td style="padding:6px 0;border-bottom:1px solid var(--border);font-family:'Barlow Condensed',sans-serif;font-size:16px;font-weight:700;color:var(--accent);text-align:right">${fmt(w)} kg</td></tr>`;});
    html+='</tbody></table></div>';cnt.innerHTML=html;return;
  }
  const exL=pick==='all'?allExercises():[exById(pick)].filter(Boolean);
  let html='';
  exL.forEach(ex=>{const pts=wks.map(wk=>({wk,w:W[wk]?.[ex.id]??null})).filter(p=>p.w!==null);if(pts.length<2)return;html+=chartCard(ex,pts);});
  cnt.innerHTML=html||`<div class="no-data">No chart data yet.</div>`;
}

function chartCard(ex,pts){
  const goal=GOALS[ex.id]??null;
  const goalRow=`<div class="goal-input-row"><label>🎯 Goal</label><input class="goal-inp" type="number" step="0.25" id="goal-${ex.id}" value="${goal??''}" placeholder="kg"><button class="goal-set-btn" onclick="setGoal('${ex.id}')">Set</button>${goal!=null?`<button class="goal-set-btn" onclick="clearGoal('${ex.id}')">Clear</button>`:''}</div>`;
  return `<div class="chart-card"><div class="chart-title">${ex.name}</div>${goalRow}${miniChart(ex,pts,goal)}</div>`;
}
function miniChart(ex,pts,goal){
  const SW=340,SH=110,P={t:12,r:14,b:28,l:42};const ws=pts.map(p=>p.w);let mn=Math.min(...ws),mx=Math.max(...ws);if(goal!=null){mn=Math.min(mn,goal);mx=Math.max(mx,goal);}const rng=mx-mn||1;const pw=SW-P.l-P.r,ph=SH-P.t-P.b;const px=i=>P.l+i*(pw/(pts.length-1));const py=w=>P.t+ph-(((w-mn)/rng)*ph);const lp=pts.map((p,i)=>`${i===0?'M':'L'}${px(i).toFixed(1)},${py(p.w).toFixed(1)}`).join(' ');const fp=lp+` L${px(pts.length-1).toFixed(1)},${(P.t+ph).toFixed(1)} L${P.l.toFixed(1)},${(P.t+ph).toFixed(1)} Z`;let dots='',xl='';pts.forEach((p,i)=>{dots+=`<circle cx="${px(i).toFixed(1)}" cy="${py(p.w).toFixed(1)}" r="3.5" fill="var(--accent)" stroke="var(--bg)" stroke-width="1.5"/>`;if(i===0||i===pts.length-1||pts.length<=7)xl+=`<text x="${px(i).toFixed(1)}" y="${(SH-5).toFixed(1)}" text-anchor="middle" fill="var(--muted)" font-size="9">W${p.wk}</text>`;});const yl=`<text x="${(P.l-4).toFixed(1)}" y="${(P.t+5).toFixed(1)}" text-anchor="end" fill="var(--muted)" font-size="9">${fmt(mx)}</text><text x="${(P.l-4).toFixed(1)}" y="${(P.t+ph).toFixed(1)}" text-anchor="end" fill="var(--muted)" font-size="9">${fmt(mn)}</text>`;let goalLine='';if(goal!=null){const gy=py(goal).toFixed(1);goalLine=`<line x1="${P.l}" y1="${gy}" x2="${P.l+pw}" y2="${gy}" stroke="var(--orange)" stroke-width="1.5" stroke-dasharray="5,4"/><text x="${P.l+pw}" y="${(parseFloat(gy)-4)}" text-anchor="end" fill="var(--orange)" font-size="9" font-weight="700">🎯 ${fmt(goal)}</text>`;}const delta=Math.round((pts[pts.length-1].w-pts[0].w)*100)/100;const dStr=delta>0?`+${fmt(delta)} kg`:(delta<0?`${fmt(delta)} kg`:'No change');const dCol=delta>0?'var(--green)':(delta<0?'var(--red)':'var(--muted)');let goalNote='';if(goal!=null){const remain=Math.round((goal-pts[pts.length-1].w)*100)/100;goalNote=remain>0?` · <span style="color:var(--orange)">${fmt(remain)} kg to goal</span>`:` · <span style="color:var(--green)">✓ Goal!</span>`;}
  return `<div class="chart-sub">${ex.target} · <span style="color:${dCol}">${dStr} total</span>${goalNote}</div><svg class="chart" viewBox="0 0 ${SW} ${SH}" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="cg${ex.id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="var(--accent)" stop-opacity="0.25"/><stop offset="100%" stop-color="var(--accent)" stop-opacity="0.02"/></linearGradient></defs><line x1="${P.l}" y1="${P.t}" x2="${P.l}" y2="${P.t+ph}" stroke="var(--border)" stroke-width="1"/><line x1="${P.l}" y1="${P.t+ph}" x2="${P.l+pw}" y2="${P.t+ph}" stroke="var(--border)" stroke-width="1"/><path d="${fp}" fill="url(#cg${ex.id})"/><path d="${lp}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>${goalLine}${dots}${xl}${yl}</svg>`;
}
function setGoal(exId){const v=parseFloat(document.getElementById('goal-'+exId).value);if(isNaN(v)||v<=0){showToast('Enter a valid goal');return;}GOALS[exId]=Math.round(v*1000)/1000;persist();renderCharts();showToast('🎯 Goal set');}
function clearGoal(exId){delete GOALS[exId];persist();renderCharts();}

function renderHistory(){
  rebuildWeekSels();
  const search=(document.getElementById('histSearch')?.value||'').toLowerCase().trim();
  const wkF=document.getElementById('histWkSel')?.value;
  const wks=allWeeks().filter(w=>wkF==='all'||w===parseInt(wkF));
  if(!wks.length){document.getElementById('histContent').innerHTML=`<div class="no-data">No history yet.</div>`;return;}
  let html='';
  wks.forEach(wk=>{
    const wD=W[wk]||{},pD=W[wk-1]||{},rD=R[wk]||{};
    PROG.forEach(sec=>{
      const rows=sec.exercises.filter(ex=>wD[ex.id]!==undefined&&(!search||ex.name.toLowerCase().includes(search)));
      if(!rows.length)return;
      let trs='';
      rows.forEach(ex=>{const w=wD[ex.id],pw=pD[ex.id],rd=rD[ex.id],r=rd?.reps??null,sg=rd?.suggested??null;let ct='—',cc='eq';if(pw!==undefined){const d=Math.round((w-pw)*100)/100;if(d>0){ct=`+${fmt(d)}`;cc='up';}else if(d<0){ct=`${fmt(d)}`;cc='dn';}else ct='=';}const rt=r!=null?`${r} reps`:(sg!=null?`target: ${sg}`:'—');trs+=`<tr><td>${ex.name}</td><td class="wt">${fmt(w)} kg</td><td class="rp">${rt}</td><td class="chg ${cc}">${ct} kg</td></tr>`;});
      html+=`<div class="hist-block"><div class="hist-block-hd">${sec.title}<span>Week ${wk}${wk===cfg.currentWeek?' · current':''}</span></div><table class="hist-tbl"><thead><tr><th>Exercise</th><th>Weight</th><th>Reps</th><th>vs Prev</th></tr></thead><tbody>${trs}</tbody></table></div>`;
    });
  });
  document.getElementById('histContent').innerHTML=html||`<div class="no-data">No matching data.</div>`;
}
function renderCompare(){
  const a=parseInt(document.getElementById('cmpA').value),b=parseInt(document.getElementById('cmpB').value);
  if(isNaN(a)||isNaN(b)||a===b){showToast('Pick 2 different weeks');return;}
  const lo=Math.min(a,b),hi=Math.max(a,b),wLo=W[lo]||{},wHi=W[hi]||{},rLo=R[lo]||{},rHi=R[hi]||{};
  let html=`<div class="cmp-view"><div class="cmp-hd"><div class="cmp-hd-cell ex">Exercise</div><div class="cmp-hd-cell wk">Week ${lo}</div><div class="cmp-hd-cell wk">Week ${hi}</div></div>`;
  PROG.forEach(sec=>{if(!sec.exercises.some(ex=>wLo[ex.id]!==undefined||wHi[ex.id]!==undefined))return;html+=`<div class="cmp-row"><div class="cmp-sec">${sec.title}</div></div>`;sec.exercises.forEach(ex=>{const wa=wLo[ex.id],wb=wHi[ex.id];if(wa===undefined&&wb===undefined)return;const ra=rLo[ex.id]?.reps??null,rb=rHi[ex.id]?.reps??null;html+=`<div class="cmp-row"><div class="cmp-cell">${ex.name}</div><div class="cmp-cell val${wa!==undefined&&wb!==undefined&&wa>wb?' better':''}">${wa!==undefined?fmt(wa)+' kg':'—'}${ra!=null?`<span class="rp">${ra} reps</span>`:''}</div><div class="cmp-cell val${wb!==undefined&&wa!==undefined&&wb>wa?' better':''}">${wb!==undefined?fmt(wb)+' kg':'—'}${rb!=null?`<span class="rp">${rb} reps</span>`:''}</div></div>`;});});
  html+='</div>';document.getElementById('compareOut').innerHTML=html;document.getElementById('compareOut').scrollIntoView({behavior:'smooth',block:'start'});
}
function clearCompare(){document.getElementById('compareOut').innerHTML='';document.getElementById('cmpA').value='';document.getElementById('cmpB').value='';}

// ═══════════════════════════════════════════════════════
//  BODYWEIGHT  (with weekly averages)
// ═══════════════════════════════════════════════════════
function logBW(){const dateVal=document.getElementById('bwDate').value,kg=parseFloat(document.getElementById('bwVal').value);if(!dateVal||isNaN(kg)||kg<20||kg>500){showToast('Enter a valid weight');return;}BW=BW.filter(e=>e.date!==dateVal);BW.push({date:dateVal,kg:Math.round(kg*10)/10});BW.sort((a,b)=>a.date.localeCompare(b.date));persist();renderBW();showToast('⚖️ Logged!');}
function deleteBW(date){BW=BW.filter(e=>e.date!==date);persist();renderBW();}

function bwWeeklyAverages(){
  // Group entries by ISO week (Mon–Sun) and compute average
  const weeks={};
  BW.forEach(e=>{
    const d=new Date(e.date);
    // Get Monday of that week
    const day=d.getDay();const diff=d.getDate()-(day===0?6:day-1);
    const mon=new Date(d);mon.setDate(diff);
    const key=mon.toISOString().split('T')[0];
    if(!weeks[key])weeks[key]=[];weeks[key].push(e.kg);
  });
  return Object.entries(weeks).sort((a,b)=>a[0].localeCompare(b[0])).map(([mon,vals])=>({
    week:mon,avg:Math.round((vals.reduce((a,b)=>a+b,0)/vals.length)*10)/10,count:vals.length
  }));
}

function renderBW(){
  document.getElementById('bwDate').value=isoToday();
  const gi=document.getElementById('bwGoal');if(gi)gi.value=bwGoal??'';
  const gc=document.getElementById('bwGoalClear');if(gc)gc.style.display=bwGoal!=null?'inline-block':'none';
  const st=document.getElementById('bwStats');
  if(!BW.length){st.innerHTML='<div style="font-size:12px;color:var(--muted);padding:6px 0">No entries yet.</div>';document.getElementById('bwChartCard').style.display='none';document.getElementById('bwHistWrap').style.display='none';document.getElementById('bwWeeklyWrap').style.display='none';return;}
  const last=BW[BW.length-1],first=BW[0],delta=Math.round((last.kg-first.kg)*10)/10;const dStr=(delta>0?'+':'')+fmt(delta)+' kg',dCol=delta<=0?'var(--green)':'var(--red)';const min=Math.min(...BW.map(e=>e.kg)),max=Math.max(...BW.map(e=>e.kg));
  let goalStat='';
  if(bwGoal!=null){const remain=Math.round((last.kg-bwGoal)*10)/10;const reached=Math.abs(remain)<0.05;goalStat=`<div class="bw-stat"><div class="bw-stat-val" style="color:${reached?'var(--green)':'var(--orange)'}">${reached?'✓':fmt(Math.abs(remain))}</div><div class="bw-stat-lbl">${reached?'Goal!':(remain>0?'to go':'past!')}</div></div>`;}
  st.innerHTML=`<div class="bw-stat"><div class="bw-stat-val">${fmt(last.kg)}</div><div class="bw-stat-lbl">Current</div></div><div class="bw-stat"><div class="bw-stat-val" style="color:${dCol}">${dStr}</div><div class="bw-stat-lbl">vs Start</div></div>${goalStat}<div class="bw-stat"><div class="bw-stat-val">${fmt(min)}</div><div class="bw-stat-lbl">Lowest</div></div><div class="bw-stat"><div class="bw-stat-val">${fmt(max)}</div><div class="bw-stat-lbl">Highest</div></div>`;

  // Chart
  const cc=document.getElementById('bwChartCard');
  if(BW.length>=2){
    cc.style.display='block';let subTxt=`${first.date} → ${last.date} · ${BW.length} entries`;if(bwGoal!=null)subTxt+=` · 🎯 ${fmt(bwGoal)} kg`;document.getElementById('bwChartSub').innerHTML=subTxt;
    const SW=340,SH=110,P={t:12,r:14,b:28,l:42};const ws=BW.map(e=>e.kg);let mn=Math.min(...ws),mx2=Math.max(...ws);if(bwGoal!=null){mn=Math.min(mn,bwGoal);mx2=Math.max(mx2,bwGoal);}const rng=mx2-mn||0.5,pw=SW-P.l-P.r,ph=SH-P.t-P.b;const px=i=>P.l+i*(pw/(BW.length-1)),py=w=>P.t+ph-(((w-mn)/rng)*ph);const lp=BW.map((e,i)=>`${i===0?'M':'L'}${px(i).toFixed(1)},${py(e.kg).toFixed(1)}`).join(' ');const fp=lp+` L${px(BW.length-1).toFixed(1)},${(P.t+ph).toFixed(1)} L${P.l.toFixed(1)},${(P.t+ph).toFixed(1)} Z`;let dots='',xl='';BW.forEach((e,i)=>{dots+=`<circle cx="${px(i).toFixed(1)}" cy="${py(e.kg).toFixed(1)}" r="3.5" fill="var(--orange)" stroke="var(--bg)" stroke-width="1.5"/>`;if(i===0||i===BW.length-1)xl+=`<text x="${px(i).toFixed(1)}" y="${(SH-5).toFixed(1)}" text-anchor="${i===0?'start':'end'}" fill="var(--muted)" font-size="9">${e.date.slice(5)}</text>`;});const yl=`<text x="${(P.l-4).toFixed(1)}" y="${(P.t+5).toFixed(1)}" text-anchor="end" fill="var(--muted)" font-size="9">${fmt(mx2)}</text><text x="${(P.l-4).toFixed(1)}" y="${(P.t+ph).toFixed(1)}" text-anchor="end" fill="var(--muted)" font-size="9">${fmt(mn)}</text>`;let goalLine='';if(bwGoal!=null){const gy=py(bwGoal).toFixed(1);goalLine=`<line x1="${P.l}" y1="${gy}" x2="${P.l+pw}" y2="${gy}" stroke="var(--green)" stroke-width="1.5" stroke-dasharray="5,4"/><text x="${P.l+pw}" y="${(parseFloat(gy)-4)}" text-anchor="end" fill="var(--green)" font-size="9" font-weight="700">🎯 ${fmt(bwGoal)}</text>`;}
    document.getElementById('bwChartSvg').innerHTML=`<svg class="chart" viewBox="0 0 ${SW} ${SH}" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="cgbw" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="var(--orange)" stop-opacity="0.25"/><stop offset="100%" stop-color="var(--orange)" stop-opacity="0.02"/></linearGradient></defs><line x1="${P.l}" y1="${P.t}" x2="${P.l}" y2="${P.t+ph}" stroke="var(--border)" stroke-width="1"/><line x1="${P.l}" y1="${P.t+ph}" x2="${P.l+pw}" y2="${P.t+ph}" stroke="var(--border)" stroke-width="1"/><path d="${fp}" fill="url(#cgbw)"/><path d="${lp}" fill="none" stroke="var(--orange)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>${goalLine}${dots}${xl}${yl}</svg>`;
  }else cc.style.display='none';

  // Weekly averages table
  const avgs=bwWeeklyAverages();
  const ww=document.getElementById('bwWeeklyWrap');
  if(avgs.length>=2){
    ww.style.display='block';
    const rows=avgs.reverse().map((a,i)=>{const prev=avgs[i+1];const chg=prev?Math.round((a.avg-prev.avg)*10)/10:null;const cs=chg!=null?(chg<0?`<span style="color:var(--green)">${fmt(chg)}</span>`:`<span style="color:var(--red)">+${fmt(chg)}</span>`):'—';return `<tr><td>${a.week}</td><td class="bw-val">${fmt(a.avg)} kg</td><td style="font-size:11px;color:var(--muted)">${a.count} entries</td><td>${cs}</td></tr>`;}).join('');
    document.getElementById('bwWeeklyBody').innerHTML=rows;
  }else ww.style.display='none';

  // Daily log
  const wrap=document.getElementById('bwHistWrap');wrap.style.display='block';const sorted=[...BW].reverse();document.getElementById('bwTblBody').innerHTML=sorted.map((e,i)=>{const prev=sorted[i+1],chg=prev?Math.round((e.kg-prev.kg)*10)/10:null;const cs=chg!=null?(chg>0?`<span style="color:var(--red)">+${fmt(chg)}</span>`:`<span style="color:var(--green)">${fmt(chg)}</span>`):'—';return `<tr><td>${e.date}</td><td class="bw-val">${fmt(e.kg)} kg</td><td>${cs}</td><td><button class="bw-del" onclick="deleteBW('${e.date}')">✕</button></td></tr>`;}).join('');
}
function setBWGoal(){const v=parseFloat(document.getElementById('bwGoal').value);if(isNaN(v)||v<20||v>500){showToast('Enter a valid goal');return;}bwGoal=Math.round(v*10)/10;persist();renderBW();showToast('🎯 Goal set');}
function clearBWGoal(){bwGoal=null;persist();renderBW();}

// ═══════════════════════════════════════════════════════
//  BACKUP / RESTORE / CSV
// ═══════════════════════════════════════════════════════
function exportBackup(){
  closeMenu();
  const data={version:3,exported:new Date().toISOString(),cfg,W,R,BW,PROG,STEPS,NOTES,GOALS,bwGoal};
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));a.download=`my_workout_backup_${isoToday()}.json`;a.click();showToast('💾 Backup saved');
}
function importBackup(e){
  const file=e.target.files[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=ev=>{
    try{
      const d=JSON.parse(ev.target.result);if(!d.cfg||!d.W){showToast('Invalid backup file');return;}
      if(!confirm('Restore this backup? This replaces all current data.'))return;
      pushUndo('Backup restored');
      cfg=d.cfg;W=d.W||{};R=d.R||{};BW=d.BW||[];PROG=d.PROG||null;STEPS=d.STEPS||{};NOTES=d.NOTES||{};GOALS=d.GOALS||{};bwGoal=d.bwGoal??null;
      migrateRepsFormat();runMigration();backfillSuggestions();persist();closeMenu();render();showToast('✓ Restored');
    }catch(err){showToast('Could not read file');}
  };
  reader.readAsText(file);e.target.value='';
}
function exportCSV(){
  closeMenu();const wks=allWeeks().sort((a,b)=>a-b);
  const rows=[['Week','Block','Exercise','Target','Weight (kg)','Reps Done','Suggested','vs Prev (kg)']];
  wks.forEach(wk=>{PROG.forEach(sec=>sec.exercises.forEach(ex=>{const w=W[wk]?.[ex.id];if(w===undefined)return;const rd=R[wk]?.[ex.id],r=rd?.reps??'',sg=rd?.suggested??'',pw=W[wk-1]?.[ex.id],chg=pw!==undefined?Math.round((w-pw)*100)/100:'';rows.push([wk,sec.title,ex.name,ex.target,fmt(w),r,sg,chg]);}));});
  if(BW.length){rows.push([]);rows.push(['Date','Bodyweight (kg)']);BW.forEach(e=>rows.push([e.date,e.kg]));}
  const csv=rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download=`my_workout_w${cfg.currentWeek}.csv`;a.click();showToast('↓ CSV saved');
}

// ═══════════════════════════════════════════════════════
//  MENU + GUIDE
// ═══════════════════════════════════════════════════════
function openMenu(){document.getElementById('menuBg').classList.add('open');document.getElementById('menuPanel').classList.add('open');}
function closeMenu(){document.getElementById('menuBg').classList.remove('open');document.getElementById('menuPanel').classList.remove('open');}
function openSetupGuide(){
  closeMenu();
  document.getElementById('guideContent').innerHTML=`<h2>Setup <span>Guide</span></h2><p>How to host and set up cloud sync.</p>
    <div style="font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:700;text-transform:uppercase;color:var(--blue);margin:14px 0 6px">1 · Host on GitHub Pages</div>
    <div style="font-size:13px;color:var(--muted);line-height:1.8">Create a free github.com account → New repository (Public) → upload <b style="color:var(--text)">index.html</b>, <b style="color:var(--text)">sw.js</b>, <b style="color:var(--text)">manifest.json</b> → Settings → Pages → main → Save.</div>
    <div style="font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:700;text-transform:uppercase;color:var(--blue);margin:16px 0 6px">2 · Supabase (cloud sync)</div>
    <div style="font-size:13px;color:var(--muted);line-height:1.8">supabase.com → New project → SQL Editor → run:<br><code style="display:block;background:var(--card2);padding:10px;border-radius:7px;margin:8px 0;font-size:11px;color:var(--accent);white-space:pre-wrap">create table workout_data (key text primary key, value jsonb, updated_at timestamptz default now());
alter table workout_data enable row level security;
create policy "all" on workout_data for all using (true) with check (true);</code>Then Settings → API → paste Project URL and anon key into SB_URL / SB_KEY at the top of index.html.</div>
    <div style="font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:700;text-transform:uppercase;color:var(--blue);margin:16px 0 6px">3 · iPhone install</div>
    <div style="font-size:13px;color:var(--muted);line-height:1.8">Open URL in <b style="color:var(--text)">Safari</b> → Share → Add to Home Screen.</div>
    <div class="modal-btns" style="margin-top:18px"><button class="mbtn confirm" onclick="closeModal('guideModal')">Got it</button></div>`;
  document.getElementById('guideModal').classList.add('open');
}

// ═══════════════════════════════════════════════════════
//  UTILS
// ═══════════════════════════════════════════════════════
function closeModal(id){document.getElementById(id).classList.remove('open');}
function fmt(v){if(v===null||v===undefined)return'—';const n=parseFloat(v);return isNaN(n)?'—':(n%1===0?String(n):n.toFixed(2).replace(/\.?0+$/,''));}
function isoToday(){return new Date().toISOString().split('T')[0];}
let toastT;
function showToast(msg){clearTimeout(toastT);const t=document.getElementById('toast');t.innerHTML=msg;t.classList.add('show');t.classList.remove('pointer');toastT=setTimeout(()=>t.classList.remove('show'),2800);}
function showToastUndo(label){clearTimeout(toastT);const t=document.getElementById('toast');t.classList.add('pointer');t.innerHTML=`${label}<button class="undo-btn" onclick="doUndo()">Undo</button>`;t.classList.add('show');toastT=setTimeout(()=>{t.classList.remove('show');undoSnapshot=null;},6000);}
function hideToast(){clearTimeout(toastT);document.getElementById('toast').classList.remove('show');}

function applyUpdate(){
  // Tell the waiting SW to take over, then reload
  navigator.serviceWorker.getRegistration().then(reg=>{
    if(reg&&reg.waiting){reg.waiting.postMessage('skipWaiting');}
    else location.reload();
  });
}

boot();
