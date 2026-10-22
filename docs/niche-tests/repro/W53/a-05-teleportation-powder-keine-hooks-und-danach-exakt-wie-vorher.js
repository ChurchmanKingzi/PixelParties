'use strict';
// W53a · Punkt 4 (Al, 22.10.2026): „Das Verschwinden und Wiederauftauchen via Teleportation Powder soll keinerlei Hooks feuern (weder onEquipLost noch onEquipGained noch sonstige Leave/Enter-Hooks),
//   nach dem Auftauchen soll alles *exakt* so sein wie vor dem Verschwinden."
//   Kartentext: „Choose an undefeated Hero your opponent controls and remove it, its Abilities, and all cards equipped or attached to it from the game completely. At the beginning of your next turn,
//   return those cards to the Zones they were removed from. A player does not lose the game, even if all their other Heroes are defeated. …"
// Geprüft (beide Sitze, 4 Szenen mit allem, was ein Held tragen kann):
//   (A) Schnappschuss-Differenz: Zustand des Helden und seiner Zonen VOR dem Verschwinden == NACH dem Wiederauftauchen — Heldenobjekt (HP, maxHP, ATK/Boni, Buffs, Status, Marken wie `ascensionReady`/`gainedEffectNames`),
//       jede Karteninstanz (Held, Abilities, Surprise, Ausrüstung/Anhängsel samt unsichtbarer Träger gewonnener Effekte) mit DERSELBEN Instanz-Id, allen Zählern/Stempeln (`atkGranted`, `_atkTraeger`,
//       `_taioAtkTotal`, HOPT-Schlüssel …), Spielzug-Marke, Kontrolle, Platz und relativer Reihenfolge in der Instanzliste; die Zonen-Arrays; Hand/Deck/Ablage unberührt; `_teleportedAway` weg.
//   (B) KEIN Hook beim Verschwinden (außer der Resistance-Prüfung `beforeHeroEffect`, W13) und KEIN Hook bei der Rückkehr: Hook-Wächter über alle Hook-Namen (onCardLeaveZone, onCardEnterZone, onEquipLost,
//       onEquipGained, onPlay, Surprise-/Reaktionsfenster …) während `resolve` und während der Rückkehr-Routine (`onTurnStartEarly`-Handler).
//   (C) Folgeverhalten: ATK-Boni arbeiten nach der Rückkehr normal weiter (Equip zerstört → Bonus weg; Fighting abgelegt → Bonus weg — vorher blieb er stehen, weil die Ability-Zähler verloren gingen).
//   (D) Ausweichplatz: ist eine Support Zone inzwischen fremdbesetzt, weicht die Karte auf den nächsten freien Platz desselben Helden aus (Id und Zähler bleiben); ohne freien Platz bleibt sie draußen.
//   (E) Abwärtskompatibilität: ein Auftrag aus einem älteren Spielstand (ohne gemerkte Instanzen) kehrt weiter zurück.
//   (F) Weiter wie vorher: Held fehlt solange, Spieler verliert nicht, Rückkehr zu Beginn des NÄCHSTEN eigenen Zuges, Creatures bleiben stehen, Resistance blockt.
// Auf dem Stand vor W53a rot (neue Ids, `turnPlayed` neu, Fighting-/Taio-Zähler weg, `_teleportedAway: 0` bleibt). Exit 0 = korrekt.
const U = require('../../lib/umhaengen.js');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
const TP = 'Teleportation Powder', TAIO = 'Taio, the Sun Fencer', TORAS = 'Toras, Master of all Weapons', RIF = 'Future Tech Gunslinger Riffel', TEMPELUNA = 'Tempeluna, the Convergence Fairy', FEE = 'Maya, the Nature Fairy';
const GUN = 'Future Tech Gun', CLUB = 'Club of Gobbo', SUN = 'The Sun Sword', CLOAK = 'Cloak of Edge', PESTS = 'Afflicted Pests', INIT = 'Initiation Ritual';
const BLANK = ['Tushu, the Knowledge Keeper', 'Zwei, the Lucky Thief'];

