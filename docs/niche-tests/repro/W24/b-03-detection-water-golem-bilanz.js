'use strict';
// W24b · N2-03 Detection: „Brett → Ablage durch Effekt"-Fenster, ohne doppelte Ablage und mit sauberer Bilanz.
// Water Golem (Held 1) liegt hinter Booby Trap (Held 0): Detection legt Booby Trap ab → Water Golem aktiviert sich selbst (geht in die Ablage); danach darf Detection
// ihn NICHT noch einmal ablegen (kein Duplikat in der Ablage). Gegenprobe ohne Reaktion: beide Surprises landen genau einmal in der Ablage, Detection zieht 2 je entfernter Karte.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const [me, op] of [[0, 1], [1, 0]]) {
    R.section(`Sitz ${me}: Detection gegen Booby Trap + Water Golem (Sitz ${op})`);
    {
      const t = await H.fresh({ hand: me === 0 ? [['Detection'], []] : [[], ['Detection']], deckSize: 30 });
      t.putSurprise(op, 0, 'Booby Trap'); t.putSurprise(op, 1, 'Water Golem'); t.grantFor(op, 1, 'Water Golem');
      t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
      t.targetFn = (v) => [v[0].id];
      const vor = t.census();
      await t.play(me, 'Detection', { hero: 0 });
      const ab = t.pile(op, 'discardPile');
      R.check('Booby Trap liegt genau einmal in der Ablage', ab.filter(x => x === 'Booby Trap').length === 1, ab);
      R.check('Water Golem hat sich beschworen (Support) und wurde nicht noch einmal von Detection abgelegt', t.gs.players[op].supportZones.some(z => z.some(sl => sl[0] === 'Water Golem')) && !ab.includes('Water Golem'), [t.gs.players[op].supportZones, ab]);
      R.check('Surprise Zones des Halters leer', t.gs.players[op].surpriseZones.every(z => z.length === 0), t.gs.players[op].surpriseZones);
      R.check('keine Engine-Fehler, Zustand sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
    }
    R.section(`Gegenprobe Sitz ${me}: zwei Surprises ohne Reaktion → je einmal abgelegt, 4 Karten gezogen`);
    {
      const t = await H.fresh({ hand: me === 0 ? [['Detection'], []] : [[], ['Detection']], deckSize: 30 });
      t.putSurprise(op, 0, 'Booby Trap'); t.putSurprise(op, 1, 'Frost Rune');
      t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
      const hand0 = t.pile(me, 'hand').length;
      await t.play(me, 'Detection', { hero: 0 });
      const ab = t.pile(op, 'discardPile');
      R.check('beide in der Ablage', ab.includes('Booby Trap') && ab.includes('Frost Rune') && ab.length === 2, ab);
      R.check('Detection zieht 4 Karten (Karte selbst verlässt die Hand)', t.pile(me, 'hand').length === hand0 - 1 + 4, [hand0, t.pile(me, 'hand').length]);
      R.check('keine Engine-Fehler, Zustand sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
    }
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
