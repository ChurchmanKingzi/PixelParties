'use strict';
// Potion Juggler (Creature, Summoning Magic Lv1, 50 HP): „You may delete a Potion from your hand or discard pile to summon this Creature as an
// additional Action. You may once per turn delete the top 2 cards from your Potion Deck to draw a card from your Potion Deck."
// Geprüft wird der ECHTE Spielweg (`host.doPlayCreature`, `host.doActivateCreatureEffect`) mit gescripteten Antworten.
//   node scripts/skilltest-e2e/potion-juggler.test.js
process.env.PP_ST_SIM = '1';
const fs = require('fs');
const path = require('path');
const { runGame } = require('../../skilltest/sim');
const { loadCardEffect } = require('../../cards/effects/_loader');
let fails = 0;
const check = (name, cond, info) => { if (cond) console.log('  ✓', name); else { fails++; console.log('  ✗', name, info !== undefined ? '→ ' + JSON.stringify(info).slice(0, 300) : ''); } };

const JUG = 'Potion Juggler';
const DB = require('../../cards/effects/_card-db').getCardDB();
const potions = Object.values(DB).filter(c => c.cardType === 'Potion' && c.subtype === 'Normal').sort((a, b) => a.name.localeCompare(b.name)).map(c => c.name);
const [P1, P2, P3, P4, P5] = potions;

/** Spiel mit zwei Sitzen: Sitz 0 am Zug, Held 0 hat Summoning Magic Lv1. `phase` 2 = Main, 3 = Action. */
async function fresh(opts = {}) {
  const oL = console.log, oE = console.error; console.log = () => {}; console.error = () => {};
  let out;
  try { out = await runGame({ seats: 2, setupOnly: true, noProfileSeats: [0, 1], seed: 11 }); }
  finally { console.log = oL; console.error = oE; }
  const { room, host, engine, gs } = out;
  gs.turn = 5; gs.activePlayer = 0; gs.currentPhase = opts.phase || 2; gs.firstTurnProtectedPlayer = null;
  for (const c of engine.cardInstances.filter(c => c.zone === 'support' || c.zone === 'surprise' || c.zone === 'hand')) engine._untrackCard(c.id);
  const [p0, p1] = gs.players;
  for (const ps of [p0, p1]) {
    ps.supportZones = ps.supportZones.map(() => [[], [], []]);
    ps.surpriseZones = ps.surpriseZones.map(() => []);
    for (const h of ps.heroes) { h.hp = 800; h.maxHp = 800; h.statuses = {}; }
    ps.hand = []; ps.discardPile = []; ps.deletedPile = []; ps.potionDeck = [];
    ps.heroesActedThisTurn = [];
    ps.abilityZones = ps.abilityZones.map(() => [[], [], []]);
  }
  if (opts.sm !== false) p0.abilityZones[0] = [['Summoning Magic'], [], []];
  const t = { room, host, engine, gs, p0, p1, events: [], prompts: [], antwort: null };
  const origPg = engine.promptGeneric.bind(engine);
  engine.promptGeneric = async (pi, d, ...r) => {
    t.prompts.push({ pi, d });
    if (t.antwort) { const a = t.antwort(pi, d); if (a !== undefined) return a; }
    return origPg(pi, d, ...r);
  };
  const origBc = engine._broadcastEvent.bind(engine);
  engine._broadcastEvent = (ev, data, ...r) => { t.events.push({ ev, data }); return origBc(ev, data, ...r); };
  return t;
}
/** Hand mit allen Karten als getrackte Instanzen (wie im echten Spiel). */
function setzeHand(t, names) {
  t.p0.hand = [...names];
  for (const n of names) t.engine._trackCard(n, 0, 'hand');
}
const spiele = (t, handIndex = 0, zoneSlot = 0) => t.host.doPlayCreature(t.room, 0, { cardName: JUG, handIndex, heroIdx: 0, zoneSlot });
const aufBrett = (t) => t.engine.cardInstances.some(c => c.name === JUG && c.zone === 'support');
const galerie = (t) => t.prompts.filter(p => p.d.type === 'cardGallery' && p.d.title === JUG);
const wahlPotion = (name, source) => (pi, d) => (d.type === 'cardGallery' && d.title === JUG) ? { cardName: name, source } : undefined;
const anims = (t, typ) => t.events.filter(e => e.ev === 'play_zone_animation' && e.data.type === typ).map(e => e.data);

