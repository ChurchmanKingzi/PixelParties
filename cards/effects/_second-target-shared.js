// ═══════════════════════════════════════════
//  SHARED: Zusatzziel-Helden (W76a)
//
//  „When this Hero hits exactly 1 target with a normal <Schule>-Spell/Attack whose original level is lower than this Hero's
//  <Schule>-level, you may choose a second target for the Spell/Attack to hit afterwards."
//    • Bomb Berserker Bartas — normal Destruction Magic Spells   (Destruction Magic)
//    • Grisgar, Emissary of the Demon Lord — normal Decay Magic Spells   (Decay Magic)
//    • Andras, the Human Weapon — normal Attacks   (Fighting)
//
//  EIN Baustein für alle drei (vorher drei Kopien desselben Codes, die auseinanderliefen: Grisgar und Andras kannten
//  weder die Spell-Merkmale noch die Vorabprüfung des Zweitziels). Ein neuer Zusatzziel-Held ruft nur `zweitzielAngebot`.
//
//  Regeln (Al, Welle 76):
//    1. „EXAKT 1 Ziel": das Angebot kommt nur, wenn der Spell im Hauptwurf genau EIN (verschiedenes) Ziel getroffen hat — Zahl der
//       Ziele laut Wurfprotokoll `gs._spellDamageLog` (`ctx.damageTargets`, ohne Doppelte). 0 oder ≥ 2 Ziele → kein Angebot; Flächenschaden an alle
//       (`aoeHit`, schreibt nicht ins Protokoll) → kein Angebot. „Up to N"-Spells (Fireball, Explosion, Magic Arrows) und „any number" (Pyroblast)
//       bieten also nur an, wenn der Spieler genau 1 Ziel gewählt hat.
//    2. Spell-Merkmale (deklarativ am Skript der Karte, kein Namens-Sonderfall): `neverMultiTarget` (Eraser Beam & Co.), `opponentChoosesTarget`
//       (Big Oopsie), `fixedTargetCount` (Chain Lightning) → nie ein Zweitwurf. Optional `zweitwurfMoeglich(engine, gs, pi) → boolean`
//       (z. B. Pyroblast: ohne freie Support Zone gibt es keinen Zweitwurf).
//    3. Das Angebot kommt nur mit einem LEGALEN zweiten Ziel (`engine.zweitwurfHatLegalesZiel`, W75b): dieselbe Ausschluss-/Einzelziel-Regel wie der echte Zweitwurf.
//    4. Der Zweitwurf ist ein Einzelziel-Zweitschlag: `gs._zweitzielWurf` (Wähler: `promptMultiTarget` kappt auf 1 Ziel) und `gs._spellExcludeTargets` = [erstes Ziel]
//       (ALLE Wähler — `promptDamageTarget`, `promptMultiTarget` — nehmen das getroffene Ziel nie wieder). Kosten/Nebenwirkungen, die an die Zahl der getroffenen
//       Ziele hängen („the same number of Pollution Tokens"), gelten für die im Zweitwurf getroffenen Ziele (1).
//
//  `gs._bartasSecondCast` bleibt der allgemeine Zweitwurf-Marker (Saya, Idej Kunagi, Fire Bolts lesen ihn); `gs._zweitzielWurf` ist die engere Marke
//  „ZWEITES ZIEL" (nur diese Helden): Einzelziel-Deckel + Ausschluss ohne Ausnahme.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const { loadCardEffect } = require('./_loader');

/** Beide Aktions-Flags werden VOR `afterSpellResolved` ausgewertet — was der Zweitwurf an ihnen ändert, wird zurückgesetzt (v1277). */
const AKTIONS_FLAGS = ['_spellFreeAction', '_spellForcesActionConsume'];

/**
 * Das Merkmal-Gate: darf dieser Spell/diese Attack überhaupt einen Zweitwurf bekommen? (deklarativ gelesen)
 * @returns {boolean}
 */
