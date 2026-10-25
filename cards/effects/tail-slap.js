'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Tail Slap"  (W76b)
//  Attack (Normal, Lv1, Fighting)
//
//  „Your opponent may defeat any number of Creatures they control. Then, choose a target and deal damage equal to the attacker's Attack stat to it. That damage is increased by 50 for
//   every Creature your opponent controls."
//
//  ── AUSLEGUNG ───────────────────────────────────────────────────────────
//  • Ablauf in Textreihenfolge: ① der GEGNER wählt, welche seiner Creatures er besiegt (beliebig viele, auch keine; abbrechen = keine) ② der Anwender wählt das Ziel ③ Schaden =
//    ATK des Angreifers + 50 × (Creatures, die der Gegner NACH ① noch kontrolliert). Das Opfern lohnt also: jede besiegte Creature senkt den Schaden um 50.
//  • „Creatures they control": offene (aufgedeckte) Creatures in Support Zonen, die der Gegner KONTROLLIERT (Kontrolle statt Seite). Besiegt wird über `actionDestroyCard` mit dieser Karte als
//    Quelle — Schutz (Cardinal Beasts „unaffected", Defending the Gate …) lässt eine Creature stehen; sie zählt dann weiter mit. Unbesiegbare werden gar nicht erst angeboten.
//  • Die Zahl der Creatures wird BEIM SCHLAG gezählt (nach ①). Die Vorschau im Zielfenster zeigt sie bereits.
//  • Ziel: jedes Ziel (Held oder Creature, beide Seiten) außer dem Angreifer selbst — wie bei Golem Smash. Schaden-Typ `attack` mit der Angriffs-Maschinerie (`_fireAttackDeclare`).
//  • Wegen ① ist der Abbruch der Zielwahl nur möglich, wenn der Gegner nichts besiegt hat (sonst wäre das Opfer umsonst gewesen).
//
//  ── Bild und Klang ─────────────────────────────────────────────────────
//  Der Angreifer RAMMT RÜCKWÄRTS: `play_ram_animation` mit `rueckwaerts: true` (der Held dreht sich um, holt aus, die Unterkante voran), beim Aufprall `tail_slap_hit` (Pixelart: Staubwolke,
//  Schwanz-Schlagbogen, Sterne). Klang in ZONE_ANIM_SFX.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Tail Slap';
const PRO_KREATUR = 50;
const RAMM_MS = 1200;

/** Offene Creatures, die `pi` kontrolliert (Support Zonen). */
function kreaturenVon(engine, pi) {
  const db = engine._getCardDB();
  return engine.cardInstances.filter(inst => {
    if (inst.zone !== 'support' || inst.faceDown) return false;
    if ((inst.controller ?? inst.owner) !== pi) return false;
    const cd = engine.getEffectiveCardData(inst) || db[inst.name];
    return !!cd && hasCardType(cd, 'Creature');
  });
}

