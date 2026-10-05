// ═══════════════════════════════════════════
//  CARD EFFECT: "Quest of the Chosen One"
//  Spell (Magic Arts Lv 0, Attachment)
//
//  "Attach this card to a Hero you control. You may send all Abilities
//   attached to the target to the discard pile (min 1) to make this
//   count as an additional Action. Whenever you attach 1 or more
//   Abilities to this Hero, you may draw up to that many cards. You
//   cannot draw more than 3 cards per turn with this effect."
//
//  ── ALS VORGABE 5.10. ───────────────────────────────────────────
//  • „Ziel" = der Held, an dem das Anhängsel hängt. Die Kosten (ALLE
//    Abilities dieses Helden in die Ablage, mindestens eine) machen den
//    Einsatz zur inhärenten Zusatzaktion.
//  • Wird die Karte durch einen anderen Effekt gespielt (Chaos-Diamond,
//    Yukana … = Sofort-Guss, `gs._immediateActionContext`), ist sie schon
//    die Zusatzaktion — dann KEINE Kosten und keine Frage. Dasselbe gilt,
//    wenn ein passender externer Zusatzaktions-Geber sie bezahlt.
//  • Wird sie in der Action Phase von der Hand gespielt und die
//    Hauptaktion ist frei, wird der Spieler GEFRAGT („Zusatzaktion gegen
//    alle Abilities — oder normale Aktion?"), sofern das Ziel mindestens
//    eine Ability trägt. „Nein" (oder keine Ability) = normale Aktion,
//    nichts wird abgeworfen (`gs._spellForcesActionConsume`, Curse-Vertrag).
//  • Ist keine Aktion frei (Main Phase, Aktion schon verbraucht, kein
//    Geber), ist die Zusatzaktion der EINZIGE Weg: Pflicht-Kosten, und es
//    kommen nur Helden mit mindestens einer Ability als Ziel in Frage.
//
//  ── ZIEH-TRIGGER ─────────────────────────────────────────────────
//  Jedes Anlegen einer Ability an den Wirt (`onCardEnterZone`,
//  `toZone === 'ability'`) erlaubt, eine Karte zu ziehen — höchstens 3 je
//  Zug und Kopie der Karte. Die Rückkehr einer verwahrten Ability
//  (Madame Guillotine) ist kein Anlegen.
//
//  ── CPU ──────────────────────────────────────────────────────────
//  Die CPU spielt die Karte nicht: auf dem Hauptweg gilt sie als
//  inhärent (die CPU verschiebt solche Karten in die Main Phase), und
//  dort sperrt `cpuPlayVeto` — die Kosten-Abwägung kennt sie nicht.
//  Zur Sicherheit antwortet `cpuResponse` trotzdem: bei der Frage die
//  normale Aktion, das Ziehen nimmt sie an.
// ═══════════════════════════════════════════

const { attachmentHostsFor, candidateHosts, pickAttachmentHost, placeAttachment } = require('./_attachment-shared');
const { mainActionSlotFree } = require('./_of-kings-shared');
const { drawWouldBeBlocked } = require('./_draw-block-shared');

const CARD_NAME = 'Quest of the Chosen One';
const MAX_ZIEHEN_PRO_ZUG = 3;

/** Die Abilities, die an (Brettseite, Held) hängen — Cloak of Edge & Co. eingeschlossen. */
function abilitiesVon(engine, seite, heroIdx) {
  return engine.getAbilityTargets(seite, { heroIdx });
}

/** Wirtsfilter: kein Anti-Magic-Schutz; im Pflicht-Modus nur Helden mit Abilities. */
function wirtsFilter(engine, mussZahlen) {
  return (hero, hi, seite) => {
    if (engine._isHeroSpellProtected(hero, CARD_NAME)) return false;
    if (mussZahlen && abilitiesVon(engine, seite, hi).length === 0) return false;
    return true;
  };
}

/** Gibt es irgendeinen Wirt, an dem sich die Kosten zahlen lassen (Abilities + freier Platz)? */
function kostenZahlbar(engine, pi) {
  return candidateHosts(engine.gs, pi, engine, { heroFilter: wirtsFilter(engine, true) }).length > 0;
}

/**
 * Kosten: ALLE Abilities des Helden in die Ablage. Eine Ability der Stufe N
 * liegt als N Karten im Slot — `discardAbilityTopCopy` schickt jeweils die
 * oberste, bis der Held keine mehr trägt (Support-Zonen-Abilities wie Cloak
 * of Edge wandern als Ganzes). Liefert die Zahl der abgeworfenen Karten.
 */
