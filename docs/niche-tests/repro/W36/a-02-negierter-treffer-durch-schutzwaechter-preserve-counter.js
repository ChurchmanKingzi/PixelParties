'use strict';
// W36a · Punkt 1 (Schutzkarten) · Al, 22.10.2026: „Wird ihr Treffer im Zielfenster negiert (z. B. Invisibility Cloak, Silence-ähnliche Negierer, Schutzkarten) …" — auch der Schutz-/Redirect-Zweig des
//  Zielfensters (`_checkTargetRedirect`: Preserve-Counter-Wächter von Tri Fecta/Tri Ad = `_dropTargetIds`, Rolling Boulder u. ä. = `_redirectNegated`) negiert den Treffer, ohne dass `promptDamageTarget`
//  das Flag `_spellNegatedByEffect` setzt (es liefert nur `null`). Neu: dort steht `gs._zielNegiertDurchSchutz`; `engine.heldenEffektZielwahl` liest es – der Treffer ist negiert (Stempel verbraucht, zählt
//  als Attack), kein Abbruch. Gegenprobe: lehnt der Besitzer des Wächters ab („No"), trifft der Effekt normal.
//  Szene: Heragas (Ziel muss eine Kreatur sein) gegen eine Kreatur MIT Preserve Counter auf der Seite des Tri-Fecta-Spielers; Wächter sagt Ja.
// Aufruf: node docs/niche-tests/repro/W36/a-02-negierter-treffer-durch-schutzwaechter-preserve-counter.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;
const HERAGAS = 'Heragas, the Monster Slayer';

async function szene(me, op, ja) {
  const heroes = [null, null]; heroes[op] = ['Tri Fecta, the Puppet Master', 'Tushu, the Knowledge Keeper', 'Zwei, the Lucky Thief'];
  const t = await H.fresh({ heroes, deckSize: 30, hp: 800, active: me, confirm: ja });
  t.setHero(me, 0, HERAGAS, 800);
  const kreatur = t.put(op, 1, 0, H.INERT.creature); kreatur.turnPlayed = 1; kreatur.counters.preserve = 1;
  t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: !!ja }) });
  t.targetFn = (v) => [(v.find(x => x.owner === op && x.type === 'equip' && x.cardInstance && x.cardInstance.id === kreatur.id) || v[0]).id];
  return { t, kreatur };
}
const stempel = (t, me) => t.gs.hoptUsed?.[t.engine.heroHoptKey(HERAGAS, me)] === t.gs.turn;

(async () => {
  const R = H.runner();
  for (const [me, op] of [[0, 1], [1, 0]]) {
    R.section(`Sitz ${me}: Preserve-Wächter sagt JA – Treffer negiert → Stempel verbraucht, zählt als Attack, keine Wirkung`);
    { const { t, kreatur } = await szene(me, op, true);
      t.gs.activePlayer = me; await t.activateHero(me, 0, { phase: 2 });
      const frage = t.prompts.filter(p => p.pi === op && p.d.type === 'confirm').length;
      R.check('der Wächter wurde gefragt', frage >= 1, t.prompts.map(p => p.d.title));
      R.check('die Kreatur lebt unversehrt (Treffer negiert)', kreatur.zone === 'support' && (kreatur.counters.currentHp ?? 200) === 200, kreatur.counters);
      R.check('Stempel VERBRAUCHT', stempel(t, me), t.gs.hoptUsed);
      R.check('zählt als gespielter Attack', (t.gs.players[me].attacksPlayedThisTurn || 0) === 1 && (t.hero(me, 0)._attacksThisTurn || 0) === 1, { ap: t.gs.players[me].attacksPlayedThisTurn });
      R.check('kein Flag-Rest', !t.gs._spellNegatedByEffect && !t.gs._zielNegiertDurchSchutz, null);
      R.check('sauber', sauber(t), { e: t.errors, a: t.audit() }); }
    R.section(`Sitz ${me}: Gegenprobe – Wächter sagt NEIN: der Treffer läuft normal`);
    { const { t, kreatur } = await szene(me, op, false);
      t.gs.activePlayer = me; await t.activateHero(me, 0, { phase: 2 });
      R.check('Kreatur getroffen/zerstört', kreatur.zone !== 'support' || (kreatur.counters.currentHp ?? 200) < 200, kreatur.counters);
      R.check('Stempel verbraucht, zählt als Attack', stempel(t, me) && (t.gs.players[me].attacksPlayedThisTurn || 0) === 1, null);
      R.check('sauber', sauber(t), { e: t.errors, a: t.audit() }); }
  }
  // ── Alice (W35a-Regel, dieselbe Lücke im Schutz-Zweig): Wächter sagt JA → Alices Effekt ist verbraucht und zählt als Spell ──
  for (const [me, op] of [[0, 1], [1, 0]]) {
    R.section(`Sitz ${me}: Alice, the Puppeteer Girl · Preserve-Wächter sagt JA – Stempel verbraucht, zählt als Spell (W35a-Regel auch für die Schutz-Negierung)`);
    const ALICE = 'Alice, the Puppeteer Girl';
    const heroes = [null, null]; heroes[op] = ['Tri Fecta, the Puppet Master', 'Tushu, the Knowledge Keeper', 'Zwei, the Lucky Thief'];
    const t = await H.fresh({ heroes, deckSize: 30, hp: 800, active: me, confirm: true });
    t.setHero(me, 0, ALICE, 800);
    for (let i = 0; i < 3; i++) { const c = t.put(me, 1, i, H.INERT.creature); c.turnPlayed = 1; }
    const kreatur = t.put(op, 1, 0, H.INERT.creature); kreatur.turnPlayed = 1; kreatur.counters.preserve = 1;
    t.setAbilities(me, 0, [['Destruction Magic', 'Destruction Magic'], [], []]);
    t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
    t.targetFn = (v) => [(v.find(x => x.owner === op && x.type === 'equip' && x.cardInstance && x.cardInstance.id === kreatur.id) || v[0]).id];
    t.gs.activePlayer = me; await t.activateHero(me, 0, { phase: 2 });
    R.check('die Kreatur lebt unversehrt (Treffer negiert)', kreatur.zone === 'support' && (kreatur.counters.currentHp ?? 200) === 200, kreatur.counters);
    R.check('Alices Stempel VERBRAUCHT', t.gs.hoptUsed?.[t.engine.heroHoptKey(ALICE, me)] === t.gs.turn, t.gs.hoptUsed);
    R.check('zählt als gespielter Spell (spellsPlayedThisTurn 1)', (t.gs.players[me].spellsPlayedThisTurn || 0) === 1, t.gs.players[me].spellsPlayedThisTurn);
    R.check('kein Flag-Rest', !t.gs._spellNegatedByEffect && !t.gs._zielNegiertDurchSchutz, null);
    R.check('sauber', sauber(t), { e: t.errors, a: t.audit() });
  }
  R.finish();
})();
