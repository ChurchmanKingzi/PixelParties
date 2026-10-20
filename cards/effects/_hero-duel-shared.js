'use strict';
// ═══════════════════════════════════════════════════════════════════
//  GEMEINSAMES GERÜST: ZWEI HELDEN GREIFEN EINANDER GLEICHZEITIG AN
//  (Duel; gedacht auch für „Clash of Champions" und ähnliche Zweikämpfe)
//
//  Kartenneutral — der Kartenname, die Animation und die Rundenzahl kommen vom Aufrufer; hier steht nur die Mechanik:
//
//    duell(engine, { name, a, b, maxRunden, animation, erstMs, folgeMs, heimMs, alsHeldenAngriff })
//      alsHeldenAngriff (W30a): true für Karten, deren Schläge „als Attack des Helden" zählen (Clash of Champions): Quellstufe = Fighting-Level des schlagenden Helden, nicht die Kartenstufe
//      a / b  { controller, side, heroIdx }   `controller` = wer den Helden kontrolliert (Angreifer im Sinne der Karte), `side` = Brettspalte des Helden
//      → { runden, aGefallen, bGefallen, unentschieden }
//
//  ── Ablauf je Runde ─────────────────────────────────────────────────
//  1. Beide leben noch? Sonst Schluss (auch ein Held, der mitten im Duell verschwindet, beendet es).
//  2. Der AKTUELLE Angriffswert (`hero.atk`) beider Helden wird gelesen und durch das Angriffsfenster `onAttackDeclare` geschickt (Doq & Co. — „when this Hero
//     attacks"; je Angriff ein Quellobjekt `{ name, owner, controller, heroIdx, heroOwner?, usesHeroAtk: true }`, wie bei jedem Angriff mit Heldenwert).
//  3. Die Animation läuft (Als Vorgabe 12.10.): EINE durchgehende Rammchoreografie, jeder Hit ist ein Aufprall in der Mitte zwischen den Zonen — die Helden rasen aufeinander
//     zu, krachen ineinander (Hit 1), prallen zurück, krachen wieder ineinander (Hit 2), zurück, noch einmal (Hit 3) … SCHLAG AUF SCHLAG, nur ~240 ms zwischen den Hits; erst nach
//     dem letzten Hit gehen sie heim. `play_hero_clash` (Phase `hit` je Runde, Phase `ende` danach) steuert die Heldenkarten, `duel_clash` malt je Hit den Pixelart-Aufprall.
//     Beim Aufprall wird der Schaden BEIDER Angriffe verteilt — in der Todes-Klammer der Engine (`beginAoeStrike(1, {})` … `endMultiHit()`): erst aller Schaden, dann alle
//     Tode. So trifft auch der Held, der im selben Moment fällt, noch („simultaneously"); `1` hält die Interference-Zählung (ab zwei Zielen) draussen — es ist kein Flächenschlag.
//  4. Jeder Schlag läuft über `dealDamageToTargets` (Einzeltreffer): Surprises „hit by", Hand-Reaktionen vor dem Schaden, Immunitäten, Schadensminderung, Schild —
//     also wie ein gewöhnlicher Angriff, nur ohne Zielwahl (die Helden stehen fest; „is chosen"-Surprises öffnen darum nicht).
//     Wird ein Schlag verhindert oder gemindert, fällt eben weniger — das Duell geht dann bis zur letzten Runde.
//
//  Das SPIELENDE wertet die Karte aus (`duel.js`): die Engine-Auswertung `checkAllHeroesDead` wird hier NICHT angestossen, `duell` rührt das Spielende nicht an. Der
//  Aufrufer hebt `gs._deferGameOverCheck`, solange das Duell läuft (sonst entschiede der erste Tod des Zweikampfs die Partie, bevor ein Unentschieden erkannt ist).
// ═══════════════════════════════════════════════════════════════════

// Die Zeiten decken sich mit der Rammbahn im Client (`ppHeldenRammenBahn`, app-board.jsx) und mit `duel_clash`. Heldenkarten UND Pixelart-Aufprall starten erst 100 ms nach dem
// Ereignis (Einbau-Versatz der Brett-Animationen, `ZONE_ANIM_MOUNT_DELAY_MS`); die Zahlen enthalten ihn.
const ERST_MS = 400;     // Hit 1: 100 ms Versatz + 260 ms Ausholen und Anlauf aus der Zone + ~40 ms Puffer (der erste Hit startet auf kalter Seite etwas später; das nächste Ereignis soll
                         // erst NACH dem Aufprall eintreffen, damit der Rückprall der Karten vor dem nächsten Hit fertig ist)
const FOLGE_MS = 240;    // Hit 2, 3 …: 100 ms Versatz (der Rückprall der Karten läuft darin) + 120 ms zurück ins Krachen + Puffer
const HEIM_MS = 440;     // nach dem letzten Hit: die Helden gehen heim (380 ms) + Puffer
const BILD_MS = 960;     // Lebensdauer der Pixelart-Animation je Hit (Aufprall + Nachglühen); NICHT die Wartezeit der Engine — `playAnimation` räumt sie danach ab

const held = (engine, x) => engine.gs.players[x.side]?.heroes?.[x.heroIdx] || null;
const lebt = (h) => !!h && !!h.name && (h.hp || 0) > 0;

