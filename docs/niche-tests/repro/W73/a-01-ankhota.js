'use strict';
// W73a-01 · Ankhota, the Burier (Creature Normal Lv2, 150 HP)
// „Delete all Creatures that are moved from the board to anywhere else. Whenever one or more Creatures are deleted, the corresponding Hero's current and max HP and Attack stat are
//  increased by 10 times the number of Creatures deleted."
const H = require('../../lib/h.js');
const CARD = 'Ankhota, the Burier';
const FODDER = 'Chaorc Cannon Fodder';
const setAtk = (t, seat, hi, atk) => { t.gs.players[seat].heroes[hi].atk = atk; t.gs.players[seat].heroes[hi].baseAtk = atk; };
const stat = (t, seat, hi) => { const h = t.hero(seat, hi); return { hp: h.hp, max: h.maxHp, atk: h.atk }; };
const geloescht = (t, seat, name) => t.pile(seat, 'deletedPile').filter(n => n === name).length;
const fertig = (t) => t.run(() => t.engine._runPostChainActions());   // die Meldung läuft nach der Kette (Server: Ende des Handlers)
const abl = (t, seat, name) => t.pile(seat, 'discardPile').filter(n => n === name).length;

(async () => {
  const R = H.runner();

  R.section('A · zerstört / geopfert / zurück auf die Hand: gelöscht, +10 je Kreatur');
  {
    const t = await H.fresh({ hand: [[], []] });
    t.put(0, 0, 0, CARD);
    const opfer = t.put(1, 0, 0, FODDER);
    const v = stat(t, 0, 0);
    await t.run(() => t.engine.actionDestroyCard({ name: 'x', owner: 1 }, opfer));
    await fertig(t);
    R.check('zerstört → Gelöscht-Stapel des Besitzers (nicht Ablage)', geloescht(t, 1, FODDER) === 1 && abl(t, 1, FODDER) === 0, [t.pile(1, 'deletedPile'), t.pile(1, 'discardPile')]);
    const n = stat(t, 0, 0);
    R.check(`Ankhotas Held: +10 HP, +10 max HP, +10 ATK (${JSON.stringify(v)} → ${JSON.stringify(n)})`, n.hp === v.hp + 10 && n.max === v.max + 10 && n.atk === v.atk + 10, [v, n]);
    R.check('Sandwirbel am Helden', t.evs('play_zone_animation').some(e => e.type === 'ankhota_sandstorm' && e.owner === 0 && e.heroIdx === 0), t.evs('play_zone_animation').map(e => e.type));
    R.check('keine Engine-Fehler, Zustand sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }
  {
    // zurück auf die Hand (Bounce) wird zur Löschung
    const t = await H.fresh({ hand: [[], []] });
    t.put(0, 0, 0, CARD);
    const k = t.put(0, 1, 0, FODDER);
    const v = stat(t, 0, 0);
    await t.run(() => t.engine.actionMoveCard(k, 'hand', -1, -1, { source: 'Test', sourceOwner: 0 }));
    await fertig(t);
    R.check('Bounce → gelöscht, nicht auf der Hand', geloescht(t, 0, FODDER) === 1 && !t.pile(0, 'hand').includes(FODDER), [t.pile(0, 'deletedPile'), t.pile(0, 'hand')]);
    R.check('+10 für Ankhotas Held (Held 0), nicht für den Helden der Kreatur', stat(t, 0, 0).max === v.max + 10 && stat(t, 0, 1).max === t.hero(0, 1).maxHp, stat(t, 0, 0));
  }
  {
    // Deck
    const t = await H.fresh({ hand: [[], []] });
    t.put(0, 0, 0, CARD);
    const k = t.put(1, 0, 1, FODDER);
    await t.run(() => t.engine.actionMoveCard(k, 'deck', -1, -1, { source: 'Test', sourceOwner: 0 }));
    R.check('zurück ins Deck → gelöscht', geloescht(t, 1, FODDER) === 1 && !t.pile(1, 'mainDeck').includes(FODDER), t.pile(1, 'deletedPile'));
  }

  R.section('B · besiegt durch Schaden: gelöscht; mehrere auf einmal = EIN Zuwachs 10 × Anzahl');
  {
    const t = await H.fresh({ hand: [['Attack'], []] });
    t.put(0, 0, 0, CARD); setAtk(t, 0, 0, 500);
    const a = t.put(1, 0, 0, FODDER);
    const v = stat(t, 0, 0);
    t.targetFn = (valid) => valid.filter(x => x.id === `equip-1-0-0`).map(x => x.id);
    t.setHand(0, ['Attack']);
    await t.play(0, 'Attack', { hero: 0 });
    t.targetFn = null;
    await fertig(t);
    R.check('von einem Attack besiegt → gelöscht', geloescht(t, 1, FODDER) === 1 && abl(t, 1, FODDER) === 0, [t.pile(1, 'deletedPile'), t.pile(1, 'discardPile')]);
    const n = stat(t, 0, 0);
    R.check('Zuwachs +10 (ATK 500 → 510)', n.atk === v.atk + 10 && n.max === v.max + 10, [v, n]);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
    void a;
  }
  {
    const t = await H.fresh({ hand: [[], []] });
    t.put(0, 0, 0, CARD);
    const ks = [t.put(1, 0, 0, FODDER), t.put(1, 1, 0, FODDER), t.put(1, 2, 0, FODDER)];
    const v = stat(t, 0, 0);
    await t.run(async () => { for (const k of ks) await t.engine.actionDestroyCard({ name: 'x', owner: 1 }, k); });
    await fertig(t);
    R.check('drei zerstört → drei Karten gelöscht', geloescht(t, 1, FODDER) === 3, t.pile(1, 'deletedPile'));
    const n = stat(t, 0, 0);
    R.check(`+10 je Kreatur (gebündelt oder einzeln, zusammen +30): max ${v.max} → ${n.max}`, n.max === v.max + 30 && n.atk === v.atk + 30, [v, n]);
  }

  R.section('C · Ankhota selbst, Tokens, andere Kartentypen, Stummschaltung');
  {
    const t = await H.fresh({ hand: [[], []] });
    const a = t.put(0, 0, 0, CARD);
    const v = stat(t, 0, 0);
    await t.run(() => t.engine.actionDestroyCard({ name: 'x', owner: 1 }, a));
    await fertig(t);
    R.check('Ankhota selbst wird beim Abgang gelöscht (nicht Ablage)', geloescht(t, 0, CARD) === 1 && abl(t, 0, CARD) === 0, [t.pile(0, 'deletedPile'), t.pile(0, 'discardPile')]);
    R.check('… und ihr Held bekommt nichts (sie steht nicht mehr da)', stat(t, 0, 0).max === v.max, [v, stat(t, 0, 0)]);
  }
  {
    const t = await H.fresh({ hand: [[], []] });
    t.put(0, 0, 0, CARD);
    const v = stat(t, 0, 0);
    await t.run(() => { t.gs.players[1].deletedPile.push('Fireball'); });
    await fertig(t);
    R.check('gelöschte NICHT-Kreatur (Spell) zählt nicht', stat(t, 0, 0).max === v.max);
    await t.run(() => { t.gs.players[1].deletedPile.push(FODDER); });
    await fertig(t);
    R.check('Kreatur-Karte aus Hand/Ablage/Deck gelöscht (Stapel-Eintrag) zählt: +10', stat(t, 0, 0).max === v.max + 10, [v, stat(t, 0, 0)]);
  }
  {
    // Stummgeschaltet: Frost → kein Löschen, kein Zuwachs
    const t = await H.fresh({ hand: [[], []] });
    const a = t.put(0, 0, 0, CARD); a.counters.frozen = 1;
    const k = t.put(1, 0, 0, FODDER);
    const v = stat(t, 0, 0);
    await t.run(() => t.engine.actionDestroyCard({ name: 'x', owner: 1 }, k));
    await fertig(t);
    R.check('gefrorene Ankhota: Kreatur landet normal in der Ablage', abl(t, 1, FODDER) === 1 && geloescht(t, 1, FODDER) === 0, [t.pile(1, 'discardPile'), t.pile(1, 'deletedPile')]);
    R.check('… und kein Zuwachs', stat(t, 0, 0).max === v.max);
  }
  {
    // Umzug innerhalb des Bretts (Support → Support) ist KEIN Verlassen
    const t = await H.fresh({ hand: [[], []] });
    t.put(0, 0, 0, CARD);
    const k = t.put(0, 1, 0, FODDER);
    const v = stat(t, 0, 0);
    await t.run(() => t.engine.actionMoveCard(k, 'support', 2, 1, { source: 'Test', sourceOwner: 0 }));
    await fertig(t);
    R.check('Brett → Brett: nicht gelöscht, kein Zuwachs', geloescht(t, 0, FODDER) === 0 && stat(t, 0, 0).max === v.max && !!t.find(FODDER, 'support'), [t.pile(0, 'deletedPile')]);
  }
  {
    // zwei Ankhotas: jede zählt für ihren Helden
    const t = await H.fresh({ hand: [[], []] });
    t.put(0, 0, 0, CARD); t.put(1, 1, 0, CARD);
    const k = t.put(1, 0, 1, FODDER);
    const v0 = stat(t, 0, 0), v1 = stat(t, 1, 1);
    await t.run(() => t.engine.actionDestroyCard({ name: 'x', owner: 0 }, k));
    await fertig(t);
    R.check('zwei Ankhota: jeder Held +10', stat(t, 0, 0).max === v0.max + 10 && stat(t, 1, 1).max === v1.max + 10, [stat(t, 0, 0), stat(t, 1, 1)]);
  }

  R.finish();
})().catch(e => { process.stderr.write('THROW ' + (e && e.stack || e) + '\n'); process.exit(2); });
