// ═══════════════════════════════════════════
//  CARD EFFECT: "Massacre"
//  Attack (Fighting Lv3, Normal)
//
//  „Choose a target and deal damage equal to the attacker's Attack stat
//   to it. This damage is increased by 50 times the number of Creatures
//   on the board."
//
//  ── AUSLEGUNG ─────────────────────────────────────────────────────
//  • „the attacker's Attack stat" = der AKTUELLE Wert (`hero.atk`),
//    nicht `baseAtk`. Quick Attack sagt ausdruecklich „Base Attack
//    stat" und liest deshalb `baseAtk` — hier steht das Wort nicht,
//    also zaehlen Fighting-Stapel und Buffs mit.
//  • „the number of Creatures on the board" = ALLE Creatures, beide
//    Seiten, die eigenen eingeschlossen — der Text grenzt nicht ein.
//    Gezaehlt wird derselbe Bestand, den auch die Engine als Creature
//    fuehrt: Support Zone, aufgedeckt, kein `treatAsEquip`, Kartentyp
//    ueber `getEffectiveCardData` (damit eine Artifact Creature wie
//    Powder Keg und jeder Token mitzaehlen — sie SIND in der Zone
//    Creatures).
//  • Die Zahl wird EINMAL beim Spielen ermittelt, vor dem Angriffs-
//    Fenster. Stirbt waehrend der Aufloesung etwas, bleibt der Bonus.
//  • Der Bonus laeuft ueber denselben Betrag wie der Grundschaden,
//    d.h. er geht durch `_fireAttackDeclare` und alle
//    `beforeDamage`-Haken — kein zweiter, separater Schadensschub.
//
//  Aufbau ansonsten wie Quick Attack (das Muster fuer einzelzielige
//  Attacks): Ziel waehlen, Angriff ansagen, Animation, Schaden.
//  KEINE Zusatzaktion — die Karte sagt nichts dergleichen.
//
//  ── ANIMATION ─────────────────────────────────────────────────────
//  `massacre` (neu, app-board.jsx): zehn gestaffelte Schnitte aus
//  wechselnden Richtungen, Blutspritzer mit Schwerkraft, roter
//  Nachhall. Laeuft ~900 ms; der Schaden faellt bewusst MITTEN in die
//  Serie (nach ~420 ms), damit Trefferzahl und Klingen zusammenfallen
//  statt danach zu kommen.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Massacre';
const PRO_CREATURE = 50;

/** Alle Creatures auf dem Brett — beide Seiten, Tokens eingeschlossen. */
function creaturesAufDemBrett(engine) {
  const cardDB = engine._getCardDB();
  let n = 0;
  for (const inst of engine.cardInstances) {
    if (inst.zone !== 'support' || inst.faceDown) continue;
    if (inst.counters?.treatAsEquip) continue;
    const cd = engine.getEffectiveCardData(inst) || cardDB[inst.name];
    if (!cd || !hasCardType(cd, 'Creature')) continue;
    n++;
  }
  return n;
}

module.exports = {
  requiresTarget: true,
  // ^ Tagged for Blinded gating — siehe cards/effects/_hooks.js.

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const ps = gs.players[pi];
      const hero = ps?.heroes?.[heroIdx];
      if (!hero?.name || hero.hp <= 0) return;

      const atk = Math.max(0, hero.atk || 0);
      const creatures = creaturesAufDemBrett(engine);
      const bonus = creatures * PRO_CREATURE;
      const schaden = atk + bonus;

      const target = await ctx.promptDamageTarget({
        side: 'any',
        types: ['hero', 'creature'],
        damageType: 'attack',
        baseDamage: schaden,
        title: CARD_NAME,
        description: `Deal ${atk} ATK + ${bonus} (${creatures} Creature${creatures === 1 ? '' : 's'} on the board) = ${schaden} damage to one target.`,
        confirmLabel: `🩸 Massacre! (${schaden})`,
        confirmClass: 'btn-danger',
        cancellable: true,
        // Der Angreifer zerlegt sich nicht selbst (gleiche Schranke wie
        // Quick Attack / Rocket Fist).
        condition: (t) => !(t.type === 'hero' && t.owner === pi && t.heroIdx === heroIdx),
      });
      if (!target) return;

      const tgtOwner = target.owner;
      const tgtHeroIdx = target.heroIdx;
      const tgtZoneSlot = target.type === 'hero' ? -1 : target.slotIdx;

      // Angriffs-Ansage VOR Animation und Schaden: Doqs Rateeffekt,
      // Darges Pfeil-Bonus und alles andere „wenn dieser Held
      // angreift" haengt hier dran und darf den Betrag noch aendern.
      const attackSource = { name: CARD_NAME, owner: pi, heroIdx, controller: pi };
      const finalDmg = await engine._fireAttackDeclare(attackSource, target, schaden);

      engine._broadcastEvent('play_zone_animation', {
        type: 'massacre', owner: tgtOwner,
        heroIdx: tgtHeroIdx, zoneSlot: tgtZoneSlot,
      });
      // Zweiter Schlag mitten in der Schnittserie. `massacre_second`
      // hat BEWUSST kein Bild: der Zeichner findet zum Namen keine
      // Komponente und rendert nichts, der Klang-Verteiler feuert
      // trotzdem (`ZONE_ANIM_SFX`, dort mit `delay: 300`). So klammern
      // zwei Schlaege die zehn Schnitte, ohne dass ein zweites
      // Schnittbild darueberliegt.
      engine._broadcastEvent('play_zone_animation', {
        type: 'massacre_second', owner: tgtOwner,
        heroIdx: tgtHeroIdx, zoneSlot: tgtZoneSlot,
      });
      await engine._delay(420);

      if (target.type === 'hero') {
        const targetHero = gs.players[tgtOwner]?.heroes?.[tgtHeroIdx];
        if (targetHero && targetHero.hp > 0) {
          await engine.actionDealDamage(attackSource, targetHero, finalDmg, 'attack');
        }
      } else if (target.type === 'equip') {
        const inst = target.cardInstance || engine.cardInstances.find(c =>
          c.owner === tgtOwner && c.zone === 'support'
          && c.heroIdx === tgtHeroIdx && c.zoneSlot === target.slotIdx);
        if (inst) {
          await engine.actionDealCreatureDamage(
            attackSource, inst, finalDmg, 'attack',
            { sourceOwner: pi, canBeNegated: true },
          );
        }
      }

      // Rest der Schnittserie ausklingen lassen.
      await engine._delay(360);

      engine.log('massacre', {
        player: ps.username, hero: hero.name,
        target: target.cardName, damage: finalDmg,
        creatures, bonus,
      });
      engine.sync();
    },
  },

  cpuMeta: {
    // Der Bonus haengt am BRETT, nicht an der Hand: je voller das Feld,
    // desto besser. Ohne diesen Hinweis bewertet die CPU die Karte nach
    // dem nackten ATK-Wert und haelt sie fuer schwach.
    scalesWithBoardCreatures: PRO_CREATURE,
  },
};
