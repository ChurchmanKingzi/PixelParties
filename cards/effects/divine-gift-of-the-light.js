// ═══════════════════════════════════════════
//  CARD EFFECT: "Divine Gift of The Light"
//  Spell (Support Magic Lv1, Normal)
//
//  Once per game (Divine Gift restriction).
//  Inherent additional Action.
//  Placed face-up as a permanent.
//
//  While active: the first time every turn a Hero
//  uses a non-healing Support Magic Spell, that
//  Spell's controller chooses a target to heal
//  for 100 HP. Per-hero HOPT.
//
//  Healing is attributed to the casting Hero
//  (matters for Nao's overheal passive).
// ═══════════════════════════════════════════

// Doppelschul-Karten gehoeren BEIDEN Schulen an (Als Ruling 16.8.).
// Nie `spellSchool1 === …` vergleichen — siehe Helferkommentar.
const { hasSpellSchool } = require('./_hooks');

const { loadCardEffect } = require('./_loader');

// ═══════════════════════════════════════════
//  CPU-BEWERTUNG (gemessen am 13.8.)
//
//  Ausgangslage, mit derselben Methode wie bei Overheal Shock
//  nachgemessen (Engine offline, echte Heal-Burn-Aufstellung):
//
//      spielen  Δ = −22.2      abwerfen Δ = −22.2
//
//  Identisch — das Permanent ist in der Bewertung EXAKT NULL wert.
//  Deckungsgleich mit Als erstem Messlog, wo das Gate
//  `skip=−1251.7 best=−1273.8 → SKIP` meldete (Differenz 22.1).
//  Die CPU lehnte die Karte also aktiv ab, weil Spielen 22 Punkte
//  schlechter war als Nichtstun. Gleiche Bauart wie Flashbang,
//  Torchure und Smoke Vial: die Auszahlung liegt in KUENFTIGEN Zuegen,
//  die Sofortbewertung sieht nur die fehlende Handkarte.
//
//  REFERENZWERTE fuer die Groessenordnung (gemessen):
//      100 Schaden an einem Gegnerhelden  = +115
//      100 Heilung  an einem eigenen Held = +100
//  EIN einziger Ausloeser ist also rund 100 Punkte wert. Die
//  Obergrenze unten liegt bewusst DARUNTER — das ganze Permanent ist
//  billiger bepreist als ein einzelner seiner Ausloeser.
// ═══════════════════════════════════════════

// ── STELLSCHRAUBEN (Als Zahlen, aenderbar) ───────────────────────────
const DGOTL_PRO_QUELLE   = 20;   // je noch spielbarem Ausloeser
const DGOTL_MAX_QUELLEN  = 4;    // Deckel → 80 Grundwert
const DGOTL_SCHARF_BONUS = 0.5;  // +50 %, wenn der Ping SOFORT Schaden waere

/**
 * Wie viele Ausloeser kann diese Seite noch legen?
 *
 * Ausloeser = Support-Magic-SPELL, der NICHT heilt (`includesHealing`)
 * und nicht die Karte selbst. Gezaehlt werden Hand und Nachziehstapel.
 * Im Heal-Burn-Deck sind das 11 Kopien: 4x Brilliant Idea, 1x Guardian
 * Angel, 2x Martyry — und 4x Overheal Shock. Die Shock ist selbst ein
 * Ausloeser: sie anzuhaengen bringt im selben Zug den 100er-Ping mit,
 * der dann direkt in das gerade geschockte Ziel gehen kann.
 */
function countTriggerSources(engine, pi) {
  const ps = engine.gs?.players?.[pi];
  if (!ps) return 0;
  const cardDB = engine._getCardDB();
  let n = 0;
  const scan = (list) => {
    for (const name of (list || [])) {
      if (name === 'Divine Gift of The Light') continue;
      const cd = cardDB[name];
      if (!cd || cd.cardType !== 'Spell' || !hasSpellSchool(cd, 'Support Magic')) continue;
      let heilt = false;
      try { heilt = !!loadCardEffect(name)?.includesHealing; } catch { heilt = false; }
      if (heilt) continue;
      n++;
      if (n >= DGOTL_MAX_QUELLEN) return true;
    }
    return false;
  };
  if (scan(ps.hand)) return n;
  scan(ps.mainDeck);
  return n;
}

/**
 * Ist der 100er-Ping GERADE scharf, also sofort Schaden statt Heilung?
 * Zwei Wege: ein Gegnerheld mit `healReversed` (Overheal Shock) oder
 * ein eigenes Ziel mit noch unverbrauchtem Lifeforce Howitzer, der
 * geheilte HP in Schaden am Gegner uebersetzt.
 */
