// ═══════════════════════════════════════════
//  CARD EFFECT: "Future Tech Bazooka"
//  Artifact (Equipment, Cost 5)
//
//  "Equip this card to a Hero you control. When the equipped Hero
//   defeats a target with an Attack, you may choose up to as many
//   Creatures on the board as there are \"Future Tech Bazooka\" cards in
//   your discard pile and deal 100 damage to them."
//
//  ── Die Nachschlag-Karte des Archetyps ──
//  Billig (5 Gold), aber sie zahlt erst, wenn der ausgerüstete Held
//  etwas erledigt — und dann so oft, wie Kopien in der Ablage liegen.
//  Mit leerer Ablage passiert nichts; die Karte bleibt trotzdem
//  spielbar, weil sie den ATK-Träger stellt, der später schießt.
//
//  ── „defeats a target with an Attack" ──
//  Zwei Bedingungen, beide gemessen:
//   • Der Tod muss VOM ausgerüsteten Helden kommen — dieselbe Prüfung
//     wie bei Wanted Poster (`sourceOwner` + `sourceHeroIdx`, und eine
//     Kreatur in derselben Support Zone zählt NICHT, obwohl sie den
//     `heroIdx` des Wirts teilt).
//   • Es muss ein ATTACK gewesen sein. Der Schadenstyp der Quelle
//     entscheidet: `attack`. Ein Zauber, der eine Kreatur tötet,
//     löst also nicht aus.
//
//  ── „up to" heißt: der Spieler darf ablehnen ──
//  Abbruch der Zielwahl kostet nichts. Der Auftritt kommt deshalb erst,
//  wenn wirklich geschossen wird (Als Regel 21.8.: die Anzeige kündigt
//  etwas an, sie meldet keinen Leerlauf).
//
//  ── Beide Todesarten ──
//  `onCreatureDeath` UND `onHeroKO`: der Kartentext sagt „a target",
//  und Ziele sind in diesem Spiel Helden wie Kreaturen.
// ═══════════════════════════════════════════

const { zaehleInAblage } = require('./_future-tech-shared');

const CARD_NAME = 'Future Tech Bazooka';
const DAMAGE = 100;
/** Flugzeit des Geschosses. Etwas traeger als Flintlocks 380 ms — es
 *  ist ein groesseres Kaliber. */
const FLUGZEIT_MS = 430;

/** Kam der Tod vom ausgeruesteten Helden — und durch einen Angriff? */
function vomHeldenPerAngriff(ctx) {
  const src = ctx.source;
  if (!src) return false;
  const srcOwner = src.controller ?? src.owner ?? -1;
  if (srcOwner !== ctx.cardOwner) return false;
  if ((src.heroIdx ?? -1) !== ctx.cardHeroIdx) return false;
  // Eine Kreatur in derselben Support Zone teilt den `heroIdx` des
  // Wirts, ist aber Quelle ihrer eigenen Angriffe (Vorbild Wanted
  // Poster).
  if (src.zone === 'support') return false;
  // „with an Attack" — der Schadenstyp entscheidet. Das Feld heisst
  // `type` (Als Befund 21.8.: ich hatte `damageType`/`deathDamageType`
  // erfunden, beide gibt es in diesen Hooks NICHT — die Karte feuerte
  // deshalb nie). `ON_CREATURE_DEATH` reicht es aus dem Stapel-Pfad
  // durch, `ON_HERO_KO` seit v557 ebenfalls.
  const typ = ctx.type || ctx.damageType || null;
  return typ === 'attack';
}

/**
 * Alle Kreaturen auf dem Brett, BEIDE Seiten („Creatures on the board").
 * Ueber den Engine-Zielbauer, nicht selbst zusammengesucht — nur seine
 * Eintraege tragen die kanonischen Ziel-Ids, auf die der Client seine
 * Klickflaechen abbildet (Lehre aus Escape Device, 21.8.).
 */
function alleKreaturZiele(engine) {
  return [...engine.getCreatureTargets(0), ...engine.getCreatureTargets(1)];
}

