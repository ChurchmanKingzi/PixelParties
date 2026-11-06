// ═══════════════════════════════════════════
//  CARD EFFECT: "Basketskull"
//  Spell (Normal), Lv1, Destruction Magic, PP MSAZ
//
//  "Remove any number of Doom Counters from a
//   'Doom Clock' on the board to play this card.
//   Choose a target and deal damage equal to 70 times
//   the number of removed counters to it. This Spell
//   can never hit more than 1 target."
//
//  Als Hinweis (5.8.): **Bomb Berserker Bartas**
//  gibt einem normalen Destruction-Spell mit genau
//  1 Ziel und niedrigerem Level ein ZWEITES Ziel.
//  Basketskull sagt aber ausdruecklich "can never hit
//  more than 1 target" — deshalb das Flag
//  `neverMultiTarget`, das Bartas respektiert.
// ═══════════════════════════════════════════

const D = require('./_doom-clock-shared');

const CARD_NAME = 'Basketskull';
const DAMAGE_PER_COUNTER = 70;

/**
 * Uhr und Menge wählen, die Counter entfernen. Gibt die Zahl der entfernten Counter zurück, 0 = abgebrochen / nichts bezahlt.
 */
async function zahleCounter(ctx) {
  const engine = ctx._engine;
  const pi = ctx.cardOwner;

  const uhr = await D.pickClock(engine, pi, D.clocksWithCounters(engine), {
    title: CARD_NAME,
    message: 'Remove counters from which Doom Clock?',
    cancellable: true,
  });
  if (!uhr) return 0;

  // Auswahl als DROPDOWN (Als Vorgabe 5.8.: "dieselbe Art Dropdown
  // wie Siphem"). Bei bis zu 19 moeglichen Countern waere eine
  // Knopfreihe unbrauchbar — `renderAs: 'dropdown'` ist genau
  // dafuer da. Ids im selben Format wie bei Siphem (`n-<zahl>`),
  // damit das Muster wiedererkennbar bleibt.
  const max = D.counterCount(uhr);
  const optionen = [];
  for (let n = 1; n <= max; n++) {
    optionen.push({
      id: `n-${n}`,
      label: `${n} counter${n > 1 ? 's' : ''} → ${n * DAMAGE_PER_COUNTER} damage`,
    });
  }
  const wahl = await engine.promptGeneric(pi, {
    type: 'optionPicker',
    renderAs: 'dropdown',
    title: CARD_NAME,
    description: `This Doom Clock has ${max} Doom Counter${max > 1 ? 's' : ''}. Remove how many?`,
    confirmLabel: 'Confirm',
    options: optionen,
    cancellable: true,
  });
  if (!wahl || wahl.cancelled || !wahl.optionId) return 0;
  const treffer = String(wahl.optionId).match(/^n-(\d+)$/);
  if (!treffer) return 0;
  const anzahl = parseInt(treffer[1], 10);
  if (!(anzahl >= 1 && anzahl <= max)) return 0;

  const entfernt = D.removeCounters(engine, uhr, anzahl);
  return entfernt > 0 ? entfernt : 0;   // faengt auch NaN ab
}

