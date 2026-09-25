// ═══════════════════════════════════════════
//  CARD EFFECT: „Cats of the Pharaoh"
//  Creature (Normal, Summoning Magic Lv1, 10 HP)
//
//  "At the start of your turn, if you control no Creatures, you may
//   summon this Creature from your discard pile as an additional
//   Action, but if you do, you cannot search or add cards to your hand
//   for the rest of the turn afterwards (but you can still draw)."
//
//  ── DIE NEUE SPERRE ───────────────────────────────────────────────
//  „you cannot search or add cards to your hand … (but you can still
//   draw)" war die einzige Kombination, die es noch nicht gab:
//
//    `handLocked`   — sperrt ALLES: Draws UND Suchen/Adds
//    `drawLocked`   — sperrt NUR Draws (Sacred Jewel)
//    `searchLocked` — sperrt NUR Suchen und Adds  ← NEU (v1068)
//
//  Der Riegel sitzt in `_engine.js#_isSearchBlocked` und deckt alle
//  fuenf Tore ab, an denen eine Karte auf die Hand gelangt. Die Karte
//  selbst setzt nur das Flag.
//
//  ★ DER ABLAGESTAPEL BLEIBT OFFEN. `searchLocked` sperrt Deck-Suche
//  und Adds; erst die staerkere Stufe `searchLockedIncludesDiscard`
//  nimmt auch den Ablagestapel dazu — die braucht „Siege" (Al 14.9.).
//  Cats setzt deshalb bewusst nur die erste Stufe.
//
//  ── „AT THE START OF YOUR TURN" AUS DER ABLAGE ────────────────────
//  Die Karte lauscht also aus dem ABLAGESTAPEL heraus (`activeIn`
//  enthaelt 'discard') — sonst feuert der Hook dort gar nicht.
//
//  ── „IF YOU CONTROL NO CREATURES" ─────────────────────────────────
//  Gezaehlt wird ueber `controller`, nicht `owner`: eine per
//  Cross-Side-Platzierung in der Gegnerspalte liegende eigene Kreatur
//  zaehlt mit, eine uebernommene fremde ebenfalls. Verdeckte
//  Surprises sind keine Kreaturen im Spiel und zaehlen nicht.
//
//  ── „AS AN ADDITIONAL ACTION" ─────────────────────────────────────
//  Die Beschwoerung laeuft ausserhalb der Action Phase (Rundenbeginn)
//  und kostet daher ohnehin keine regulaere Aktion. `_isNormalSummon:
//  false` haelt sie aus der Normalbeschwoerungs-Grenze heraus.
// ═══════════════════════════════════════════

const CARD_NAME = 'Cats of the Pharaoh';

/** Kontrolliert `pi` gerade irgendeine Kreatur auf dem Brett? */
function kontrolliertKreaturen(engine, pi) {
  const cardDB = engine._getCardDB();
  for (const inst of (engine.cardInstances || [])) {
    if (inst.zone !== 'support') continue;
    if (inst.faceDown) continue;                       // verdeckte Surprise
    if ((inst.controller ?? inst.owner) !== pi) continue;
    const cd = engine.getEffectiveCardData(inst) || cardDB[inst.name];
    if (!cd) continue;
    if ((cd.cardType || '').toLowerCase() !== 'creature') continue;
    return true;
  }
  return false;
}

/** Freie Support-Zonen, in die `pi` beschwoeren darf. */
function freieZonen(engine, pi) {
  const ps = engine.gs.players[pi];
  const out = [];
  for (let hi = 0; hi < (ps?.heroes || []).length; hi++) {
    const hero = ps.heroes[hi];
    if (!hero?.name || hero.hp <= 0) continue;
    if (!engine._canHeroActivateSurprise(pi, hi, CARD_NAME)) continue;
    for (let zi = 0; zi < 3; zi++) {
      if (((ps.supportZones?.[hi] || [])[zi] || []).length === 0) {
        out.push({ heroIdx: hi, slotIdx: zi, label: `${hero.name} — Support ${zi + 1}` });
      }
    }
  }
  return out;
}

