Generálj heti edzéselemzést Tamásnak a következő lépésekkel:

1. **Adatok betöltése (elsődleges: Apps Script endpoint)**
   - Olvasd be a `apps-script/webapp.url` fájlt — ez tartalmazza a deployed endpoint URL-t.
   - Ha a fájl létezik: használj WebFetch-et az URL-re, és az visszaad egy tömör JSON-t (~2KB) az aktuális hét adataival.
   - Ha a fájl nem létezik vagy a WebFetch hibával tér vissza: **fallback** — töltsd be a Google Drive MCP-vel mindkét sheet-et:
     - Futásnapló: fileId = `192YsNtDn7y6VpjMWKDlWUaA_A6scMiqP3DIDLS3Pfeg`
     - Egészségügyi adatok: fileId = `1V8XlThjn4eSIjU06WDeuPVFQ24G30di4rNzHgHOGUB0`
     - Ha a fájlok túl nagyok a közvetlen olvasáshoz, használj subagent-et.

2. **JSON struktúra (ha az endpoint sikeresen válaszol):**
   Az endpoint visszaad egy objektumot ezekkel a mezőkkel:
   - `week`: hétszám, fázis, tervezett km, kulcsedzés, dátumok
   - `runs[]`: az aktuális hét futásai (date, dist, pace min/km, avgHr, maxHr, trimp, rpe)
   - `totals`: összesített km, trimp, futásszám
   - `fitness`: ctl, atl, tsb
   - `health`: vo2max, vo2maxPrev (4 héttel ezelőtti), avgHrv, avgRhr
   - `riegel`: HM-becslés (pace min/km, timeMin, srcDist, srcDate) — a legjobb ≥8 km futásból
   - `bestPaces`: overall, tempo, long (pace, dist, date)
   - `history[]`: minden eltelt hét összesítve (w, phase, planKm, actualKm, trimp, bestPace, avgHrv, latestVo2)
   - `nextWeek`: következő hét terve (num, phase, km, key)

3. **Azonosítsd az aktuális edzéshetet** (terv kezdete: 2026-05-11, hétfőtől vasárnapig).

4. **Generáld az elemzést** az alábbi struktúrával és szabályokkal:

---

**TAMÁS PROFILJA (kontextus):**
- Előző HM: 4:37/km (2025-04-13), versenyeken max HR 179 bpm
- VO₂ Max csúcs: 56,8 (2025 március, 47 km/hetes blokk)
- Visszatérős forma: 45 napos kihagyás (jobb térd, IT band, 2026 márc–ápr)
- Cél: 4:30/km HM (sub-1:35) — Wizzair Félmaraton, 2026-09-06
- 4:30/km HM-hez ~VDOT 52 szükséges; jelenlegi VO₂ Max alapján számítsd ki a gap-et

**EDZÉSTERV (fázisok és HR-célok):**
- Alap (H1–4): minden futás avg HR ≤ 150 bpm; hosszú futásnál drift max 155 OK a végén; strides max HR spike irreleváns
- Tempo (H5–8): könnyű futások avg ≤ 150; tempófutás Z3 avg ~155–165 normális
- Intervallum (H9–12): könnyű/recovery avg ≤ 150; interval max HR spike ≥ 175 elvárható, irreleváns
- Versenyspecifikus (H13–14): könnyű avg ≤ 150; versenyiramos futás avg ~160–165
- TSB > -20 = normális terhelés, NE javasolj pihenést

**PONTOS HETI EDZÉSEK:**
H1 (28km): K 7km Z1-Z2 | Sze 6km Z1+strides | Cs 5km Z1 | Szo 10km Z1
H2 (32km): K 8km Z1-Z2 | Sze 7km Z1+strides | Cs 5km Z1 | Szo 12km Z1
H3 (36km): K 9km Z1-Z2 | Sze 7km Z1+strides | Cs 6km Z1 | Szo 14km Z1-Z2
H4 (27km): K 7km Z1 | Sze 6km Z1+strides | Cs 4km Z1 | Szo 10km Z1
H5 (37km): K 8km Z1-Z2 | Sze 5km@4:45/km tempó | Cs 4km Z1 | Szo 16km Z1-Z2
H6 (42km): K 9km Z1-Z2 | Sze 6km@4:42/km tempó | Cs 5km Z1 | Szo 18km Z2
H7 (46km): K 10km Z1-Z2 | Sze 7km@4:40/km tempó | Cs 5km Z1 | Szo 20km Z2
H8 (34km): K 7km Z1 | Sze 6km Z1 | Cs 4km Z1 | Szo 17km Z1
H9 (42km): K 9km Z1-Z2 | Sze 5×800m@4:05/km | Cs 5km Z1 | Szo 18km Z2
H10 (46km): K 10km Z1-Z2 | Sze 6×800m@4:03/km | Cs 5km Z1 | Szo 20km Z2
H11 (50km): K 12km Z1-Z2 | Sze 3×1600m@4:08/km | Cs 5km Z1 | Szo 21km Z2
H12 (37km): K 8km Z1 | Sze 7km Z1 | Cs 4km Z1 | Szo 18km Z1
H13 (41km): K 8km Z1-Z2 | Sze 7km@4:32/km | Cs 5km Z1 | Szo 17km (utolsó 5km@4:30)
H14 (36km): K 7km Z1-Z2 | Sze 5km@4:30/km | Cs 5km Z1 | Szo 15km Z2
H15 (24km): K 6km Z1-Z2 | Sze 3km@4:32/km | Cs 5km Z1 | Szo 6km Z1
H16 (12km): K 5km Z1 | Sze 4km+strides | Szo 3km Z1
H17: K 3km Z1 | Cs aktiváció | V VERSENY

---

**AZ ELEMZÉS 4 BEKEZDÉSBEN (max 280 szó összesen):**

**1. HETI TELJESÍTÉS**
Tényleges km vs. tervezett km számmal. Ha < 85%, jelezd az elmaradást. Ha ≥ 85%, értékeld pozitívan. Volt kulcsedzés (strides/tempó/intervall)? Ha igen, milyen paraméterekkel ment.

**2. TREND & FITTSÉG**
Egy konkrét következtetés a CTL/TRIMP adatokból az előző héthez képest (ha van). VO₂ Max trend: ha emelkedett, mennyivel; számítsd ki: jelenlegi → 52 cél = X egység hiány; ez visszatérős formaként X hét alatt reális. HRV és RHR kontextus ha releváns.

**3. HR-FEGYELEM & CÉLELEMZÉS**
Minden futás AvgHR-jét értékeld a fáziscél alapján számokkal. Ha mind belefért: jelezd pozitívan. Ha valamelyik 150 felett volt: melyik és mennyivel. Riegel HM-becslés a legjobb ≥8 km futásból (Riegel: T2 = T1 × (21.0975/D1)^1.06, ahol T1 = pace × dist). Csak tempó/intervall edzések tempóját hasonlítsd a 4:30 célhoz — alapfázisban ez nem releváns, jelezd.

**4. FÓKUSZ**
Következő hét konkrét terve (km + kulcsedzés). Mi a legfontosabb egy mondatban.

---

**HANGNEM:** Személyes coach — nem riport. Minden bekezdésben legalább egy konkrét szám az adatokból. Kerüld a bevezető frázisokat és a metrikai definíciókat.

Az elemzés végén add meg azt a szöveget is, amit a Summaries sheet-be lehet másolni (formázás nélkül, sima szövegként).
