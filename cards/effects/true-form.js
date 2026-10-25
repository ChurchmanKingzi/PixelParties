// ═══════════════════════════════════════════
//  CARD EFFECT: "True Form"
//  Spell (Magic Arts Lv1, Normal)
//
//  „Choose a Hero with a different name from all Heroes you control from your hand and place it on top of the user. The user becomes that
//   Hero and its effects, Attack stat and max HP are replaced with that Hero's. You may at any time during your turn remove a Hero placed by
//   this effect and send it to the discard pile to remove this effect. If this is the first Spell you use this turn, this counts as an
//   additional Action."
//
//  ── WAHL ────────────────────────────────────────────────────────────────
//  Hero-Karten (Kartentyp „Hero", keine Ascended Heroes — deren Aufstieg hat eine eigene Bedingung) aus der HAND, deren Name von ALLEN Helden
//  abweicht, die der Spieler gerade kontrolliert (auch von den aktuellen Formen). Die Karte wird in der Hand angeklickt oder auf den Nutzer
//  gezogen (`pickHandCard`, Drag-Modus).
//
//  ── FORMWECHSEL ─────────────────────────────────────────────────────────
//  Läuft über `engine.performAscension(…, { plainHeroForm, notAnAscension, skipCondition, forceFormStack })` — dieselbe Zustandsübertragung wie
//  Tri Ad/Open Invitation: neuer Name und Skript (damit die Effekte der neuen Form), gedruckte ATK und max HP der neuen Form
//  (max HP = Differenz der gedruckten Werte, die AKTUELLEN HP bleiben unberührt — auch über max HP; Buffs/Ausrüstung/Abilities bleiben am Helden), die Form liegt auf dem Formstapel. Es ist KEIN Aufstieg:
//  kein Bonus, keine Aufstiegs-Trigger, kein Zugende. Auch ein bereits verwandelter Held darf erneut verwandelt werden — die Formen stapeln sich.
//  `hero._trueForm` merkt sich die Stapeltiefe jeder True-Form-Schicht.
//
//  ── ZURÜCKVERWANDELN ────────────────────────────────────────────────────
//  Ein Klick auf den Helden öffnet — wie bei jedem Held mit mehreren Effekten — das Effektmenü: „Transform back" und (falls vorhanden) der
//  Effekt der Form. Ist das die einzige Option, geschieht sie direkt. `engine.performTrueFormRevert` (Server `doActivateHeroEffect`) nimmt
//  nur die OBERSTE True-Form-Schicht: die Form geht in die Ablage, der Held wird zur Form darunter; aktuelle HP bleiben, der Held stirbt nie daran. Keine Aktion, keine Kette, beliebig oft im
//  eigenen Zug. Ist die Form darunter ein Name, den ein anderer eigener Held gerade trägt, geht es nicht (Doppelgänger ausgeschlossen).
//
//  ── Bild und Klang ──────────────────────────────────────────────────────
//  Der Aufstiegs-Morph des Clients (`hero_ascension`): blendendes weißes Licht, darunter wird die Heldenkarte zur neuen.
// ═══════════════════════════════════════════

const CARD_NAME = 'True Form';

/** Namen aller Helden, die `pi` gerade kontrolliert. */
function kontrollierteNamen(engine, pi) {
  return new Set(engine.heroesControlledBy(pi).map(h => h.hero.name));
}

/** Wählbare Hero-Karten der Hand (eindeutige Namen). */
function waehlbareHelden(engine, pi) {
  const ps = engine.gs.players[pi];
  const db = engine._getCardDB();
  const namen = kontrollierteNamen(engine, pi);
  const out = [];
  for (const n of (ps?.hand || [])) {
    if (out.includes(n)) continue;
    if (db[n]?.cardType !== 'Hero') continue;
    if (namen.has(n)) continue;
    out.push(n);
  }
  return out;
}

