'use strict';
// N3-01 · Sarcophagus of Sealed Magic, gestohlen: zählt die Schul-Abilities der Helden des BESITZERS statt des Kontrolleurs
// Kartentext: „You may once per turn choose a target and deal damage equal to 60 times the number of Spell School Abilities with different names
//   attached to your undefeated Heroes to it."
// Regel: „your Heroes" = die Helden des KONTROLLEURS (CARD_API.md „Kontrolle statt Seite", „Karten mit ‚Hero you control': nur der aktuelle Kontrolleur").
//   Der Kopfkommentar des Skripts will es genau so („damit eine übernommene Kreatur die Party ihres Kontrolleurs liest").
// Aufbau: Sarkophag liegt auf Seite 0 / Held 0. (a) Besitzer (Sitz 0) hat 1 Schule, Dieb (Sitz 1) 3 Schulen. (b) Besitzer 3 Schulen, Dieb 1 Schule.
//   Sitz 1 stiehlt den Sarkophag (`actionStealCreature`) und aktiviert ihn (wie ein Mensch: `charmedOwner` = Brettseite 0).
// Erwartet: Schaden = 60 × Schulen des DIEBES: (a) 180, (b) 60.   Beobachtet: es zählen die Schulen des Besitzers: (a) 60, (b) 180.
// Ursache: cards/effects/sarcophagus-of-sealed-magic.js `canActivateCreatureEffect`/`onCreatureEffect`: `pi = engine.physicalSide(card)` (Z. 98 und 106; = `inst.owner` einer gestohlenen Kreatur = Besitzer),
//   `schulenZaehlen(engine, pi)` liest `gs.players[pi].heroes`. Richtig wäre die Kontrolle (`ctx.cardOwner`, `heroesControlledBy`).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const SCHULEN3 = [['Decay Magic'], ['Destruction Magic'], ['Support Magic']];
  const SCHULEN1 = [['Summoning Magic'], [], []];
  async function lauf(besitzerSchulen, diebSchulen, gestohlen) {
    const t = await H.fresh({});
    t.setAbilities(0, 0, besitzerSchulen);
    t.setAbilities(1, 0, diebSchulen);
    const s = t.put(0, 0, 0, 'Sarcophagus of Sealed Magic'); s.turnPlayed = 1;
    t.put(1, 1, 0, H.INERT.big);
    let nutzer = 0, gegner = 1;
    if (gestohlen) { t.engine.actionStealCreature(1, s, { sourceName: 'test' }); await H.sleep(250); nutzer = 1; gegner = 0; }
    t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === gegner && v.heroIdx === 2).id];
    t.gs.activePlayer = nutzer; t.phase(2); t.resetActions(nutzer);
    const hp0 = t.hp(gegner, 2);
    const r = await t.run(() => t.host.doActivateCreatureEffect(t.room, nutzer, { heroIdx: 0, zoneSlot: 0, ...(gestohlen ? { charmedOwner: 0 } : {}) }));
    return { r, schaden: hp0 - t.hp(gegner, 2), errors: t.errors };
  }
  const g1 = await lauf(SCHULEN1, SCHULEN3, false);
  R.check('Gegenprobe: ungestohlen, Besitzer mit 1 Schule → 60', g1.r === true && g1.schaden === 60, g1);
  const g2 = await lauf(SCHULEN3, SCHULEN1, false);
  R.check('Gegenprobe: ungestohlen, Besitzer mit 3 Schulen → 180', g2.r === true && g2.schaden === 180, g2);
  const a = await lauf(SCHULEN1, SCHULEN3, true);
  R.check('(a) gestohlen: Dieb hat 3 Schulen, Besitzer 1 → 180 (Schulen des Kontrolleurs)', a.r === true && a.schaden === 180, a);
  const b = await lauf(SCHULEN3, SCHULEN1, true);
  R.check('(b) gestohlen: Dieb hat 1 Schule, Besitzer 3 → 60 (Schulen des Kontrolleurs)', b.r === true && b.schaden === 60, b);
  R.check('keine Engine-Fehler', a.errors.length + b.errors.length === 0, [a.errors, b.errors]);
  R.finish();
})();
