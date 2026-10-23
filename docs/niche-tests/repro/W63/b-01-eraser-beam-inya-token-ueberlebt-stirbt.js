'use strict';
// W63b-01 · Card Game Player Inya + Eraser Beam: Al-Meldung „der lingering Effect (Instant-Kill) feuert nie, wenn der Token getötet wird und das Feld verlässt"
//
// Kartentexte: Inya: „Whenever this Hero uses a Spell during your turn, you may summon that Spell into one of this Hero's free Support Zones as a Fantasy Buddy Token
//   with 10 HP after it has resolved instead of sending it to the discard pile. While you control at least 1 Fantasy Buddy Token, this Hero takes no damage."
//   Eraser Beam: „This must be the only Spell you play this turn. Place 3 Pollution Tokens into your free Support Zones to use this Spell. Choose a target your opponent
//   controls and defeat it. This Spell can never hit more than 1 target. You can only play 1 "Eraser Beam" per game."
// Befund: Eraser Beam hat KEINEN nachlaufenden Teil — „defeat it" geschieht in `onPlay` (also VOR Inyas `afterSpellResolved`), nur `_spellLockTurn` und der
//   Einmal-pro-Spiel-Stempel bleiben (am Spieler, nicht an der Karte). Der Instant-Kill feuert deshalb in allen drei Fällen: (a) Token überlebt, (b) Token stirbt/verlässt
//   das Feld (Schaden, Zerstören, Opfer, Rückgabe), (c) das Verwandeln löscht nichts. Diese Datei fixiert das (Gegenproben GRÜN auf altem und neuem Stand).
//   Was auf dem ALTEN Stand rot war (Wurzel der Meldung): die gespielte Hand-Instanz blieb als Geist in der Zone `hand` zurück (`ghost`), und das Skript des Zaubers lief
//   zusätzlich an der Token-Instanz auf dem Brett (`tokenSkript`: Eraser Beams `afterSpellResolved`-Lauscher stempelt vom Brett aus weiter).
// Szene (je Sitz): Wirker: Held 0/1 neutral, Held 2 = Inya (Pollution-Tokens füllen zuerst Held 0/1, Inya behält freie Zonen); Gegner: ZZ Dummy (200 HP) bzw. Held als Ziel.
// Exit 0 = korrekt.
const H = require('../../lib/h.js');
const IN = 'Card Game Player Inya', EB = 'Eraser Beam';

async function lauf(seat, o) {
  const opp = 1 - seat;
  const eigene = [H.BLANK_HEROES[0], H.BLANK_HEROES[1], o.inya ? IN : H.BLANK_HEROES[2]];
  const heroes = seat === 0 ? [eigene, null] : [null, eigene];
  const hand = [[], []]; hand[seat] = [EB, EB, H.INERT.filler];
  const t = await H.fresh({ heroes, hand, turn: 5, active: seat });
  t.script.push({ match: (d) => d.type === 'confirm' && d.title === IN, answer: () => ({ confirmed: o.inya !== 'nein' }) });   // Inyas Rückfrage „Buddy beschwören?"
  const ziel = t.put(opp, 0, 0, H.INERT.creature);
  t.targetFn = (v) => {
    const x = o.ziel === 'held' ? v.find(q => q.type === 'hero' && q.owner === opp && q.heroIdx === 0) : v.find(q => q.owner === opp && q.type === 'equip' && q.slotIdx === 0);
    return x ? [x.id] : undefined;
  };
  const r = await t.play(seat, EB, { hero: 2 });
  const ps = t.gs.players[seat];
  const buddy = t.inst(c => c.counters && c.counters._fantasyBuddyToken)[0] || null;
  return { t, r, seat, opp, ziel, ps, buddy };
}
const geist = (t, seat) => t.inst(c => c.name === EB && c.zone === 'hand' && c.owner === seat && c.heroIdx >= 0).length;
const zielTot = (s) => s.t.inst(c => c.id === s.ziel.id && c.zone === 'support').length === 0 && !s.t.gs.players[s.opp].supportZones[0][0].length;
const eraserGestempelt = (s) => !!(s.ps._oncePerGameUsed && s.ps._oncePerGameUsed.has('eraserBeam'));

