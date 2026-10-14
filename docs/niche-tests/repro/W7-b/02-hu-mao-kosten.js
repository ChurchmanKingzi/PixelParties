'use strict';
// W7-b/02 · Guardian Beast Hu und Mao: keine Kosten ohne Wirkung (Welle 7, Entscheidung Al 14.10.2026; Befunde A07-13, A07-18)
//   Hu: nur aktivierbar, wenn eine Handkarte spielbar ist; Abbruch der Aktionswahl gibt die 5 Karten zurück (und die Einmal-Sperre frei).
//   Mao: macht nur Bestien wählbar, deren Effekt gerade aktivierbar ist.
const H = require('../../lib/h.js');
const F = H.INERT.filler;
const fuenf = (d) => { const idx = [0, 1, 2, 3, 4]; return { selectedIndices: idx, selectedCards: idx.map(i => d.cards[i].name) }; };

async function hu(opts) {
  const t = await H.fresh({ hand: [opts.hand || [], []], discard: [Array(opts.eigene ?? 5).fill(F), Array(opts.gegner ?? 0).fill(F)], deckSize: 20 });
  const kreatur = t.put(0, 0, 0, 'Guardian Beast Hu'); kreatur.turnPlayed = 1;
  if (opts.grant) t.grantFor(0, 0, 'Fireball');
  t.script.push({ match: d => d && d.type === 'cardGalleryMulti', answer: fuenf });
  if (opts.abbrechen) t.script.push({ match: d => d && d.type === 'heroAction', answer: () => null });
  t.gs.activePlayer = 0; t.phase(2);
  const kann = H.loadCardEffect('Guardian Beast Hu').canActivateCreatureEffect(t.engine._createContext(kreatur, { event: 'canCreatureEffectCheck' }));
  return { t, kann, kreatur };
}

