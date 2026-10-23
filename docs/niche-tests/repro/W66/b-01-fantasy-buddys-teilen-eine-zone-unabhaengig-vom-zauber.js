'use strict';
// W66b-01 · ALLE Fantasy Buddy Tokens teilen eine Support Zone — unabhängig vom Zaubernamen (Al, 23.10.2026)
//
// Alice: „Creatures with identical names in the Support Zones of a Hero you control share 1 Support Zone." Inyas Fantasy Buddy Token trägt je nach Zauber Anzeige-Name und -Bild
// (`inst.name` = Zaubername), ist aber IMMER ein „Fantasy Buddy Token". Al: „Die Fantasy-Buddies sollten eine Zone mit ALLEN Fantasy Buddies teilen, unabhängig vom Spell-Namen."
// Vorher (W64a): nur Buddys DESSELBEN Zaubers stapelten sich; ein Buddy eines anderen Zaubers fand bei vollem Brett keine Zone (der Zauber ging in die Ablage).
//
// Szene (je Sitz, mit und ohne Alice): Held 0 neutral, Held 1 = Alice (bzw. neutral), Held 2 = Inya. Inyas Zonen 1/2 voll (BIG), Zone 0 für die Buddys.
// Geprüft: Stapel aus Buddys VERSCHIEDENER Zauber (Zonenfrage, echtes Spielen über Inya), Reihenfolge „erst die geteilte Zone, DANN die erste leere", Anzeige-Daten (Zähler ×N, oberste Karte),
// Treffer/Tod einzelner Buddys (Zone, Instanzen, Inyas Schadensschutz „solange mindestens 1 Buddy lebt"). Exit 0 = korrekt.
const W = require('../../lib/wire.js');
const A = require('../../../../cards/effects/_alice-shared.js');
const teil = (i) => (A.teilName ? A.teilName(i) : i.name);   // (auf dem alten Stand gab es `teilName` noch nicht)
const BN = A.FANTASY_BUDDY_TEILNAME || 'Fantasy Buddy Token';
const S1 = 'Fireball', S2 = 'Burning Finger', S3 = 'Fire Bolts', IN = 'Card Game Player Inya';
const buddyCounters = (name) => ({ _fantasyBuddyToken: true, currentHp: 10, maxHp: 10, _cardDataOverride: { ...W.DB[name], name: 'Fantasy Buddy Token', cardType: 'Creature/Token', subtype: 'Token', hp: 10 } });

async function szene(seat, mitAlice, o = {}) {
  const e = ['Tushu, the Knowledge Keeper', mitAlice ? A.ALICE_NAME : 'Rick, the Trigger Happy Undertaker', IN];
  const t = await W.fresh({ heroes: seat === 0 ? [e, null] : [null, e], hand: seat === 0 ? [o.hand || [], []] : [[], o.hand || []], turn: 5, active: seat, scanState: !!o.scanState });
  if (!o.frei) { t.put(seat, 2, 1, W.INERT.big).turnPlayed = 1; t.put(seat, 2, 2, W.INERT.big).turnPlayed = 1; }
  t.put(1 - seat, 0, 0, W.INERT.big).turnPlayed = 1;
  t._seat = seat;
  return t;
}
/** Spielt `name` über den echten Spielweg (MENSCH-Modus der Leitungs-Harness): Inyas Frage „Buddy beschwören?" mit Ja, Ziele auf der Gegenseite. */
const spiele = (t, seat, name) => W.spiele(t, seat, name, { hero: 2, timeoutMs: 6000, answer: (en) => {
  if (en.kind === 'generic' && en.d.type === 'confirm' && en.d.title === IN) return { confirmed: true };
  if (en.kind === 'target') { const x = (en.valid || []).find(q => !q.ineligible && q.owner === 1 - seat); return x ? [x.id] : undefined; }
  return undefined;
} });
const buddys = (t) => t.inst(c => c.zone === 'support' && c.counters && c.counters._fantasyBuddyToken);
const zoneNamen = (t, seat, z) => t.gs.players[seat].supportZones[2][z].slice();

