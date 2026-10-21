'use strict';
// W43a · Punkte 2 und 3 · Al, 22.10.2026:
//  (2) Chain Lightning, Bottled Lightning, Cardinal Beast Qinglong: „Nein, Taunt-Effekte wirken hier nicht (also korrekt as-is)." → Ist-Zustand: das Opfer wählt die Kettenziele selbst (Wählender = Besitzer des
//      Slime), kein Taunt in `promptChainTargets`. Hier nur abgesichert.
//  (3) Alluring Light × Kunagi × Hardy Slime: „Ja" → Ist-Zustand (W42a): der Kunagi-Besitzer muss bei der Neuwahl den Slime des Light-Spielers wählen (Alluring Light ist ein Spell; der gewählte Kunagi-Treffer ist
//      ein Attack mit Kreaturen-/Heldenzielen — der Slime nur, wenn er ein mögliches Ziel ist). Bleibt nach der Typ-Prüfung (W43a) gültig. Dazu: der erneut geöffnete Zielwahl-Dialog von `doConfirmPotion`
//      (nach `aborted`) prüft die Quelle ebenfalls (Sword in a Bottle = zählt als Attack → Taunt; Book of Doom = Artefakt → kein Taunt).
// Beide Sitze. Aufruf: node docs/niche-tests/repro/W43/a-02-hardy-slime-ketten-zielwahl-bleibt-frei-und-alluring-light-kunagi.js   (Exit 0 = korrekt)
const L = require('../W39/_helfer.js');
const { H, setzeFrei } = L;
const { loadCardEffect } = require('../../../../cards/effects/_loader');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;
const KUNAGI = 'Idej Sword - Kunagi';

function stempel(t, slime, gegen) {
  slime.turnPlayed = 1;
  slime.counters.forcesTargeting = true; slime.counters.forcesTargeting_pi = gegen; slime.counters.forcesTargeting_untilTurn = (t.gs.turn || 0) + 1;
  slime.counters.buffs = { ...(slime.counters.buffs || {}), forcesTargeting: true };
  return slime;
}

