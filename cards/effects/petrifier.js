// ═══════════════════════════════════════════
//  CARD EFFECT: „Petrifier"
//  Spell (Normal, Decay Magic Lv2)
//
//  "Choose a target and Stun it for 3 turns. Damage a target Stunned by
//   this effect would take becomes 0."
//
//  ── DIE NULL HAENGT AM STUN, NICHT AN EINEM EIGENEN STATUS ────────
//  „a target STUNNED BY THIS EFFECT" — laeuft die Betaeubung aus, faellt
//  die Unverwundbarkeit mit. Deshalb kein zweiter Status und kein
//  Ablaufdatum: der Marker `_petrified` sitzt AM Stun und verschwindet
//  mit ihm.
//
//  ★ GEMEINSAMER MARKER, kein karteneigener. Die Versteinerungs-Optik
//  gab es schon — „Cardinal Beast Baihu" stempelte `_baihuPetrify`, und
//  Client, CPU und Schadenspfad lasen genau diesen einen Namen. Ohne
//  Verallgemeinerung haette jede weitere Versteinerungs-Karte ihren
//  eigenen Zweig an vier Stellen gebraucht. Seit v1085 ist `_petrified`
//  der gemeinsame Name; Baihu setzt ihn mit, `_baihuPetrify` bleibt
//  fuer laufende Spielstaende daneben stehen.
//
//  ── WAS DER MARKER BEWIRKT ───────────────────────────────────────
//  ① Optik: Graustufen-Filter plus Steinschicht am Ziel, solange der
//     Stun anliegt (Als Vorgabe 14.9.) — fuer Helden UND Kreaturen.
//  ② Schaden: 0 auf beiden Wegen (`actionDealDamage` direkt hinter
//     `damage_proof`, Kreaturen im Schadens-Batch).
//  ③ CPU: das Ziel gilt als „nicht lohnend" — dieselbe Bewertung, die
//     Baihu schon hatte.
//
//  ★ TRUE DAMAGE GEHT DURCH. Beide Nullstellen sitzen im normalen
//  Schadenspfad; `actionDealTrueDamage` laeuft daran vorbei — dieselbe
//  Abgrenzung wie bei `damage_proof` (Storm Piano) und ausdruecklich so
//  dokumentiert. Der Kartentext nennt keine Ausnahme fuer True Damage,
//  aber das Haus behandelt „prevent any damage" durchgaengig so.
// ═══════════════════════════════════════════

const CARD_NAME = 'Petrifier';
const DAUER = 3;

module.exports = {
  // ★★ v1181 — ENTKOPPELTE ZAUBERBILDER (Al 17.9.): Wird der Zauber
  // NEGIERT, laeuft sein Effekt-Rumpf nie — die Engine spielt dann diese
  // Bilder, damit der abgewehrte Zauber trotzdem zu sehen ist. Im
  // normalen Weg bleibt es bei den Broadcasts im Effekt selbst.
  spellVisual: { impact: { type: 'petrify' }, impactMs: 260 },

  requiresTarget: true,

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;

      const target = await ctx.promptDamageTarget({
        side: 'any',
        types: ['hero', 'creature'],
        title: CARD_NAME,
        appliesStatus: 'stunned',
        description: `Stun a target for ${DAUER} turns. While Stunned this way, all damage it would take becomes 0.`,
        confirmLabel: '🗿 Petrify!',
        cancellable: true,
      });
      if (!target) { gs._spellCancelled = true; return; }

      engine._broadcastEvent('play_zone_animation', {
        type: 'petrify',
        owner: target.owner, heroIdx: target.heroIdx,
        zoneSlot: target.type === 'hero' ? -1 : target.slotIdx,
      });
      await engine._delay(420);

      if (target.type === 'hero') {
        const hero = gs.players[target.owner]?.heroes?.[target.heroIdx];
        if (!hero?.name || hero.hp <= 0) return;
        await engine.addHeroStatus(target.owner, target.heroIdx, 'stunned', {
          duration: DAUER,
          appliedBy: pi,
          source: CARD_NAME,
          // ★ Der Marker sitzt AM Stun — er faellt mit ihm.
          _petrified: true,
        });
      } else {
        const inst = target.cardInstance || engine.cardInstances.find(c =>
          c.owner === target.owner && c.zone === 'support'
          && c.heroIdx === target.heroIdx && c.zoneSlot === target.slotIdx);
        if (!inst || inst.zone !== 'support') return;
        const applied = await engine.applyCreatureStatus(inst, 'stunned', {
          duration: DAUER,
          sourceOwner: pi,
          source: CARD_NAME,
        });
        // Kreaturen-Status sind blosse Praesenz-Flaggen — der Marker
        // kommt als Begleitzaehler daneben, wie bei Baihu.
        if (applied) inst.counters._petrified = 1;
      }

      engine.log('petrifier', {
        player: gs.players[pi]?.username, target: target.cardName, dauer: DAUER,
      });
      engine.sync();
    },
  },
};
