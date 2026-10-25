'use strict';
// W75 · Darion · P6 (Engine `_promptReactionsForChain`, Block „Ausruestungs-Reaktionen"; `_checkPostTargetHandReactions` ② ausgeruestete Reaktionen) — GLEICHNAMIGE Ausruestung im selben Stapel:
// jede Kopie ist eine eigene Karte mit eigenem Einmal-Stempel. Die Engine suchte die Instanz bisher nur ueber den NAMEN und nahm immer die erste — war die erste Kopie verbraucht, wurde die
// zweite nie angeboten (und `rxOpts.inst` zeigte bei der Zielschutz-Reaktion immer auf dieselbe Karte).
// Kartentext Bow of the Hunt Goddess: „Once per turn, in reaction to this Hero's Attack, search your deck for an Arrow Artifact and play it …" (Stempel je Bow-Kopie)
// Erwartet: Darion traegt [Bow, Club, Bow] in EINEM Platz. 1. Angriff: der Bow wird angeboten, der Pfeil gespielt. 2. Angriff im selben Zug: der ZWEITE Bow wird angeboten. 3. Angriff: beide
// verbraucht, kein Angebot mehr. Die Stempel liegen auf zwei verschiedenen Bow-Instanzen.
// Aufruf: node docs/niche-tests/repro/W75/h-P6-06-ausruestungs-reaktion-gleichnamige-kopien-im-stapel.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const BOW = 'Bow of the Hunt Goddess', D = 'Darion, the Blood-Crazy Groundskeeper', T = 'Tushu, the Knowledge Keeper';
const istBowPrompt = (p) => /Bow/.test(p.d.title || '');
const wahl = (name) => ({ match: d => d.type === 'cardGallery' && /Bow/.test(d.title || ''), answer: () => ({ cardName: name, source: 'deck' }), once: true });
(async () => {
  const R = H.runner();
  for (const imStapel of [true, false]) {
    R.section(imStapel ? 'Darion: [Bow, Club, Bow] in einem Platz' : 'Gegenprobe ohne Darion: zwei Bows in zwei Plaetzen');
    const hand = [['Attack', 'Attack', 'Attack'], []];
    const t = await H.fresh({ hand, deck: [['Flame Arrow', 'Poisoned Arrow', 'Flame Arrow', 'ZZ Dummy', 'ZZ Dummy', 'ZZ Dummy'], undefined], gold: [200, 100], active: 0, heroes: [[imStapel ? D : T, null, null], [T, null, null]] });
    t.policy.confirm = true;
    const ps = t.gs.players[0];
    let bows;
    if (imStapel) {
      ps.supportZones[0][0] = [BOW, 'Club of Gobbo', BOW];
      bows = ps.supportZones[0][0].map(n => { const i = t.engine._trackCard(n, 0, 'support', 0, 0); i.turnPlayed = 1; return i; }).filter(i => i.name === BOW);
    } else {
      bows = [t.put(0, 0, 0, BOW), t.put(0, 0, 1, BOW)];
    }
    t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];

    t.script.push(wahl('Flame Arrow'));
    t.reset();
    await t.play(0, 'Attack', { hero: 0 });
    R.check('1. Angriff: der Bow wird angeboten', t.prompts.some(istBowPrompt), t.prompts.map(p => p.d.title));
    const stempel1 = Object.keys(t.gs.hoptUsed || {}).filter(k => /^bowHuntGoddess#/.test(k) && t.gs.hoptUsed[k] === t.gs.turn);
    R.check('genau EIN Bow ist gestempelt', stempel1.length === 1, stempel1);

    t.script.push(wahl('Poisoned Arrow'));
    t.reset();
    await t.play(0, 'Attack', { hero: 0 });
    const stempel2 = Object.keys(t.gs.hoptUsed || {}).filter(k => /^bowHuntGoddess#/.test(k) && t.gs.hoptUsed[k] === t.gs.turn);
    R.check('2. Angriff im selben Zug: der ZWEITE Bow wird angeboten', t.prompts.some(istBowPrompt), t.prompts.map(p => p.d.title));
    R.check('jetzt sind beide Bow-Instanzen gestempelt (zwei verschiedene Schluessel)', stempel2.length === 2 && bows.every(b => stempel2.some(k => k.startsWith('bowHuntGoddess#' + b.id + ':'))), stempel2);

    t.reset();
    await t.play(0, 'Attack', { hero: 0 });
    R.check('3. Angriff: beide verbraucht, kein Angebot mehr', !t.prompts.some(istBowPrompt), t.prompts.map(p => p.d.title));
    R.check('Sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }
  R.finish();
})();
