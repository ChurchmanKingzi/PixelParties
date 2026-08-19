// ═══════════════════════════════════════════
//  CARD EFFECT: "Cybug ANTS"
//  Creature (Summoning Magic Lv1, Surprise) — 10 HP
//
//  "Activate this Surprise when your opponent deals damage to the user
//   and does not defeat it by deleting 1 "Future Tech Gun" from your
//   hand or deck. Deal that same damage to any target your opponent
//   controls and place this Creature into one of the user's free
//   Support Zones. When this Creature is defeated, add a "Future Tech
//   Gun" from your discard pile to your hand."
//
//  Mechanics
//  ─────────
//   • Auslöser: `surpriseAfterDamageTrigger`, das NEUE Fenster
//     `_checkSurpriseAfterDamage`. Es liegt im Schadensweg direkt
//     neben dem Hand-Reaktions-Hub und bekommt `realDealt` — den
//     TATSÄCHLICHEN HP-Verlust, gedeckelt auf die HP vor dem Treffer.
//     „That same damage" gibt also nie Überschuss weiter: ein Held mit
//     30 HP, der einen 200er-Schlag überlebt... kann es nicht, aber
//     ein Held mit 30 HP, der 30 Schaden nimmt und bei 0 landet, ist
//     besiegt und fällt unten durch das Gate.
//   • Es gibt DREI Schadensfenster, und nur dieses passt: das
//     Anvisier-Fenster (`_checkSurpriseWindow`) und das opt-in-Fenster
//     `_checkDamageSurpriseWindow` (Banner Bearer) feuern BEIDE VOR
//     dem Schaden — dort ist der Betrag noch nicht bekannt und der
//     Text verlangt ihn.
//   • „does not defeat it": `info.defeated` wird an der Aufrufstelle
//     NACH den Hand-Reaktionen gelesen. Rettet Cloud in a Bottle den
//     Helden noch, gilt er nicht als besiegt und ANTS darf feuern.
//   • „the user": der Träger MUSS der getroffene Held sein. Das
//     Fenster scannt alle Surprises des getroffenen Spielers, der
//     Vergleich `heroIdx === info.targetHeroIdx` steht deshalb hier.
//   • „your opponent deals damage": eine identifizierbare Quelle auf
//     der Gegenseite. Statusticks (Burn, Poison) tragen keinen
//     Besitzer und lösen damit NICHT aus — bewusste Lesart, weil der
//     Text einen handelnden Gegner nennt.
//   • Weitergabe: `promptDamageTarget` mit `side: 'enemy'` und beiden
//     Zieltypen, danach der übliche Zweischritt aus dem Vorbild
//     (Archer of Teocuilatl): Helden über `ctx.dealDamage`, Kreaturen
//     über `actionDealCreatureDamage`. Der Picker WÄHLT nur aus, er
//     teilt keinen Schaden aus.
//   • Placement: Standard-Creature-Surprise — `_activateSurprise` setzt
//     die Kreatur nach `onSurpriseActivate` in die erste freie Support
//     Zone des Trägers.
//   • On-Death: 1 Future Tech Gun aus dem Ablagestapel zurück auf die
//     Hand, über `instId` auf GENAU DIESE Kopie gefiltert.
// ═══════════════════════════════════════════

const { deleteCybugFuel, recoverCybugFuel, hasCybugFuel } = require('./_cybug-shared');

const CARD_NAME = 'Cybug ANTS';
const FUEL_CARD = 'Future Tech Gun';
const DAMAGE_TYPE = 'creature';

