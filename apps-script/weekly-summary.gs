// ── RunDB Weekly Summary Generator ──────────────────────────────────────────
//
// TELEPÍTÉS:
//   1. Nyisd meg a futásokat tartalmazó Google Sheetet
//   2. Bővítmények → Apps Script → illeszd be ezt a kódot
//   3. Project Settings → Script Properties → Add property:
//      GROQ_API_KEY = gsk_...   (console.groq.com → Create API Key → ingyenes)
//   4. Futtasd le a setupTrigger() függvényt egyszer (Futtatás menü)
//   5. Az első tesztet a testNow() függvénnyel futtathatod
//
// MŰKÖDÉS:
//   A trigger akkor fut le, amikor új sor kerül a sheetbe (Garmin szinkron).
//   Ha az nap szombat ÉS van aznap rögzített futás → generálja az összefoglalót.
//   Duplikátumvédelem: ugyanarra a hétre csak egyszer generál.
// ─────────────────────────────────────────────────────────────────────────────

const SPREADSHEET_ID = '192YsNtDn7y6VpjMWKDlWUaA_A6scMiqP3DIDLS3Pfeg';
const RUNS_GID       = 1;
const MODEL          = 'llama-3.3-70b-versatile';

// ── Edzésterv (17 hét, 2026-05-11 – 2026-09-06) ──────────────────────────────
const PLAN_START = '2026-05-11';
const PLAN_RACE  = '2026-09-06';
const PLAN_WEEKS = [
  { w:  1, phase: 'Alap',                   km: 28, key: 'Hosszú: 10 km Z1' },
  { w:  2, phase: 'Alap',                   km: 32, key: 'Hosszú: 12 km Z1' },
  { w:  3, phase: 'Alap',                   km: 36, key: 'Hosszú: 14 km Z1-Z2' },
  { w:  4, phase: 'Alap (recovery)',         km: 27, key: 'Hosszú: 10 km Z1' },
  { w:  5, phase: 'Tempo',                  km: 37, key: 'Tempó: 5 km @ 4:45/km · Hosszú: 16 km' },
  { w:  6, phase: 'Tempo',                  km: 42, key: 'Tempó: 6 km @ 4:42/km · Hosszú: 18 km Z2' },
  { w:  7, phase: 'Tempo',                  km: 46, key: 'Tempó: 7 km @ 4:40/km · Hosszú: 20 km Z2' },
  { w:  8, phase: 'Tempo (recovery)',        km: 34, key: 'Hosszú: 17 km Z1' },
  { w:  9, phase: 'Intervallum',            km: 42, key: '5×800m @ 4:05/km · Hosszú: 18 km' },
  { w: 10, phase: 'Intervallum',            km: 46, key: '6×800m @ 4:03/km · Hosszú: 20 km' },
  { w: 11, phase: 'Intervallum',            km: 50, key: '3×1600m @ 4:08/km · Hosszú: 21 km' },
  { w: 12, phase: 'Intervallum (recovery)', km: 37, key: 'Hosszú: 18 km Z1' },
  { w: 13, phase: 'Versenyspecifikus',      km: 41, key: '7 km @ 4:32/km · Hosszú: 17 km (utolsó 5 km @ 4:30)' },
  { w: 14, phase: 'Versenyspecifikus',      km: 36, key: '5 km @ 4:30/km · Hosszú: 15 km Z2' },
  { w: 15, phase: 'Taper',                  km: 24, key: '3 km @ 4:32/km · Hosszú: 6 km Z1' },
  { w: 16, phase: 'Taper',                  km: 12, key: 'Csak könnyű futások' },
  { w: 17, phase: 'Verseny',                km: 21, key: 'Félmaraton — 2026-09-06' },
];

// ── Fő függvény ───────────────────────────────────────────────────────────────

