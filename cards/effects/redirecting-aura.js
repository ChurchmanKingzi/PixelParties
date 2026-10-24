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
//  ── WANN? ───────────────────────────────────────────────────────────────
//  Die Aura meldet sich, wenn der Wirt von einem Effekt getroffen würde, der
//    • dem GEGNER gehört und ein Spell oder ein Creature-Effekt ist (`engine.sourceEffectKind`; Attacks, Helden-, Artefakt- und Potion-Effekte lösen nichts aus — der Text sagt „Spell or
//      Creature effect"); als Spell zählt auch eine Surprise-Karte dieses Typs und was die Engine sonst als Spell zählt;
//    • und für den es mindestens ein ANDERES eigenes Ziel gibt, an das er umgelenkt werden DARF.
//  „You may": der Kontrolleur wird gefragt (ja/nein), danach wählt er das neue Ziel unter allen Möglichkeiten (nur ein einziges → ohne Frage); diese Wahl ist Pflicht (die Zusage war die
//  Entscheidung, wie bei Lucky Puppet Laki). Die Aura ist KEINE Nutzungs-begrenzte Karte: jeder Treffer darf umgelenkt werden, so oft er kommt.
//
//  ── WOHIN? „any other target you control" — NUR LEGALE ZIELE ────────────
//  Die Möglichkeiten sind die Ziele, die DER umgelenkte Effekt überhaupt treffen darf (seine Zielliste `validTargets`, bei Flächeneffekten seine Trefferliste), die der Aura-Besitzer
//  kontrolliert (Helden und Kreaturen, beide Bretthälften, Kontrolle statt Seite), nicht das ursprüngliche Ziel sind, nicht ausgegraut/gesperrt (`ineligible`), nicht immun gegen den
//  Effekt und LEBEN. Daraus folgt alles Weitere von selbst:
//    • trifft ein Effekt nur Helden, bleibt es bei einem Helden; ein Effekt, der nur Kreaturen wählt, kann nur auf eine Kreatur gehen;
//    • Zielschutz („cannot be chosen" …) bleibt gültig — ein geschütztes Ziel steht gar nicht erst in der Liste;
//    • „even if that target was already hit by the same Spell/effect": ein Ziel, das der Effekt ohnehin trifft, bleibt eine Möglichkeit. Der Effekt trifft es dann ZWEIMAL.
//  Die neue Wahl wird ihrerseits „gewählt": die Umleiter des neuen Ziels dürfen ihrerseits reagieren (Kette, von der Engine bei 8 Stufen gedeckelt).
//
//  ── ZWEI WEGE ───────────────────────────────────────────────────────────
//  1. Effekte MIT Zielwahl (Brett-Wächter `isBoardRedirect`, Muster Lucky Puppet Laki): das Umleitungsfenster der Zielwahl fragt den Kontrolleur des gewählten Ziels
//     (`applyRedirectWindows` trägt bei Mehrfachwahl die ID des neuen Ziels ein zweites Mal ein → doppelter Treffer).
//  2. Flächeneffekte OHNE Zielwahl (Flame Avalanche „all targets your opponent controls", Armageddon …): jeder Treffer auf den Wirt ist umlenkbar. Die Engine fragt im zentralen Weg für
//     Mehrfachschaden (`dealDamageToTargets`, nur echte Flächenschläge `istFlaeche`) jede Brettkarte mit `onAoeRedirect` — hier die Aura. Der umgelenkte Treffer behält seinen Betrag und
//     fällt auf das neue Ziel (Held ODER Kreatur) ZUSÄTZLICH zu dessen eigenem Treffer; ein Status-Flächeneffekt (`wirkung`: Heat Wave, Iceage …) folgt der geänderten Trefferliste.
//     Die Möglichkeiten sind die Trefferliste des Effekts selbst („nur legale Ziele"): Flame Avalanche trifft alle Ziele des Gegners → alle anderen Ziele des Aura-Besitzers.
//
//  ── OVERHEAT UND ANDERE „ARTEFAKT-WAHL = TREFFER DES TRÄGERS" ───────────
//  Wählt ein Effekt ein Artefakt, dessen TRÄGER dadurch getroffen wird (Overheat: Artefakt ablegen, der Träger nimmt Schaden), kennzeichnet er die Zielwahl mit `hitsBearer: true`. Die
//  Aura reagiert dann auf die Wahl eines Artefakts, das am Wirt ausgerüstet ist, und lenkt auf ein Artefakt eines ANDEREN eigenen Helden um — der Effekt muss ja einen Helden mit
//  Ausrüstung treffen; die Zielliste des Effekts erzwingt das („redirect to another Hero with an Equip").
//
//  ── GRENZEN DES VERTRAGS ────────────────────────────────────────────────
//  „Cannot be redirected"-Effekte (Truth-Seeing Eye, `cannotBeRedirected`) und der Erste-Runden-Schutz sperren die Umleitung wie bei allen Umleitern. Reine Statuseffekte ohne
//  Trefferliste (die nicht über `dealDamageToTargets` laufen) lösen die Aura nicht aus.
//
//  ── Bild und Klang ──────────────────────────────────────────────────────
//  `play_zone_animation` `redirect_aura` (Pixelart, ANIM_REGISTRY): ein Ring wirbelt um den getroffenen Helden, ein Pixel-Komet fliegt mit Schweif zum neuen Ziel und schlägt dort ein.
//  Beim Anlegen kreist dieselbe Wirbelmarke einmal um den Wirt. Klänge in ZONE_ANIM_SFX; Log `redirecting_aura`.
// ═══════════════════════════════════════════

