'use strict';
// W63c-02 · Gestohlene Handkarte (Charme Lv 2) kommt aufs BRETT und verlässt es wieder — Ablage/Hand gehören dem BESITZER.
// Eintritt: Karte wird gespielt/ausgerüstet/beschworen/angelegt/gesetzt (Equip, Creature, Ability, Surprise, Area, Attachment, Free-Side-Equip).
// Austritt: zerstört (actionDestroyCard), Kreatur stirbt durch Schaden, Kreatur wird auf die Hand zurückgegeben (Bounce).
// W64c (Al 23.10.2026): der Bounce geht in die Hand des aktuellen KONTROLLEURS (Herkunft bleibt) - die W63c-Annahme "Hand des Besitzers" ist zurückgenommen.
// Regel (CARD_API „Besitzer-Regel (W3)"): Ablage/Löschstapel/Deck/Hand-Rückgabe = Stapel des permanenten Besitzers, nicht des Kontrolleurs/Diebs.
// Alter Stand: Equip, Ability, Surprise, Area, Attachment und der Bounce landeten bei Dieb (`originalOwner` = Dieb, weil nur Creature/Spell/Artefakt
// die Herkunft der Handkarte auf die Brettinstanz übertrugen); dazu blieb eine Geister-Instanz der gestohlenen Karte in Zone `hand`.
const B = require('../../lib/besitzer.js');
const { H } = B;
(async () => {
  const R = H.runner();
  const { returnSupportCreatureToHand } = require('../../../../cards/effects/_deepsea-shared.js');
  const faelle = [
    ['Ausrüstung (Equip)', 'Blade of the Frostbringer', async (t, c) => { await t.play(t.dieb, c, { hero: 0 }); }],
    ['Free-Side-Equip an Heldin des Besitzers', 'Club of Gobbo', async (t, c) => { await t.play(t.dieb, c, { hero: 0, targetOwner: t.besitzer }); }],
    ['Kreatur beschworen', 'ZZ Dummy', async (t, c) => { await t.play(t.dieb, c, { hero: 0 }); }],
    ['Ability angelegt', 'Fighting', async (t, c) => { await t.play(t.dieb, c, { hero: 0, zoneSlot: 1 }); }],
    ['Surprise gesetzt', 'Booby Trap', async (t, c) => { await t.play(t.dieb, c, { hero: 0 }); }],
    ['Area gespielt', 'Blood Rock', async (t, c) => { await t.play(t.dieb, c, { hero: 0 }); }],
    ['Attachment angelegt', 'Anti Magic', async (t, c) => { await t.play(t.dieb, c, { hero: 0 }); }],
  ];
  for (const dieb of [0, 1]) {
    R.section(`── Dieb = Sitz ${dieb} ──`);
    for (const [name, karte, spiele] of faelle) {
      // (a) zerstört
      let t = await B.charmeKlau(karte, dieb);
      if (!t.pile(dieb, 'hand').includes(karte)) { R.check(`${name}: ${karte} wurde geklaut`, false, t.pile(dieb, 'hand')); continue; }
      await spiele(t, karte);
      const brett = t.engine.cardInstances.find(c => c.name === karte && ['support', 'ability', 'surprise', 'area'].includes(c.zone));
      R.check(`${name} (Dieb ${dieb}): liegt auf dem Brett`, !!brett, t.engine.cardInstances.filter(c => c.name === karte).map(c => c.zone));
      R.check(`${name} (Dieb ${dieb}): Brettinstanz gehört dem Besitzer (originalOwner = Sitz ${t.besitzer})`, brett && brett.originalOwner === t.besitzer, brett && { orig: brett.originalOwner, owner: brett.owner });
      await B.zerstoere(t, karte);
      B.erwarteStapel(R, t, `${name} zerstört (Dieb ${dieb})`, karte, t.besitzer, 'discardPile');
    }
    // Kreatur: Tod durch Schaden und Bounce
    {
      const t = await B.charmeKlau('ZZ Dummy Frail', dieb);
      await t.play(dieb, 'ZZ Dummy Frail', { hero: 0 });
      const inst = t.engine.cardInstances.find(c => c.name === 'ZZ Dummy Frail' && c.zone === 'support');
      await t.run(() => t.engine.actionDealCreatureDamage({ name: 'Test', owner: t.besitzer }, inst, 999, 'fire'));
      B.erwarteStapel(R, t, `Kreatur stirbt durch Schaden (Dieb ${dieb})`, 'ZZ Dummy Frail', t.besitzer, 'discardPile');
    }
    {
      const t = await B.charmeKlau('ZZ Dummy', dieb);
      await t.play(dieb, 'ZZ Dummy', { hero: 0 });
      const inst = t.engine.cardInstances.find(c => c.name === 'ZZ Dummy' && c.zone === 'support');
      await t.run(() => returnSupportCreatureToHand(t.engine, inst, 'Test', {}));
      const o = B.ort(t, 'ZZ Dummy');
      // W64c (Al 23.10.2026, ersetzt die W63c-Annahme „Hand des Besitzers"): Bounce geht in die Hand des aktuellen KONTROLLEURS (= Dieb); die Herkunft bleibt
      R.check(`Kreatur zurück auf die Hand (Dieb ${dieb}): Hand des KONTROLLEURS (Dieb), Herkunft = Besitzer`, B.anzahl(t, dieb, 'hand', 'ZZ Dummy') === 1 && B.anzahl(t, t.besitzer, 'hand', 'ZZ Dummy') === 0 && Object.values(t.gs.players[dieb]._handOriginals || {}).some(x => x && x.n === 'ZZ Dummy' && x.o === t.besitzer), o);
      // …und von dort abgeworfen: Ablage des Besitzers
      await t.run(() => t.engine.actionDiscardHandCard(dieb, 'ZZ Dummy', t.pile(dieb, 'hand').indexOf('ZZ Dummy'), {}));
      B.erwarteStapel(R, t, `Kreatur zurück auf die Hand, abgeworfen (Dieb ${dieb})`, 'ZZ Dummy', t.besitzer, 'discardPile');
    }
    // Gegenprobe: eigene Karte desselben Namens → Stapel des Halters
    {
      const t = await H.fresh({ hand: [[], []], abilities: {} });
      t.setHand(dieb, ['Blade of the Frostbringer']);
      await t.play(dieb, 'Blade of the Frostbringer', { hero: 0 });
      await B.zerstoere(t, 'Blade of the Frostbringer');
      R.check(`Gegenprobe eigene Ausrüstung (Sitz ${dieb}) → eigene Ablage`, B.anzahl(t, dieb, 'discardPile', 'Blade of the Frostbringer') === 1 && B.anzahl(t, 1 - dieb, 'discardPile', 'Blade of the Frostbringer') === 0, B.ort(t, 'Blade of the Frostbringer'));
    }
  }
  R.finish();
})();
