'use strict';
// W53a · Punkt 2 (Al, 22.10.2026) zu Cybug RHINOCEROS beim Anlegen eines Initiation-Helden: „Ja, was als Artifact gezählt wird, feuert on-artifact-equipped."
//   Keine Code-Änderung nötig (W52a hat Cybug LOCUST/RHINOCEROS, Anti Magic Enchantment, Lunatic Hawk schon über `engine.istEquipArtifact` verdrahtet). Dieser Test belegt das Ruling als ALLGEMEINE Regel:
//   JEDER Beobachter, der auf „Artifact equipped" lauscht, behandelt einen per Initiation Ritual angelegten Helden („treated as an equippable Artifact") exakt wie ein Hand-Equip (Club of Gobbo) —
//   auf JEDEM Weg, auf dem ein Equip ankommt: Hand-Equip / Initiation Ritual · Umhängen per Slippery Fridge · Umhängen per Inheritance Ceremony.
// Beobachter (alle, die es gibt): Afflicted Pests (Surprise), Cybug LOCUST (Surprise), Cybug RHINOCEROS (Surprise, Platzierungsfenster), Anti Magic Enchantment (Reaktion auf der Hand, Hook `onEquipGained`),
//   Lunatic Hawk 2+ (Creature, Hook `onEquipGained`). Gegenprobe: Tempelunas angehängte Fee ist KEIN Artifact — keiner feuert (Hand-Weg).
//   (Crash Landing — „Play this card immediately when an Artifact is equipped" — hat in diesem Stand KEIN Skript, siehe Bericht.)
// Differenz-Test, beide Sitze: Ergebnis(Initiation-Held) == Ergebnis(Club) je Beobachter und Weg. Exit 0 = korrekt.
const H = require('../../lib/h.js');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
const U = require('../../lib/umhaengen.js');
const PESTS = 'Afflicted Pests', LOC = 'Cybug LOCUST', RHINO = 'Cybug RHINOCEROS', AME = 'Anti Magic Enchantment', HAWK = 'Lunatic Hawk', CLUB = 'Club of Gobbo', INIT = 'Initiation Ritual';
const FUEL_LOC = "Treasure Hunter's Backpack", FUEL_RHINO = 'Excavator Bucket', FEE = 'Maya, the Nature Fairy', TEMPELUNA = 'Tempeluna, the Convergence Fairy', ATTA = 'Atta, Speaker of Desires';
const OBS = [PESTS, LOC, RHINO, AME, HAWK];

async function initiation(t, A, S) {
  await t.run(() => t.engine.actionDealDamage({ name: 'x', owner: S }, t.hero(A, 1), 9999, 'true'));
  t.gs.turn = 7; t.hero(A, 1).diedOnTurn = 5;
  t.reset();
  const r = await t.play(A, INIT, { noAutoConfirm: true });
  let pt = t.gs.potionTargeting;
  const v = (pt && pt.validTargets || []).filter(x => !x.ineligible).find(x => x.type === 'hero' && x.heroIdx === 1);
  if (v) await t.run(() => t.host.doConfirmPotion(t.room, A, { selectedIds: [v.id] }));
  pt = t.gs.potionTargeting;
  if (pt) { const w = (pt.validTargets || []).filter(x => !x.ineligible).find(x => x.heroIdx === 0 && (x.type === 'hero' || x.type === 'equip')); if (w) await t.run(() => t.host.doConfirmPotion(t.room, A, { selectedIds: [w.id] })); }
  return r;
}

/**
 * Eine Szene. A = Anlegender/Ausführender, S = Beobachter-Besitzer. `art`: 'club' | 'init' | 'fee'; `weg`: 'hand' | 'fridge' | 'ceremony'.
 * Beobachter-Surprise (Pests/LOCUST/RHINO) liegt bei S auf Held 2; AME + Brennstoff auf S' Hand; der Hawk (mit zwei Lunatic Cycles) liegt bei A auf Held 2 (zieht A).
 * Rückgabe: { feuert(obs) }.
 */
