'use strict';
// F02-16 · Rocket Sneeze: das Einmal-pro-Kette-Flag `_rsPromptedFor` bleibt nach Schaden ohne Kette stehen – der nächste Schaden bekommt keine Frage mehr
// Kartentext: „Play this card immediately when a target your opponent controls takes 50 or less damage. That damage is dealt to all targets your opponent controls instead."
// Skriptkopf rocket-sneeze.js: „Per-source dedup via `gs._rsPromptedFor[pi]` so a multi-target source doesn't re-prompt per-target. Cleared at chain-resolve."
// Aufbau: Sitz 0: Hand [Pocket Catapult ×2, Rocket Sneeze ×2], 100 Gold, Katapulte an Held 0 und Held 1. Der Katapult-Schuss (40 Schaden, „once per turn" je Katapult) ist eine Ausrüstungs-Aktivierung, keine Kette.
// Schritte: 1. Schuss mit Katapult 1 auf Gegner-Held 0; die Rocket-Sneeze-Frage mit „Nein" (null) beantworten. 2. Schuss mit Katapult 2 auf denselben Helden.
// Erwartet: Auch der zweite Schuss ist ein eigenes Schadensereignis und öffnet das Rocket-Sneeze-Fenster erneut (2. Kopie in der Hand, 8 Gold vorhanden).
// Beobachtet: Beim zweiten Schuss kommt keine Frage; `gs._rsPromptedFor` steht seit dem ersten Schuss auf {0:true} (aufgeräumt wird nur im Hook `onChainResolve`, der ohne Kette nicht läuft).
// Vermutete Ursache: `rocket-sneeze.js` `oppPreDamageCondition`/`oppCreaturePreDamageCondition` rufen `_markPrompted(gs, pi)` VOR der Frage (und `...Resolve` nochmals); Löschen nur in `hooks.onChainResolve`.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Pocket Catapult', 'Pocket Catapult', 'Rocket Sneeze', 'Rocket Sneeze'], []], gold: [100, 100] });
  await t.play(0, 'Pocket Catapult', { hero: 0 });
  await t.play(0, 'Pocket Catapult', { hero: 1 });
  const antworten = [null, { confirmed: true }];
  t.script.push({ match: d => d.type === 'confirm' && d.title === 'Rocket Sneeze', answer: () => antworten.shift() });
  t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
  const fragen = () => t.prompts.filter(p => p.d.type === 'confirm' && p.d.title === 'Rocket Sneeze').length;
  t.reset();
  const a1 = await t.activateEquip(0, 0, 0);
  R.check('Schuss 1 gefeuert, Rocket-Sneeze-Frage gestellt', a1 === true && fragen() === 1, { a1, fragen: fragen() });
  t.reset();
  const a2 = await t.activateEquip(0, 1, 0);
  R.check('Schuss 2 gefeuert', a2 === true, a2);
  R.check('Schuss 2: Rocket-Sneeze-Frage wird erneut gestellt', fragen() === 1, { fragen: fragen(), flag: t.gs._rsPromptedFor, hand0: t.pile(0, 'hand') });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
