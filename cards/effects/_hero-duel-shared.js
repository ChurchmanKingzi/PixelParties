'use strict';
// ═══════════════════════════════════════════════════════════════════
//  GEMEINSAMES GERÜST: ZWEI HELDEN GREIFEN EINANDER GLEICHZEITIG AN
//  (Duel; gedacht auch für „Clash of Champions" und ähnliche Zweikämpfe)
//
//  Kartenneutral — der Kartenname, die Animation und die Rundenzahl kommen vom Aufrufer; hier steht nur die Mechanik:
//
//    duell(engine, { name, a, b, maxRunden, animation, einschlagMs, rundeMs })
//      a / b  { controller, side, heroIdx }   `controller` = wer den Helden kontrolliert (Angreifer im Sinne der Karte), `side` = Brettspalte des Helden
//      → { runden, aGefallen, bGefallen, unentschieden }
//
//  ── Ablauf je Runde ─────────────────────────────────────────────────
//  1. Beide leben noch? Sonst Schluss (auch ein Held, der mitten im Duell verschwindet, beendet es).
//  2. Der AKTUELLE Angriffswert (`hero.atk`) beider Helden wird gelesen und durch das Angriffsfenster `onAttackDeclare` geschickt (Doq & Co. — „when this Hero
//     attacks"; je Angriff ein Quellobjekt `{ name, owner, controller, heroIdx, heroOwner?, usesHeroAtk: true }`, wie bei jedem Angriff mit Heldenwert).
//  3. Die Animation läuft (Klinge gegen Klinge); beim Einschlag wird der Schaden BEIDER Angriffe verteilt — in der Todes-Klammer der Engine (`beginAoeStrike(1, {})` …
//     `endMultiHit()`): erst aller Schaden, dann alle Tode. So trifft auch der Held, der im selben Moment fällt, noch („simultaneously"); `1` hält die Interference-
//     Zählung (ab zwei Zielen) draussen — es ist kein Flächenschlag.
//  4. Jeder Schlag läuft über `dealDamageToTargets` (Einzeltreffer): Surprises „hit by", Hand-Reaktionen vor dem Schaden, Immunitäten, Schadensminderung, Schild —
//     also wie ein gewöhnlicher Angriff, nur ohne Zielwahl (die Helden stehen fest; „is chosen"-Surprises öffnen darum nicht).
//     Wird ein Schlag verhindert oder gemindert, fällt eben weniger — das Duell geht dann bis zur letzten Runde.
//
//  Das SPIELENDE wertet die Karte aus (`duel.js`): die Engine-Auswertung `checkAllHeroesDead` wird hier NICHT angestossen, `duell` rührt das Spielende nicht an. Der
//  Aufrufer hebt `gs._deferGameOverCheck`, solange das Duell läuft (sonst entschiede der erste Tod des Zweikampfs die Partie, bevor ein Unentschieden erkannt ist).
// ═══════════════════════════════════════════════════════════════════

const RUNDE_MS = 900;          // Länge der Animation je Runde (deckt sich mit `duel_clash` im Client)
const EINSCHLAG_MS = 520;      // bis zum Einschlag (Mount-Versatz des Clients von 100 ms eingerechnet)

const held = (engine, x) => engine.gs.players[x.side]?.heroes?.[x.heroIdx] || null;
const lebt = (h) => !!h && !!h.name && (h.hp || 0) > 0;

/** Quellobjekt eines Angriffs mit Heldenwert (wie `executeAttack` es baut). */
function angriffsQuelle(name, x) {
  const q = { name, owner: x.controller, controller: x.controller, heroIdx: x.heroIdx, usesHeroAtk: true };
  if (x.side !== x.controller) q.heroOwner = x.side;
  return q;
}

async function duell(engine, cfg) {
  const gs = engine.gs;
  const { name, a, b } = cfg;
  const max = cfg.maxRunden ?? 3;
  const rundeMs = cfg.rundeMs ?? RUNDE_MS;
  const einschlagMs = cfg.einschlagMs ?? EINSCHLAG_MS;
  let runden = 0;

  for (let r = 1; r <= max; r++) {
    if (gs.result) break;
    const A = held(engine, a), B = held(engine, b);
    if (!lebt(A) || !lebt(B)) break;
    runden = r;

    // ── 2. Angriffswerte lesen, Angriffsfenster ──
    const quelleA = angriffsQuelle(name, a), quelleB = angriffsQuelle(name, b);
    const zielA = { type: 'hero', owner: b.side, heroIdx: b.heroIdx };     // A trifft B
    const zielB = { type: 'hero', owner: a.side, heroIdx: a.heroIdx };     // B trifft A
    const atkA = await engine._fireAttackDeclare(quelleA, zielA, Math.max(0, A.atk || 0));
    const atkB = await engine._fireAttackDeclare(quelleB, zielB, Math.max(0, B.atk || 0));

    // ── 3. Animation, dann der Einschlag beider Schläge ──
    engine._broadcastEvent('play_zone_animation', {
      type: cfg.animation || 'duel_clash', zoneType: 'board', owner: a.controller, heroIdx: -1, zoneSlot: -1, duration: rundeMs, runde: r,
      targets: [{ owner: a.side, heroIdx: a.heroIdx, zoneSlot: -1, cardName: A.name }, { owner: b.side, heroIdx: b.heroIdx, zoneSlot: -1, cardName: B.name }],
      originOwner: a.side, originHeroIdx: a.heroIdx, originZoneSlot: -1,
    });
    await engine._delay(einschlagMs);
    if (gs.result) break;
    engine._broadcastEvent('play_screen_shake', { intensity: r >= 3 ? 'heavy' : 'medium' });

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
    await engine._delay(Math.max(0, rundeMs - einschlagMs));
    if (!lebt(A2) || !lebt(B2)) break;
  }

  const A = held(engine, a), B = held(engine, b);
  const aGefallen = !lebt(A), bGefallen = !lebt(B);
  return { runden, aGefallen, bGefallen, unentschieden: aGefallen && bGefallen };
}

module.exports = { duell, angriffsQuelle, RUNDE_MS, EINSCHLAG_MS };