function spellErlaubtZweitziel(spellModul) {
  if (!spellModul) return true;
  if (spellModul.neverMultiTarget) return false;        // „can never hit more than 1 target" (Eraser Beam, Basketskull …)
  if (spellModul.opponentChoosesTarget) return false;   // der GEGNER wählt das Ziel (Big Oopsie)
  if (spellModul.fixedTargetCount) return false;        // die Zielzahl steht im Kartentext (Chain Lightning)
  return true;
}

/**
 * @param {object} ctx  `afterSpellResolved`-Kontext des Heldenskripts
 * @param {object} cfg
 * @param {string} cfg.heldName      Kartenname des Helden (Prompt-Titel)
 * @param {'Spell'|'Attack'} cfg.kind
 * @param {string} [cfg.zauberSchule]   Spell-Schule des Spells (nur kind 'Spell'): 'Destruction Magic' | 'Decay Magic'
 * @param {string} cfg.faehigkeit    Fähigkeit, deren Stufe verglichen wird: 'Destruction Magic' | 'Decay Magic' | 'Fighting'
 * @param {string} cfg.logTyp        Log-Eintrag des Zweitwurfs ('bartas_second_cast' …)
 * @param {string} cfg.logFeld       'spell' | 'attack' (Feldname des Kartennamens im Log)
 */
