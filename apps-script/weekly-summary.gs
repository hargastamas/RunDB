// ── RunDB Weekly Summary Generator ──────────────────────────────────────────
//
// TELEPÍTÉS:
//   1. Nyisd meg a futásokat tartalmazó Google Sheetet
//   2. Bővítmények → Apps Script → illeszd be ezt a kódot
//   3. Project Settings → Script Properties → Add property:
//      GROQ_API_KEY = gsk_...   (console.groq.com → Create API Key → ingyenes)
//   4. Futtasd le a setupPlanSheet() függvényt egyszer (létrehozza a Plan fület)
//   5. Futtasd le a setupTrigger() függvényt egyszer
//   6. Az első tesztet a testNow() függvénnyel futtathatod
//
// MŰKÖDÉS:
//   Adatforrás: HealthFit (Apple Health → Google Sheets szinkron)
//   onChange trigger: azonnal generál ha szombaton szinkronizálja a futást a HealthFit
//   Fallback trigger: szombaton 20:00-kor generál, ha a HealthFit szinkron elmaradt
//   Duplikátumvédelem: ugyanarra a hétre csak egyszer generál.
// ─────────────────────────────────────────────────────────────────────────────

const SPREADSHEET_ID        = '192YsNtDn7y6VpjMWKDlWUaA_A6scMiqP3DIDLS3Pfeg';
const HEALTH_SPREADSHEET_ID = '1V8XlThjn4eSIjU06WDeuPVFQ24G30di4rNzHgHOGUB0';
const RUNS_GID              = 1;
const MODEL                 = 'llama-3.3-70b-versatile';

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

  const today     = new Date();
  const weekStart = getWeekStart(today);
  const wsStr     = fmtDate(weekStart);
  const weStr     = fmtDate(today);

  const outSheet = getOrCreateSummarySheet(ss);
  const existing = outSheet.getDataRange().getValues();
  if (existing.slice(1).some(r => r[1] === wsStr)) {
    Logger.log('Ezen a hétre (' + wsStr + ') már van összefoglaló, kihagyva.');
    return;
  }

  // Terv beolvasása (Plan fül, fallback: hardcoded PLAN_WEEKS)
  const plan = readPlanSheet(ss);

  // Egészségadatok az edzésterv kezdetétől
  let health = [];
  try {
    health = readHealthSince(PLAN_START);
    Logger.log('Health rekordok betöltve: ' + health.length);
  } catch (err) {
    Logger.log('Health adatok nem elérhetők: ' + err.message);
  }

  const thisWeekRuns  = runs.filter(r => r.date >= wsStr && r.date <= weStr);
  const { ctl, atl, tsb } = computeCTL(runs);
  const weeklyHistory = aggregateWeeksSincePlan(runs, health, plan);
  const bestPaces     = getBestPaces(runs);
  const riegelHM      = getRiegelHM(runs);

  const prompt  = buildPrompt(wsStr, weStr, thisWeekRuns, ctl, atl, tsb, weeklyHistory, bestPaces, plan, riegelHM);
  const summary = callGroq(apiKey, prompt);

  const genAt = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
  outSheet.appendRow([genAt, wsStr, weStr, summary]);
  Logger.log('✓ Összefoglaló generálva: ' + wsStr + ' – ' + weStr);
}

// ── Plan sheet kezelés ────────────────────────────────────────────────────────

function setupPlanSheet(ss_arg) {
  const ss = ss_arg || SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName('Plan');
  if (!sheet) {
    sheet = ss.insertSheet('Plan');
    sheet.appendRow(['Hét', 'Fázis', 'Tervezett km', 'Kulcsedzés']);
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1, 60);
    sheet.setColumnWidth(2, 180);
    sheet.setColumnWidth(3, 120);
    sheet.setColumnWidth(4, 420);
    Logger.log('✓ Plan sheet létrehozva');
  }
  // Csak a hiányzó sorokat töltjük be (meglévőket nem írjuk felül — szerkeszthetőek)
  const existingData  = sheet.getDataRange().getValues();
  const existingWeeks = new Set(existingData.slice(1).map(r => Number(r[0])));
  PLAN_WEEKS.forEach(pw => {
    if (!existingWeeks.has(pw.w)) {
      sheet.appendRow([pw.w, pw.phase, pw.km, pw.key]);
    }
  });
  Logger.log('✓ Plan sheet feltöltve (' + PLAN_WEEKS.length + ' hét)');
  return sheet;
}

