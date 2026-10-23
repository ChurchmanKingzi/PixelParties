'use strict';
// W63b-02 · Card Game Player Inya: wird ein Zauber mit FORTWIRKENDEM Effekt zum Fantasy Buddy Token, muss der Effekt laufen wie ohne Token — egal, ob der Token überlebt oder stirbt
//
// Kartentext Inya: „… you may summon that Spell into one of this Hero's free Support Zones as a Fantasy Buddy Token with 10 HP after it has resolved instead of sending it to the discard pile."
//   → Der TOKEN ersetzt nur das Ablegen; die ausstehende Wirkung des Zaubers gehört dem Zauber, nicht der Karte/dem Token.
// Befund (Al, „lingering Effect feuert nie"): vier Zauber hängen ihre Wirkung an die gespielte KARTENINSTANZ und sagen dem Spielweg das über `gs._spellKeepInstance`; die Instanz wandert
//   dann in die ABLAGE und wirkt von dort (Hooks mit `ctx.cardZone === 'discard'`): Anti Magic Zone (Fenster für später beschworene Kreaturen), Calm Diatribe (zweite Aktion im nächsten Zug),
//   Weapon Unleashing (zweite Aktion des Nutzers), Mission of the Light Brigade (2 Zusatzaktionen). Inyas Token setzt `_spellPlacedOnBoard` → der Spielweg übersprang den Instanz-Zweig:
//   die Instanz blieb als Geist in der Zone `hand` (Hooks mit Ablage-Prüfung feuerten nie — AMZ: später beschworene Kreaturen waren NICHT negiert), `_spellKeepInstance` blieb stehen.
// Erwartet: Ergebnis mit Inya (Token überlebt / Token stirbt) == Ergebnis ohne Inya (== Kartentext). Beide Sitze.
// Exit 0 = korrekt.
const H = require('../../lib/h.js');
const IN = 'Card Game Player Inya';

/** Brett: Wirker = Sitz `seat`, Held 0 = Inya (oder neutral). Nur die ERSTE Buddy-Rückfrage wird bejaht (der Zauber unter Test), weitere abgelehnt. */
async function brett(seat, inya, hand, o = {}) {
  const eigene = [inya ? IN : H.BLANK_HEROES[0], H.BLANK_HEROES[1], H.BLANK_HEROES[2]];
  const heroes = seat === 0 ? [eigene, null] : [null, eigene];
  const h = [[], []]; h[seat] = hand;
  const t = await H.fresh({ heroes, hand: h, turn: 5, active: seat, deckSize: 20 });
  let ja = 1;
  t.script.push({ match: (d) => d.type === 'confirm' && d.title === IN, answer: () => ({ confirmed: ja-- > 0 }) });
  return t;
}
const buddy = (t) => t.inst(c => c.counters && c.counters._fantasyBuddyToken && c.zone === 'support')[0] || null;
async function tokenWeg(t, wie, seat) {
  const b = buddy(t); if (!b) return;
  if (wie === 'tot') await t.run(() => t.engine.actionDestroyCard({ name: 'X', owner: 1 - seat }, b));
}

// ── A) Anti Magic Zone: Kreaturen, die im Fenster beschworen werden, sind negiert; nach dem Fenster nicht ──
async function amz(seat, inya, wie) {
  const opp = 1 - seat;
  const t = await brett(seat, inya, ['Anti Magic Zone']);
  const alt = t.put(opp, 0, 0, H.INERT.creature);
  await t.play(seat, 'Anti Magic Zone', { hero: 0 });
  await tokenWeg(t, wie, seat);
  const out = { bestehend: t.engine.isCreatureEffectSuppressed(alt) };
  await t.endTurn();                                                        // Gegnerzug (Fenster offen)
  await t.play(opp, H.INERT.creature, { hero: 1, slot: 1 });
  const a = t.inst(c => c.zone === 'support' && c.owner === opp && c.heroIdx === 1 && c.zoneSlot === 1)[0];
  out.imFenster = !!(a && t.engine.isCreatureEffectSuppressed(a));
  await t.endTurn();                                                        // eigener Zug (Fenster zu)
  await t.play(seat, H.INERT.creature, { hero: 1, slot: 1 });
  const b = t.inst(c => c.zone === 'support' && c.owner === seat && c.heroIdx === 1 && c.zoneSlot === 1)[0];
  out.nachFenster = !!(b && t.engine.isCreatureEffectSuppressed(b));
  out.fehler = t.errors.length;
  return { out, t };
}

