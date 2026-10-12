'use strict';
// H01-heroes-03 · Blackstache: Schutz gilt auch bei Frozen/Stunned/Negated und bleibt beim alten Besitzer, wenn der Held übernommen ist
//
// Kartentext: „You are unaffected by the effect of "Terror" and your opponent cannot end your turn with card effects."
// Regeln: (a) Heldeneffekte eines gefrorenen/betäubten/negierten Helden sind still (`engine._isHeroEffectSilenced`, Kopf von
//   chuck-the-crazy-veteran.js: „bypassStatusFilter is deliberately NOT set"); (b) CARD_API.md „Übernommene Helden gelten als Helden des
//   Kontrolleurs (Styx 28.9.)": „you/your = Kontrolleur … Das gilt für seine Effekte".
// Erwartung: (a) mit Status frozen/stunned/negated schützt Blackstache nicht; (b) steht er in Spalte 1, wird aber von Sitz 0 dauerhaft
//   kontrolliert, ist Sitz 0 geschützt und Sitz 1 nicht.
// Beobachtet: `_blackstacheBlocksTurnEnd` (cards/effects/_engine.js ~28773) liest `ps.heroes` der Spalte des betroffenen Spielers und
//   prüft nur `hp > 0`: Status und Kontrolle werden ignoriert.
const H = require('../../lib/h.js');
const BS = 'Blackstache, Scourge of the Pixel Seas';
(async () => {
  const R = H.runner();
  const mk = () => H.fresh({ heroes: [null, [BS, H.BLANK_HEROES_B[1], H.BLANK_HEROES_B[2]]] });
  R.section('Kontrolle: lebender, gesunder Blackstache auf Sitz 1 schützt vor Zugende-Effekt des Gegners');
  {
    const t = await mk();
    R.check('Flashbang-artige Quelle (Sitz 0) wird geblockt', t.engine._blackstacheBlocksTurnEnd(1, { name: 'Flashbang', owner: 0 }) === true);
    R.check('Terror (eigene Quelle) wird geblockt', t.engine._blackstacheBlocksTurnEnd(1, { name: 'Terror', owner: 1 }) === true);
  }
  R.section('(a) Status: Heldeneffekte sind bei frozen / stunned / negated still');
  for (const st of ['negated', 'frozen', 'stunned']) {
    const t = await mk();
    t.heroStatus(1, 0, st);
    R.check(`Blackstache ${st}: Gegnerquelle wird NICHT geblockt`, t.engine._blackstacheBlocksTurnEnd(1, { name: 'Flashbang', owner: 0 }) === false);
    R.check(`Blackstache ${st}: Terror wird NICHT geblockt`, t.engine._blackstacheBlocksTurnEnd(1, { name: 'Terror', owner: 1 }) === false);
  }
  R.section('(b) Dauerhafte Übernahme (Paraseed-Weg): Sitz 0 kontrolliert den Blackstache in Spalte 1');
  {
    const t = await mk();
    await t.engine.actionTakeHeroPermanently(0, 1, 0, { sourceName: 'Test' });
    R.check('Vorprobe: Kontrolleur ist Sitz 0', t.engine.heroSideOf(1, t.hero(1, 0)) === 0);
    R.check('Kontrolleur (Sitz 0) ist vor einem Gegner-Zugende-Effekt geschützt', t.engine._blackstacheBlocksTurnEnd(0, { name: 'Flashbang', owner: 1 }) === true);
    R.check('alter Besitzer (Sitz 1) ist nicht mehr geschützt', t.engine._blackstacheBlocksTurnEnd(1, { name: 'Flashbang', owner: 0 }) === false);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
