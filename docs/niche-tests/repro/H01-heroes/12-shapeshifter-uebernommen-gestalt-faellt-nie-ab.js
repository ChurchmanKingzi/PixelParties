'use strict';
// H01-heroes-12 · „???, the Shapeshifter" unter fremder Kontrolle: die geliehene Gestalt fällt nie ab, der angelegte Held bleibt für immer im Support
//
// Kartentext: „You may once per turn equip a Hero with a different name from all Heroes you control from your hand, deck or discard pile to this
//   Hero. This Hero gains the effects and name of the Hero equipped to it this way. At the end of your opponent's turn, send all Heroes equipped
//   this way to the discard pile."
// Regel (CARD_API.md „Übernommene Helden gelten als Helden des Kontrolleurs"): „you/your" = Kontrolleur; der Kontrolleur darf den Heldeneffekt benutzen.
// Aufbau: Sitz 1 übernimmt den Shapeshifter von Sitz 0 dauerhaft (`actionTakeHeroPermanently`, Paraseed-Weg) bzw. zeitweise (`actionStealHero`),
//   aktiviert den Effekt mit Archibald aus seiner Hand und spielt vier Zugwechsel durch (zwei volle Runden, darunter das Ende des Zuges von Sitz 0).
// Erwartet: nach dem Ende des gegnerischen Zuges heißt der Held wieder „???, the Shapeshifter", der Support ist leer, Archibald liegt in der Ablage.
// Beobachtet: der Held heißt für den Rest des Spiels „Archibald, the Archmage", Archibald bleibt im Support liegen, die Ablagen sind leer.
//   Gegenprobe (kein Diebstahl, oder Diebstahl NACH der Verwandlung): Rückverwandlung läuft wie vorgesehen.
// Ursache: `the-shapeshifter.js` ~Z. 423 `heldeninstanz(engine, hs, heroIdx)` sucht `c.owner === hs` (Brettseite); während der Aktivierung eines
//   übernommenen Helden trägt die Heldeninstanz aber den Kontrolleur als `owner` → `heldInst` ist null, `_identityExpiresTurn` wird nie gestempelt, der
//   Engine-Sweep `_expireBorrowedIdentities` hat nichts zu tun.
const H = require('../../lib/h.js');
const SHAPE = '???, the Shapeshifter', F = 'Archibald, the Archmage';
(async () => {
  const R = H.runner();
  async function lauf(modus) {
    const t = await H.fresh({ heroes: [[SHAPE, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null], hand: [[], modus === 'eigen' ? [] : [F]] });
    if (modus === 'eigen') t.addHand(0, F);
    const wer = modus === 'eigen' ? 0 : 1;
    if (modus === 'perma') await t.run(() => t.engine.actionTakeHeroPermanently(1, 0, 0, { sourceName: 'Test' }));
    if (modus === 'steal') await t.run(() => t.engine.actionStealHero(1, 0, 0, { sourceName: 'Test' }));
    t.script.push({ match: d => d.type === 'cardGallery' && d.title === SHAPE, answer: () => ({ cardName: F, source: 'hand' }), once: true });
    t.gs.activePlayer = wer; t.resetActions(wer); t.phase(2);
    const r = await t.run(() => t.host.doActivateHeroEffect(t.room, wer, modus === 'eigen' ? { heroIdx: 0 } : { heroIdx: 0, charmedOwner: 0 }));
    const vorher = t.hero(0, 0).name;
    for (let i = 0; i < 4; i++) await t.endTurn();
    return { t, r, vorher, nachher: t.hero(0, 0).name, support: t.gs.players[0].supportZones[0].flat().length, ablage: [t.pile(0, 'discardPile'), t.pile(1, 'discardPile')] };
  }
  for (const modus of ['eigen', 'perma', 'steal']) {
    const x = await lauf(modus);
    R.section(modus === 'eigen' ? 'Kontrolle: eigener Shapeshifter' : modus === 'perma' ? 'Dauerhaft übernommen (actionTakeHeroPermanently)' : 'Zeitweise übernommen (actionStealHero)');
    R.check('Verwandlung geklappt (Name = Archibald)', x.vorher === F, [x.r, x.vorher]);
    R.check('nach 4 Zugwechseln wieder „???, the Shapeshifter"', x.nachher === SHAPE, x.nachher);
    R.check('angelegter Held nicht mehr im Support', x.support === 0, x.support);
    R.check('Archibald liegt in einer Ablage', x.ablage.flat().includes(F), x.ablage);
    R.check('keine Engine-Fehler', x.t.errors.length === 0, x.t.errors);
  }
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