function readPlanSheet(ss) {
  const sheet = ss.getSheetByName('Plan');
  if (!sheet) return PLAN_WEEKS;
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return PLAN_WEEKS;
  const result = [];
  for (let i = 1; i < data.length; i++) {
    const r = data[i];
    const w = parseInt(r[0]);
    if (!w || w < 1 || w > 20) continue;
    result.push({ w, phase: String(r[1] || ''), km: hun(r[2]) || 0, key: String(r[3] || '') });
  }
  return result.length >= 17 ? result.sort((a, b) => a.w - b.w) : PLAN_WEEKS;
}

// ── Health adatok beolvasása ──────────────────────────────────────────────────
// Spreadsheet oszlopok: [0]=dátum, [1]=aktív kcal, [2]=pihenő kcal,
//                       [3]=pihenő HR, [4]=HRV, [5]=lépések, [6]=VO2max

function readHealthSince(fromDate) {
  const ss    = SpreadsheetApp.openById(HEALTH_SPREADSHEET_ID);
  const sheet = ss.getSheets()[0];
  const data  = sheet.getDataRange().getValues();
  const results = [];
  for (let i = 1; i < data.length; i++) {
    const c    = data[i];
    const date = shDate(c[0]);
    if (!date || date < fromDate) continue;
    const restHr = hun(c[3]);
    const hrv    = hun(c[4]);
    const vo2max = hun(c[6]);
    if (!restHr && !hrv && !vo2max) continue;
    results.push({ date, restHr, hrv, vo2max });
  }
  return results.sort((a, b) => a.date.localeCompare(b.date));
}

// ── Heti aggregátumok az edzésterv kezdetétől ─────────────────────────────────

function aggregateWeeksSincePlan(runs, health, plan) {
  const todayStr      = fmtDate(new Date());
  const planStartDate = new Date(PLAN_START + 'T12:00:00Z');
  const weeks         = [];

  for (let i = 0; i < plan.length; i++) {
    const pw  = plan[i];
    const ws  = new Date(planStartDate);
    ws.setDate(ws.getDate() + i * 7);
    const we  = new Date(ws);
    we.setDate(we.getDate() + 6);
    const wsStr = fmtDate(ws);
    const weStr = fmtDate(we);

    if (wsStr > todayStr) break; // jövőbeli hetek kihagyása

    const wRuns   = runs.filter(r => r.date >= wsStr && r.date <= weStr);
    const wHealth = health.filter(h => h.date >= wsStr && h.date <= weStr);

    const actualKm = +wRuns.reduce((s, r) => s + r.dist,  0).toFixed(1);
    const trimp    = +wRuns.reduce((s, r) => s + r.trimp, 0).toFixed(0);

    const paceRuns = wRuns.filter(r => r.pace > 0 && r.dist >= 3);
    const bestPace = paceRuns.length
      ? +paceRuns.reduce((b, r) => r.pace < b ? r.pace : b, Infinity).toFixed(3)
      : null;

    const hrvVals   = wHealth.filter(h => h.hrv    > 0).map(h => h.hrv);
    const hrVals    = wHealth.filter(h => h.restHr > 0).map(h => h.restHr);
    const vo2vals   = wHealth.filter(h => h.vo2max > 0).map(h => h.vo2max);
    const avgHrv    = hrvVals.length ? +(hrvVals.reduce((s, v) => s + v, 0) / hrvVals.length).toFixed(1) : null;
    const avgRestHr = hrVals.length  ? Math.round(hrVals.reduce((s, v) => s + v, 0) / hrVals.length)    : null;
    const latestVo2 = vo2vals.length ? +vo2vals[vo2vals.length - 1].toFixed(1) : null;

    weeks.push({
      w: pw.w, phase: pw.phase, planKm: pw.km, key: pw.key,
      wsStr, weStr, actualKm, runs: wRuns.length, trimp,
      bestPace, avgHrv, avgRestHr, latestVo2,
      elapsed: weStr < todayStr,
    });
  }
  return weeks;
}

// ── Riegel HM előrejelzés ─────────────────────────────────────────────────────

function getRiegelHM(runs) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 180);
  const cutoffStr = fmtDate(cutoff);
  const candidates = runs.filter(r => r.date >= cutoffStr && r.dist >= 8 && r.pace > 0);
  if (!candidates.length) return null;
  const best = candidates.reduce((b, r) => r.pace < b.pace ? r : b);
  const hmMin  = best.pace * Math.pow(21.0975 / best.dist, 1.06);
  const hmPace = hmMin / 21.0975;
  return { pace: +hmPace.toFixed(3), timeMin: +hmMin.toFixed(1), dist: best.dist, date: best.date };
}