const { candidateHosts, attachToHero, attachmentHostsFor } = require('./_attachment-shared');

const CARD_NAME = 'Redirecting Aura';
const FLUG_MS = 1000;        // Länge der Animation (deckt sich mit `redirect_aura` im Client)
const FLUG_WARTE_MS = 760;   // bis der Komet eingeschlagen ist — dann darf der Effekt auf dem neuen Ziel auflösen
const WAHL_TEXT = 'Choose the target that is hit instead.';

function quelleIstGegner(sourceCard, ownerIdx) {
  if (!sourceCard) return false;
  const so = sourceCard.heroOwner ?? sourceCard.controller ?? sourceCard.owner;
  return typeof so === 'number' && so >= 0 && so !== ownerIdx;
}

/** Ist die Quelle ein gegnerischer Spell- oder Creature-Effekt? */
function passendeQuelle(engine, sourceCard, ownerIdx) {
  if (!quelleIstGegner(sourceCard, ownerIdx)) return false;
  const art = engine.sourceEffectKind(sourceCard);
  return art === 'spell' || art === 'creature';
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

/**
 * Alle Ziele, an die der Effekt umgelenkt werden darf: legal (in der Zielliste, nicht gesperrt), lebend, vom Aura-Besitzer kontrolliert, nicht das ursprüngliche Ziel.
 * `bearer`: Artefakt-Wahl, deren Träger getroffen wird (Overheat) — Möglichkeiten sind Artefakte ANDERER Helden des Besitzers (der Träger muss leben).
 */
function moeglichkeiten(engine, ownerIdx, selected, validTargets, bearer = false) {
  return (validTargets || []).filter(t => {
    if (!t || t.id === selected.id || t.ineligible) return false;
    if (bearer) {
      if (t.type !== 'equip') return false;
      if (t.owner === selected.owner && t.heroIdx === selected.heroIdx) return false;      // „ein ANDERER Held"
      const h = engine.gs.players[t.owner]?.heroes?.[t.heroIdx];
      if (!(h?.name && h.hp > 0)) return false;
    } else if (t.type !== 'hero' && t.type !== 'equip') return false;
    return engine.zielSeite(t) === ownerIdx && lebt(engine, t);
  });
}

/** Ein Trefferlisten-Eintrag der Engine (`dealDamageToTargets`) als Ziel-Eintrag der Zielwahl. */
function eintragAlsZiel(engine, e) {
  if (e.hero) return { id: `hero-${e.owner}-${e.heroIdx}`, type: 'hero', owner: e.owner, heroIdx: e.heroIdx, cardName: e.hero.name };
  const seite = engine.physicalSide(e.inst);
  return { id: `equip-${seite}-${e.inst.heroIdx}-${e.inst.zoneSlot}`, type: 'equip', owner: seite, heroIdx: e.inst.heroIdx, slotIdx: e.inst.zoneSlot, cardName: e.inst.name, cardInstance: e.inst };
}

/** Die Wahl des neuen Ziels unter `optionen` (nur eine → ohne Frage). Liefert das gewählte Ziel oder null. */
async function waehleZiel(engine, ownerIdx, optionen) {
  if (optionen.length === 1) return optionen[0];
  const r = await engine.promptEffectTarget(ownerIdx, optionen, {
    title: CARD_NAME, source: CARD_NAME,
    description: WAHL_TEXT,
    confirmLabel: '↪️ Redirect!', confirmClass: 'btn-info',
    cancellable: false, maxTotal: 1, minRequired: 1,   // pflichtwahl: „Redirect?“ war schon die Entscheidung; wie bei den anderen Umleitern (Lucky Puppet Laki) ist die Zielwahl danach Pflicht
    _skipRedirectCheck: true, _skipPostTargetReactions: true, ignoreUntargetable: true,   // die Liste ist schon die Liste der legalen Ziele des Effekts
  });
  const id = Array.isArray(r) ? r[0] : r;
  return (id && optionen.find(t => t.id === id)) || null;
}

/** Ansage, Bild und Log einer vollzogenen Umleitung. */
async function zeigeUmleitung(engine, ownerIdx, von, nach, quelleName) {
  await engine.showTriggeredEffect(CARD_NAME, { playerIdx: ownerIdx });
  engine._broadcastEvent('play_zone_animation', {
    type: 'redirect_aura', zoneType: 'board', owner: nach.owner, heroIdx: -1, zoneSlot: -1, duration: FLUG_MS,
    targets: [{ owner: nach.owner, heroIdx: nach.heroIdx, zoneSlot: nach.type === 'hero' ? -1 : nach.slotIdx }],
    originOwner: von.owner, originHeroIdx: von.heroIdx, originZoneSlot: -1,
  });
  await engine._delay(FLUG_WARTE_MS);
  engine.log('redirecting_aura', {
    player: engine.gs.players[ownerIdx]?.username, from: von.cardName, to: nach.cardName, source: quelleName || null,
  });
  engine.sync();
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

  // ── Weg 1: Umleitung der Zielwahl (Brett-Wächter) ────────────────────
  isBoardRedirect: true,
  boardRedirectPrompt(attackerName, selected) {
    return `${attackerName} would hit ${selected?.cardName || 'your Hero'}. Redirect the hit to another target you control?`;
  },

  canBoardRedirect(gs, ownerIdx, inst, selected, validTargets, config, sourceCard, engine) {
    if (!inst || inst.zone !== 'support' || inst.faceDown) return false;
    if (!selected) return false;
    const bearer = !!config?.hitsBearer && selected.type === 'equip';
    if (!bearer && selected.type !== 'hero') return false;
    if (selected.owner !== inst.owner || selected.heroIdx !== inst.heroIdx) return false;      // „that Hero": der Wirt (bzw. sein Artefakt)
    if (!passendeQuelle(engine, sourceCard, ownerIdx)) return false;
    return moeglichkeiten(engine, ownerIdx, selected, validTargets, bearer).length > 0;
  },

  async onBoardRedirect(engine, ownerIdx, inst, selected, validTargets, config, sourceCard) {
    const bearer = !!config?.hitsBearer && selected.type === 'equip';
    const optionen = moeglichkeiten(engine, ownerIdx, selected, validTargets, bearer);
    if (optionen.length === 0) return null;
    const pick = await waehleZiel(engine, ownerIdx, optionen);
    if (!pick) return null;
    await zeigeUmleitung(engine, ownerIdx, selected, pick, sourceCard?.name);
    return { redirectTo: pick };
  },

  // ── Weg 2: Umleitung eines Treffers im Flächenschlag (Engine: `_aoeUmleitungen`) ──
  /**
   * @param eintrag    der Treffer auf den Wirt: Helden-Eintrag `{ hero, heroIdx, owner, amount }`
   * @param kandidaten die tatsächlich getroffenen anderen Einträge der Trefferliste (Helden `{ hero, … }` und Kreaturen `{ inst, … }`)
   * @returns den gewählten Kandidaten-Eintrag oder null („No")
   */
  async onAoeRedirect(engine, inst, eintrag, kandidaten, ctx) {
    const ziel = eintragAlsZiel(engine, eintrag);
    const ownerIdx = engine.zielSeite(ziel);
    if (!passendeQuelle(engine, ctx.quelle, ownerIdx)) return null;
    const moegliche = kandidaten.filter(e => engine.zielSeite(eintragAlsZiel(engine, e)) === ownerIdx);
    if (moegliche.length === 0) return null;
    // Je Ziel ein Eintrag in der Wahl (ein schon doppelt getroffenes Ziel erscheint einmal); das Zurückmappen nimmt den ersten passenden Eintrag.
    const optionen = [];
    for (const e of moegliche) {
      const z = eintragAlsZiel(engine, e);
      if (!optionen.some(o => o.id === z.id)) optionen.push({ ...z, _eintrag: e });
    }
    const quelleName = ctx.quelle?.name || null;
    const ja = await engine.promptGeneric(ownerIdx, {
      type: 'confirm',
      title: CARD_NAME,
      message: module.exports.boardRedirectPrompt(quelleName || 'An effect', ziel),
      showCard: quelleName,
      showCardLeft: CARD_NAME,
      confirmLabel: '↪️ Redirect!',
      cancelLabel: 'No',
      cancellable: true,
    });
    if (!engine._confirmSaidYes(ja)) return null;
    const pick = await waehleZiel(engine, ownerIdx, optionen);
    if (!pick) return null;
    await zeigeUmleitung(engine, ownerIdx, ziel, pick, quelleName);
    return pick._eintrag;
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
        type: 'redirect_aura', zoneType: 'board', owner: host.owner, heroIdx: -1, zoneSlot: -1, duration: FLUG_MS,
        targets: [{ owner: host.owner, heroIdx: host.heroIdx, zoneSlot: -1 }],
        originOwner: host.owner, originHeroIdx: host.heroIdx, originZoneSlot: -1,
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
    if (config?.description === WAHL_TEXT) {
      if (frei.length === 0) return [];
      return [frei.slice().sort((a, b) => hpVon(engine, b) - hpVon(engine, a))[0].id];
    }
    return undefined;
  },
};
