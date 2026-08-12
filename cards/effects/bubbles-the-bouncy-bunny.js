// ═══════════════════════════════════════════
//  CARD EFFECT: "Bubbles, the Bouncy Bunny"
//  Hero — 500 HP / 100 ATK (Friendship + Toughness)
//
//  "You may redirect any damage any Creatures would take to this Hero.
//   If this Hero is defeated by redirected damage, draw until you have
//   7 cards in your hand."
//
//  ── Wo das ansetzt ──
//  `beforeCreatureDamageBatch` — derselbe Weg, den Prophecy of Tempeste
//  fuer seine Umleitung nutzt. Der Hook bekommt ALLE Eintraege eines
//  Schadenspakets und darf einzelne mit `cancelled = true` streichen;
//  der umgeleitete Betrag geht danach per `actionDealDamage` an den
//  Helden.
//
//  ── ALS RULINGS (8.8.), alle drei ausdruecklich ──
//  1. Bubbles nimmt den VOLLEN Schaden, nicht den, den die Kreatur
//     ueberlebt haette: 100 Schaden auf eine 50-HP-Kreatur sind 100
//     Schaden fuer Bubbles. Deshalb KEIN Deckel und kein Abgleich mit
//     der Rest-HP der Kreatur (anders als Tempeste, das bei 100 kappt).
//  2. Er darf umleiten, auch wenn ihn das umbringt. Es gibt also keine
//     HP-Pruefung — der Spieler entscheidet, die Kreatur ueberlebt.
//  3. Schaden, der nicht umgeleitet werden kann, loest gar nichts aus:
//     Eintraege mit `cannotBeRedirected` (auch auf der Quelle) werden
//     uebersprungen, ebenso die eigene Wiedereinspielung.
//
//  ── „any Creatures" ──
//  Woertlich gelesen: JEDE Kreatur auf dem Brett, auch eine gegnerische.
//  Der Text sagt nicht „Creatures you control", und die doppelte Form
//  „any damage any Creatures" wirkt bewusst weit. Es bleibt ein „you
//  may" — angeboten wird es nur dem Besitzer von Bubbles. An Al
//  gemeldet, falls doch nur eigene Kreaturen gemeint sind: dann faellt
//  nur die eine Zeile mit dem Controller-Vergleich weg.
//
//  ── Kein Limit pro Zug ──
//  Der Text nennt keines, also wird je Schadenseintrag einzeln gefragt.
//  Bei einem Flaechenschaden auf fuenf Kreaturen sind das fuenf Fragen.
// ═══════════════════════════════════════════

const { loadCardEffect } = require('./_loader');

const CARD_NAME = 'Bubbles, the Bouncy Bunny';
const TARGET_HAND_SIZE = 7;
const REDIRECT_MARK = '_bubblesRedirected';

/** Darf dieser Schadenseintrag ueberhaupt umgeleitet werden? */
function isRedirectable(entry) {
  if (!entry || entry.cancelled) return false;
  if (!entry.inst || entry.inst.zone !== 'support') return false;
  if ((entry.amount || 0) <= 0) return false;
  // Als Ruling: nicht umleitbarer Schaden loest den Effekt nicht aus.
  // Drei Schreibweisen, alle drei zaehlen: auf dem Eintrag, auf der
  // Quelle — und als Merkmal des QUELL-SKRIPTS. Letzteres ist der Weg
  // fuer Karten, deren Text "cannot be redirected" sagt (Acid Vial);
  // ihr Schadensaufruf kann das Flag gar nicht mitgeben, weil er ueber
  // `actionDealTrueDamage` laeuft.
  if (entry.cannotBeRedirected) return false;
  if (entry.source?.cannotBeRedirected) return false;
  if (entry.source?.name) {
    try {
      if (loadCardEffect(entry.source.name)?.cannotBeRedirected) return false;
    } catch { /* unbekannte Quelle: normal behandeln */ }
  }
  // Die eigene Wiedereinspielung darf sich nicht selbst einfangen.
  if (entry.source?.[REDIRECT_MARK]) return false;
  return true;
}

/**
 * Traegt dieser Schaden die Eigenschaft „kann nicht verringert oder
 * negiert werden"? Kreatur-Eintraege kennen dafuer ZWEI Schreibweisen:
 * das aeltere `canBeNegated: false` (echter Schaden, durchschlaegt
 * Guardian-Immunitaet und Gate Shield) und die neueren Felder
 * `cannotBeNegated` / `cannotBeReduced`, die `processCreatureDamageBatch`
 * aus dem Proxy uebernimmt. Beide muessen die Umleitung ueberleben.
 */
function piercingOf(entry) {
  // `canBeNegated: false` ist die Signatur von `actionDealTrueDamage`
  // (Acid Vial, Rockfall). Solcher Schaden muss auch NACH der Umleitung
  // ueber denselben Weg laufen — sonst greifen bei Bubbles wieder
  // Multiplikatoren und Immunitaeten, und er nimmt am Ende 0.
  const trueDamage = entry.canBeNegated === false;
  return {
    trueDamage,
    cannotBeNegated: trueDamage || !!entry.cannotBeNegated,
    cannotBeReduced: trueDamage || !!entry.cannotBeReduced,
  };
}