function generateWeeklySummary() {
  const apiKey = PropertiesService.getScriptProperties().getProperty('GROQ_API_KEY');
  if (!apiKey) throw new Error('Nincs GROQ_API_KEY beállítva a Script Properties-ben');

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const runsSheet = ss.getSheets().find(s => s.getSheetId() === RUNS_GID);
  if (!runsSheet) throw new Error('Futásokat tartalmazó sheet (gid=' + RUNS_GID + ') nem található');

  const runs = parseRuns(runsSheet.getDataRange().getValues());
  if (!runs.length) throw new Error('Nem találtam futásokat a sheetben');

  const today      = new Date();
  const weekStart  = getWeekStart(today);
  const wsStr      = fmtDate(weekStart);
  const weStr      = fmtDate(today);

  // Ne generáljunk duplikátumot ugyanarra a hétre
  const outSheet = getOrCreateSummarySheet(ss);
  const existing = outSheet.getDataRange().getValues();
  if (existing.slice(1).some(r => r[1] === wsStr)) {
    Logger.log('Ezen a hétre (' + wsStr + ') már van összefoglaló, kihagyva.');
    return;
  }

  const thisWeekRuns = runs.filter(r => r.date >= wsStr && r.date <= weStr);
  const prev4        = getPrev4Weeks(runs, weekStart);
  const { ctl, atl, tsb } = computeCTL(runs);

  const prompt  = buildPrompt(wsStr, weStr, thisWeekRuns, prev4, ctl, atl, tsb);
  const summary = callGroq(apiKey, prompt);

  outSheet.appendRow([new Date().toISOString(), wsStr, weStr, summary]);
  Logger.log('✓ Összefoglaló generálva: ' + wsStr + ' – ' + weStr);
}

// ── Summaries sheet kezelés ───────────────────────────────────────────────────

function getOrCreateSummarySheet(ss) {
  let sheet = ss.getSheetByName('Summaries');
  if (!sheet) {
    sheet = ss.insertSheet('Summaries');
    sheet.appendRow(['generated_at', 'week_start', 'week_end', 'summary']);
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1, 200);
    sheet.setColumnWidth(2, 110);
    sheet.setColumnWidth(3, 110);
    sheet.setColumnWidth(4, 600);
    Logger.log('✓ Summaries sheet létrehozva');
  }
  return sheet;
}

// ── Futások parsálása ─────────────────────────────────────────────────────────

function hun(v) {
  if (v == null || v === '') return null;
  const n = parseFloat(String(v).replace(',', '.'));
  return isNaN(n) ? null : n;
}

function parseUnit(v, unit) {
  if (v == null || v === '') return null;
  const n = parseFloat(String(v).replace(',', '.').replace(new RegExp(unit + '\\s*', 'g'), '').trim());
  return isNaN(n) ? null : n;
}

function tMin(v) {
  if (v == null || v === '') return null;
  // Duration fraction (Sheets Time cell): 0.5 = 12h
  if (typeof v === 'number') return v < 1 ? v * 24 * 60 : null;
  const s = String(v);
  const m1 = s.match(/(\d+)h:(\d+)m:(\d+)s/);
  if (m1) return +m1[1] * 60 + +m1[2] + +m1[3] / 60;
  const m2 = s.match(/(\d+):(\d+):(\d+)/);
  if (m2) return +m2[1] * 60 + +m2[2] + +m2[3] / 60;
  return null;
}

function shDate(v) {
  if (!v) return null;
  if (v instanceof Date) return Utilities.formatDate(v, 'UTC', 'yyyy-MM-dd');
  const m = String(v).match(/(\d{4})[.\-\/](\d{2})[.\-\/](\d{2})/);
  return m ? m[1] + '-' + m[2] + '-' + m[3] : null;
}

function parseRuns(data) {
  const runs = [];
  for (let i = 1; i < data.length; i++) {
    const c = data[i];
    const date = shDate(c[0]);
    if (!date) continue;
    if (!String(c[2] || '').toLowerCase().includes('run')) continue;
    const dur  = tMin(c[3]);
    if (!dur || dur < 0.5) continue;
    const dist = parseUnit(c[8], 'km');
    if (!dist || dist < 0.1) continue;
    const avgHr   = Math.round(parseUnit(c[12], 'bpm') || hun(c[12]) || 0) || null;
    const trimp   = +(hun(c[14]) || 0).toFixed(1);
    const cal     = parseUnit(c[10], 'kcal') || hun(c[10]);
    runs.push({ date, dist: +dist.toFixed(2), pace: +(dur / dist).toFixed(3), avgHr, trimp, calories: cal });
  }
  return runs.sort((a, b) => a.date.localeCompare(b.date));
}

