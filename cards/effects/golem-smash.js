// ═══════════════════════════════════════════
//  CARD EFFECT: "Golem Smash"
//  Attack (Normal, Lv 2, Fighting)
//
//  „You may delete up to 10 of the top cards of your deck when you play
//   this card. Choose a target and deal damage equal to the attacker's
//   Attack stat + 10 times the number of cards you delete with this
//   effect to it. This Attack can never hit more than 1 target at once."
//
//  ── AUSLEGUNG ─────────────────────────────────────────────────────
//  • „up to 10": Regler 0 … min(10, Deckgroesse). 0 ist erlaubt (reiner
//    ATK-Schlag). Abbruch des Reglers bricht die Karte ab.
//  • „when you play this card": die Menge wird VOR der Zielwahl gewaehlt
//    (der Schaden steht im Zielfenster), geloescht wird aber erst NACH der
//    Zielbestaetigung — ein Abbruch der Zielwahl kostet also keine Karte.
//    Geloescht wird ueber `actionMillCards(deleteMode)`; nur wirklich
//    geloeschte Karten zaehlen (eine gerettete/geblockte zaehlt nicht).
//  • Schaden = `hero.atk` des Angreifers + 10 × geloeschte Karten, Typ
//    `attack` (Angriffs-Plumbing wie bei Gravedigger Slap/Tiger Kick:
//    `_fireAttackDeclare`, Schutz/Surprise-Fenster). Nur ein Ziel.
//  • Auftritt: der Anwender RAMMT das Ziel (`play_ram_animation`), beim
//    Einschlag spritzen Eis-Partikel (`golem_smash_ice`).
// ═══════════════════════════════════════════

const CARD_NAME = 'Golem Smash';
const MAX_KARTEN = 10;
const PRO_KARTE = 10;

module.exports = {
  spellVisual: { impact: { type: 'golem_smash_ice' }, impactMs: 300 },

  requiresTarget: true,

  /** CPU: so viele Karten wie sinnvoll loeschen (Deck nicht unter 15 druecken). */
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic' || promptData?.title !== CARD_NAME) return undefined;
    if (promptData.type !== 'optionPicker') return undefined;
    const max = Number(promptData.sliderMax) || 0;
    const pi = engine?._cpuPlayerIdx;
    const deck = engine?.gs?.players?.[pi]?.mainDeck?.length || 0;
    return { optionId: String(Math.max(0, Math.min(max, deck - 15))) };
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const seite = ctx.cardHeroOwner ?? pi;
      const ps = gs.players[pi];
      const hero = ctx.attachedHero || gs.players[seite]?.heroes?.[heroIdx];
      if (!ps || !hero?.name || hero.hp <= 0) return;

      // ① Wie viele Karten? (0 … 10, hoechstens die Decksize)
      const max = Math.min(MAX_KARTEN, (ps.mainDeck || []).length);
      let menge = 0;
      if (max > 0) {
        const optionen = [];
        for (let k = 0; k <= max; k++) {
          optionen.push({ id: String(k), label: `Delete ${k} card${k === 1 ? '' : 's'}  →  +${k * PRO_KARTE} damage` });
        }
        const wahl = await engine.promptGeneric(pi, {
          type: 'optionPicker',
          renderAs: 'slider',
          sliderMin: 0, sliderMax: max, sliderStep: 1, sliderDefault: 0,
          sliderUnit: ' cards',
          title: CARD_NAME,
          showCard: CARD_NAME,
          description: `Delete up to ${MAX_KARTEN} of the top cards of your deck: +${PRO_KARTE} damage per card (on top of ${hero.atk || 0} ATK).`,
          options: optionen,
          cancellable: true,
        });
        if (!wahl || wahl.cancelled) { gs._spellCancelled = true; return; }
        menge = Math.max(0, Math.min(max, Number(wahl.optionId ?? wahl.id ?? 0) || 0));
      }

      // ② Ziel — Schadensanzeige mit der gewaehlten Menge.
      const vorschau = (hero.atk || 0) + menge * PRO_KARTE;
      const target = await ctx.promptDamageTarget({
        side: 'any',
        types: ['hero', 'creature'],
        damageType: 'attack',
        baseDamage: vorschau,
        title: CARD_NAME,
        description: `Delete ${menge} card${menge === 1 ? '' : 's'} and deal ${vorschau} damage to a target.`,
        confirmLabel: `🗿 Smash! (${vorschau})`,
        confirmClass: 'btn-danger',
        cancellable: true,
        condition: (t) => !(t.type === 'hero' && t.owner === seite && t.heroIdx === heroIdx),
      });
      if (!target) { gs._spellCancelled = true; return; }

      // ③ Karten loeschen (erst jetzt, nach der Bestaetigung).
      let geloescht = 0;
      if (menge > 0) {
        const karten = await engine.actionMillCards(pi, menge, {
          deleteMode: true, source: CARD_NAME, selfInflicted: true,
        });
        geloescht = Array.isArray(karten) ? karten.length : 0;
      }
      const damage = (hero.atk || 0) + geloescht * PRO_KARTE;

      const attackSource = { name: CARD_NAME, owner: pi, heroIdx, controller: pi, heroOwner: seite, usesHeroAtk: true };
      const finalDmg = await engine._fireAttackDeclare(attackSource, target, damage);

      // ④ Der Anwender rammt das Ziel; beim Einschlag Eis-Partikel.
      const tgtSlot = target.type === 'hero' ? undefined : target.slotIdx;
      engine._broadcastEvent('play_ram_animation', {
        sourceOwner: seite, sourceHeroIdx: heroIdx,
        targetOwner: target.owner, targetHeroIdx: target.heroIdx,
        targetZoneSlot: tgtSlot, cardName: hero.name, duration: 1200,
      });
      await engine._delay(150);
      engine._broadcastEvent('play_zone_animation', {
        type: 'golem_smash_ice', owner: target.owner, heroIdx: target.heroIdx,
        zoneSlot: target.type === 'hero' ? -1 : target.slotIdx,
      });
      await engine._delay(250);

      // ⑤ Schaden — genau EIN Ziel.
      if (target.type === 'hero') {
        const th = gs.players[target.owner]?.heroes?.[target.heroIdx];
        if (th && th.hp > 0) await engine.actionDealDamage(attackSource, th, finalDmg, 'attack');
      } else if (target.type === 'equip') {
        const inst = target.cardInstance || engine.cardInstances.find(c =>
          c.owner === target.owner && c.zone === 'support'
          && c.heroIdx === target.heroIdx && c.zoneSlot === target.slotIdx);
        if (inst) {
          await engine.actionDealCreatureDamage(attackSource, inst, finalDmg, 'attack',
            { sourceOwner: pi, canBeNegated: true });
        }
      }

      engine.log('golem_smash', {
        player: ps.username, hero: hero.name, deleted: geloescht,
        target: target.cardName, damage: finalDmg,
      });
      engine.sync();
    },
  },
};
