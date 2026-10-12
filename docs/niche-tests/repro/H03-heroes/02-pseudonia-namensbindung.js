'use strict';
// ═══════════════════════════════════════════════════════════════════════════
//  H03-heroes-02 · Von Pseudonia gewonnene Effekte laufen nicht, wenn das Skript den EIGENEN Kartennamen prüft
//
//  Karten: Monsieur Pete (afterDamage), Rha'Bi (onHeroKO), Monia Bot (canHeroRedirect), Rafflesia (afterSpellResolved),
//          Lilly (onCardTakenFromOpponent, `ctx.cardZone !== 'hero'`), Rescued Damsel Cecilia (sicherstellenExtraLeben)  ←→  Pseudonia, the Skill Devourer
//  Ruling (Pseudonia-Kopf, 22.9.): „that Hero's effects" = der gedruckte Effekt der Karte; auch Ascended Heroes geben ihn.
//  Erwartung: Pseudonia, der man den Effekt von X per `grantHeroEffect` gegeben hat, verhält sich wie X (Kontrollläufe mit dem echten X
//  bestehen). Beobachtung (✗): Die Hooks laufen zwar über die Trägerinstanz (attachedHero = Pseudonia), aber die Skripte vergleichen
//  `hero.name === CARD_NAME` bzw. suchen die Heldeninstanz per Namen:
//    Pete       monsieur-pete-the-booty-raider.js:40   `ziel.name !== CARD_NAME`            → keine Deck-Suche
//    Rha'Bi     rha-bi-the-living-skeleton.js:397      `gefallen.name !== CARD_NAME`        → beim Tod bleiben die gelegten Karten
//                                                       verdeckt in den gegnerischen Support Zones liegen (Marke `_rhabiPlaced`, nie mehr eingesammelt)
//    Monia Bot  monia-bot-…js:84                       `monia.name !== CARD_NAME`           → nie ein Redirect
//    Rafflesia  rafflesia-the-poison-princess.js:162   Heldeninstanz per `c.name === CARD_NAME` → kein Zusatzaktions-Anspruch,
//                                                       aber das HOPT wird vorher schon gestempelt (verbrannt ohne Gegenwert)
//    Lilly      lilly-the-charming-infiltrator.js:39   `ctx.cardZone !== 'hero'` (die Trägerinstanz liegt in Zone 'support') → kein Zusatz-Ziehen
//    Damsel     rescued-damsel-cecilia.js:53           `hero.name !== CARD_NAME`            → kein Extra-Leben (Wortlaut „this Ascended Hero": Stufe C)
//  Aufruf: node docs/niche-tests/repro/H03-heroes/02-pseudonia-namensbindung.js   (✗ = Fehler tritt auf)
// ═══════════════════════════════════════════════════════════════════════════
const H = require('../../lib/h.js');
const PSEUDO = 'Pseudonia, the Skill Devourer';
const FILL = ['Tushu, the Knowledge Keeper', 'Zwei, the Lucky Thief'];
(async () => {
  const R = H.runner();
  // Szene: Sitz 0 mit Held 0 = `own` (der echte Held) oder Pseudonia + gewonnener Effekt.
  async function szene(name, own, extra = {}) {
    const t = await H.fresh(Object.assign({ heroes: [[own ? name : PSEUDO, ...FILL], null], hp: 400 }, extra));
    await t.run(() => t.engine.runHooks('onGameStart', {}));   // die Harness ruft startGame() nicht auf
    if (!own) { t.engine.grantHeroEffect(0, 0, name); await t.run(() => t.engine.finishGainedHeroEffects(0, 0)); }
    return t;
  }

  for (const own of [true, false]) {
    const wer = own ? 'echter ' : 'Pseudonia mit ';
    R.section(`── Pete: ${wer}Pete nimmt Schaden vom Gegner (Burning Finger)`);
    let t = await szene('Monsieur Pete, the Booty Raider', own, { hand: [[], ['Burning Finger']], deck: [['Heal', 'Heal', 'Fireball', 'Fireball'], null] });
    t.script.push({ match: d => d.type === 'cardGallery', answer: (d) => ({ cardName: d.cards[0].name }) });
    t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 0 && v.heroIdx === 0).id];
    await t.play(1, 'Burning Finger', { hero: 0 });
    R.check(`${wer}Pete: Deck-Suche („search your deck for any card") wird angeboten`, t.prompts.some(p => p.d.type === 'cardGallery' && /Pete/.test(p.d.title)), t.prompts.map(p => p.d.type + ':' + p.d.title));

    R.section(`── Rha'Bi: ${wer}Rha'Bi legt eine Karte und stirbt`);
    t = await szene("Rha'Bi, the Living Skeleton", own, { deck: [['Heal', 'Heal', 'Fireball', 'Fireball', 'Heal'], null] });
    t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
    await t.activateHero(0, 0, { effect: "Rha'Bi, the Living Skeleton" });
    const gelegt = () => t.inst(c => c.counters && c.counters._rhabiPlaced);
    R.note('gelegte Karten', gelegt().map(c => c.name));
    await t.run(() => t.engine.actionDealDamage({ name: 'ZZ', owner: 1, heroIdx: 0 }, t.hero(0, 0), 9999, 'spell'));
    R.check(`${wer}Rha'Bi tot -> „delete all cards placed by this effect that are still in Support Zones"`, gelegt().length === 0, gelegt().map(c => c.name + '@' + c.owner + '/' + c.heroIdx));

    R.section(`── Monia Bot: ${wer}Monia Bot, Gegner zielt mit Burning Finger auf Held 1`);
    t = await szene('Monia Bot, the Foretold Rescuer of Coolness', own, { hand: [[], ['Burning Finger']], hp: 800 });
    t.script.push({ match: d => d.type === 'confirm' && /Monia|Pseudonia/.test(d.title || ''), answer: () => ({ confirmed: true }) });
    t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 0 && v.heroIdx === 1).id];
    await t.play(1, 'Burning Finger', { hero: 0 });
    R.check(`${wer}Monia Bot: Redirect auf den Träger (Held 1 unberührt, Held 0 getroffen)`, t.hp(0, 1) === 800 && t.hp(0, 0) < 800, [t.hp(0, 0), t.hp(0, 1)]);

    R.section(`── Rafflesia: ${wer}Rafflesia wirkt Venom Infusion (Decay), Heal (Support) liegt in der Hand`);
    t = await szene('Rafflesia, the Poison Princess', own, { hp: 800 });
    t.setAbilities(0, 0, [['Decay Magic', 'Decay Magic'], ['Support Magic'], []]);
    t.setHand(0, ['Venom Infusion', 'Heal']);
    t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
    await t.play(0, 'Venom Infusion', { hero: 0 });
    const hopt = Object.keys(t.gs.hoptUsed || {}).filter(k => /rafflesia/.test(k));
    const anspruch = t.engine.findAdditionalActionForCategory(0, 'spell', 0, 0);
    R.check(`${wer}Rafflesia: Zusatzaktions-Anspruch für den Support-Spell`, !!anspruch, { anspruch, hopt });

    R.section(`── Lilly: ${wer}Lilly nimmt per Infiltration Lv1 die oberste Gegnerkarte (Gegner zieht dafür 1)`);
    t = await szene('Lilly, the Charming Infiltrator', own, { deck: [Array(10).fill('Heal'), Array(10).fill('Fireball')] });
    t.setAbilities(0, 1, [['Infiltration'], [], []]);
    const vor = t.pile(0, 'hand').length;
    t.gs.activePlayer = 0; t.phase(2);
    await t.run(() => t.host.doActivateFreeAbility(t.room, 0, { heroIdx: 1, zoneIdx: 0 }));
    R.check(`${wer}Lilly: Hand +2 (gestohlene Karte + „draw 1 card")`, t.pile(0, 'hand').length - vor === 2, t.pile(0, 'hand'));

    R.section(`── Damsel: ${wer}Damsel erhält tödlichen Schlag (Stufe C: Wortlaut „this Ascended Hero")`);
    t = await szene('Rescued Damsel Cecilia', own);
    await t.run(() => t.engine.actionDealDamage({ name: 'ZZ', owner: 1, heroIdx: 0 }, t.hero(0, 0), 9999, 'spell'));
    R.check(`${wer}Damsel steht nach dem ersten tödlichen Schlag wieder auf`, t.hp(0, 0) > 0, t.hp(0, 0));
  }
  R.finish();
})();
