// ═══════════════════════════════════════════
//  CARD EFFECT: "Pressure Projectile"
//  Spell (Normal, Destruction Magic + Magic Arts, Lv1) — PP MS1
//
//  „Choose a target and deal 150 damage to it that cannot be reduced or
//   negated. You may then choose any number of Spells attached/Artifacts
//   equipped to the target and send them to the discard pile OR choose an
//   Area on the board and send it to the discard pile."
//
//  ── Bauteile (Vorbilder: Rockfall, Fire Bomb, Excavator Bucket) ────
//  • Schaden: TRUE DAMAGE (`ctx.dealTrueDamage`, Typ 'destruction_spell').
//    „cannot be reduced or negated" bezieht sich — wie bei Rockfall — auf
//    den SCHADEN; die Karte selbst bleibt abwehrbar.
//  • Zielwahl abbrechbar (`cancellable`); Abbruch = nichts ist passiert.
//
//  ── Der Zusatz „You may then …" (Als Ruling 6.10.) ─────────────────
//  Eine einzige Brett-Auswahl (Fire-Bomb-Muster): `exclusiveTypes` verbietet
//  das Mischen, `maxPerType` erlaubt beliebig viele angehängte Spells /
//  ausgerüstete Artifacts ODER genau eine Area.
//    • Angeboten werden die Anhängsel (Spell-Subtyp Attachment) und
//      Ausrüstungen (Artifact-Subtyp Equipment) des gewählten HELDEN —
//      nur solange der Held noch lebt. Stirbt er am Schaden, werden seine
//      Anhängsel ohnehin abgeworfen; dann bleibt NUR die Area-Wahl, und
//      zwar sofort (kein Zwischenschritt).
//    • Ist weder etwas Wählbares am Ziel noch eine Area im Spiel, feuert
//      der Zusatz gar nicht (kein leerer Prompt).
//    • Die Auswahl ist abbrechbar („You may") — nach dem Schaden heißt
//      Abbruch „Zusatz auslassen", die Karte ist verbraucht (kein
//      `_spellCancelled`).
//    • Areas laufen über `engine.removeArea` (Schutzfenster: Guardian of
//      Teocuilatl, Wowhalla), Anhängsel/Ausrüstung über
//      `engine.sendBoardCardToDiscard` (Leave-Hooks, Untracking).
//
//  ── Animation (Pixelart) ──────────────────────────────────────────
//  • Geschoss: `projectileShape: 'pressure'` (Client: `DruckGeschoss`) —
//    ein verdichteter Luftpfropfen mit Überschallkegel aus Druckringen,
//    am Ziel eine Druckwelle.
//  • Abwurf: `pressure_shatter` (ANIM_REGISTRY) auf jeder abgeräumten
//    Karte / Area — die Karte wird zusammengedrückt und zerplatzt.
// ═══════════════════════════════════════════

const { areaTargetId } = require('./_targeting-shared');

const CARD_NAME = 'Pressure Projectile';
const DAMAGE = 150;
const FLUG_MS = 380;          // Flugzeit des Geschosses
const EINSCHLAG_MS = 120;     // Nachlauf bis die Druckwelle sitzt, dann fällt der Schaden
const ZERPLATZEN_MS = 330;    // bis zum Bersten in `pressure_shatter` (45 % von 720 ms), dann geht die Karte weg

/** Alle Areas beider Seiten als Ziele (jede Area des Stapels ist ein eigenes Ziel). */
function areaZiele(engine) {
  const gs = engine.gs;
  const ziele = [];
  for (let owner = 0; owner < 2; owner++) {
    const arr = gs.areaZones?.[owner] || [];
    for (let platz = 0; platz < arr.length; platz++) {
      const name = arr[platz];
      const inst = engine.cardInstances.find(c =>
        c.zone === 'area' && c.owner === owner && c.name === name);
      if (!inst) continue;
      ziele.push({
        id: areaTargetId(owner, platz), type: 'area', owner, heroIdx: -1,
        slotIdx: platz, cardName: name, cardInstance: inst, _cardInstance: inst,
      });
    }
  }
  return ziele;
}

/** Angehängte Spells + ausgerüstete Artifacts des Helden (nur Brettkarten in Support Zones). */
function anhaengselZiele(engine, owner, heroIdx) {
  const db = engine._getCardDB();
  const ziele = [];
  for (const inst of engine.cardInstances) {
    if (inst.zone !== 'support' || inst.owner !== owner || inst.heroIdx !== heroIdx) continue;
    if (inst.counters?.immovable || inst.counters?._cardinalImmune) continue;
    const cd = engine.getEffectiveCardData?.(inst) || db[inst.name];
    if (!cd) continue;
    const sub = String(cd.subtype || '').toLowerCase();
    const istAnhaengsel = cd.cardType === 'Spell' && sub === 'attachment';
    const istAusruestung = cd.cardType === 'Artifact' && sub === 'equipment';
    if (!istAnhaengsel && !istAusruestung) continue;
    // Karten, die in der Support Zone als Ability zählen (Cloak of Edge), sind keine Ausrüstung.
    if (engine.countsAsAbilityInZone?.(inst.name, inst)) continue;
    ziele.push({
      id: `equip-${owner}-${heroIdx}-${inst.zoneSlot}`, type: 'equip',
      owner, heroIdx, slotIdx: inst.zoneSlot, cardName: inst.name,
      cardInstance: inst, _cardInstance: inst,
    });
  }
  return ziele;
}

