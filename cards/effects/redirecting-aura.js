'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Redirecting Aura"
//  Spell (Magic Arts Lv3, Attachment)
//
//  „Attach this card to a Hero you control. When that Hero would be hit by an opponent's Spell or Creature effect, you may redirect that hit to any other target you control (even if that
//   target was already hit by the same Spell/effect)."
//
//  ── ANLEGEN ─────────────────────────────────────────────────────────────
//  An einen Helden, den der Wirker kontrolliert (Kontrolle zählt, nicht die Brettseite) und der eine freie Support Zone hat (`attachToHero`, Baustein der Anhängsel). Ohne einen solchen
//  Helden ist die Karte grau. Mehrere Auren am selben Helden sind erlaubt (jede darf einmal je Treffer umlenken, der Treffer ist danach ja ein anderer).
//
//  ── DIE UMLEITUNG (Brett-Wächter, `isBoardRedirect`, Muster Lucky Puppet Laki / Empty Armor) ──
//  Das Umleitungsfenster der Zielwahl (`_checkTargetRedirect`) fragt den Kontrolleur des gewählten Ziels. Die Aura meldet sich, wenn
//    • das gewählte Ziel DER Held ist, an dem sie hängt;
//    • die Quelle dem GEGNER gehört und ein Spell oder ein Creature-Effekt ist (`engine.sourceEffectKind`; Attacks, Helden-, Artefakt- und Potion-Effekte lösen nichts aus — der Text sagt
//      „Spell or Creature effect"); als Spell zählt auch eine Surprise-Karte dieses Typs und was die Engine sonst als Spell zählt;
//    • es mindestens ein ANDERES eigenes Ziel gibt, an das der Effekt umgelenkt werden DARF.
//  „You may": der Kontrolleur wird gefragt (ja/nein), danach wählt er das neue Ziel unter allen Möglichkeiten (nur ein einziges → ohne Frage); diese Wahl ist Pflicht (die Zusage war die Entscheidung, wie bei Lucky Puppet Laki).
//  Die Aura ist KEINE Nutzungs-begrenzte Karte: jeder Treffer darf umgelenkt werden, so oft er kommt.
//
//  ── WOHIN? „any other target you control" — NUR LEGALE ZIELE ────────────
//  Die Möglichkeiten sind die Einträge der Zielliste DES umgelenkten Effekts (`validTargets`), die der Aura-Besitzer kontrolliert (Helden und Kreaturen, beide Bretthälften, Kontrolle statt
//  Seite), nicht das ursprüngliche Ziel sind, nicht ausgegraut/gesperrt (`ineligible`) und LEBEN. Daraus folgt alles Weitere von selbst:
//    • trifft ein Effekt nur Helden, bleibt es bei einem Helden; ein Effekt, der nur Kreaturen wählt, kann nur auf eine Kreatur gehen;
//    • Zielschutz („cannot be chosen" …) bleibt gültig — ein geschütztes Ziel steht gar nicht erst in der Liste;
//    • „even if that target was already hit by the same Spell/effect": ein Ziel, das der Effekt ohnehin trifft, bleibt eine Möglichkeit. Die Treffer ZÄHLEN dann doppelt — die Umleitungs-
//      Auswertung der Engine (`applyRedirectWindows`) trägt die Ziel-ID einfach ein zweites Mal ein, der Effekt trifft das Ziel entsprechend zweimal (Beispiel: Flame Avalanche).
//  Die neue Wahl wird ihrerseits „gewählt": die Umleiter des neuen Ziels dürfen ihrerseits reagieren (Kette, von der Engine bei 8 Stufen gedeckelt).
//
//  ── GRENZEN DES VERTRAGS ────────────────────────────────────────────────
//  Wie bei allen Umleitern greift die Aura nur dort, wo der Effekt das Ziel WÄHLT (Zielwahl-Fenster; auch jeder Einzeltreffer einer Kette gilt als Wahl, `engine.trefferAlsWahl`). Flächen-
//  schaden ohne Wahl löst nichts aus. „Cannot be redirected"-Effekte (Truth-Seeing Eye, `cannotBeRedirected`) und der Erste-Runden-Schutz sperren die Umleitung wie bei allen Umleitern.
//
//  ── Bild und Klang ──────────────────────────────────────────────────────
//  `play_zone_animation` `redirect_aura` (Pixelart, ANIM_REGISTRY): ein Ring wirbelt um den getroffenen Helden, ein Pixel-Komet fliegt mit Schweif zum neuen Ziel und schlägt dort ein.
//  Beim Anlegen kreist dieselbe Wirbelmarke einmal um den Wirt. Klänge in ZONE_ANIM_SFX; Log `redirecting_aura`.
// ═══════════════════════════════════════════