module.exports = {
  cpuSkipProactive: true,

  /** „If this is the first Spell you use this turn, this counts as an additional Action." */
  inherentAction(gs, pi) {
    return (gs.players[pi]?.spellsPlayedThisTurn || 0) === 0;
  },

  /** Grau, solange keine wählbare Hero-Karte auf der Hand liegt. */
  spellPlayCondition(gs, pi, engine) {
    if (!engine) return true;
    return waehlbareHelden(engine, pi).length > 0;
  },

  canPlayWithHero(gs, pi, heroIdx, cardData, engine) {
    if (!engine) return true;
    const hs = engine.heldSeiteFuer ? engine.heldSeiteFuer(pi, heroIdx) : pi;
    const hero = gs.players[hs]?.heroes?.[heroIdx];
    if (!hero?.name || hero.hp <= 0) return false;
    return waehlbareHelden(engine, pi).length > 0;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      const heroIdx = ctx.cardHeroIdx;
      const hs = ctx.cardHeroOwner ?? pi;                       // Brettseite des Nutzers
      const hero = ctx.attachedHero || gs.players[hs]?.heroes?.[heroIdx];
      if (!ps || !hero?.name || hero.hp <= 0) { gs._spellCancelled = true; return; }

      const namen = waehlbareHelden(engine, pi);
      if (namen.length === 0) { gs._spellCancelled = true; return; }

      // ── Wahl in der Hand: anklicken oder auf den Nutzer ziehen ──
      const eligibleIndices = [];
      (ps.hand || []).forEach((cn, i) => { if (namen.includes(cn)) eligibleIndices.push(i); });
      const hosts = {};
      for (const n of namen) hosts[n] = [{ heroIdx, slotIdx: -1 }];
      const pick = await engine.promptGeneric(pi, {
        type: 'pickHandCard',
        title: CARD_NAME,
        description: `Choose a Hero from your hand to place on top of ${hero.name}.`,
        instruction: `Click a highlighted Hero in your hand — or drag it onto ${hero.name}.`,
        showCard: CARD_NAME,
        eligibleIndices,
        eligibleHostsByCardName: hosts,
        dragSummonMode: true,
        hostZoneKind: 'hero',
        cancellable: true,
      });
      if (!pick || pick.cancelled || pick.handIndex == null) { gs._spellCancelled = true; return; }
      const zielName = pick.cardName || ps.hand[pick.handIndex];
      if (!namen.includes(zielName)) { gs._spellCancelled = true; return; }
      if (pick.targetHeroIdx != null && pick.targetHeroIdx !== heroIdx) { gs._spellCancelled = true; return; }

      // Zwischen Abfrage und Antwort kann sich der Zustand verschoben haben.
      if (!waehlbareHelden(engine, pi).includes(zielName) || hero.hp <= 0) { gs._spellCancelled = true; return; }
      const handIndex = ps.hand.indexOf(zielName);
      if (handIndex < 0) { gs._spellCancelled = true; return; }

      const vorher = hero.name;
      const res = await engine.performAscension(pi, heroIdx, zielName, handIndex, {
        ...(hs !== pi ? { heroOwner: hs } : {}),
        plainHeroForm: true,        // ein normaler Hero wird als Form gelegt
        notAnAscension: true,       // kein Bonus, keine Aufstiegs-Trigger, kein Zugende
        skipCondition: true,        // Hero-Karten haben keine Aufstiegsbedingung
        forceFormStack: true,       // der Rückweg braucht die Form darunter
        keepHp: true,               // aktuelle HP bleiben, nur max HP wechselt (aktuelle HP über max HP sind erlaubt)
      });
      if (!res?.success) { gs._spellCancelled = true; return; }

      // Schicht merken: nur die oberste True-Form-Schicht darf per „Transform back" gehen.
      const held = gs.players[hs]?.heroes?.[heroIdx];
      if (held) {
        if (!Array.isArray(held._trueForm)) held._trueForm = [];
        held._trueForm.push((held._formStack || []).length);
      }
      engine.log('true_form', { player: ps.username, from: vorher, to: zielName });
      engine.sync();
    },
  },
};