// ── B) Calm Diatribe: der gewählte Held 1 hat im nächsten eigenen Zug eine zweite Aktion (calm_ready, zwei Fireballs) ──
async function calm(seat, inya, wie) {
  const opp = 1 - seat;
  const t = await brett(seat, inya, ['Calm Diatribe', 'Fireball', 'Fireball']);
  t.targetFn = (v) => { const x = v.find(z => z.type === 'hero' && z.owner === seat && z.heroIdx === 1); return [(x || v[0]).id]; };
  await t.play(seat, 'Calm Diatribe', { hero: 0 });
  await tokenWeg(t, wie, seat);
  await t.endTurn(); await t.endTurn();
  const out = { calmReady: Object.keys(t.gs.players[seat].heroes[1].buffs || {}).includes('calm_ready') };
  t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === opp && x.heroIdx === 0).id];
  const r1 = await t.play(seat, 'Fireball', { hero: 1 });
  const r2 = await t.play(seat, 'Fireball', { hero: 1, keepActions: true });
  out.zweiAktionen = r1 === true && r2 === true;
  out.fehler = t.errors.length;
  return { out, t };
}

// ── C) Weapon Unleashing: der Nutzer (Held 0) darf in der Action Phase zwei Fireballs wirken ──
async function wu(seat, inya, wie) {
  const opp = 1 - seat;
  const t = await brett(seat, inya, ['Weapon Unleashing', 'Fireball', 'Fireball', 'Fireball']);
  t.setAbilities(seat, 0, [['Fighting', 'Fighting', 'Fighting'], ['Destruction Magic', 'Destruction Magic'], []]);
  t.targetFn = (valid) => { const v = valid.find(q => q.type === 'hero' && q.owner === opp && q.heroIdx === 0); return [(v || valid[0]).id]; };
  await t.play(seat, 'Weapon Unleashing', { hero: 0, noGrant: true, phase: 2 });
  await tokenWeg(t, wie, seat);
  await t.run(() => t.engine.advanceToPhase(seat, 3, { manual: true }));
  let n = 0;
  for (let i = 0; i < 3; i++) {
    const ok = await t.play(seat, 'Fireball', { hero: 0, noGrant: true, keepActions: true, phase: t.gs.currentPhase });
    if (ok === true) n++; else break;
  }
  return { out: { fireballs: n, fehler: t.errors.length }, t };
}

// ── D) Mission of the Light Brigade: Mission (1. Aktion der Action Phase) + genau 2 Zusatzaktionen (Held 1) ──
async function mission(seat, inya, wie) {
  const opp = 1 - seat;
  const t = await brett(seat, inya, ['Mission of the Light Brigade', 'Rockfall', 'Rockfall', 'Rockfall']);
  t.setAbilities(seat, 0, [['Support Magic', 'Support Magic', 'Support Magic', 'Support Magic'], [], []]);   // Mission: Support Magic Lv 4
  t.setAbilities(seat, 1, [['Destruction Magic', 'Destruction Magic', 'Destruction Magic'], [], []]);
  t.targetFn = (valid) => { const v = valid.find(q => q.type === 'hero' && q.owner === opp && q.heroIdx === 0); return [(v || valid[0]).id]; };
  const rm = await t.play(seat, 'Mission of the Light Brigade', { hero: 0, noGrant: true, phase: 3 });
  await tokenWeg(t, wie, seat);
  const out = { gespielt: rm === true, ladungen: t.gs.players[seat]._missionCharges };
  let n = 0;
  for (let i = 0; i < 3; i++) {
    const ok = await t.play(seat, 'Rockfall', { hero: 1, noGrant: true, keepActions: true, phase: 3 });
    if (ok === true) n++; else break;
  }
  out.zusatz = n; out.ladungenDanach = t.gs.players[seat]._missionCharges; out.fehler = t.errors.length;
  return { out, t };
}

