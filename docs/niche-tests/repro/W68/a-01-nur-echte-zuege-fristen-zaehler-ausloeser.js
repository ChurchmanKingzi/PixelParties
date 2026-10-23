'use strict';
// W68a-01 · „NUR ECHTE ZÜGE ZÄHLEN" — ein ÜBERSPRUNGENER Zug (Guardian Beast Zhu, Hand-of-Death-Rider: `ps._skipNextTurn`) beendet keine Frist, bringt keinen Zähler vorwärts und löst keine Zugende-Auslöser aus
//
// Al (Spieldesigner, 23.10.2026) auf die Rückfragen 1–3 aus W67a:
//   1. „At the end of YOUR next turn" (Open Invitation u. a.): „Korrekt, erst nach dem nächsten 'echten' Zug."
//   2. Dauer-Effekte „until the end of (your opponent's) next turn" / „until the beginning of your next turn" (Anti Magic Zone, Frost Rune, Skeleton Death Knight, Pink Sky, Null Zone … und alle übrigen
//      mit solchen Fristen, Status-Dauern „for 1 turn"/„for N turns", Buff-Dauern): „Korrekt, nur 'echte' Züge beenden/bringen Zähler vorwärts."
//   3. „At the end of your opponent's turn" (ohne „next": Moonlight Butterfly, Fun-Fun Circus Clown, Shapeshifter): „Korrekt, nur 'echte' Züge."
// Umsetzung: cards/effects/_zug-fristen.js (Zugnummern-Fristen werden beim Skip um 2 verschoben, wenn der gezählte Zug der übersprungene ist), `_switchTurnInner({ uebersprungen: true })` führt kein Zugende aus.
//
// Aufbau (lib/skip.js): Zug T0 gehört dem Wirker A; Zug T0+i gehört B (i ungerade) bzw. A (i gerade). Jedes Szenario beobachtet nach jedem Zugwechsel (Zugbeginn des nächsten TATSÄCHLICH gespielten Zuges), ob die
// Wirkung noch besteht, und vergleicht mit dem Modell der Frist: 'E' Ende des nächsten echten Gegnerzuges · 'N' Ende des nächsten echten eigenen Zuges · 'B' Beginn des nächsten echten eigenen Zuges ·
// 'W' genau der nächste echte eigene Zug · 'ZA'/'ZALL' Zähler „am Ende jedes (eigenen) Zuges" · 'D' „this turn". Szenarien je Sitz: ohne Skip (Gegenprobe, bleibt wie bisher) · Gegnerzug 1 übersprungen ·
// Gegnerzug 1 und 3 (zweimal hintereinander) · eigener Zug 2 · eigene Züge 2 und 4 · Gegnerzug 1 UND eigener Zug 2 (zwei Skips direkt hintereinander).
// Kategorien: Status-Dauer · Zugnummern-Status/Buff „until the end of …" · Buff „until the beginning of your next turn" · Aufträge „end of next turn" · Zugende-Auslöser ohne „next" · Zähler · eigene Zugnummern-Speicher · „this turn".
// Exit 0 = korrekt.
const Skip = require('../../lib/skip.js');
const { H } = Skip;
const ASC = 'Riffel, Master of the Ultimate Gun', RIF = 'Future Tech Gunslinger Riffel';
const wahlHeld = (s, owner, hi = 0) => (v) => { const x = v.find(q => q.type === 'hero' && q.owner === owner && q.heroIdx === hi); return x ? [x.id] : undefined; };

/** Standard-Szene: Wirker `seat` am Zug, T0 = 5. `o`: hand (Karten des Wirkers), heroes (Namen für `seat`), deck (Karten des Wirkers vorn). */
async function szene(seat, o = {}) {
  const opp = 1 - seat;
  const heroes = o.heroes ? (seat === 0 ? [o.heroes, null] : [null, o.heroes]) : undefined;
  const hand = [[], []]; hand[seat] = o.hand || [];
  const deck = o.deck ? (() => { const d = [Array(40).fill(H.INERT.creature), Array(40).fill(H.INERT.creature)]; d[seat] = [...o.deck, ...Array(30).fill(H.INERT.creature)]; return d; })() : undefined;
  const t = await H.fresh({ heroes, hand, deck, turn: 5, active: seat, deckSize: 40, gold: 300 });
  t.seat = seat; t.opp = opp;
  return t;
}

