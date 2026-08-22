// ═══════════════════════════════════════════
//  CARD EFFECT: "Future Tech Doping"
//  Potion (Normal)
//
//  "Choose a Hero you control and increase its current and max HP by
//   30 times the number of different \"Future Tech\" cards in your
//   discard pile."
//
//  Dieselbe Zählart wie Future Tech Bomb — VERSCHIEDENE Namen, nicht
//  Kopien. Und wie überall zählt die Karte sich nicht selbst mit (Als
//  Ruling 21.8.); bei leerer Ablage ist sie ein Nullwurf, bleibt aber
//  spielbar.
//
//  „current AND max HP" ist wichtig: das ist kein Heilen, sondern eine
//  echte Vergrößerung. Der Engine-Helfer `ctx.increaseMaxHp` macht
//  genau das (Vorbild Maya, the Nature Fairy) und hält beide Werte
//  zusammen — von Hand gesetzt hätte man sonst schnell einen Helden mit
//  mehr HP als Maximum.
//
//  Kein Deckel im Text, also auch keiner im Code.
// ═══════════════════════════════════════════

const { verschiedeneFutureTechInAblage } = require('./_future-tech-shared');

const CARD_NAME = 'Future Tech Doping';
const JE_NAME = 30;
/** Bis die Nadel steht — danach erst die Heilanzeige. */
const SPRITZE_MS = 480;
/** Pause, damit das Ziel-Popup verschwunden ist, bevor es losgeht. */
const MENUE_ZU_MS = 220;

module.exports = {
  isPotion: true,
  requiresTarget: true,

  canActivate(gs, playerIdx) {
    const ps = gs.players[playerIdx];
    return !!ps && (ps.heroes || []).some(h => h?.name && h.hp > 0);
  },

  getValidTargets(gs, playerIdx, engine) {
    return engine.getHeroTargets(playerIdx);
  },

  // ★ OHNE DIESEN BLOCK PASSIERT GAR NICHTS (Als Befund 21.8.: „lässt
  //   mich nicht mal ein Ziel wählen"). Der Server nimmt den
  //   Ziel-Zweig fuer Potions nur, wenn `getValidTargets` UND
  //   `targetingConfig` da sind (server.js ~9890) — fehlt die Konfig,
  //   wird stumm ohne Auswahl aufgeloest und `resolve` steigt mangels
  //   `selectedIds` sofort wieder aus.
  targetingConfig: {
    title: CARD_NAME,
    description: 'Choose one of your Heroes — it gains current and max HP for every different "Future Tech" card in your discard pile.',
    confirmLabel: '💉 Dope!',
    confirmClass: 'btn-success',
    cancellable: true,
    greenSelect: true,
    dealsDamage: false,
  },

  async resolve(engine, pi, selectedIds, validTargets) {
    const gs = engine.gs;
    const ps = gs.players[pi];
    if (!ps) return;

    const ziel = (validTargets || []).find(t => t.id === (selectedIds || [])[0]);
    if (!ziel) return;
    const held = gs.players[ziel.owner]?.heroes?.[ziel.heroIdx];
    if (!held || held.hp <= 0) return;

    const namen = verschiedeneFutureTechInAblage(gs, pi);
    const bonus = JE_NAME * namen;

    engine.log('ft_doping', {
      player: ps.username, hero: held.name, names: namen, amount: bonus,
    });

    if (bonus <= 0) { engine.sync(); return; }

    // ── Erst das Auswahlfenster schliessen (Als Rueckmeldung 21.8.) ──
    // Der Client raeumt das Ziel-Popup weg, sobald der naechste
    // Spielzustand ankommt. Ohne diesen Push liefe die Spritze noch
    // hinter dem offenen Menue los. `sync()` schiebt den Zustand raus,
    // die kurze Pause laesst ihn ankommen und das Fenster ausblenden.
    engine.sync();
    await engine._delay(MENUE_ZU_MS);

    // ── Erst die Spritze, dann die Heilung (Als Vorgabe 21.8.) ──
    // `syringe_stab` ist neu in v530 und hat deshalb einen eigenen
    // Klangeintrag. Sie faehrt von schraeg oben ins Ziel und rammt;
    // erst wenn die Nadel steht, laeuft die Heilanzeige an.
    engine._broadcastEvent('play_zone_animation', {
      type: 'syringe_stab', owner: ziel.owner, heroIdx: ziel.heroIdx, zoneSlot: -1,
    });
    await engine._delay(SPRITZE_MS);

    engine._broadcastEvent('play_zone_animation', {
      // `healing_hearts` statt des naheliegenden `niu_powerup`: beide
      // zeigen ein Aufpumpen, aber nur dieses hier hat einen
      // Klangeintrag.
      type: 'healing_hearts', owner: ziel.owner, heroIdx: ziel.heroIdx, zoneSlot: -1,
    });
    await engine._delay(320);

    // Hebt current UND max zusammen. `ctx.increaseMaxHp` ist nur die
    // Durchreiche auf `engine.increaseMaxHp` — und eine Potion hat
    // keine Karteninstanz, also gibt es hier auch keinen Kontext
    // (`_createContext(null)` wirft). Der Engine-Aufruf ist der
    // richtige Weg, nicht der Umweg ueber einen gebauten Kontext.
    engine.increaseMaxHp(held, bonus);
    engine.sync();
  },
};