async function szene(A, S, obs, art, weg) {
  const hand = [[], []];
  hand[S].push(FUEL_LOC, FUEL_RHINO, AME);
  if (weg === 'hand' && art === 'init') hand[A].push(INIT);
  if (weg === 'hand' && art === 'club') hand[A].push(CLUB);
  if (weg === 'hand' && art === 'fee') hand[A].push(FEE);
  if (weg === 'fridge') hand[A].push(U.F);
  if (weg === 'ceremony') hand[A].push(U.C);
  const heroes = [null, null];
  if (art === 'fee') heroes[A] = [TEMPELUNA, 'Tushu, the Knowledge Keeper', 'Zwei, the Lucky Thief'];
  const t = await H.fresh({ hand, gold: [800, 800], deckSize: 30, active: A, ...(art === 'fee' ? { heroes } : {}), abilities: weg === 'hand' && art === 'init' ? { [A]: { 1: [['Fighting', 'Fighting'], ['Luck'], []] } } : {} });
  t.script.push({ match: d => d.type === 'confirm', answer: () => false });                                       // alles ablehnen: gemessen wird nur, ob angeboten wird
  t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ cardName: FEE, source: 'hand' }) });
  const vorherT = t.targetFn;
  t.targetFn = (v, cfg) => (cfg && cfg.title === PESTS) ? [(v.find(x => x.cardName === H.INERT.creature) || v[0]).id] : (vorherT ? vorherT(v, cfg) : undefined);
  t.put(S, 0, 0, H.INERT.creature);   // Pests braucht ein Ziel
  if (obs === HAWK) { t.put(A, 2, 0, HAWK); t.put(A, 2, 1, 'Lunatic Cycle - Crescent Moon'); t.put(A, 2, 2, 'Lunatic Cycle - Full Moon'); }
  else if (obs !== AME) { t.putSurprise(S, 2, obs); t.grantFor(S, 2, obs); }
  const drawVor = t.pile(A, 'hand').length;
  let r;
  if (weg === 'hand') {
    if (art === 'club') { t.reset(); r = await t.play(A, CLUB, { hero: 0, slot: 0 }); }
    else if (art === 'init') r = await initiation(t, A, S);
    else { await t.run(() => t.engine.runHooks('onGameStart', {})); t.reset(); r = await t.activateHero(A, 0, {}); }
  } else {
    // Umhängen: das Stück liegt an Held 0 (Club bzw. als Equip angelegter Held), Zielheld 1
    const stueck = art === 'club' ? CLUB : ATTA;
    t.put(A, 0, 0, stueck, art === 'club' ? { counters: {} } : { counters: { treatAsEquip: true } });
    const drawVor2 = t.pile(A, 'hand').length;
    t.reset();
    r = await U.bewege(t, A, weg, { name: stueck, nach: 1, von: 0 });
    return { t, r, drawn: t.pile(A, 'hand').length - (drawVor2 - 1), feuert: (o) => fired(t, o, drawVor2 - 1, A) };
  }
  return { t, r, feuert: (o) => fired(t, o, drawVor - (weg === 'hand' ? 1 : 0), A) };
}
/** Hat Beobachter `o` gefeuert? Prompts nach Titel; Hawk über die Handgröße von A (Spielen entnimmt 1, der Hawk legt 1 zurück). */
function fired(t, o, handSollOhneHawk, A) {
  if (o === HAWK) return t.pile(A, 'hand').length > handSollOhneHawk;
  return t.prompts.some(p => p.d && (p.d.title === o || (o === PESTS && /Afflicted Pests/.test(JSON.stringify(p.d)))));
}

(async () => {
  const R = H.runner();
  for (const [A, S] of [[0, 1], [1, 0]]) {
    R.section('Sitz ' + A + ' legt an / bewegt, Sitz ' + S + ' beobachtet');
    const tabelle = {};
    for (const weg of ['hand', 'fridge', 'ceremony']) {
      for (const o of OBS) {
        const club = await szene(A, S, o, 'club', weg);
        const init = await szene(A, S, o, 'init', weg);
        const c = club.feuert(o), i = init.feuert(o);
        tabelle[`${weg}/${o}`] = { club: c, init: i };
        R.check(`${weg} · ${o}: Initiation-Held == Hand-Equip (Club ${c ? 'feuert' : 'feuert nicht'})`, c === i, { club: c, init: i, pc: club.t.prompts.map(p => p.d.title || p.d.type), pi: init.t.prompts.map(p => p.d.title || p.d.type) });
        R.check(`${weg} · ${o}: keine Engine-Fehler (Club, Initiation)`, club.t.errors.length === 0 && init.t.errors.length === 0, { c: club.t.errors, i: init.t.errors });
      }
    }
    // Hand-Weg: JEDER Beobachter feuert für Club UND Initiation-Held (das ist die Regel); Gegenprobe Fee: keiner
    for (const o of OBS) {
      R.check(`Hand-Weg · ${o}: feuert für Hand-Equip UND Initiation-Held`, tabelle[`hand/${o}`].club === true && tabelle[`hand/${o}`].init === true, tabelle[`hand/${o}`]);
      const fee = await szene(A, S, o, 'fee', 'hand');
      R.check(`Gegenprobe · ${o}: Tempelunas angehängte Fee (kein Artifact) löst NICHT aus`, fee.feuert(o) === false && fee.r === true, { f: fee.feuert(o), r: fee.r, p: fee.t.prompts.map(p => p.d.title || p.d.type) });
    }
    R.note(`Beobachter-Tabelle Sitz ${A} (Club | Initiation-Held):`, Object.fromEntries(Object.entries(tabelle).map(([k, v]) => [k, `${v.club ? 'ja' : 'nein'} | ${v.init ? 'ja' : 'nein'}`])));
  }
  R.finish();
})();