// ── Die Tabelle ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// art: Fristmodell · text: Kartentext (Kurzform) · bau(seat, skip) → { t, o } mit dem schon gewirkten Szenenzustand und den lauf()-Optionen · probe(t, seat) → 0/1 (bzw. Zähler)
const TABELLE = [];
const eintrag = (kategorie, name, art, text, bau, probe, opt = {}) => TABELLE.push({ kategorie, name, art, text, bau, probe, ...opt });

// 1) Status-Dauer („for 1 turn" — tickt am Ende des betroffenen Spielers: schon bisher nur echte Züge)
eintrag('Status-Dauer', 'Icebolt', 'E', 'Freeze … for 1 turn', async (seat) => {
  const t = await szene(seat, { hand: ['Icebolt'] }); t.targetFn = wahlHeld(seat, 1 - seat);
  await t.play(seat, 'Icebolt', { hero: 0 }); return { t };
}, (t, s) => !!t.hero(1 - s, 0).statuses.frozen);

// 2) Zugnummern-Status/-Buff, Frist = ENDE des nächsten (echten) Gegnerzuges bzw. eigenen Zuges
eintrag('Frist ENDE', 'Anti Magic Zone', 'E', 'until the end of your opponent\'s next turn', async (seat) => {
  const t = await szene(seat, { hand: ['Anti Magic Zone'] }); await t.play(seat, 'Anti Magic Zone', { hero: 0 }); return { t };
}, (t, s) => 'magic_silenced' in t.hero(1 - s, 0).statuses);
eintrag('Frist ENDE', 'Pink Sky', 'E', 'until the end of your opponent\'s next turn', async (seat) => {
  const t = await szene(seat, { hand: ['Pink Sky'] }); t.put(1 - seat, 0, 0, H.INERT.creature); t.put(seat, 1, 0, H.INERT.creature);
  await t.play(seat, 'Pink Sky', {}); return { t };
}, (t, s) => t.inst(c => c.name === H.INERT.creature && c.zone === 'support' && c.owner === 1 - s)[0]?.counters.negated > 0);
eintrag('Frist ENDE', 'Forbidden Zone', 'E', 'until the end of your opponent\'s turn', async (seat) => {
  const t = await szene(seat, { hand: ['Forbidden Zone'] }); await t.play(seat, 'Forbidden Zone', { hero: 0 }); return { t };
}, (t, s) => Object.keys(t.hero(1 - s, 0).statuses).length > 0);
eintrag('Frist ENDE', 'Medusa\'s Curse (Stun for 1 turn)', 'E', 'Stun … for 1 turn', async (seat) => {
  const t = await szene(seat, { hand: ["Medusa's Curse"] }); await t.play(seat, "Medusa's Curse", { hero: 0 }); return { t };
}, (t, s) => !!t.hero(1 - s, 0).statuses.stunned);
eintrag('Frist ENDE', 'Disruption Ray', 'N', 'until the end of your next turn', async (seat) => {
  const t = await szene(seat, { hand: ['Disruption Ray'] }); t.targetFn = wahlHeld(seat, 1 - seat);
  await t.play(seat, 'Disruption Ray', { hero: 0 }); return { t };
}, (t, s) => !!(t.hero(1 - s, 0).buffs || {}).disrupted);
eintrag('Frist ENDE', 'Null Zone', 'N', 'Until the end of your next turn', async (seat) => {
  const t = await szene(seat, { hand: ['Null Zone'] }); await t.play(seat, 'Null Zone', { hero: 0 }); return { t };
}, (t, s) => Object.keys(t.hero(1 - s, 0).statuses).length > 0 || Object.keys(t.hero(s, 0).statuses).length > 0);
eintrag('Frist ENDE', 'Smoke Vial', 'N', 'Blinded until the end of your next turn', async (seat) => {
  const t = await szene(seat, { hand: ['Smoke Vial'] }); await t.play(seat, 'Smoke Vial', {}); return { t };
}, (t, s) => !!t.hero(1 - s, 0).statuses.blinded);
eintrag('Frist ENDE', 'Deepsea Horror Clown (Spott)', 'E', 'must choose it … during their next turn', async (seat) => {
  const t = await szene(seat, { hand: ['Deepsea Horror Clown'] }); await t.play(seat, 'Deepsea Horror Clown', { hero: 0 }); return { t };
}, (t) => { const i = t.find('Deepsea Horror Clown', 'support'); return !!(i && i.counters.forcesTargeting && t.gs.turn <= i.counters.forcesTargeting_untilTurn); });
eintrag('Frist ENDE', 'Perfect Disguise', 'E', 'cannot be chosen … during their next turn', async (seat) => {
  const t = await szene(seat, { hand: ['Perfect Disguise'] }); t.targetFn = wahlHeld(seat, seat);
  await t.play(seat, 'Perfect Disguise', {}); return { t };
}, (t, s) => !!t.hero(s, 0).statuses.untargetable);