(async () => {
  console.log('Karte, Kunst und Skript');
  {
    const cd = DB[JUG], s = loadCardEffect(JUG);
    check('Creature, Normal, Lv1, Summoning Magic, 50 HP', cd && cd.cardType === 'Creature' && cd.level === 1 && cd.hp === 50 && cd.spellSchool1 === 'Summoning Magic', cd);
    check('Kartentext: oberste 2 Karten (nicht mehr 3) löschen, 1 ziehen', cd && /delete the top 2 cards from your Potion Deck to draw a card from your Potion Deck\./.test(cd.effect) && /delete a Potion from your hand or discard pile to summon this Creature as an additional Action/.test(cd.effect), cd && cd.effect);
    check('Skript: `inherentAction` (Funktion), `beforeSummon`, Kreatureneffekt, kein Stufen-Bypass', typeof s.inherentAction === 'function' && typeof s.beforeSummon === 'function' && s.creatureEffect === true && typeof s.canBypassLevelReq !== 'function');
    const idx = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/card-art/index.json'), 'utf8'));
    check('Kunst nativ 76×51 im Index und als Datei', idx[JUG] && idx[JUG].kind === 'a' && fs.existsSync(path.join(__dirname, '../../data/card-art/native', idx[JUG].id + '.png')));
  }
  console.log(`(Testkarten: Potions ${[P1, P2, P3, P4, P5].join(', ')})`);

  console.log('inherentAction je Lage');
  {
    const s = loadCardEffect(JUG);
    const t = await fresh({ phase: 2 });
    const ia = () => s.inherentAction(t.gs, 0, 0, t.engine);
    check('Main Phase, keine Potion: nein', ia() === false);
    t.p0.hand = [P1];
    check('Main Phase, Potion auf der Hand: ja', ia() === true);
    t.p0.hand = []; t.p0.discardPile = [P1];
    check('Main Phase, Potion nur in der Ablage: ja', ia() === true);
    t.p0.discardPile = ['Fireball'];
    check('Main Phase, nur eine Nicht-Potion in der Ablage: nein', ia() === false);
    t.p0.hand = [P1]; t.gs.currentPhase = 3;
    check('Action Phase mit freier Aktion: nein (beide Wege möglich — `beforeSummon` fragt)', ia() === false);
    t.p0.heroesActedThisTurn = [0];
    check('Action Phase, Aktion schon verbraucht: ja (die Zusatzaktion ist der einzige Weg)', ia() === true);
  }

  console.log('Main Phase: Potion löschen, Juggler beschwören');
  {
    const t = await fresh({ phase: 2 });
    setzeHand(t, [JUG, P1, P2]);
    t.p0.discardPile = [P3];
    t.antwort = wahlPotion(P2, 'hand');
    const r = await spiele(t);
    const g = galerie(t)[0];
    check('die Beschwörung läuft, der Juggler liegt auf dem Brett', r !== false && aufBrett(t), r);
    check('die Galerie bietet Potions aus HAND und ABLAGE an (beide Quellen)', !!g && g.d.cards.some(c => c.name === P1 && c.source === 'hand') && g.d.cards.some(c => c.name === P2 && c.source === 'hand') && g.d.cards.some(c => c.name === P3 && c.source === 'discard'), g && g.d.cards);
    check('die gewählte Potion ist GELÖSCHT (Gelöscht-Stapel), nicht in der Ablage', t.p0.deletedPile.includes(P2) && !t.p0.discardPile.includes(P2) && !t.p0.hand.includes(P2), { gel: t.p0.deletedPile, abl: t.p0.discardPile, hand: t.p0.hand });
    check('die andere Potion bleibt, der Juggler hat die Hand verlassen', t.p0.hand.length === 1 && t.p0.hand[0] === P1, t.p0.hand);
    check('es war eine Zusatzaktion: der Held gilt nicht als gehandelt', t.p0.heroesActedThisTurn.length === 0, t.p0.heroesActedThisTurn);
  }
  {
    const t = await fresh({ phase: 2 });
    setzeHand(t, [JUG]);
    t.p0.discardPile = [P1, 'Fireball'];
    t.antwort = wahlPotion(P1, 'discard');
    await spiele(t);
    check('Potion aus der ABLAGE: gelöscht, Juggler auf dem Brett', aufBrett(t) && t.p0.deletedPile.includes(P1) && !t.p0.discardPile.includes(P1) && t.p0.discardPile.includes('Fireball'), { gel: t.p0.deletedPile, abl: t.p0.discardPile });
  }
  {
    const t = await fresh({ phase: 2 });
    setzeHand(t, [JUG, P1]);
    t.antwort = (pi, d) => (d.type === 'cardGallery' && d.title === JUG) ? { cancelled: true } : undefined;
    await spiele(t);
    check('Abbruch der Galerie: keine Beschwörung, Juggler und Potion bleiben auf der Hand', !aufBrett(t) && t.p0.hand.includes(JUG) && t.p0.hand.includes(P1) && t.p0.deletedPile.length === 0, { hand: t.p0.hand, gel: t.p0.deletedPile });
  }
  {
    const t = await fresh({ phase: 2 });
    setzeHand(t, [JUG]);
    const r = await spiele(t);
    check('Main Phase ohne Potion: der Juggler ist nicht spielbar', r === false && !aufBrett(t) && t.p0.hand.includes(JUG), r);
  }
  {
    const t = await fresh({ phase: 2, sm: false });
    setzeHand(t, [JUG, P1]);
    const r = await spiele(t);
    check('die Stufe bleibt Pflicht: ohne Summoning Magic Lv1 geht es auch mit Potion nicht', r === false && !aufBrett(t) && t.p0.hand.includes(P1), r);
  }

  console.log('Action Phase: zwei Wege');
  {
    const t = await fresh({ phase: 3 });
    setzeHand(t, [JUG, P1]);
    t.antwort = (pi, d) => {
      if (d.type === 'confirm' && d.title === JUG) return true;                      // Special
      if (d.type === 'cardGallery' && d.title === JUG) return { cardName: P1, source: 'hand' };
      return undefined;
    };
    await spiele(t);
    check('„Special“: Potion gelöscht, Juggler auf dem Brett', aufBrett(t) && t.p0.deletedPile.includes(P1), { gel: t.p0.deletedPile });
    check('…und die Aktion ist ZURÜCK (Held nicht gehandelt, Action Phase offen)', t.p0.heroesActedThisTurn.length === 0 && t.gs.currentPhase === 3, { acted: t.p0.heroesActedThisTurn, phase: t.gs.currentPhase });
    check('die Frage nannte beide Wege und war nicht gerrymander-fähig', t.prompts.some(p => p.d.type === 'confirm' && p.d.title === JUG && /Special/.test(p.d.confirmLabel) && /Normal/.test(p.d.cancelLabel) && p.d.gerrymanderEligible === false));
  }
  {
    const t = await fresh({ phase: 3 });
    setzeHand(t, [JUG, P1]);
    t.antwort = (pi, d) => (d.type === 'confirm' && d.title === JUG) ? false : undefined;      // Normal
    await spiele(t);
    check('„Normal“: keine Potion gelöscht, Juggler auf dem Brett, die Aktion des Helden ist VERBRAUCHT', aufBrett(t) && t.p0.deletedPile.length === 0 && t.p0.hand.includes(P1) && t.p0.heroesActedThisTurn.length === 1, { gel: t.p0.deletedPile, acted: t.p0.heroesActedThisTurn });
  }
  {
    const t = await fresh({ phase: 3 });
    setzeHand(t, [JUG, P1]);
    t.p0.heroesActedThisTurn = [0];                                                    // Aktion schon verbraucht → nur die Zusatzaktion
    t.antwort = wahlPotion(P1, 'hand');
    await spiele(t);
    check('Aktion schon verbraucht: keine Zweiwegefrage, die Potion wird verlangt und gelöscht', aufBrett(t) && t.p0.deletedPile.includes(P1) && !t.prompts.some(p => p.d.type === 'confirm' && p.d.title === JUG), { gel: t.p0.deletedPile, prompts: t.prompts.map(p => p.d.type) });
  }
  {
    const t = await fresh({ phase: 3 });
    setzeHand(t, [JUG]);
    await spiele(t);
    check('Action Phase ohne Potion: der normale Weg (kostet die Aktion, keine Frage)', aufBrett(t) && t.p0.heroesActedThisTurn.length === 1 && t.prompts.length === 0, { acted: t.p0.heroesActedThisTurn, prompts: t.prompts.map(p => p.d.type) });
  }

  console.log('Einmal pro Zug: oberste 2 Karten löschen, 1 ziehen');
  const mitJuggler = async (opts = {}) => {
    const t = await fresh({ phase: opts.phase || 2 });
    t.p0.potionDeck = opts.deck || [P1, P2, P3, P4, P5];
    const inst = t.engine._trackCard(JUG, 0, 'support', 0, 0);
    t.p0.supportZones[0][0] = [JUG];
    inst.turnPlayed = 1;
    return { t, inst };
  };
  const aktivieren = (t) => t.host.doActivateCreatureEffect(t.room, 0, { heroIdx: 0, zoneSlot: 0 });
  {
    const { t } = await mitJuggler();
    t.engine.gs.skillTest = null;                                                      // Normalspiel: das Potion Deck bleibt, wie es ist (im Skill Test räumt der Zieh-Wrapper es auf)
    const r = await aktivieren(t);
    check('die Aktivierung läuft', r !== false, r);
    check('die obersten 2 Karten (P1, P2) sind gelöscht, in dieser Reihenfolge', t.p0.deletedPile.slice(-2).join() === [P1, P2].join(), t.p0.deletedPile);
    check('…danach wurde EINE Karte aus dem Potion Deck gezogen (die dritte, P3)', t.p0.hand.length === 1 && t.p0.hand[0] === P3 && t.p0.potionDeck.join() === [P4, P5].join(), { hand: t.p0.hand, deck: t.p0.potionDeck });
    const a = anims(t, 'potion_juggle');
    check('Animation `potion_juggle` am Platz des Jonglierers (Held 0, Platz 0)', a.length === 1 && a[0].owner === 0 && a[0].heroIdx === 0 && a[0].zoneSlot === 0, a);
    const r2 = await aktivieren(t);
    check('ein zweiter Einsatz in demselben Zug ist gesperrt', r2 === false || (t.p0.hand.length === 1 && t.p0.potionDeck.length === 2), { r2, hand: t.p0.hand, deck: t.p0.potionDeck });
  }
  {
    const { t } = await mitJuggler({ deck: [P1, P2] });
    t.engine.gs.skillTest = null;                                                      // Normalspiel: das Deck ist, was es ist
    await aktivieren(t);
    check('nur 2 Karten im Potion Deck: nicht aktivierbar (nichts gelöscht, nichts gezogen)', t.p0.deletedPile.length === 0 && t.p0.potionDeck.length === 2 && t.p0.hand.length === 0, { gel: t.p0.deletedPile, deck: t.p0.potionDeck });
  }
  {
    const { t } = await mitJuggler();
    t.p0.drawLocked = true;
    await aktivieren(t);
    check('Zieh-Sperre: nicht aktivierbar (nichts gelöscht)', t.p0.deletedPile.length === 0 && t.p0.potionDeck.length === 5, { gel: t.p0.deletedPile });
  }
  {
    const { t } = await mitJuggler();
    t.p0.potionDrawBanned = true;
    await aktivieren(t);
    check('„nie aus dem Potion Deck ziehen“ (Chaos-Diamant): nicht aktivierbar', t.p0.deletedPile.length === 0 && t.p0.potionDeck.length === 5, { gel: t.p0.deletedPile });
  }
  {
    // Skill Test: das Potion Deck ist im Ruhezustand leer — die Karten kommen aus dem Pool, die gelöschten verlassen ihn
    const { t } = await mitJuggler({ deck: [] });
    check('Skill Test: der Sim-Modus ist aktiv', !!t.gs.skillTest);
    await aktivieren(t);
    check('Skill Test: 2 Karten gelöscht, 1 gezogen, das Potion Deck bleibt danach leer', t.p0.deletedPile.length === 2 && t.p0.hand.length === 1 && t.p0.potionDeck.length === 0, { gel: t.p0.deletedPile, hand: t.p0.hand, deck: t.p0.potionDeck });
    check('…und es sind Potions', [...t.p0.deletedPile, ...t.p0.hand].every(n => DB[n] && DB[n].cardType === 'Potion'), [...t.p0.deletedPile, ...t.p0.hand]);
  }

  console.log('CPU-Wahl (ohne Gehirn)');
  {
    const s = loadCardEffect(JUG);
    const t = await fresh();
    const g = s.cpuResponse(t.engine, 'generic', { type: 'cardGallery', title: JUG, cards: [{ name: P1, source: 'hand', count: 1 }, { name: P2, source: 'discard', count: 1 }] });
    check('bevorzugt die Potion aus der Ablage', g && g.cardName === P2 && g.source === 'discard', g);
    const c = s.cpuResponse(t.engine, 'generic', { type: 'confirm', title: JUG });
    check('wählt „Special“ (kostenlose Zusatzaktion)', c && c.confirmed === true, c);
    check('fremde Fragen lässt sie unberührt', s.cpuResponse(t.engine, 'generic', { type: 'confirm', title: 'Anderes' }) === undefined);
  }

  console.log(fails ? `${fails} Prüfung(en) FEHLGESCHLAGEN` : '✓ Potion-Juggler-Tests grün');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