const { candidateHosts, attachToHero, attachmentHostsFor } = require('./_attachment-shared');

const CARD_NAME = 'Redirecting Aura';
const FLUG_MS = 1000;        // Länge der Animation (deckt sich mit `redirect_aura` im Client)
const FLUG_WARTE_MS = 760;   // bis der Komet eingeschlagen ist — dann darf der Effekt auf dem neuen Ziel auflösen

function quelleIstGegner(sourceCard, ownerIdx) {
  if (!sourceCard) return false;
  const so = sourceCard.heroOwner ?? sourceCard.controller ?? sourceCard.owner;
  return typeof so === 'number' && so >= 0 && so !== ownerIdx;
}

/** Lebt dieses Ziel (und steht es noch auf dem Brett)? */
function lebt(engine, t) {
  if (t.type === 'hero') {
    const h = engine.gs.players[t.owner]?.heroes?.[t.heroIdx];
    return !!(h?.name && h.hp > 0);
  }
  const inst = t.cardInstance || t._cardInstance;
  if (!inst) return true;   // Eintrag ohne Instanz (Altlisten): die Engine prüft beim Auflösen
  if (inst.zone !== 'support') return false;
  const hp = inst.counters?.currentHp;
  return !(typeof hp === 'number' && hp <= 0);
}

/** Alle Ziele, an die der Effekt umgelenkt werden darf: legal (in der Zielliste, nicht gesperrt), lebend, vom Aura-Besitzer kontrolliert, nicht das ursprüngliche Ziel. */
function moeglichkeiten(engine, ownerIdx, selected, validTargets) {
  return (validTargets || []).filter(t => t
    && (t.type === 'hero' || t.type === 'equip')
    && t.id !== selected.id
    && !t.ineligible
    && engine.zielSeite(t) === ownerIdx
    && lebt(engine, t));
}

/** Aktuelle HP eines Ziels (für die CPU-Wahl). */
function hpVon(engine, t) {
  if (t.type === 'hero') return engine.gs.players[t.owner]?.heroes?.[t.heroIdx]?.hp || 0;
  return (t.cardInstance || t._cardInstance)?.counters?.currentHp || 0;
}