async function alleAbilitiesAbwerfen(engine, seite, heroIdx, pi) {
  let anzahl = 0;
  for (let runde = 0; runde < 80; runde++) {
    const eintraege = abilitiesVon(engine, seite, heroIdx);
    if (eintraege.length === 0) break;
    let ging = false;
    for (const e of eintraege) {
      if (await engine.discardAbilityTopCopy(e, { source: CARD_NAME, sourceOwner: pi })) { ging = true; anzahl++; break; }
    }
    if (!ging) break;   // nichts mehr abwerfbar (gesperrt) — nicht endlos weiterversuchen
  }
  return anzahl;
}

module.exports = {
  // Entkoppelte Bilder (CARD_API): wird die Karte negiert, spielt die Engine diese.
  spellVisual: { impact: { type: 'gold_sparkle' }, impactMs: 260 },

  requiresTarget: true,   // Blinded-Gate: der Spell öffnet eine Heldenwahl
  activeIn: ['hand', 'support'],

  /**
   * „Counts as an additional Action" — IMMER `inherentAction` (CARD_API v733).
   * Wahr, wenn die Kosten bei irgendeinem Wirt zahlbar sind. Ein passender
   * externer Zusatzaktions-Geber hat Vorrang (kostenlos), es sei denn, die
   * Hauptaktion ist noch frei — dann bleibt die Wahl in `onPlay`.
   */
  inherentAction: (gs, pi, heroIdx, engine) => {
    if (!engine) return true;   // optimistischer Rückfall
    if (!mainActionSlotFree(engine, pi, heroIdx)
        && engine.findAdditionalActionForCard(pi, CARD_NAME, heroIdx)) return false;
    return kostenZahlbar(engine, pi);
  },

  spellPlayCondition(gs, pi, engine) {
    if (!engine) return true;
    return attachmentHostsFor(gs, pi, engine, { heroFilter: wirtsFilter(engine, false) }).length > 0;
  },
  attachmentHosts(gs, pi, engine) {
    return attachmentHostsFor(gs, pi, engine, { heroFilter: wirtsFilter(engine, false) });
  },

  // ── CPU ──
  cpuPlayVeto(engine, pi, heroIdx, ctx2) {
    return !!ctx2?.additional;   // die CPU zahlt die Kosten nie
  },
  cpuResponse(engine, kind, payload) {
    if (kind !== 'generic' || payload?.type !== 'confirm' || payload?.title !== CARD_NAME) return undefined;
    if (/additional Action\?/.test(payload?.message || '')) return { confirmed: false };   // normale Aktion
    return { confirmed: true };                                                            // Karte ziehen
  },

  hooks: {
    onPlay: async (ctx) => {
      if (ctx.cardZone !== 'hand') return;
      if (ctx.playedCard?.id !== ctx.card.id) return;

      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;

      // Aktionsart SOFORT festhalten (Folge-Würfe überschreiben den Stempel).
      const sofort = !!gs._immediateActionContext;           // durch anderen Effekt gespielt
      const inhaerent = !sofort && gs._spellWasInherent === true;
      const hauptFrei = inhaerent && mainActionSlotFree(engine, pi, ctx.cardHeroIdx);
      const mussZahlen = inhaerent && !hauptFrei;            // einziger Weg = Zusatzaktion
      const darfWaehlen = hauptFrei;                         // Wahl, sobald das Ziel Abilities trägt

      // ── Wirt wählen ──
      const wirt = await pickAttachmentHost(ctx, CARD_NAME, {
        heroFilter: wirtsFilter(engine, mussZahlen),
        preferCaster: true,
        // Grün: dieser Held trägt Abilities — sie abzuwerfen macht den Einsatz zur Zusatzaktion.
        heroAccent: darfWaehlen
          ? (hero, hi, seite) => (abilitiesVon(engine, seite, hi).length > 0 ? 'green' : null)
          : null,
        description: mussZahlen
          ? 'Choose a Hero you control with at least 1 Ability to attach Quest of the Chosen One to. All its Abilities are sent to the discard pile (additional Action).'
          : darfWaehlen
          ? 'Choose a Hero you control to attach Quest of the Chosen One to. Green Heroes carry Abilities — you may send them away to make this an additional Action.'
          : 'Choose a Hero you control to attach Quest of the Chosen One to.',
        confirmLabel: '📜 Attach!',
      });
      if (!wirt) return;   // Abbruch: der Picker hat `_spellCancelled` gesetzt (Karte zurück auf die Hand)

      const seite = wirt.owner;
      const wirtsHeld = gs.players[seite]?.heroes?.[wirt.heroIdx];
      if (!wirtsHeld?.name || wirtsHeld.hp <= 0) return;
      const vorhanden = abilitiesVon(engine, seite, wirt.heroIdx);

      // ── Zahlen oder nicht? ──
      let bezahlen = false;
      if (mussZahlen) {
        bezahlen = vorhanden.length > 0;   // der Filter garantiert das; Absicherung gegen einen Wettlauf
      } else if (darfWaehlen) {
        if (vorhanden.length > 0) {
          const antwort = await engine.promptGeneric(pi, {
            type: 'confirm',
            title: CARD_NAME,
            showCard: CARD_NAME,
            message: `Play ${CARD_NAME} as an additional Action? If you do, all ${vorhanden.length === 1 ? 'Ability' : 'Abilities'} attached to ${wirtsHeld.name} are sent to the discard pile. Otherwise it uses this Hero's normal Action.`,
            confirmLabel: '⚡ Additional Action (discard Abilities)',
            cancelLabel: '⚔️ Normal Action',
            // Zwei gleichwertige Wege, kein „may"-Effekt: das zweite Feld IST die Antwort „normale
            // Aktion" — es bricht nicht den Zauber ab, und kein Gerrymander darf sie umlenken.
            cancellable: false,
          });
          bezahlen = engine._confirmSaidYes(antwort);
        }
        // „Nein" — oder nichts zum Abwerfen: die normale Aktion bezahlt (Curse-Vertrag).
        if (!bezahlen) gs._spellForcesActionConsume = true;
      }
      // sofort / externer Geber / normale Hauptaktion: keine Kosten.

      // ── Anlegen (Anti-Magic-Schutz u. a. prüft der gemeinsame Vorgang) ──
      const inst = await placeAttachment(ctx, CARD_NAME, wirt, {});
      if (!inst) { engine.sync(); return; }

      // ── Kosten NACH dem erfolgreichen Anlegen ──
      let abgeworfen = 0;
      if (bezahlen) {
        engine._broadcastEvent('play_zone_animation', { type: 'gold_sparkle', owner: seite, heroIdx: wirt.heroIdx, zoneSlot: -1 });
        abgeworfen = await alleAbilitiesAbwerfen(engine, seite, wirt.heroIdx, pi);
        // „Min 1": ging nichts in die Ablage (alles gesperrt), war es keine Zusatzaktion —
        // bei freier Hauptaktion zahlt dann die normale Aktion.
        if (abgeworfen === 0 && darfWaehlen) gs._spellForcesActionConsume = true;
      }

      engine.log('quest_of_the_chosen_one', {
        player: gs.players[pi]?.username, hero: wirtsHeld.name,
        mode: sofort ? 'immediate' : bezahlen ? 'additional' : 'normal',
        discarded: abgeworfen,
      });
      engine.sync();
    },

    /** „Whenever you attach 1 or more Abilities to this Hero, you may draw up to that many cards." */
    onCardEnterZone: async (ctx) => {
      if (ctx.toZone !== 'ability') return;
      if (ctx._verwahrungRueckkehr) return;   // Rückkehr einer verwahrten Ability ist kein Anlegen
      const inst = ctx.card;
      if (!inst || inst.zone !== 'support') return;
      if (ctx.toHeroIdx !== ctx.cardHeroIdx) return;
      const entering = ctx.enteringCard;
      if (!entering || entering.owner !== (ctx.cardHeroOwner ?? ctx.cardOwner)) return;

      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      if (!ps) return;

      // Zähler je Kopie und Zug (Zustand an der Instanz, nicht am Spieler: „with this effect").
      inst.counters = inst.counters || {};
      if (inst.counters._questZugTurn !== gs.turn) { inst.counters._questZugTurn = gs.turn; inst.counters._questGezogen = 0; }
      const bisher = inst.counters._questGezogen || 0;
      if (bisher >= MAX_ZIEHEN_PRO_ZUG) return;
      if (drawWouldBeBlocked(engine, pi, 1)) return;

      const antwort = await engine.promptGeneric(pi, {
        type: 'confirm',
        title: CARD_NAME,
        showCard: CARD_NAME,
        message: `Draw a card? (${bisher}/${MAX_ZIEHEN_PRO_ZUG} drawn with ${CARD_NAME} this turn)`,
        confirmLabel: '🃏 Draw!',
        cancelLabel: 'No',
        cancellable: true,
      });
      if (!engine._confirmSaidYes(antwort)) return;

      inst.counters._questGezogen = bisher + 1;
      engine._broadcastEvent('play_zone_animation', {
        type: 'gold_sparkle', owner: engine.physicalSide(inst), heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot,
      });
      // Erst abgleichen, dann ziehen: der Client soll die Hand ohne die gerade angelegte Ability sehen.
      engine.sync();
      await engine._delay(300);
      await engine.actionDrawCards(pi, 1, { source: CARD_NAME });
      engine.log('quest_of_the_chosen_one_draw', { player: ps.username, drawn: bisher + 1 });
    },
  },
};
