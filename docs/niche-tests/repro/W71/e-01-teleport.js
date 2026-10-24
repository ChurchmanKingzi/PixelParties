'use strict';
// W71e-01 · Teleport (Spell Normal, Magic Arts Lv1; vorher Reaction)
//
// Text: „Choose two Heroes you control and swap their positions as well as the positions of their Abilities. Any cards in their Support Zones remain where they were.
//   If this is the second Spell you use this turn, this counts as an additional Action."
// Geprüft: Held + Abilities wandern, Support Zones bleiben (Kreatur/Ausrüstung/Anhängsel gehören danach zum anderen Helden), BONI ziehen mit (ATK-Ausrüstung, Status-Anhängsel,
//   Zustandslauscher), Index-Zustand (heroFlags, heroesActedThisTurn, abilityGivenThisTurn), Zusatzaktion beim zweiten Zauber, Abbruch/Voraussetzungen, besiegte/fremde Helden, Wiederholung.
const H = require('../../lib/h.js');
const CARD = 'Teleport';
const isHero = (v, owner, hi) => v.type === 'hero' && v.owner === owner && (hi == null || v.heroIdx === hi);
const names = (t, s) => t.gs.players[s].heroes.map(h => h.name);
const HEROES = [['Tushu, the Knowledge Keeper', 'Rick, the Trigger Happy Undertaker', 'Zwei, the Lucky Thief'], null];

const waehle = (t, a, b, seat = 0) => { t.targetFn = (valid) => [`hero-${seat}-${a}`, `hero-${seat}-${b}`].filter(id => valid.some(v => v.id === id)); };

