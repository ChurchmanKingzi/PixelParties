// W16f · H02-heroes-25 Nachprobe: Layn, Master of Deri's Relic platziert Treasure Skeletons in die Zonen eines dauerhaft übernommenen Gegnerhelden.
// Erwartung: Kreatur steht in der Gegenspalte (Brettseite), gehört/kontrolliert Sitz 0; Zustand sauber; Kartenbilanz stimmt.
const H = require('../../lib/h.js');
const LM = "Layn, Master of Deri's Relic";
const SK = 'Treasure Skeleton';
(async () => {
  const R = H.runner();
  const t = await H.fresh({ heroes: [[LM, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null], discard: [[SK, SK, SK], []] });
  await t.run(() => t.engine.actionTakeHeroPermanently(0, 1, 1));
  t.script.push({ match: d => d.type === 'cardGallery' && d.title === LM, answer: () => ({ cardName: SK }) });
  t.script.push({ match: d => /zone/i.test(d.type || ''), answer: (d) => { const z = (d.zones || d.options || []).find(x => (x.owner ?? x.ownerIdx) === 1 && x.heroIdx === 1); return z ? { heroIdx: z.heroIdx, slotIdx: z.slotIdx, owner: 1 } : null; } });
  const vorher = t.census();
  const r = await t.activateHero(0, 0, { effect: LM });
  R.check('Heldeneffekt lief', r === true, r);
  const inst = t.engine.cardInstances.find(c => c.name === SK && c.zone === 'support');
  R.check('Skeleton steht in der Gegenspalte (Brettseite 1)', !!inst && t.engine.physicalSide(inst) === 1 && t.gs.players[1].supportZones[1].some(z => z[0] === SK), inst && [inst.owner, inst.controller]);
  R.check('kontrolliert von Sitz 0', !!inst && (inst.controller ?? inst.owner) === 0, inst && [inst.owner, inst.controller]);
  R.check('Ablage um die gelegten Skeletons kleiner', t.pile(0, 'discardPile').length < 3, t.pile(0, 'discardPile'));
  R.check('Zustand sauber', t.audit().length === 0, t.audit());
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