const SOLL = {
  amz: { bestehend: true, imFenster: true, nachFenster: false, fehler: 0 },
  calm: { calmReady: true, zweiAktionen: true, fehler: 0 },
  wu: { fireballs: 2, fehler: 0 },
  mission: { gespielt: true, ladungen: 2, zusatz: 2, ladungenDanach: 0, fehler: 0 },
};
const FAELLE = { amz, calm, wu, mission };
const NAMEN = { amz: 'Anti Magic Zone', calm: 'Calm Diatribe', wu: 'Weapon Unleashing', mission: 'Mission of the Light Brigade' };

(async () => {
  const R = H.runner();
  for (const seat of [0, 1]) {
    for (const [k, fn] of Object.entries(FAELLE)) {
      R.section(`── Sitz ${seat} · ${NAMEN[k]} ──`);
      const ohne = await fn(seat, false, 'lebt');
      R.check(`[S${seat}] ${NAMEN[k]} · Kontrolle ohne Inya == Kartentext`, JSON.stringify(ohne.out) === JSON.stringify(SOLL[k]), { ist: ohne.out, soll: SOLL[k] });
      for (const wie of ['lebt', 'tot']) {
        const m = await fn(seat, true, wie);
        const b = buddy(m.t);
        R.check(`[S${seat}] ${NAMEN[k]} · Inya, Token ${wie === 'lebt' ? 'überlebt' : 'stirbt'}: Wirkung == ohne Token`, JSON.stringify(m.out) === JSON.stringify(ohne.out), { mit: m.out, ohne: ohne.out });
        R.check(`[S${seat}] ${NAMEN[k]} · Inya, Token ${wie === 'lebt' ? 'überlebt' : 'stirbt'}: ${wie === 'lebt' ? 'Buddy liegt, Karte nicht in der Ablage' : 'Buddy ist weg, Karte in der Ablage (W64a: der Spell wandert beim Tod des Buddys in die Ablage, nicht in den Gelöscht-Stapel)'}`, (wie === 'lebt' ? !!b && !m.t.gs.players[seat].discardPile.includes(NAMEN[k]) : !b && m.t.gs.players[seat].discardPile.filter(x => x === NAMEN[k]).length === 1 && !m.t.gs.players[seat].deletedPile.includes(NAMEN[k])), { buddy: !!b, ablage: m.t.gs.players[seat].discardPile, geloescht: m.t.gs.players[seat].deletedPile });
        const geister = m.t.inst(c => c.name === NAMEN[k] && c.zone === 'hand' && c.owner === seat && c.heroIdx >= 0).length;
        R.check(`[S${seat}] ${NAMEN[k]} · Inya: kein Geist in der Zone „hand", Wirkungsträger liegt in der Ablage`, geister === 0 && m.t.inst(c => c.name === NAMEN[k] && c.zone === 'discard').length === 1, { geister, traeger: m.t.inst(c => c.name === NAMEN[k]).map(c => c.zone) });
        R.check(`[S${seat}] ${NAMEN[k]} · Inya: Marke „_spellKeepInstance" bleibt nicht stehen`, !m.t.gs._spellKeepInstance && !m.t.gs._spellBecameToken, { keep: m.t.gs._spellKeepInstance });
      }
    }
  }
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
