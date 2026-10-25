'use strict';
// W75 · Darion · P6 (Engine `_checkPostTargetHandReactions` ② ausgeruestete Reaktionen) — zwei Cool Tech Jetpacks im selben Equip-Stapel sind zwei Karten mit je eigenem „first time every turn":
// lehnt der Spieler beim ersten Jetpack ab, wird DER ZWEITE Jetpack trotzdem angeboten (vorher fand die Engine fuer beide Namenseintraege dieselbe erste Instanz — das zweite Angebot
// fiel weg, `rxOpts.inst` zeigte zweimal auf dieselbe Karte).
// Kartentext Cool Tech Jetpack: „The first time every turn when the equipped Hero is chosen by a card or effect, you may discard 1 card to negate that card or effect."
// Darion: „All Artifacts equipped to this Hero share 1 Support Zone."
// Erwartet: Darion traegt [Jetpack, Club, Jetpack] (Cool-Repair-Herkunftsmarke, damit sie liegenbleiben). Der Gegner wirft Fireball auf Darion. Erstes Angebot: Nein. Zweites Angebot: Ja ->
// Fireball wird negiert (kein Schaden), es gab zwei Rueckfragen, und beide Jetpacks tragen ihren Stempel. Gegenprobe: zwei Jetpacks in zwei Plaetzen verhalten sich genauso.
// Aufruf: node docs/niche-tests/repro/W75/h-P6-07-zielschutz-ausruestung-gleichnamige-kopien-im-stapel.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const JP = 'Cool Tech Jetpack', D = 'Darion, the Blood-Crazy Groundskeeper', T = 'Tushu, the Knowledge Keeper';
(async () => {
  const R = H.runner();
  for (const imStapel of [true, false]) {
    R.section(imStapel ? 'Darion: [Jetpack, Club, Jetpack] in einem Platz' : 'Gegenprobe ohne Darion: zwei Jetpacks in zwei Plaetzen');
    const t = await H.fresh({ hand: [['ZZ Filler', 'ZZ Filler', 'ZZ Filler'], ['Fireball']], gold: [100, 100], heroes: [[imStapel ? D : T, null, null], [T, null, null]] });
    let jets;
    if (imStapel) {
      t.gs.players[0].supportZones[0][0] = [JP, 'Club of Gobbo', JP];
      jets = t.gs.players[0].supportZones[0][0].map(n => { const i = t.engine._trackCard(n, 0, 'support', 0, 0); i.turnPlayed = 1; return i; }).filter(i => i.name === JP);
    } else {
      jets = [t.put(0, 0, 0, JP), t.put(0, 0, 1, JP)];
    }
    for (const j of jets) j.counters._viaCoolRepair = true;
    t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 0 && v.heroIdx === 0).id];
    let n = 0;
    t.script.push({ match: d => d.type === 'confirm' && /Activate Cool Tech Jetpack/.test(d.message || ''), answer: () => (++n === 1 ? null : { confirmed: true }) });
    const hp = t.hp(0, 0);
    await t.play(1, 'Fireball', { hero: 0 });
    const fragen = t.prompts.filter(p => p.d.type === 'confirm' && /Activate Cool Tech Jetpack/.test(p.d.message || '')).length;
    R.note('lauf', JSON.stringify({ fragen, schaden: hp - t.hp(0, 0), stempel: Object.keys(t.gs.hoptUsed || {}).filter(k => /^cool-tech-jetpack:/.test(k)) }));
    R.check('zwei Rueckfragen (beide Jetpacks wurden angeboten)', fragen === 2, fragen);
    R.check('der zweite Jetpack negiert den Fireball: kein Schaden', hp === t.hp(0, 0), hp - t.hp(0, 0));
    R.check('beide Jetpack-Instanzen tragen ihren Stempel', jets.every(j => t.gs.hoptUsed?.[`cool-tech-jetpack:${j.id}`] === t.gs.turn), t.gs.hoptUsed);
    R.check('Sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }
  R.finish();
})();
