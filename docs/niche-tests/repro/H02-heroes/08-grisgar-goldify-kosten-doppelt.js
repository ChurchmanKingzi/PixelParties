// H02-heroes-08 · Grisgar, Emissary of the Demon Lord – Zweitwurf von Goldify zahlt die Pollution-Token-Kosten ein zweites Mal
//
// Kartentext Grisgar: „When this Hero hits exactly 1 target with a normal Decay Magic Spell whose level is lower than this Hero's
//   Decay Magic level, you may choose a second target for the Spell to hit afterwards."
// Kartentext Goldify: „Place 1 Pollution Token into your free Support Zone to use this Spell. Choose a Creature and defeat it. …"
// Erwartung: das Token ist eine Kosten-Zahlung („to use this Spell") und fällt einmal an; der Zweitwurf trifft nur ein weiteres Ziel
//   (Skript-Kopfkommentar von Grisgar: „Re-cast skips costs but re-runs onPlay"). Also: 1 Pollution Token, 2 Kreaturen besiegt.
// Beobachtung: 2 Pollution Tokens (Goldifys `onPlay` setzt das Token nach der Zielwahl – der Zweitwurf läuft den ganzen `onPlay` erneut).
//   Zum Vergleich: Cold Coffin (Kosten VOR dem Wurf) setzt auch im Zweitwurf nur 2 Tokens.
// Aufruf: node docs/niche-tests/repro/H02-heroes/08-grisgar-goldify-kosten-doppelt.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
const GR = 'Grisgar, Emissary of the Demon Lord';
(async () => {
  const R = H.runner();
  const t = await H.fresh({ heroes: [[GR, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null], hand: [['Goldify'], []] });
  t.setAbilities(0, 0, [['Decay Magic', 'Decay Magic', 'Decay Magic'], [], []]);   // Decay Magic 3 > Goldify (Stufe 1)
  t.put(1, 0, 0, H.INERT.creature); t.put(1, 1, 0, H.INERT.creature);
  t.policy.confirm = true;   // Grisgars „zweites Ziel?" bejahen
  t.targetFn = (valid) => { const v = valid.find(x => x.type === 'equip' && x.owner === 1); return v ? [v.id] : null; };
  const tokens = () => t.engine.cardInstances.filter(c => c.owner === 0 && c.zone === 'support' && /Pollution Token/.test(c.name)).length;
  const r = await t.play(0, 'Goldify', { hero: 0 });
  R.check('Goldify gespielt', r === true, r);
  R.note('Grisgar-Rückfragen', t.prompts.filter(p => /Grisgar/.test(p.d.title || '')).length);
  R.check('beide gegnerische Kreaturen besiegt (Zweitwurf lief)', !t.zone(1, 0, 0) && !t.zone(1, 1, 0), [t.zone(1, 0, 0), t.zone(1, 1, 0)]);
  R.check('Kosten einmal gezahlt: genau 1 Pollution Token auf dem eigenen Brett', tokens() === 1, tokens());
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
