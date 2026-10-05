Generálj heti edzéselemzést Tamásnak az alábbi lépésekkel és formátumban.

---

## 1. ADATOK BETÖLTÉSE

A HealthFit 2026-09-13-án lezárta a "v5" exportpárt és egy új "v6" párra váltott — a teljes történethez mindkettő kell:
- Futásnapló (v5, adatok 2026-09-13-ig): fileId = `192YsNtDn7y6VpjMWKDlWUaA_A6scMiqP3DIDLS3Pfeg`, "Running" fül
- Egészségügyi adatok (v5, adatok 2026-09-12-ig): fileId = `1V8XlThjn4eSIjU06WDeuPVFQ24G30di4rNzHgHOGUB0`, "Daily Metrics" fül
- Workouts_v6 (2026-09-14-től folytatólagosan): fileId = `1TIoJRz5d18-6zokzvevXAHak5mSOrJpdE4no9Tu5Lfk`, "Running" fül
- Health Metrics_v6 (2026-09-13-tól folytatólagosan): fileId = `1Tw4oAhFdid2_FJ41kXrj-zPxydhLZWa2tNIxA6cr_js`, "Daily Metrics" fül

Töltsd be mind a négyet a Google Drive MCP-vel.

Ha a fájlok túl nagyok a közvetlen olvasáshoz (jellemzően igen), használj subagent-et a következő utasítással:
- Futásnapló/Workouts_v6-ból: kinyerni az összes futást 2026-05-11-től (Date, Distance km, Total Time, Avg HR, Max HR, TRIMP, RPE) — a v5 és v6 "Running" fülének oszlopai eltérnek (v6-ban külön HR Zone Count oszlop van, és HRZ1-9 van HRZ0-5 helyett), de a fenti mezők mindkét fülön ugyanott/ugyanúgy elérhetők
- Egészségügyi adatok/Health Metrics_v6-ból: kinyerni az összes VO₂ Max értéket 2026-05-11-től (Date, VO₂ max) — ugyanaz az oszlopsorrend mindkét fájlban

---

## 2. AZ AKTUÁLIS HÉT AZONOSÍTÁSA

**"A" blokk** (nem a félmaraton-felkészülés maga, hanem egy tempó/intervallum-építő blokk előtte). Terv kezdete: 2026-10-05 (H1 hétfő). Hetekre bontás:
- H1: 10-05–10-11 | H2: 10-12–10-18 | H3: 10-19–10-25 | H4: 10-26–11-01
- H5: 11-02–11-08 | H6: 11-09–11-15 | H7: 11-16–11-22 | H8: 11-23–11-29
- H9: 11-30–12-06 | H10: 12-07–12-13 | H11: 12-14–12-20

A "B" blokk (a tényleges félmaraton-felkészülés, 2027-04-11-i versenyig) 2026-12-21-én indul; ha az aktuális dátum már azután van, ez a fájl frissítésre szorul — jelezd, ne találj ki heteket.

Pontosan számítsd ki, melyik hétben vagyunk és hány futás van már a héten.

---

## 3. HETI TERVEK (futások)

Heti szerkezet: Kedd = tempó/intervallum, Csütörtök = könnyű, Szombat = hosszú (3 futás/hét — az edzőterem a fő fókusz, ezért nincs negyedik futónap).

H1 (25km): K tempó 7km (1,5 bemu+4km@4:15+1,5 lev) | Cs könnyű 6km Z1-Z2+strides | Szo hosszú 12km Z1-Z2
H2 (28km): K intervallum 9km (1,5 bemu+6×800m@3:58, 90mp kocogás+1,5 lev) | Cs könnyű 6km Z1-Z2+strides | Szo hosszú 13km Z1-Z2
H3 (31km): K tempó 9km (2 bemu+5km@4:12+2 lev) | Cs könnyű 7km Z1-Z2+strides | Szo hosszú 15km Z1-Z2 (utolsó 3km@4:25)
H4 (32km): K intervallum 10km (2 bemu+5×1000m@3:58, 90mp kocogás+2 lev) | Cs könnyű 7km Z1-Z2+strides | Szo hosszú 15km Z1-Z2
H5 (33km): K tempó 10km (2 bemu+2×3km@4:08, 2 perc kocogás+2 lev) | Cs könnyű 7km Z1-Z2+strides | Szo hosszú 16km Z1-Z2 (utolsó 4km@4:22)
H6 (35km): K intervallum 11km (2 bemu+6×1000m@3:55, 90mp kocogás+1,5 lev) | Cs könnyű 7km Z1-Z2+strides | Szo hosszú 17km Z1-Z2
H7 (36km): K tempó 10km (2 bemu+6km@4:08+2 lev) | Cs könnyű 8km Z1-Z2+strides | Szo hosszú 18km Z1-Z2 (utolsó 5km@4:18)
H8 (26km) — TESZT hét: K könnyű 6km Z1 (pihent lábak) | Cs **10km versenyteszt, max erőfeszítés — ez pontosítja az új HM-céltempót** | Szo könnyű 10km Z1-Z2 (kilazítás)
H9 (32km): K tempó 9km (2 bemu+5km a teszt alapján frissített küszöbiramon+2 lev) | Cs könnyű 8km Z1-Z2+strides | Szo hosszú 16km Z1-Z2
H10 (24km): K intervallum 8km (2 bemu+5×800m a teszt alapján frissített iramon+2 lev) | Cs könnyű 7km Z1+strides | Szo hosszú 12km Z1
H11 (18km): K könnyű 5km Z1+strides | Cs könnyű 4km Z1 (rugalmas, ünnepek) | Szo hosszú 9km Z1 (laza, fenntartás)