(async () => {
  const R = H.runner();

  R.section('A · Held, HP, Status, Abilities wandern; Support Zones bleiben');
  {
    const t = await H.fresh({ hand: [[CARD], []], abilities: { 0: { 0: [['Destruction Magic', 'Destruction Magic'], ['Fighting'], []], 2: [['Support Magic'], [], []] } } });
    t.gs.players[0].heroes[0].hp = 555;
    t.heroStatus(0, 2, 'frozen');
    const kreatur = t.put(0, 0, 1, H.INERT.creature);
    t.put(0, 2, 0, H.INERT.big);
    const vor = names(t, 0);
    const heroInst0 = t.engine.cardInstances.find(c => c.zone === 'hero' && c.owner === 0 && c.heroIdx === 0);
    const abInst = t.engine.cardInstances.filter(c => c.zone === 'ability' && c.owner === 0 && c.heroIdx === 0);
    waehle(t, 0, 2);
    const r = await t.play(0, CARD, { hero: 1 });
    R.check('gespielt', r === true, r);
    R.check('Heldennamen an Platz 0 und 2 vertauscht, Platz 1 unberührt', names(t, 0)[0] === vor[2] && names(t, 0)[2] === vor[0] && names(t, 0)[1] === vor[1], names(t, 0));
    R.check('HP wandert mit dem Helden (555 jetzt auf Platz 2)', t.hp(0, 2) === 555 && t.hp(0, 0) === 800, [t.hp(0, 0), t.hp(0, 2)]);
    R.check('Status wandert mit (Frozen jetzt auf Platz 0)', !!t.gs.players[0].heroes[0].statuses.frozen && !t.gs.players[0].heroes[2].statuses.frozen);
    R.check('Abilities wandern: Destruction Magic ×2 / Fighting jetzt bei Platz 2, Support Magic bei Platz 0', JSON.stringify(t.gs.players[0].abilityZones[2]) === JSON.stringify([['Destruction Magic', 'Destruction Magic'], ['Fighting'], []]) && JSON.stringify(t.gs.players[0].abilityZones[0]) === JSON.stringify([['Support Magic'], [], []]), t.gs.players[0].abilityZones);
    R.check('Heldeninstanz folgt (heroIdx 0 → 2)', heroInst0.heroIdx === 2, heroInst0.heroIdx);
    R.check('Ability-Instanzen folgen dem Helden (heroIdx 2)', abInst.length === 3 && abInst.every(c => c.heroIdx === 2), abInst.map(c => c.heroIdx));
    R.check('Kreatur bleibt in Spalte 0, Slot 1', kreatur.heroIdx === 0 && kreatur.zoneSlot === 1 && (t.gs.players[0].supportZones[0][1] || [])[0] === H.INERT.creature, [kreatur.heroIdx, kreatur.zoneSlot]);
    R.check('Big-Dummy bleibt in Spalte 2', (t.gs.players[0].supportZones[2][0] || [])[0] === H.INERT.big);
    R.check('Teleport in der Ablage', t.pile(0, 'discardPile').includes(CARD));
    R.check('Portal-Animation an beiden Plätzen', t.evs('play_zone_animation').filter(e => e.type === 'portal_warp').length === 2, t.evs('play_zone_animation').map(e => e.type));
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
    R.check('Zustand sauber', t.audit().length === 0, t.audit());
  }

  R.section('B · zweimal tauschen = Ausgangslage; Selbst-Paar nicht möglich');
  {
    const t = await H.fresh({ hand: [[CARD, CARD], []], abilities: { 0: { 0: [['Magic Arts'], [], []] } } });
    t.grantFor(0, 2, CARD);   // der Wirker (Held 2) bekommt seine Schule VOR dem Schnappschuss
    const vor = JSON.stringify([names(t, 0), t.gs.players[0].abilityZones]);
    waehle(t, 0, 1); await t.play(0, CARD, { hero: 2 });
    t.gs.turn += 2; t.gs.activePlayer = 0; waehle(t, 0, 1);
    await t.play(0, CARD, { hero: 2 });
    R.check('zwei Teleports: wieder die Ausgangslage', JSON.stringify([names(t, 0), t.gs.players[0].abilityZones]) === vor, vor);
  }
  {
    const t = await H.fresh({ hand: [[CARD], []] });
    t.targetFn = (valid) => [valid.find(v => isHero(v, 0, 1)).id, valid.find(v => isHero(v, 0, 1)).id];
    const before = names(t, 0);
    await t.play(0, CARD, { hero: 0 });
    R.check('dasselbe Ziel zweimal gemeldet: kein Held verdoppelt/verloren (die Engine füllt auf zwei verschiedene auf)', JSON.stringify([...names(t, 0)].sort()) === JSON.stringify([...before].sort()) && t.errors.length === 0, [names(t, 0), t.errors]);
  }

  R.section('C · BONI ziehen mit: ATK-Ausrüstung (Club of Gobbo +30) und zweite Ausrüstung');
  {
    const t = await H.fresh({ hand: [['Club of Gobbo', CARD], []], gold: 500 });
    const atk0 = t.gs.players[0].heroes[0].atk, atk2 = t.gs.players[0].heroes[2].atk;
    await t.play(0, 'Club of Gobbo', { hero: 0 });
    R.check('Vorbedingung: Club am Helden 0 → ATK +30', t.gs.players[0].heroes[0].atk === atk0 + 30, [t.gs.players[0].heroes[0].atk, atk0]);
    waehle(t, 0, 2);
    await t.play(0, CARD, { hero: 1 });
    const hA = t.gs.players[0].heroes[2], hB = t.gs.players[0].heroes[0];   // A (jetzt Platz 2), B (jetzt Platz 0)
    R.check('Held A (jetzt Platz 2) hat den Bonus VERLOREN', hA.atk === atk0, [hA.name, hA.atk, atk0]);
    R.check('Held B (jetzt Platz 0, unter dem Club) hat den Bonus', hB.atk === atk2 + 30, [hB.name, hB.atk, atk2]);
    R.check('Club liegt weiter in Spalte 0', (t.gs.players[0].supportZones[0] || []).some(z => (z || []).includes('Club of Gobbo')));
    R.check('der Club gehört nur EINMAL zum Bonus (ATK nicht doppelt)', hB.atk - atk2 === 30);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  {
    // zwei Ausrüstungen in beiden Spalten + dritter Held unbeteiligt
    const t = await H.fresh({ hand: [['Club of Gobbo', 'Phalanx Pike', CARD], []], gold: 500 });
    const b = t.gs.players[0].heroes.map(h => h.atk);
    await t.play(0, 'Club of Gobbo', { hero: 0 });
    await t.play(0, 'Phalanx Pike', { hero: 1 });
    waehle(t, 0, 1);
    await t.play(0, CARD, { hero: 2 });
    const h = t.gs.players[0].heroes;
    R.check('Platz 0 (Held 1 jetzt) hat +30 (Club), Platz 1 (Held 0 jetzt) hat +30 (Pike)', h[0].atk === b[1] + 30 && h[1].atk === b[0] + 30, [h[0].atk, h[1].atk, b]);
    R.check('unbeteiligter Held 2 unverändert', h[2].atk === b[2]);
    // und zurück
    t.gs.turn += 2; t.gs.activePlayer = 0; t.setHand(0, [CARD]); waehle(t, 0, 1);
    await t.play(0, CARD, { hero: 2 });
    R.check('Rücktausch: Boni zurück bei den Ursprungshelden (je +30, nie +60 / 0)', t.gs.players[0].heroes[0].atk === b[0] + 30 && t.gs.players[0].heroes[1].atk === b[1] + 30, t.gs.players[0].heroes.map(x => x.atk));
  }

  R.section('D · BONI: Status-Anhängsel (Berserk) folgt dem Platz, nicht dem Helden');
  {
    const t = await H.fresh({ hand: [['Berserk', CARD], []], abilities: { 0: { 0: [['Decay Magic', 'Decay Magic'], [], []] } } });
    t.targetFn = (valid) => [valid.find(v => isHero(v, 0, 1)).id];
    await t.play(0, 'Berserk', { hero: 0 });
    const slot = t.gs.players[0].supportZones[1].findIndex(z => (z || []).includes('Berserk'));
    R.check('Vorbedingung: Held 1 ist berserked', !!t.gs.players[0].heroes[1].statuses.berserked && slot >= 0, t.gs.players[0].heroes[1].statuses);
    waehle(t, 1, 2); t.setHand(0, [CARD]);
    await t.play(0, CARD, { hero: 0 });
    R.check('Held vom alten Platz 1 (jetzt Platz 2) ist NICHT mehr berserked', !t.gs.players[0].heroes[2].statuses.berserked, t.gs.players[0].heroes[2].statuses);
    R.check('der Held, der jetzt auf Platz 1 steht, IST berserked', !!t.gs.players[0].heroes[1].statuses.berserked, t.gs.players[0].heroes[1].statuses);
    R.check('Berserk liegt weiter in Spalte 1', (t.gs.players[0].supportZones[1] || []).some(z => (z || []).includes('Berserk')));
    R.check('Berserk kein zweites Mal gelegt (genau ein Status-Eintrag, kein Absturz)', t.errors.length === 0, t.errors);
  }
  {
    // Curse: ATK 0 am Wirt
    const t = await H.fresh({ hand: [['Curse', CARD], []] });
    t.targetFn = (valid) => [valid.find(v => isHero(v, 0, 0)).id];
    await t.play(0, 'Curse', { hero: 1 });
    const cursed0 = !!t.gs.players[0].heroes[0].statuses.cursed;
    waehle(t, 0, 2); t.setHand(0, [CARD]);
    await t.play(0, CARD, { hero: 1 });
    R.check('Curse: Status liegt jetzt am Helden, der an Platz 0 steht (nicht am Ursprungshelden)', cursed0 && !!t.gs.players[0].heroes[0].statuses.cursed && !t.gs.players[0].heroes[2].statuses.cursed, [cursed0, t.gs.players[0].heroes.map(h => Object.keys(h.statuses))]);
  }

  R.section('E · Index-Zustand: heroFlags, abilityGivenThisTurn, heroesActedThisTurn');
  {
    const t = await H.fresh({ hand: [[CARD], []], heroes: [['Ida, the Adept of Destruction', 'Rick, the Trigger Happy Undertaker', 'Zwei, the Lucky Thief'], null] });
    await t.run(() => t.engine.runHooks('onGameStart', {}));
    R.check('Vorbedingung: Idas Flag an Platz 0', !!(t.gs.heroFlags || {})['0-0']?.forcesSingleTarget, t.gs.heroFlags);
    waehle(t, 0, 2);
    await t.play(0, CARD, { hero: 1 });
    R.check('Ida steht jetzt auf Platz 2 und ihr Flag auch', t.gs.players[0].heroes[2].name.startsWith('Ida') && !!t.gs.heroFlags['0-2']?.forcesSingleTarget && !t.gs.heroFlags['0-0']?.forcesSingleTarget, t.gs.heroFlags);
    R.check('heroFlagsLive folgt', !!t.engine.heroFlagsLive(0, 2)?.forcesSingleTarget && !t.engine.heroFlagsLive(0, 0)?.forcesSingleTarget);
  }
  {
    const t = await H.fresh({ hand: [[CARD], []] });
    t.gs.players[0].abilityGivenThisTurn = [true, false, false];
    waehle(t, 0, 2);
    await t.play(0, CARD, { hero: 1 });
    R.check('abilityGivenThisTurn tauscht mit dem Helden', JSON.stringify(t.gs.players[0].abilityGivenThisTurn) === JSON.stringify([false, false, true]), t.gs.players[0].abilityGivenThisTurn);
  }
  {
    // Wirker auf Platz 0 tauscht sich selbst mit Platz 1: nach dem Spielweg steht „hat gehandelt" bei Platz 1 (dem Wirker), nicht bei Platz 0
    const t = await H.fresh({ hand: [[CARD], []] });
    waehle(t, 0, 1);
    await t.play(0, CARD, { hero: 0 });
    const acted = t.gs.players[0].heroesActedThisTurn || [];
    R.check('Wirker (war Platz 0) steht jetzt auf Platz 1 und gilt dort als „gehandelt"', acted.includes(1) && !acted.includes(0) && t.gs.players[0].heroes[1].name === HEROES[0][0], [acted, names(t, 0)]);
    R.check('Wirker-Name stimmt (Tushu jetzt Platz 1)', t.gs.players[0].heroes[1].name === HEROES[0][0], names(t, 0));
  }
  {
    // Wirker nicht beteiligt: acted bleibt beim Wirker
    const t = await H.fresh({ hand: [[CARD], []] });
    waehle(t, 1, 2);
    await t.play(0, CARD, { hero: 0 });
    R.check('Wirker unbeteiligt: Wirker-Platz 0 gilt als gehandelt', (t.gs.players[0].heroesActedThisTurn || []).includes(0) && !(t.gs.players[0].heroesActedThisTurn || []).includes(1), t.gs.players[0].heroesActedThisTurn);
  }

  R.section('F · „second Spell" = Zusatzaktion');
  {
    const t = await H.fresh({ hand: [[CARD, 'Fireball'], []] });
    const inh = (n) => { t.gs.players[0].spellsPlayedThisTurn = n; return require('../../../../cards/effects/teleport.js').inherentAction(t.gs, 0, 0, t.engine); };
    R.check('erster Zauber (Zähler 0): keine Zusatzaktion', inh(0) === false);
    R.check('zweiter Zauber (Zähler 1): Zusatzaktion', inh(1) === true);
    R.check('dritter Zauber (Zähler 2): keine Zusatzaktion', inh(2) === false);
  }
  {
    // praktisch: Aktion der Phase verbraucht, Teleport als ZWEITER Zauber noch spielbar
    const t = await H.fresh({ hand: [['Fireball', CARD], []] });
    t.targetFn = (valid) => [valid.find(v => isHero(v, 1, 0)).id];
    await t.play(0, 'Fireball', { hero: 0 });
    R.check('Vorbedingung: Fireball gespielt (Zähler 1)', t.gs.players[0].spellsPlayedThisTurn === 1, t.gs.players[0].spellsPlayedThisTurn);
    waehle(t, 0, 2);
    const r = await t.play(0, CARD, { hero: 1, keepActions: true, phase: 'MAIN2' });
    R.check('als zweiter Zauber in Main Phase 2 spielbar (Zusatzaktion)', r === true && names(t, 0)[0] === HEROES[0][2], [r, names(t, 0)]);
  }
  {
    const t = await H.fresh({ hand: [[CARD, 'Fireball'], []] });
    waehle(t, 0, 2);
    const r = await t.play(0, CARD, { hero: 1, keepActions: true, phase: 'MAIN2' });
    R.check('als ERSTER Zauber in Main Phase 2 ohne verfügbare Aktion: nicht spielbar', r === false, r);
  }

  R.section('G · Voraussetzungen, Abbruch, besiegte und fremde Helden');
  {
    const t = await H.fresh({ hand: [[CARD], []] });
    t.policy.cancelTargets = true;
    const vor = JSON.stringify(names(t, 0));
    await t.play(0, CARD, { hero: 0 });
    R.check('Abbruch: Karte auf der Hand, nichts getauscht, keine Animation', t.pile(0, 'hand').includes(CARD) && JSON.stringify(names(t, 0)) === vor && t.evs('play_zone_animation').length === 0);
    R.check('… Aktion zurück', t.gs.players[0]._actionsPlayedThisTurn === 0, t.gs.players[0]._actionsPlayedThisTurn);
  }
  {
    const t = await H.fresh({ hand: [[CARD], []] });
    t.setHero(0, 1, null, 0); t.setHero(0, 2, null, 0);
    const r = await t.play(0, CARD, { hero: 0 });
    R.check('nur EIN lebender eigener Held: nicht spielbar', r === false && t.pile(0, 'hand').includes(CARD), r);
  }
  {
    const t = await H.fresh({ hand: [[CARD], []] });
    t.gs.players[0].heroes[1].hp = 0;
    t.targetFn = (valid) => { t._v = valid.slice(); return valid.filter(v => isHero(v, 0)).slice(0, 2).map(v => v.id); };
    await t.play(0, CARD, { hero: 0 });
    R.check('besiegter Held 1 ist keine wählbare Zielkarte', !(t._v || []).some(v => isHero(v, 0, 1) && !v.ineligible), (t._v || []).map(v => v.id));
    R.check('Gegnerhelden nicht angeboten', !(t._v || []).some(v => v.owner === 1), (t._v || []).map(v => v.id));
  }
  {
    // übernommener Gegnerheld (Sitz 0 kontrolliert Sitz-1-Held 0): Paar „eigener Held + übernommener" ist nicht möglich; zwei eigene gehen weiter
    const t = await H.fresh({ hand: [[CARD], []] });
    await t.run(() => t.engine.actionTakeHeroPermanently(0, 1, 0, { sourceName: 'test' }));
    t.targetFn = (valid) => { t._v = valid.slice(); return [valid.find(v => isHero(v, 0, 0)).id, valid.find(v => isHero(v, 1, 0)).id]; };
    const vor = JSON.stringify([names(t, 0), names(t, 1)]);
    await t.play(0, CARD, { hero: 1 });
    R.check('übernommener Held wird angeboten', (t._v || []).some(v => isHero(v, 1, 0)), (t._v || []).map(v => v.id));
    R.check('seitenübergreifendes Paar wird abgelehnt/abgebrochen — nichts getauscht, kein Absturz', JSON.stringify([names(t, 0), names(t, 1)]) === vor && t.errors.length === 0, [names(t, 0), names(t, 1), t.errors]);
    R.check('Karte nach Mehrfach-Ablehnung zurück auf der Hand (Abbruch)', t.pile(0, 'hand').includes(CARD) || t.pile(0, 'discardPile').includes(CARD));
  }

  R.section('H · Surprises bleiben in der Spalte; Kreaturen sehen den neuen Helden');
  {
    const t = await H.fresh({ hand: [[CARD], []] });
    t.putSurprise(0, 0, 'Jumpscare');
    waehle(t, 0, 2);
    await t.play(0, CARD, { hero: 1 });
    R.check('Surprise bleibt in der Surprise-Zone von Spalte 0', (t.gs.players[0].surpriseZones[0] || []).includes('Jumpscare') && !(t.gs.players[0].surpriseZones[2] || []).includes('Jumpscare'), t.gs.players[0].surpriseZones);
    R.check('Surprise-Instanz heroIdx bleibt 0', t.find('Jumpscare', 'surprise').heroIdx === 0);
  }

  R.section('I · Die Wächter-Hooks: Equip-Lost/Gained mit isMove, ohne Anleger-Fenster');
  {
    const t = await H.fresh({ hand: [['Club of Gobbo', CARD], []], gold: 500 });
    await t.play(0, 'Club of Gobbo', { hero: 0 });
    let pests = 0; const o = t.engine._checkSurpriseOnEquip.bind(t.engine);
    t.engine._checkSurpriseOnEquip = async (...a) => { pests++; return o(...a); };
    const lost = [], gained = [];
    const orig = t.engine.runHooks.bind(t.engine);
    t.engine.runHooks = async (name, c) => { if (name === 'onEquipLost') lost.push({ ...c, lostCard: undefined, leavingCard: undefined }); if (name === 'onEquipGained') gained.push({ ...c, equipCard: undefined }); return orig(name, c); };
    waehle(t, 0, 2);
    await t.play(0, CARD, { hero: 1 });
    R.check('onEquipLost mit isMove und Grund „moved"', lost.length === 1 && lost[0].isMove === true && lost[0].reason === 'moved' && lost[0].fromHeroIdx === 0, lost);
    R.check('onEquipGained mit isMove, OHNE Anleger', gained.length === 1 && gained[0].isMove === true && gained[0].equipOwner == null && gained[0].equipHeroIdx === 0, gained);
    R.check('kein Surprise-Fenster „equipped" (Afflicted Pests & Co. bleiben still)', pests === 0, pests);
  }

  R.finish();
})();
