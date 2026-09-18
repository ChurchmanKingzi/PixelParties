// ═══════════════════════════════════════════
//  CARD EFFECT: „Last Resort"
//  Spell (Destruction Magic Lv 3, PP …)
//
//  „THIS SPELL'S LEVEL CAN NEVER BE REDUCED. Choose a target and deal
//   damage equal to twice the user's current HP to it. The user is
//   defeated afterwards. If all Heroes of both players are defeated
//   after this Spell resolved, you win the game. You cannot deal any
//   other damage the turn you activate this card."
//
//  ★ ERSTER SATZ NEU (Al 15.9.): „Sein Level hat jetzt eine
//  'non-reducable'-Klausel, was sehr wichtig fuer Balancing ist."
//  Ohne sie liesse sich ein Lv3-Zauber mit Sofortsieg-Klausel
//  verbilligen — Damus senkt Armageddon, Ethan senkt jeden Spell, und
//  Abilities tun es ebenfalls. Der Vertrag `levelCannotBeReduced`
//  schneidet JEDE dieser Quellen ab, ganz vorn in
//  `_applyCardLevelReductions`.
//
//  ★ NICHT VERWECHSELN mit dem vorhandenen `cannotBeReduced` — das
//  betrifft SCHADEN.
//
//  (Letzter Satz neu — Als Vorgabe 12.9., uebernommen von „Flame
//  Avalanche".)
//
//  BAUART
//  ──────
//  • ★ DER SCHADEN STEHT VOR DEM TOD: „twice the user's CURRENT HP" —
//    gelesen wird der Stand VOR der eigenen Niederlage. Waere es
//    andersherum, waere es immer 0.
//
//  • ★ DIE SPIELENDE-PRUEFUNG WIRD BIS ZUM SCHLUSS ANGEHALTEN
//    (`_deferGameOverCheck`, Bauform Bunny Bombs). Sonst wertete die
//    Engine schon nach dem Schaden aus — der Nutzer lebte da noch, und
//    der Satz „if all Heroes of BOTH players are defeated" koennte gar
//    nicht zutreffen.
//
//  • ★ DER GEWINN BEI DOPPELTER AUSLOESCHUNG laeuft ueber
//    `gs._drawLoserIdx` — dieselbe Stelle, an der Bunny Bombs den
//    Verlierer benennt, nur andersherum: hier verliert der GEGNER.
//    Ohne diesen Hinweis entschiede die Schleifenreihenfolge
//    (Spieler 0 verloere stillschweigend).
//
//  • Die Niederlage des Nutzers ist KEIN Schaden, sondern
//    `actionDefeatHero` mit `respectFirstTurnProtection: false`: ein
//    freiwilliges Selbstopfer darf nicht am eigenen Schutzschild
//    scheitern.
//
//  • ★ ANIMATION (v1027): erst der Ansturm (`play_ram_animation`,
//    Bauform Phoenix Tackle), dann im Moment der Beruehrung die
//    EIGENE grosse Explosion `last_resort_blast` — Kern, Feuerball
//    ueber drei Zonenbreiten, zwei Druckwellen, Truemmer und Funken,
//    dazu ein schwerer Bildruettler. Dieselbe Explosion noch einmal
//    auf dem Platz des Nutzers, wenn er faellt.
//
//  • Die Schadensperre (`ps.damageLocked`) wird ZULETZT gesetzt — vorher
//    wuerde sie den eigenen Treffer blocken. Und wie bei Flame
//    Avalanche ist die Karte gar nicht erst spielbar, wenn in diesem
//    Zug schon Schaden ausgeteilt wurde.
// ═══════════════════════════════════════════

const CARD_NAME = 'Last Resort';