async function zweitzielAngebot(ctx, cfg) {
  const engine = ctx._engine;
  const gs = ctx.gameState;
  const pi = ctx.cardOwner;
  const heroIdx = ctx.cardHeroIdx;
  // Styx 28.9.: Held/Zonen auf der Brettseite `feld`, „du" = Kontrolleur `pi`.
  const feld = ctx.cardHeroOwner ?? pi;

  // Nur Spells/Attacks, die DIESER Held ausgeführt hat (Brettseite + Index).
  if ((ctx.heroOwner ?? ctx.casterIdx) !== feld || ctx.heroIdx !== heroIdx) return;
  // Kein Zweitwurf auf den Zweitwurf (Endlosschleife).
  if (ctx.isSecondCast) return;
  // Negierter Spell/negierte Attack („hits" nicht erfüllt).
  if (gs._spellNegatedByEffect) return;

  const ps = gs.players[pi];
  const hero = ctx.attachedHero ?? gs.players[feld]?.heroes?.[heroIdx];
  const heldHandlungsfaehig = () => !!hero?.name && hero.hp > 0
    && !hero.statuses?.frozen && !hero.statuses?.stunned && !hero.statuses?.negated;
  if (!heldHandlungsfaehig()) return;

  // Kartenart: normaler Spell der Schule / normale Attack
  const spellData = ctx.spellCardData;
  if (!spellData) return;
  if (!hasCardType(spellData, cfg.kind)) return;
  if ((spellData.subtype || '').toLowerCase() !== 'normal') return;
  if (cfg.kind === 'Spell' && spellData.spellSchool1 !== cfg.zauberSchule && spellData.spellSchool2 !== cfg.zauberSchule) return;

  // ① EXAKT 1 Ziel (Wurfprotokoll, ohne Doppelte)
  const targets = ctx.damageTargets || [];
  if (targets.length !== 1) return;

  // ② Merkmale am Skript der Karte
  const spellModul = loadCardEffect(ctx.spellName);
  if (!spellErlaubtZweitziel(spellModul)) return;

  // Originalstufe der Karte < Stufe der Fähigkeit (Performance & Co. zählt `countAbilitiesForSchool` mit)
  const spellLevel = spellData.level || 0;
  const faehigkeitsStufe = engine.countAbilitiesForSchool(cfg.faehigkeit, gs.players[feld]?.abilityZones?.[heroIdx] || []);
  if (spellLevel >= faehigkeitsStufe) return;

  // Mindestens 1 ANDERES Ziel auf der Gegnerseite (Altprüfung) …
  const oppIdx = engine.opponentOf(pi);
  const firstTargetId = targets[0].id;
  let hasOtherTarget = false;
  // Kontrolle statt Seite (Styx 28.9.); IDs bleiben physisch.
  for (const { physOwner, heroIdx: hi, hero: h } of engine.heroesControlledBy(oppIdx)) {
    if (!h?.name || h.hp <= 0) continue;
    if (`hero-${physOwner}-${hi}` !== firstTargetId) { hasOtherTarget = true; break; }
  }
  if (!hasOtherTarget) {
    for (const inst of engine.cardInstances) {
      if ((inst.controller ?? inst.owner) !== oppIdx || inst.zone !== 'support') continue;
      const cId = `equip-${engine.physicalSide(inst)}-${inst.heroIdx}-${inst.zoneSlot}`;
      if (cId !== firstTargetId) { hasOtherTarget = true; break; }
    }
  }
  if (!hasOtherTarget) return;

  // ③ … und ein LEGALES zweites Ziel (Trockenlauf der Zielsammlung des Spells, W75b); `null` = unbekannt → Altprüfung allein.
  if (await engine.zweitwurfHatLegalesZiel(firstTargetId) === false) return;
  // Der Spell kann im Zweitwurf nicht wirken (Pyroblast: keine freie Support Zone für den Token)?
  if (typeof spellModul?.zweitwurfMoeglich === 'function' && !spellModul.zweitwurfMoeglich(engine, gs, pi, ctx)) return;

  // Noch einmal prüfen, direkt vor der Frage (der Spell kann den Helden zwischendurch verändert haben)
  if (!heldHandlungsfaehig()) return;

  const confirmed = await ctx.promptConfirmEffect({
    title: cfg.heldName,
    message: `Hit a second target with ${ctx.spellName}?`,
  });
  if (!confirmed) return;

  engine.log(cfg.logTyp, { player: ps.username, hero: hero.name, [cfg.logFeld]: ctx.spellName });

  // Zweitwurf vorbereiten: frisches Protokoll, erstes Ziel ausgeschlossen, Zweitwurf-Marker
  gs._spellDamageLog = [];
  gs._spellExcludeTargets = [firstTargetId];
  gs._bartasSecondCast = true;
  gs._zweitzielWurf = true;
  delete gs._zweitzielId;

  // Das Skript neu laufen lassen (eine Wegwerf-Instanz; „skips costs")
  const spellScript = loadCardEffect(ctx.spellName);
  if (!spellScript?.hooks?.onPlay) {
    delete gs._spellDamageLog; delete gs._spellExcludeTargets; delete gs._bartasSecondCast; delete gs._zweitzielWurf; delete gs._zweitzielId;
    return;
  }
  const tempInst = engine._trackCard(ctx.spellName, pi, 'hand', heroIdx, -1);
  if (feld !== pi) tempInst.heroOwner = feld;   // Styx 28.9.: wie der Server bei Übernahme
  // W16f (H02-08): „Re-cast skips costs" — Token-/Zusatzkosten im `onPlay` (Goldify: `kostenSchonBezahlt`) gelten als schon bezahlt.
  tempInst._kostenBezahlt = true;

  const flagsVorher = {};
  for (const k of AKTIONS_FLAGS) flagsVorher[k] = gs[k];
  const abbruchVorher = gs._spellCancelled;

  try {
    await engine.runHooks('onPlay', {
      _onlyCard: tempInst, playedCard: tempInst,
      cardName: ctx.spellName, zone: 'hand', heroIdx,
      _skipReactionCheck: true,
    });
  } catch (err) {
    console.error(`[Engine] ${cfg.heldName} second cast error for "${ctx.spellName}":`, err.message);
  } finally {
    for (const k of AKTIONS_FLAGS) {
      if (flagsVorher[k] === undefined) delete gs[k];
      else gs[k] = flagsVorher[k];
    }
    // Ein Abbruch der Zielwahl im Zweitwurf (Abbrechen-Knopf) ist KEIN Abbruch des bereits aufgelösten Hauptwurfs.
    if (abbruchVorher === undefined) delete gs._spellCancelled; else gs._spellCancelled = abbruchVorher;
  }

  engine._untrackCard(tempInst.id);
  delete gs._spellDamageLog;
  delete gs._spellExcludeTargets;
  delete gs._bartasSecondCast;
  delete gs._zweitzielWurf;
  delete gs._zweitzielId;

  engine.sync();
}

module.exports = { zweitzielAngebot, spellErlaubtZweitziel };
