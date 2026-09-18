// ═══════════════════════════════════════════
//  CARD EFFECT: „Sarcophagus of Sealed Magic"
//  Creature (Summoning Magic Lv 1, 60 HP, PP MSEG)
//
//  „You may once per turn choose a target and deal damage equal to 60
//   times the number of Spell School Abilities with different names
//   attached to your undefeated Heroes to it."
//
//  BAUART
//  ──────
//  • Aktiver Kreatureffekt (`creatureEffect`), „You may once per turn"
//    = das WEICHE Once per turn der Engine, je Instanz — dieselbe
//    Maschinerie wie bei Cosmic Skeleton. Nicht im Beschwoerungszug
//    nutzbar (Regelwerk).
//
//  • ★ „SPELL SCHOOL ABILITIES" sind genau fuenf (Als Vorgabe 12.9.):
//    Decay Magic, Destruction Magic, Magic Arts, Summoning Magic,
//    Support Magic. Die Liste steht zentral in `_hooks.js`
//    (`SPELL_SCHOOL_ABILITIES`) — Cosmic Skeleton liest jetzt dieselbe
//    und zieht nur Summoning Magic ab („except Summoning Magic"). Hier
//    zaehlen ALLE fuenf.
//
//  • „with different names attached to your undefeated Heroes": gezaehlt
//    werden NAMEN, nicht Karten und nicht Stapel. Dreimal Decay Magic
//    auf einem Helden ist EINS; Decay Magic auf zwei Helden ist auch
//    EINS. Der Hoechstwert ist damit 5 × 60 = 300.
//
//  • „undefeated Heroes": nur Helden mit HP > 0. Der Zaehler ist die
//    SEITE der Kreatur (`physicalSide`) — bei einer uebernommenen
//    Kreatur zaehlen die Helden dessen, der sie kontrolliert. Der
//    eigene Wirtsheld muss NICHT leben: Kreaturen sind von ihrem Slot-
//    Helden unabhaengig, und der Kartentext stellt keine Bedingung an
//    ihn (anders als Cosmic Skeleton).
//
//  • KEINE Aktivierung bei 0 Schulen: der Effekt wuerde 0 Schaden
//    machen und die weiche Einmal-Nutzung verbrennen. `canActivate
//    CreatureEffect` haelt ihn so lange gesperrt.
//
//  • ANIMATION (Als Vorgabe): ZWEI DUENNE ROTE LASER vom Sarkophag zum
//    Ziel — Cosmic Skeletons einer, halbiert. Dafuer kennt das
//    Strahlensystem jetzt `offset`: ein seitlicher Versatz quer zur
//    Flugrichtung (+7 / −7), sonst laegen beide Strahlen deckungsgleich
//    uebereinander. `thickness: 1` (Als Vorgabe 12.9.: noch duenner).
//    Zielt der Sarkophag auf sich selbst, gibt es wie
//    beim Skelett den `laser_burst` in alle Richtungen.
// ═══════════════════════════════════════════

const { SPELL_SCHOOL_ABILITIES, spellSchoolAbilitiesOn } = require('./_hooks');

const CARD_NAME = 'Sarcophagus of Sealed Magic';
const PRO_SCHULE = 60;
const VERSATZ = 7;      // Abstand der beiden Strahlen zur Mittellinie

/**
 * Wie viele VERSCHIEDENE Zauberschul-Abilities liegen an den
 * unbesiegten Helden dieser Seite?
 */
function schulenZaehlen(engine, pi) {
  const ps = engine.gs.players[pi];
  if (!ps) return 0;
  const namen = new Set();
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const hero = ps.heroes[hi];
    if (!hero?.name || hero.hp <= 0) continue;               // „undefeated"
    for (const s of spellSchoolAbilitiesOn(ps.abilityZones?.[hi], SPELL_SCHOOL_ABILITIES)) {
      namen.add(s);
    }
  }
  return namen.size;
}

