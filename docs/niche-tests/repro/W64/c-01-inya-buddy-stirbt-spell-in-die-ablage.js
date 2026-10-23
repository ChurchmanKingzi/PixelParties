'use strict';
// W64c-01 · Card Game Player Inya: stirbt/verlässt der Fantasy Buddy Token das Feld, geht die Spell-Karte in die ABLAGE ihres Besitzers (nicht in den Gelöscht-Stapel)
//
// Kartentext Inya: „Whenever this Hero uses a Spell during your turn, you may summon that Spell into one of this Hero's free Support Zones as a Fantasy Buddy Token
//   with 10 HP after it has resolved instead of sending it to the discard pile. While you control at least 1 Fantasy Buddy Token, this Hero takes no damage."
// Al (23.10.2026): „Tatsächlich sollte der Spell einfach in den Discard Pile wandern, auf der Karte steht nirgends, dass er gelöscht würde."
// Vorher (W5a „Unterkarte"): die Spell-Karte unter dem Buddy landete im Gelöscht-Stapel. Jetzt: Schaden, Zerstören, Opfer, Rückgabe → Ablage des BESITZERS;
//   nur ein ausdrückliches „delete" löscht sie. Biomancy-/Boulder-Token bleiben unverändert (Gelöscht-Stapel). Der Gegenwert zählt in Ablage-Zählern.
// Exit 0 = korrekt.
const H = require('../../lib/h.js');
const IN = 'Card Game Player Inya', SPELL = 'Fireball';

async function lauf(seat, o = {}) {
  const opp = 1 - seat;
  const eigene = [H.BLANK_HEROES[0], H.BLANK_HEROES[1], IN];
  const heroes = seat === 0 ? [eigene, null] : [null, eigene];
  const hand = [[], []]; hand[seat] = [SPELL, SPELL];
  const t = await H.fresh({ heroes, hand, turn: 5, active: seat });
  t.script.push({ match: (d) => d.type === 'confirm' && d.title === IN, answer: () => ({ confirmed: true }) });
  t.put(opp, 0, 0, H.INERT.big);
  t.targetFn = (v) => { const x = v.find(q => q.owner === opp && q.type === 'equip'); return x ? [x.id] : undefined; };
  if (o.gestohlen) { const hi = t.engine.cardInstances.find(c => c.zone === 'hand' && c.owner === seat && c.name === SPELL); hi.originalOwner = opp; }
  const r = await t.play(seat, SPELL, { hero: 2 });
  const buddy = t.inst(c => c.counters && c.counters._fantasyBuddyToken)[0] || null;
  return { t, r, seat, opp, ps: t.gs.players[seat], buddy };
}
const n = (arr, name) => arr.filter(x => x === name).length;

