// ═══════════════════════════════════════════
//  CARD EFFECT: "Javelin Throw"
//  Artifact (Normal, Cost 4)
//
//  „Choose a Hero you control that can use an Action this turn. Choose
//   an Artifact equipped to that Hero and send it to the discard pile.
//   Then, choose a target your opponent controls and inflict damage
//   equal to your chosen Hero's Base Attack to it. This is treated as
//   an Attack. You can only play 1 "Javelin Throw" per turn."
//
//  ── Als Ruling (29.8.) ────────────────────────────────────────
//  „that can use an Action this turn": besiegte, eingefrorene,
//  gestunnte oder sonst an Aktionen gehinderte Helden sind KEINE
//  legalen Ziele — Engine-Gate `isHeroIncapacitated` (tot, Frozen,
//  Stunned, Bound, hart negiert; Weakening-Crystal-Negation zaehlt
//  nicht, die laesst Aktionen zu). Ebenso Helden ohne ausgeruestetes
//  Artefakt. Ein Held, der seine Aktion diese Runde schon VERBRAUCHT
//  hat, ist nicht „gehindert" und bleibt waehlbar (Annahme, an Al
//  gemeldet).
//
//  ── Ablauf ────────────────────────────────────────────────────
//  1. Ziel-Artefakt-Fluss: `getValidTargets` bietet die eigenen Helden
//     an, die beides erfuellen. Der Spieler waehlt EINEN Helden.
//  2. `resolve`: Artefakt-Wahl unter den Equips dieses Helden
//     (`promptEffectTarget`, eigene Seite, Typ equip; bei genau einem
//     Equip automatisch). Das Equip geht ueber `actionMoveCard` in den
//     Discard — Abraeumen der Ausruestung (Flying-Island-Zonen etc.)
//     kommt von dort.
//  3. Schaden: `promptDamageTarget` (Gegnerseite, Held oder Kreatur,
//     damageType 'attack') aus dem Kontext der Handkarte — Untargetable,
//     Reaktionsfenster fuer Angriffe, Spectral Armor & Co. greifen
//     generisch. Hoehe = `hero.baseAtk` (GEDRUCKTER Angriff, keine
//     Buffs). Quelle traegt `heroIdx` des gewaehlten Helden, damit
//     `_fireAttackDeclare` „when this Hero attacks"-Lauscher zieht —
//     „treated as an Attack". Kein `usesHeroAtk` (Quick-Attack-Muster:
//     Formel ist baseAtk, nicht atk).
//  4. OPT: `canActivate` sperrt ab der ersten Kopie je Runde
//     (`claimHOPT` beim Auflösen, NACH der Zielwahl — Abbruch kostet
//     nichts; `{ aborted: true }` gibt die Karte zurueck).
//
//  Auftritt: Speerwurf als Projektil vom Helden zum Ziel (SVG-Speer,
//  Spitze in Flugrichtung, Klang `elem_wind`), Einschlag `explosion`.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Javelin Throw';
const HOPT_KEY = 'javelin-throw';

function hoptUsed(engine, pi) {
  return engine.gs.hoptUsed?.[`${HOPT_KEY}:${pi}`] === engine.gs.turn;
}

/** Ausgeruestete Artefakte (keine Artifact Creatures) unter einem Helden. */
function equippedArtifacts(engine, pi, heroIdx) {
  const db = engine._getCardDB();
  return engine.cardInstances.filter(inst => {
    if (inst.zone !== 'support' || inst.faceDown) return false;
    if ((inst.controller ?? inst.owner) !== pi || inst.heroIdx !== heroIdx) return false;
    const cd = engine.getEffectiveCardData?.(inst) || db[inst.name];
    return !!cd && hasCardType(cd, 'Artifact') && !hasCardType(cd, 'Creature');
  });
}

