// ═══════════════════════════════════════════
//  CARD EFFECT: "Cybug SCARAB"
//  Creature (Summoning Magic Lv1, Surprise) — 10 HP
//  `banned: true` in cards.json — im Deckbuilder gesperrt, aber
//  ueber Puzzles und Effekte weiterhin erreichbar, also voll gebaut.
//
//  "Activate this Surprise when a Hero you control, except the user,
//   is defeated by deleting 1 "Golden Ankh" from your hand or deck.
//   Immediately revive that Hero with 100 HP and place this Creature
//   into one of the user's free Support Zones. When this Creature is
//   defeated, add a "Golden Ankh" from your discard pile to your hand."
//
//  Mechanics
//  ─────────
//   • Auslöser: `surpriseHeroDefeatTrigger`, das NEUE Fenster
//     `_checkSurpriseOnHeroDefeat`. Es haengt in
//     `_runHeroDefeatSequence` — der gemeinsamen Sammelstelle ALLER
//     vier Todeswege (normaler Schaden, echter Schaden,
//     `actionDefeatHero`, erzwungener Tod). Damit greift „is defeated"
//     unabhaengig davon, WIE der Held gefallen ist.
//   • „except the user": der Traeger darf nicht der Gefallene sein.
//     Praktisch kann er es gar nicht — `_canHeroActivateSurprise`
//     verlangt einen lebenden Traeger —, der Vergleich steht hier
//     trotzdem, weil der Text ihn nennt.
//   • Der Text sagt nicht „a Hero your opponent defeats". Ein Held,
//     der durch EIGENE Karten fällt (Opferkosten, Initiation Ritual),
//     ist genauso „a Hero you control ... is defeated" — es gibt hier
//     also KEIN Gate auf die Quelle. Anders als bei Cybug ANTS, wo
//     „your opponent deals damage" ausdruecklich im Text steht.
//   • Wiederbelebung ueber `engine.actionReviveHero(pi, heroIdx, 100)`.
//     Der Betrag wird dort auf `maxHp` gedeckelt, Statuseffekte werden
//     geleert und `_koProcessed` freigegeben. KEIN `forceKillAtTurnEnd`
//     und KEIN `maxHpCap`: Als neuer Text nennt weder ein Zeitlimit
//     noch eine Obergrenze — anders als die Treibstoffkarte Golden Ankh
//     selbst, deren Wiederbelebung am Zugende zurueckgenommen wird.
//   • Der Held kommt BLANK zurueck: das Aufraeumen („when dying",
//     Ausruestungen in die Ablage) ist zum Zeitpunkt des Fensters schon
//     gelaufen. Das ist die Reihenfolge des Todesablaufs, keine
//     Entscheidung dieser Karte.
//   • Placement: Standard-Creature-Surprise — `_activateSurprise` setzt
//     die Kreatur nach `onSurpriseActivate` in die erste freie Support
//     Zone des Traegers.
//   • On-Death: 1 Golden Ankh aus dem Ablagestapel zurueck auf die
//     Hand, ueber `instId` auf GENAU DIESE Kopie gefiltert.
// ═══════════════════════════════════════════

const { deleteCybugFuel, recoverCybugFuel, hasCybugFuel } = require('./_cybug-shared');

const CARD_NAME = 'Cybug SCARAB';
const FUEL_CARD = 'Golden Ankh';
const REVIVE_HP = 100;

module.exports = {
  isSurprise: true,
  activeIn: ['surprise', 'support'],

  // Der Auslöser ist ein konkreter Todesfall — nicht nachstellbar.
  canTelekinesisActivate: false,

  /**
   * Trigger: ein EIGENER Held ist gefallen, und zwar nicht der Traeger.
   */
  surpriseHeroDefeatTrigger(gs, ownerIdx, heroIdx, info) {
    if (!info) return false;
    if (info.defeatedOwner !== ownerIdx) return false;      // „a Hero you control"
    if (info.defeatedHeroIdx == null || info.defeatedHeroIdx < 0) return false;
    if (heroIdx === info.defeatedHeroIdx) return false;     // „except the user"
    // Der Gefallene muss auch wirklich liegen — ein Hook (Guardian
    // Angel) kann ihn zwischenzeitlich gerettet haben.
    const gefallen = gs.players[ownerIdx]?.heroes?.[info.defeatedHeroIdx];
    if (!gefallen?.name || gefallen.hp > 0) return false;
    return hasCybugFuel(gs, ownerIdx, FUEL_CARD);
  },

  /**
   * Kosten zahlen → den gefallenen Helden mit 100 HP zurueckholen.
   */
  async onSurpriseActivate(ctx, sourceInfo) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const ps = gs.players[pi];
    if (!ps) return null;

    const zielIdx = sourceInfo?.defeatedHeroIdx;
    if (zielIdx == null || zielIdx < 0) return null;
    if (sourceInfo.defeatedOwner !== pi) return null;
    const gefallen = ps.heroes?.[zielIdx];
    if (!gefallen?.name || gefallen.hp > 0) return null;
    // Sicherheitsnetz gegen den Fall, dass der Traeger doch der
    // Gefallene waere — dann gaebe es niemanden, der die Kreatur
    // aufnimmt.
    if (ctx.cardHeroIdx === zielIdx) return null;

    // Kosten ZUERST. Ist die Kopie zwischen Auslöser und jetzt
    // verschwunden, scheitert die Aktivierung sauber und der Held
    // bleibt gefallen.
    const bezahlt = await deleteCybugFuel(engine, pi, FUEL_CARD);
    if (!bezahlt) return null;

    const zurueck = await engine.actionReviveHero(pi, zielIdx, REVIVE_HP, {
      source: CARD_NAME,
    });
    if (!zurueck) { engine.sync(); return null; }

    engine.log('cybug_scarab_revive', {
      player: ps.username,
      hero: gefallen.name,
      hp: gefallen.hp,
      killedBy: sourceInfo?.cardName,
    });
    engine.sync();
    return { heroRevived: true, revivedHeroIdx: zielIdx };
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