module.exports = {
  // Bilder sind vom Effekt entkoppelt: wird die Karte negiert, spielt die Engine sie trotzdem.
  spellVisual: {
    projectile: { projectileShape: 'pressure', duration: FLUG_MS, noTrail: true, sfx: 'elem_wind' },
    flightMs: FLUG_MS + EINSCHLAG_MS,
  },

  requiresTarget: true,

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const ps = gs.players[pi];
      const hero = ctx.attachedHero || ps?.heroes?.[heroIdx];   // geliehener Held: physische Seite
      if (!hero?.name || hero.hp <= 0) return;

      const target = await ctx.promptDamageTarget({
        side: 'any',
        types: ['hero', 'creature'],
        damageType: 'destruction_spell',
        baseDamage: DAMAGE,
        title: CARD_NAME,
        description: `Deal ${DAMAGE} damage that cannot be reduced or negated. Then discard attached Spells / equipped Artifacts of the target OR an Area.`,
        confirmLabel: `💨 Pressure! (${DAMAGE})`,
        confirmClass: 'btn-danger',
        cancellable: true,
      });
      if (!target) return;   // Abbruch: promptDamageTarget setzt `_spellCancelled` selbst

      await engine.spielZauberBilder(CARD_NAME, {
        owner: ctx.cardHeroOwner ?? pi, heroIdx, zoneSlot: ctx.card?.zoneSlot,
        targets: [target],
      });

      // ── 150 unreduzierbarer Schaden ──
      let tgtHero = null;
      if (target.type === 'hero') {
        tgtHero = gs.players[target.owner]?.heroes?.[target.heroIdx];
        if (tgtHero && tgtHero.hp > 0) await ctx.dealTrueDamage(tgtHero, DAMAGE, 'destruction_spell');
      } else if (target.cardInstance) {
        await ctx.dealTrueDamage(target.cardInstance, DAMAGE, 'destruction_spell');
      }
      engine.log('pressure_projectile', { player: ps.username, target: target.cardName, damage: DAMAGE });

      // ── „You may then …": Anhängsel/Ausrüstung des Ziels ODER eine Area ──
      const heldLebt = !!(tgtHero && tgtHero.hp > 0);
      const anhaengsel = heldLebt ? anhaengselZiele(engine, target.owner, target.heroIdx) : [];
      const areas = areaZiele(engine);
      const angebot = [...anhaengsel, ...areas];
      if (angebot.length === 0) { engine.sync(); return; }

      const beschr = anhaengsel.length > 0
        ? 'Send any number of Spells attached / Artifacts equipped to the target to the discard pile OR an Area on the board.'
        : 'Choose an Area on the board and send it to the discard pile.';
      const gewaehlt = await engine.promptEffectTarget(pi, angebot, {
        title: CARD_NAME,
        source: CARD_NAME,
        description: beschr,
        confirmLabel: '💨 Burst!',
        confirmClass: 'btn-danger',
        minRequired: 1,
        maxTotal: 99,
        exclusiveTypes: true,
        maxPerType: { equip: 99, area: 1 },
        alwaysConfirmable: false,
        cancellable: true,   // „You may" — Abbruch lässt den Zusatz aus
      });
      const ids = Array.isArray(gewaehlt) ? gewaehlt : (gewaehlt ? [gewaehlt] : []);
      if (ids.length === 0) { engine.sync(); return; }

      // Nach der Abfrage neu einsammeln — das Brett kann sich bewegt haben.
      const frisch = [...anhaengselZiele(engine, target.owner, target.heroIdx), ...areaZiele(engine)];
      const treffer = ids.map(id => frisch.find(z => z.id === id)).filter(z => z?.cardInstance);
      if (treffer.length === 0) { engine.sync(); return; }

      const quelle = { name: CARD_NAME, owner: pi, heroIdx, controller: pi };
      const areaWahl = treffer.find(z => z.type === 'area');
      if (areaWahl) {
        engine._broadcastEvent('play_zone_animation', {
          type: 'pressure_shatter', owner: areaWahl.owner, heroIdx: -1, zoneSlot: -1, zoneType: 'area',
        });
        await engine._delay(ZERPLATZEN_MS);
        await engine.removeArea(areaWahl.cardInstance, CARD_NAME, { source: quelle, sourceOwner: pi });
      } else {
        // Alle Zerplatz-Bilder gleichzeitig, dann einzeln wegschicken.
        for (const z of treffer) {
          engine._broadcastEvent('play_zone_animation', {
            type: 'pressure_shatter', owner: z.owner, heroIdx: z.heroIdx, zoneSlot: z.slotIdx,
          });
        }
        await engine._delay(ZERPLATZEN_MS);
        for (const z of treffer) {
          await engine.sendBoardCardToDiscard(z.cardInstance, {
            source: quelle, sourceName: CARD_NAME, sourceOwner: pi,
          });
        }
      }
      engine.log('pressure_projectile_discard', {
        player: ps.username, cards: treffer.map(z => z.cardName),
      });
      engine.sync();
    },
  },

  /**
   * CPU: Gegnerische Anhängsel/Ausrüstung zuerst (alle), sonst eine gegnerische
   * Area; eigene Karten nie. Sonst auslassen.
   */
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'effectTarget') return undefined;
    const { validTargets, config, playerIdx } = promptData || {};
    if (config?.title !== CARD_NAME || !Array.isArray(validTargets)) return undefined;
    const fremd = (t) => !t.ineligible && t.owner !== playerIdx;
    const equips = validTargets.filter(t => t.type === 'equip' && fremd(t));
    if (equips.length > 0) return equips.map(t => t.id);
    const area = validTargets.find(t => t.type === 'area' && fremd(t));
    return area ? [area.id] : [];
  },
};