async function schiessen(ctx) {
  if (!vomHeldenPerAngriff(ctx)) return;

  const engine = ctx._engine;
  const gs = engine.gs;
  const pi = ctx.cardOwner;

  const grenze = zaehleInAblage(gs, pi, CARD_NAME);
  if (grenze <= 0) return;                    // leere Ablage → kein Schuss

  const kandidaten = alleKreaturZiele(engine);
  if (kandidaten.length === 0) return;

  const wahl = await engine.promptEffectTarget(pi, kandidaten, {
    title: CARD_NAME,
    description: `Choose up to ${grenze} Creature${grenze !== 1 ? 's' : ''} — each takes ${DAMAGE} damage.`,
    confirmLabel: '🚀 Fire!',
    confirmClass: 'btn-danger',
    maxTotal: grenze,
    cancellable: true,
    _skipPostTargetReactions: true,   // Kreaturen, kein Heldenschutz-Fenster
  });
  const ids = Array.isArray(wahl) ? wahl : (wahl ? [wahl] : []);
  if (ids.length === 0) return;                // „up to" — Ablehnen ist frei

  // Erst jetzt der Auftritt: es wird wirklich geschossen.
  await engine.announceHookActivation(CARD_NAME, pi);

  // EIN Quellobjekt fuer alle Treffer — so erkennen Reaktionen und die
  // Effekt-Immunitaet den Schuss als EINEN Vorgang.
  const quelle = { name: CARD_NAME, owner: pi, heroIdx: ctx.cardHeroIdx };
  let getroffen = 0;
  for (const id of ids) {
    const ziel = kandidaten.find(t => t.id === id);
    if (!ziel?.cardInstance) continue;

    // ── Projektil vom ausgeruesteten Helden zum Ziel ──
    // Bauform von Crusader's Flintlock (Als Vorgabe 21.8.), nur
    // groesser: eine Bazooka schiesst keine Pistolenkugel. Der Schaden
    // faellt beim EINSCHLAG, nicht beim Abschuss — deshalb erst die
    // Flugzeit abwarten, dann treffen.
    engine._broadcastEvent('play_projectile_animation', {
      sourceOwner: pi, sourceHeroIdx: ctx.cardHeroIdx, sourceZoneSlot: -1,
      targetOwner: ziel.owner, targetHeroIdx: ziel.heroIdx,
      targetZoneSlot: ziel.slotIdx,
      emoji: '•',
      emojiStyle: {
        fontSize: 44,                       // Flintlock: 26
        color: '#ffe1a8',
        textShadow: '0 0 16px rgba(255,170,60,1), 0 0 6px rgba(255,255,255,.9)',
      },
      duration: FLUGZEIT_MS,
    });
    await engine._delay(FLUGZEIT_MS);
    // `explosion` — dieselbe Animation wie bei Explosivo's Sword (Als
    // Vorgabe 21.8.: die Feuersaeule passte nicht zum Einschlag).
    // Sie war bis v559 STUMM; statt ihr wie bei Future Tech Bomb
    // auszuweichen, hat sie jetzt einen Klangeintrag bekommen — das
    // hilft allen Nutzern der Animation auf einmal.
    engine._broadcastEvent('play_zone_animation', {
      type: 'explosion',
      owner: ziel.owner, heroIdx: ziel.heroIdx, zoneSlot: ziel.slotIdx,
    });

    await engine.actionDealCreatureDamage(
      quelle, ziel.cardInstance, DAMAGE, 'artifact',
      { sourceOwner: pi, canBeNegated: true },
    );
    getroffen++;
  }

  engine.log('ft_bazooka', {
    player: gs.players[pi]?.username, hits: getroffen, max: grenze,
  });
  engine.sync();
}

module.exports = {
  activeIn: ['support'],

  hooks: {
    onCreatureDeath: (ctx) => schiessen(ctx),
    onHeroKO: (ctx) => schiessen(ctx),
  },
};
