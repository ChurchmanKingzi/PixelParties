// COST-DISCARD-CHANNEL: n/a in dieser Datei — die Kosten („eine Karte
//   abwerfen, um das Juwel zu behalten") sitzen im geteilten Helfer
//   `_magic-gem-shared.js`, der den Kanal fuer alle sieben Gems
//   bedient (v1041).
// ═══════════════════════════════════════════
//  CARD EFFECT: "Magic Amethyst"
//  Artifact (Normal, Cost 10)
//
//  Choose a Hero your opponent controls. Your
//  opponent chooses an Ability attached to that
//  Hero and discards it.
//  You may discard a card from your hand to keep
//  this card in your hand. Once per turn.
// ═══════════════════════════════════════════

const { canPlayMagicGem, maybeKeepGemInHand } = require('./_magic-gem-shared');
const { opponentOfGs } = require('./_opp');

const CARD_NAME = 'Magic Amethyst';

/**
 * N5-12: Abilities in SUPPORT Zonen (Xal/Xalibur: echte Ability-Stapel; Cloak of Edge: "treated as an Ability") hängen genauso am Helden
 * (Engine-Konvention `collectSupportZoneAbilities`, Weird Doll/Fire Bomb/Idej Sword lesen sie) - Spielbarkeit, Ziel und Galerie zählen sie mit.
 */
function _supportAbilities(engine, oi, hi) {
  try { return engine?.collectSupportZoneAbilities?.(oi, hi) || []; } catch { return []; }
}

/**
 * „a Hero your opponent controls" = Kontrolle (`heroesControlledBy`, wie Magic Ruby/Cobalt/Arcane Lamp, W16e F02-08), nicht die Brettspalte: ein eigener, vom Gegner
 * kontrollierter Held ist wählbar, ein vom Wirker übernommener Held der Gegnerspalte nicht. `physOwner` = Brettseite (dort liegen Ability- und Support-Zonen).
 * Ohne Engine: die Spalte des Gegners.
 */
function _gegnerHelden(gs, pi, engine) {
  const oi = opponentOfGs(gs, pi);
  if (engine?.heroesControlledBy) return engine.heroesControlledBy(oi);
  return (gs.players[oi]?.heroes || []).map((hero, heroIdx) => ({ physOwner: oi, heroIdx, hero }));
}

/** True iff the opp hero at `hi` has at least 1 Ability stacked anywhere (Ability Zones oder Support Zonen). */
function _heroHasAbilities(ps, hi, engine, oi) {
  // v1375 (Love-Shot-Errata): die Ability-Karten eines TEMPORÄR gesteuerten Helden (Charme, Love Shot, Golden Apple) sind „unaffected by all effects" — es gibt dort nichts abzuwerfen.
  if (engine?.istTemporaerGesteuert?.(ps.heroes?.[hi])) return false;
  const zones = ps.abilityZones?.[hi] || [];
  for (const slot of zones) {
    if ((slot || []).length > 0) return true;
  }
  return _supportAbilities(engine, oi, hi).length > 0;
}

/**
 * Wie die oberste Ability des Stapels ANGEZEIGT wird: Performance sieht
 * aus wie die Ability darunter (Kopie). Zaehlt man mehrere Performance
 * uebereinander, gilt die naechste Nicht-Performance darunter.
 */
function _anzeigeName(slot) {
  let i = slot.length - 1;
  while (i > 0 && slot[i] === 'Performance') i--;
  return slot[i];
}

/** Build the abilityChoice gallery — one entry per top-of-stack ability. */
function _buildAbilityGallery(ps, hi, engine, oi) {
  const zones = ps.abilityZones?.[hi] || [];
  const out = [];
  for (let z = 0; z < zones.length; z++) {
    const slot = zones[z] || [];
    if (slot.length === 0) continue;
    // Top of stack — that's what gets discarded by an "ability discard"
    // step (mirrors Noble Mummy Guards' bounce behavior).
    // `name` = Anzeigename (Performance zeigt die kopierte Ability),
    // `realName` = die tatsaechlich oberste Karte. `source` traegt die
    // Zone (kommt in der Antwort zurueck, trennt gleich aussehende
    // Eintraege); `label` verhindert den irrefuehrenden „DECK"-Stempel.
    out.push({
      name: _anzeigeName(slot),
      realName: slot[slot.length - 1],
      source: `ability:${z}`,
      label: 'ABILITY',
      _zoneSlot: z,
      _stackHeight: slot.length,
    });
  }
  // N5-12: Abilities in Support Zonen (Quelle `support:<slot>`; bei einem Xal-Stapel vertritt die oberste Kopie den Stapel).
  for (const e of _supportAbilities(engine, oi, hi)) {
    out.push({
      name: e.cardName,
      realName: e.cardName,
      source: `support:${e.slotIdx}`,
      label: 'ABILITY',
      _supportInstId: e.inst?.id,   // nur die ID (die Galerie geht als JSON an den Client)
      _stackHeight: e.level,
    });
  }
  return out;
}

