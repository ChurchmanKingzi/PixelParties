// ═══════════════════════════════════════════
//  CARD EFFECT: "Psychic Scout"
//  Creature (Summoning Magic Lv1, 50 HP)
//
//  „You may once per turn summon a level 0 Creature from your hand as an
//   additional Action with the corresponding Hero. While you control this
//   Creature, any damage your level 0 Creatures take is reduced by 50."
//
//  1) AKTIVER Kreatureneffekt (HOPT, `creatureEffect`): Der Spieler
//     klickt den Scout, waehlt eine Level-0-Kreatur aus der Hand und
//     beschwoert sie in eine freie Support Zone des ENTSPRECHENDEN Helden
//     (der Held, in dessen Spalte der Scout steht). Vorher war das ein
//     passiver Zusatzaktions-Grant (`grantAdditionalAction`) — der bot
//     keine Aktivierung an (Bugfix).
//     „As an additional Action": Kreatureneffekte kosten ohnehin keine
//     Aktion, die Beschwoerung laeuft deshalb direkt ueber
//     `summonCreatureWithHooks` (Vorbild: Elven Druid / SnowItAll). Der
//     Held muss die Kreatur regulaer beschwoeren koennen (lebend, nicht
//     eingefroren/betaeubt, Summoning-Magic-Stufe, keine Beschwoerungs-
//     Sperre, karteneigene Schranken).
//
//  2) SCHADENSMINDERUNG (passiv, 50): `beforeCreatureDamageBatch` — jeder
//     Schaden, den EIGENE Level-0-Kreaturen (`originalLevel === 0`,
//     Kontrolle statt Seite) nehmen, sinkt um 50 (Boden 0). Unreduzierbarer
//     Schaden (`cannotBeReduced`) geht durch. Der Scout selbst (Lv1) ist
//     nicht erfasst.
// ═══════════════════════════════════════════

const { isOwnSideSummonableCreature } = require('./_hooks');

const CARD_NAME        = 'Psychic Scout';
const DAMAGE_REDUCTION = 50;

/** Kann `heroIdx` (Brettseite `feld`) jetzt regulaer beschwoeren? */
function heroCanHost(engine, pi, heroIdx, cd, name, feld = pi, handIdx = null) {
  const ps = engine.gs.players[pi];
  const hero = engine.gs.players[feld]?.heroes?.[heroIdx];
  if (!hero?.name || hero.hp <= 0) return false;
  if (hero.statuses?.frozen || hero.statuses?.stunned) return false;
  if (ps?.summonLocked) return false;
  try { if (engine.getSummonBlocked(pi).includes(name)) return false; } catch { /* defekte Sperre sprengt die Karte nicht */ }
  if (!(feld === pi
    ? engine.heroMeetsLevelReq(pi, heroIdx, cd)
    : engine.heroMeetsLevelReq(feld, heroIdx, cd, { levelSourcePi: pi }))) return false;
  if (!engine.isCreatureSummonable(name, pi, heroIdx)) return false;
  return true;
}

/** Handindizes der Level-0-Kreaturen, die der Held beschwoeren darf. */
function summonableHandIndices(engine, pi, heroIdx, feld) {
  const ps = engine.gs.players[pi];
  const cardDB = engine._getCardDB();
  const out = [];
  for (let i = 0; i < (ps?.hand || []).length; i++) {
    const cn = ps.hand[i];
    const cd = cardDB[cn];
    if (!cd || !isOwnSideSummonableCreature(cd, cn)) continue;
    if (engine.effectiveCardLevel(cd, pi, { handIdx: i }) !== 0) continue;   // „level 0"
    if (!heroCanHost(engine, pi, heroIdx, cd, cn, feld, i)) continue;
    out.push(i);
  }
  return out;
}

/** Freie Support Zones des entsprechenden Helden. */
function freeSlots(engine, feld, heroIdx) {
  const zones = engine.gs.players[feld]?.supportZones?.[heroIdx] || [];
  const out = [];
  for (let z = 0; z < 3; z++) if ((zones[z] || []).length === 0) out.push({ owner: feld, heroIdx, slotIdx: z });
  return out;
}