/** Flache Kopie einer Instanz ohne Skript-Zwischenablage und Funktionen. */
const inhalt = (i) => { const o = {}; for (const k of Object.keys(i)) if (k !== 'script' && typeof i[k] !== 'function') o[k] = i[k]; return JSON.parse(JSON.stringify(o)); };
/** Zustand des Helden (Seite s, Index hi) und seiner Zonen. */
function schnappschuss(t, s, hi) {
  const ps = t.gs.players[s], e = t.engine;
  const mit = (c) => (c.owner === s || c.controller === s) && c.heroIdx === hi && ['hero', 'ability', 'support', 'surprise'].includes(c.zone);
  const insts = e.cardInstances.filter(mit).map(inhalt).sort((a, b) => (a.zone + a.zoneSlot + a.name + a.id).localeCompare(b.zone + b.zoneSlot + b.name + b.id));
  return JSON.parse(JSON.stringify({
    hero: ps.heroes[hi], abilities: ps.abilityZones[hi], support: ps.supportZones[hi], surprises: ps.surpriseZones[hi], insts,
    hand: ps.hand, deck: ps.mainDeck.length, discard: ps.discardPile, teleportedAway: ps._teleportedAway === undefined ? '-' : ps._teleportedAway,
    reihenfolge: e.cardInstances.filter(mit).map(c => c.id),
  }));
}
function differenz(a, b, p = '', out = []) {
  if (JSON.stringify(a) === JSON.stringify(b)) return out;
  if (a && b && typeof a === 'object' && typeof b === 'object') { for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) differenz(a[k], b[k], p + '.' + k, out); }
  else out.push(`${p}: ${JSON.stringify(a)} → ${JSON.stringify(b)}`);
  return out;
}
/** Relative Reihenfolge der Ids in der Gesamt-Instanzliste (nur Ids, die vorher und nachher da sind). */
const reihenfolge = (ids, liste) => liste.filter(i => ids.includes(i));

/**
 * Hook-Wächter: sammelt alle Hook-Namen (`runHooks`) UND alle Fenster-Verteiler (Surprise-/Reaktionsfenster, Equip-Meldungen `fireEquipGained`/`fireEquipLost`), solange `an` true ist.
 * Die Fenster laufen nicht alle über `runHooks`; deshalb wird jede Engine-Methode mit diesen Namen einzeln umhüllt (Eintrag 'fn:<Name>').
 */
function waechter(t) {
  const w = { an: false, namen: [] };
  const orig = t.engine.runHooks.bind(t.engine);
  t.engine.runHooks = async (n, c) => { if (w.an) w.namen.push(n); return orig(n, c); };
  const proto = Object.getPrototypeOf(t.engine);
  for (const m of Object.getOwnPropertyNames(proto)) {
    if (!/^(_checkSurpriseOn|_scanSurprisesAgainst|fireEquip|_fireBoardSent|_checkBoardSent|_checkHero\w*Reactions|_checkPostTarget|_checkTargetRedirect)/.test(m) || typeof proto[m] !== 'function') continue;
    const f = proto[m];
    t.engine[m] = function (...a) { if (w.an) w.namen.push('fn:' + m); return f.apply(this, a); };
  }
  return w;
}

/** Szene bauen: `op` = Besitzer des Helden (wird teleportiert), `me` = Spieler der Potion. */
const SZENEN = {
  taio: async (me, op) => {
    const t = await U.fresh(me, { hand: [TP], heroes: { [op]: [TAIO, ...BLANK] } });
    await U.lege(t, op, CLUB, 0); await U.lege(t, op, GUN, 0);
    t.setDiscard(op, [GUN, GUN]); await t.run(() => t.engine.runHooks('onAnyActionResolved', {}));
    await U.lege(t, op, CLOAK, 0); await t.activateEquip(op, 0, t.find(CLOAK, 'support').zoneSlot, {});
    await t.play(op, 'Fighting', { hero: 0, zoneSlot: 0 }); await t.play(op, 'Fighting', { hero: 0, zoneSlot: 0 }); await t.play(op, 'Toughness', { hero: 0, zoneSlot: 1 });
    t.putSurprise(op, 0, PESTS);
    t.hero(op, 0).hp = 555; t.hero(op, 0).statuses.burned = { appliedTurn: 1 }; t.hero(op, 0).buffs = { ...(t.hero(op, 0).buffs || {}), testbuff: { source: 'Test', turns: 3 } };
    return t;
  },
  toras: async (me, op) => {
    const t = await U.fresh(me, { hand: [TP], heroes: { [op]: [TORAS, ...BLANK] } });
    await U.lege(t, op, CLUB, 0); await U.lege(t, op, 'Phalanx Pike', 0); t.put(op, 0, 2, 'ZZ Dummy');   // die Creature bleibt stehen
    t.hero(op, 0).statuses.poisoned = { appliedTurn: 1, stacks: 2 };
    return t;
  },
  riffel: async (me, op) => {
    const t = await U.fresh(me, { hand: [TP], heroes: { [op]: [RIF, ...BLANK] } });
    await U.lege(t, op, GUN, 0); await U.lege(t, op, 'Future Tech Laser Cannon', 0); await U.lege(t, op, SUN, 0);
    t.hero(op, 0).ascensionReady = true;
    await t.run(() => t.engine.runHooks('onGameStart', {}));
    return t;
  },
  tempeluna: async (me, op) => {
    const t = await U.fresh(me, { hand: [TP], heroes: { [op]: [TEMPELUNA, ...BLANK] } });
    t.hand = t.gs.players[op].hand; t.gs.players[op].hand.push(FEE);
    t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ cardName: FEE, source: 'hand' }) });
    await t.run(() => t.engine.runHooks('onGameStart', {}));
    await t.activateHero(op, 0, {});
    await U.lege(t, op, CLUB, 0);
    return t;
  },
};