(async () => {
  const R = H.runner();

  R.section('Hu: nichts spielbar → nicht aktivierbar');
  let o = await hu({ hand: [] });
  R.check('leere Hand, keine Ability-Aktion: Hu nicht aktivierbar', o.kann === false, o.kann);
  let r = await o.t.activateCreature(0, 0, 0);
  R.check('… und die Aktivierung löscht nichts, verbraucht die Einmal-Sperre nicht', !r && o.t.pile(0, 'deletedPile').length === 0 && !o.t.gs.hoptUsed?.[`creature-effect:${o.kreatur.id}`], { r, geloescht: o.t.pile(0, 'deletedPile').length });

  R.section('Hu: spielbare Karte → aktivierbar; Abbruch der Aktionswahl gibt die 5 Karten zurück');
  o = await hu({ hand: ['Fireball'], grant: true, abbrechen: true });
  R.check('Fireball spielbar: Hu aktivierbar', o.kann === true, o.kann);
  r = await o.t.activateCreature(0, 0, 0);
  R.check('Abbruch: nichts gelöscht, alle 5 Karten wieder in der Ablage', o.t.pile(0, 'deletedPile').length === 0 && o.t.pile(0, 'discardPile').length === 5, { geloescht: o.t.pile(0, 'deletedPile').length, ablage: o.t.pile(0, 'discardPile').length });
  R.check('Abbruch: Einmal-pro-Zug nicht verbraucht (Hu bleibt aktivierbar)', !o.t.gs.hoptUsed?.[`creature-effect:${o.kreatur.id}`] && H.loadCardEffect('Guardian Beast Hu').canActivateCreatureEffect(o.t.engine._createContext(o.kreatur, { event: 'canCreatureEffectCheck' })), o.t.gs.hoptUsed);
  R.check('Abbruch: Kartenbilanz sauber, keine Engine-Fehler', o.t.errors.length === 0 && o.t.audit().length === 0, [o.t.errors, o.t.audit()]);

  R.section('Hu: Aktion läuft normal → Kosten bleiben bezahlt');
  o = await hu({ hand: ['Fireball'], grant: true });
  o.t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0).id];
  o.t.script.push({ match: d => d && d.type === 'heroAction', answer: (d) => ({ cardName: 'Fireball', handIndex: 0, heroIdx: 0 }) });
  r = await o.t.activateCreature(0, 0, 0);
  R.check('Fireball gespielt: 5 Karten gelöscht', o.t.pile(0, 'deletedPile').length === 5 && o.t.hp(1, 0) < 800, { geloescht: o.t.pile(0, 'deletedPile').length, hp: o.t.hp(1, 0) });

  R.section('Hu: ein Guardian Beast auf der Hand ist spielbar, sobald die Kosten die eigene Ablage leeren');
  o = await hu({ hand: ['Guardian Beast Gou'], eigene: 5, gegner: 0 });
  R.check('Gou auf der Hand, eigene Ablage genau 5 (Kosten leeren sie): Hu aktivierbar', o.kann === true, o.kann);
  o = await hu({ hand: ['Guardian Beast Gou'], eigene: 6, gegner: 0 });
  R.check('eigene Ablage 6 (nicht leerbar): Hu nicht aktivierbar', o.kann === false, o.kann);

  R.section('Mao: nur Bestien mit aktivierbarem Effekt');
  {
    const GB = ['Guardian Beast Gou', 'Guardian Beast Hou', 'Guardian Beast Hu'];
    // Zhu (nicht am Beschwörungstag aktivierbar) + Ma (hier aktivierbar) frisch beschworen
    const t = await H.fresh({ heroes: [['Mao, the Vengeful Guardian', H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null], discard: [[...GB, ...Array(10).fill(F)], Array(10).fill(F)] });
    const zhu = t.put(0, 0, 0, 'Guardian Beast Zhu');
    const ma = t.put(0, 0, 1, 'Guardian Beast Ma');
    t.gs.activePlayer = 0; t.phase(2);
    let angeboten = null;
    t.script.push({ match: d => d && d.type === 'cardGalleryMulti', once: true, answer: fuenf });
    t.targetFn = (v, c) => { angeboten = v.map(x => x.cardName); const m = v.find(x => x.cardName === 'Guardian Beast Ma'); return m ? [m.id] : undefined; };
    const rr = await t.activateHero(0, 0, {});
    R.check('Zhu (nicht aktivierbar) ist nicht wählbar, Ma schon', angeboten && !angeboten.includes('Guardian Beast Zhu') && angeboten.includes('Guardian Beast Ma'), angeboten);
    R.check('Mao feuert Ma: 5 Karten gelöscht, Ma negiert, Zhu unberührt', rr === true && t.pile(0, 'deletedPile').length + t.pile(1, 'deletedPile').length >= 5 && !!ma.counters.negated && !zhu.counters.negated, { rr, negiert: !!ma.counters.negated });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  {
    // Hu ohne spielbare Aktion kann nicht feuern → für Mao nicht wählbar; nichts gezahlt, nichts negiert
    const GB = ['Guardian Beast Gou', 'Guardian Beast Hou', 'Guardian Beast Hu'];
    const t = await H.fresh({ heroes: [['Mao, the Vengeful Guardian', H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null], discard: [[...GB, ...Array(5).fill(F)], Array(8).fill(F)] });
    const hu2 = t.put(0, 0, 1, 'Guardian Beast Hu');
    t.gs.activePlayer = 0; t.phase(2);
    t.gs.players[0].hand = [];
    t.script.push({ match: d => d && d.type === 'cardGalleryMulti', once: true, answer: fuenf });
    t.targetFn = (v) => { const m = v.find(x => x.cardName === 'Guardian Beast Hu'); return m ? [m.id] : null; };
    const vorher = t.pile(0, 'discardPile').length + t.pile(1, 'discardPile').length;
    await t.activateHero(0, 0, {});
    const nachher = t.pile(0, 'discardPile').length + t.pile(1, 'discardPile').length;
    R.check('Hu ohne spielbare Aktion ist für Mao nicht wählbar: nichts gezahlt, nichts negiert', nachher === vorher && !hu2.counters.negated && t.pile(0, 'deletedPile').length === 0, { vorher, nachher });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  {
    // Die Zahlung selbst kippt das Gate der Bestie: Hu (Fireball spielbar, 6 Karten in den Ablagen) ist VOR der Zahlung aktivierbar, danach nicht mehr (6 − 5 < 5)
    // → Mao gibt die 5 Karten zurück und negiert nichts
    const t = await H.fresh({ heroes: [['Mao, the Vengeful Guardian', H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null], hand: [['Fireball'], []], discard: [Array(6).fill(F), []] });
    const hu2 = t.put(0, 0, 1, 'Guardian Beast Hu');
    t.grantFor(0, 0, 'Fireball');
    t.gs.activePlayer = 0; t.phase(2);
    t.script.push({ match: d => d && d.type === 'cardGalleryMulti', once: true, answer: fuenf });
    t.targetFn = (v) => { const m = v.find(x => x.cardName === 'Guardian Beast Hu'); return m ? [m.id] : null; };
    await t.activateHero(0, 0, {});
    R.check('Zahlung macht Hu unfeuerbar: 5 Karten zurück in der Ablage, nichts gelöscht, Hu nicht negiert', t.pile(0, 'deletedPile').length === 0 && t.pile(0, 'discardPile').length === 6 && !hu2.counters.negated, { geloescht: t.pile(0, 'deletedPile').length, ablage: t.pile(0, 'discardPile').length, negiert: !!hu2.counters.negated });
    R.check('Der Rückgabeweg wurde wirklich durchlaufen (Log mao_fizzle: refire_impossible_after_cost)', t.lg('mao_fizzle').some(l => (l.reason || l.data?.reason) === 'refire_impossible_after_cost'), t.lg('mao_fizzle'));
    R.check('Bilanz sauber, keine Engine-Fehler', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }
  R.finish();
})().catch(e => { process.stderr.write(String(e && e.stack || e) + "\n"); process.exit(2); });
