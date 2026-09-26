// ═══════════════════════════════════════════
//  CARD EFFECT: „Petrifier"
//  Spell (Normal, Decay Magic Lv2)
//
//  "Choose a target except the user and Stun it for 3 turns. Damage a
//   target Stunned by this effect would take becomes 0."
//
//  ── „EXCEPT THE USER" (Als Aenderung 26.9.) ──────────────────────
//  Der Wirker darf sich nicht selbst versteinern. „The user" ist, wer
//  den Zauber wirkt: normalerweise der Held (auf SEINER Seite — bei
//  einem geliehenen Helden also `cardHeroOwner`), und wenn eine Kreatur
//  ihn wirkt (Wolflesia-Art ueber `_spellCasterOverride`, aus einem
//  Kreatureffekt ueber `_spellCasterCreature`), diese Kreatur. Der Held
//  dahinter bleibt dann ein legales Ziel.
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
const FLUG_MS = 650;          // dunkler Stoss vom Wirker zum Ziel
const FLUCH_MS = 1700;        // `petrifier_fluch` auf dem Ziel (Client)
const STEIN_OBEN_MS = 1150;   // ab hier ist das Ziel ganz Stein

/**
 * ★ Bildfolge (Als Vorgabe 26.9.: „eine dunkle Magie, die das Ziel in
 * Stein verwandelt"): ein Stoss negativer Energie fliegt vom Wirker zum
 * Ziel (`darkBlast`, wie Memory Blast), dort oeffnet sich ein Runensiegel,
 * Ranken kriechen hoch und das Ziel versteinert von unten nach oben
 * (`petrifier_fluch`). Wartet, bis der Stein oben angekommen ist — erst
 * dann setzt `onPlay` den Stun, und die bleibende Versteinerungs-Optik
 * uebernimmt nahtlos. Dieselbe Folge spielt die Engine, wenn der Zauber
 * negiert wird (`spellVisual`). Wirkt eine Kreatur, lenkt die Engine
 * den Startpunkt selbst auf sie um (`_spellCasterOverride`).
 */
async function petrifierBilder(engine, { owner, heroIdx, ziel, negiert }) {
  if (!ziel) return;
  const zielSlot = ziel.type === 'hero' ? -1 : ziel.slotIdx;
  engine._broadcastEvent('play_projectile_animation', {
    sourceOwner: owner, sourceHeroIdx: heroIdx ?? -1,
    targetOwner: ziel.owner, targetHeroIdx: ziel.heroIdx,
    targetZoneSlot: ziel.type === 'hero' ? undefined : ziel.slotIdx,
    projectileShape: 'darkBlast', noTrail: true,
    power: 0.35, duration: FLUG_MS, sfx: 'elem_dark',
  });
  await engine._delay(FLUG_MS);
  if (negiert) return;   // abgewehrt: der Stoss kommt an, versteinert aber nicht
  engine._broadcastEvent('play_zone_animation', {
    type: 'petrifier_fluch', duration: FLUCH_MS,
    owner: ziel.owner, heroIdx: ziel.heroIdx, zoneSlot: zielSlot,
  });
  await engine._delay(STEIN_OBEN_MS);
}

/**
 * Liefert eine Pruefung „ist dieses Ziel der Wirker?" (s. Kopf).
 * Ziele haben die Form von `promptDamageTarget`:
 * `{ type, owner, heroIdx, slotIdx, cardInstance }`.
 */
function wirkerPruefer(ctx) {
  const gs = ctx._engine.gs;
  const ueber = gs._spellCasterOverride;           // Kreatur wirkt fuer ihren Helden
  if (ueber) {
    return (t) => t.type !== 'hero' && t.owner === ueber.owner
      && t.heroIdx === ueber.heroIdx && t.slotIdx === ueber.zoneSlot;
  }
  const kreatur = gs._spellCasterCreature;          // Zauber aus einem Kreatureffekt
  if (kreatur && kreatur.zone === 'support') {
    return (t) => t.type !== 'hero' && (t.cardInstance
      ? t.cardInstance.id === kreatur.id
      : (t.heroIdx === kreatur.heroIdx && t.slotIdx === kreatur.zoneSlot
        && t.owner === (kreatur.controller ?? kreatur.owner)));
  }
  const seite = ctx.cardHeroOwner ?? ctx.cardOwner;
  const heroIdx = ctx.cardHeroIdx;
  return (t) => t.type === 'hero' && t.owner === seite && t.heroIdx === heroIdx;
}

module.exports = {
  // ★★ v1181 — ENTKOPPELTE ZAUBERBILDER (Al 17.9.): Wird der Zauber
  // NEGIERT, laeuft sein Effekt-Rumpf nie — die Engine spielt dann diese
  // Bilder, damit der abgewehrte Zauber trotzdem zu sehen ist. Im
  // normalen Weg bleibt es bei den Broadcasts im Effekt selbst.
  // Dieselbe Bildfolge fuer die Engine (Negation: nur der Stoss zum Ziel).
  async spellVisual(engine, info) {
    const ziel = (info.targets || [])[0];
    await petrifierBilder(engine, {
      owner: info.owner, heroIdx: info.heroIdx, ziel, negiert: !!info.negiert,
    });
  },

  requiresTarget: true,

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;

      const istWirker = wirkerPruefer(ctx);
      const target = await ctx.promptDamageTarget({
        side: 'any',
        types: ['hero', 'creature'],
        title: CARD_NAME,
        appliesStatus: 'stunned',
        // „except the user" — der Wirker ist kein Ziel; er bleibt aber
        // AUSGEGRAUT sichtbar (Als Vorgabe 26.9.), statt zu verschwinden.
        condition: (t) => !istWirker(t),
        dimUnmetCondition: true,
        description: `Stun a target other than the caster for ${DAUER} turns. While Stunned this way, all damage it would take becomes 0.`,
        confirmLabel: '🗿 Petrify!',
        cancellable: true,
      });
      if (!target) { gs._spellCancelled = true; return; }

      await petrifierBilder(engine, {
        owner: ctx.cardHeroOwner ?? pi, heroIdx: ctx.cardHeroIdx, ziel: target,
      });

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
