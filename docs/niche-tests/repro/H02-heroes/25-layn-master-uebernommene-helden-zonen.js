// H02-heroes-25 · Layn, Master of Deri's Relic: „free Support Zones of Heroes you control" – die Zonenliste folgt der Spalte, nicht der Kontrolle
//
// Kartentext: „You may once per turn choose up to 3 level 1 Creatures with the same name from your discard pile and place them into the free Support Zones of Heroes you control."
// Regel (CARD_API.md Z. 6046 / Styx 28.9.): ein dauerhaft übernommener Held gehört dem Kontrolleur.
// Aufbau: Layn Master auf Held 0 von Sitz 0; (b) Sitz 1 übernimmt Held 2 von Sitz 0 dauerhaft; (c) Sitz 0 übernimmt Held 1 von Sitz 1 dauerhaft. Ablage: 3× Treasure Skeleton (Lv 1).
// Erwartung: (b) die Zonen von Held 2 (Spalte Sitz 0) werden NICHT angeboten; (c) die Zonen von Held 1 der Spalte Sitz 1 werden angeboten.
// Beobachtung: `collectFreeZones(ps)` (layn-master-of-deri-s-relic.js) läuft über `ps.heroes` der eigenen Spalte: (b) die verlorenen Zonen stehen zur Wahl (Kreaturen landen bei einem Gegnerhelden), (c) die übernommenen Zonen fehlen.
// Aufruf: node docs/niche-tests/repro/H02-heroes/25-layn-master-uebernommene-helden-zonen.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
const LM = "Layn, Master of Deri's Relic";
const SK = 'Treasure Skeleton';
async function zonenListe(vorher) {
  const t = await H.fresh({ heroes: [[LM, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null], discard: [[SK, SK, SK], []] });
  await vorher(t);
  let liste = null;
  t.script.push({ match: d => d.type === 'cardGallery' && d.title === LM, answer: () => ({ cardName: SK }) });
  t.script.push({ match: d => /zone/i.test(d.type || ''), answer: (d) => { const zs = d.zones || d.options || []; if (!liste) liste = zs.map(z => `${z.owner ?? z.side ?? 0}:${z.heroIdx}.${z.slotIdx}`); return { heroIdx: zs[0].heroIdx, slotIdx: zs[0].slotIdx }; }, once: false });
  await t.activateHero(0, 0, { effect: LM });
  return { t, liste: liste || [] };
}
(async () => {
  const R = H.runner();
  { const { liste } = await zonenListe(async (t) => { await t.run(() => t.engine.actionTakeHeroPermanently(1, 0, 2)); });
    R.check('(b) Zonen des an Sitz 1 verlorenen Helden 2 werden NICHT angeboten', !liste.some(z => /:2\./.test(z)), liste); }
  { const { liste } = await zonenListe(async (t) => { await t.run(() => t.engine.actionTakeHeroPermanently(0, 1, 1)); });
    R.check('(c) zusätzlich zu den 9 eigenen Zonen werden die 3 Zonen des übernommenen Gegnerhelden angeboten (≥ 12 Einträge)', liste.length >= 12, liste); }
  R.finish();
})();