// 3) Buff/Status „until the beginning of your next turn" (BEGINN des nächsten eigenen Zuges)
eintrag('Frist BEGINN', 'Cloud Pillow', 'B', 'until the beginning of your next turn', async (seat) => {
  const t = await szene(seat, { hand: ['Cloud Pillow'] }); t.targetFn = wahlHeld(seat, seat);
  await t.play(seat, 'Cloud Pillow', {}); return { t };
}, (t, s) => !!(t.hero(s, 0).buffs || {}).cloudy);
eintrag('Frist BEGINN', 'Howling in the Night', 'B', 'until the beginning of your next turn', async (seat) => {
  const t = await szene(seat, { hand: ['Howling in the Night'] }); await t.play(seat, 'Howling in the Night', { hero: 0 }); return { t };
}, (t, s) => Object.keys(t.hero(1 - s, 0).statuses).length > 0);
eintrag('Frist BEGINN', 'Hardy Slime (Spott)', 'B', 'until your next turn', async (seat) => {
  const t = await szene(seat, { hand: ['Hardy Slime'] }); await t.play(seat, 'Hardy Slime', { hero: 0 }); return { t };
}, (t) => { const i = t.find('Hardy Slime', 'support'); return !!(i && i.counters.forcesTargeting && t.gs.turn <= i.counters.forcesTargeting_untilTurn); });
eintrag('Frist BEGINN', 'Resilient Monkee (Schild; Stempel wie im Skript)', 'B', 'until the start of your next turn', async (seat) => {
  const t = await szene(seat); const i = t.put(seat, 0, 0, H.INERT.creature); i.counters._monkeeShieldUntilTurn = t.gs.turn + 2; return { t };
}, (t) => { const i = t.inst(c => c.name === H.INERT.creature && c.zone === 'support')[0]; return !!i && t.gs.turn < i.counters._monkeeShieldUntilTurn; });
eintrag('Frist BEGINN (ereignisgebunden, unverändert)', 'Butterfly Cloud', 'B', 'until the beginning of your next turn', async (seat) => {
  const t = await szene(seat, { hand: ['Butterfly Cloud'] }); await t.play(seat, 'Butterfly Cloud', { hero: 0 }); return { t };
}, (t, s) => !!t.hero(s, 0).statuses.untargetable);
eintrag('Frist BEGINN (ereignisgebunden, unverändert)', 'Thicket', 'B', 'until the beginning of your next turn', async (seat) => {
  const t = await szene(seat, { hand: ['Thicket'] }); t.put(seat, 1, 0, H.INERT.creature);
  t.targetFn = (v) => { const x = v.find(q => q.type === 'equip' && q.owner === seat); return x ? [x.id] : undefined; };
  await t.play(seat, 'Thicket', {}); return { t };
}, (t, s) => !!t.inst(c => c.name === H.INERT.creature && c.owner === s && c.zone === 'support')[0]?.counters.untargetable_all);
eintrag('Frist BEGINN (ereignisgebunden, unverändert)', 'Teleportal', 'B', 'At the beginning of your next turn, add it to your hand', async (seat) => {
  const t = await szene(seat, { hand: ['Teleportal'] }); t.gs.players[seat].mainDeck.push('Fireball');
  t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ cardName: 'Fireball', source: 'deck' }) });
  await t.play(seat, 'Teleportal', { hero: 0 }); return { t };
}, (t, s) => (t.gs.players[s].permanents || []).length);

