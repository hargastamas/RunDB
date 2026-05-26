Generálj heti edzéselemzést Tamásnak az alábbi lépésekkel és formátumban.

---

## 1. ADATOK BETÖLTÉSE

Töltsd be mindkét Google Sheet-et a Google Drive MCP-vel:
- Futásnapló: fileId = `192YsNtDn7y6VpjMWKDlWUaA_A6scMiqP3DIDLS3Pfeg`
- Egészségügyi adatok: fileId = `1V8XlThjn4eSIjU06WDeuPVFQ24G30di4rNzHgHOGUB0`

Ha a fájlok túl nagyok a közvetlen olvasáshoz (jellemzően igen), használj subagent-et a következő utasítással:
- Futásnaplóból: kinyerni az összes futást 2026-05-11-től (Date, Distance km, Total Time, Avg HR, Max HR, TRIMP, RPE)
- Egészségügyi adatokból: kinyerni az összes VO₂ Max értéket 2026-05-11-től (Date, VO₂ max)

---

## 2. AZ AKTUÁLIS HÉT AZONOSÍTÁSA

Terv kezdete: 2026-05-11 (H1 hétfő). Hetekre bontás:
- H1: 05-11–05-17 | H2: 05-18–05-24 | H3: 05-25–05-31 | H4: 06-01–06-07
- H5: 06-08–06-14 | H6: 06-15–06-21 | H7: 06-22–06-28 | H8: 06-29–07-05
- H9: 07-06–07-12 | H10: 07-13–07-19 | H11: 07-20–07-26 | H12: 07-27–08-02
- H13: 08-03–08-09 | H14: 08-10–08-16 | H15: 08-17–08-23 | H16: 08-24–08-30 | H17: 08-31–09-06

Pontosan számítsd ki, melyik hétben vagyunk és hány futás van már a héten.

---

## 3. HETI TERVEK (futások)

H1 (28km): K 7km Z1-Z2 | Sze 6km Z1+strides | Cs 5km Z1 | Szo 10km Z1
H2 (32km): K 8km Z1-Z2 | Sze 7km Z1+strides | Cs 5km Z1 | Szo 12km Z1
H3 (36km): K 9km Z1-Z2 | Sze 7km Z1+strides | Cs 6km Z1 | Szo 14km Z1-Z2
H4 (27km): K 7km Z1 | Sze 6km Z1+strides | Cs 4km Z1 | Szo 10km Z1
H5 (37km): K 8km Z1-Z2 | Sze 9km (2km bemu+5km@4:45+2km lev) | Cs 4km Z1 | Szo 16km Z1-Z2
H6 (42km): K 9km Z1-Z2 | Sze 10km (2km bemu+6km@4:42+2km lev) | Cs 5km Z1 | Szo 18km Z2
H7 (46km): K 10km Z1-Z2 | Sze 11km (2km bemu+7km@4:40+2km lev) | Cs 5km Z1 | Szo 20km Z2
H8 (34km): K 7km Z1 | Sze 6km Z1 | Cs 4km Z1 | Szo 17km Z1
H9 (42km): K 9km Z1-Z2 | Sze 5×800m@4:05/km | Cs 5km Z1 | Szo 18km Z2
H10 (46km): K 10km Z1-Z2 | Sze 6×800m@4:03/km | Cs 5km Z1 | Szo 20km Z2
H11 (50km): K 12km Z1-Z2 | Sze 3×1600m@4:08/km | Cs 5km Z1 | Szo 21km Z2
H12 (37km): K 8km Z1 | Sze 7km Z1 | Cs 4km Z1 | Szo 18km Z1
H13 (41km): K 8km Z1-Z2 | Sze 7km@4:32/km | Cs 5km Z1 | Szo 17km (utolsó 5km@4:30)
H14 (36km): K 7km Z1-Z2 | Sze 5km@4:30/km | Cs 5km Z1 | Szo 15km Z2
H15 (24km): K 6km Z1-Z2 | Sze 3km@4:32/km | Cs 5km Z1 | Szo 6km Z1
H16 (12km): K 5km Z1 | Sze 4km+strides | Szo 3km Z1
H17: K 3km Z1 | Cs aktiváció | V VERSENY (09-06)

---

## 4. HÁTTÉRPROFIL (kontextus az elemzéshez)

- Előző HM: 4:37/km (2025-04-13), versenyeken max HR 179 bpm
- VO₂ Max csúcs: 56,8 (2025 március); terv kezdeti szint: ~45,1; cél VDOT: ~52 (4:30/km HM-hez)
- Jobb térd sérülés: 2026 márc–ápr, 45 napos kihagyás — ha a hosszú futások kapcsán térdjelzés jön, rögtön jelezd
- HR zónák: Z1 ≤144 bpm | Z2 145–160 bpm | Z3+ 161+ bpm
- Alap fázis avg HR plafon: 150 bpm (Alap, Recovery hetek könnyű futásain)
- Strides/intervallum max HR spike irreleváns (túl rövid)
- Drift a hosszú futás utolsó 20-30%-ában max 155-ig OK

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

Az első és legutóbbi érték különbségét emeld ki. Számítsd ki: jelenlegi → 52,0 cél = X egység hiány.

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