// ── Legjobb tempók az edzésterv kezdete óta ──────────────────────────────────

function getBestPaces(runs) {
  const since = runs.filter(r => r.date >= PLAN_START && r.pace > 0);

  const best = arr => {
    if (!arr.length) return null;
    const r = arr.reduce((b, x) => x.pace < b.pace ? x : b);
    return { pace: r.pace, dist: r.dist, date: r.date };
  };

  return {
    overall: best(since.filter(r => r.dist >= 3)),
    tempo:   best(since.filter(r => r.dist >= 7  && r.dist <= 14)),
    long:    best(since.filter(r => r.dist > 14)),
  };
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
  // getValues() returns Time/Duration cells as Date objects; use UTC to avoid timezone shift
  if (v instanceof Date) {
    const s = Utilities.formatDate(v, 'UTC', 'HH:mm:ss').split(':');
    return +s[0] * 60 + +s[1] + +s[2] / 60;
  }
  if (typeof v === 'number') return v < 1 ? v * 24 * 60 : null;
  const s  = String(v);
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
    const c    = data[i];
    const date = shDate(c[0]);
    if (!date) continue;
    if (!String(c[2] || '').toLowerCase().includes('run')) continue;
    const dur  = tMin(c[3]);
    if (!dur || dur < 0.5) continue;
    const dist = parseUnit(c[8], 'km');
    if (!dist || dist < 0.1) continue;
    const avgHr = Math.round(parseUnit(c[12], 'bpm') || hun(c[12]) || 0) || null;
    const maxHr = Math.round(parseUnit(c[13], 'bpm') || hun(c[13]) || 0) || null;
    const trimp = +(hun(c[14]) || 0).toFixed(1);
    const rpe   = hun(c[15]) || null;
    const cal   = parseUnit(c[10], 'kcal') || hun(c[10]);
    runs.push({ date, dist: +dist.toFixed(2), pace: +(dur / dist).toFixed(3), avgHr, maxHr, trimp, rpe, calories: cal });
  }
  return runs.sort((a, b) => a.date.localeCompare(b.date));
}

// ── Hét- és dátum-segédfüggvények ────────────────────────────────────────────

function getWeekStart(date) {
  const d   = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  d.setUTCHours(12, 0, 0, 0); // noon UTC = correct calendar day in any ±12h timezone
  return d;
}

function fmtDate(d) { return Utilities.formatDate(d, 'UTC', 'yyyy-MM-dd'); }

