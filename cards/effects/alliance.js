// ═══════════════════════════════════════════
//  CARD EFFECT: "Alliance"
//  Attack (Fighting Lv0, Subtyp Attachment)
//
//  „Attach this card to the user and choose a Hero your opponent
//   controls. That Hero and the user cannot choose each other as
//   targets of Attacks and Spells, except Support Magic Spells, while
//   there are other possible targets on the board. If all other Heroes
//   you control cannot be chosen or damaged by an Attack or Spell,
//   ignore this effect. At the end of your turn, you may send this card
//   attached to a Hero you control to the discard pile."
//
//  ── VERWANDT MIT STEALTH ──────────────────────────────────────────
//  Beide sind Zielverbote mit Anti-Sperr-Klausel. Stealth haengt am
//  ZIEL (die Ability liegt beim geschuetzten Helden) und kommt deshalb
//  mit dem Vertrag `blocksTargeting` aus. Alliance regelt eine
//  BEZIEHUNG zwischen zwei Helden und verbietet die Wahl in BEIDE
//  Richtungen — auch die des eigenen Nutzers auf den Verbuendeten, wo
//  die Karte gar nicht liegt. Dafuer gibt es seit v870 den zweiten
//  Vertrag `blocksTargetingAnywhere`: die Engine fragt ihn auf jeder
//  getrackten Karte, die ihn fuehrt, unabhaengig davon, wo sie liegt.
//
//  ── DIE DREI SCHRANKEN ────────────────────────────────────────────
//  1) Nur Attacks und Spells. Kreaturen-, Artefakt- und Heldeneffekte
//     bleiben frei, und Support-Magic-Spells sind ausdruecklich
//     ausgenommen (auch halbe: `hasSpellSchool` liest beide Felder).
//  2) „while there are other possible targets on the board" — gibt es
//     kein anderes waehlbares Ziel, faellt das Verbot weg. Gezaehlt
//     werden HELDEN UND CREATURES beider Seiten, denn der Text sagt
//     „targets", nicht „Heroes".
//  3) „If all other Heroes you control cannot be chosen or damaged"
//     — die Anti-Sperr-Klausel des NUTZERS: hat er keinen weiteren
//     Helden, der von dieser Quelle gewaehlt werden koennte, gilt das
//     Verbot gar nicht. Sonst koennte man sich hinter der Allianz
//     verstecken.
//
//  ── ANZEIGE (Als Vorgabe) ─────────────────────────────────────────
//  Der Server veroeffentlicht die Verbindung als `allianceLinks`; der
//  Client haengt daran zwei Dinge: das Abzeichen „Allied with <Held>"
//  am verbuendeten GEGNER-Helden und die Hervorhebung BEIDER Helden,
//  solange der Zeiger auf der Alliance-Karte steht — auch wenn einer
//  der beiden inzwischen besiegt ist.
//
//  ── ABWURF ────────────────────────────────────────────────────────
//  „At the end of your turn, you may send this card … to the discard
//   pile." — Rueckfrage am eigenen Zugende, freiwillig.
// ═══════════════════════════════════════════

const { hasCardType, hasSpellSchool } = require('./_hooks');
const { attachmentHostsFor, attachToHero } = require('./_attachment-shared');

const CARD_NAME = 'Alliance';

/** Die Verbindung dieser Instanz: { owner, heroIdx } des Verbuendeten. */
function verbuendeter(inst) {
  const c = inst?.counters || {};
  if (c.allyOwner == null || c.allyHeroIdx == null) return null;
  return { owner: c.allyOwner, heroIdx: c.allyHeroIdx };
}

/** Deckt das Verbot diese Quelle ab? Attacks/Spells, aber kein Support. */
function quelleBetroffen(info) {
  const cd = info.sourceData;
  if (!cd) return false;
  if (!(hasCardType(cd, 'Attack') || hasCardType(cd, 'Spell'))) return false;
  if (hasSpellSchool(cd, 'Support Magic')) return false;   // ausdruecklich ausgenommen
  return true;
}