// 4) Aufträge „At the end of … next turn"
eintrag('Auftrag', 'Staff of Illusions', 'E', 'At the end of your opponent\'s next turn, shuffle the Creature back', async (seat) => {
  const C = 'Elven Archer';
  const t = await szene(seat, { hand: ['Staff of Illusions'], deck: [C, 'Fireball', 'Fireball'] });
  t.script.push({ match: d => d.type === 'cardGallery' && d.title === 'Staff of Illusions', answer: () => ({ cardName: C, source: 'deck' }) });
  t.script.push({ match: d => d.type === 'zonePick', answer: (d) => ({ heroIdx: d.zones[0].heroIdx, slotIdx: d.zones[0].slotIdx }) });
  await t.play(seat, 'Staff of Illusions', { hero: 0, noGrant: true }); return { t };
}, (t, s) => t.inst(c => c.name === 'Elven Archer' && c.zone === 'support' && c.owner === s).length);
eintrag('Auftrag', 'Open Invitation (Frage 1)', 'N', 'At the end of your next turn, shuffle the Ascended Hero back', async (seat, skip) => {
  const t = await szene(seat, { hand: ['Open Invitation', ASC], heroes: [RIF, H.BLANK_HEROES[1], H.BLANK_HEROES[2]] });
  t.script.push({ match: d => d.type === 'pickHandCard', answer: (d, pi, tt) => ({ cardName: ASC, handIndex: tt.gs.players[pi].hand.indexOf(ASC), targetHeroIdx: 0 }) });
  const T0 = t.gs.turn; Skip.vormarken(t, seat, skip);
  await t.play(seat, 'Open Invitation', {}); return { t, o: { T0, schonBeendet: true } };    // die Karte beendet den Zug des Wirkers selbst
}, (t, s) => t.hero(s, 0).name === ASC);
eintrag('Auftrag', 'Perilous Journey (Ascension-Fenster)', 'W', 'During your next turn, you may Ascend …', async (seat) => {
  const t = await szene(seat, { hand: ['Perilous Journey'], deck: [ASC], heroes: [RIF, H.BLANK_HEROES[1], H.BLANK_HEROES[2]] });
  t.script.push({ match: d => d.type === 'cardGallery' && d.title === 'Perilous Journey', answer: () => ({ cardName: ASC, source: 'deck' }) });
  await t.play(seat, 'Perilous Journey', { hero: 0 }); return { t };
}, (t, s) => (t.gs.activePlayer === s ? Object.keys(t.engine.getAscensionGrantOffers(s) || {}).length > 0 : false));

// 5) Zugende-Auslöser OHNE „next" und Zähler „at the end of each …"
eintrag('Zugende-Auslöser', 'Moonlight Butterfly', 'E', 'At the end of your opponent\'s turn, you may add this Creature back to your hand …', async (seat) => {
  const t = await szene(seat); t.put(seat, 0, 0, 'Moonlight Butterfly'); return { t };
}, (t) => t.inst(c => c.name === 'Moonlight Butterfly' && c.zone === 'support').length);
eintrag('Zugende-Auslöser', 'Spider Silk Bridge (Zugende-Fenster)', 'E', 'when your opponent ends their turn without dealing damage …', async (seat) => {
  const t = await szene(seat); t.setAbilities(seat, 0, [['Support Magic'], [], []]); t.putSurprise(seat, 0, 'Spider Silk Bridge');
  t.put(seat, 1, 0, H.INERT.big); t.put(1 - seat, 0, 0, H.INERT.big); return { t };
}, (t) => (t.logs.filter(l => l.type === 'spider_silk_bridge_draw' && l.data.phase === 'activation').length === 0 ? 1 : 0));
eintrag('Zähler', 'Carris, the Time Keeper (Time Counter)', 'ZA', 'At the end of each of your turns, place 1 Time Counter', async (seat) => {
  const t = await szene(seat, { heroes: ['Carris, the Time Keeper', H.BLANK_HEROES[1], H.BLANK_HEROES[2]] }); return { t, o: { schritte: 3 } };   // 3. Counter = Niederlage
}, (t, s) => t.hero(s, 0)._timeCounters || 0);
eintrag('Zähler', 'Doom Clock (Doom Counter je Zug)', 'ZALL', 'At the end of each turn, the turn player must put 1 Doom Counter onto this card', async (seat) => {
  const t = await szene(seat); t.putArea(seat, 'Doom Clock'); return { t };
}, (t) => { const c = t.inst(x => x.name === 'Doom Clock' && x.zone === 'area')[0]; return c ? (c.counters.doom || 0) : -1; });