(async () => {
  const R = H.runner();
  for (const [me, op] of [[0, 1], [1, 0]]) {
    R.section('Sitz ' + me);
    const slimeId = `equip-${op}-2-2`;

    // ── (2) Ketten-Zielwahl: das Opfer wählt selbst, ein eigener Slime zwingt es nicht ──
    const kette = async (name, hand, f) => {
      const hands = [[], []]; hands[me] = hand.slice(); hands[op] = ['ZZ Filler', 'ZZ Filler', 'ZZ Filler'];
      const t = await H.fresh({ hand: hands, hp: 800, deckSize: 20, active: me, gold: 200 });
      const a = t.put(op, 1, 0, H.INERT.creature); a.turnPlayed = 1;
      stempel(t, t.put(op, 2, 2, 'Hardy Slime'), me);
      let angebot = null, wer = null;
      t.script.push({ match: d => d.type === 'chainTargetPick', answer: (d, pi) => { angebot = d.targets.map(x => x.id).sort().join(','); wer = pi; return { selectedTargets: d.targets.slice(0, 3).map(x => ({ id: x.id })) }; } });
      t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: false }) });
      await f(t);
      const erwartet = [0, 1, 2].map(i => `hero-${op}-${i}`).concat([`equip-${op}-1-0`, slimeId]).sort().join(',');
      R.check(`${name}: das Opfer (Besitzer des Slime) wählt selbst — die Kettenwahl bietet ALLE seine Ziele an, kein Taunt`, wer === op && angebot === erwartet, { wer, angebot });
      R.check(`${name}: keine Engine-Fehler, Zustand sauber`, sauber(t), { errors: t.errors, audit: t.audit() });
    };
    await kette('Chain Lightning', ['Chain Lightning'], t => t.play(me, 'Chain Lightning', { hero: 0 }));
    await kette('Bottled Lightning', ['Bottled Lightning'], t => t.play(me, 'Bottled Lightning'));
    await kette('Cardinal Beast Qinglong', [], async t => { const q = t.put(me, 0, 0, 'Cardinal Beast Qinglong'); q.turnPlayed = 1; t.phase(2); await t.activateCreature(me, 0, 0); });

    // ── (3) Alluring Light × Kunagi × Hardy Slime ──
    for (const taunt of [true, false]) {
      const logs = [];
      const r = await L.szene('Alluring Light', me, op, {
        ziel: 'creature', kreaturName: H.INERT.frail, kreaturHp: 10, F: 1,
        vorbereiten: async (t) => {
          const _log = t.engine.log.bind(t.engine); t.engine.log = (n, d) => { logs.push({ n, d }); return _log(n, d); };
          for (const [hi, sl] of [[0, 0], [0, 1], [2, 0]]) { const c = t.put(me, hi, sl, H.INERT.frail); c.turnPlayed = 1; }
          setzeFrei(t, op, 0, KUNAGI);
          const s = t.put(me, 1, 1, 'Hardy Slime'); if (taunt) stempel(t, s, op); else s.turnPlayed = 1;   // der Slime des LIGHT-Spielers, Taunt gegen den Kunagi-Besitzer
          t.slime = s;
        },
      });
      const t = r.t;
      const sid = `equip-${me}-1-1`;
      const kunagi = t.targets.filter(x => x.who === op);
      const licht = t.targets.filter(x => x.who === me);
      const wiederholt = logs.filter(l => l.n === 'idej_kunagi_repeat').length;
      if (taunt) {
        R.check('Alluring Light × Kunagi × Slime (Taunt gegen den Kunagi-Besitzer): die erste Neuwahl des Kunagi-Besitzers bietet NUR den Slime des Light-Spielers an', kunagi.length >= 1 && kunagi[0].valid.filter(v => v.owner === me).map(v => v.id).join(',') === sid, kunagi.map(x => x.valid.map(v => v.id)));
        R.check('  der Kunagi-Treffer ist ein Attack: er trifft den Slime (besiegt oder beschädigt), die Wiederholung findet statt', wiederholt >= 1, { wiederholt, slime: t.slime.zone });
        R.check('  die eigenen Wahlen des Light-Spielers (Angreifer, erstes Opfer unter eigenen Zielen) unterliegen keinem Taunt: der Slime ist dort wählbar', licht.length === 2 && licht.some(x => x.valid.some(v => v.id === sid)), licht.map(x => x.valid.map(v => v.id)));
      } else {
        R.check('Gegenprobe ohne Taunt: die Neuwahl des Kunagi-Besitzers bietet den Slime UND weitere Ziele an', kunagi.length >= 1 && kunagi[0].valid.some(v => v.id === sid) && kunagi[0].valid.filter(v => v.owner === me).length >= 4, kunagi.map(x => x.valid.map(v => v.id)));
      }
      R.check('Alluring Light × Kunagi: keine Engine-Fehler, Zustand sauber', sauber(t), { errors: t.errors, audit: t.audit() });
    }

    // ── (3b) erneut geöffneter Zielwahl-Dialog in `doConfirmPotion` (nach `aborted`): Quelle zählt ──
    const reopen = async (name, hand, zielHelden) => {
      const hands = [[], []]; hands[me] = hand.slice();
      const t = await H.fresh({ hand: hands, hp: 800, deckSize: 20, active: me, gold: 200 });
      const a = t.put(op, 1, 0, H.INERT.creature); a.turnPlayed = 1;
      t.put(me, 2, 1, H.INERT.creature).turnPlayed = 1;
      stempel(t, t.put(op, 2, 2, 'Hardy Slime'), me);
      const sc = loadCardEffect(name);
      const orig = sc.resolve; let erster = true;
      sc.resolve = async (...a2) => { if (erster) { erster = false; return { aborted: true }; } return orig(...a2); };   // erster Versuch „abgebrochen" → die Sitzung öffnet sich neu
      try {
        t.targetFn = (v) => (zielHelden ? [v.find(x => x.type === 'hero' && x.owner === me && x.heroIdx === 1) || v[0], v.find(x => x.owner === op) || v[1]] : [v.find(x => x.owner === op) || v[0]]).map(x => x.id);
        await t.play(me, name, { noAutoConfirm: true });
        await t.resolveTargeting(me);
        const pt = t.gs.potionTargeting;
        const opSeite = pt ? pt.validTargets.filter(v => v.owner === op && !v.ineligible).map(v => v.id).sort().join(',') : null;
        return { t, opSeite, offen: !!pt };
      } finally { sc.resolve = orig; }
    };
    {
      const x = await reopen('Sword in a Bottle', ['Sword in a Bottle'], true);
      R.check('Reopen-Zielwahl (Sword in a Bottle, zählt als Attack): nur der Slime ist als Gegnerziel wählbar', x.offen && x.opSeite === slimeId, x.opSeite);
    }
    {
      const x = await reopen('Book of Doom', ['Book of Doom'], false);
      R.check('Reopen-Zielwahl (Book of Doom, Artefakt): KEIN Taunt, Slime und weitere Gegnerziele wählbar', x.offen && x.opSeite.split(',').includes(slimeId) && x.opSeite.split(',').length >= 4, x.opSeite);
    }
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
