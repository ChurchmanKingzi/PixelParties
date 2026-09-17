// ═══════════════════════════════════════════
//  CARD EFFECT: „Petrifying Potion"
//  Potion (Normal)
//
//  "Choose any Hero and Stun it for 3 turns. Damage a Hero Stunned by
//   this effect would take becomes 0. You may heal a Hero Stunned by
//   this effect from this Stun at any time during your turn."
//
//  ── VERWANDT MIT „PETRIFIER" ──────────────────────────────────────
//  Die Null am Schaden haengt am Stun, nicht an einem eigenen Status:
//  der gemeinsame Marker `_petrified` sitzt AM Stun-Objekt und faellt
//  mit ihm (v1085). Optik, Schadensnull und CPU-Bewertung lesen ihn.
//  Anders als Petrifier trifft diese Karte NUR Helden, dafuer auf
//  beiden Seiten.
//
//  ── ★ DER EIGENE STUN WIRD GETRENNT GEFUEHRT (Al 17.9.) ───────────
//  „Ist ein Ziel per Potion UND aus anderer Quelle gestunnt, wird NUR
//  der Potion-Stun aufgehoben."
//
//  `addHeroStatus` ERSETZT ein bestehendes Status-Objekt vollstaendig —
//  zwei Stuns nebeneinander kennt die Engine nicht. Deshalb nimmt die
//  Potion den vorgefundenen Stun in Verwahrung:
//    `stunned._ppFremd = { obj: <alter Stun>, seit: <gs.turn> }`
//  Beim Heilen wird er mit der Restdauer wiederhergestellt, die er ohne
//  die Potion noch haette (eine Runde des Besitzers = zwei `gs.turn`).
//  Kommt spaeter ein FREMDER Stun dazu, ersetzt er unseren — dann ist
//  nichts mehr „by this effect" gestunnt, und die Klick-Option
//  verschwindet mit dem Marker. Genau so soll es sein.
//
//  ── ★ DIE KLICK-OPTION ───────────────────────────────────────────
//  „at any time during your turn" — kein Aktions-Weg, keine Kosten.
//  Der Stun traegt dafuer eine allgemeine Marke:
//    `stunned._klickHeilung = { card, by }`
//  Der Client macht den Helden damit anklickbar (auch auf der
//  Gegenseite), der Server ruft `onStatusClickOption` dieser Karte auf.
//  Der Helden-Effekt-Weg schied aus: der sperrt gestunnte Helden
//  ausdruecklich — hier ist der Stun ja gerade die Voraussetzung.
// ═══════════════════════════════════════════

const CARD_NAME = 'Petrifying Potion';
const DAUER = 3;

module.exports = {
  isPotion: true,

  canActivate(gs) {
    for (let pi = 0; pi < 2; pi++) {
      if (gs.firstTurnProtectedPlayer === pi) continue;
      for (const hero of (gs.players[pi]?.heroes || [])) {
        if (hero?.name && hero.hp > 0) return true;
      }
    }
    return false;
  },

  getValidTargets(gs, pi, engine) {
    const targets = [];
    for (let seite = 0; seite < 2; seite++) {
      if (gs.firstTurnProtectedPlayer === seite) continue;
      targets.push(...engine.getHeroTargets(seite));
    }
    return targets;
  },

  targetingConfig: {
    title: CARD_NAME,
    description: `Stun any Hero for ${DAUER} turns. While Stunned this way, all damage it would take becomes 0 — and you may break the petrification at any time during your turn by clicking the Hero.`,
    confirmLabel: '🗿 Petrify!',
    cancellable: true,
    maxPerType: { hero: 1 },
  },

  validateSelection(selectedIds) {
    return Array.isArray(selectedIds) && selectedIds.length === 1;
  },

  animationType: 'petrify',

  async resolve(engine, pi, selectedIds, validTargets) {
    if (!selectedIds?.length) return;
    const ziel = (validTargets || []).find(t => t.id === selectedIds[0]);
    if (!ziel || ziel.type !== 'hero') return;
    const gs = engine.gs;
    const hero = gs.players[ziel.owner]?.heroes?.[ziel.heroIdx];
    if (!hero?.name || hero.hp <= 0) return;

    // Fremden Stun in Verwahrung nehmen (siehe Kopf).
    const fremd = hero.statuses?.stunned
      ? { obj: { ...hero.statuses.stunned }, seit: gs.turn }
      : null;

    engine._broadcastEvent('play_zone_animation', {
      type: 'petrify', owner: ziel.owner, heroIdx: ziel.heroIdx, zoneSlot: -1,
    });
    await engine._delay(420);

    await engine.addHeroStatus(ziel.owner, ziel.heroIdx, 'stunned', {
      duration: DAUER,
      appliedBy: pi,
      source: CARD_NAME,
      _petrified: true,                       // Schadensnull + Steinoptik
      _klickHeilung: { card: CARD_NAME, by: pi },
      _ppFremd: fremd,
    });

    engine.log('petrifying_potion', {
      player: gs.players[pi]?.username, target: hero.name, dauer: DAUER,
    });
    engine.sync();
  },

  /**
   * ★ Klick auf den versteinerten Helden (Server: `status_click_option`).
   * @returns {boolean} ob geheilt wurde
   */
  async onStatusClickOption(engine, pi, heroOwner, heroIdx) {
    const gs = engine.gs;
    const hero = gs.players[heroOwner]?.heroes?.[heroIdx];
    const st = hero?.statuses?.stunned;
    if (!st || st._klickHeilung?.card !== CARD_NAME || st._klickHeilung?.by !== pi) return false;

    const ja = await engine.promptGeneric(pi, {
      type: 'confirm',
      title: CARD_NAME,
      message: `Break the petrification on ${hero.name}? It stops taking 0 damage and can act again.`,
      showCard: CARD_NAME,
      confirmLabel: '🔨 Break it!',
      cancelLabel: 'Not yet',
      cancellable: true,
    });
    if (!ja || ja.cancelled) return false;

    // Zustand kann sich waehrend der Abfrage geaendert haben.
    const st2 = gs.players[heroOwner]?.heroes?.[heroIdx]?.statuses?.stunned;
    if (!st2 || st2._klickHeilung?.card !== CARD_NAME || st2._klickHeilung?.by !== pi) return false;

    await engine.announceHookActivation(CARD_NAME, pi);

    const fremd = st2._ppFremd;
    delete hero.statuses.stunned;

    // Fremder Stun, der VOR der Potion lag: mit seiner Restdauer zurueck.
    if (fremd?.obj) {
      const vergangen = Math.floor(Math.max(0, gs.turn - (fremd.seit ?? gs.turn)) / 2);
      const rest = (fremd.obj.duration || 1) - vergangen;
      if (rest > 0) {
        hero.statuses.stunned = { ...fremd.obj, duration: rest, appliedTurn: gs.turn };
        delete hero.statuses.stunned._klickHeilung;
        delete hero.statuses.stunned._ppFremd;
      }
    }

    engine._broadcastEvent('play_zone_animation', {
      type: 'stone_break', owner: heroOwner, heroIdx, zoneSlot: -1,
    });
    engine.log('petrifying_potion_break', {
      player: gs.players[pi]?.username, target: hero.name,
      weiterhinGestunnt: !!hero.statuses.stunned,
    });
    engine.sync();
    return true;
  },
};