/**
 * Wie viel Schaden kaeme bei Bubbles WIRKLICH an? Bildet den passenden
 * Engine-Weg nach, damit die rote Todeszeile nicht luegt (Als Befunde
 * 8.8.: sie erschien auch bei Schaden, der korrekt auf 0 reduziert wird).
 *
 * ZWEI WEGE, und sie verhalten sich unterschiedlich:
 *
 *  • **Echter Schaden** (`canBeNegated: false`, wie ihn
 *    `actionDealTrueDamage` erzeugt — Acid Vial, Rockfall): umgeht
 *    Buff-Multiplikatoren, Charme, Submerged und Baihu-Versteinerung.
 *    Absolut bleiben nur der Spielstart-Schutz und Carris'
 *    Selbstschaden-Immunitaet.
 *  • **Gewoehnlicher Schaden**: Multiplikatoren und alle pauschalen
 *    Sperren greifen; `magic_immune` blockt Zauber bis zur eigenen
 *    Stufe, sofern der Schaden nicht un-negierbar ist.
 */
function predictedDamage(engine, hero, pi, entry, piercing) {
  const gs = engine.gs;
  const amount = entry.amount || 0;
  if (amount <= 0) return 0;

  // Fuer BEIDE Wege absolut.
  if (gs.firstTurnProtectedPlayer === pi) return 0;
  if (engine._isHeroSelfDamageImmune?.(hero)) return 0;

  if (piercing.trueDamage) return amount;      // alles Weitere umgeht er

  if (hero.statuses?.charmed) return 0;
  if (hero.statuses?.stunned?._baihuPetrify) return 0;
  if (hero.buffs?.submerged) {
    const andereLeben = (gs.players[pi]?.heroes || [])
      .some(h => h !== hero && h.name && h.hp > 0 && !h.buffs?.submerged);
    if (andereLeben) return 0;
  }
  if (!piercing.cannotBeNegated && hero.buffs?.magic_immune && entry.source?.name) {
    const cd = engine._getCardDB()[entry.source.name];
    if (cd?.cardType === 'Spell') {
      const stufe = hero.buffs.magic_immune.level;
      if (typeof stufe === 'number' && (cd.level || 0) <= stufe) {
        const srcScript = loadCardEffect(entry.source.name);
        if (!srcScript?.bypassesMagicImmune) return 0;
      }
    }
  }

  // Buff-Multiplikatoren — dieselbe Regel wie im Helden-Schadenspfad:
  // bei `cannotBeNegated` bleiben sie komplett aussen vor, bei
  // `cannotBeReduced` nur die verringernden (< 1). Das ist der Fall,
  // der bisher fehlte: `damage_immune` und `medusa_petrified` setzen
  // den Multiplikator auf 0 — der Schaden wird korrekt zu 0, die
  // Warnung behauptete trotzdem einen Tod.
  let ergebnis = amount;
  if (!piercing.cannotBeNegated && hero.buffs) {
    // Wie im Schadenspfad: der Multiplikator wird vom GESPEICHERTEN
    // Buff gelesen. `actionAddBuff` kopiert ihn beim Setzen aus
    // BUFF_EFFECTS, kann ihn aber per `opts` auch ueberschreiben — die
    // Definition ist deshalb nur der Rueckfall.
    const { BUFF_EFFECTS } = require('./_hooks');
    for (const [key, bd] of Object.entries(hero.buffs)) {
      const mul = (bd && typeof bd.damageMultiplier === 'number')
        ? bd.damageMultiplier
        : BUFF_EFFECTS?.[key]?.damageMultiplier;
      if (typeof mul !== 'number') continue;
      if (piercing.cannotBeReduced && mul < 1) continue;
      ergebnis = Math.ceil(ergebnis * mul);
    }
  }
  return Math.max(0, ergebnis);
}

