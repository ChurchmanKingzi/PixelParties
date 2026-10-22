// ═══════════════════════════════════════════
//  CARD EFFECT: "Cykyran War Counselor"
//  Creature (Summoning Magic Lv2, Normal) — 150 HP
//
//  EFFECT:
//   "You can only control 1 \"Cykyran War
//    Counselor\".
//    While you control at least 3 different \"War
//    Counselor\" Creatures, your Heroes' Base Attack
//    stats are doubled. You may once per turn choose a
//    target and deal damage equal to one of your
//    Heroes' Attack stats to it. That damage cannot
//    exceed 300."
//
//  ── ① Die Verdopplung ──
//  Verdoppelt wird der BASISWERT, nicht der
//  Gesamtangriff (Als Ruling 8.8.): 80 Basis + 30 vom
//  Equip ergibt 190, nicht 210. Der Bonus ist also
//  immer genau der natuerliche Basiswert — er waechst
//  nicht mit fremden Buffs mit und stapelt auch mit
//  mehreren Kopien nicht, weil der neue Basiswert
//  stets das Doppelte des normalen ist.
//
//  Die Engine fuehrt beides getrennt: `hero.baseAtk`
//  ist der natuerliche Wert (Ghuanjun liest genau
//  den), `hero.atk` der gelebte Gesamtwert. Weil der
//  Kartentext den BASISWERT verdoppelt, ziehe ich
//  beide Felder mit — sonst waere die Differenz
//  `atk − baseAtk`, die andere Karten als "Summe der
//  Buffs" lesen, um den Bonus verfaelscht.
//
//  Buch fuehrt `hero._cykyranBonus`. `resync` rechnet:
//      natuerliche Basis = hero.baseAtk − eigener Bonus
//      Sollbonus         = Bedingung ? Basis : 0
//  und legt nur die DIFFERENZ an. Steht der Sollwert
//  schon, passiert gar nichts — sonst floss bei jedem
//  Feldereignis eine +/−-Animation ueber den Schirm.
//  Da der Bonus nicht mehr am Gesamtwert haengt, kann
//  ihn auch kein fremder Buff mehr verschieben; nur
//  die BEDINGUNG muss nachgerechnet werden.
//
//  Der Weg ueber `engine._applyHeroAtkDelta` ist
//  Absicht: dort haengt die Curse-Regel ("Angriff ist
//  0"), die eine direkte Zuweisung umgehen wuerde.
//
//  ── ①b Formwechsel (W55a, Al: „Die Verdopplung muss neu berechnet werden!") ──
//  Aufstieg/Abstieg (`performAscension`/`performDescend`) setzen `hero.baseAtk` auf den GEDRUCKTEN Wert der
//  neuen Form zurueck (`_atkNachFormwechsel`: gedruckter Wert + fortbestehende Boni; die Verdopplung gehoert
//  zur alten Basis und ist dabei erloschen). Vorher blieb `_cykyranBonus` mit dem ALTEN Betrag stehen:
//  der Held stand ohne Verdopplung da (Test: 40 -> 80, nach dem Aufstieg 90 statt 180) und ein spaeterer
//  Abgleich rechnete `natuerlich = baseAtk - altem Bonus` falsch (100 statt 180).
//  Jetzt in zwei Schichten:
//    • `onFormChanged` (neuer Engine-Hook, feuert direkt nach der Zustandsuebertragung): `resync` bucht auf
//      die neue Basis um — alte Buchung zuruecknehmen (sie ist mit dem Zuruecksetzen der Basis schon weg,
//      es gibt nichts abzuziehen) und, solange die Bedingung gilt, die NEUE Basis einmal verdoppeln.
//    • Selbstheilung im `resync` selbst: die Buchung traegt den Formwechsel-Zaehler `hero._formGen`
//      (`_cykyranGen`). Weicht er ab, ist die Buchung verwaist und zaehlt als 0 — egal ueber welchen
//      Weg der Abgleich laeuft (jeder andere Hook, Zugbeginn, Wiederbelebung …).
//  Boni (Ausruestung, Fighting, dauerhafte Zuwaechse `permAtkDelta`, befristete Gaben) werden nicht
//  verdoppelt: verdoppelt wird allein `baseAtk` (= gedruckter Wert der aktuellen Form).
//
//  ── ② Der Schuss ──
//  "one of your Heroes" — der Spieler waehlt, welcher
//  Held den Wert stellt; gedeckelt bei 300. Der
//  angesagte Wert ist der AKTUELLE (also inklusive der
//  eigenen Verdopplung, falls sie greift).
// ═══════════════════════════════════════════