function fmtPace(p) {
  const m = Math.floor(p), s = Math.round((p - m) * 60);
  return m + ':' + (s < 10 ? '0' : '') + s;
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

function buildPrompt(wsStr, weStr, thisWeek, ctl, atl, tsb, weeklyHistory, bestPaces, plan, riegelHM) {
  const sumKm    = rs => +rs.reduce((s, r) => s + r.dist,  0).toFixed(1);
  const sumTrimp = rs => +rs.reduce((s, r) => s + r.trimp, 0).toFixed(0);
  const sumCal   = rs => { const v = rs.filter(r => r.calories).reduce((s, r) => s + r.calories, 0); return v > 0 ? Math.round(v) : null; };

  // Jelenlegi és következő hét a tervből
  const currentW = weeklyHistory.find(w => w.wsStr === wsStr) || null;
  const planNextW = currentW ? plan.find(p => p.w === currentW.w + 1) : null;

  const actualKm = +sumKm(thisWeek);
  const planKm   = currentW ? currentW.planKm : null;
  const kmDiff   = planKm !== null ? +(actualKm - planKm).toFixed(1) : null;

  // Ezen a héten futások
  const runLines = thisWeek.length
    ? thisWeek.map(r =>
        '  ' + r.date + ': ' + r.dist + ' km @ ' + fmtPace(r.pace) + '/km' +
        (r.avgHr ? ', AvgHR: ' + r.avgHr + ' bpm' : '') +
        (r.maxHr ? ', MaxHR: ' + r.maxHr + ' bpm' : '') +
        (r.rpe   ? ', RPE: '   + r.rpe              : '') +
        ', TRIMP: ' + r.trimp +
        (r.calories ? ', ' + Math.round(r.calories) + ' kcal' : '')
      ).join('\n')
    : '  Ezen a héten nem volt rögzített futás.';

  // Heti előzmények az edzésterv kezdetétől (minden eltelt + jelenlegi hét)
  const historyRows = weeklyHistory.filter(w => w.elapsed || w.wsStr === wsStr);
  const historyLines = historyRows.map(w => {
    const kmStr    = w.actualKm + '/' + w.planKm + ' km';
    const paceStr  = w.bestPace ? fmtPace(w.bestPace) + '/km' : '—';
    const healthParts = [];
    if (w.avgHrv)    healthParts.push('HRV ' + w.avgHrv + ' ms');
    if (w.avgRestHr) healthParts.push('HRpih ' + w.avgRestHr);
    return '  H' + w.w + ' ' + w.wsStr + ' (' + w.phase + '): ' +
           kmStr + ', legjobb tempó: ' + paceStr +
           ', TRIMP: ' + w.trimp +
           (healthParts.length ? ' | ' + healthParts.join(', ') : '');
  }).join('\n');

  // Legjobb tempók
  const bpLines = [
    bestPaces.overall ? '  Bármelyik táv (≥3 km):  ' + fmtPace(bestPaces.overall.pace) + '/km (' + bestPaces.overall.dist + ' km, ' + bestPaces.overall.date + ')' : null,
    bestPaces.tempo   ? '  Tempó táv (7–14 km):    ' + fmtPace(bestPaces.tempo.pace)   + '/km (' + bestPaces.tempo.dist   + ' km, ' + bestPaces.tempo.date   + ')' : null,
    bestPaces.long    ? '  Hosszú (>14 km):         ' + fmtPace(bestPaces.long.pace)    + '/km (' + bestPaces.long.dist    + ' km, ' + bestPaces.long.date    + ')' : null,
  ].filter(Boolean).join('\n');

  const tsbCtx = tsb > 10  ? 'pihent, versenyképes forma' :
                 tsb > 0   ? 'kiegyensúlyozott' :
                 tsb > -10 ? 'normális edzésterhelés' :
                 tsb > -20 ? 'normális terhelés (tervezett blokk), recovery NEM szükséges' : 'túlterhelés kockázata';

  const kmPct = planKm ? Math.round(actualKm / planKm * 100) : null;
  const kmStatus = kmDiff !== null
    ? (kmDiff >= 0 ? '+' : '') + kmDiff + ' km (' + kmPct + '% a tervből)' +
      (kmPct !== null && kmPct < 85 ? ' ← JELENTŐS ELMARADÁS' : '')
    : '—';

  const thisWeekHeader = currentW
    ? 'EZEN A HÉTEN — H' + currentW.w + '/' + plan.length + ' (' + currentW.phase + ' fázis), ' + wsStr + '–' + weStr + ':\n' +
      '  Terv: ' + planKm + ' km · ' + currentW.key + '\n' +
      '  Teljesítve: ' + actualKm + ' km (' + kmStatus + ')'
    : 'EZEN A HÉTEN (' + wsStr + '–' + weStr + '):';

  const nextWeekCtx = planNextW
    ? 'H' + planNextW.w + ' — ' + planNextW.phase + ' | ' + planNextW.km + ' km | ' + planNextW.key
    : 'következő hét';

  const riegelLine = riegelHM
    ? `Riegel HM-előrejelzés (legjobb ${riegelHM.dist} km futásból, ${riegelHM.date}): ${fmtPace(riegelHM.pace)}/km (${Math.floor(riegelHM.timeMin / 60)}:${String(Math.round(riegelHM.timeMin % 60)).padStart(2,'0')} összidő) — ez edzéstempóból extrapolált becslés, nem versenyteljesítmény`
    : 'Riegel HM-előrejelzés: nincs elég hosszú (≥8 km) futás az elmúlt 180 napból';

  return `Te egy személyes futóedző vagy. Írj tömör, személyes hangvételű heti elemzést magyarul Tamásnak.

TAMÁS PROFILJA:
- Előző félmaraton: 4:37/km (1:37:30, 2025-04-13), versenyen max HR 179 bpm
- VO₂ Max csúcs: 56,8 (2025 március, 47 km/hetes edzésblokk — ez az igazi potenciálja)
- Visszatérős forma: 45 napos kihagyás (jobb térd, IT band/patellofemoral, 2026 márc–ápr) — nem motivációs probléma
- Edzésterv előtti alap: ~20 km/hét, 5 km @ ~4:45/km futóképesség
- 4:30/km HM-hez kb. VO₂ Max 52 szükséges (VDOT-alapú becslés). Csúcson 56,8-nál volt (~1:29-es HM-forma), tehát a cél jóval a csúcs alatt van — reálisan visszaépíthető.

KONTEXTUS:
- Tapasztalt futó, HM-cél: sub-1:35 (4:30/km átlagtempó) — Wizzair Félmaraton, 2026-09-06
- 17 hetes strukturált edzésterv, kezdet: ${PLAN_START}
- TEMPÓ ÉRTELMEZÉS: Alap/Z1 futásoknál a 5:30–6:30/km tempó szándékosan lassú és HELYES. Ne hasonlítsd az alap futások tempóját a 4:30 célhoz — az irreleváns. Csak tempó- és intervalledzések tempóját értékeld a célhoz képest.
- TSB SZABÁLY: TSB > -20 = normális tervezett terhelés, NE javasolj pihenést vagy recovery hetet. Csak TSB < -20 esetén jelezz túlterhelést.
- HR CÉLOK FÁZISONKÉNT:
  • Alap (H1–4): minden futás avg HR ≤ 150 bpm. Hosszú futásnál drift max 155-ig OK a vége felé. Strides (Wed) max HR spike irreleváns — csak avg számít.
  • Tempo (H5–8): könnyű futások avg ≤ 150, tempófutás Z3 (avg 155–165) normális.
  • Intervallum (H9–12): könnyű/recovery avg ≤ 150, interval max HR spike ≥ 175 elvárható és irreleváns.
  • Versenyspecifikus (H13–14): könnyű avg ≤ 150, versenyiramos futás avg ~160–165.
- VO₂ MAX ÉRTELMEZÉS: Az Apple Watch VO₂ Max relatív trendet mutat, nem laboratóriumi értéket. 4:30/km HM-hez kb. 52+ szükséges. Jelenlegi érték alapján becsülhető a fejlesztendő gap.

${thisWeekHeader}
${runLines}
  Összesen: ${actualKm} km, ${thisWeek.length} futás, TRIMP: ${sumTrimp(thisWeek)}${sumCal(thisWeek) ? ', ' + sumCal(thisWeek) + ' kcal' : ''}

EDZÉSTERV ELŐZMÉNYEK (H1-től mostanáig):
${historyLines || '  Nincs még elegendő adat.'}

LEGJOBB TEMPÓK AZ EDZÉSTERV KEZDETE ÓTA:
${bpLines || '  Nincs adat.'}
  (Megjegyzés: ha nincs még tempó- vagy hosszú futás, az overall tempó alap Z1 futásból van — ez nem versenyspecifikus teljesítmény)

FITTSÉG:
  CTL: ${ctl} · ATL: ${atl} · TSB: ${tsb} (${tsbCtx})
  VO₂ Max (hét végi): ${currentW?.latestVo2 != null ? currentW.latestVo2 : '—'} (cél: ~52, csúcs: 56,8)
  ${riegelLine}

Hangnem: személyes, közvetlen coach — nem riport, nem körülírás. Minden bekezdésben legalább egy konkrét számot idézz az adatokból.

Írj pontosan 4 bekezdést, max. 250 szó összesen:

1. HETI TELJESÍTÉS — Mondd ki a tényleges km-t és a tervezett km-t számmal (pl. "17,5 km a tervezett 28-ból"). Ha < 85% a teljesítés, egyértelműen jelezd az elmaradást. Ha ≥ 85%, értékeld pozitívan. Volt kulcsedzés? Ha igen, milyen tempón ment.

2. TREND & FITTSÉG — Egy konkrét következtetés a CTL/TRIMP adatokból (nem metrika-magyarázat). Pl.: "A CTL egyelőre alacsony (14), az első hetekben ez normális — az építési ütem a 3–5. héttől gyorsul." Hasonlítsd az előző heti TRIMP/km adatokhoz ha van.

3. HR-FEGYELEM & CÉLELEMZÉS — Először értékeld a HR-fegyelmet: nézd meg minden futás AvgHR-jét a fáziscél alapján (Alap: ≤ 150). Ha mindenki belefért, egy mondatban jelezd pozitívan számokkal. Ha valamelyik avg HR 150 felett volt, egyértelműen jelezd melyik futáson és mennyivel. Ezután: ha van VO₂ Max adat, számítsd ki a gap-et: (jelenlegi VO₂ Max) → (cél: ~52) = X egység hiány. Mondd meg ez a jelenlegi ütemben hány hét alatt reális (kontextus: 56,8 volt a csúcs, tehát visszaépítés, nem új terep). Ha Riegel-adat elérhető, idézd a becsült HM-tempót egy mondatban. Csak tempó- vagy intervalledzések tempóját hasonlítsd a 4:30 célhoz — alapfázisban ez nem releváns, jelezd egyértelműen.

4. FÓKUSZ — A KÖVETKEZŐ HÉT konkrét terve: ${nextWeekCtx}. Ebből kiindulva: mi a legfontosabb egy mondatban (pl. km-volumen elérése, kulcsedzés minősége, regeneráció)? Ne a jelenlegi hét tervezett km-jét ismételd — a következő hétre fókuszálj.

SZABÁLYOK:
- TSB > -20: ne javasolj pihenést
- Z1/alap tempók: ne hasonlítsd a 4:30 versenytemóhoz
- Kerüld: bevezető frázisokat ("A heti km-terv teljesítése..."), körülírást, metrikai definíciókat
- A summary a hét LEZÁRTA után generálódik (utolsó edzés szinkron után), tehát a heti teljesítés végleges`;
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
      max_tokens:  800,
      temperature: 0.7
    }),
    muteHttpExceptions: true
  });
  const code = resp.getResponseCode();
  if (code !== 200) throw new Error('Groq API hiba (' + code + '): ' + resp.getContentText());
  return JSON.parse(resp.getContentText()).choices[0].message.content;
}