/**
 * „while there are other possible targets on the board" — gemeint sind
 * die LEGALEN Ziele DIESER Quelle (Als Klarstellung 11.9.): trifft die
 * Attack oder der Spell nur Helden, sind Creatures keine Alternative,
 * und der letzte verbleibende Held muss waehlbar bleiben, egal wie
 * viele Creatures herumstehen.
 *
 * Die Liste kommt seit v871 als `info.allTargets` aus dem Zielfilter —
 * also genau das, was die Engine fuer diese Karte zusammengestellt hat.
 * Der Brett-Scan darunter ist nur der Rueckfall fuer Aufrufer, die die
 * Liste (noch) nicht mitgeben; er zaehlt dann Helden UND Creatures, wie
 * es der Kartentext im allgemeinen Fall meint.
 */
function andereZieleVorhanden(engine, a, b, info) {
  const istEinerDerBeiden = (owner, hi) =>
    (owner === a.owner && hi === a.heroIdx) || (owner === b.owner && hi === b.heroIdx);

  if (Array.isArray(info?.allTargets)) {
    for (const t of info.allTargets) {
      if (t?.ineligible) continue;                       // schon anderweitig gesperrt
      if (t?.type === 'hero') {
        if (istEinerDerBeiden(t.owner, t.heroIdx)) continue;
        return true;
      }
      return true;   // Creature, Slot, Handkarte — irgendein anderes Ziel
    }
    return false;
  }

  const gs = engine.gs;
  const cardDB = engine._getCardDB();
  for (let pi = 0; pi < 2; pi++) {
    const ps = gs.players[pi];
    for (let hi = 0; hi < (ps?.heroes || []).length; hi++) {
      const h = ps.heroes[hi];
      if (!h?.name || h.hp <= 0) continue;
      if (istEinerDerBeiden(pi, hi)) continue;
      return true;
    }
  }
  for (const inst of engine.cardInstances) {
    if (inst.zone !== 'support' || inst.faceDown) continue;
    if (inst.counters?.treatAsEquip) continue;
    const cd = engine.getEffectiveCardData(inst) || cardDB[inst.name];
    if (cd && hasCardType(cd, 'Creature')) return true;
  }
  return false;
}

/**
 * Anti-Sperr-Klausel: hat der NUTZER noch einen anderen Helden, den
 * diese Quelle waehlen koennte? Wenn nicht, gilt das Verbot nicht.
 */
function nutzerHatAndereWaehlbare(engine, nutzer) {
  const ps = engine.gs.players[nutzer.owner];
  for (let hi = 0; hi < (ps?.heroes || []).length; hi++) {
    if (hi === nutzer.heroIdx) continue;
    const h = ps.heroes[hi];
    if (!h?.name || h.hp <= 0) continue;
    if (h.statuses?.untargetable || h.statuses?.invisible) continue;
    if (h.buffs?.damage_immune) continue;
    return true;
  }
  return false;
}