// 6) Eigene Zugnummern-Speicher (Stempel genau wie im Kartenskript gesetzt)
eintrag('Zugnummern-Speicher', 'MOE Shield (drawLockedUntilTurn)', 'E', 'you cannot draw cards until the end of your next turn', async (seat) => {
  const t = await szene(seat); const R = 1 - seat, ps = t.gs.players[R];
  ps.drawLockedUntilTurn = Math.max(ps.drawLockedUntilTurn || 0, (t.gs.activePlayer === R) ? t.gs.turn + 2 : t.gs.turn + 1); return { t };   // Reaktion im Zug des Gegners: Frist = Ende des nächsten eigenen Zuges von R
}, (t, s) => (t.gs.players[1 - s].drawLocked ? 1 : 0));
eintrag('Zugnummern-Speicher', 'Stealthy Pursuit (Zielsperre am Helden)', 'E', 'Until the end of your next turn, that Hero cannot be chosen …', async (seat) => {
  const t = await szene(seat); const A = 1 - seat;
  t.engine.addHeroTargetBlocker(A, 0, 'Stealthy Pursuit', { untilTurn: t.gs.activePlayer === A ? t.gs.turn + 2 : t.gs.turn + 1, appliedBy: A }); return { t };
}, (t, s) => ((t.hero(1 - s, 0)._targetBlockers || []).some(b => t.gs.turn <= b.untilTurn) ? 1 : 0));
eintrag('Zugnummern-Speicher', 'Barrier of Undying (Zugende-Löschung)', 'N', 'At the end of its owner\'s next turn, if it is still on the board, delete it', async (seat) => {
  const t = await szene(seat); const i = t.put(seat, 0, 0, H.INERT.creature);
  t.engine.markiereBrettLoeschung(i, t.gs.activePlayer === seat ? t.gs.turn + 2 : t.gs.turn + 1, 'Barrier of Undying'); return { t };
}, (t) => t.inst(c => c.name === H.INERT.creature && c.zone === 'support').length);

// 7) „this turn" (D): läuft am Ende des WIRKER-Zuges aus — auch wenn der Gegner danach übersprungen wird (Z2 A07-02)
eintrag('this turn', 'befristete ATK-Gabe (Greatmaw Shark, Stempel wie im Skript)', 'D', 'increase the Attack stat … until the end of the turn', async (seat) => {
  const t = await szene(seat); t.engine.grantTempHeroAtk(seat, 0, 100, { expiresAtTurn: t.gs.turn + 1, expiresForPlayer: 1 - seat, source: 'Greatmaw Shark' }); return { t };
}, (t, s) => t.hero(s, 0).atk > t.hero(s, 0).baseAtk);

// ── Lauf ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
(async () => {
  const R = H.runner();
  const nur = process.env.NUR ? new RegExp(process.env.NUR, 'i') : null;
  let kat = null;
  for (const e of TABELLE) {
    if (nur && !nur.test(e.name)) continue;
    if (e.kategorie !== kat) { kat = e.kategorie; R.section(`════ ${kat} ════`); }
    for (const seat of [0, 1]) {
      for (const [nm, skip] of Skip.SZENARIEN) {
        const { t, o } = await e.bau(seat, skip);
        const z = await Skip.lauf(t, seat, { skip, schritte: 5, probe: (tt) => e.probe(tt, seat), ...(o || {}) });
        const p = Skip.pruefe(e.art, z);
        const sauber = t.errors.length === 0 && t.audit().length === 0;
        // Carris: das Spiel endet mit dem 3. Time Counter — genau dann, wenn unter den ersten 3 TATSÄCHLICH beendeten Zügen 3 eigene sind
        let endeOk = true;
        if (e.name.startsWith('Carris')) {
          const echt = []; for (let i = 0; echt.length < 3; i++) if (!skip.includes(i)) echt.push(i);
          endeOk = p.ende === (echt.filter(i => i % 2 === 0).length >= 3);
        }
        const ok = p.ok && sauber && endeOk;
        R.check(`[S${seat}] ${e.name} — ${nm}`, ok, ok ? undefined : { ist: p.ist, soll: p.soll, e: t.errors.slice(0, 2), a: t.audit().slice(0, 2) });
      }
    }
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
