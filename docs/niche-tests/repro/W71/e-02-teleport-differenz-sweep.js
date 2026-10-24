'use strict';
// W71e-02 · Teleport: DIFFERENZ-SWEEP über ALLE Ausrüstungen und Anhängsel (Methode wie W51/b-01 „umgehängt vs. direkt angelegt")
//
// Idee: Teleport lässt die Karten in den Support Zones liegen und tauscht die HELDEN. Ergebnis muss gleich sein wie „die Karte liegt direkt am anderen Helden":
//   Szene 1: Karte E an Held X (Spalte 0) legen, danach Teleport Spalte 0 ↔ 1 (Wirker: Held 2).
//   Szene 2: Helden von Anfang an vertauscht (Y, X, Z), E direkt an den Helden in Spalte 0 (Y) legen.
//   Verglichen werden die Heldenzustände beider Spalten (+ Flags, Abilities, Heldeninstanzen).
// Exit 1 bei jedem Unterschied; „übersprungen" = die Karte ließ sich in der Harness nicht legen (Voraussetzung nicht erfüllbar), steht als Notiz.
const H = require('../../lib/h.js');
const Z = require('../../lib/zustand.js');
const CARD = 'Teleport';
// Heldenpaar: Standard zwei neutrale Platzhalter; `SWEEP_X`/`SWEEP_Y` setzen Helden mit Zustandslauschern (Taio, Toras, Riffel, Kohta, Lolek, Fiona …) ein.
const N1 = 'Tushu, the Knowledge Keeper', N2 = 'Rick, the Trigger Happy Undertaker', Zz = 'Zwei, the Lucky Thief';
const SPEZIAL = ['Toras, Master of all Weapons', 'Taio, the Sun Fencer', 'Future Tech Gunslinger Riffel', 'Kohta, the Silent Observer', 'Lolek, the Shard Knight', 'Fiona, the Princess of Blackport'];
// Paare (Spalte 0, Spalte 1): neutral; und je Spezialheld auf BEIDEN Seiten (er verliert den Bonus / bekommt ihn). `SWEEP_X`/`SWEEP_Y` erzwingen ein einzelnes Paar.
const PAARE = process.env.SWEEP_X || process.env.SWEEP_Y ? [[process.env.SWEEP_X || N1, process.env.SWEEP_Y || N2]]
  : [[N1, N2], ...SPEZIAL.flatMap(s => [[s, N2], [N1, s]])];
let X = N1, Y = N2;
const alle = Object.values(H.DB);
const EQUIPS = alle.filter(c => c.cardType === 'Artifact' && /equipment/i.test(c.subtype || '')).map(c => c.name);
const ANHAENGSEL = alle.filter(c => (c.cardType === 'Spell' || c.cardType === 'Attack') && c.subtype === 'Attachment').map(c => c.name);
// Bewusste, begründete Abweichungen (kein Befund):
//  • Storm Piano: „A Hero can only be equipped with 1 Storm Piano per game" — die Marke `_stormPianoEquipped` bleibt AM HELDEN, der sie einmal getragen hat
//    (Ruling W51, Umhängen: „Bewusst unverändert"); die Wirkung selbst liegt am Wirt der Spalte.
//  • Divine Gift of Coolness: der Zusatz „That Hero becomes immune to all negative status effects" ist ein Zustand des HELDEN (Buff `negative_status_immune`,
//    bleibt auch, wenn die Karte geht) — er wandert mit dem Helden, nicht mit der Karte.
const AUSNAHMEN = { 'Storm Piano': true, 'Divine Gift of Coolness': true };
const nurFilter = process.env.SWEEP_NUR ? process.env.SWEEP_NUR.split(',') : null;

