'use strict';
// The Creepy Clown of Heaven (Creature, Normal, Lv0, 50 HP, Summoning Magic): „While you control this Creature, negate the effects of all other Creatures on the
// board. Either player may spend an Action during their turn to defeat this Creature. When this Creature is defeated, the effects of all Creatures stay negated
// for the rest of the turn."
// Geprüft wird der ECHTE Weg: die abgeleitete Aura (`engine.isCreatureEffectSuppressed` / `getActivatableCreatures` / `doActivateCreatureEffect`), die Aktion des
// Besitzers UND des Gegners (`activatableByAnyPlayer`), die Rückfrage, die Nachwirkung bis Zugende und die Animation.
//   node scripts/skilltest-e2e/the-creepy-clown-of-heaven.test.js
process.env.PP_ST_SIM = '1';
const { runGame } = require('../../skilltest/sim');
const { loadCardEffect } = require('../../cards/effects/_loader');
let fails = 0;
const check = (name, cond, info) => { if (cond) console.log('  ✓', name); else { fails++; console.log('  ✗', name, info !== undefined ? '→ ' + JSON.stringify(info).slice(0, 300) : ''); } };

const CLOWN = 'The Creepy Clown of Heaven';
const SHAMAN = 'Sky Shaman';                                // Creature mit aktivem Effekt (Deck-Galerie), 50 HP
const DB = require('../../cards/effects/_card-db').getCardDB();
const [A, B, C] = Object.values(DB).filter(c => c.cardType === 'Spell' && c.subtype === 'Normal' && c.level <= 1 && !/Token/.test(c.name)).sort((a, b) => a.name.localeCompare(b.name)).slice(0, 3).map(c => c.name);

/** Seite 0 ist am Zug (Phase aus `opts.phase`, Vorgabe Main Phase 1). */
async function fresh(opts = {}) {
  const oL = console.log, oE = console.error; console.log = () => {}; console.error = () => {};
  let out;
  try { out = await runGame({ seats: 2, setupOnly: true, noProfileSeats: [0, 1], seed: 11 }); }
  finally { console.log = oL; console.error = oE; }
  const { room, host, engine, gs } = out;
  gs.turn = 5; gs.activePlayer = 0; gs.currentPhase = opts.phase ?? 2; gs.firstTurnProtectedPlayer = null;
  for (const c of engine.cardInstances.filter(c => c.zone === 'support' || c.zone === 'surprise' || c.zone === 'hand')) engine._untrackCard(c.id);
  const [p0, p1] = gs.players;
  for (const ps of [p0, p1]) {
    ps.supportZones = ps.supportZones.map(() => [[], [], []]);
    ps.surpriseZones = ps.surpriseZones.map(() => []);
    for (const h of ps.heroes) { h.hp = 800; h.maxHp = 800; h.statuses = {}; }
    ps.hand = []; ps.discardPile = []; ps.deletedPile = []; ps.heroesActedThisTurn = []; ps._actionsPlayedThisPhase = 0;
  }
  p0.mainDeck = [A, B, C, B]; p1.mainDeck = [A, B, C, B];
  engine._fastMode = false; engine._delay = async () => {};
  const t = { room, host, engine, gs, p0, p1, events: [], prompts: [], antwort: null, logs: [] };
  const origPg = engine.promptGeneric.bind(engine);
  engine.promptGeneric = async (pi, d, ...r) => {
    t.prompts.push({ pi, d });
    if (t.antwort) { const a = t.antwort(pi, d); if (a !== undefined) return a; }
    return origPg(pi, d, ...r);
  };
  const origBc = engine._broadcastEvent.bind(engine);
  engine._broadcastEvent = (ev, data, ...r) => { t.events.push({ ev, data }); return origBc(ev, data, ...r); };
  const origLog = engine.log.bind(engine);
  engine.log = (type, d) => { t.logs.push({ type, d }); return origLog(type, d); };
  return t;
}
function lege(t, name, seat, heroIdx = 0, slot = 0) {
  const inst = t.engine._trackCard(name, seat, 'support', heroIdx, slot);
  t.gs.players[seat].supportZones[heroIdx][slot] = [name];
  inst.turnPlayed = 1;
  return inst;
}
const clownFragen = (t) => t.prompts.filter(p => p.d.type === 'confirm' && p.d.title === CLOWN);
const ja = (pi, d) => (d.type === 'confirm' && d.title === CLOWN) ? { confirmed: true } : undefined;
const nein = (pi, d) => (d.type === 'confirm' && d.title === CLOWN) ? { confirmed: false } : undefined;
const log = (t, typ) => t.logs.filter(l => l.type === typ).map(l => l.d);
const anims = (t) => t.events.filter(e => e.ev === 'play_zone_animation' && e.data && e.data.type === 'clown_pop').map(e => e.data);
const lebt = (t, inst) => t.engine.cardInstances.some(c => c.id === inst.id && c.zone === 'support');
const liste = (t, pi) => t.engine.getActivatableCreatures(pi);
const eintrag = (t, pi, inst) => liste(t, pi).find(c => c.instId === inst.id);