// ── Hét- és dátum-segédfüggvények ────────────────────────────────────────────

function getWeekStart(date) {
  const d   = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  d.setHours(0, 0, 0, 0);
  return d;
}

function fmtDate(d) { return Utilities.formatDate(d, 'UTC', 'yyyy-MM-dd'); }

function fmtPace(p) {
  const m = Math.floor(p), s = Math.round((p - m) * 60);
  return m + ':' + (s < 10 ? '0' : '') + s;
}

function getPrev4Weeks(runs, weekStart) {
  const weeks = [];
  for (let i = 1; i <= 4; i++) {
    const ws = new Date(weekStart); ws.setDate(ws.getDate() - 7 * i);
    const we = new Date(ws);       we.setDate(we.getDate() + 6);
    const wsStr = fmtDate(ws), weStr = fmtDate(we);
    const wRuns = runs.filter(r => r.date >= wsStr && r.date <= weStr);
    if (wRuns.length) weeks.push({ label: wsStr, runs: wRuns });
  }
  return weeks;
}

// ── CTL / ATL / TSB ──────────────────────────────────────────────────────────

function computeCTL(runs) {
  const td = {};
  runs.forEach(r => { td[r.date] = (td[r.date] || 0) + r.trimp; });
  let ctl = 0, atl = 0;
  const first = new Date(runs[0].date + 'T12:00:00Z');
  const end   = new Date();
  for (let d = new Date(first); d <= end; d.setDate(d.getDate() + 1)) {
    const ds = Utilities.formatDate(d, 'UTC', 'yyyy-MM-dd');
    const t  = td[ds] || 0;
    ctl = ctl * (1 - 1 / 42) + t * (1 / 42);
    atl = atl * (1 - 1 / 7)  + t * (1 / 7);
  }
  return { ctl: +ctl.toFixed(1), atl: +atl.toFixed(1), tsb: +(ctl - atl).toFixed(1) };
}

// ── Terv-hét meghatározás ─────────────────────────────────────────────────────

function getCurrentPlanWeek(dateStr) {
  const start = new Date(PLAN_START + 'T12:00:00Z');
  const cur   = new Date(dateStr   + 'T12:00:00Z');
  const diffDays = Math.floor((cur - start) / 86400000);
  if (diffDays < 0) return null;
  const idx = Math.floor(diffDays / 7);
  return idx < PLAN_WEEKS.length ? PLAN_WEEKS[idx] : null;
}

// ── Prompt összeállítás ───────────────────────────────────────────────────────