module.exports = {
  isSurprise: true,
  activeIn: ['surprise', 'support'],

  // Kein Fenster, das Telekinese nachstellen könnte — der Betrag
  // stammt aus einem konkreten Treffer.
  canTelekinesisActivate: false,

  /**
   * Trigger: der Gegner hat GENAU DIESEN Träger getroffen, er lebt
   * noch, und der Treibstoff ist bezahlbar.
   */
  surpriseAfterDamageTrigger(gs, ownerIdx, heroIdx, info) {
    if (!info) return false;
    if (info.defeated) return false;                    // „does not defeat it"
    if (heroIdx !== info.targetHeroIdx) return false;   // „the user"
    if (!(info.amount > 0)) return false;
    // „your opponent deals damage" — eigener Schaden und besitzerlose
    // Statusticks zählen nicht.
    if (info.owner == null || info.owner < 0) return false;
    if (info.owner === ownerIdx) return false;
    return hasCybugFuel(gs, ownerIdx, FUEL_CARD);
  },

  /**
   * Kosten zahlen → denselben Betrag auf ein Ziel der Gegenseite.
   */
  async onSurpriseActivate(ctx, sourceInfo) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const ps = gs.players[pi];
    if (!ps) return null;

    const schaden = Number(sourceInfo?.amount) || 0;
    if (schaden <= 0) return null;

    // Kosten ZUERST. Ist die Kopie zwischen Auslöser und jetzt
    // verschwunden, scheitert die Aktivierung sauber.
    const bezahlt = await deleteCybugFuel(engine, pi, FUEL_CARD);
    if (!bezahlt) return null;

    const ziel = await ctx.promptDamageTarget({
      side: 'enemy',
      types: ['hero', 'creature'],
      damageType: DAMAGE_TYPE,
      baseDamage: schaden,
      title: CARD_NAME,
      source: CARD_NAME,
      description: `Deal ${schaden} damage to any target your opponent controls.`,
      confirmLabel: `🐜 ${schaden} Damage!`,
      confirmClass: 'btn-danger',
      // Der Treibstoff ist bezahlt — abbrechen darf man hier nicht
      // mehr, sonst verpufft er.
      cancellable: false,
      noSpellCancel: true,
    });
    if (!ziel) { engine.sync(); return null; }

    // Als Vorgabe 19.8.: eine Pistolenkugel, die auf das Ziel fliegt —
    // dieselbe Bauform wie `crusader-s-flintlock.js`. Der Schuss geht
    // vom Traeger des Surprise aus.
    const FLUGZEIT = 420;
    engine._broadcastEvent('play_projectile_animation', {
      sourceOwner: pi, sourceHeroIdx: ctx.cardHeroIdx, sourceZoneSlot: -1,
      targetOwner: ziel.owner, targetHeroIdx: ziel.heroIdx,
      targetZoneSlot: ziel.type === 'hero' ? -1 : ziel.slotIdx,
      emoji: '•',
      emojiStyle: { fontSize: 26, color: '#ffd9a0', textShadow: '0 0 8px rgba(255,190,90,.95)' },
      duration: FLUGZEIT,
    });
    await engine._delay(FLUGZEIT);
    engine._broadcastEvent('play_zone_animation', {
      type: 'arrow_impact', owner: ziel.owner, heroIdx: ziel.heroIdx,
      zoneSlot: ziel.type === 'hero' ? -1 : ziel.slotIdx,
    });
    await engine._delay(120);

    if (ziel.type === 'hero') {
      const held = gs.players[ziel.owner]?.heroes?.[ziel.heroIdx];
      if (held && held.hp > 0) await ctx.dealDamage(held, schaden, DAMAGE_TYPE);
    } else if (ziel.cardInstance) {
      await engine.actionDealCreatureDamage(
        { name: CARD_NAME, owner: pi, heroIdx: ctx.cardHeroIdx },
        ziel.cardInstance, schaden, DAMAGE_TYPE,
        { sourceOwner: pi, canBeNegated: true },
      );
    }

    engine.log('cybug_ants_reflect', {
      player: ps.username,
      amount: schaden,
      from: sourceInfo?.cardName,
      target: ziel.type === 'hero'
        ? (gs.players[ziel.owner]?.heroes?.[ziel.heroIdx]?.name || 'Hero')
        : (ziel.cardName || ziel.cardInstance?.name || 'Creature'),
    });
    engine.sync();
    return { damageReflected: schaden };
  },

  /**
   * CPU: immer zuschlagen, der Treibstoff ist für nichts anderes da.
   * Ziel: was der Betrag SICHER erledigt — zuerst eine Kreatur, die
   * daran stirbt, sonst der Held mit den wenigsten HP.
   */
  cpuResponse(engine, kind, payload) {
    if (kind !== 'damageTarget' && kind !== 'effectTarget') return undefined;
    const cfg = payload?.config;
    if (!cfg || (cfg.source || cfg.title) !== CARD_NAME) return undefined;
    const ziele = payload.validTargets || [];
    if (ziele.length === 0) return undefined;
    const schaden = Number(cfg.baseDamage) || 0;

    // ★ Rueckgabe ist eine LISTE VON IDS, kein Ziel-Objekt. Der
    // Aufrufer liest `selectedIds[0]` und sucht damit in der Zielliste.
    // Mein erster Wurf gab das Objekt zurueck — `selectedIds[0]` war
    // dann `undefined`, der Picker fand nichts und lieferte `null`.
    // Wirkung im Spiel (Als Befund 19.8.): die Kreatur wird gesetzt,
    // aber es gibt WEDER Schaden NOCH Animation NOCH Logeintrag.
    // Faellt nur bei CPU-Steuerung auf — ein Mensch klickt selbst.
    const toetbar = ziele.filter(z => z.type !== 'hero'
      && (z.cardInstance?.counters?.currentHp ?? Infinity) <= schaden);
    if (toetbar.length > 0) return [toetbar[0].id];

    const helden = ziele.filter(z => z.type === 'hero');
    if (helden.length > 0) {
      let best = helden[0];
      for (const z of helden) {
        const hp = engine.gs.players[z.owner]?.heroes?.[z.heroIdx]?.hp ?? Infinity;
        const bestHp = engine.gs.players[best.owner]?.heroes?.[best.heroIdx]?.hp ?? Infinity;
        if (hp < bestHp) best = z;
      }
      return [best.id];
    }
    return [ziele[0].id];
  },

  hooks: {
    onCreatureDeath: async (ctx) => {
      const death = ctx.creature;
      if (!death || !ctx.card) return;
      if (death.instId !== ctx.card.id) return;
      await recoverCybugFuel(ctx._engine, death.owner, FUEL_CARD, CARD_NAME);
    },
  },
};
