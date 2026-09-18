// ═══════════════════════════════════════════
//  CARD EFFECT: „Alluring Light"
//  Spell (Normal, Decay Magic Lv1)
//
//  "Choose a Hero your opponent controls and a target you control. Your
//   chosen target takes damage equal to the chosen Hero's Attack stat.
//   This is treated as the chosen Hero attacking your chosen target."
//
//  ── DIE KARTE DREHT DIE RICHTUNG UM ──────────────────────────────
//  ★ Der SCHADEN GEHT AUF DIE EIGENE SEITE. Man waehlt einen
//  GEGNERISCHEN Helden als Angreifer und ein EIGENES Ziel als Opfer.
//  Das liest sich beim Ueberfliegen wie ein gewoehnlicher Angriff und
//  ist das Gegenteil — wer die Seiten vertauscht, baut eine voellig
//  andere Karte.
//
//  Der Sinn steckt in der letzten Zeile: „treated as the chosen Hero
//  ATTACKING" — der Angriff zaehlt dem GEGNER, samt allem, was daran
//  haengt (seine Angriffszaehler, Rueckstoss-Effekte wie „Rioting
//  Village", Gegenschlaege, alles was auf „ein Held greift an" hoert).
//  Man laesst den Gegner auf sich selbst einschlagen.
//
//  ── „THE CHOSEN HERO'S ATTACK STAT" ──────────────────────────────
//  Der AKTUELLE Wert des GEGNERISCHEN Helden (`hero.atk`), nicht
//  `baseAtk` — inklusive aller Buffs und Ausruestung. Deshalb ist die
//  Karte auch eine der 48, die den Attack stat lesen, ohne selbst ein
//  Attack zu sein (siehe Rioting Village: Statverdopplung wirkt hier
//  mit, Schadensverdopplung haette es nicht getan).
//
//  ── ANIMATION (Als Vorgabe 14.9.) ────────────────────────────────
//  ① Rhythmisches Leuchten auf dem ZIEL, das angegriffen werden soll
//     (`lure_beacon`) — das Licht, das lockt.
//  ② Dann rammt der angelockte Held hinein (`play_ram_animation`,
//     die Standard-Ramme) und verursacht dabei den Schaden.
// ═══════════════════════════════════════════

const CARD_NAME = 'Alluring Light';

/**
 * ★ Antwort einer Zielwahl auf das ZIELOBJEKT zurueckfuehren.
 * `promptEffectTarget` liefert IDs; nur die angebotene Liste kennt die
 * Felder (`type`, `owner`, `heroIdx`, `slotIdx`, `cardInstance`).
 */
function zielVonAntwort(antwort, angebot) {
  const roh = Array.isArray(antwort) ? antwort[0] : antwort;
  if (!roh) return null;
  if (typeof roh === 'object' && roh.type) return roh;     // schon ein Ziel
  const id = typeof roh === 'object' ? roh.id : roh;
  return (angebot || []).find(t => t.id === id) || null;
}

