'use strict';
// Sky Shaman (Creature, Normal, Lv0, 50 HP, Summoning Magic): „You may once per turn choose a card from your deck and send it to your discard pile."
// Geprüft wird der ECHTE Spielweg (`host.doActivateCreatureEffect`) mit gescripteten Antworten auf die Deck-Galerie; dazu die CPU-Wahl
// (`_mill-pick-shared.js`) und Cute Nerd Magenta, die dieselbe Wahl seit dem Umbau über den gemeinsamen Helfer trifft.
//   node scripts/skilltest-e2e/sky-shaman.test.js
process.env.PP_ST_SIM = '1';
const fs = require('fs');
const path = require('path');
const { runGame } = require('../../skilltest/sim');
const { loadCardEffect } = require('../../cards/effects/_loader');
let fails = 0;
const check = (name, cond, info) => { if (cond) console.log('  ✓', name); else { fails++; console.log('  ✗', name, info !== undefined ? '→ ' + JSON.stringify(info).slice(0, 300) : ''); } };

const CARD = 'Sky Shaman';
const DB = require('../../cards/effects/_card-db').getCardDB();
const [A, B, C, D] = Object.values(DB).filter(c => c.cardType === 'Spell' && c.subtype === 'Normal' && c.level <= 1 && !/Token/.test(c.name)).sort((a, b) => a.name.localeCompare(b.name)).slice(0, 4).map(c => c.name);