module.exports = {
  // ★ Welle 12 (B-06, Al: „Eine Karte, deren Effekt komplett nutzlos wäre, ist nicht spielbar."): trifft NUR den Gegner — gegen den durch die
  // Erste-Runden-Immunität geschützten Spieler unspielbar (Karte bleibt auf der Hand, keine Aktion/Kosten/Einmal-Stempel; `engine.ersterZugGeschuetzt`).
  blockedByFirstTurnProtection: true,
  // Gelockertes Commit (Al-Design-Update): Auch schwache Abilities
  // (Toughness) sind es wert, entfernt zu werden — Amethyst kann
  // GELOOPT werden: Eine schwache Removal jetzt heißt nächste Runde
  // eine stärkere. Committe deshalb, sobald irgendein lebender
  // Gegner-Held überhaupt Abilities trägt (sonst fizzlet der Resolve
  // ohnehin und das Gate darf sparen). Der abilityDependencyScore
  // bleibt für die ZIEL-Wahl im Target-Kanal relevant, nicht mehr
  // fürs Ob.
  cpuMeta: {
    alwaysCommit: (engine, pi) => {
      try {
        for (const { physOwner, heroIdx: hi, hero: h } of _gegnerHelden(engine.gs, pi, engine)) {   // Kontrolle, nicht Spalte (F02-08)
          if (!h?.name || h.hp <= 0 || engine.istTemporaerGesteuert(h)) continue;   // temporär gesteuert: Abilities unberührbar (v1375)
          const zones = engine.gs?.players?.[physOwner]?.abilityZones?.[hi];
          if (Array.isArray(zones)) {
            for (const z of zones) {
              if (Array.isArray(z) ? z.length > 0 : !!z) return true;
            }
          }
          if (_supportAbilities(engine, physOwner, hi).length > 0) return true;   // N5-12
        }
      } catch { /* konservativ: Gate entscheidet */ }
      return false;
    },
  },
  isTargetingArtifact: true,
  activeIn: ['hand'],

  canActivate(gs, pi, engine) {
    if (!canPlayMagicGem(gs, pi, CARD_NAME)) return false;
    // Need at least one opp hero with at least one ability to discard.
    for (const { physOwner, heroIdx: hi, hero: h } of _gegnerHelden(gs, pi, engine)) {
      if (!h?.name || h.hp <= 0) continue;
      if (_heroHasAbilities(gs.players[physOwner], hi, engine, physOwner)) return true;
    }
    return false;
  },

  // W16e-Linie (F02-08): „a Hero your opponent controls" = Kontrolle; die Ziel-IDs tragen die Brettseite des Helden.
  getValidTargets(gs, pi, engine) {
    const out = [];
    for (const { physOwner, heroIdx: hi, hero: h } of _gegnerHelden(gs, pi, engine)) {
      if (!h?.name || h.hp <= 0) continue;
      if (!_heroHasAbilities(gs.players[physOwner], hi, engine, physOwner)) continue;
      out.push({ id: `hero-${physOwner}-${hi}`, type: 'hero', owner: physOwner, heroIdx: hi, cardName: h.name });
    }
    return out;
  },

  targetingConfig: {
    description: 'Choose an opponent Hero. They discard one of its Abilities.',
    confirmLabel: '🔮 Choose',
    confirmClass: 'btn-info',
    cancellable: true,
    maxTotal: 1,
  },

  validateSelection(selectedIds) { return selectedIds.length === 1; },

  resolve: async (engine, pi, selectedIds) => {
    const id = (selectedIds || [])[0] || '';
    const m = id.match(/^hero-(\d+)-(\d+)$/);
    if (!m) return { keepInHand: false };
    const seite = parseInt(m[1]);   // Brettseite des Helden (dort liegen Ability- und Support-Zonen)
    const hi = parseInt(m[2]);
    const ops = engine.gs.players[seite];
    const zielHeld = ops?.heroes?.[hi];
    // Fizzle (CARD_API Z7b): ist das Ziel beim Auflösen kein Gegnerheld mehr, war die Karte trotzdem gespielt — Einmal-Stempel und Behalten-Angebot
    // wie beim Verpuffen ohne Abilities (unten); nur der Abbruch durch den Spieler stempelt nie.
    if (!zielHeld?.name) return await maybeKeepGemInHand(engine, pi, CARD_NAME);
    const oi = engine.heroSideOf(seite, zielHeld);   // Kontrolleur des Helden: er wählt die Ability (F02-08, Kontrolle statt Spalte)
    if (oi === pi) return await maybeKeepGemInHand(engine, pi, CARD_NAME);

    // Re-build the gallery at resolve time — the board state may have
    // shifted between target pick and resolve (rare via reactions).
    const gallery = _buildAbilityGallery(ops, hi, engine, seite);
    if (gallery.length === 0 || engine.istTemporaerGesteuert(zielHeld)) {   // v1375: Abilities eines temporär gesteuerten Helden sind unberührbar
      // No abilities left → silent fizzle on the main effect.
      return await maybeKeepGemInHand(engine, pi, CARD_NAME);
    }

    // W13 (Q144, Al: Resistance blockt JEDEN Nicht-Schaden-Effekt, fremden Ability-Abwurf ausdrücklich): der Effekt wählt den HELDEN und wirft eine seiner Abilities ab
    // (wie Memory Wipe) — einmal je Effekt fragen, bevor der Kontrolleur wählt. Geblockt: nichts wird abgeworfen; der Einmal-Einsatz der Karte zählt trotzdem als gewirkt.
    if (await engine.heroNonDamageEffectBlocked(seite, hi, 'ability_discard', { sourceOwner: pi, source: CARD_NAME })) {
      engine.log('magic_amethyst_blocked', { player: engine.gs.players[pi]?.username, hero: zielHeld.name });
      engine.sync();
      return await maybeKeepGemInHand(engine, pi, CARD_NAME);
    }

    // Prompt the OPPONENT to pick which Ability they sacrifice.
    // forceDiscard-style: not cancellable (the choice is forced once
    // the gem has been played and the hero has been targeted).
    const picked = await engine.promptGeneric(oi, {
      type: 'cardGallery',
      cards: gallery,
      title: CARD_NAME,
      description: `Your opponent's Magic Amethyst is targeting ${ops.heroes[hi]?.name}. Choose an Ability to discard.`,
      cancellable: false,
    });

    let chosen = picked?.cardName;
    let chosenSlot = -1;
    const _ausQuelle = /^ability:(\d+)$/.exec(picked?.source || '');
    const _ausSupport = /^support:(\d+)$/.exec(picked?.source || '');
    // Match by name → pick the matching gallery entry's _zoneSlot. If
    // the engine returned no choice (CPU defer / disconnect / etc.),
    // fall back to the LAST gallery entry — symmetric to the
    // Noble-Mummy-Guards "bounce a different ability" fallback so the
    // gem still does something meaningful.
    const entry = chosen
      ? ((_ausQuelle && gallery.find(g => g._zoneSlot === Number(_ausQuelle[1])))
        || (_ausSupport && gallery.find(g => g._supportInstId && g.source === `support:${_ausSupport[1]}`))
        || gallery.find(g => g.name === chosen))
      : gallery[gallery.length - 1];
    // N5-12: Ability aus einer Support Zone → der EINE Brett→Ablage-Weg (wie Weird Doll), die Ability Zones bleiben unberührt.
    if (entry?._supportInstId) {
      const sInst = engine.cardInstances.find(c => c.id === entry._supportInstId);
      if (sInst && sInst.zone === 'support') {
        await engine.sendBoardCardToDiscard(sInst, { source: { name: CARD_NAME, owner: pi } });
        engine.log('magic_amethyst_discard', {
          player: engine.gs.players[oi]?.username, ability: entry.realName, hero: ops.heroes[hi]?.name,
        });
        engine.sync();
      }
      return await maybeKeepGemInHand(engine, pi, CARD_NAME);
    }
    if (entry) {
      chosen = entry.realName;   // die tatsaechlich oberste Karte (bei Performance nicht der Anzeigename)
      chosenSlot = entry._zoneSlot;
    }

    if (chosen && chosenSlot >= 0) {
      const slotArr = ops.abilityZones[hi]?.[chosenSlot];
      if (slotArr && slotArr.length > 0 && slotArr[slotArr.length - 1] === chosen) {
        // Oberste Kopie über die EINE Brett→Ablage-Primitive (wie die Support-Zonen-Variante oben): sie fährt den Leave-Hook (Fighting nimmt seinen ATK-Bonus zurück),
        // untrackt die Karte, legt sie in die Ablage ihres BESITZERS (nicht der Spalte des Helden — „Verbotene Muster", CARD_API) und fragt die Leafagami Snake
        // (die Ability bleibt liegen, der Kontrolleur der Schlange zieht).
        const vorher = slotArr.length;
        await engine.discardAbilityTopCopy(
          { owner: seite, heroIdx: hi, slotIdx: chosenSlot, zoneKind: 'ability' },
          { source: { name: CARD_NAME, owner: pi }, sourceOwner: pi },
        );
        if (slotArr.length < vorher) {   // wirklich abgeworfen (nicht von der Leafagami Snake gehalten)
          await engine.runHooks('onDiscard', {
            playerIdx: oi, cardName: chosen, discardedCardName: chosen,
            _skipReactionCheck: true,
          });
          engine.log('magic_amethyst_discard', {
            player: engine.gs.players[oi]?.username, ability: chosen, hero: ops.heroes[hi]?.name,
          });
        }
        engine.sync();
      }
    }

    return await maybeKeepGemInHand(engine, pi, CARD_NAME);
  },
};
