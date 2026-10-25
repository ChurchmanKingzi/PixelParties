'use strict';
// W75 · Audit P5 · Darion × Bill, the Angry Auctioneer — Start-Equip auf einen Helden, der schon einen Equip-Stapel traegt (Puzzle-/Presets-Aufstellung).
// Kartentext: „Before starting hands are drawn, search deck for up to 2 different Equipment Artifacts with combined cost ≤ 20 and equip them to other Heroes (not Bill)… No gold cost."
// Befund (vorher): Bills Platzliste kannte den Stapel (einziger Platz), die letzte Pruefung vor dem Anlegen aber verlangte einen LEEREN Platz → das Equip wurde still ausgelassen (blieb im Deck).
// Erwartet: Darion (Held 1) mit Club im Platz 1 → das Glass Sword kommt aus dem Deck DAZU (Platz 1 = Club, Glass Sword), kein zweiter Platz; ohne vorhandenes Equip beginnt der Stapel wie sonst in der ersten freien Zone.
// Aufruf: node docs/niche-tests/repro/W75/h-P5-03-bill-startequip-in-bestehenden-stapel.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const D = 'Darion, the Blood-Crazy Groundskeeper', F = H.INERT.filler, BILL = 'Bill, the Angry Auctioneer';
(async () => {
  const R = H.runner();
  for (const vorher of [false, true]) {
    R.section(vorher ? 'Darion traegt schon einen Club' : 'Darion ohne Equip');
    const t = await H.fresh({ active: 0, heroes: [[BILL, D, null], [F, null, null]], hand: [[], [F]], gold: 500, deck: [['Glass Sword', 'Cute Crown', ...Array(15).fill(F)], Array(15).fill(F)] });
    if (vorher) { t.gs.players[0].supportZones[1][1] = ['Club of Gobbo']; const i = t.engine._trackCard('Club of Gobbo', 0, 'support', 1, 1); i.turnPlayed = 1; }
    t.script.push({ match: d => d.type === 'cardGalleryMulti', answer: () => ({ selectedCards: ['Glass Sword'] }) });
    t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
    t.targetFn = (valid) => { const v = valid.find(x => x.owner === 0 && x.heroIdx === 1); return [(v || valid[0]).id]; };
    t.engine.isPuzzle = true;   // keine Eroeffnungs-Wartezeit
    await t.run(() => t.engine.runHooks('onBeforeHandDraw', {}));
    await t.drain();
    const zonen = t.gs.players[0].supportZones[1];
    const fragen = t.prompts.filter(p => p.d.type === 'instancePick');
    R.note('lauf', JSON.stringify({ zonen, deckHatSword: t.pile(0, 'mainDeck').includes('Glass Sword') }));
    R.check('Glass Sword ist aus dem Deck ausgeruestet', !t.pile(0, 'mainDeck').includes('Glass Sword'), t.pile(0, 'mainDeck').slice(0, 3));
    if (vorher) {
      R.check('Platz 1 = Club + Glass Sword (Stapel), sonst nichts', JSON.stringify(zonen[1]) === JSON.stringify(['Club of Gobbo', 'Glass Sword']) && zonen[0].length === 0 && zonen[2].length === 0, zonen);
      R.check('der Stapel behaelt beide Instanzen am selben Platz', t.inst(c => c.zone === 'support' && c.owner === 0 && c.heroIdx === 1 && c.zoneSlot === 1).length === 2);
    } else {
      R.check('genau ein Equip, in einer Zone', zonen.flat().length === 1 && zonen.flat()[0] === 'Glass Sword', zonen);
    }
    R.check('keine Rueckfrage „welches Equip?"', fragen.length === 0);
    R.check('Sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }
  R.finish();
})();