// ── Trigger beállítás (egyszer futtatandó) ────────────────────────────────────

function setupTrigger() {
  // Töröljük a meglévő managed triggereket
  ScriptApp.getProjectTriggers()
    .filter(t => ['onRunAdded', 'saturdayFallback', 'sundayFallback'].includes(t.getHandlerFunction()))
    .forEach(t => ScriptApp.deleteTrigger(t));

  // 1. onChange: azonnal generál ha szombaton vagy vasárnap szinkronizál a HealthFit
  ScriptApp.newTrigger('onRunAdded')
    .forSpreadsheet(SpreadsheetApp.openById(SPREADSHEET_ID))
    .onChange()
    .create();

  // 2. Vasárnap 20:00 fallback: ha a HealthFit szinkron elmaradt, vagy a hosszú futás
  //    vasárnapra esett és nem szinkronizálódott (kihagyott edzés esetén is generál)
  ScriptApp.newTrigger('sundayFallback')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.SUNDAY)
    .atHour(20)
    .create();

  Logger.log('✓ Triggerek beállítva: onChange (szombat+vasárnap, azonnali) + vasárnap 20:00 fallback');
}

// onChange trigger: szombaton VAGY vasárnap fut, ha van aznapi futás
function onRunAdded(e) {
  const today     = new Date();
  const dayOfWeek = today.getDay();
  if (dayOfWeek !== 6 && dayOfWeek !== 0) return; // csak szombat (6) vagy vasárnap (0)

  const todayStr = Utilities.formatDate(today, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const ss       = SpreadsheetApp.openById(SPREADSHEET_ID);
  const runsSheet = ss.getSheets().find(s => s.getSheetId() === RUNS_GID);
  if (!runsSheet) return;

  const runs = parseRuns(runsSheet.getDataRange().getValues());
  if (!runs.some(r => r.date === todayStr)) return;

  _generateIfMissing();
}

// Időzített fallback: vasárnap 20:00-kor fut, akkor is ha nem volt HealthFit szinkron
function sundayFallback() {
  _generateIfMissing();
}

// Közös logika: csak generál ha erre a hétre még nincs summary
function _generateIfMissing() {
  const wsStr = fmtDate(getWeekStart(new Date()));
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
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

// ── Segédeszközök ─────────────────────────────────────────────────────────────

// Teszteléshez: azonnal lefuttat egy summary-t (bármely napon)
function testNow() { generateWeeklySummary(); }

// Plan fül létrehozása (egyszer kell futtatni)
function initPlanSheet() { setupPlanSheet(); }

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

// Health diagnosztika: megnézi a health sheet első néhány sorát
function diagnoseHealth() {
  const ss    = SpreadsheetApp.openById(HEALTH_SPREADSHEET_ID);
  const sheet = ss.getSheets()[0];
  const data  = sheet.getDataRange().getValues();
  Logger.log('Health sheet: ' + sheet.getName() + ', sorok: ' + data.length);
  for (let i = 0; i <= Math.min(3, data.length - 1); i++) {
    Logger.log('Sor ' + i + ': ' + JSON.stringify(data[i]));
  }
}
