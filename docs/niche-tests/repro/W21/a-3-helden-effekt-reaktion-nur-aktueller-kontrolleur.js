'use strict';
// W21a · Frage 3 aus W20c · Al, 20.10.2026: „Sollen Helden-Effekt-Reaktionen (Key, the Cursed Thief) nur der aktuelle Kontrolleur des Helden auslösen dürfen? (heute der Spaltenbesitzer)“
// — „nur der aktuelle Kontrolleur“
//
// Kartentext Key: „Once per turn, when your opponent plays an Artifact from their hand, you may spend Gold equal to its Cost to negate that Artifact and add it to your hand instead.“
// Regel: Eine Helden-Effekt-Reaktion (`isHeroReaction`, der Held bietet sie aus eigener Kraft an) bietet nur der AKTUELLE KONTROLLEUR des Helden an — nicht der Spaltenbesitzer, wenn er den
// Helden abgegeben hat. Ein vom Spieler kontrollierter Gegnerheld bietet seine Reaktion dem Kontrolleur an (Bedingungen/Kosten wie üblich: „your opponent“ und „your hand“ aus Sicht des
// Kontrolleurs). Gilt im Kettenfenster (Artefakt aus der Hand) wie im Helden-Konterfenster ohne Kette (`_offerHeroCounterToHandReaction`, Reaktions-Artefakte).
// Gegenproben: Key im Normalspiel unverändert (Besitzer reagiert), Key des Besitzers nach Rückgabe wieder beim Besitzer, eigenes Artefakt löst nichts aus.
const H = require('../../lib/h.js');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;
const KEY = 'Key, the Cursed Thief';
const T = 'Beer';   // echtes Artefakt (Kosten 4); Key verlangt ein spielbares Artefakt
const fragenKey = (t, seat) => t.prompts.filter(p => p.d.title === KEY && p.pi === seat);

async function szene(opts = {}) {
  const t = await H.fresh({
    heroes: [0, 1].map(i => i === (opts.keySeat ?? 1) ? [KEY, 'Rick, the Trigger Happy Undertaker', 'Zwei, the Lucky Thief'] : undefined),
    hand: [[T], [T]], deckSize: 30, gold: [100, 100], active: opts.active ?? 0,
  });
  return t;
}
async function uebernehmen(t, v, ctrl, besitzer, hi) {
  if (v === 'dauerhaft') await t.engine.actionTakeHeroPermanently(ctrl, besitzer, hi);
  else if (v === 'temporaer') t.engine.actionStealHero(ctrl, besitzer, hi);
  await sleep(150);
}

(async () => {
  const R = H.runner();

  R.section('Normalspiel: Key (Sitz 1) reagiert auf das Artefakt des Gegners (Sitz 0) — Besitzer = Kontrolleur');
  {
    const t = await szene({ keySeat: 1, active: 0 });
    await t.play(0, T, {});
    R.check('Sitz 1 wird gefragt', fragenKey(t, 1).length === 1, fragenKey(t, 1).length);
    R.check('Sitz 0 nicht', fragenKey(t, 0).length === 0, fragenKey(t, 0).length);
    R.check('Artefakt wurde gestohlen: liegt in der Hand von Sitz 1', t.pile(1, 'hand').filter(n => n === T).length === 2, t.pile(1, 'hand'));
    R.check('sauber', sauber(t), { e: t.errors, a: t.audit() });
  }

  for (const v of ['dauerhaft', 'temporaer']) {
    R.section(`Key (Sitz 1) ist ${v} an Sitz 0 abgegeben: Sitz 0 kontrolliert ihn`);
    {
      // Sitz 1 spielt ein Artefakt: der Kontrolleur (Sitz 0) darf mit Key reagieren (sein Gegner spielt), der Besitzer (Sitz 1) spielt ja selbst
      const t = await szene({ keySeat: 1, active: 1 });
      await uebernehmen(t, v, 0, 1, 0);
      await t.play(1, T, {});
      R.check(`${v}: der Kontrolleur (Sitz 0) wird gefragt`, fragenKey(t, 0).length === 1, fragenKey(t, 0).length);
      R.check(`${v}: der Besitzer (Sitz 1) wird nicht gefragt`, fragenKey(t, 1).length === 0, fragenKey(t, 1).length);
      R.check(`${v}: das Artefakt landet in der Hand des Kontrolleurs (Sitz 0)`, t.pile(0, 'hand').filter(n => n === T).length === 2 && !t.pile(1, 'discardPile').includes(T), { h0: t.pile(0, 'hand'), a1: t.pile(1, 'discardPile') });
      R.check(`${v}: sauber`, sauber(t), { e: t.errors, a: t.audit() });
    }
    {
      // Sitz 0 (Kontrolleur) spielt selbst ein Artefakt: Key wäre für den Besitzer (Sitz 1) die richtige Reaktion — er kontrolliert ihn aber nicht
      const t = await szene({ keySeat: 1, active: 0 });
      await uebernehmen(t, v, 0, 1, 0);
      await t.play(0, T, {});
      R.check(`${v}: Besitzer (Sitz 1) wird NICHT gefragt (er hat Key abgegeben)`, fragenKey(t, 1).length === 0, fragenKey(t, 1).length);
      R.check(`${v}: Kontrolleur (Sitz 0) wird bei eigenem Artefakt nicht gefragt`, fragenKey(t, 0).length === 0, fragenKey(t, 0).length);
      R.check(`${v}: Artefakt gespielt (Ablage Sitz 0), keine Entwendung`, t.pile(0, 'hand').filter(n => n === T).length === 0 && t.pile(1, 'hand').filter(n => n === T).length === 1, { h0: t.pile(0, 'hand'), h1: t.pile(1, 'hand') });
      R.check(`${v}: sauber`, sauber(t), { e: t.errors, a: t.audit() });
    }
  }

  R.section('Rückgabe der Kontrolle: Key reagiert wieder für den Besitzer');
  {
    const t = await szene({ keySeat: 1, active: 0 });
    await uebernehmen(t, 'dauerhaft', 0, 1, 0);
    await t.engine.actionReturnHeroControl(1, 0); await sleep(300);
    await t.play(0, T, {});
    R.check('Besitzer (Sitz 1) wird wieder gefragt', fragenKey(t, 1).length === 1, fragenKey(t, 1).length);
    R.check('sauber', sauber(t), { e: t.errors, a: t.audit() });
  }

  R.section('Key steht in der Spalte von Sitz 0, Sitz 1 hat ihn dauerhaft übernommen, Sitz 0 spielt ein Artefakt: der Kontrolleur (Sitz 1) reagiert');
  {
    const t = await szene({ keySeat: 0, active: 0 });
    await uebernehmen(t, 'dauerhaft', 1, 0, 0);
    await t.play(0, T, {});
    R.check('Sitz 1 (Kontrolleur über Key in der Spalte von Sitz 0) wird gefragt', fragenKey(t, 1).length === 1, fragenKey(t, 1).length);
    R.check('Sitz 0 (Spaltenbesitzer) nicht', fragenKey(t, 0).length === 0, fragenKey(t, 0).length);
    R.check('sauber', sauber(t), { e: t.errors, a: t.audit() });
  }
  R.finish();
})().catch(e => { process.stdout.write('AUSNAHME ' + (e && e.stack) + '\n'); process.exit(1); });