/** Helden, die „can use an Action this turn" UND ein Equip tragen. */
function eligibleHeroes(engine, pi) {
  const ps = engine.gs.players[pi];
  const out = [];
  for (let hi = 0; hi < (ps?.heroes || []).length; hi++) {
    if (engine.isHeroIncapacitated(pi, hi)) continue;
    if (equippedArtifacts(engine, pi, hi).length === 0) continue;
    out.push(hi);
  }
  return out;
}

function heroTargets(engine, pi) {
  const ps = engine.gs.players[pi];
  return eligibleHeroes(engine, pi).map(hi => ({
    id: `hero-${pi}-${hi}`, type: 'hero', owner: pi, heroIdx: hi, cardName: ps.heroes[hi].name,
  }));
}

module.exports = {
  isTargetingArtifact: true,
  requiresTarget: true,
  animationType: 'none',

  canActivate(gs, pi, engine) {
    const eng = engine || gs._engineRef;
    if (!eng) return false;
    if (hoptUsed(eng, pi)) return false;
    return eligibleHeroes(eng, pi).length > 0;
  },
  getValidTargets(gs, pi, engine) {
    const eng = engine || gs._engineRef;
    if (!eng || hoptUsed(eng, pi)) return [];
    return heroTargets(eng, pi);
  },
  targetingConfig: {
    description: 'Choose a Hero you control that can use an Action this turn and has an Artifact equipped. It throws one of its Artifacts: discard it and deal damage equal to the Hero\'s Base Attack to a target your opponent controls.',
    confirmLabel: '↑ Throw!',
    confirmClass: 'btn-danger',
    cancellable: true,
    exclusiveTypes: true,
    maxPerType: { hero: 1 },
  },
  validateSelection: (selectedIds) => !!selectedIds && selectedIds.length === 1,

  async resolve(engine, pi, selectedIds, validTargets) {
    if (!selectedIds || selectedIds.length === 0) return { aborted: true };
    const gs = engine.gs;
    const ps = gs.players[pi];
    if (!ps || hoptUsed(engine, pi)) return { aborted: true };
    const sel = validTargets.find(t => t.id === selectedIds[0]);
    if (!sel || sel.type !== 'hero') return { aborted: true };
    const hi = sel.heroIdx;
    const hero = ps.heroes?.[hi];
    if (!hero?.name || engine.isHeroIncapacitated(pi, hi)) return { aborted: true };

    // ── Artefakt waehlen ──────────────────────────────────────────
    const equips = equippedArtifacts(engine, pi, hi);
    if (equips.length === 0) return { aborted: true };
    let thrown = equips[0];
    if (equips.length > 1) {
      const equipTargets = equips.map(inst => ({
        id: `equip-${pi}-${hi}-${inst.zoneSlot}-${inst.id}`, type: 'equip',
        owner: pi, heroIdx: hi, slotIdx: inst.zoneSlot, cardName: inst.name, cardInstance: inst,
      }));
      const picked = await engine.promptEffectTarget(pi, equipTargets, {
        maxTotal: 1,   // Einfachauswahl: ein Klick TAUSCHT das Ziel
        title: CARD_NAME,
        description: `Choose an Artifact equipped to ${hero.name} to throw (it goes to the discard pile).`,
        confirmLabel: '↑ Throw this!',
        confirmClass: 'btn-danger',
        cancellable: true,
        previewCardName: CARD_NAME,
      });
      if (!picked || picked.length === 0) return { aborted: true };
      const hit = equipTargets.find(t => t.id === picked[0]);
      if (!hit) return { aborted: true };
      thrown = hit.cardInstance;
    }

    // ── Wurfziel waehlen (VOR dem Abwerfen: Abbruch kostet nichts) ──
    const damage = Math.max(0, hero.baseAtk || 0);
    const handInst = engine.cardInstances.find(c => c.zone === 'hand' && c.owner === pi && c.name === CARD_NAME)
      || engine._trackCard(CARD_NAME, pi, 'hand');
    const ctx = engine._createContext(handInst, {});
    // „This is treated as an Attack": die Reaktionen (Invisibility Cloak,
    // Spectral Armor, …) sehen als Quelle den WERFENDEN HELDEN, nicht die
    // Handkarte (die hat keinen heroIdx — der Cloak brach daran ab, v620).
    const attackSource = { name: CARD_NAME, owner: pi, heroIdx: hi, controller: pi };
    delete gs._spellNegatedByEffect;
    const target = await ctx.promptDamageTarget({
      side: 'enemy',
      types: ['hero', 'creature'],
      damageType: 'attack',
      baseDamage: damage,
      attackerSourceOverride: attackSource,
      title: CARD_NAME,
      description: `${hero.name} hurls ${thrown.name}! Choose a target your opponent controls — ${damage} damage (${hero.name}'s Base Attack). This is treated as an Attack.`,
      confirmLabel: `↑ ${damage} Damage!`,
      confirmClass: 'btn-danger',
      cancellable: true,
    });
    // Negiert (Invisibility Cloak): die Karte IST gespielt — Wurf-Artefakt
    // weg (Textreihenfolge: erst abwerfen, dann Ziel), OPT verbraucht,
    // kein Schaden. Nur ein echter Abbruch gibt die Karte zurueck.
    const negated = !target && !!gs._spellNegatedByEffect;
    delete gs._spellNegatedByEffect;
    if (!target && !negated) return { aborted: true };

    // ── Ab hier ist die Karte gespielt ─────────────────────────────
    if (!engine.claimHOPT(HOPT_KEY, pi)) return { aborted: true };

    // Artefakt in den Discard (Ausruestungs-Abbau ueber den Engine-Weg).
    const thrownName = thrown.name;
    await engine.actionMoveCard(thrown, 'discard', -1, -1, { source: CARD_NAME });
    if (negated) {
      engine.log('javelin_throw', {
        player: ps.username, hero: hero.name, artifact: thrownName, negated: true,
      });
      engine.sync();
      return true;
    }
    engine.log('javelin_throw', {
      player: ps.username, hero: hero.name, artifact: thrownName,
      target: target.cardName, damage,
    });

    // Speerwurf vom Helden zum Ziel.
    const tgtSlot = target.type === 'hero' ? undefined : target.slotIdx;
    engine._broadcastEvent('play_projectile_animation', {
      sourceOwner: pi, sourceHeroIdx: hi,
      targetOwner: target.owner, targetHeroIdx: target.heroIdx,
      targetZoneSlot: tgtSlot,
      // v614: eigene SVG-Form `javelin` (langer, duenner Schaft mit
      // schmaler Blattspitze; zeigt nativ nach Osten, deshalb KEIN
      // baseAngle). Klang: Wind statt Standard-`projectile`.
      projectileShape: 'javelin', duration: 380, noTrail: true, sfx: 'elem_wind',
    });
    await engine._delay(330); // v615: schnellerer Wurf (550 → 380 ms Flug)
    engine._broadcastEvent('play_zone_animation', {
      type: 'explosion', owner: target.owner,
      heroIdx: target.heroIdx, zoneSlot: target.type === 'hero' ? -1 : target.slotIdx,
    });
    await engine._delay(120);

    // Typ 'attack', Quelle mit heroIdx → Attack-Declare-Lauscher,
    // Angriffsmodifikatoren.
    if (target.type === 'hero') {
      const tgtHero = gs.players[target.owner]?.heroes?.[target.heroIdx];
      if (tgtHero && tgtHero.hp > 0) await engine.actionDealDamage(attackSource, tgtHero, damage, 'attack');
    } else if (target.cardInstance) {
      await engine.actionDealCreatureDamage(attackSource, target.cardInstance, damage, 'attack',
        { sourceOwner: pi, canBeNegated: true });
    }
    engine.sync();
    return true;
  },
};