module.exports = {
  // ★ 'discard' ist Pflicht — ohne sie feuert `onTurnStart` aus dem
  // Ablagestapel heraus gar nicht.
  // COST-DISCARD-CHANNEL: n/a — die Karte wirft nichts als Kosten ab; der
  // Waechter schlaegt auf das Wort „discard pile" (Herkunft der
  // Beschwoerung) an, nicht auf einen Abwurf (v1147).
  activeIn: ['hand', 'support', 'discard'],

  hooks: {
    onTurnStart: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const inst = ctx.card;
      if (!inst || inst.zone !== 'discard') return;

      const pi = inst.owner;
      if (gs.activePlayer !== pi) return;              // „your turn"
      const ps = gs.players[pi];
      if (!ps) return;
      if (!(ps.discardPile || []).includes(CARD_NAME)) return;

      // „if you control no Creatures"
      if (kontrolliertKreaturen(engine, pi)) return;

      const zonen = freieZonen(engine, pi);
      if (zonen.length === 0) return;                  // nirgends Platz

      const ja = await engine.promptGeneric(pi, {
        type: 'confirm',
        title: CARD_NAME,
        showCard: CARD_NAME,
        message: `Summon ${CARD_NAME} from your discard pile? You will not be able to search or add cards to your hand for the rest of this turn (drawing still works).`,
        confirmLabel: '🐈 Summon!',
        cancelLabel: 'No',
        cancellable: true,
      });
      if (!ja) return;

      // Nach dem Prompt neu pruefen — waehrend der Spieler ueberlegt,
      // kann sich das Brett geaendert haben (Kettenreaktionen).
      if (!(ps.discardPile || []).includes(CARD_NAME)) return;
      if (kontrolliertKreaturen(engine, pi)) return;
      const zonenJetzt = freieZonen(engine, pi);
      if (zonenJetzt.length === 0) return;

      let ziel = zonenJetzt[0];
      if (zonenJetzt.length > 1) {
        const wahl = await engine.promptGeneric(pi, {
          type: 'zonePick',
          title: CARD_NAME,
          description: `Summon ${CARD_NAME} into which Support Zone?`,
          zones: zonenJetzt,
          cancellable: true,
        });
        if (!wahl || wahl.cancelled) return;
        ziel = { heroIdx: wahl.heroIdx, slotIdx: wahl.slotIdx };
      }

      // Stapel-Schicht (v820): die Karte ueber `takeFromPile` entnehmen,
      // nie per splice.
      // v1389: über die EINE Ablage-Stelle (summonFromDiscard); lehnt ein
      // Gatter ab, liegt die Karte danach wieder in der Ablage.
      const res = await engine.summonFromDiscard(pi, pi, CARD_NAME, ziel.heroIdx, ziel.slotIdx, {
        source: CARD_NAME, flug: false,
        summonOpts: { isPlacement: true },
        hookExtras: { _isNormalSummon: false },
      });
      if (!res) return;

      // ★ „but if you do" — der Preis faellt NUR bei geglueckter
      // Beschwoerung an. Deshalb steht er hier unten und nicht oben
      // neben der Zusage.
      ps.searchLocked = true;
      // Der Ablagestapel bleibt ausdruecklich offen (siehe Kopf).
      engine.log('cats_of_the_pharaoh', {
        player: ps.username, heroIdx: ziel.heroIdx, slotIdx: ziel.slotIdx,
      });
      engine._broadcastEvent('summon_effect', {
        owner: pi, heroIdx: ziel.heroIdx, zoneSlot: ziel.slotIdx,
      });
      engine.sync();
    },
  },

  /**
   * CPU: die Beschwoerung ist gratis und bringt ein Brett-Ziel; der
   * Preis trifft nur Such-Effekte. Ja, ausser die CPU haette in dieser
   * Runde ohnehin nichts auf dem Brett zu gewinnen — das entscheidet
   * sie nicht hier, sondern ueber die normale Bewertung der
   * Zonen-Wahl. Ohne diesen Eintrag lehnt der generische Responder
   * abbrechbare Prompts pauschal ab (Barker-Bugklasse).
   */
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic') return undefined;
    if (promptData?.title !== CARD_NAME) return undefined;
    if (promptData.type === 'confirm') return { confirmed: true };
    if (promptData.type === 'zonePick') {
      const z = (promptData.zones || [])[0];
      return z ? { heroIdx: z.heroIdx, slotIdx: z.slotIdx } : undefined;
    }
    return undefined;
  },
};