module.exports = {
  // ★★ v1182 — ENTKOPPELTE BILDER (CARD_API): wird die Karte NEGIERT,
  // laeuft ihr Effekt-Rumpf nie — die Engine spielt dann diese Bilder.
  // Im normalen Weg bleibt es bei den Broadcasts im Effekt selbst.
  spellVisual: {
    impact: { type: 'laser_burst' }, impactMs: 260,
  },

  requiresTarget: true,
  // ^ Tor fuer Blinded — siehe `_hooks.js`.
  activeIn: ['support'],
  creatureEffect: true,

  cpuMeta: {
    dealsDamage: true,
  },

  /**
   * CPU-Hinweis: der Sarkophag lebt von der Zauberschul-Vielfalt der
   * eigenen Party, nicht vom Wirtshelden — anders als beim Skelett gibt
   * es deshalb KEIN `cpuPrefersSummonerHero`. Jeder freie Slot taugt.
   */

  canActivateCreatureEffect(ctx) {
    const engine = ctx._engine;
    const pi = engine.physicalSide(ctx.card) ?? ctx.cardOwner;
    return schulenZaehlen(engine, pi) > 0;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const ich = ctx.card;
    const pi = engine.physicalSide(ich) ?? ctx.cardOwner;
    const heroOwner = ctx.cardHeroOwner;
    const heroIdx = ctx.cardHeroIdx;
    const zoneSlot = ich.zoneSlot;

    const schulen = schulenZaehlen(engine, pi);
    if (schulen <= 0) return false;
    const schaden = PRO_SCHULE * schulen;

    const ziel = await ctx.promptDamageTarget({
      side: 'any',
      types: ['hero', 'creature'],
      damageType: 'creature',
      baseDamage: schaden,
      title: CARD_NAME,
      description: `Deal ${schaden} damage to any target `
        + `(${schulen} Spell School Abilit${schulen === 1 ? 'y' : 'ies'} × ${PRO_SCHULE}).`,
      confirmLabel: `⚱️ Unseal! (${schaden})`,
      confirmClass: 'btn-danger',
      cancellable: true,
      noSpellCancel: true,
      maxTotal: 1,
    });
    if (!ziel) return false;                       // abgebrochen

    // Zielt der Sarkophag auf sich selbst? Dann kein Strahl, sondern
    // der Rundumschlag (Cosmic-Skeleton-Muster).
    const aufSichSelbst = ziel.type === 'equip'
      && ziel.owner === heroOwner && ziel.heroIdx === heroIdx && ziel.slotIdx === zoneSlot;

    if (aufSichSelbst) {
      engine._broadcastEvent('play_zone_animation', {
        type: 'laser_burst', owner: heroOwner, heroIdx, zoneSlot,
      });
    } else {
      // ZWEI duenne Strahlen, seitlich versetzt. Der Klang kommt aus
      // dem Strahlensystem selbst und faellt ueber die Sammelkategorie
      // 'effect' zu EINEM `laser` zusammen.
      const zielSlot = ziel.type === 'equip' ? ziel.slotIdx : -1;
      for (const versatz of [VERSATZ, -VERSATZ]) {
        engine._broadcastEvent('play_beam_animation', {
          sourceOwner: heroOwner,
          sourceHeroIdx: heroIdx,
          sourceZoneSlot: zoneSlot,
          targetOwner: ziel.owner,
          targetHeroIdx: ziel.heroIdx,
          targetZoneSlot: zielSlot,
          color: '#ff2222',
          thickness: 1,
          offset: versatz,
          duration: 1300,
        });
      }
    }
    await engine._delay(400);

    if (ziel.type === 'hero') {
      const opfer = gs.players[ziel.owner]?.heroes?.[ziel.heroIdx];
      if (opfer?.name && opfer.hp > 0) await ctx.dealDamage(opfer, schaden, 'creature');
    } else if (ziel.type === 'equip') {
      const opfer = ziel.cardInstance || engine.findCards({
        controller: ziel.owner, zone: 'support', heroIdx: ziel.heroIdx,
      }).find(c => c.zoneSlot === ziel.slotIdx);
      if (opfer) {
        await engine.actionDealCreatureDamage(
          { name: CARD_NAME, owner: pi, controller: pi, heroIdx, cardInstance: ich },
          opfer, schaden, 'creature',
          { sourceOwner: pi, canBeNegated: true },
        );
      }
    }

    engine.log('sarcophagus_unseal', {
      player: gs.players[pi]?.username,
      schools: schulen, damage: schaden, target: ziel.cardName,
    });
    engine.sync();
    await engine._delay(600);
    return true;
  },
};