(async () => {
  const R = H.runner();
  for (const seat of [0, 1]) {
    R.section(`── Sitz ${seat} ──`);
    // Kontrolle ohne Inya
    const k = await lauf(seat, { inya: false });
    R.check(`[S${seat}] Kontrolle ohne Inya: Eraser Beam gespielt, Kreatur besiegt, Karte in der Ablage`, k.r === true && zielTot(k) && k.ps.discardPile.includes(EB) && !k.buddy, { r: k.r, tot: zielTot(k), ablage: k.ps.discardPile });
    // (c) mit Inya, „ja": der Instant-Kill feuert trotz Verwandlung
    const a = await lauf(seat, { inya: true });
    R.check(`[S${seat}] (c) Inya ja: gespielt, Kreatur sofort besiegt (die Verwandlung löscht den Kill nicht)`, a.r === true && zielTot(a), { r: a.r, tot: zielTot(a) });
    R.check(`[S${seat}] Buddy-Token (10 HP, Creature/Token) liegt in Inyas Zone, Karte NICHT in der Ablage`, !!a.buddy && a.buddy.heroIdx === 2 && a.buddy.counters.currentHp === 10 && !a.ps.discardPile.includes(EB), { buddy: !!a.buddy, ablage: a.ps.discardPile });
    R.check(`[S${seat}] Einmal-pro-Spiel-Stempel und Spell-Sperre (nur 1 Spell) bleiben`, eraserGestempelt(a) && a.ps._spellLockTurn === a.t.gs.turn, { stempel: eraserGestempelt(a), sperre: a.ps._spellLockTurn });
    const zweit = await a.t.play(seat, H.INERT.filler, { hero: 0, keepActions: true });
    R.check(`[S${seat}] danach kein weiterer Spell spielbar (Eraser Beam: only Spell)`, zweit !== true, zweit);
    R.check(`[S${seat}] KEIN Geist: keine Hand-Instanz der gespielten Karte bleibt zurück`, geist(a.t, seat) === 0, geist(a.t, seat));
    R.check(`[S${seat}] das Spell-Skript läuft nicht am Token (kein Hook an der Buddy-Instanz)`, !!a.buddy && a.buddy.isActiveIn('support') === false && !a.buddy.getHook('afterSpellResolved'), { aktiv: a.buddy && a.buddy.isActiveIn('support') });
    // (a) Token überlebt: Zugwechsel, nichts feuert nach, nichts geht verloren
    await a.t.endTurn(); await a.t.endTurn();
    R.check(`[S${seat}] (a) Token überlebt zwei Zugwechsel: Kill bleibt, Buddy da, Eraser Beam weiter gestempelt, keine Fehler`, zielTot(a) && !!a.buddy && a.buddy.zone === 'support' && eraserGestempelt(a) && a.t.errors.length === 0, { errors: a.t.errors });
    // „nein": Eraser Beam geht normal in die Ablage, Kill wie gehabt
    const n = await lauf(seat, { inya: 'nein' });
    R.check(`[S${seat}] Inya nein: Kill, Karte in der Ablage, kein Buddy, kein Geist`, n.r === true && zielTot(n) && n.ps.discardPile.includes(EB) && !n.buddy && geist(n.t, seat) === 0, { r: n.r, ablage: n.ps.discardPile, buddy: !!n.buddy });
    // Heldenziel
    const h = await lauf(seat, { inya: true, ziel: 'held' });
    R.check(`[S${seat}] Inya ja, Heldenziel: Gegnerheld besiegt, Buddy liegt`, h.r === true && h.t.hp(h.opp, 0) <= 0 && !!h.buddy, { r: h.r, hp: h.t.hp(h.opp, 0), buddy: !!h.buddy });

    // (b) Token verlässt das Feld auf allen Wegen — der Kill steht, nichts feuert doppelt, nichts bleibt hängen
    const wege = {
      'Schaden (Creature-Batch)': (s) => s.t.run(() => s.t.engine.processCreatureDamageBatch([{ inst: s.buddy, amount: 999, type: 'physical', source: { name: 'X', owner: s.opp, heroIdx: 0, heroOwner: s.opp }, sourceOwner: s.opp, canBeNegated: true, isStatusDamage: false, animType: null }])),
      'Zerstören': (s) => s.t.run(() => s.t.engine.actionDestroyCard({ name: 'X', owner: s.opp }, s.buddy)),
      'Opfer': (s) => s.t.run(() => s.t.engine.actionDestroyCard({ name: 'X', owner: s.seat, isSacrifice: true }, s.buddy, { isSacrifice: true })),
      'Rückgabe auf die Hand': (s) => s.t.run(() => s.t.engine.actionMoveCard ? s.t.engine.actionMoveCard(s.buddy, 'hand', { source: 'X' }) : null),
    };
    for (const [weg, fn] of Object.entries(wege)) {
      const s = await lauf(seat, { inya: true });
      const hpVorher = s.t.hp(s.opp, 0);
      await fn(s);
      const zeug = s.t.inst(c => c.id === s.buddy.id && c.zone === 'support').length;
      R.check(`[S${seat}] (b) ${weg}: Token weg`, zeug === 0, { zone: s.buddy.zone });
      R.check(`[S${seat}] (b) ${weg}: Kill steht, Stempel/Sperre bleiben, kein Doppelfeuer`, zielTot(s) && eraserGestempelt(s) && s.ps._spellLockTurn === s.t.gs.turn && s.t.hp(s.opp, 0) === hpVorher && s.t.lg('eraser_beam').length === 1, { lg: s.t.lg('eraser_beam').length });
      await s.t.endTurn(); await s.t.endTurn();
      R.check(`[S${seat}] (b) ${weg}: nach zwei Zugwechseln weiter nichts, keine Engine-Fehler, kein Geist`, zielTot(s) && s.t.lg('eraser_beam').length === 1 && s.t.errors.length === 0 && geist(s.t, seat) === 0, { errors: s.t.errors });
    }
    // Inya selbst: ohne Buddy nimmt sie wieder Schaden, mit Buddy nicht (Text 2)
    const s2 = await lauf(seat, { inya: true });
    const inya = s2.ps.heroes[2];
    await s2.t.run(() => s2.t.engine.actionDealDamage({ name: 'X', owner: s2.opp, heroIdx: 0, heroOwner: s2.opp }, inya, 50, 'physical'));
    R.check(`[S${seat}] solange der Buddy lebt, nimmt Inya keinen Schaden`, inya.hp === 800, inya.hp);
    await s2.t.run(() => s2.t.engine.actionDestroyCard({ name: 'X', owner: s2.opp }, s2.buddy));
    await s2.t.run(() => s2.t.engine.actionDealDamage({ name: 'X', owner: s2.opp, heroIdx: 0, heroOwner: s2.opp }, inya, 50, 'physical'));
    R.check(`[S${seat}] nach dem Tod des Buddys nimmt Inya wieder Schaden`, inya.hp === 750, inya.hp);
  }
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
