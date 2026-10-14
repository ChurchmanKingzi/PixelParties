'use strict';
// W4-neg-01 · Locke, Null, Crusader's Hookshot, Bishop of Kings [B], Water Golem: Text sagt nur „effect(s) negated" -> LEICHTE Form (Al, 14.10.2026, Welle 4 / A)
// Kartentexte: Locke „That target's effects are negated until the beginning of your next turn." · Null „Negate the effects of any targets hit by this Hero's Attacks for 2 turns." ·
//   Crusader's Hookshot „its effect is negated for 1 turn" · Bishop of Kings [B] „the effects of all Heroes your opponent controls are negated." · Water Golem „that target's effects are negated."
// Erwartung: der Zielheld ist negiert (Status `negated`, Marke `effectOnly`), aber seine Abilities laufen: Fireball (Destruction Magic Lv2) ist spielbar (Stufenpruefung),
//   Schulstufe = 2, der Held ist handlungsfaehig (nicht `isHeroIncapacitated`), Passiv-Hooks der Ability-Karten sind nicht stumm (`_isHeroAbilityPassiveSilenced`).
// Gegenprobe: eine Negierung OHNE die Marke (v1114-Standard „negated" ohne Einschraenkung) bleibt hart (Fireball unspielbar).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const pickHero = (o, h) => (valid) => { const v = valid.find(x => x.type === 'hero' && x.owner === o && x.heroIdx === h); return v ? [v.id] : null; };
  const karte = (name) => { const c = require('../../../../data/cards.json'); const a = Array.isArray(c) ? c : Object.values(c); return a.find(x => x.name === name); };
  const ABIL1 = { 1: { 0: [['Destruction Magic', 'Destruction Magic'], ['Wealth'], []] } };
  const DUMMY = ['Tushu, the Knowledge Keeper', 'Rick, the Trigger Happy Undertaker', 'Zwei, the Lucky Thief'];
  // Leichte Form: negiert, Marke effectOnly, Abilities laufen weiter (Seite 1, Held 0 ist das Ziel)
  const leicht = (nameKarte, t) => {
    const st = t.hero(1, 0).statuses.negated;
    R.check(nameKarte + ': Ziel ist negiert, mit Marke effectOnly', !!st && st.effectOnly === true, t.hero(1, 0).statuses);
    R.check(nameKarte + ': Stufenpruefung Fireball (Destruction Magic Lv2) bleibt erfuellt', t.engine.heroMeetsLevelReq(1, 0, karte('Fireball')) === true);
    R.check(nameKarte + ': Schulstufe bleibt 2', t.engine.effectiveSchoolLevelForCaster('Destruction Magic', 1, 0) === 2, t.engine.effectiveSchoolLevelForCaster('Destruction Magic', 1, 0));
    R.check(nameKarte + ': Held handlungsfaehig (nicht isHeroIncapacitated)', t.engine.isHeroIncapacitated(1, 0) === false);
    R.check(nameKarte + ': Passiv-Hooks der Abilities nicht stumm', t.engine._isHeroAbilityPassiveSilenced(1, 0) === false);
    R.check(nameKarte + ': kein Abilities-negiert-Zustand', t.engine.heroAbilitiesNegated(1, 0) === false);
    R.check(nameKarte + ': Wealth (Passiv, Zone 1) zaehlt als Kandidat der Stufenmenge', t.engine._getCandidateAbilityZoneSets(1, 0).some(z => z.some(s => s && s[0] === 'Wealth')));
  };

  R.section('A) Gegenprobe: Negierung OHNE Marke bleibt die harte Standardform');
  {
    const t = await H.fresh({ abilities: ABIL1 });
    await t.engine.addHeroStatus(1, 0, 'negated', { appliedBy: 0, source: 'Test', sourceBound: true, noAbsorb: true });
    R.check('hart: Fireball-Stufe verfehlt', t.engine.heroMeetsLevelReq(1, 0, karte('Fireball')) === false);
    R.check('hart: Passiv stumm', t.engine._isHeroAbilityPassiveSilenced(1, 0) === true);
    R.check('hart: handlungsunfaehig', t.engine.isHeroIncapacitated(1, 0) === true);
  }

  R.section('B) Locke, the Unseen Saboteur (Zugbeginn-Trigger)');
  {
    const t = await H.fresh({ heroes: [['Locke, the Unseen Saboteur', DUMMY[1], DUMMY[2]], undefined], abilities: ABIL1 });
    t.targetFn = pickHero(1, 0);
    await t.run(() => t.engine.runHooks('onTurnStart', { playerIdx: 0, isMyTurn: true }));
    await sleep(250);
    leicht('Locke', t);
    R.check('Locke: keine Engine-Fehler', t.errors.length === 0, t.errors);
  }

  R.section('C) Null, the Mage Slayer (Angriff trifft)');
  {
    const t = await H.fresh({ heroes: [['Null, the Mage Slayer', DUMMY[1], DUMMY[2]], undefined], hand: [['Attack'], []], abilities: ABIL1 });
    t.targetFn = pickHero(1, 0);
    const r = await t.play(0, 'Attack', { hero: 0 });
    await sleep(250);
    R.check('Null: Angriff gespielt', r === true, r);
    leicht('Null', t);
    R.check('Null: keine Engine-Fehler', t.errors.length === 0, t.errors);
  }

  R.section("D) Crusader's Hookshot (Rider nach Schaden)");
  {
    const t = await H.fresh({ heroes: [['Cecilia, the Harrowing Crusader', DUMMY[1], DUMMY[2]], undefined], hand: [["Crusader's Hookshot"], []], abilities: ABIL1 });
    t.targetFn = pickHero(1, 0);
    const r = await t.play(0, "Crusader's Hookshot", { hero: 0 });
    const a = await t.activateEquip(0, 0, 0);
    await sleep(250);
    R.check("Hookshot: angelegt und aktiviert", r === true && a !== false, { r, a, hp: t.hp(1, 0) });
    leicht("Hookshot", t);
    R.check("Hookshot: keine Engine-Fehler", t.errors.length === 0, t.errors);
  }

  R.section('E) Bishop of Kings [B] (Knight of Kings + Board of Kings)');
  {
    const BB = 'Bishop of Kings [B]';
    const t = await H.fresh({ hand: [[BB], []], abilities: ABIL1 });
    t.putArea(0, 'Board of Kings'); t.put(0, 0, 0, 'Knight of Kings [W]');
    await t.play(0, BB, { hero: 0, slot: 1 });
    await sleep(250);
    leicht('Bishop [B]', t);
    R.check('Bishop [B]: alle drei Gegner-Helden negiert', [0, 1, 2].every(hi => !!t.hero(1, hi).statuses.negated && t.hero(1, hi).statuses.negated.effectOnly === true), [0, 1, 2].map(hi => t.hero(1, hi).statuses));
    R.check('Bishop [B]: keine Engine-Fehler', t.errors.length === 0, t.errors);
  }

  R.section('F) Water Golem (Surprise, Ziel gewaehlt)');
  {
    const t = await H.fresh({ abilities: ABIL1 });
    t.grantFor(0, 0, 'Water Golem');
    t.putSurprise(0, 0, 'Water Golem');
    const gw = t.putSurprise(0, 1, 'Glass Wall');
    t.targetFn = pickHero(1, 0);
    await t.run(() => t.engine.actionMoveCard(gw, 'discard', -1, -1, { source: 'Test', sourceOwner: 1 }));
    await sleep(250);
    R.check('Water Golem: liegt auf dem Brett', !!t.find('Water Golem', 'support'));
    leicht('Water Golem', t);
    R.check('Water Golem: keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