function buildPrompt(wsStr, weStr, thisWeek, prev4, ctl, atl, tsb) {
  const sumKm    = rs => +rs.reduce((s, r) => s + r.dist,  0).toFixed(1);
  const sumTrimp = rs => +rs.reduce((s, r) => s + r.trimp, 0).toFixed(0);
  const sumCal   = rs => { const v = rs.filter(r => r.calories).reduce((s, r) => s + r.calories, 0); return v > 0 ? Math.round(v) : null; };
  const bestPaceStr = rs => {
    const sorted = rs.filter(r => r.pace > 0).sort((a, b) => a.pace - b.pace);
    return sorted.length ? fmtPace(sorted[0].pace) : null;
  };

  const planW     = getCurrentPlanWeek(wsStr);
  const planNext  = planW && planW.w < PLAN_WEEKS.length ? PLAN_WEEKS[planW.w] : null;
  const actualKm  = +sumKm(thisWeek);
  const planKm    = planW ? planW.km : null;
  const kmDiff    = planKm ? +(actualKm - planKm).toFixed(1) : null;
  const kmDiffStr = kmDiff !== null ? (kmDiff >= 0 ? '+' : '') + kmDiff + ' km a tervhez képest' : '';

  const runLines = thisWeek.length
    ? thisWeek.map(r =>
        '  - ' + r.date + ': ' + r.dist + ' km @ ' + fmtPace(r.pace) + '/km' +
        (r.avgHr    ? ', HR: ' + r.avgHr + ' bpm' : '') +
        ', TRIMP: ' + r.trimp +
        (r.calories ? ', ' + Math.round(r.calories) + ' kcal' : '')
      ).join('\n')
    : '  Ezen a héten nem volt rögzített futás.';

  const prevLines = prev4.length
    ? prev4.map(w => {
        const pw = getCurrentPlanWeek(w.label);
        return '  - ' + w.label + ': ' + w.runs.length + ' futás, ' + sumKm(w.runs) + ' km' +
          (pw ? ' (terv: ' + pw.km + ' km)' : '') +
          ', TRIMP: ' + sumTrimp(w.runs) +
          (sumCal(w.runs) ? ', ' + sumCal(w.runs) + ' kcal' : '');
      }).join('\n')
    : '  Nincs elegendő előzményadat.';

  const tsbCtx = tsb > 10  ? 'pihent, versenyképes forma' :
                 tsb > 0   ? 'kiegyensúlyozott' :
                 tsb > -10 ? 'normális edzésterhelés' :
                 tsb > -20 ? 'fáradt, figyelj a regenerációra' : 'túlterhelés kockázata';

  const planSection = planW ? `
EDZÉSTERV ÁLLAPOT (${planW.w}. hét / 17 — ${planW.phase} fázis):
- Tervezett km: ${planW.km} km → Teljesített: ${actualKm} km (${kmDiffStr})
- Kulcsedzések ezen a héten: ${planW.key}
- Legjobb tempó a héten: ${bestPaceStr(thisWeek) || '—'}
${planNext ? '- Következő hét (' + planNext.w + '. — ' + planNext.phase + '): ' + planNext.km + ' km · ' + planNext.key : ''}` : '';

  return `Te egy személyes futóedző vagy. Írj tömör, személyes hangvételű heti elemzést magyarul Tamásnak.

KONTEXTUS:
- Tapasztalt futó, HM-cél: sub-1:35 (4:30/km) — Wizzair Félmaraton, 2026-09-06
- 17 hetes strukturált edzésterv szerint edz — ne javasolj az edzéstervtől eltérő edzéseket
- TSB -15-ig normális edzésterhelés egy tervezett blokkban
${planSection}
EZEN A HÉTEN (${wsStr} – ${weStr}):
${runLines}
Összesen: ${actualKm} km, ${thisWeek.length} futás, TRIMP: ${sumTrimp(thisWeek)}${sumCal(thisWeek) ? ', ' + sumCal(thisWeek) + ' kcal' : ''}

ELŐZŐ 4 HÉT:
${prevLines}

FITNESZ:
- CTL: ${ctl} · ATL: ${atl} · TSB: ${tsb} (${tsbCtx})

Írj pontosan 4 bekezdést, max. 220 szó összesen:

1. HETI TELJESÍTÉS — Hogyan sikerült a tervhez képest? Volt kulcsedzés (tempó/intervall/hosszú)? Ha igen, milyen tempón ment — az elváráshoz képest jó vagy gyenge?

2. TREND & FITTSÉG — CTL épül-e a tervnek megfelelően? Hogyan alakult a volumen az előző hetekhez képest?

3. CÉLELEMZÉS — On track-e a 4:30/km célra az eddigi tempók és a fittségépítés alapján? Mi a fő kockázat vagy biztatójel?

4. FÓKUSZ — Mit érdemes figyelni a jövő héten (${planNext ? planNext.phase + ' fázis, ' + planNext.key : 'következő hét'})? Ne adj edzéstervet, adj kontextust (regeneráció, tempó minősége, stb.)

Kerüld: bevezető frázisokat, általánosságokat, pihenési javaslatot ha TSB > -20.`;
}

// ── Groq API hívás (ingyenes) ─────────────────────────────────────────────────

