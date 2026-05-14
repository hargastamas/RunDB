// ── RunDB Weekly Summary Generator ──────────────────────────────────────────
//
// TELEPÍTÉS:
//   1. Nyisd meg a futásokat tartalmazó Google Sheetet
//   2. Bővítmények → Apps Script → illeszd be ezt a kódot
//   3. Project Settings → Script Properties → Add property:
//      GEMINI_API_KEY = AIza...   (aistudio.google.com → Get API key → ingyenes)
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
const MODEL          = 'gemini-2.0-flash-lite';

// ── Fő függvény ───────────────────────────────────────────────────────────────

function generateWeeklySummary() {
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) throw new Error('Nincs GEMINI_API_KEY beállítva a Script Properties-ben');

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
  const summary = callGemini(apiKey, prompt);

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

// ── Prompt összeállítás ───────────────────────────────────────────────────────

function buildPrompt(wsStr, weStr, thisWeek, prev4, ctl, atl, tsb) {
  const sumKm    = rs => +rs.reduce((s, r) => s + r.dist,    0).toFixed(1);
  const sumTrimp = rs => +rs.reduce((s, r) => s + r.trimp,   0).toFixed(0);
  const sumCal   = rs => { const v = rs.filter(r => r.calories).reduce((s, r) => s + r.calories, 0); return v > 0 ? Math.round(v) : null; };
  const avgPaceStr = rs => rs.length ? fmtPace(rs.reduce((s, r) => s + r.pace, 0) / rs.length) : null;

  const runLines = thisWeek.length
    ? thisWeek.map(r =>
        '  - ' + r.date + ': ' + r.dist + 'km @ ' + fmtPace(r.pace) + '/km' +
        (r.avgHr    ? ', HR: ' + r.avgHr + ' bpm' : '') +
        ', TRIMP: ' + r.trimp +
        (r.calories ? ', ' + Math.round(r.calories) + ' kcal' : '')
      ).join('\n')
    : '  Ezen a héten nem volt rögzített futás.';

  const prevLines = prev4.length
    ? prev4.map(w =>
        '  - ' + w.label + ': ' + w.runs.length + ' futás, ' + sumKm(w.runs) + ' km' +
        ', TRIMP: ' + sumTrimp(w.runs) +
        (sumCal(w.runs) ? ', ' + sumCal(w.runs) + ' kcal' : '')
      ).join('\n')
    : '  Nincs elegendő előzményadat.';

  const tsbCtx = tsb > 10  ? 'pihent, versenyképes forma' :
                 tsb > 0   ? 'kiegyensúlyozott' :
                 tsb > -10 ? 'enyhén fáradt' : 'fáradt, regeneráció javasolt';

  const thisSummary = sumKm(thisWeek) + ' km, ' + thisWeek.length + ' futás' +
    ', TRIMP: ' + sumTrimp(thisWeek) +
    (sumCal(thisWeek) ? ', ' + sumCal(thisWeek) + ' kcal' : '') +
    (avgPaceStr(thisWeek) ? ', átl. tempó: ' + avgPaceStr(thisWeek) + '/km' : '');

  return `Te egy személyes futóedző vagy. Írj tömör, személyes hangvételű heti elemzést magyarul Tamásnak.
Tamas tapasztalt futó, félmaratoni cél: sub-1:35 (4:30/km). Ismer minden futós fogalmat, nem kell magyarázni az alapokat.

EZEN A HÉTEN (${wsStr} – ${weStr}):
${runLines}
Összesen: ${thisSummary}

ELŐZŐ 4 HÉT (összehasonlításhoz):
${prevLines}

JELENLEGI FITNESZ:
- CTL (edzettség): ${ctl}
- ATL (fáradtság): ${atl}
- TSB (forma): ${tsb} → ${tsbCtx}

Írj pontosan 3 bekezdést, összesen max. 180 szó:
1. Az aheti edzések értékelése — intenzitás, volumen, figyelemre méltó futás
2. Trend az elmúlt hetekhez képest — fejlődés vagy visszaesés, CTL/TSB kontextus
3. Egy konkrét javaslat a jövő hétre — ne általánosságot mondj, legyen specifikus

Kerüld a bevezető frázisokat ("Szia!", "Ezen a héten..."). Kezdj azonnal az értékeléssel.`;
}

// ── Gemini API hívás (ingyenes) ───────────────────────────────────────────────

function callGemini(apiKey, prompt) {
  const url  = 'https://generativelanguage.googleapis.com/v1/models/' + MODEL + ':generateContent?key=' + apiKey;
  const resp = UrlFetchApp.fetch(url, {
    method:  'post',
    headers: { 'content-type': 'application/json' },
    payload: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 650, temperature: 0.7 }
    }),
    muteHttpExceptions: true
  });
  const code = resp.getResponseCode();
  if (code !== 200) throw new Error('Gemini API hiba (' + code + '): ' + resp.getContentText());
  return JSON.parse(resp.getContentText()).candidates[0].content.parts[0].text;
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
