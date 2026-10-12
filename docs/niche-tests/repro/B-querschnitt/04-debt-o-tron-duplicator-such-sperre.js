'use strict';
// Debt-O-Tron Model Backup Duplicator (Artifact/Creature): „You can only play this card while you have less than 0 Gold by deleting 1 card from your hand. Once per turn, when you have negative Gold
// after spending Gold, you may search your deck for a "Debt-O-Tron" Artifact …" – ein Körper auf dem Brett, der NICHT beim Ausspielen sucht.
// Der Lader (_loader.js) kennzeichnet ihn automatisch als `blockedBySearchLock` (sein Quelltext enthält nur Such-Aufrufe). Die Engine nimmt Kreaturen von dieser Sperre aus
// (`_cardBlockedBySearchLock`, _engine.js ~10770: „Kreaturen sind ausgenommen … eine Kreatur auf dem Brett hat Körper, HP und Trigger über ihren Such-Effekt hinaus"),
// prüft dafür aber `cardData.cardType === 'Creature'` – die Karte hat cardType 'Artifact' (Subtyp Creature) und fällt durch die Ausnahme.
// Erwartung: unter der Such-Sperre (Cats of the Pharaoh u. ä.) bleibt die Karte spielbar. Beobachtung: der Spielweg lehnt ab.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const N = 'Debt-O-Tron Model Backup Duplicator';
  for (const lock of [false, true]) {
    const t = await H.fresh({ hand: [[N, H.INERT.filler], []], gold: [-20, 100] });
    if (lock) t.gs.players[0].searchLocked = true;
    t.phase(2); t.gs.activePlayer = 0;
    const r = await t.run(() => t.host.doPlayArtifact(t.room, 0, { cardName: N, handIndex: 0, heroIdx: 0, zoneSlot: 0 }));
    const onBoard = !!t.find(N, 'support');
    R.check(lock ? 'unter Such-Sperre: Duplicator ist spielbar (Körper auf dem Brett)' : 'ohne Sperre: Duplicator ist spielbar', onBoard, { r, hand: t.pile(0, 'hand'), searchLock: t.engine.searchLockLevel(0) });
  }
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