(async () => {
  const R = H.runner();
  for (const seat of [0, 1]) {
    R.section(`── Sitz ${seat} ──`);
    const k = await lauf(seat);
    // Kontrolle der Ablage-Zähler-Probe: bei LEERER Ablage ist Guardian Beast Hu beschwörbar
    {
      const c = await lauf(seat);
      c.t.setHand(seat, ['Guardian Beast Hu']); c.t.grantFor(seat, 0, 'Guardian Beast Hu');
      const hu0 = await c.t.play(seat, 'Guardian Beast Hu', { hero: 0, slot: 0 });
      R.check(`[S${seat}] Kontrolle: bei leerer Ablage (Zauber liegt als Buddy auf dem Brett) ist Guardian Beast Hu beschwörbar`, hu0 === true && c.ps.discardPile.length === 0, { hu0, abl: c.ps.discardPile });
    }
    R.check(`[S${seat}] Ausgangslage: Buddy liegt in Inyas Zone, der Zauber ist weder in Ablage noch im Gelöscht-Stapel`, k.r === true && !!k.buddy && k.buddy.heroIdx === 2 && n(k.ps.discardPile, SPELL) === 0 && n(k.ps.deletedPile, SPELL) === 0, { r: k.r, buddy: !!k.buddy, abl: k.ps.discardPile, del: k.ps.deletedPile });

    const wege = {
      'Schaden (Creature-Batch)': (s) => s.t.run(() => s.t.engine.processCreatureDamageBatch([{ inst: s.buddy, amount: 999, type: 'physical', source: { name: 'X', owner: s.opp, heroIdx: 0, heroOwner: s.opp }, sourceOwner: s.opp, canBeNegated: true, isStatusDamage: false, animType: null }])),
      'Zerstören': (s) => s.t.run(() => s.t.engine.actionDestroyCard({ name: 'X', owner: s.opp }, s.buddy)),
      'Opfer': (s) => s.t.run(() => s.t.engine.actionDestroyCard({ name: 'X', owner: s.seat, isSacrifice: true }, s.buddy, { isSacrifice: true })),
      'Rückgabe auf die Hand': (s) => s.t.run(() => s.t.engine.actionMoveCard(s.buddy, 'hand', { source: 'X' })),
      'Verschieben in die Ablage': (s) => s.t.run(() => s.t.engine.actionMoveCard(s.buddy, 'discard', undefined, undefined, { source: 'X' })),
    };
    for (const [weg, fn] of Object.entries(wege)) {
      const s = await lauf(seat);
      const handVor = s.ps.hand.length;
      await fn(s);
      const weg_ = s.t.inst(c => c.id === s.buddy.id && c.zone === 'support').length === 0;
      R.check(`[S${seat}] ${weg}: Buddy weg, Zone leer`, weg_ && s.ps.supportZones[2].every(z => z.length === 0), { zonen: s.ps.supportZones[2] });
      R.check(`[S${seat}] ${weg}: die Spell-Karte liegt GENAU EINMAL in der Ablage ihres Besitzers`, n(s.ps.discardPile, SPELL) === 1, { abl: s.ps.discardPile });
      R.check(`[S${seat}] ${weg}: nicht im Gelöscht-Stapel, nicht in der Hand, nicht beim Gegner`, n(s.ps.deletedPile, SPELL) === 0 && s.ps.hand.length === handVor && n(s.ps.hand, SPELL) === n(s.t.gs.players[seat].hand, SPELL) && n(s.t.gs.players[s.opp].discardPile, SPELL) === 0 && n(s.t.gs.players[s.opp].deletedPile, SPELL) === 0, { del: s.ps.deletedPile, hand: s.ps.hand, oppAbl: s.t.gs.players[s.opp].discardPile });
      R.check(`[S${seat}] ${weg}: keine Geisterinstanz im Brett, Zustand sauber, keine Engine-Fehler`, s.t.audit().length === 0 && s.t.errors.length === 0 && !s.t.inst(c => c.counters && c.counters._fantasyBuddyToken).length, { audit: s.t.audit(), errors: s.t.errors });
      // Ablage-Zähler: „Guardian Beast Hu" ist nur beschwörbar, solange die Ablage LEER ist — der Zauber in der Ablage zählt.
      s.ps.hand.length = 0; s.ps.hand.push('Guardian Beast Hu');
      s.t.setHand(seat, ['Guardian Beast Hu']);
      s.t.grantFor(seat, 0, 'Guardian Beast Hu');
      const hu = await s.t.play(seat, 'Guardian Beast Hu', { hero: 0, slot: 0 });
      R.check(`[S${seat}] ${weg}: der Zauber in der Ablage zählt (Guardian Beast Hu „only while your discard pile is empty" nicht beschwörbar)`, hu !== true, hu);
      // Inya nimmt wieder Schaden
      const inya = s.ps.heroes[2];
      await s.t.run(() => s.t.engine.actionDealDamage({ name: 'X', owner: s.opp, heroIdx: 0, heroOwner: s.opp }, inya, 50, 'physical'));
      R.check(`[S${seat}] ${weg}: ohne Buddy nimmt Inya wieder Schaden`, inya.hp === 750, inya.hp);
    }

    // ausdrückliches „delete" bleibt Löschen
    const d = await lauf(seat);
    await d.t.run(() => d.t.engine.actionMoveCard(d.buddy, 'deleted', undefined, undefined, { source: 'X' }));
    R.check(`[S${seat}] ausdrückliches „delete the Token": die Spell-Karte geht in den Gelöscht-Stapel (nicht in die Ablage)`, n(d.ps.deletedPile, SPELL) === 1 && n(d.ps.discardPile, SPELL) === 0, { abl: d.ps.discardPile, del: d.ps.deletedPile });

    // Besitzer-Regel: gestohlener Zauber → Ablage des echten Besitzers
    const g = await lauf(seat, { gestohlen: true });
    R.check(`[S${seat}] gestohlener Zauber: Buddy trägt den echten Besitzer`, !!g.buddy && g.buddy.originalOwner === g.opp, { o: g.buddy && g.buddy.originalOwner });
    await g.t.run(() => g.t.engine.actionDestroyCard({ name: 'X', owner: g.opp }, g.buddy));
    R.check(`[S${seat}] gestohlener Zauber: stirbt der Buddy, liegt die Karte in der Ablage ihres BESITZERS (nicht des Wirkers)`, n(g.t.gs.players[g.opp].discardPile, SPELL) === 1 && n(g.ps.discardPile, SPELL) === 0 && n(g.ps.deletedPile, SPELL) === 0 && n(g.t.gs.players[g.opp].deletedPile, SPELL) === 0, { oppAbl: g.t.gs.players[g.opp].discardPile, abl: g.ps.discardPile, del: g.ps.deletedPile });

    // Gegenprobe: Biomancy-Token (echte Karte darunter, Potion) → bleibt Gelöscht-Stapel
    const bt = await H.fresh({ heroes: seat === 0 ? [[H.BLANK_HEROES[0], H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null] : [null, [H.BLANK_HEROES[0], H.BLANK_HEROES[1], H.BLANK_HEROES[2]]], turn: 5, active: seat });
    const potion = Object.values(H.DB).find(c => c.cardType === 'Potion' && !c.banned) ;
    const { biomancyTokenCounters } = require('../../../../cards/effects/_biomancy-shared.js');
    const tk = bt.put(seat, 0, 0, potion.name, { counters: biomancyTokenCounters(potion, 1) });
    await bt.run(() => bt.engine.actionDestroyCard({ name: 'X', owner: 1 - seat }, tk));
    const bps = bt.gs.players[seat];
    R.check(`[S${seat}] Gegenprobe Biomancy Token (${potion.name}): die Potion darunter wird weiter GELÖSCHT (nicht abgelegt)`, n(bps.deletedPile, potion.name) === 1 && n(bps.discardPile, potion.name) === 0, { abl: bps.discardPile, del: bps.deletedPile });
  }
  R.finish();
})().catch(e => { process.stderr.write(String(e && e.stack || e) + '\n'); process.exit(2); });