module.exports = {
  activeIn: ['hand', 'support'],

  /** Zonen fuer das Ziehen (siehe CARD_API, „Gezogene Zone gewinnt"). */
  attachmentHosts(gs, pi, engine) { return attachmentHostsFor(gs, pi, engine); },

  spellPlayCondition(gs, playerIdx, engine) {
    if (!engine) return true;
    if (attachmentHostsFor(gs, playerIdx, engine).length === 0) return false;
    // Es muss einen waehlbaren gegnerischen Helden geben.
    const oi = playerIdx === 0 ? 1 : 0;
    if (gs.firstTurnProtectedPlayer === oi) return false;
    return (gs.players[oi]?.heroes || []).some(h => h?.name && h.hp > 0);
  },

  /**
   * ★ Der zweite Zielvertrag (v870). Gefragt wird diese Instanz fuer
   * JEDES Ziel — sie entscheidet selbst, ob die Beziehung passt.
   */
  blocksTargetingAnywhere(gs, engine, info, inst) {
    if (info._truthSeeingEye || info.ignoreUntargetable) return false;
    if (inst.zone !== 'support') return false;
    const ally = verbuendeter(inst);
    if (!ally) return false;
    const nutzer = { owner: inst.controller ?? inst.owner, heroIdx: inst.heroIdx };
    if (!quelleBetroffen(info)) return false;

    // Betrifft die Wahl genau dieses Paar — in einer der beiden
    // Richtungen?
    const zielIstNutzer = info.heroOwner === nutzer.owner && info.heroIdx === nutzer.heroIdx;
    const zielIstAlly   = info.heroOwner === ally.owner   && info.heroIdx === ally.heroIdx;
    const waehlerIstNutzer = info.chooserIdx === nutzer.owner && info.chooserHeroIdx === nutzer.heroIdx;
    const waehlerIstAlly   = info.chooserIdx === ally.owner   && info.chooserHeroIdx === ally.heroIdx;
    const paar = (zielIstNutzer && waehlerIstAlly) || (zielIstAlly && waehlerIstNutzer);
    if (!paar) return false;

    if (!andereZieleVorhanden(engine, nutzer, ally, info)) return false;   // Schranke 2
    if (!nutzerHatAndereWaehlbare(engine, nutzer)) return false;     // Schranke 3
    return true;
  },

  hooks: {
    onPlay: async (ctx) => {
      if (ctx.cardZone !== 'hand' || ctx.playedCard?.id !== ctx.card.id) return;
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const oi = pi === 0 ? 1 : 0;

      // „Attach this card to the user" — nur der Wirker-Held.
      const res = await attachToHero(ctx, CARD_NAME, {
        preferCaster: true, heroFilter: (h, hi) => hi === ctx.cardHeroIdx,
        description: 'Attach Alliance to the Hero that used it.',
        confirmLabel: '🤝 Attach!', animationType: 'gold_sparkle',
      });
      if (!res) return;
      const { host, inst } = res;

      // „choose a Hero your opponent controls"
      const kandidaten = [];
      for (let hi = 0; hi < (gs.players[oi]?.heroes || []).length; hi++) {
        const h = gs.players[oi].heroes[hi];
        if (!h?.name || h.hp <= 0) continue;
        kandidaten.push({ id: `hero-${oi}-${hi}`, type: 'hero', owner: oi, heroIdx: hi, cardName: h.name });
      }
      if (kandidaten.length === 0) return;

      let wahl = kandidaten[0];
      if (kandidaten.length > 1) {
        const ids = await engine.promptEffectTarget(pi, kandidaten, {
          maxTotal: 1,   // Einfachauswahl: ein Klick TAUSCHT das Ziel
          title: CARD_NAME,
          description: "Choose the opponent's Hero to ally with. You two cannot choose each other with Attacks or non-Support Spells.",
          confirmLabel: '🤝 Ally',
          cancellable: false,
          sourceCard: CARD_NAME,
          _skipPostTargetReactions: true,
        });
        wahl = kandidaten.find(k => k.id === ids?.[0]) || kandidaten[0];
      }

      inst.counters.allyOwner = wahl.owner;
      inst.counters.allyHeroIdx = wahl.heroIdx;
      // Anzeige-Spiegel (Abzeichen + Hover-Hervorhebung, siehe Kopf).
      inst.counters.buffs = inst.counters.buffs || {};
      inst.counters.buffs.alliance = { with: wahl.cardName };

      engine.log('alliance_formed', {
        player: gs.players[pi]?.username,
        user: gs.players[host.owner]?.heroes?.[host.heroIdx]?.name,
        ally: wahl.cardName, allyOwner: gs.players[wahl.owner]?.username,
      });
      engine._broadcastEvent('play_zone_animation', {
        type: 'gold_sparkle', owner: wahl.owner, heroIdx: wahl.heroIdx, zoneSlot: -1,
      });
      engine.sync();
    },

    // „At the end of your turn, you may send this card … to the discard
    //  pile." Freiwillig, nur am eigenen Zugende, nur fuer den
    //  Kontrolleur der Karte.
    onTurnEnd: async (ctx) => {
      const engine = ctx._engine;
      const inst = ctx.card;
      if (!inst || inst.zone !== 'support') return;
      const owner = inst.controller ?? inst.owner;
      if (engine.gs.activePlayer !== owner) return;
      const ja = await engine.promptGeneric(owner, {
        type: 'confirm',
        title: CARD_NAME,
        showCard: CARD_NAME,
        message: 'Send Alliance to the discard pile?',
        confirmLabel: '🗑️ Discard', cancelLabel: 'Keep',
        cancellable: true,
      });
      if (!ja) return;
      await engine.actionDestroyCard({ name: CARD_NAME, owner, controller: owner }, inst);
      engine.log('alliance_ended', { player: engine.gs.players[owner]?.username });
      engine.sync();
    },
  },

  // Die CPU behaelt die Karte (das Verbot schuetzt sie ja) und waehlt
  // beim Verbuendeten den ersten Kandidaten.
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic') return undefined;
    if (promptData?.type === 'confirm') return { confirmed: false };
    return undefined;
  },
};
