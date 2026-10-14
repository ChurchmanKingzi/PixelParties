'use strict';
// W8/04 · Welle 8 (Al, 14.10.2026, Fragen 1 und 3 aus Welle 7): „Ja, die bleiben bestehen." Bereits vergebene Stempel bleiben bei
// Frost/Betäubung/Negation des Trägers stehen: Toughness-HP und Fighting-ATK am gefrorenen/betäubten/negierten Helden; ein
// FREMDES Gift auf dem Wirt einer stillgelegten Paraseed bleibt (dieser Teil: W7-a/01). Absicherung gegen versehentliches Aufräumen durch die W8-Regel.
// Aufruf: node docs/niche-tests/repro/W8/04-stempel-bleiben-toughness-fighting-paraseed.js   (Exit 1 = Fehler tritt auf)
const H = require('../../lib/h.js');
const wait = (ms) => new Promise(r => setTimeout(r, ms));
const ZUSTAENDE = [['gefroren', (t) => t.heroStatus(0, 0, 'frozen')], ['betäubt', (t) => t.heroStatus(0, 0, 'stunned')],
  ['negiert (hart)', (t) => t.heroStatus(0, 0, 'negated')], ['negiert (Effekt)', (t) => t.heroStatus(0, 0, 'negated', { appliedTurn: 0, effectOnly: true })]];

(async () => {
  const R = H.runner();

  // ── Toughness / Fighting ───────────────────────────────────────────────────────────────────
  for (const [name, set] of ZUSTAENDE) {
    const t = await H.fresh({ abilities: { 0: { 0: [['Toughness'], ['Fighting'], []] } }, hp: 400 });
    await t.run(() => t.engine.runHooks('onGameStart', {}));
    const hp0 = t.hero(0, 0).maxHp, atk0 = t.engine.getHeroAtk ? t.engine.getHeroAtk(0, 0) : t.hero(0, 0).atk;
    R.check(`Toughness (${name}): Ausgangswert +100 max. HP`, hp0 >= 500, hp0);
    set(t);
    await t.endTurn(); await t.endTurn();
    const hp1 = t.hero(0, 0).maxHp, atk1 = t.engine.getHeroAtk ? t.engine.getHeroAtk(0, 0) : t.hero(0, 0).atk;
    R.check(`Toughness (${name}): max. HP bleiben stehen`, hp1 === hp0, { vorher: hp0, nachher: hp1 });
    R.check(`Fighting (${name}): ATK bleibt stehen`, atk1 === atk0, { vorher: atk0, nachher: atk1 });
    R.check(`Toughness/Fighting (${name}): keine Engine-Fehler`, t.errors.length === 0, t.errors);
    R.check(`Toughness/Fighting (${name}): Zustand sauber`, t.audit().length === 0, t.audit());
  }

  // ── Paraseed: das fremde Gift bei stillgelegter Paraseed prüft W7-a/01 (kein Duplikat hier) ──────
  // (Eine Paraseed, die ein vorhandenes Gift schon ÜBERNOMMEN hat, nimmt es beim Ruhen mit zurück - Skriptentscheidung `_paraseed`.)

  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