(async () => {
  const R = U.H.runner();
  for (const [me, op] of [[0, 1], [1, 0]]) {
    R.section(`Sitz ${me} spielt die Potion, Sitz ${op} verliert den Helden 0 für einen Zug`);
    for (const [name, bau] of Object.entries(SZENEN)) {
      const t = await bau(me, op);
      R.check(`${name}: Ausgang aufgebaut, keine Fehler`, t.errors.length === 0 && t.gs.players[op].heroes[0].hp > 0, { e: t.errors.slice(0, 2) });
      const vorher = schnappschuss(t, op, 0);
      const idsVorher = vorher.insts.filter(i => i.name !== 'ZZ Dummy').map(i => i.id);   // die Creature bleibt stehen
      const listeVorher = t.engine.cardInstances.map(c => c.id);
      const w = waechter(t);
      const sk = U.H.loadCardEffect(TP);
      const resolve0 = sk.resolve, frueh0 = sk.hooks.onTurnStartEarly;
      sk.resolve = async function (...a) { w.an = true; try { return await resolve0.apply(this, a); } finally { w.an = false; } };
      sk.hooks.onTurnStartEarly = async function (...a) { w.an = true; try { return await frueh0.apply(this, a); } finally { w.an = false; } };
      try {
        t.targetFn = (v) => { const x = v.find(y => y.type === 'hero' && y.owner === op && y.heroIdx === 0); return x ? [x.id] : null; };
        t.gs.activePlayer = me; t.phase(3);
        t.reset();
        const handVor = t.gs.players[me].hand.slice();
        const r = await t.play(me, TP, { hero: 0, active: me });
        const hookVerschwinden = w.namen.slice(); w.namen.length = 0;
        R.check(`${name}: Potion gespielt, Held samt Abilities/Equips/Anhängseln/Surprises weg`, r === true && !t.gs.players[op].heroes[0].name
          && t.engine.cardInstances.filter(c => idsVorher.includes(c.id)).length === 0 && t.gs.players[op].supportZones[0].every(z => z.length === 0 || z.includes('ZZ Dummy'))
          && t.gs.players[op].abilityZones[0].every(z => z.length === 0) && t.gs.players[op].surpriseZones[0].length === 0 && t.gs.players[op]._teleportedAway === 1, { r, hero: t.gs.players[op].heroes[0], sup: t.gs.players[op].supportZones[0] });
        R.check(`${name}: Creature bleibt stehen`, name !== 'toras' || t.gs.players[op].supportZones[0].flat().includes('ZZ Dummy'), t.gs.players[op].supportZones[0]);
        R.check(`${name}: beim VERSCHWINDEN feuert kein Hook (einzige Ausnahme: die Resistance-Prüfung beforeHeroEffect)`, hookVerschwinden.every(n => n === 'beforeHeroEffect'), hookVerschwinden);
        R.check(`${name}: Spieler ${op} verliert nicht (Held fehlt, aber _teleportedAway zählt)`, !t.engine.over.called, t.engine.over);

        // Zugfolge: Zug von Sitz op, dann Zugbeginn von Sitz me → Rückkehr in onTurnStartEarly
        await t.endTurn();
        R.check(`${name}: nach dem Zug des Gegners ist der Held noch weg`, !t.gs.players[op].heroes[0].name, t.gs.players[op].heroes[0]);
        w.namen.length = 0;
        await t.endTurn();
        const hookRueckkehr = w.namen.filter(n => !['onTurnStartEarly'].includes(n));
        R.check(`${name}: der Held ist zu Beginn des nächsten eigenen Zuges von Sitz ${me} zurück`, t.gs.players[op].heroes[0].name === vorher.hero.name && t.gs.players[op]._teleportedAway === undefined, { h: t.gs.players[op].heroes[0].name, ta: t.gs.players[op]._teleportedAway });
        R.check(`${name}: bei der RÜCKKEHR feuert kein Hook (Leave/Enter/EquipLost/EquipGained/onPlay/Surprise-Fenster …)`, hookRueckkehr.length === 0, hookRueckkehr);

        // (A) Schnappschuss-Differenz
        const nachher = schnappschuss(t, op, 0);
        // Handkarten/Ablage ändern sich durch Zugwechsel (Ziehen, gespielte Potion beim Spieler me) — verglichen wird die Seite des Helden: Hand/Deck des Besitzers werden durch den Zugwechsel von op verändert (Ziehen) → ausnehmen
        const a = JSON.parse(JSON.stringify(vorher)), b = JSON.parse(JSON.stringify(nachher));
        for (const x of [a, b]) { delete x.hand; delete x.deck; delete x.discard; }
        const d = differenz(a, b);
        R.check(`${name}: Schnappschuss-Differenz leer — Held, Zonen, ${vorher.insts.length} Instanzen (Id, Zähler, Stempel, Marken) und Reihenfolge exakt wie vorher`, d.length === 0, d.slice(0, 8));
        const ordV = reihenfolge(idsVorher, listeVorher), ordN = reihenfolge(idsVorher, t.engine.cardInstances.map(c => c.id));
        R.check(`${name}: relative Reihenfolge in der Instanzliste wie vorher`, JSON.stringify(ordV) === JSON.stringify(ordN), { ordV, ordN });
        R.check(`${name}: sauber`, t.errors.length === 0, t.errors);

        // (C) Folgeverhalten
        if (name === 'taio') {
          const base = t.DB[TAIO].atk;
          const fight = t.inst(c => c.name === 'Fighting' && c.zone === 'ability' && c.owner === op);
          R.check('Taio: Fighting trägt seine Buchung weiter (atkGranted > 0)', fight.length >= 1 && fight.some(c => c.counters.atkGranted > 0), fight.map(c => c.counters));
          const ak = t.hero(op, 0).atk;
          const club = t.find(CLUB, 'support');
          await t.run(() => t.engine.actionDestroyCard({ name: 'T', owner: me }, club, {}));
          R.check('Club nach der Rückkehr zerstört: genau 30 + 20 (Taio-Bonus für 1 Artifact weniger) ATK weg', t.hero(op, 0).atk === ak - 30 - 20, { vorher: ak, jetzt: t.hero(op, 0).atk });
          const pests = t.inst(c => c.name === PESTS && c.zone === 'surprise')[0];
          R.check('Surprise ist wieder verdeckt da (selbe Id)', !!pests && pests.faceDown === true && pests.id === vorher.insts.find(i => i.name === PESTS).id, pests && pests.id);
          // Fighting ablegen → Fighting-Bonus weg (vorher: Zähler der Ability war beim Teleport verloren, der Bonus blieb stehen)
          const f1 = t.inst(c => c.name === 'Fighting' && c.zone === 'ability' && c.owner === op);
          const bonusSumme = f1.reduce((n, c) => n + (c.counters.atkGranted || 0), 0);
          const vorAbl = t.hero(op, 0).atk;
          for (const f of f1) await t.run(() => t.engine.actionMoveCard(f, 'discard', -1, -1, { source: 'Test', sourceOwner: me }));
          R.check(`Taio: Fighting abgelegt → sein Bonus (${bonusSumme}) ist weg`, bonusSumme > 0 && t.hero(op, 0).atk === vorAbl - bonusSumme, { vorAbl, jetzt: t.hero(op, 0).atk, bonusSumme });
        }
        if (name === 'tempeluna') {
          const fee = t.find(FEE, 'support');
          R.check('Tempeluna: Fee ist dieselbe Instanz (Id), Marken (_keinEquip, treatAsEquip) und gewonnene Effekte wie vorher', !!fee && fee.id === vorher.insts.find(i => i.name === FEE).id && fee.counters._keinEquip === true && fee.counters.treatAsEquip === true && (t.hero(op, 0).gainedEffectNames || []).includes(FEE), fee && fee.counters);
          await t.run(() => t.engine.actionDestroyCard({ name: 'T', owner: me }, fee, {}));
          R.check('Tempeluna: Fee nach der Rückkehr zerstört → gewonnener Effekt weg (Ruling ①)', !(t.hero(op, 0).gainedEffectNames || []).includes(FEE), t.hero(op, 0).gainedEffectNames);
        }
      } finally { sk.resolve = resolve0; sk.hooks.onTurnStartEarly = frueh0; }
    }

    // ═══ (D) Ausweichplatz ═══
    { const t = await SZENEN.taio(me, op);
      const clubId = t.find(CLUB, 'support').id, clubSlot = t.find(CLUB, 'support').zoneSlot, clubAg = t.find(CLUB, 'support').counters.atkGranted;
      t.targetFn = (v) => { const x = v.find(y => y.type === 'hero' && y.owner === op && y.heroIdx === 0); return x ? [x.id] : null; };
      await t.play(me, TP, { hero: 0, active: me });
      // während der Abwesenheit besetzt jemand die Zone des Clubs (Slot, in dem er lag)
      const frei = [0, 1, 2].filter(z => t.gs.players[op].supportZones[0][z].length === 0);
      R.check('(D) Ausgang: es sind Zonen frei', frei.length >= 1, frei);
      const blocker = t.put(op, 0, clubSlot, 'ZZ Dummy Big');
      await t.endTurn(); await t.endTurn();
      const club = t.inst(c => c.name === CLUB && c.zone === 'support')[0];
      const freieNachher = [0, 1, 2].filter(z => t.gs.players[op].supportZones[0][z].length === 0);
      R.check('(D) Club kehrt auf einen anderen Platz DESSELBEN Helden zurück (Zone war besetzt), Id und Zähler unverändert', !!club && club.heroIdx === 0 && club.zoneSlot !== clubSlot && club.id === clubId && club.counters.atkGranted === clubAg && t.gs.players[op].supportZones[0][club.zoneSlot].includes(CLUB), { club: club && [club.heroIdx, club.zoneSlot, club.id, club.counters], clubSlot, clubId });
      R.check('(D) der Besetzer blieb unberührt, keine Fehler', t.gs.players[op].supportZones[0][clubSlot].includes('ZZ Dummy Big') && t.errors.length === 0, { z: t.gs.players[op].supportZones[0], e: t.errors }); }
    { // alle Zonen besetzt → die Karte bleibt draußen
      const t = await U.fresh(me, { hand: [TP], heroes: { [op]: [TAIO, ...BLANK] } });
      await U.lege(t, op, CLUB, 0);
      const atkVorher = t.hero(op, 0).atk;   // Taio-Grundwert + Club (+ Taios Bonus)
      t.targetFn = (v) => { const x = v.find(y => y.type === 'hero' && y.owner === op && y.heroIdx === 0); return x ? [x.id] : null; };
      await t.play(me, TP, { hero: 0, active: me });
      for (let z = 0; z < 3; z++) t.put(op, 0, z, 'ZZ Dummy Big');
      await t.endTurn(); await t.endTurn();
      R.check('(D) keine freie Zone: der Held kehrt zurück, der Club bleibt draußen (kein Stapel, keine Instanz) und sein ATK-Bonus (30) liegt nicht mehr am Helden', t.gs.players[op].heroes[0].name === TAIO && t.inst(c => c.name === CLUB && c.zone === 'support').length === 0 && t.hero(op, 0).atk === atkVorher - 30 && t.errors.length === 0, { atk: t.hero(op, 0).atk, atkVorher, club: t.inst(c => c.name === CLUB && c.zone === 'support').length, e: t.errors }); }

    // ═══ (E) Abwärtskompatibilität: Auftrag ohne gemerkte Instanzen ═══
    { const t = await SZENEN.taio(me, op);
      t.targetFn = (v) => { const x = v.find(y => y.type === 'hero' && y.owner === op && y.heroIdx === 0); return x ? [x.id] : null; };
      await t.play(me, TP, { hero: 0, active: me });
      for (const a of t.gs._teleportPending) delete a.instanzen;
      await t.endTurn(); await t.endTurn();
      R.check('(E) alter Auftrag (ohne gemerkte Instanzen): Held kehrt zurück, Club liegt wieder da, keine Fehler', t.gs.players[op].heroes[0].name === TAIO && !!t.find(CLUB, 'support') && !!t.find('Fighting', 'ability') && t.errors.length === 0, { e: t.errors }); }

    // ═══ (F) Weiter wie vorher ═══
    { // Erstrunden-Schutz / Resistance: unverändert (M02/11, W13/b-q144 decken das ab) — hier nur: eigener Held ist kein Ziel
      const t = await U.fresh(me, { hand: [TP] });
      R.check('(F) canActivate/getValidTargets nur gegnerische lebende Helden', U.H.loadCardEffect(TP).getValidTargets(t.gs, me, t.engine).every(x => x.owner === op), 0); }
  }
  R.finish();
})();