module.exports = {
  // ★ Als Ruling (Al 26.10., Flame Avalanche: „Wenn du andere Schadenskarten unspielbar machst, müssen das Vial und Rockfall auch sein!"): die Karte richtet NUR Schaden an Zielen an (die Doom Counter sind nur Kostenpunkt) —
  // unter der Schadenssperre (`ps.damageLocked`) unspielbar (Karte bleibt auf der Hand, keine Aktion/Kosten; Sperr-Stutzen `engine._cardBlockedBySearchLock`).
  blockedByDamageLock: true,
  // ★★ v1181 — ENTKOPPELTE ZAUBERBILDER (siehe CARD_API): bei einer
  // Negation spielt die Engine diese Bilder, damit der abgewehrte
  // Zauber sichtbar bleibt.
  spellVisual: {
    projectile: { emoji: '💀', duration: 520 },
    stagger: 110, flightMs: 330,
    impact: { type: 'explosion' }, impactMs: 260,
  },

  requiresTarget: true,

  // Bartas & Co. duerfen dieser Karte KEIN zweites Ziel geben.
  neverMultiTarget: true,

  // Ohne entfernbare Counter ist die Karte nicht spielbar — die
  // Counter sind die KOSTEN, nicht ein optionaler Zusatz.
  spellPlayCondition(gs, pi, engine) {
    return D.clocksWithCounters(engine).length > 0;
  },

  // ★ W16b (A01-pollution-17b, Welle 4 „Kosten ‚to play this card' werden VOR dem Reaktionsfenster bezahlt"): die Counter sind der
  // Kostenpunkt und bleiben bei Ganz-Negierung bezahlt. Wahl von Uhr und Menge steht deshalb hier (abbrechbar → `false` = nichts
  // bezahlt, Karte bleibt auf der Hand); das Gezahlte merkt sich die Instanz (`_kostenBezahlt` = Zahl der entfernten Counter).
  // Ohne diesen Lauf (Sofort-Guss, Spiegelkopie) zahlt `onPlay` wie früher selbst.
  async payActivationCost(ctx) {
    const entfernt = await zahleCounter(ctx);
    if (!entfernt) return false;
    if (ctx.card) ctx.card._kostenBezahlt = entfernt;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const pi = ctx.cardOwner;

      let entfernt = ctx.card?._kostenBezahlt || 0;
      const vorab = entfernt > 0;
      if (ctx.card) delete ctx.card._kostenBezahlt;
      if (!vorab) {
        entfernt = await zahleCounter(ctx);
        // Abbruch der Mengenwahl = nichts ist passiert: Karte zurück auf die Hand, Aktion erstattet (Regel 23.9; A01-pollution-23).
        if (!entfernt) { engine.gs._spellCancelled = true; return false; }
      }
      const schaden = entfernt * DAMAGE_PER_COUNTER;

      const ziel = await ctx.promptDamageTarget({
        side: 'any',
        types: ['hero', 'creature'],
        damageType: 'destruction_spell',
        baseDamage: schaden,
        title: CARD_NAME,
        description: `Choose a target and deal ${schaden} damage to it.`,
        confirmLabel: `💀 ${schaden} Damage!`,
        confirmClass: 'btn-danger',
        cancellable: false,
      });
      if (!ziel) return;

      // ── ANIMATION (Als Vorgabe 5.8.) ────────────────────────────────
      // Ein Totenschaedel fliegt vom Anwender zum Ziel und explodiert
      // dort. Muster von Cannon Tower: Projektil, kurz warten, dann
      // die Einschlags-Animation auf dem Zielfeld.
      const zielSlot = ziel.type === 'hero' ? -1 : ziel.slotIdx;
      engine._broadcastEvent('play_projectile_animation', {
        sourceOwner: pi, sourceHeroIdx: ctx.cardHeroIdx,
        targetOwner: ziel.owner, targetHeroIdx: ziel.heroIdx,
        targetZoneSlot: ziel.type === 'hero' ? undefined : ziel.slotIdx,
        emoji: '💀',
        // Groesse skaliert mit den entfernten Countern — mehr Counter,
        // groesserer Schaedel.
        emojiStyle: { fontSize: Math.min(56, 26 + entfernt * 6) },
        duration: 650,
      });
      await engine._delay(560);
      engine._broadcastEvent('play_zone_animation', {
        type: 'explosion', owner: ziel.owner,
        heroIdx: ziel.heroIdx, zoneSlot: zielSlot,
      });
      await engine._delay(150);

      engine.log('basketskull', {
        player: engine.gs.players[pi]?.username,
        counters: entfernt, damage: schaden, target: ziel.cardName,
      });

      if (ziel.type === 'hero') {
        const held = engine.gs.players[ziel.owner]?.heroes?.[ziel.heroIdx];
        if (held && held.hp > 0) await ctx.dealDamage(held, schaden, 'destruction_spell');
      } else if (ziel.cardInstance) {
        await engine.actionDealCreatureDamage(
          { name: CARD_NAME, owner: pi, heroIdx: ctx.cardHeroIdx, heroOwner: ctx.cardHeroOwner ?? pi },   // Als Befund 29.9.: Brettseite des Wirkers
          ziel.cardInstance, schaden, 'destruction_spell',
          { sourceOwner: pi, canBeNegated: true },
        );
      }
      engine.sync();
    },
  },
};