function callGroq(apiKey, prompt) {
  const resp = UrlFetchApp.fetch('https://api.groq.com/openai/v1/chat/completions', {
    method:  'post',
    headers: {
      'Authorization': 'Bearer ' + apiKey,
      'content-type':  'application/json'
    },
    payload: JSON.stringify({
      model:       MODEL,
      messages:    [{ role: 'user', content: prompt }],
      max_tokens:  650,
      temperature: 0.7
    }),
    muteHttpExceptions: true
  });
  const code = resp.getResponseCode();
  if (code !== 200) throw new Error('Groq API hiba (' + code + '): ' + resp.getContentText());
  return JSON.parse(resp.getContentText()).choices[0].message.content;
}

// ── Trigger beállítás (egyszer futtatandó) ────────────────────────────────────

// A SUMMARY_DAY meghatározza melyik napon generálunk (0=vasárnap, 6=szombat)
const SUMMARY_DAY = 6;

function setupTrigger() {
  // Töröljük a meglévő onRunAdded triggereket
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'onRunAdded')
    .forEach(t => ScriptApp.deleteTrigger(t));

  // onChange: akkor fut, ha bármilyen változás történik a sheetben (pl. Garmin szinkron)
  ScriptApp.newTrigger('onRunAdded')
    .forSpreadsheet(SpreadsheetApp.openById(SPREADSHEET_ID))
    .onChange()
    .create();

  Logger.log('✓ Trigger beállítva: sheet változáskor fut (szombati futás után generál)');
}

// Ez hívódik meg minden sheet-változáskor
function onRunAdded(e) {
  const today = new Date();

  // Csak a beállított napon (alapértelmezés: szombat)
  if (today.getDay() !== SUMMARY_DAY) return;

  const todayStr = Utilities.formatDate(today, Session.getScriptTimeZone(), 'yyyy-MM-dd');

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const runsSheet = ss.getSheets().find(s => s.getSheetId() === RUNS_GID);
  if (!runsSheet) return;

  const runs = parseRuns(runsSheet.getDataRange().getValues());

  // Csak ha van aznap rögzített futás (azaz a szinkron már megtörtént)
  if (!runs.some(r => r.date === todayStr)) return;

  // Duplikátumvédelem: ha erre a hétre már van összefoglaló, kihagyjuk
  const wsStr = fmtDate(getWeekStart(today));
  const summarySheet = ss.getSheetByName('Summaries');
  if (summarySheet) {
    const data = summarySheet.getDataRange().getValues();
    if (data.slice(1).some(r => r[1] === wsStr)) {
      Logger.log('Erre a hétre (' + wsStr + ') már van összefoglaló, kihagyva.');
      return;
    }
  }

  try {
    generateWeeklySummary();
  } catch (err) {
    Logger.log('Hiba a summary generálásakor: ' + err.message);
  }
}

// Teszteléshez: azonnal lefuttat egyet (bármely napon)
function testNow() { generateWeeklySummary(); }

// Diagnosztika: megnézi az első néhány sor nyers cellaértékeit
function diagnoseCols() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheets().find(s => s.getSheetId() === RUNS_GID);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i <= Math.min(3, data.length - 1); i++) {
    const c = data[i];
    Logger.log('--- Sor ' + i + ' ---');
    Logger.log('c[0] (dátum):    ' + JSON.stringify(c[0]) + ' [' + typeof c[0] + ']');
    Logger.log('c[2] (típus):    ' + JSON.stringify(c[2]) + ' [' + typeof c[2] + ']');
    Logger.log('c[3] (időtart.): ' + JSON.stringify(c[3]) + ' [' + typeof c[3] + ']');
    Logger.log('c[8] (távolság): ' + JSON.stringify(c[8]) + ' [' + typeof c[8] + ']');
    Logger.log('c[10] (kalória): ' + JSON.stringify(c[10]) + ' [' + typeof c[10] + ']');
    Logger.log('c[12] (avg HR):  ' + JSON.stringify(c[12]) + ' [' + typeof c[12] + ']');
    Logger.log('c[14] (TRIMP):   ' + JSON.stringify(c[14]) + ' [' + typeof c[14] + ']');
  }
}
