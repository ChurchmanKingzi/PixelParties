// ═══════════════════════════════════════════
//  CARD EFFECT: "Surefire Shot"
//  Attack (Fighting Lv1, Normal) — PP MS1
//
//  „Choose a target and deal damage equal to the attacker's Attack stat to
//   it. This Attack can always choose any target and damage it deals cannot
//   be reduced or negated. This Attack cannot be negated or reacted to."
//
//  ── Bauteile (Vorbilder: Piercer of Heavens, Midnight Assault) ─────
//  • „can always choose any target": Skript-Flag `ignoresTargetingRestrictions`
//    (Untargetable/Taunt/Ausschlusslisten gelten nicht) und
//    `_skipPostTargetReactions` an der Zielwahl.
//  • „damage cannot be reduced or negated": TRUE DAMAGE über
//    `engine.actionDealTrueDamage` (Typ 'attack' — Waffen-/Attack-Listener, Statistik).
//    Der Angriffsbonus-Hook (`onAttackDeclare`, Doq & Co.) läuft wie bei jeder
//    Attack (`engine._fireAttackDeclare`), bevor der Betrag feststeht.
//  • „cannot be negated or reacted to": `opponentCannotReact` (Kettenfenster der
//    Karte selbst), `cannotBeNegated` (Brett-Wächter/Spell-Schilde) und während
//    der Auflösung `engine.ohneGegnerReaktion` (Hand, Surprise, Kette, Brett).
//  • Betrag: ATK des Angreifers (`hero.atk`, aktueller Wert).
//  • Abbruch der Zielwahl legt die Karte zurück auf die Hand (`_spellCancelled`).
//
//  ── Animation ─────────────────────────────────────────────────────
//  `play_projectile_animation` mit `projectileShape: 'surefire'`: ein
//  schneeweisser Pfeil, extrem schnell (~170 ms), mit gleissender Leuchtspur,
//  Mündungsblitz und Einschlagsblitz (Client: `WeissPfeil`). Der Schaden fällt
//  im Moment des Einschlags.
// ═══════════════════════════════════════════

const CARD_NAME = 'Surefire Shot';
const FLUG_MS = 170;       // Flugzeit des Pfeils
const EINSCHLAG_MS = 90;   // Nachlauf bis der Blitz sitzt, dann fällt der Schaden

module.exports = {
  requiresTarget: true,
  ignoresTargetingRestrictions: true,
  opponentCannotReact: true,
  cannotBeNegated: true,

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const heroOwner = ctx.cardHeroOwner ?? pi;
      const hero = ctx.attachedHero || gs.players[heroOwner]?.heroes?.[heroIdx];   // geliehener Held: physische Seite
      if (!hero?.name || hero.hp <= 0) return;
      const atk = Math.max(0, Math.floor(hero.atk || 0));

      await engine.ohneGegnerReaktion(pi, async () => {
        const target = await ctx.promptDamageTarget({
          side: 'any',
          types: ['hero', 'creature'],
          damageType: 'attack',
          baseDamage: atk,
          title: CARD_NAME,
          description: `Deal ${atk} damage that cannot be reduced or negated. Nothing can hide from the shot.`,
          confirmLabel: `🏹 Surefire! (${atk})`,
          confirmClass: 'btn-danger',
          cancellable: true,
          // Der Angreifer selbst ist kein Ziel (wie bei jeder Attack).
          condition: (t) => !(t.type === 'hero' && t.owner === heroOwner && t.heroIdx === heroIdx),
          _skipPostTargetReactions: true,
        });
        if (!target) { gs._spellCancelled = true; return; }   // Abbruch: Karte zurück auf die Hand

        const source = { name: CARD_NAME, owner: pi, heroIdx, controller: pi, usesHeroAtk: true, cardType: 'Attack' };
        if (heroOwner !== pi) source.heroOwner = heroOwner;
        // Angriffsbonus-Fenster (Doq & Co.) — wie ctx.executeAttack.
        const betrag = await engine._fireAttackDeclare(source, target, atk);

        engine._broadcastEvent('play_projectile_animation', {
          sourceOwner: heroOwner, sourceHeroIdx: heroIdx,
          targetOwner: target.owner, targetHeroIdx: target.heroIdx,
          targetZoneSlot: target.type === 'hero' ? undefined : target.slotIdx,
          projectileShape: 'surefire', duration: FLUG_MS, noTrail: true,
        });
        await engine._delay(FLUG_MS + EINSCHLAG_MS);

        let dealt = 0;
        if (target.type === 'hero') {
          const ziel = gs.players[target.owner]?.heroes?.[target.heroIdx];
          if (ziel && ziel.hp > 0) ({ dealt } = await engine.actionDealTrueDamage(source, ziel, betrag, { type: 'attack' }));
        } else if (target.cardInstance) {
          ({ dealt } = await engine.actionDealTrueDamage(source, target.cardInstance, betrag, { type: 'attack' }));
        }
        engine.log('surefire_shot', {
          player: gs.players[pi]?.username, target: target.cardName, damage: betrag, dealt,
        });
        engine.sync();
      });
    },
  },
};