const {
  WC,
  controlledWarCounselors,
  istEigenerAbgang,
  makeSingletonCanSummon,
  zahleGatheringGebuehr,
} = require('./_war-counselor-shared');

const CARD_NAME = 'Cykyran War Counselor';
const NEEDED_DISTINCT = 3;
const DAMAGE_CAP = 300;

/** Verdopplung an- oder abgleichen. */
function resync(engine, pi, ausserId = null) {
  const ps = engine.gs.players[pi];
  if (!ps) return;
  // `ausserId`: die Kopie, die gerade abgeht — sie steht im Leave-Hook noch im
  // Support und darf sich nicht mehr mitzaehlen (A06-18).
  // ★ W7a (A06-13, Al): die Verdopplung ist ein laufender Passiv Cykyrans — sie gilt nur, solange eine Cykyran WIRKT (nicht
  // gefroren/betäubt/negiert/Aura-negiert); mitgezählt werden die Ratgeber unabhängig von ihrem Zustand („you control").
  const active = new Set(controlledWarCounselors(engine, pi)
    .filter((i) => i.id !== ausserId).map((i) => i.name)).size >= NEEDED_DISTINCT
    && engine.cardInstances.some((i) => i.name === CARD_NAME && i.zone === 'support' && !i.faceDown
      && i.id !== ausserId && (i.controller ?? i.owner) === pi
      && !engine.isCreatureEffectSuppressed(i, { honorNegStatusImmune: false }));

  // Kontrolle statt Seite (Styx 28.9.) — „your Heroes": alle Helden, die
  // `pi` kontrolliert, plus die, auf denen noch SEIN Zuschlag liegt
  // (abgegebene Helden verlieren ihn). `_cykyranBy` merkt sich, wessen
  // Ratgeber den Zuschlag gesetzt hat, damit sich zwei Kopien auf beiden
  // Seiten nicht gegenseitig abraeumen.
  for (let p = 0; p < (engine.gs.players || []).length; p++) {
  const heroes = engine.gs.players[p]?.heroes || [];
  for (let hi = 0; hi < heroes.length; hi++) {
    const hero = heroes[hi];
    if (!hero?.name) continue;
    const kontrolliert = engine.heroSideOf(p, hero) === pi;
    // W55a: verwaiste Buchung (der Held hat seit dem Setzen die Form gewechselt): `baseAtk` ist dabei auf den
    // gedruckten Wert der neuen Form zurueckgesetzt worden, die Verdopplung steckt nicht mehr darin —
    // es gibt nichts zurueckzunehmen. Aeltere Staende ohne Stempel (`_cykyranGen` fehlt) gelten als frisch.
    if (hero._cykyranBonus && hero._cykyranGen !== undefined && hero._cykyranGen !== (hero._formGen || 0)) {
      hero._cykyranBonus = 0;
      delete hero._cykyranBy;
      delete hero._cykyranGen;
    }
    const current = hero._cykyranBonus || 0;
    if (!kontrolliert && !(current && (hero._cykyranBy ?? p) === pi)) continue;
    // Natuerlicher Basiswert = gespeicherte Basis minus unser eigener
    // Zuschlag. Fehlt `baseAtk` (aeltere Spielstaende), dient der
    // Gesamtwert als Notbehelf.
    const storedBase = hero.baseAtk !== undefined ? hero.baseAtk : (hero.atk || 0);
    const natural = Math.max(0, storedBase - current);
    const wanted = (active && kontrolliert) ? natural : 0;
    const delta = wanted - current;
    if (!delta) continue;
    engine._applyHeroAtkDelta(hero, p, hi, delta);
    if (hero.baseAtk !== undefined) hero.baseAtk = Math.max(0, hero.baseAtk + delta);
    hero._cykyranBonus = wanted;
    hero._cykyranBy = pi;
    hero._cykyranGen = hero._formGen || 0;
  }
  }
}