module.exports = {
  // ★★ v1182 — ENTKOPPELTE BILDER (CARD_API): wird die Karte NEGIERT,
  // laeuft ihr Effekt-Rumpf nie — die Engine spielt dann diese Bilder.
  // Im normalen Weg bleibt es bei den Broadcasts im Effekt selbst.
  spellVisual: {
    impact: { type: 'lure_beacon' }, impactMs: 260,
  },

  requiresTarget: true,

  spellPlayCondition(gs, pi, engine) {
    const oppIdx = pi === 0 ? 1 : 0;
    const hatHelden = (gs.players[oppIdx]?.heroes || []).some(h => h?.name && h.hp > 0);
    if (!hatHelden) return false;
    try { return engine.getHeroTargets(pi).length + engine.getCreatureTargets(pi).length > 0; }
    catch { return false; }
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const oppIdx = pi === 0 ? 1 : 0;

      // ── ① Den ANGREIFER waehlen: ein Held des GEGNERS ─────────────
      const gegnerZiele = engine.getHeroTargets(oppIdx);
      const heldWahl = await engine.promptEffectTarget(pi, gegnerZiele, {
        title: CARD_NAME,
        description: "Choose an opponent's Hero — it will be lured into attacking.",
        confirmLabel: '✨ Lure!',
        maxSelect: 1, maxTotal: 1,
        cancellable: true,
      });
      // ★★ v1172 (Al 17.9.: „nach der Heldenwahl passiert gar nichts"):
      // `promptEffectTarget` liefert die IDs der gewaehlten Ziele
      // (`'hero-1-0'`), NICHT die Zielobjekte — dieselbe Falle wie bei
      // „Ricochet" (v1150). Hier las die Karte `heldWahl[0].heroIdx` an
      // einer Zeichenkette, bekam `undefined` und brach still ab, bevor
      // die zweite Zielwahl ueberhaupt aufging.
      const angreiferZiel = zielVonAntwort(heldWahl, gegnerZiele);
      if (!angreiferZiel) { gs._spellCancelled = true; return; }
      const angreifer = gs.players[oppIdx]?.heroes?.[angreiferZiel.heroIdx];
      if (!angreifer?.name || angreifer.hp <= 0) { gs._spellCancelled = true; return; }

      // ── ② Das OPFER waehlen: ein Ziel auf der EIGENEN Seite ───────
      const eigene = [
        ...engine.getHeroTargets(pi),
        ...engine.getCreatureTargets(pi),
      ];
      if (eigene.length === 0) { gs._spellCancelled = true; return; }
      const opferWahl = await engine.promptEffectTarget(pi, eigene, {
        title: CARD_NAME,
        description: `Choose one of YOUR targets for ${angreifer.name} to attack.`,
        confirmLabel: '💥 Take the hit!',
        maxSelect: 1, maxTotal: 1,
        cancellable: true,
      });
      const opfer = zielVonAntwort(opferWahl, eigene);
      if (!opfer) { gs._spellCancelled = true; return; }

      const opferSlot = opfer.type === 'hero' ? -1 : opfer.slotIdx;
      const atk = angreifer.atk || 0;

      // ── Animation ① das Anlock-Leuchten auf dem OPFER ─────────────
      // ★ v1173: laenger stehen lassen (Al 17.9.) — die Ebene raeumt die
      // Animation nach `duration` ab, der Guss wartet entsprechend.
      engine._broadcastEvent('play_zone_animation', {
        type: 'lure_beacon', owner: opfer.owner, heroIdx: opfer.heroIdx, zoneSlot: opferSlot,
        duration: 2400,
      });
      await engine._delay(1300);

      // ★ „treated as the chosen Hero attacking" — die Quelle ist der
      // GEGNERISCHE Held, nicht der Spieler dieser Karte. Damit zaehlt
      // der Angriff ihm, samt allem, was daran haengt.
      const attackSource = {
        name: CARD_NAME,
        owner: oppIdx, controller: oppIdx, heroIdx: angreiferZiel.heroIdx,
        usesHeroAtk: true,
      };
      const finalDmg = await engine._fireAttackDeclare(attackSource, opfer, atk);

      // ── Animation ② der angelockte Held rammt hinein ──────────────
      engine._broadcastEvent('play_ram_animation', {
        sourceOwner: oppIdx, sourceHeroIdx: angreiferZiel.heroIdx,
        targetOwner: opfer.owner, targetHeroIdx: opfer.heroIdx,
        targetZoneSlot: opferSlot,
        cardName: angreifer.name, duration: 1100,
      });
      await engine._delay(620);

      if (opfer.type === 'hero') {
        const h = gs.players[opfer.owner]?.heroes?.[opfer.heroIdx];
        if (h && h.hp > 0) {
          await engine.actionDealDamage(attackSource, h, finalDmg, 'attack');
        }
      } else {
        const inst = opfer.cardInstance || engine.cardInstances.find(c =>
          c.owner === opfer.owner && c.zone === 'support'
          && c.heroIdx === opfer.heroIdx && c.zoneSlot === opfer.slotIdx);
        if (inst && inst.zone === 'support') {
          await engine.actionDealCreatureDamage(
            attackSource, inst, finalDmg, 'attack',
            { sourceOwner: oppIdx, canBeNegated: true },
          );
        }
      }

      engine._broadcastEvent('play_zone_animation', {
        type: 'explosion', owner: opfer.owner, heroIdx: opfer.heroIdx, zoneSlot: opferSlot,
      });

      engine.log('alluring_light', {
        player: gs.players[pi]?.username,
        lured: angreifer.name, victim: opfer.cardName, atk,
      });
      engine.sync();
    },
  },
};