(async () => {
  const R = W.runner();
  for (const seat of [0, 1]) {
    for (const mitAlice of [true, false]) {
      const tag = `[S${seat}${mitAlice ? ' +Alice' : ' ohne Alice'}]`;
      R.section(`── Sitz ${seat} ${mitAlice ? 'mit' : 'ohne'} Alice ──`);

      // ── 1) Echtes Spielen: zwei VERSCHIEDENE Zauber, nur Zone 0 frei ──────────────────────────────
      {
        const t = await szene(seat, mitAlice, { hand: [S1, S2] });
        const ps = t.gs.players[seat];
        await spiele(t, seat, S1);
        R.check(`${tag} erster Buddy (${S1}) liegt in Inyas freier Zone 0`, buddys(t).length === 1 && zoneNamen(t, seat, 0).join() === S1, { z: zoneNamen(t, seat, 0), abl: ps.discardPile });
        await spiele(t, seat, S2);
        if (mitAlice) {
          R.check(`${tag} Alice: der Buddy eines ANDEREN Zaubers (${S2}) stapelt sich in dieselbe Zone — Stapel ×2, 2 Instanzen`, buddys(t).length === 2 && zoneNamen(t, seat, 0).length === 2 && zoneNamen(t, seat, 0).includes(S1) && zoneNamen(t, seat, 0).includes(S2) && !ps.discardPile.includes(S2), { z: zoneNamen(t, seat, 0), abl: ps.discardPile, n: buddys(t).length });
          const st = A.stackAt(t.engine, seat, 2, 0);
          R.check(`${tag} Alice: Stapel-Daten — 2 Creature-Instanzen, jede mit 10 HP, Teil-Name aller = „Fantasy Buddy Token"`, st.length === 2 && st.every(i => teil(i) === 'Fantasy Buddy Token') && st.every(i => A.describeInstance(t.engine, i).hp === 10), st.map(i => [i.name, teil(i)]));
          R.check(`${tag} Alice: Audit ohne Geister (nur die erwarteten Stapel-Meldungen)`, t.audit().filter(m => !/hält \d Karten|\d Instanzen/.test(m)).length === 0 && t.errors.length === 0, { a: t.audit(), e: t.errors });
        } else {
          R.check(`${tag} ohne Alice: kein Stapel — der zweite Zauber geht normal in die Ablage`, buddys(t).length === 1 && ps.discardPile.includes(S2) && zoneNamen(t, seat, 0).join() === S1, { z: zoneNamen(t, seat, 0), abl: ps.discardPile });
        }
      }

      // ── 2) Reihenfolge: erst die geteilte Zone, DANN die erste leere (Zone 0 hat einen Buddy, Zone 1 ist frei) ──────────────────
      if (mitAlice) {
        const t = await szene(seat, true, { hand: [S2], frei: true });
        t.put(seat, 2, 0, S1); const b = t.find(S1, 'support'); Object.assign(b.counters, buddyCounters(S1)); b.turnPlayed = 1;
        t.put(seat, 2, 1, W.INERT.big).turnPlayed = 1;     // Zone 1 belegt, Zone 2 FREI, Zone 0 = Buddy
        await spiele(t, seat, S2);
        R.check(`${tag} Alice: der Buddy eines anderen Zaubers nimmt zuerst die GETEILTE Zone 0, nicht die freie Zone 2`, zoneNamen(t, seat, 0).length === 2 && zoneNamen(t, seat, 2).length === 0, { z0: zoneNamen(t, seat, 0), z2: zoneNamen(t, seat, 2) });
      }

      // ── 3) Zonenfrage (zentral): canShareInto / teilbareSlots / beschwoerZonenFuer ──────────────────────────
      {
        const t = await szene(seat, mitAlice, {});
        t.put(seat, 2, 0, S1); const b1 = t.find(S1, 'support'); Object.assign(b1.counters, buddyCounters(S1)); b1.turnPlayed = 1;
        const e = t.engine;
        R.check(`${tag} canShareInto(Teil-Name „Fantasy Buddy Token") = ${mitAlice}`, A.canShareInto(e, seat, 2, 0, BN) === mitAlice, null);
        R.check(`${tag} canShareInto(Instanz eines Buddys eines ANDEREN Zaubers) = ${mitAlice}`, (() => { const x = e._trackCard(S2, seat, 'support', 1, 1); Object.assign(x.counters, buddyCounters(S2)); const r = A.canShareInto(e, seat, 2, 0, x); e._untrackCard(x.id); return r === mitAlice; })(), null);
        R.check(`${tag} canShareInto(Zaubername des vorhandenen Buddys) = ${mitAlice} (Rückwärtsverständnis)`, A.canShareInto(e, seat, 2, 0, S1) === mitAlice, null);
        R.check(`${tag} eine echte Kreatur (anderer Name) teilt NIE mit einem Buddy`, A.canShareInto(e, seat, 2, 0, W.INERT.creature) === false, null);
        const tz = require('../../../../cards/effects/_biomancy-shared.js').teilbareSlots(e, seat, seat, 2, BN);
        R.check(`${tag} teilbareSlots(Fantasy Buddy Token) = ${mitAlice ? '[0]' : '[]'}`, mitAlice ? (tz.length === 1 && tz[0] === 0) : tz.length === 0, tz);
        const zf = e.beschwoerZonenFuer(seat, BN, { nachKontrolle: true, livingHeroesOnly: true, heroIdx: 2 }).filter(z => z.shared);
        R.check(`${tag} beschwoerZonenFuer(Fantasy Buddy Token): ${mitAlice ? 'die Zone des Buddys ist eine geteilte Zone (vorn)' : 'keine geteilte Zone'}`, mitAlice ? (zf.length === 1 && zf[0].slotIdx === 0) : zf.length === 0, zf);
        // Bewegen eines bestehenden Buddys (Guard Change/Slippery Skates übergeben die Instanz): Ziel = Zone eines Buddys anderen Zaubers
        t.put(seat, 1, 0, S3); const b3 = t.find(S3, 'support'); Object.assign(b3.counters, buddyCounters(S3)); b3.turnPlayed = 1;
        R.check(`${tag} canShareInto(Instanz Buddy ${S3} → Zone mit Buddy ${S1}) = ${mitAlice} (Bewegen teilt mit allen Buddys)`, A.canShareInto(e, seat, 2, 0, b3, seat) === mitAlice, null);
      }

      // ── 4) Anzeige (Server-Zustand): Abzeichen ×N, oberste Karte, Zähler passen zusammen ─────────────────────
      if (mitAlice) {
        const t = await szene(seat, true, { hand: [S1, S2], scanState: true });
        await spiele(t, seat, S1);
        await spiele(t, seat, S2);
        t.host.sendGameStateErzwungen(t.room, seat);
        const letzter = [...t.tl].reverse().find(x => x.k === 'wire' && x.sid === 'S' + seat && x.ev === 'game_state' && x.json);
        const st = letzter ? JSON.parse(letzter.json) : null;
        const key = `${seat}-2-0`;
        const zone = st && st.players[seat].supportZones[2][0];
        const stack = st && st.supportStacks && st.supportStacks[key];
        const cc = st && st.creatureCounters && st.creatureCounters[key];
        R.check(`${tag} Anzeige: supportStacks meldet 2 Kopien (Abzeichen ×2), jede mit eigenem Namen und 10 HP`, !!stack && stack.length === 2 && stack.map(x => x.name).sort().join() === [S1, S2].sort().join() && stack.every(x => x.hp === 10), stack && stack.map(x => [x.name, x.hp]));
        R.check(`${tag} Anzeige: oberste Karte (zuletzt gelegt = ${S2}) und Zähler gehören zur selben Kopie (Token-Override, 10 HP)`, !!zone && zone[zone.length - 1] === S2 && !!cc && cc.currentHp === 10 && cc._fantasyBuddyToken === true, { zone, cc: cc && { hp: cc.currentHp, tok: cc._fantasyBuddyToken } });
      }

      // ── 5) Treffer und Tod einzelner Buddys in einer gemischten Zone ──────────────────────────────────────────
      if (mitAlice) {
        const t = await szene(seat, true, { hand: [S1, S2] });
        await spiele(t, seat, S1);
        await spiele(t, seat, S2);
        const e = t.engine, ps = t.gs.players[seat];
        const inya = ps.heroes[2];
        const buddy1 = buddys(t).find(i => i.name === S1), buddy2 = buddys(t).find(i => i.name === S2);
        const quelle = { name: 'Test', owner: 1 - seat, controller: 1 - seat };
        const hp0 = inya.hp;
        await t.run(() => e.actionDealDamage(quelle, inya, 100, 'attack'));
        R.check(`${tag} Inya nimmt keinen Schaden, solange mindestens 1 Buddy lebt (2 Buddys verschiedener Zauber)`, inya.hp === hp0, { hp: inya.hp });
        await t.run(() => e.actionDealCreatureDamage(quelle, buddy1, 10, 'creature', { sourceOwner: 1 - seat }));
        R.check(`${tag} Tod EINES Buddys: nur seine Instanz ist weg, sein Zauber liegt in der Ablage (Buddy-Regel W64a)`, !buddys(t).includes(buddy1) && buddys(t).includes(buddy2) && ps.discardPile.includes(S1) && !ps.discardPile.includes(S2), { b: buddys(t).map(i => i.name), abl: ps.discardPile });
        R.check(`${tag} Tod EINES Buddys: die Zone führt nur noch den anderen Buddy (${S2}), 1 Instanz, keine Geister`, zoneNamen(t, seat, 0).join() === S2 && A.stackAt(e, seat, 2, 0).length === 1 && t.audit().length === 0, { z: zoneNamen(t, seat, 0), a: t.audit() });
        await t.run(() => e.actionDealDamage(quelle, inya, 100, 'attack'));
        R.check(`${tag} der letzte Buddy lebt noch: Inya bleibt geschützt`, inya.hp === hp0, { hp: inya.hp });
        await t.run(() => e.actionDealCreatureDamage(quelle, buddy2, 10, 'creature', { sourceOwner: 1 - seat }));
        R.check(`${tag} der letzte Buddy ist tot: Zone leer, beide Zauber in der Ablage`, zoneNamen(t, seat, 0).length === 0 && buddys(t).length === 0 && ps.discardPile.includes(S1) && ps.discardPile.includes(S2), { z: zoneNamen(t, seat, 0), abl: ps.discardPile });
        await t.run(() => e.actionDealDamage(quelle, inya, 100, 'attack'));
        R.check(`${tag} ohne Buddy nimmt Inya wieder Schaden`, inya.hp < hp0, { hp: inya.hp });
        R.check(`${tag} keine Engine-Fehler`, t.errors.length === 0, t.errors);
      }
    }
  }
  R.finish();
})().catch(e => { process.stderr.write(String(e && e.stack || e) + '\n'); process.exit(2); });