**Iramok logikája (2026-10-05-i revízió):** küszöb (tempó) 4:15→4:08/km, intervallum 3:58→3:55/km — VDOT ~54-55-höz igazítva. Az eredeti terv "tempója" (4:30→4:20) lassabb volt a 4:24-es HM-versenytempónál, ezért lett átírva. A "strides" mindig 6×20mp laza gyorsítást jelent a könnyű futás végén.

**Automatikus gyorsítás — minden elemzésben ellenőrizd:** ha a keddi minőségi edzés láthatóan könnyen ment (a tervezett iramot tartotta vagy gyorsabb volt, és a HR nem kúszott fel a szakasz/ismétlések végére), javasold, hogy a következő azonos típusú edzés (tempó→tempó, intervallum→intervallum) 2-3 mp/km-rel gyorsabb legyen a tervezettnél. Ha nehezen ment vagy nem sikerült tartani az iramot, maradjon a terv szerinti iram. A javaslatot konkrét számmal írd le a következő hétre vonatkozó részben.

---

## 4. HÁTTÉRPROFIL (kontextus az elemzéshez)

- Első HM (2026-09-06): **4:24/km, új PR** (előző: 4:37/km, 2025-04-13); versenyeken max HR historikusan ~179 bpm
- Következő cél: **félmaraton, 2027-04-11**. Céltempó ezen a blokkon (A blokk) belül még nincs lezárva — jelenlegi becslés ~4:10-4:15/km, a 8. heti (11-23–11-29) 10km-es versenyteszt fogja pontosítani. Hosszú távú (2-3 ciklus) cél: 4:00/km.
- VO₂ Max: csúcs 56,8 (2025 márc.); a 2026-09-06-i HM idején 55-56; 2026-10-02-én mérve még mindig 54-56 — nincs visszaesés a verseny óta.
- **Sérülések rendezve (2026-10-02-i állás szerint):** a jobb térd sérülése (2026 márc–ápr) és a vádli-húzódás (2026-08-10) óta nincs tünet; egy friss 5×1000m @ 4:04/km intervallum-széria "fairly easily" ment, ami igazolja, hogy a HM utáni szint megmaradt. Nem kell már kiemelten óvatoskodni, de ha mégis jelezne valami (térd/vádli), természetesen azonnal jelezd.
- HR zónák: Z1 ≤144 bpm | Z2 145–160 bpm | Z3+ 161+ bpm
- Strides/intervallum max HR spike irreleváns (túl rövid)
- Drift a hosszú futás utolsó 20-30%-ában max 155-ig OK
- Edzőterem jelenleg a fő fókusz (heti 2-3x) + heti 1x beltéri bouldering — ezért csak 3 futás/hét, a terv ezt tudatosan vállalja, nem hiányosság

---

## 5. KIMENET — PONTOSAN EBBEN A FORMÁTUMBAN

### Fejléc
```
## Állapotfelmérés — {N}. hét, {context: pl. "2. futás után" vagy "hét vége"}
```

### Szekció 1: Hetek teljesítménye
Táblázat az összes eltelt hétről + az aktuális hétről:

| Hét | Tervezett | Teljesített | Avg HR | Megjegyzés |
|---|---|---|---|---|
| **N. hét** | X km | Y km (Z%) | min–max bpm tartomány | Szöveges összefoglaló |

Megjegyzés oszlopban: "Tökéletes" / "Hosszú futás hétfőre tolva" / stb.

### Szekció 2: HR-fegyelem
Rövid szöveges értékelés (3-5 mondat). Minden futás avg HR-jét értékeld számokkal. Ha mind ≤150: pozitívan. Ha valamelyik felett: konkrétan melyik és mennyivel. Ha hőség volt (28°C+): külön megjegyzés a hő hatásáról.

### Szekció 3: VO₂ Max trend
Fejléccel: `### VO₂ Max trend — ez a legfontosabb szám`
Táblázat az összes mért értékkel 2026-05-11-től:

| Dátum | VO₂ Max |
|---|---|
| ÉÉÉÉ.HH.NN. | XX,X |

Nincs fix célszám jelenleg (a 52,0-ás célt már a nyár óta túlteljesítette) — a hangsúly azon van, hogy a 2026-09-06-i HM óta mért 54-56-os szint tartja-e magát vagy csúszik-e lefelé. Emeld ki, ha visszaesés látszik; ha stabil vagy nő, mondd pozitívan.

### Szekció 4: Tempófejlődés (azonos HR-en)
Bullet pointok: konkrét futások összehasonlítása (dátum, tempó, HR). Ha a tempó javult azonos HR-en: ez az aerob fejlődés jele — mondj is így.

### Szekció 5: Kell változtatás a tervbe?
Fejléccel: `## Kell változtatás a tervbe?`
Egyértelmű **Igen** / **Nem** vastagon. Majd bullet pontok az indokokkal. Ha nincs szükség változtatásra: magyarázd el miért maradj a terven. Ha releváns: következő hét konkrét terve (km + kulcsedzés). Egyéb figyelmeztetés ha szükséges (pl. hőség, térdfigyelés).

---

## 6. HANGNEM ÉS STÍLUS

- Személyes coach, nem riporter
- Minden szekcióban legalább egy konkrét szám az adatokból
- Nincs bevezető frazéma ("Természetesen...", "Íme az elemzés...")
- Rövidítés: bpm, km, %, /km — mindig a szám után
- Magyar szöveg végig