/** Quellobjekt eines Angriffs mit Heldenwert (wie `executeAttack` es baut).
 *  W30a (Al, 21.10.2026): mit `engine` + `alsHeldenAngriff` (Clash of Champions: „treated as them performing an Attack") trägt der Schlag den Stempel
 *  `treatedAsAttack` = Fighting-Level DIESES Helden statt der gedruckten Kartenstufe (Leser: Stealth, Jetpack, Glass Wall, Test Flight, Escape Device …). */
function angriffsQuelle(name, x, engine, alsHeldenAngriff) {
  const q = { name, owner: x.controller, controller: x.controller, heroIdx: x.heroIdx, usesHeroAtk: true };
  if (x.side !== x.controller) q.heroOwner = x.side;
  if (alsHeldenAngriff && engine && typeof engine.heldenAngriffStempel === 'function') q.treatedAsAttack = engine.heldenAngriffStempel(x.side, x.heroIdx);
  return q;
}

async function duell(engine, cfg) {
  const gs = engine.gs;
  const { name, a, b } = cfg;
  const max = cfg.maxRunden ?? 3;
  const erstMs = cfg.erstMs ?? ERST_MS;
  const folgeMs = cfg.folgeMs ?? FOLGE_MS;
  const heimMs = cfg.heimMs ?? HEIM_MS;
  let runden = 0;
  let geramm = false;                          // `play_hero_clash` lief → am Ende `ende` senden
  const clashEvent = (phase, extra = {}) => ({
    a: { owner: a.side, heroIdx: a.heroIdx, cardName: held(engine, a)?.name }, b: { owner: b.side, heroIdx: b.heroIdx, cardName: held(engine, b)?.name }, phase, ...extra,
  });

  try {
    for (let r = 1; r <= max; r++) {
      if (gs.result) break;
      const A = held(engine, a), B = held(engine, b);
      if (!lebt(A) || !lebt(B)) break;
      runden = r;

      // ── 2. Angriffswerte lesen, Angriffsfenster ──
      const quelleA = angriffsQuelle(name, a, engine, cfg.alsHeldenAngriff), quelleB = angriffsQuelle(name, b, engine, cfg.alsHeldenAngriff);
      const zielA = { type: 'hero', owner: b.side, heroIdx: b.heroIdx };     // A trifft B
      const zielB = { type: 'hero', owner: a.side, heroIdx: a.heroIdx };     // B trifft A
      const atkA = await engine._fireAttackDeclare(quelleA, zielA, Math.max(0, A.atk || 0));
      const atkB = await engine._fireAttackDeclare(quelleB, zielB, Math.max(0, B.atk || 0));

      // ── 3. Hit: die Helden krachen in der Mitte ineinander, dann fällt der Schaden beider Schläge ──
      engine._broadcastEvent('play_hero_clash', clashEvent('hit', { runde: r }));
      geramm = true;
      engine._broadcastEvent('play_zone_animation', {
        type: cfg.animation || 'duel_clash', zoneType: 'board', owner: a.controller, heroIdx: -1, zoneSlot: -1, duration: BILD_MS, runde: r,
        targets: [{ owner: a.side, heroIdx: a.heroIdx, zoneSlot: -1, cardName: A.name }, { owner: b.side, heroIdx: b.heroIdx, zoneSlot: -1, cardName: B.name }],
        originOwner: a.side, originHeroIdx: a.heroIdx, originZoneSlot: -1,
      });
      await engine._delay(r === 1 ? erstMs : folgeMs);
      if (gs.result) break;
      engine._broadcastEvent('play_screen_shake', { intensity: r >= 2 ? 'heavy' : 'medium' });

      await engine.beginAoeStrike(1, {});         // Todes-Klammer ohne Flächenfenster (nur zwei Treffer, kein Flächenschlag)
      try {
        const opts = { damageType: 'attack', sourceName: name, hitDelay: 0 };
        if (lebt(held(engine, b))) await engine.dealDamageToTargets(quelleA, [zielA], { ...opts, damage: atkA });
        if (lebt(held(engine, a))) await engine.dealDamageToTargets(quelleB, [zielB], { ...opts, damage: atkB });
      } finally {
        await engine.endMultiHit();
      }

      const A2 = held(engine, a), B2 = held(engine, b);
      engine.log('duel_round', {
        round: r, source: name,
        a: { player: gs.players[a.controller]?.username, hero: A2?.name, damage: atkA, hp: Math.max(0, A2?.hp || 0) },
        b: { player: gs.players[b.controller]?.username, hero: B2?.name, damage: atkB, hp: Math.max(0, B2?.hp || 0) },
      });
      engine.sync();
      if (!lebt(A2) || !lebt(B2)) break;
    }
  } finally {
    // Nach dem letzten Hit gehen die Helden heim (auch bei Abbruch/Fehler: sonst blieben die Heldenkarten in der Bildmitte stehen).
    if (geramm) {
      engine._broadcastEvent('play_hero_clash', clashEvent('ende'));
      await engine._delay(heimMs);
    }
  }

  const A = held(engine, a), B = held(engine, b);
  const aGefallen = !lebt(A), bGefallen = !lebt(B);
  return { runden, aGefallen, bGefallen, unentschieden: aGefallen && bGefallen };
}

module.exports = { duell, angriffsQuelle, ERST_MS, FOLGE_MS, HEIM_MS };