module.exports = {
  activeIn: ['support'],
  creatureEffect: true,

  canActivateCreatureEffect(ctx) {
    const engine = ctx._engine;
    const feld = ctx.cardHeroOwner ?? ctx.cardOwner;   // Spalte der Kreatur
    const heroIdx = ctx.cardHeroIdx;
    if (freeSlots(engine, feld, heroIdx).length === 0) return false;
    return summonableHandIndices(engine, ctx.cardOwner, heroIdx, feld).length > 0;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const ps = engine.gs.players[pi];
    const feld = ctx.cardHeroOwner ?? pi;
    const heroIdx = ctx.cardHeroIdx;
    if (!ps?.hand) return false;

    // Aufdeck-Banner erst bei Bestaetigung zeigen (wie SnowItAll): ein
    // Abbruch kostet nichts (kein Banner, kein HOPT).
    const savedReveal = engine.gs._pendingCardReveal;
    delete engine.gs._pendingCardReveal;
    const savedPlayLog = engine.gs._pendingPlayLog;
    delete engine.gs._pendingPlayLog;
    const automat = engine.isCpuPlayer(pi) || engine._inMctsSim || engine._fastMode;

    let chosenName = null;
    let dest = null;
    let rueck = 0;
    while (!dest) {
      const eligible = summonableHandIndices(engine, pi, heroIdx, feld);
      if (eligible.length === 0) return false;
      const einzige = eligible.length === 1;
      let idx;
      if (einzige) idx = eligible[0];
      else {
        const picked = await engine.promptGeneric(pi, {
          type: 'pickHandCard',
          title: CARD_NAME,
          description: 'Click a Level 0 Creature in your hand to summon with the corresponding Hero.',
          eligibleIndices: eligible,
          confirmLabel: '🔮 Summon!',
          cancellable: true,
        });
        if (!picked || picked.cancelled || picked.handIndex == null) return false;
        idx = picked.handIndex;
      }
      chosenName = ps.hand[idx];
      if (!chosenName) return false;

      const slots = freeSlots(engine, feld, heroIdx);
      if (slots.length === 0) return false;
      if (slots.length === 1) { dest = slots[0]; break; }
      const pick = await ctx.promptZonePick(slots, {
        title: CARD_NAME,
        description: einzige ? `Place ${chosenName} into a free Support Zone.` : `Place ${chosenName} into a free Support Zone. Cancel to pick a different Creature.`,
        cancellable: true,
      });
      const treffer = pick && !pick.cancelled
        ? slots.find(s => s.heroIdx === pick.heroIdx && s.slotIdx === pick.slotIdx) : null;
      if (!treffer) {
        rueck++;
        if (automat || rueck > 20) { dest = slots[0]; break; }   // Automat / Notbremse: erste freie Zone
        if (einzige) return false;                                  // kein „zurueck": ganz abbrechen
        chosenName = null;
        continue;
      }
      dest = treffer;
    }

    if (savedReveal) engine.gs._pendingCardReveal = savedReveal;
    if (savedPlayLog) engine.gs._pendingPlayLog = savedPlayLog;
    engine._firePendingCardReveal();

    const handIdx = ps.hand.indexOf(chosenName);
    if (handIdx < 0) return false;
    engine.takeFromPileSync(ps, 'hand', handIdx);
    const res = await engine.summonCreatureWithHooks(chosenName, dest.owner, dest.heroIdx, dest.slotIdx, {
      source: CARD_NAME,
      ...(feld !== pi ? { controller: pi } : {}),   // Kontrolle statt Seite (Styx 28.9.)
    });
    if (!res?.inst) {
      engine.returnToPile(ps, 'hand', chosenName, handIdx);   // Beschwoerung abgelehnt: Karte zurueck
      return false;
    }
    engine.log('psychic_scout_summon', { player: ps.username, summoned: chosenName, heroIdx: dest.heroIdx, slotIdx: dest.slotIdx });
    engine.sync();
    return true;
  },

  hooks: {
    beforeCreatureDamageBatch: async (ctx) => {
      const pi = ctx.cardOwner;
      const entries = ctx.entries;
      if (!entries || entries.length === 0) return;
      for (const e of entries) {
        if (e.cancelled) continue;
        if (e.cannotBeReduced) continue;
        const entryOwner = e.inst?.controller ?? e.inst?.owner;   // „your level 0 Creatures" (Kontrolle)
        if (entryOwner !== pi) continue;
        if (e.originalLevel !== 0) continue;                       // wie Diamond: Original-Level
        if (e.amount > 0) e.modifyAmount(-Math.min(DAMAGE_REDUCTION, e.amount));   // flat (Punkt vor Strich)
      }
    },
  },
};