module.exports = {
  spellVisual: { impact: { type: 'tail_slap_hit' }, impactMs: 360 },

  requiresTarget: true,
  neverMultiTarget: true,   // genau EIN Ziel; die Opfer des Gegners sind Kosten, keine Ziele

  /** CPU als GEGNER: besiegt nie freiwillig eine eigene Creature (jede kostet nur Werte, spart 50 Schaden). Die Puzzle-CPU würde sonst blind das erste Ziel wählen. */
  cpuResponse(engine, kind, payload) {
    if (kind === 'effectTarget' && payload?.config?._tailSlapOpfer) return [];
    return undefined;
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
      const opp = engine.opponentOf(pi);
      const quelleKarte = { name: CARD_NAME, owner: pi, controller: pi, heroIdx, heroOwner: seite, cardType: 'Attack' };

      // ① Der Gegner darf beliebig viele seiner Creatures besiegen.
      let besiegt = 0;
      const eigene = kreaturenVon(engine, opp).filter(inst => !inst.counters?._cardinalImmune);
      if (eigene.length > 0) {
        const kandidaten = eigene.map(inst => {
          const s = engine.physicalSide(inst);
          return { id: `equip-${s}-${inst.heroIdx}-${inst.zoneSlot}`, type: 'equip', owner: s, heroIdx: inst.heroIdx, slotIdx: inst.zoneSlot, cardName: inst.name, cardInstance: inst };
        });
        const gewaehlt = await engine.promptEffectTarget(opp, kandidaten, {
          title: CARD_NAME, source: CARD_NAME, _tailSlapOpfer: true,
          description: `Defeat any number of your Creatures? Each Creature you keep adds ${PRO_KREATUR} damage to the Tail Slap.`,
          confirmLabel: '🐍 Defeat selected', confirmClass: 'btn-danger',
          cancellable: true, minRequired: 0, maxTotal: kandidaten.length,
        });
        const ids = Array.isArray(gewaehlt) ? gewaehlt : [];
        for (const id of ids) {
          const k = kandidaten.find(t => t.id === id);
          const inst = k?.cardInstance;
          if (!inst || inst.zone !== 'support') continue;
          await engine.actionDestroyCard(quelleKarte, inst, { sourceOwner: pi, sourceName: CARD_NAME, fireCreatureDeath: true });
          if (inst.zone !== 'support') besiegt++;
        }
      }

      // ② Ziel — der Schaden steht schon mit der Zahl der VERBLEIBENDEN Creatures im Fenster.
      const verbleibend = kreaturenVon(engine, opp).length;
      const vorschau = (hero.atk || 0) + PRO_KREATUR * verbleibend;
      const target = await ctx.promptDamageTarget({
        side: 'any',
        types: ['hero', 'creature'],
        damageType: 'attack',
        baseDamage: vorschau,
        title: CARD_NAME,
        description: `Deal ${hero.atk || 0} (ATK) + ${PRO_KREATUR} × ${verbleibend} Creature${verbleibend === 1 ? '' : 's'} = ${vorschau} damage to a target.`,
        confirmLabel: `🐍 Tail Slap! (${vorschau})`,
        confirmClass: 'btn-danger',
        cancellable: besiegt === 0,
        condition: (t) => !(t.type === 'hero' && t.owner === seite && t.heroIdx === heroIdx),
      });
      if (!target) { if (besiegt === 0) gs._spellCancelled = true; return; }

      // Die Zahl direkt vor dem Schlag (zwischen Wahl und Schlag kann sich etwas geändert haben).
      const anzahl = kreaturenVon(engine, opp).length;
      const damage = (hero.atk || 0) + PRO_KREATUR * anzahl;
      const attackSource = { name: CARD_NAME, owner: pi, heroIdx, controller: pi, heroOwner: seite, usesHeroAtk: true };
      const finalDmg = await engine._fireAttackDeclare(attackSource, target, damage);

      // ③ Der Angreifer rammt RÜCKWÄRTS ins Ziel.
      const tgtSlot = target.type === 'hero' ? undefined : target.slotIdx;
      await engine.rammeBisKontakt({
        sourceOwner: seite, sourceHeroIdx: heroIdx, targetOwner: target.owner, targetHeroIdx: target.heroIdx,
        targetZoneSlot: tgtSlot, cardName: hero.name, duration: RAMM_MS, rueckwaerts: true,
      });
      engine._broadcastEvent('play_zone_animation', { type: 'tail_slap_hit', owner: target.owner, heroIdx: target.heroIdx, zoneSlot: target.type === 'hero' ? -1 : target.slotIdx, duration: 700 });
      await engine._delay(220);

      if (target.type === 'hero') {
        const th = gs.players[target.owner]?.heroes?.[target.heroIdx];
        if (th && th.hp > 0) await engine.actionDealDamage(attackSource, th, finalDmg, 'attack');
      } else if (target.type === 'equip') {
        const inst = target.cardInstance || engine.cardInstances.find(c =>
          c.owner === target.owner && c.zone === 'support' && c.heroIdx === target.heroIdx && c.zoneSlot === target.slotIdx);
        if (inst) await engine.actionDealCreatureDamage(attackSource, inst, finalDmg, 'attack', { sourceOwner: pi, canBeNegated: true });
      }

      engine.log('tail_slap', { player: ps.username, hero: hero.name, defeated: besiegt, creaturesLeft: anzahl, target: target.cardName, damage: finalDmg });
      engine.sync();
    },
  },
};
