'use strict';
// W19c · Bestätigungen von Al (Welle 19), nur abgesichert, KEINE Änderung am Verhalten:
//  (1) Love Shot — „Soll Resistance/Anti Magic Enchantment an einem eigenen, vom Gegner kontrollierten Helden mein eigenes Love Shot blocken?" — „ja".
//      Der Schutz greift wie bei jedem Zielhelden: der Held wird weiter angeboten (Zielwahl), der Nachguss entfällt (keine Kartenwahl, Fireball bleibt auf der Hand, Marken unverändert);
//      ohne Schutz klappt derselbe Aufbau (Gegenprobe). Gilt für Resistance (beforeHeroEffect) und Anti Magic Enchantment (`magic_immune` Stufe ≥ 1).
//  (2) Divine Gift of Rain bei Cataclysm — „Soll Rain auch die Area des Reagierenden schützen?" — „Nein": nur Helden und Kreaturen des Reagierenden sind geschützt;
//      Cataclysm schickt trotzdem ALLE Areas (auch die des Reagierenden) in die Ablage.
// Ein Spiel je Prozess: Varianten per Argument (res|ame|ohne|rain), ohne Argument alle als Kindprozesse. Exit 0 = Regel gilt.
const H = require('../../lib/h.js');
const V = process.argv[2];
const marken = (h) => JSON.stringify({ by: h.charmedBy, from: h.charmedFromOwner, perma: h.permaControlBy, st: h.statuses?.charmed ?? null });
async function loveShot(R, v) {
  const t = await H.fresh({ hand: [['Love Shot', 'Fireball'], []], deckSize: 30, abilities: { 0: { 2: [['Destruction Magic', 'Destruction Magic'], [], []] } } });
  await t.engine.actionTakeHeroPermanently(1, 0, 2);     // mein Held 0:2 gehört nun dem Gegner
  const h2 = t.gs.players[0].heroes[2];
  if (v === 'res') t.setAbilities(0, 2, [['Destruction Magic', 'Destruction Magic'], ['Resistance'], []]);
  if (v === 'ame') await t.engine.actionAddBuff(h2, 0, 2, 'magic_immune', { level: 1 });
  const vorher = marken(h2);
  let angeboten = null, kartenwahl = false;
  t.targetFn = (valid, cfg) => {
    const title = (cfg && cfg.title) || '';
    if (/Love Shot/.test(title)) { angeboten = valid.map(x => `${x.owner}:${x.heroIdx}`); return ['hero-0-2']; }
    if (/Fireball/.test(title)) return [valid.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 1).id];
    return null;
  };
  t.script.push({ match: d => d.type === 'handPick' && /Love Shot/.test(d.title || ''), once: true, answer: (d) => { kartenwahl = true; const i = t.pile(0, 'hand').indexOf('Fireball'); return { selectedCards: [{ handIndex: i, cardName: 'Fireball' }] }; } });
  const r = await t.play(0, 'Love Shot', { hero: 0 });
  R.check(`${v}: Love Shot gespielt, der eigene vom Gegner kontrollierte Held 0:2 wird angeboten`, r === true && !!angeboten && angeboten.includes('0:2'), { r, angeboten });
  if (v === 'res') R.check('res: der Block kam von Resistance (Blockzähler 0:2 gesetzt)', Object.values(t.gs._resistanceBlocks || {}).some(n => n > 0), t.gs._resistanceBlocks);
  if (v === 'ohne') {
    R.check('ohne Schutz (Gegenprobe): Kartenwahl, Fireball gewirkt (−150), Fireball in der Ablage', kartenwahl && t.hp(1, 1) === 650 && t.pile(0, 'discardPile').includes('Fireball'), { kartenwahl, hp: t.hp(1, 1) });
  } else {
    R.check(`${v}: Schutz blockt das eigene Love Shot: keine Kartenwahl, Fireball bleibt auf der Hand, kein Schaden`, !kartenwahl && t.pile(0, 'hand').includes('Fireball') && t.hp(1, 1) === 800, { kartenwahl, hand: t.pile(0, 'hand'), hp: t.hp(1, 1) });
    R.check(`${v}: Love Shot trotzdem gespielt (Ablage), Deck-Zug blieb (Karte gezogen)`, t.pile(0, 'discardPile').includes('Love Shot'), t.pile(0, 'discardPile'));
  }
  R.check(`${v}: Kontrollmarken des Gegners über 0:2 unverändert`, marken(h2) === vorher, [vorher, marken(h2)]);
  R.check(`${v}: keine Engine-Fehler, Zustand sauber`, t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
}
async function rain(R) {
  const RAIN = 'Divine Gift of Rain';
  const t = await H.fresh({ hand: [['Cataclysm'], [RAIN]] });
  t.grantFor(1, 0, RAIN);
  t.setAbilities(1, 0, [['Support Magic', 'Support Magic', 'Support Magic'], ['Magic Arts', 'Magic Arts', 'Magic Arts'], []]);
  const kGeg = t.put(1, 1, 0, H.INERT.creature);
  t.putArea(1, 'Spider Hive');        // Area des Reagierenden
  t.putArea(0, 'Stinky Stables');     // Area des Wirkers
  await t.play(0, 'Cataclysm', { hero: 0 });
  R.check('Rain wurde gespielt (Einmal-Stempel gesetzt)', t.pile(1, 'discardPile').includes(RAIN) && t.gs.players[1]._oncePerGameUsed?.has('divineGift'), t.pile(1, 'discardPile'));
  R.check('Helden und Kreatur des Reagierenden geschützt', [0, 1, 2].every(h => t.hp(1, h) === 800) && (kGeg.counters.currentHp === undefined || kGeg.counters.currentHp === 200), { hp: [0, 1, 2].map(h => t.hp(1, h)), k: kGeg.counters });
  R.check('Helden des Wirkers nehmen 100', [0, 1, 2].every(h => t.hp(0, h) === 700), [0, 1, 2].map(h => t.hp(0, h)));
  R.check('NEIN: Rain schützt die Area des Reagierenden NICHT — Spider Hive in seiner Ablage, Brett leer', t.pile(1, 'discardPile').includes('Spider Hive') && !(t.gs.areaZones[1] || []).length, { abl: t.pile(1, 'discardPile'), area: t.gs.areaZones[1] });
  R.check('Area des Wirkers ebenfalls in der Ablage', t.pile(0, 'discardPile').includes('Stinky Stables') && !(t.gs.areaZones[0] || []).length, { abl: t.pile(0, 'discardPile'), area: t.gs.areaZones[0] });
  R.check('keine Engine-Fehler, Zustand sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
}
(async () => {
  if (!V) {
    let bad = 0;
    for (const v of ['res', 'ame', 'ohne', 'rain']) {
      const c = require('child_process').spawnSync(process.execPath, [__filename, v], { stdio: 'inherit' });
      if (c.status) bad++;
    }
    process.stdout.write(`\nGesamt: ${bad} Variante(n) mit ✗\n`);
    process.exit(bad ? 1 : 0);
  }
  const R = H.runner();
  if (V === 'rain') await rain(R); else await loveShot(R, V);
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