function pingIstScharf(engine, pi) {
  const gs = engine.gs;
  const oi = pi === 0 ? 1 : 0;
  for (const h of (gs.players?.[oi]?.heroes || [])) {
    if (h?.name && h.hp > 0 && h.statuses?.healReversed) return true;
  }
  for (const inst of (engine.cardInstances || [])) {
    if (inst.owner !== pi || inst.zone !== 'support') continue;
    if (inst.name !== 'Lifeforce Howitzer') continue;
    if (!inst.counters?.usedThisTurn) return true;
  }
  return false;
}

module.exports = {
  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).
  oncePerGame: true,
  oncePerGameKey: 'divineGift',
  inherentAction: true,
  activeIn: ['hand', 'permanent'],

  cpuMeta: {
    /**
     * Wert des liegenden Permanents fuer seinen Besitzer.
     *
     * Vertrag `cpuInstBonus(engine, inst, ownerIdx)`: der Rueckgabewert
     * wird der Seite gutgeschrieben, die die Instanz kontrolliert. Die
     * Schleife in `evaluateState` laeuft ueber ALLE `cardInstances`,
     * also auch ueber Zone `permanent` — dieselbe Mechanik, die
     * Overheal Shock nutzt, nur mit umgekehrtem Vorzeichen (hier hilft
     * die Karte ihrem Besitzer).
     *
     * Wert ist 0, solange die Seite keinen Ausloeser mehr legen kann —
     * dann liegt das Permanent tot da und soll auch nichts wert sein.
     */
    cpuInstBonus(engine, inst, ownerIdx) {
      try {
        if (!inst || inst.zone !== 'permanent') return 0;
        if (inst.name !== 'Divine Gift of The Light') return 0;

        // Nur die ERSTE Kopie zaehlt. Praktisch kann es dank
        // `oncePerGame` nur eine geben — der Riegel steht trotzdem,
        // weil dieselbe Falle bei Overheal Shock und The Great Wall of
        // Deri schon einmal zugeschlagen haette.
        const erste = (engine.cardInstances || []).find(c =>
          c.name === 'Divine Gift of The Light'
          && c.zone === 'permanent'
          && (c.controller ?? c.owner) === ownerIdx);
        if (erste && erste.id !== inst.id) return 0;

        const quellen = countTriggerSources(engine, ownerIdx);
        if (quellen <= 0) return 0;

        const grund = DGOTL_PRO_QUELLE * Math.min(quellen, DGOTL_MAX_QUELLEN);
        return pingIstScharf(engine, ownerIdx)
          ? grund * (1 + DGOTL_SCHARF_BONUS)
          : grund;
      } catch { return 0; }
    },
  },

  hooks: {
    /**
     * On play: place as a permanent (face-up card in front of the player).
     */
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];

      if (!ps.permanents) ps.permanents = [];
      const permId = 'perm-' + Date.now() + '-' + Math.random();
      ps.permanents.push({ name: 'Divine Gift of The Light', id: permId });

      // Re-track card instance as permanent
      const oldInst = engine.cardInstances.find(c =>
        c.owner === pi && c.name === 'Divine Gift of The Light' && c.zone === 'hand'
      );
      if (oldInst) engine._untrackCard(oldInst.id);

      const inst = engine._trackCard('Divine Gift of The Light', pi, 'permanent', -1, -1);
      inst.counters.permId = permId;

      // Prevent the spell handler from discarding this card
      gs._spellPlacedOnBoard = true;

      // Sync first so the permanent is rendered on the client
      engine.log('permanent_placed', { card: 'Divine Gift of The Light', player: ps.username });
      engine.sync();
      await engine._delay(200);

      // Play holy revival animation on the permanent card itself
      engine._broadcastEvent('play_permanent_animation', {
        owner: pi, permId, type: 'holy_revival',
      });
    },

    /**
     * After any spell resolves: check if it was a non-healing Support Spell,
     * and trigger the healing prompt for the caster (per-hero HOPT).
     */
    afterSpellResolved: async (ctx) => {
      // Only triggers while on the board as a permanent, not from hand
      if (ctx.card.zone !== 'permanent') return;

      const engine = ctx._engine;
      const gs = engine.gs;
      const spellData = ctx.spellCardData;
      if (!spellData) return;

      // Don't trigger on itself being played
      if (spellData.name === 'Divine Gift of The Light' || ctx.spellName === 'Divine Gift of The Light') return;

      // Only Support Magic Spells
      if (!hasSpellSchool(spellData, 'Support Magic')) return;

      // Skip healing spells
      const script = loadCardEffect(spellData.name || ctx.spellName);
      if (script?.includesHealing) return;

      const spellCasterIdx = ctx.casterIdx;
      const spellHeroIdx = ctx.heroIdx;
      if (spellCasterIdx == null || spellHeroIdx == null) return;

      const ps = gs.players[spellCasterIdx];
      if (!ps) return;
      const hero = ps.heroes?.[spellHeroIdx];
      if (!hero?.name || hero.hp <= 0) return;

      // Per-hero HOPT: each hero triggers at most once per turn
      const hoptKey = `gift-of-light:${spellCasterIdx}:${spellHeroIdx}`;
      if (!engine.claimHOPT(hoptKey, spellCasterIdx)) return;

      // Flash the permanent card itself
      const permInst = ctx.card;
      if (permInst?.counters?.permId) {
        engine._broadcastEvent('play_permanent_animation', {
          owner: permInst.owner, permId: permInst.counters.permId, type: 'holy_revival',
        });
      }

      // Prompt the spell's controller to pick any target to heal.
      // Heroes come from `getHeroTargets` (alive only); Creatures come
      // from `getCreatureTargets` (every Support Zone regardless of
      // host-Hero state — creatures are independent of their Hero).
      // The trailing filter preserves the original Light-gift contract
      // of healing pure Creatures only — Artifact-Creature hybrids
      // (Powder Keg, Pollution Spewer, …) are excluded even though
      // `getCreatureTargets` would otherwise include them.
      const cardDB = engine._getCardDB();
      const targets = [];
      for (let p = 0; p < 2; p++) {
        targets.push(...engine.getHeroTargets(p));
        targets.push(...engine.getCreatureTargets(p).filter(t => cardDB[t.cardName]?.cardType === 'Creature'));
      }

      if (targets.length === 0) return;

      const picked = await engine.promptEffectTarget(spellCasterIdx, targets, {
        title: 'Divine Gift of The Light',
        description: `${hero.name} played a Support Spell! Choose a target to heal for 100 HP.`,
        confirmLabel: '✨ Bless! (100 HP)',
        confirmClass: 'btn-success',
        cancellable: false,
        // CPU-Vertrag (13.8.): markiert den Prompt als HEILUNG. Ohne
        // die Marke griff weder das Heil-Gate am Kopf von
        // `cpuPickTargets` noch die neue Sicherung ueber dem gelernten
        // Prior — und das Profil hat fuer diese Karte ausgerechnet
        // `side:opp +6.4` gelernt. Der Prompt ist NICHT abbrechbar, ein
        // falsches Ziel waere also ein garantiertes Geschenk von 100 HP
        // an den Gegner. `heal.js` war bislang die einzige Karte im
        // Pool, die diese Marke setzt.
        isHealing: true,
        greenSelect: true,
        exclusiveTypes: true,
        maxPerType: { hero: 1, equip: 1 },
      });

      if (!picked || picked.length === 0) return;
      const target = targets.find(t => t.id === picked[0]);
      if (!target) return;

      // Play heal sparkle on target
      engine._broadcastEvent('play_zone_animation', {
        type: 'heal_sparkle',
        owner: target.owner,
        heroIdx: target.heroIdx,
        zoneSlot: target.type === 'hero' ? -1 : target.slotIdx,
      });
      await engine._delay(300);

      // Heal — source is attributed to the casting Hero for Nao overheal
      const healSource = { name: 'Divine Gift of The Light', owner: spellCasterIdx, heroIdx: spellHeroIdx };

      if (target.type === 'hero') {
        const tgtHero = gs.players[target.owner]?.heroes?.[target.heroIdx];
        if (tgtHero && tgtHero.hp > 0) {
          await engine.actionHealHero(healSource, tgtHero, 100);
        }
      } else if (target.type === 'equip') {
        const inst2 = target.cardInstance || engine.cardInstances.find(c =>
          c.owner === target.owner && c.zone === 'support' &&
          c.heroIdx === target.heroIdx && c.zoneSlot === target.slotIdx
        );
        if (inst2) {
          await engine.actionHealCreature(healSource, inst2, 100);
        }
      }

      engine.log('gift_of_light_heal', {
        player: ps.username,
        hero: hero.name,
        target: target.cardName,
        spell: spellData.name,
      });
      engine.sync();
    },
  },
};