/** Nur aus einer offen im Support stehenden Kopie heraus. */
function resyncFromCtx(ctx) {
  const inst = ctx.card;
  if (!inst || inst.zone !== 'support' || inst.faceDown) return;
  resync(ctx._engine, ctx.cardOwner);
}

module.exports = {
  // ★★ v1182 — ENTKOPPELTE BILDER (CARD_API): wird die Karte NEGIERT,
  // laeuft ihr Effekt-Rumpf nie — die Engine spielt dann diese Bilder.
  // Im normalen Weg bleibt es bei den Broadcasts im Effekt selbst.
  spellVisual: {
    impact: { type: 'spiked_club_smash' }, impactMs: 260,
  },

  // Harte Obergrenze dieses Schadens. Minocretes Verdoppler liest sie und
  // klemmt danach wieder auf 300 — "cannot exceed 300" gilt auch mit
  // fremder Hilfe (Als Ruling 8.8.).
  damageCap: DAMAGE_CAP,

  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).
  activeIn: ['support'],
  creatureEffect: true,
  // W7a: der Abgleich muss Zustandswechsel auch im stillgelegten Zustand mitbekommen (Hooks laufen immer, fragen selbst).
  bypassStatusFilter: true,

  canSummon: makeSingletonCanSummon(CARD_NAME),

  canActivateCreatureEffect(ctx) {
    // Kontrolle statt Seite (Styx 28.9.) — „one of your Heroes"
    return ctx._engine.heroesControlledBy(ctx.cardOwner).some(({ hero: h }) => h.hp > 0 && (h.atk || 0) > 0);
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const inst = ctx.card;
    const ps = gs.players[pi];
    if (!ps) return false;

    // ── Welcher Held stellt den Wert? ──
    // Kontrolle statt Seite (Styx 28.9.) — „one of your Heroes"
    const options = [];
    for (const { physOwner, heroIdx: hi, hero } of engine.heroesControlledBy(pi)) {
      if (!hero?.name || !(hero.hp > 0)) continue;
      const atk = hero.atk || 0;
      if (atk <= 0) continue;
      const dmg = Math.min(DAMAGE_CAP, atk);
      options.push({
        id: `${physOwner}-${hi}`,
        label: `⚔️ ${hero.name} — ${dmg}`,
        description: atk > DAMAGE_CAP
          ? `Attack ${atk}, capped at ${DAMAGE_CAP}.`
          : `Attack ${atk}.`,
        color: '#ff4444',
      });
    }
    if (options.length === 0) return false;

    let heroKey = options[0].id;
    if (options.length > 1) {
      const pick = await engine.promptGeneric(pi, {
        type: 'optionPicker',
        title: CARD_NAME,
        description: 'Which Hero\'s Attack stat should set the damage?',
        showCard: CARD_NAME,
        options,
        cancellable: true,
      });
      if (!pick || pick.cancelled || pick.optionId == null) return false;
      heroKey = String(pick.optionId);
    }
    const [srcOwner, heroIdx] = heroKey.split('-').map(Number);
    const sourceHero = gs.players[srcOwner]?.heroes?.[heroIdx];
    if (!sourceHero?.name || !(sourceHero.hp > 0)) return false;
    const damage = Math.min(DAMAGE_CAP, sourceHero.atk || 0);
    if (!(damage > 0)) return false;

    const target = await ctx.promptDamageTarget({
      side: 'any',
      types: ['hero', 'creature'],
      damageType: 'creature',
      baseDamage: damage,
      title: CARD_NAME,
      description: `Deal ${damage} damage — ${sourceHero.name}'s Attack stat${(sourceHero.atk || 0) > DAMAGE_CAP ? ` (capped at ${DAMAGE_CAP})` : ''}.`,
      confirmLabel: `⚔️ Strike! (${damage})`,
      confirmClass: 'btn-danger',
      cancellable: true,
    });
    if (!target) return false;
    // Welle 11 (Al, R3): War Council Gathering Place — die 8 Gold werden erst jetzt (Ziel bestätigt, vor der Auflösung) abgezogen.
    if (!(await zahleGatheringGebuehr(engine, inst))) return false;

    const tgtZoneSlot = target.type === 'hero' ? -1 : target.slotIdx;
    engine._broadcastEvent('play_zone_animation', {
      // Keule, die von oben aufs Ziel schwingt — dieselbe wie beim
      // 3-Headed Giant (Als Vorgabe).
      type: 'spiked_club_smash',
      owner: target.owner, heroIdx: target.heroIdx, zoneSlot: tgtZoneSlot,
    });
    await engine._delay(450);

    if (target.type === 'hero') {
      const hero = gs.players[target.owner]?.heroes?.[target.heroIdx];
      if (hero && hero.hp > 0) await ctx.dealDamage(hero, damage, 'creature');
    } else if (target.cardInstance) {
      await engine.actionDealCreatureDamage(
        { name: CARD_NAME, owner: pi, heroIdx: inst.heroIdx },
        target.cardInstance, damage, 'creature',
        { sourceOwner: pi, canBeNegated: true },
      );
    }

    engine.log('cykyran_strike', {
      player: ps.username, hero: sourceHero.name, target: target.cardName, damage,
    });
    engine.sync();
    return true;
  },

  // W16c (A06-32): Wiederbelebung OHNE Hooks (Rewrite History, Zombified Assault, ...): die Verdopplung gleicht sich sofort ab, nicht erst am Zugende.
  onRevive: (ctx) => resyncFromCtx(ctx),

  hooks: {
    // Bedingung UND Grundwert koennen sich bei jedem dieser Ereignisse
    // aendern — kein Filter auf die gespielte Karte, gerade FREMDE
    // Beschwoerungen und Tode veraendern ja die Ratgeberzahl.
    onPlay: (ctx) => resyncFromCtx(ctx),
    onCardEnterZone: (ctx) => resyncFromCtx(ctx),
    onCardLeaveZone: (ctx) => {
      if (istEigenerAbgang(ctx)) { resync(ctx._engine, ctx.cardOwner, ctx.card.id); return; }
      resyncFromCtx(ctx);
    },
    // Der eigene Tod ist schon im Leave-Hook abgeglichen; hier steht die Instanz
    // noch im Support und wuerde sich sonst wieder mitzaehlen (A06-18/19).
    onCreatureDeath: (ctx) => {
      if (ctx.creature?.instId === ctx.card?.id) return;
      resyncFromCtx(ctx);
    },
    onTurnStart: (ctx) => resyncFromCtx(ctx),
    // W55a: Aufstieg/Abstieg — die Verdopplung auf den NEUEN Grundwert umbuchen (siehe ①b)
    onFormChanged: (ctx) => resyncFromCtx(ctx),
    afterDamage: (ctx) => resyncFromCtx(ctx),
    // W7a: Frost/Betäubung/Negation kommen und gehen
    onPhaseStart: (ctx) => resyncFromCtx(ctx),
    onStatusApplied: (ctx) => resyncFromCtx(ctx),
    onStatusRemoved: (ctx) => resyncFromCtx(ctx),
  },
};