module.exports = {
  activeIn: ['hand', 'support'],

  // ★★ v1181 — ENTKOPPELTE ZAUBERBILDER: wird der Zauber NEGIERT, spielt die Engine diese Bilder trotzdem.
  spellVisual: { impact: { type: 'redirect_aura' }, impactMs: 420 },

  spellPlayCondition(gs, pi, engine) {
    const eng = engine || gs._engineRef;
    if (!eng) return true;
    return candidateHosts(gs, pi, eng).length > 0;
  },
  attachmentHosts(gs, pi, engine) {
    return attachmentHostsFor(gs, pi, engine);
  },

  // ── Umleitung (Brett-Wächter) ────────────────────────────────────────
  isBoardRedirect: true,
  boardRedirectPrompt(attackerName, selected) {
    return `${attackerName} would hit ${selected?.cardName || 'your Hero'}. Redirect the hit to another target you control?`;
  },

  canBoardRedirect(gs, ownerIdx, inst, selected, validTargets, config, sourceCard, engine) {
    if (!inst || inst.zone !== 'support' || inst.faceDown) return false;
    if (!selected || selected.type !== 'hero') return false;
    if (selected.owner !== inst.owner || selected.heroIdx !== inst.heroIdx) return false;      // „that Hero": der Wirt
    if (!quelleIstGegner(sourceCard, ownerIdx)) return false;
    const art = engine.sourceEffectKind(sourceCard);
    if (art !== 'spell' && art !== 'creature') return false;
    return moeglichkeiten(engine, ownerIdx, selected, validTargets).length > 0;
  },

  async onBoardRedirect(engine, ownerIdx, inst, selected, validTargets, config, sourceCard) {
    const optionen = moeglichkeiten(engine, ownerIdx, selected, validTargets);
    if (optionen.length === 0) return null;
    let pick = null;
    if (optionen.length === 1) {
      pick = optionen[0];
    } else {
      const r = await engine.promptEffectTarget(ownerIdx, optionen, {
        title: CARD_NAME, source: CARD_NAME,
        description: 'Choose the target that is hit instead.',
        confirmLabel: '↪️ Redirect!', confirmClass: 'btn-info',
        cancellable: false, maxTotal: 1, minRequired: 1,   // pflichtwahl: „Redirect?“ war schon die Entscheidung; wie bei den anderen Umleitern (Lucky Puppet Laki) ist die Zielwahl danach Pflicht
        _skipRedirectCheck: true, _skipPostTargetReactions: true, ignoreUntargetable: true,   // die Liste ist schon die Liste der legalen Ziele des Effekts
      });
      const id = Array.isArray(r) ? r[0] : r;
      if (!id) return null;                                                                      // „doch nicht"
      pick = optionen.find(t => t.id === id) || null;
    }
    if (!pick) return null;

    await engine.showTriggeredEffect(CARD_NAME, { playerIdx: ownerIdx });
    engine._broadcastEvent('play_zone_animation', {
      type: 'redirect_aura', owner: pick.owner, heroIdx: pick.heroIdx, zoneSlot: pick.type === 'hero' ? -1 : pick.slotIdx, duration: FLUG_MS,
      originOwner: selected.owner, originHeroIdx: selected.heroIdx, originZoneSlot: -1,
    });
    await engine._delay(FLUG_WARTE_MS);
    engine.log('redirecting_aura', {
      player: engine.gs.players[ownerIdx]?.username, from: selected.cardName, to: pick.cardName, source: sourceCard?.name || null,
    });
    engine.sync();
    return { redirectTo: pick };
  },

  hooks: {
    onPlay: async (ctx) => {
      if (ctx.cardZone !== 'hand') return;
      if (ctx.playedCard?.id !== ctx.card.id) return;
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const res = await attachToHero(ctx, CARD_NAME, {
        description: 'Attach Redirecting Aura to a Hero you control. When that Hero would be hit by an opponent\'s Spell or Creature effect, you may redirect the hit to another target you control.',
        confirmLabel: '↪️ Attach!', skipEnterHook: true,
      });
      if (!res) return;
      const { host, inst } = res;
      const hero = gs.players[host.owner]?.heroes?.[host.heroIdx];

      engine._broadcastEvent('play_zone_animation', {
        type: 'redirect_aura', owner: host.owner, heroIdx: host.heroIdx, zoneSlot: -1, duration: FLUG_MS,
      });
      await engine._delay(520);

      await engine.runHooks('onCardEnterZone', {
        enteringCard: inst, toZone: 'support', toHeroIdx: host.heroIdx,
        _skipReactionCheck: true, _anhaengselAnleger: pi,
      });
      engine.log('redirecting_aura_attached', { player: gs.players[pi]?.username, hero: hero?.name });
      engine.sync();
    },
  },

  /** CPU: die Umleitung nimmt sie immer an; als neues Ziel das mit den meisten HP (es trägt den Treffer am besten). */
  cpuResponse(engine, kind, promptData) {
    if (kind === 'generic' && promptData?.type === 'confirm' && promptData.title === CARD_NAME) return { confirmed: true };
    if (kind !== 'effectTarget') return undefined;
    const { validTargets, config } = promptData || {};
    if (!Array.isArray(validTargets)) return undefined;
    const frei = validTargets.filter(t => !t.ineligible);
    if (config?.description === 'Choose the target that is hit instead.') {
      if (frei.length === 0) return [];
      return [frei.slice().sort((a, b) => hpVon(engine, b) - hpVon(engine, a))[0].id];
    }
    return undefined;
  },
};