(async () => {
  console.log('Karte und Skript');
  {
    const cd = DB[CLOWN], s = loadCardEffect(CLOWN);
    check('Creature, Normal, Lv0 (vorher höher), 50 HP, Summoning Magic', cd && cd.cardType === 'Creature' && cd.subtype === 'Normal' && cd.level === 0 && cd.hp === 50 && cd.spellSchool1 === 'Summoning Magic', cd);
    check('Kartentext: neuer Wortlaut', cd && /^While you control this Creature, negate the effects of all other Creatures on the board\. Either player may spend an Action during their turn to defeat this Creature\. When this Creature is defeated, the effects of all Creatures stay negated for the rest of the turn\.$/.test(cd.effect), cd && cd.effect);
    check('Skript: Aura-Flag, aktiver Effekt gegen eine Aktion, für jeden Spieler', s && s.negatesOtherCreatureEffects === true && s.creatureEffect === true && s.creatureActionCost === true && s.activatableByAnyPlayer === true);
  }

  console.log('Die Aura: alle ANDEREN Creature-Effekte sind negiert');
  {
    const t = await fresh();
    const eigen = lege(t, SHAMAN, 0, 0, 0);
    check('ohne Clown: der Schamane ist aktivierbar', !t.engine.isCreatureEffectSuppressed(eigen) && !!eintrag(t, 0, eigen)?.canActivate, eintrag(t, 0, eigen));
    const clown = lege(t, CLOWN, 1, 0, 0);
    const fremd = lege(t, SHAMAN, 1, 1, 0);
    check('mit Clown auf der GEGENseite: der eigene Schamane ist negiert', t.engine.isCreatureEffectSuppressed(eigen) === true);
    check('…auch der Schamane neben dem Clown (derselbe Besitzer)', t.engine.isCreatureEffectSuppressed(fremd) === true);
    check('…der Clown selbst ist NICHT negiert (seine Aura wirkt auf „others")', t.engine.isCreatureEffectSuppressed(clown) === false);
    check('…der negierte Schamane taucht nicht mehr unter den aktivierbaren Creatures auf', !eintrag(t, 0, eigen), liste(t, 0));
    const r = await t.host.doActivateCreatureEffect(t.room, 0, { heroIdx: 0, zoneSlot: 0 });
    check('…und ein erzwungener Klick wird abgelehnt (Server-Gate)', r === false && t.p0.discardPile.length === 0, r);
    check('die Aura ist abgeleitet: kein Zähler an der Kreatur', !eigen.counters.negated && !fremd.counters.negated, eigen.counters);
    // Clown geht → die Aura endet von selbst
    t.engine._untrackCard(clown.id); t.gs.players[1].supportZones[0][0] = [];
    check('ohne den Clown ist der Schamane wieder frei', t.engine.isCreatureEffectSuppressed(eigen) === false && !!eintrag(t, 0, eigen)?.canActivate);
  }
  {
    // Ein negierter oder eingefrorener Clown hat keine Aura (seine eigenen Effekte sind stumm)
    const t = await fresh();
    const schamane = lege(t, SHAMAN, 0);
    const clown = lege(t, CLOWN, 1);
    clown.counters.negated = 1;
    check('Clown NEGIERT → keine Aura', t.engine.isCreatureEffectSuppressed(schamane) === false);
    delete clown.counters.negated; clown.counters.frozen = 1;
    check('Clown EINGEFROREN → keine Aura', t.engine.isCreatureEffectSuppressed(schamane) === false);
    delete clown.counters.frozen;
    check('wieder frei → Aura wirkt', t.engine.isCreatureEffectSuppressed(schamane) === true);
  }
  {
    // Zwei Clowns neutralisieren sich nicht
    const t = await fresh();
    const c1 = lege(t, CLOWN, 0, 0, 0), c2 = lege(t, CLOWN, 1, 0, 0);
    const schamane = lege(t, SHAMAN, 0, 1, 0);
    check('zwei Clowns: keiner ist durch die Aura des anderen stumm', t.engine.isCreatureEffectSuppressed(c1) === false && t.engine.isCreatureEffectSuppressed(c2) === false);
    check('…andere Creatures bleiben negiert', t.engine.isCreatureEffectSuppressed(schamane) === true);
  }
  {
    // Nur Creatures: Nicht-Creatures auf dem Brett (hier: Equip-/Artifact-Karte) bleiben unberührt; Hero-Fähigkeiten ebenso (Aura ist ein Creature-Prädikat)
    const t = await fresh();
    lege(t, CLOWN, 1);
    const kosten = Object.values(DB).find(c => c.cardType === 'Artifact' && (c.subtype || '') === 'Equipment');
    if (kosten) {
      const eq = lege(t, kosten.name, 0, 0, 1);
      check('Equipment-Karte im Support wird von der Aura nicht erfasst', t.engine.creatureAuraNegiert(eq) === false, kosten.name);
    }
  }

  console.log('Der Besitzer besiegt den Clown (Aktion, Action Phase)');
  {
    const t = await fresh({ phase: 3 });
    const clown = lege(t, CLOWN, 0, 0, 0);
    const gegner = lege(t, SHAMAN, 1, 0, 0);
    const e = eintrag(t, 0, clown);
    check('der Clown erscheint für den Besitzer als aktivierbar (Aktionskosten)', e && e.canActivate === true && e.actionCost === true && !e.anyPlayer, e);
    t.antwort = ja;
    const r = await t.host.doActivateCreatureEffect(t.room, 0, { heroIdx: 0, zoneSlot: 0 });
    check('die Aktivierung läuft durch', r !== false, r);
    const f = clownFragen(t);
    check('GENAU EINE Rückfrage, an den Aktivierenden (Seite 0)', f.length === 1 && f[0].pi === 0 && f[0].d.showCard === CLOWN, f.map(x => x.pi));
    check('der Clown ist besiegt (Ablage seines Besitzers)', !lebt(t, clown) && t.p0.discardPile.includes(CLOWN), t.p0.discardPile);
    check('die Aktion ist verbraucht: ein Held hat gehandelt', t.p0.heroesActedThisTurn.length === 1, t.p0.heroesActedThisTurn);
    check('Nachwirkung gestempelt: `_creatureEffectsNegated` = dieser Zug', t.gs._creatureEffectsNegated && t.gs._creatureEffectsNegated.turn === t.gs.turn, t.gs._creatureEffectsNegated);
    check('…die Creature des GEGNERS bleibt negiert, obwohl der Clown fort ist', t.engine.isCreatureEffectSuppressed(gegner) === true);
    const neu = lege(t, SHAMAN, 0, 1, 0); neu.turnPlayed = t.gs.turn;
    check('…auch eine spätere Creature (nach dem Tod beschworen) ist negiert', t.engine.isCreatureEffectSuppressed(neu) === true);
    const a = anims(t);
    check('Animation `clown_pop` am Platz des Clowns (Seite 0, Held 0, Platz 0)', a.length === 1 && a[0].zoneType === 'board' && a[0].targets[0].owner === 0 && a[0].targets[0].heroIdx === 0 && a[0].targets[0].zoneSlot === 0, a);
    check('Logs `creepy_clown_popped` und `creepy_clown_defeated`', log(t, 'creepy_clown_popped').length === 1 && log(t, 'creepy_clown_defeated').length === 1, t.logs.map(l => l.type));
    // …bis Zugende, dann vorbei
    t.gs.turn += 1;
    check('im NÄCHSTEN Zug ist die Nachwirkung vorbei', t.engine.isCreatureEffectSuppressed(gegner) === false && t.engine.isCreatureEffectSuppressed(neu) === false);
  }
  {
    // Abgelehnt: nichts passiert, keine Aktion verbraucht
    const t = await fresh({ phase: 3 });
    const clown = lege(t, CLOWN, 0);
    t.antwort = nein;
    await t.host.doActivateCreatureEffect(t.room, 0, { heroIdx: 0, zoneSlot: 0 });
    check('„Keep it": der Clown bleibt, keine Aktion verbraucht, keine Nachwirkung', lebt(t, clown) && t.p0.heroesActedThisTurn.length === 0 && !t.gs._creatureEffectsNegated && !anims(t).length, { acted: t.p0.heroesActedThisTurn });
  }
  {
    // Der Clown selbst sieht keinen Beschwörungs-Schlaf für den Besitzer? Doch — der Besitzer wartet (wie jede Creature)
    const t = await fresh({ phase: 3 });
    t.gs.skillTest = null;                                     // die Sim läuft als Skill Test — dort gibt es keinen Beschwörungs-Schlaf
    const clown = lege(t, CLOWN, 0); clown.turnPlayed = t.gs.turn;
    const e = eintrag(t, 0, clown);
    check('Besitzer: im Beschwörungszug noch nicht aktivierbar (Standardregel für den eigenen Effekt)', e && e.canActivate === false, e);
  }

  console.log('Der GEGNER besiegt den Clown („either player may spend an Action during their turn")');
  {
    const t = await fresh({ phase: 3 });
    t.gs.skillTest = null;                                     // Beschwörungs-Schlaf ist nur außerhalb des Skill Tests spürbar
    const clown = lege(t, CLOWN, 1, 0, 0);
    clown.turnPlayed = t.gs.turn;                              // frisch beschworen — für den Nicht-Besitzer kein Beschwörungs-Schlaf
    const e = eintrag(t, 0, clown);
    check('der Clown des Gegners erscheint für den Spieler am Zug als aktivierbar (anyPlayer, Gegenseite, Aktionskosten)', e && e.canActivate === true && e.anyPlayer === true && e.charmedOwner === 1 && e.owner === 1 && e.actionCost === true, e);
    t.antwort = ja;
    const r = await t.host.doActivateCreatureEffect(t.room, 0, { heroIdx: 0, zoneSlot: 0, charmedOwner: 1 });
    check('die Aktivierung läuft durch', r !== false, r);
    const f = clownFragen(t);
    check('die Rückfrage geht an den AKTIVIERENDEN (Seite 0), nicht an den Besitzer', f.length === 1 && f[0].pi === 0, f.map(x => x.pi));
    check('der Clown ist besiegt — in der Ablage seines BESITZERS (Seite 1)', !lebt(t, clown) && t.p1.discardPile.includes(CLOWN) && !t.p0.discardPile.includes(CLOWN), { a0: t.p0.discardPile, a1: t.p1.discardPile });
    check('die Aktion des Aktivierenden (Seite 0) ist verbraucht, die des Besitzers unberührt', t.p0.heroesActedThisTurn.length === 1 && t.p1.heroesActedThisTurn.length === 0, { a0: t.p0.heroesActedThisTurn, a1: t.p1.heroesActedThisTurn });
    check('der Held des Aktivierenden hat gehandelt, kein Kontrollwechsel (der Clown gehörte bis zuletzt dem Gegner)', t.p0.heroesActedThisTurn[0] === 0 && clown.controller !== 0, { acted: t.p0.heroesActedThisTurn, ctrl: clown.controller });
    check('Nachwirkung gestempelt (Quelle: Besitzer des Clowns)', t.gs._creatureEffectsNegated && t.gs._creatureEffectsNegated.turn === t.gs.turn && t.gs._creatureEffectsNegated.source === 1, t.gs._creatureEffectsNegated);
    const eigen = lege(t, SHAMAN, 0, 1, 0);
    check('…jetzt sind auch die Creatures des Aktivierenden bis Zugende negiert', t.engine.isCreatureEffectSuppressed(eigen) === true);
  }
  {
    // Gates
    const t = await fresh({ phase: 3 });
    const clown = lege(t, CLOWN, 1, 0, 0);
    t.p0.heroesActedThisTurn = [0];                            // die Aktion ist schon weg
    check('Action Phase, Aktion verbraucht, kein Zusatzaktions-Anbieter → nicht aktivierbar (aber sichtbar)', eintrag(t, 0, clown)?.canActivate === false, eintrag(t, 0, clown));
    t.antwort = ja;
    const r = await t.host.doActivateCreatureEffect(t.room, 0, { heroIdx: 0, zoneSlot: 0, charmedOwner: 1 });
    check('…ein erzwungener Klick wird abgelehnt', r === false && lebt(t, clown) && !clownFragen(t).length, r);
  }
  {
    const t = await fresh({ phase: 2 });
    const clown = lege(t, CLOWN, 1);
    check('Main Phase ohne Zusatzaktion → der Gegner kann den Clown nicht besiegen (gar nicht angeboten)', !eintrag(t, 0, clown), liste(t, 0));
    const r = await t.host.doActivateCreatureEffect(t.room, 0, { heroIdx: 0, zoneSlot: 0, charmedOwner: 1 });
    check('…Server lehnt ab', r === false && lebt(t, clown), r);
  }
  {
    // Gewöhnliche Creatures des Gegners bleiben tabu — die Fremdaktivierung gilt nur für Karten mit `activatableByAnyPlayer`
    const t = await fresh({ phase: 3 });
    const schamane = lege(t, SHAMAN, 1);
    check('ein gewöhnlicher Gegner-Schamane taucht NICHT als aktivierbar auf', !eintrag(t, 0, schamane), liste(t, 0));
    t.antwort = ja;
    const r = await t.host.doActivateCreatureEffect(t.room, 0, { heroIdx: 0, zoneSlot: 0, charmedOwner: 1 });
    check('…und ein erzwungener Klick wird abgelehnt', r === false && lebt(t, schamane), r);
  }
  {
    // Der Spieler NICHT am Zug sieht nichts
    const t = await fresh({ phase: 3 });
    const clown = lege(t, CLOWN, 0);
    check('wer nicht am Zug ist, hat keine Aktivierungen', liste(t, 1).length === 0 && !!eintrag(t, 0, clown));
  }

  console.log('Sterben auf anderem Weg');
  {
    const t = await fresh();
    const clown = lege(t, CLOWN, 1);
    const schamane = lege(t, SHAMAN, 0);
    await t.engine.actionDealCreatureDamage({ name: 'Test', owner: 0 }, clown, 50, 'creature', { sourceOwner: 0, canBeNegated: true });
    check('Schaden bis zum Tod: der Clown ist besiegt', !lebt(t, clown) && t.p1.discardPile.includes(CLOWN), t.p1.discardPile);
    check('…die Nachwirkung gilt trotzdem (der Tod zählt auf jedem Weg)', t.gs._creatureEffectsNegated && t.gs._creatureEffectsNegated.turn === t.gs.turn, t.gs._creatureEffectsNegated);
    check('…der Schamane bleibt für den Rest des Zuges negiert', t.engine.isCreatureEffectSuppressed(schamane) === true);
  }
  {
    // Ein NEGIERTER Clown hat keine Effekte — sein Tod löst die Nachwirkung nicht aus
    const t = await fresh();
    const clown = lege(t, CLOWN, 1);
    clown.counters.negated = 1;
    const schamane = lege(t, SHAMAN, 0);
    await t.engine.actionDealCreatureDamage({ name: 'Test', owner: 0 }, clown, 50, 'creature', { sourceOwner: 0, canBeNegated: true });
    check('negierter Clown stirbt: keine Nachwirkung', !lebt(t, clown) && !t.gs._creatureEffectsNegated && t.engine.isCreatureEffectSuppressed(schamane) === false, t.gs._creatureEffectsNegated);
  }
  {
    // Andere Creatures sterben: der Clown reagiert nur auf SEINEN Tod
    const t = await fresh();
    const clown = lege(t, CLOWN, 1);
    const schamane = lege(t, SHAMAN, 0);
    await t.engine.actionDealCreatureDamage({ name: 'Test', owner: 1 }, schamane, 50, 'creature', { sourceOwner: 1, canBeNegated: true });
    check('der Tod einer ANDEREN Creature löst die Nachwirkung nicht aus; der Clown steht', lebt(t, clown) && !t.gs._creatureEffectsNegated, t.gs._creatureEffectsNegated);
  }

  console.log('Auch Hook-Effekte (Beschwörungseffekte) sind unter der Aura stumm');
  {
    const t = await fresh();
    const kran = lege(t, 'Scavenging Crane', 0);               // „When you summon this Creature … draw 1 card."
    t.engine.promptDeckReorder = async (pi, pj, cards) => ({ top: cards });
    t.antwort = (pi, d) => d.type === 'confirm' ? { confirmed: false } : undefined;
    const feuer = async () => { const v = t.p0.hand.length; await t.engine.runHooks('onPlay', { playedCard: kran, cardOwner: 0, heroIdx: 0, zoneSlot: 0 }); return t.p0.hand.length - v; };
    check('ohne Clown: der Kranich zieht beim Beschwören', await feuer() === 1);
    lege(t, CLOWN, 1);
    check('mit Clown: sein Beschwörungseffekt ist negiert (keine Karte)', await feuer() === 0);
  }

  console.log('Abgeleitete Anzeige und CPU');
  {
    const t = await fresh();
    const schamane = lege(t, SHAMAN, 0), clown = lege(t, CLOWN, 1);
    const s = loadCardEffect(CLOWN);
    check('die CPU aktiviert ihren eigenen Clown nie (cpuMeta.shouldActivateNow = false)', typeof s.cpuMeta?.shouldActivateNow === 'function' && s.cpuMeta.shouldActivateNow() === false);
    check('Anzeige-Helfer: `creatureAuraNegiert` wahr für den Schamanen, falsch für den Clown', t.engine.creatureAuraNegiert(schamane) === true && t.engine.creatureAuraNegiert(clown) === false);
  }

  console.log(fails ? `${fails} Prüfung(en) FEHLGESCHLAGEN` : '✓ The-Creepy-Clown-of-Heaven-Tests grün');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
