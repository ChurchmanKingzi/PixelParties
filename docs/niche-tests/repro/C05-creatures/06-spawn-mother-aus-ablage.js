'use strict';
// C05-creatures-06 · The Spawn Mother: der Einsatz-Schaden feuert auch, wenn sie NICHT aus der Hand kommt
// Kartentext: „When this Creature is summoned from your hand, deal 100 damage to all Heroes your opponent controls OR to all targets on the
//   board, except this Creature. … Each effect of "The Spawn Mother" can only happen once per turn."
// Erwartung: Wird die Karte aus der Ablage auf das Feld gelegt (The Root of all Evil, Undurdle, Necromancy …), ist das KEIN Beschwören aus der Hand
//   -> kein Schaden, kein Moduswahl-Prompt, der Einmal-pro-Zug-Stempel bleibt frei.
// Beobachtet: Die Moduswahl erscheint, die Gegner-Helden verlieren je 100 HP, `spawn-mother-aoe:<pi>` ist gestempelt. Das Skript begründet das
//   ausdrücklich („Fires whenever Spawn Mother enters a Support Zone … No `_isNormalSummon` filter — summon-source distinctions are not part
//   of this card's text") – der Kartentext (Commit 4db2f97) enthält die Herkunft „from your hand" aber doch.
// Ursache: `cards/effects/the-spawn-mother.js` `hooks.onPlay` (Z. 137-147) prüft die Herkunft nicht (nur `ctx.playedCard.id === ctx.card.id`).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ discard: [['The Spawn Mother'], []] });
  const root = t.put(0, 0, 0, 'The Root of all Evil'); root.turnPlayed = 1;
  let picker = 0;
  t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ cardName: 'The Spawn Mother' }) });
  t.script.push({ match: d => d.type === 'optionPicker', answer: () => { picker++; return { optionId: 'opp' }; } });
  t.script.push({ match: d => d.type === 'zonePick', answer: d => ({ heroIdx: d.zones[0].heroIdx, slotIdx: d.zones[0].slotIdx, owner: d.zones[0].owner }) });
  t.gs.activePlayer = 0; t.phase(2); t.resetActions(0);
  const r = await t.activateCreature(0, 0, 0);
  R.check('Aufbau: The Root of all Evil hat die Spawn Mother aus der Ablage aufs Brett gelegt', !!t.find('The Spawn Mother', 'support'), { r, board: t.gs.players[0].supportZones });
  R.check('kein Moduswahl-Prompt (nicht „aus der Hand")', picker === 0, picker);
  R.check('Gegner-Helden unversehrt', t.hp(1, 0) === 800 && t.hp(1, 1) === 800 && t.hp(1, 2) === 800, [t.hp(1, 0), t.hp(1, 1), t.hp(1, 2)]);
  R.check('Einmal-pro-Zug-Stempel nicht verbraucht', t.gs.hoptUsed?.['spawn-mother-aoe:0'] !== t.gs.turn, t.gs.hoptUsed);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
