import re

with open(r"C:\Users\Tomi\Downloads\running_database_18 (2).html", 'r', encoding='utf-8') as f:
    content = f.read()

# Step 1: Rename const declarations
content = content.replace('const RUNS=[', 'const BASE_RUNS=[', 1)
content = content.replace('const MONTHLY=[', 'const BASE_MONTHLY=[', 1)
content = content.replace('const YEARLY=[', 'const BASE_YEARLY=[', 1)
content = content.replace('const WEEKLY=[', 'const BASE_WEEKLY=[', 1)
content = content.replace('const PRS={', 'const BASE_PRS={', 1)

# Step 2: Remove old PR_DATES line (it referenced PRS, now BASE_PRS)
content = re.sub(r'\nconst PR_DATES=\{[^}]+\};', '', content, count=1)

# Step 3: Replace synchronous init block with async bootstrap call
old_init = "// \u2500\u2500 INIT \u2500\u2500\ninitOverview();\ninitRunsTab();\ninitMonthlyTab();\ninitYearlyTab();\ninitCompareTab();"
new_init = "// \u2500\u2500 INIT \u2500\u2500\n_bootstrap();"
content = content.replace(old_init, new_init, 1)

# Step 4: Inject live-sheet code before MONTHS_HU
injection = """
// \u2500\u2500\u2500 LIVE SHEET INTEGRATION \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
const SHEET_CSV='https://docs.google.com/spreadsheets/d/192YsNtDn7y6VpjMWKDlWUaA_A6scMiqP3DIDLS3Pfeg/export?format=csv&gid=1';
let RUNS=[],MONTHLY=[],YEARLY=[],WEEKLY=[],PRS={},PR_DATES={};

function _tMin(s){if(!s)return null;const m=s.match(/(\\d+)h:(\\d+)m:(\\d+)s/);return m?+m[1]*60+ +m[2]+ +m[3]/60:null}
function _tSec(s){if(!s)return 0;const m=s.match(/(\\d+)h:(\\d+)m:(\\d+)s/);return m?+m[1]*3600+ +m[2]*60+ +m[3]:0}
function _hun(s){return(s&&s.trim())?parseFloat(s.trim().replace(',','.')):null}
function _unit(s,u){return(s&&s.trim())?_hun(s.replace(u,'').trim()):null}
function _shDate(s){const m=s&&s.match(/(\\d{4})\\.(\\d{2})\\.(\\d{2})/);return m?m[1]+'-'+m[2]+'-'+m[3]:null}

function _row2run(c){
  const date=_shDate(c[0]);if(!date)return null;
  if(!(c[2]||'').toLowerCase().includes('run'))return null;
  const dur=_tMin(c[3]);if(!dur||dur<0.5)return null;
  const dist=_unit(c[8],'km');if(!dist||dist<0.1)return null;
  const pace=+(dur/dist).toFixed(3);
  const avg_hr=Math.round(_unit(c[12],'bpm')||_hun(c[12])||0)||null;
  const max_hr=Math.round(_unit(c[13],'bpm')||_hun(c[13])||0)||null;
  const trimp=+(_hun(c[14])||0).toFixed(1);
  const hrzS=[18,19,20,21,22,23].map(i=>_tSec(c[i]));
  const tot=hrzS.reduce((s,v)=>s+v,0)||(dur*60);
  const hrPct=hrzS.map(v=>+(v/tot*100).toFixed(1));
  const z1=hrPct[1],z2=hrPct[2],z3=hrPct[3],z4=hrPct[4],z5=hrPct[5];
  const aei=avg_hr&&pace?+((60/pace)/avg_hr*100).toFixed(3):null;
  const elev=_unit(c[9],'m');
  const cal=_unit(c[10],'kcal')||_hun(c[10]);
  const gct=_unit(c[28],'ms');
  const vo=_unit(c[29],'cm');
  const sl=_unit(c[30],'cm');
  const steps=_hun(c[31]);
  const[yr,mo]=date.split('-').map(Number);
  return{date,year:yr,month:mo,ym:date.slice(0,7),
    dist:+dist.toFixed(2),pace,avg_hr,max_hr,
    duration:+dur.toFixed(1),trimp,z1,z2,z3,z4,z5,aei,
    elevation:elev!=null?+elev.toFixed(0):null,
    temp:_hun(c[6]),
    calories:cal!=null?+cal.toFixed(0):null,
    vo,sl,gct,cadence:(steps&&dur)?+(steps/dur).toFixed(1):null};
}

function _parseCSV(text){
  const runs=[],lines=text.trim().replace(/\\r/g,'').split('\\n');
  for(let i=1;i<lines.length;i++){
    const cols=[];let cur='',inQ=false;
    for(const ch of lines[i]){
      if(ch==='"'){inQ=!inQ;}
      else if(ch===','&&!inQ){cols.push(cur);cur='';}
      else cur+=ch;
    }
    cols.push(cur);
    const r=_row2run(cols);if(r)runs.push(r);
  }
  return runs;
}

function _merge(base,sheet){
  const sk=new Set(sheet.map(r=>r.date+'|'+Math.round(r.dist*10)));
  return[...base.filter(r=>!sk.has(r.date+'|'+Math.round(r.dist*10))),...sheet]
    .sort((a,b)=>a.date.localeCompare(b.date));
}

function _wStart(d){
  const dt=new Date(d),day=dt.getDay(),diff=day===0?-6:1-day;
  dt.setDate(dt.getDate()+diff);return dt.toISOString().slice(0,10);
}
function _wEnd(d){const dt=new Date(_wStart(d));dt.setDate(dt.getDate()+6);return dt.toISOString().slice(0,10);}

function _compute(runs){
  const mM={};runs.forEach(r=>{(mM[r.ym]=mM[r.ym]||[]).push(r)});
  const MONTHLY=Object.keys(mM).sort().map(ym=>{
    const rs=mM[ym],n=rs.length;
    const hrV=rs.filter(r=>r.avg_hr).map(r=>r.avg_hr);
    const aeiV=rs.filter(r=>r.aei).map(r=>r.aei);
    const calV=rs.filter(r=>r.calories).map(r=>r.calories);
    const[yr,mo]=ym.split('-').map(Number);
    return{ym,year:yr,month:mo,
      km:+rs.reduce((s,r)=>s+r.dist,0).toFixed(2),runs:n,
      avg_pace:+rs.reduce((s,r)=>s+r.pace,0)/n,
      avg_hr:hrV.length?+(hrV.reduce((s,v)=>s+v,0)/hrV.length).toFixed(1):null,
      max_dist:+Math.max(...rs.map(r=>r.dist)).toFixed(2),
      best_pace:+Math.min(...rs.map(r=>r.pace)).toFixed(3),
      total_trimp:+rs.reduce((s,r)=>s+r.trimp,0).toFixed(1),
      avg_z1:+rs.reduce((s,r)=>s+r.z1,0)/n,
      avg_z4:+rs.reduce((s,r)=>s+(r.z4||0),0)/n,
      avg_aei:aeiV.length?+(aeiV.reduce((s,v)=>s+v,0)/aeiV.length).toFixed(3):null,
      total_cal:calV.length?+calV.reduce((s,v)=>s+v,0):null,
      total_elev:+rs.reduce((s,r)=>s+(r.elevation||0),0)};
  });
  const yM={};runs.forEach(r=>{(yM[r.year]=yM[r.year]||[]).push(r)});
  const YEARLY=Object.keys(yM).sort().map(yr=>{
    const rs=yM[yr],n=rs.length;
    const bpR=rs.reduce((a,r)=>r.pace<a.pace?r:a);
    const lrR=rs.reduce((a,r)=>r.dist>a.dist?r:a);
    const htR=rs.reduce((a,r)=>r.trimp>a.trimp?r:a);
    const hrV=rs.filter(r=>r.avg_hr).map(r=>r.avg_hr);
    const aeiV=rs.filter(r=>r.aei).map(r=>r.aei);
    const calV=rs.filter(r=>r.calories).map(r=>r.calories);
    return{year:parseInt(yr),runs:n,
      km:+rs.reduce((s,r)=>s+r.dist,0).toFixed(1),
      avg_pace:+rs.reduce((s,r)=>s+r.pace,0)/n,
      avg_hr:hrV.length?+(hrV.reduce((s,v)=>s+v,0)/hrV.length).toFixed(1):null,
      max_dist:+lrR.dist.toFixed(2),best_pace:+bpR.pace.toFixed(3),
      total_trimp:+rs.reduce((s,r)=>s+r.trimp,0).toFixed(1),
      avg_z1:+rs.reduce((s,r)=>s+r.z1,0)/n,
      avg_z4:+rs.reduce((s,r)=>s+(r.z4||0),0)/n,
      avg_aei:aeiV.length?+(aeiV.reduce((s,v)=>s+v,0)/aeiV.length).toFixed(3):null,
      total_cal:calV.length?+calV.reduce((s,v)=>s+v,0):null,
      total_elev:+rs.reduce((s,r)=>s+(r.elevation||0),0),
      longest_run:+lrR.dist.toFixed(2),longest_run_date:lrR.date,
      best_pace_date:bpR.date,
      highest_trimp:+htR.trimp.toFixed(1),highest_trimp_date:htR.date};
  });
  const wM={};runs.forEach(r=>{const ws=_wStart(r.date);(wM[ws]=wM[ws]||[]).push(r)});
  const WEEKLY=Object.keys(wM).sort().map(ws=>{
    const rs=wM[ws];
    return{w:ws+'/'+_wEnd(ws),
      km:+rs.reduce((s,r)=>s+r.dist,0).toFixed(1),
      trimp:+rs.reduce((s,r)=>s+r.trimp,0).toFixed(1),
      runs:rs.length,date:rs[0].date};
  });
  const bp=arr=>arr.length?arr.reduce((a,r)=>r.pace<a.pace?r:a):null;
  const p5=bp(runs.filter(r=>r.dist>=4.5&&r.dist<=7));
  const p10=bp(runs.filter(r=>r.dist>7&&r.dist<=12));
  const pH=bp(runs.filter(r=>r.dist>=18));
  const lng=runs.reduce((a,r)=>r.dist>a.dist?r:a);
  const ht=runs.reduce((a,r)=>r.trimp>a.trimp?r:a);
  const PRS={
    short_5k:p5?{pace:p5.pace,dist:p5.dist,date:p5.date,hr:p5.avg_hr}:null,
    mid_10k:p10?{pace:p10.pace,dist:p10.dist,date:p10.date,hr:p10.avg_hr}:null,
    half:pH?{pace:pH.pace,dist:pH.dist,date:pH.date,hr:pH.avg_hr}:null,
    longest:{dist:lng.dist,date:lng.date,pace:lng.pace,hr:lng.avg_hr},
    highest_trimp:{val:ht.trimp,date:ht.date,dist:ht.dist}
  };
  const PR_DATES={
    [PRS.half&&PRS.half.date]:'F\u00e9lmaraton PR',
    [PRS.short_5k&&PRS.short_5k.date]:'Legjobb 5k',
    [PRS.mid_10k&&PRS.mid_10k.date]:'Legjobb 10k',
    [PRS.longest&&PRS.longest.date]:'Leghosszabb fut\u00e1s',
    [PRS.highest_trimp&&PRS.highest_trimp.date]:'Max TRIMP'
  };
  return{MONTHLY,YEARLY,WEEKLY,PRS,PR_DATES};
}

async function _fetchSheet(){
  const r=await fetch(SHEET_CSV);
  if(!r.ok)throw new Error('HTTP '+r.status);
  return _parseCSV(await r.text());
}

function _clearDOM(){
  ['heatmap','month-names'].forEach(id=>{const el=document.getElementById(id);if(el)el.innerHTML='';});
  ['filter-year','monthly-year-filter'].forEach(id=>{
    const el=document.getElementById(id);
    if(el)el.innerHTML='<option value="">\\u00d6sszes \u00e9v</option>';
  });
  ['year-a','year-b','month-a','month-b'].forEach(id=>{const el=document.getElementById(id);if(el)el.innerHTML='';});
}

async function _bootstrap(){
  ({MONTHLY,YEARLY,WEEKLY,PRS,PR_DATES}=_compute(BASE_RUNS));
  RUNS=BASE_RUNS.slice();filteredRuns=RUNS.slice();
  initOverview();initRunsTab();initMonthlyTab();initYearlyTab();initCompareTab();
  try{
    const sheetRuns=await _fetchSheet();
    const merged=_merge(BASE_RUNS,sheetRuns);
    if(merged.length===BASE_RUNS.length)return;
    ({MONTHLY,YEARLY,WEEKLY,PRS,PR_DATES}=_compute(merged));
    RUNS=merged;filteredRuns=RUNS.slice();
    _clearDOM();
    initOverview();initRunsTab();initMonthlyTab();initYearlyTab();initCompareTab();
    console.log('RunDB live: '+sheetRuns.length+' sheet run(s) \u2192 '+merged.length+' total');
  }catch(e){console.warn('RunDB: sheet fetch failed:',e.message);}
}
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
"""

content = content.replace('const MONTHS_HU=', injection + 'const MONTHS_HU=', 1)

with open(r"D:\Head of AI\Claude Code\rundb.html", 'w', encoding='utf-8') as f:
    f.write(content)

print("OK - rundb.html written successfully")
print(f"File size: {len(content):,} chars")

# Verify key replacements
assert 'const BASE_RUNS=[' in content, "BASE_RUNS missing"
assert 'const BASE_PRS={' in content, "BASE_PRS missing"
assert '_bootstrap()' in content, "_bootstrap missing"
assert 'const SHEET_CSV=' in content, "SHEET_CSV missing"
assert 'const RUNS=[' not in content, "old RUNS still present"
assert 'const PRS={' not in content, "old PRS still present"
print("All assertions passed")