async function fresh(opts = {}) {
  const oL = console.log, oE = console.error; console.log = () => {}; console.error = () => {};
  let out;
  try { out = await runGame({ seats: 2, setupOnly: true, noProfileSeats: [0, 1], seed: 11 }); }
  finally { console.log = oL; console.error = oE; }
  const { room, host, engine, gs } = out;
  gs.turn = 5; gs.activePlayer = 0; gs.currentPhase = opts.phase || 2; gs.firstTurnProtectedPlayer = opts.erstzug ? 0 : null;
  for (const c of engine.cardInstances.filter(c => c.zone === 'support' || c.zone === 'surprise' || c.zone === 'hand')) engine._untrackCard(c.id);
  const [p0, p1] = gs.players;
  for (const ps of [p0, p1]) {
    ps.supportZones = ps.supportZones.map(() => [[], [], []]);
    ps.surpriseZones = ps.surpriseZones.map(() => []);
    for (const h of ps.heroes) { h.hp = 800; h.maxHp = 800; h.statuses = {}; }
    ps.hand = []; ps.discardPile = []; ps.deletedPile = []; ps.heroesActedThisTurn = [];
  }
  p0.mainDeck = [...(opts.deck || [A, B, C, B, D])];
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
function lege(t, slot = 0, heroIdx = 0) {
  const inst = t.engine._trackCard(CARD, 0, 'support', heroIdx, slot);
  t.p0.supportZones[heroIdx][slot] = [CARD];
  inst.turnPlayed = 1;
  return inst;
}
const aktivieren = (t, slot = 0, heroIdx = 0) => t.host.doActivateCreatureEffect(t.room, 0, { heroIdx, zoneSlot: slot });
const galerie = (t) => t.prompts.filter(p => p.d.type === 'cardGallery' && p.d.title === CARD);
const wahl = (name) => (pi, d) => (d.type === 'cardGallery' && d.title === CARD) ? { cardName: name, source: 'deck' } : undefined;
const anims = (t) => t.events.filter(e => e.ev === 'play_zone_animation' && e.data && e.data.type === 'sky_shaman_chant').map(e => e.data);

(async () => {
  console.log('Karte, Kunst und Skript');
  {
    const cd = DB[CARD], s = loadCardEffect(CARD);
    check('Creature, Normal, Lv0, Summoning Magic, 50 HP', cd && cd.cardType === 'Creature' && cd.subtype === 'Normal' && cd.level === 0 && cd.hp === 50 && cd.spellSchool1 === 'Summoning Magic', cd);
    check('Kartentext unverändert', cd && cd.effect === 'You may once per turn choose a card from your deck and send it to your discard pile.', cd && cd.effect);
    check('Skript: Kreatureneffekt mit `canActivateCreatureEffect` und `onCreatureEffect`', s.creatureEffect === true && typeof s.canActivateCreatureEffect === 'function' && typeof s.onCreatureEffect === 'function');
    const idx = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/card-art/index.json'), 'utf8'));
    check('Kunst nativ 76×51 im Index und als Datei', idx[CARD] && idx[CARD].kind === 'a' && fs.existsSync(path.join(__dirname, '../../data/card-art/native', idx[CARD].id + '.png')));
  }
  console.log(`(Testkarten: ${[A, B, C, D].join(', ')})`);

  console.log('Der Effekt');
  {
    const t = await fresh();
    lege(t);
    t.antwort = wahl(B);
    const r = await aktivieren(t);
    const g = galerie(t)[0];
    check('die Aktivierung läuft', r !== false, r);
    check('die Galerie zeigt jede VERSCHIEDENE Deckkarte genau einmal, mit Anzahl (B steht zweimal im Deck)', !!g && g.d.cards.length === 4 && g.d.cards.find(c => c.name === B).count === 2 && g.d.cards.every(c => c.source === 'deck'), g && g.d.cards);
    check('die Galerie ist abbrechbar („you may“)', !!g && g.d.cancellable === true);
    check('genau EINE Kopie von B liegt jetzt in der Ablage, eine bleibt im Deck', t.p0.discardPile.filter(n => n === B).length === 1 && t.p0.mainDeck.filter(n => n === B).length === 1 && t.p0.mainDeck.length === 4, { abl: t.p0.discardPile, deck: t.p0.mainDeck });
    const a = anims(t);
    check('Animation `sky_shaman_chant` als Brett-Animation mit dem Schamanen als Ursprung UND Ziel (Held 0, Platz 0)', a.length === 1 && a[0].zoneType === 'board' && a[0].originOwner === 0 && a[0].originHeroIdx === 0 && a[0].originZoneSlot === 0 && a[0].targets[0].zoneSlot === 0, a);
    const r2 = await aktivieren(t);
    check('ein zweiter Einsatz DESSELBEN Schamanen im selben Zug ist gesperrt', r2 === false || t.p0.discardPile.length === 1, { r2, abl: t.p0.discardPile });
    t.gs.turn = 6;
    t.antwort = wahl(A);
    await aktivieren(t);
    check('im nächsten Zug geht es wieder (A in der Ablage)', t.p0.discardPile.includes(A) && t.p0.discardPile.length === 2, t.p0.discardPile);
  }
  {
    const t = await fresh();
    lege(t, 0); lege(t, 1);
    t.antwort = wahl(C);
    await aktivieren(t, 0);
    t.antwort = wahl(D);
    await aktivieren(t, 1);
    check('zwei Schamanen: jeder darf einmal pro Zug (Ablage hat C und D)', t.p0.discardPile.includes(C) && t.p0.discardPile.includes(D) && t.p0.discardPile.length === 2, t.p0.discardPile);
  }
  {
    const t = await fresh();
    lege(t);
    t.antwort = (pi, d) => (d.type === 'cardGallery' && d.title === CARD) ? { cancelled: true } : undefined;
    await aktivieren(t);
    check('Abbruch in der Galerie: nichts passiert', t.p0.discardPile.length === 0 && t.p0.mainDeck.length === 5, { abl: t.p0.discardPile });
    t.antwort = wahl(A);
    await aktivieren(t);
    check('…und der Effekt ist NICHT verbraucht (danach geht er)', t.p0.discardPile.join() === A, t.p0.discardPile);
  }
  {
    const t = await fresh({ deck: [] });
    lege(t);
    const r = await aktivieren(t);
    check('leeres Deck: nicht aktivierbar, keine Galerie', (r === false || r === undefined || r === null || r) && galerie(t).length === 0 && t.p0.discardPile.length === 0, { r, g: galerie(t).length });
  }
  {
    // gezielter Selbst-Mill schützt sich vor dem Erstzug-Schutz NICHT: das eigene Deck ist immer erlaubt
    const t = await fresh({ erstzug: true });
    lege(t);
    t.antwort = wahl(A);
    await aktivieren(t);
    check('auch unter Erstzug-Schutz des eigenen Spielers geht der eigene Mill (`selfInflicted`)', t.p0.discardPile.includes(A), t.p0.discardPile);
  }
  {
    const t = await fresh();
    lege(t);
    t.p0.searchLocked = true;
    t.antwort = wahl(A);
    await aktivieren(t);
    check('die Such-Sperre stört nicht: die Karte geht nicht auf die Hand (wie The Eye of Ren)', t.p0.discardPile.includes(A), t.p0.discardPile);
  }

  console.log('CPU-Wahl über `_mill-pick-shared.js`');
  {
    const s = loadCardEffect(CARD);
    const t = await fresh();
    const cards = [{ name: A, source: 'deck', count: 1 }, { name: B, source: 'deck', count: 2 }, { name: C, source: 'deck', count: 1 }];
    check('fremde Fragen lässt sie unberührt', s.cpuResponse(t.engine, 'generic', { type: 'cardGallery', title: 'Anderes', cards }) === undefined && s.cpuResponse(t.engine, 'generic', { type: 'confirm', title: CARD }) === undefined);
    check('ohne Auswerter: Standardwahl (undefined)', s.cpuResponse(t.engine, 'generic', { type: 'cardGallery', title: CARD, cards }) === undefined);
    t.engine._cpuPlayerIdx = 0;
    t.engine._cpuEvaluateState = () => (t.p0.discardPile.includes(C) ? 10 : 0) + (t.p0.discardPile.includes(A) ? 3 : 0);
    const g = s.cpuResponse(t.engine, 'generic', { type: 'cardGallery', title: CARD, cards });
    check('wählt die Karte, deren Wechsel in die Ablage den Auswerter am meisten hebt (C)', g && g.cardName === C && g.source === 'deck', g);
    check('…und lässt dabei das Deck unverändert (probeweise entnommen, zurückgelegt)', t.p0.mainDeck.join() === [A, B, C, B, D].join() && t.p0.discardPile.length === 0, { deck: t.p0.mainDeck, abl: t.p0.discardPile });
    t.engine._cpuEvaluateState = () => 0;
    const g0 = s.cpuResponse(t.engine, 'generic', { type: 'cardGallery', title: CARD, cards: [{ name: 'Rebelliokai Courtly Kirin', source: 'deck', count: 1 }, { name: A, source: 'deck', count: 1 }] });
    check('Selbstlöscher (Rebelliokai: gehen beim Mill in den Gelöscht-Stapel) wählt sie nie, solange es eine Alternative gibt', g0 && g0.cardName === A, g0);
  }
  {
    const m = loadCardEffect('Cute Nerd Magenta');
    const t = await fresh();
    t.engine._cpuPlayerIdx = 0;
    t.p0.discardPile = [A];                                   // Schritt 1 hat A schon abgeworfen
    t.engine._cpuEvaluateState = () => (t.p0.discardPile.filter(n => n === A).length * 5) + (t.p0.discardPile.includes(B) ? 1 : 0);
    const cards = [{ name: A, source: 'deck', count: 1 }, { name: B, source: 'deck', count: 1 }];
    const g = m.cpuResponse(t.engine, 'generic', { type: 'cardGallery', title: 'Cute Nerd Magenta', cards });
    check('Cute Nerd Magenta (Umbau auf den gemeinsamen Helfer): der gerade abgeworfene Name A wird NICHT noch einmal gemillt, obwohl er besser bewertet wäre', g && g.cardName === B, g);
    check('…und Magenta antwortet nur auf ihren eigenen Titel', m.cpuResponse(t.engine, 'generic', { type: 'cardGallery', title: CARD, cards }) === undefined);
  }

  console.log(fails ? `${fails} Prüfung(en) FEHLGESCHLAGEN` : '✓ Sky-Shaman-Tests grün');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