module.exports = {
  // ★★ v1182 — ENTKOPPELTE BILDER (CARD_API): wird die Karte NEGIERT,
  // laeuft ihr Effekt-Rumpf nie — die Engine spielt dann diese Bilder.
  // Im normalen Weg bleibt es bei den Broadcasts im Effekt selbst.
  spellVisual: {
    impact: { type: 'last_resort_blast' }, impactMs: 260,
  },

  // ★ „This Spell's level can never be reduced." (v1104)
  //
  // ★ WISDOM UND DIVINITY BLEIBEN MOEGLICH (Al 15.9.). Sie senken die
  // Stufe nicht, sondern stehen fuer die fehlende Ability ein —
  // eigener Motor-Weg (`coverLevelGap`), von dieser Sperre unberuehrt.
  // Die Karte bleibt also mit Divinity 3 oder Wisdom 3 spielbar, und
  // ihre Stufe bleibt dabei 3.
  levelCannotBeReduced: true,

  requiresTarget: true,

  // Wie „Flame Avalanche": wer in diesem Zug schon Schaden ausgeteilt
  // hat, kann die Karte nicht mehr spielen.
  spellPlayCondition(gs, playerIdx) {
    return !gs.players[playerIdx]?.dealtDamageToOpponent;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const oi = pi === 0 ? 1 : 0;
      const heroIdx = ctx.cardHeroIdx;
      const ps = gs.players[pi];
      const nutzer = ps?.heroes?.[heroIdx];
      if (!nutzer?.name || nutzer.hp <= 0) { gs._spellCancelled = true; return; }

      // ★ Der Stand VOR dem eigenen Tod (s. Kopf).
      const schaden = Math.max(0, nutzer.hp) * 2;

      const ziel = await ctx.promptDamageTarget({
        side: 'any',
        types: ['hero', 'creature'],
        damageType: 'destruction_spell',
        baseDamage: schaden,
        title: CARD_NAME,
        description: `Deal ${schaden} damage (twice ${nutzer.name}'s current HP). `
          + `${nutzer.name} is defeated afterwards.`,
        confirmLabel: `💥 ${schaden} Damage!`,
        confirmClass: 'btn-danger',
        cancellable: true,
      });
      if (!ziel) { gs._spellCancelled = true; return; }

      const quelle = { name: CARD_NAME, owner: pi, controller: pi, heroIdx };

      // ── Spielende anhalten und den Verlierer benennen ───────────
      gs._deferGameOverCheck = (gs._deferGameOverCheck || 0) + 1;
      const vorherigerVerlierer = gs._drawLoserIdx;
      gs._drawLoserIdx = oi;                    // ★ „you win the game"
      try {
        // ── ★ ANSTURM UND EINSCHLAG (Als Vorgabe 12.9.) ───────────
        // Bauform „Phoenix Tackle": der Nutzer wirft sich selbst ins
        // Ziel (`play_ram_animation`), und im Moment der Beruehrung —
        // bei ~12 % der Flugdauer — zuendet die Explosion. Der
        // Ruecksprung des Rams geht in ihr unter; er stirbt gleich
        // darauf ohnehin.
        const zielSlot = ziel.type === 'hero' ? -1 : ziel.slotIdx;
        engine._broadcastEvent('play_ram_animation', {
          sourceOwner: pi, sourceHeroIdx: heroIdx,
          targetOwner: ziel.owner, targetHeroIdx: ziel.heroIdx,
          targetZoneSlot: zielSlot,
          cardName: nutzer.name, duration: 1200,
        });
        await engine._delay(150);

        engine._broadcastEvent('play_screen_shake', { intensity: 'heavy' });
        engine._broadcastEvent('play_zone_animation', {
          type: 'last_resort_blast', owner: ziel.owner,
          heroIdx: ziel.heroIdx, zoneSlot: zielSlot, duration: 1400,
        });
        await engine._delay(420);

        if (ziel.type === 'hero') {
          const th = gs.players[ziel.owner]?.heroes?.[ziel.heroIdx];
          if (th?.name && th.hp > 0) {
            await engine.actionDealDamage(quelle, th, schaden, 'destruction_spell');
          }
        } else {
          const inst = ziel.cardInstance || engine.cardInstances.find(c =>
            c.owner === ziel.owner && c.zone === 'support'
            && c.heroIdx === ziel.heroIdx && c.zoneSlot === ziel.slotIdx);
          if (inst) {
            await engine.actionDealCreatureDamage(quelle, inst, schaden, 'destruction_spell',
              { sourceOwner: pi, canBeNegated: true });
          }
        }

        // ── „The user is defeated afterwards." ────────────────────
        const lebt = gs.players[pi]?.heroes?.[heroIdx];
        if (lebt?.name && lebt.hp > 0) {
          // Der Nutzer geht in derselben Detonation unter — dieselbe
          // Explosion, nur auf SEINEM Platz.
          engine._broadcastEvent('play_zone_animation', {
            type: 'last_resort_blast', owner: pi, heroIdx, zoneSlot: -1, duration: 1400,
          });
          await engine._delay(260);
          await engine.actionDefeatHero(quelle, lebt, {
            sourceName: CARD_NAME,
            respectFirstTurnProtection: false,   // freiwilliges Selbstopfer
            skipAllDeadCheck: true,              // die Pruefung kommt gleich, einmal
          });
        }
      } finally {
        gs._deferGameOverCheck = Math.max(0, (gs._deferGameOverCheck || 1) - 1);
      }

      // ── Jetzt EINMAL auswerten, Hinweis noch gesetzt ────────────
      try {
        await engine.checkAllHeroesDead();
      } finally {
        if (vorherigerVerlierer === 0 || vorherigerVerlierer === 1) gs._drawLoserIdx = vorherigerVerlierer;
        else delete gs._drawLoserIdx;
      }

      // ── Zuletzt: keine weiteren Treffer in diesem Zug ───────────
      ps.damageLocked = true;
      engine.log('last_resort', {
        player: ps.username, hero: nutzer.name, damage: schaden,
      });
      engine.log('damage_locked', { player: ps.username, by: CARD_NAME });
      engine.sync();
    },
  },
};