module.exports = {
  activeIn: ['hero'],

  // Ohne diesen Abgriff beantwortet die CPU abbrechbare Confirms per
  // Default ablehnend und wuerde nie umleiten.
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic' || promptData?.type !== 'confirm') return undefined;
    if (promptData?.title !== CARD_NAME) return undefined;
    // Nur umleiten, solange Bubbles es ueberlebt — die CPU kann den
    // Tausch „Held stirbt, Kreatur lebt" nicht bewerten.
    const meta = promptData.bubblesMeta;
    if (!meta) return { confirmed: true };
    return { confirmed: meta.heroHp > meta.amount };
  },

  hooks: {
    beforeCreatureDamageBatch: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      if (!ps) return;

      const hero = ctx.attachedHero;
      const heroIdx = ctx.cardHeroIdx;
      if (!hero?.name || hero.hp <= 0) return;
      // Gesperrter Held leistet nichts — allgemeine CC-Regel.
      const st = hero.statuses || {};
      if (st.frozen || st.stunned || st.negated) return;

      for (const entry of (ctx.entries || [])) {
        if (!isRedirectable(entry)) continue;
        if (hero.hp <= 0) break;                       // unterwegs gefallen

        const amount = entry.amount || 0;
        const quelle = entry.source?.name || 'An effect';
        // Fremde Kreaturen mit dem NAMEN ihres Besitzers benennen, nicht
        // mit „Your opponent's" (Als Vorgabe 8.8.).
        const seite = entry.inst.controller ?? entry.inst.owner;
        const wessen = seite === pi
          ? 'Your'
          : `${gs.players[seite]?.username || 'The opponent'}'s`;
        // Toedlich? Nur, wenn der Schaden bei Bubbles auch ANKOMMT.
        // Waere er ohnehin geblockt, ist die rote Zeile eine Luege.
        const piercing = piercingOf(entry);
        const ankommend = predictedDamage(engine, hero, pi, entry, piercing);
        const toedlich = ankommend > 0 && ankommend >= hero.hp;

        const bestaetigt = await engine.promptGeneric(pi, {
          type: 'confirm',
          title: CARD_NAME,
          message: `${wessen} ${entry.inst.name} is about to take ${amount} damage from ${quelle}. Redirect all ${amount} damage to ${hero.name} (${hero.hp} HP)?`,
          // Links die betroffene Kreatur, rechts Bubbles selbst.
          showCardLeft: entry.inst.name,
          showCard: CARD_NAME,
          warning: toedlich ? `This will defeat ${hero.name.split(',')[0]}!` : undefined,
          confirmLabel: '🐰 Bounce it!',
          cancelLabel: 'No',
          cancellable: true,
          // Entscheidungsgrundlage fuer cpuResponse.
          bubblesMeta: { amount, heroHp: hero.hp, pi },
        });
        if (!bestaetigt || bestaetigt.cancelled) continue;

        entry.cancelled = true;

        engine._broadcastEvent('play_zone_animation', {
          type: 'shield_bubble', owner: pi, heroIdx, zoneSlot: -1,
        });
        await engine._delay(250);

        // VOLLER Betrag, ungedeckelt (Als Ruling). Die Piercing-
        // Eigenschaften des URSPRUNGS werden mitgenommen, nicht pauschal
        // gesetzt: war der Schaden un-negierbar, trifft er Bubbles auch
        // durch eine Magie-Immunitaet hindurch (Als Vorgabe 8.8.); war
        // er es nicht, gilt seine Immunitaet ganz normal. Vorher stand
        // hier ein fest verdrahtetes `cannotBeNegated: true` — das hat
        // gewoehnlichen Schaden faelschlich durchschlagen lassen.
        const syntheticSource = { ...(entry.source || {}), [REDIRECT_MARK]: true };
        if (piercing.trueDamage) {
          // Echter Schaden MUSS ueber seinen eigenen Weg laufen.
          // `actionDealDamage` mit gesetzten Flags ist NICHT dasselbe:
          // dort greifen Buff-Multiplikatoren und pauschale Sperren
          // weiter, und der umgeleitete Treffer kam als 0 an.
          await engine.actionDealTrueDamage(
            syntheticSource, hero, amount, { type: entry.type || 'other' },
          );
        } else {
          await engine.actionDealDamage(
            syntheticSource, hero, amount, entry.type || 'other',
            {
              cannotBeNegated: piercing.cannotBeNegated,
              cannotBeReduced: piercing.cannotBeReduced,
              // Der Betrag stand am urspruenglichen Ziel schon fest.
              // Ohne diese Angabe wenden quellenseitige
              // `beforeDamage`-Korrekturen sich ein zweites Mal an —
              // Ghuanjun machte aus 20 umgeleiteten Schaden 0 (Als
              // Befund 9.8.). Zielseitige Regeln greifen weiterhin.
              amountIsFinal: true,
              targetOwner: pi, targetHeroIdx: heroIdx,
            },
          );
        }

        engine.log('bubbles_redirect', {
          player: ps.username, from: entry.inst.name, to: hero.name,
          amount, damageType: entry.type || 'other',
          piercing: piercing.trueDamage ? 'true' : (piercing.cannotBeNegated || undefined),
          predicted: ankommend,
        });

        // „If this Hero is defeated by redirected damage, draw until you
        // have 7 cards in your hand." Nur DIESE Todesart zaehlt — der
        // Nachzug haengt deshalb direkt an der Umleitung.
        if (hero.hp <= 0) {
          const fehlend = Math.max(0, TARGET_HAND_SIZE - (ps.hand || []).length);
          engine.log('bubbles_defeated_by_redirect', {
            player: ps.username, handBefore: (ps.hand || []).length, draws: fehlend,
          });
          if (fehlend > 0) await engine.actionDrawCards(pi, fehlend);
          engine.sync();
          break;                                        // tot ist tot
        }
      }
      engine.sync();
    },
  },
};