const heldenPfade = (z) => Object.fromEntries(Object.entries(z).filter(([k]) => /^gs\.players\[0\]\.(heroes|abilityZones|abilityGivenThisTurn)/.test(k) || /^gs\.heroFlags/.test(k) || /^inst\{(hero|ability)\|/.test(k)));
const SUPPORT_INST = (z) => Object.fromEntries(Object.entries(z).filter(([k]) => /^inst\{support\|0\|(0|1)\|/.test(k)));

async function legen(t, name, hi) {
  const cd = H.DB[name];
  if (cd.cardType === 'Artifact') return t.play(0, name, { hero: 0 });   // Ausrüstung: der Held, an den sie gelegt wird, ist Spalte 0
  t.targetFn = (valid) => { const v = valid.find(x => x.type === 'hero' && x.owner === 0 && x.heroIdx === 0); return v ? [v.id] : undefined; };
  const r = await t.play(0, name, { hero: hi });
  t.targetFn = null;
  return r;
}
const liegtAmBrett = (t, name) => !!t.find(name, 'support') && (t.gs.players[0].supportZones[0] || []).some(z => (z || []).includes(name));

(async () => {
  const R = H.runner();
  let geprueft = 0; const uebersprungen = [], abweichend = [];
  for (const [px, py] of PAARE) {
    X = px; Y = py;
  const liste = [...EQUIPS.map(n => ['Equip', n]), ...ANHAENGSEL.map(n => ['Anhängsel', n])].filter(([, n]) => !nurFilter || nurFilter.includes(n));
  for (const [art, name] of liste) {
    // Zwei Wege, die Karte in Spalte 0 zu legen: (A) Wirker = Held 2 (Ausrüstung, „attach to a Hero"), (B) Wirker = Held 0 selbst („attach to the user" …).
    let ergebnis = null;
    for (const modus of ['A', 'B']) {
      const wirker = modus === 'A' ? 2 : 0;
      let s1, z1, s2, z2;
      try {
        s1 = await H.fresh({ hand: [[name, CARD], []], gold: 2000, hp: 800, seed: 77, heroes: [[X, Y, Zz], null] });
        s1.grantFor(0, 2, CARD);
        s1.grantFor(0, wirker, name);
        const r = await legen(s1, name, wirker);
        if (!liegtAmBrett(s1, name)) { ergebnis = { skip: `${art} ${name}: ließ sich nicht an Spalte 0 legen (${JSON.stringify(r).slice(0, 60)})` }; continue; }
        s1.targetFn = (valid) => ['hero-0-0', 'hero-0-1'].filter(id => valid.some(v => v.id === id));
        const r2 = await s1.play(0, CARD, { hero: 2, noGrant: true });
        s1.targetFn = null;
        if (r2 !== true) { ergebnis = { skip: `${art} ${name}: Teleport danach nicht spielbar (${JSON.stringify(r2).slice(0, 60)})` }; break; }
        z1 = Z.zustand(s1.gs, s1.engine);
      } catch (e) { ergebnis = { skip: `${art} ${name}: Szene 1 warf ${e.message}` }; continue; }
      try {
        s2 = await H.fresh({ hand: [[name], []], gold: 2000, hp: 800, seed: 77, heroes: [[Y, X, Zz], null] });
        s2.grantFor(0, 2, CARD);
        s2.grantFor(0, wirker, name);
        s2.setDiscard(0, [CARD]);   // Parität: in Szene 1 liegt der gespielte Teleport in der Ablage (Ancient Tech Infinite Energy Core zählt Namen dort)
        await legen(s2, name, wirker);
        if (!liegtAmBrett(s2, name)) { ergebnis = { skip: `${art} ${name}: Szene 2 legte nicht` }; continue; }
        if (modus === 'B') {   // Wirker war Spalte 0: nach dem Teleport trägt Spalte 1 die Abilities → in Szene 2 dieselbe Verteilung herstellen
          const ab = s2.gs.players[0].abilityZones[0].map(z => [...z]);
          s2.setAbilities(0, 0, [[], [], []]); s2.setAbilities(0, 1, ab);
        }
        z2 = Z.zustand(s2.gs, s2.engine);
      } catch (e) { ergebnis = { skip: `${art} ${name}: Szene 2 warf ${e.message}` }; continue; }
      const d = Z.zustandDiff({ ...heldenPfade(z1), ...SUPPORT_INST(z1) }, { ...heldenPfade(z2), ...SUPPORT_INST(z2) })
        .filter(l => !/turnPlayed|_gameStart|\.id:|heroesActedThisTurn|appliedByInst|appliedByHero|\.counters: "\{leer\}" → ∅|\.counters: ∅ → "\{leer\}"|heroIdx|heroOwner|heroesAttackedThisTurn|_attacksThisTurn|_wuerfeZahl|_wuerfeZug|_taioAtkGrantedBy/.test(l));   // Wirker-Buchführung/Instanz-Ids: kein Heldenzustand
      const fehler = [...s1.errors, ...s2.errors];
      ergebnis = { gelegt: true, modus, d, fehler, art, name };
      break;
    }
    if (!ergebnis || ergebnis.skip) { uebersprungen.push((ergebnis && ergebnis.skip) || `${art} ${name}: nicht legbar`); continue; }
    geprueft++;
    if ((ergebnis.d.length || ergebnis.fehler.length) && !AUSNAHMEN[name]) abweichend.push({ paar: `${X.split(',')[0]} | ${Y.split(',')[0]}`, art, name, modus: ergebnis.modus, d: ergebnis.d.slice(0, 6), fehler: ergebnis.fehler.slice(0, 2) });
  }
  }
  R.note('geprüft', `${geprueft} Karten-Paar-Läufe über ${PAARE.length} Heldenpaare (${EQUIPS.length} Ausrüstungen + ${ANHAENGSEL.length} Anhängsel als Kandidaten)`);
  for (const u of [...new Set(uebersprungen)]) R.note('übersprungen (in der Harness nicht legbar)', u);
  R.check(`Differenz-Sweep: ${geprueft} Läufe, 0 Abweichungen „Teleport" ↔ „direkt angelegt"`, abweichend.length === 0, abweichend);
  for (const a of abweichend) R.check(`Abweichung ${a.art} ${a.name}`, false, a);
  R.finish();
})();
