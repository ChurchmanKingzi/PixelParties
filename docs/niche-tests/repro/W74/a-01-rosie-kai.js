'use strict';
// W74a-01 · Rosie, the School Idol / Kai, the Rowdy (Creature Normal Lv1)
// „You may summon this Creature as an additional Action with a Hero that has at least Charme 2. For every level of Charme the corresponding Hero has, it may use Spells 1 level higher
//  than it otherwise could. You can only control 1 "Rosie, the School Idol"."  — Kai: dasselbe mit Fighting.
const H = require('../../lib/h.js');

const PAARE = [
  { name: 'Rosie, the School Idol', school: 'Charme' },
  { name: 'Kai, the Rowdy', school: 'Fighting' },
];
const SPELL3 = 'Heat Wave';        // Destruction Magic Lv3 (Spell)
const SPELL4OK = 'Cataclysm';      // Destruction Magic Lv3
const spielbar = (t, spell, hi = 0) => { const pl = t.engine.getHeroPlayableCards(0); return !!(pl.own[spell] && pl.own[spell].includes(hi)) || (Array.isArray(pl.own[spell]) ? false : false); };
const kannSpielen = (t, hi, name) => t.engine.heroMeetsLevelReq(0, hi, t.DB[name]);

(async () => {
  const R = H.runner();
  for (const { name, school } of PAARE) {
    R.section(`${name} · ${school}`);

    R.section(`A · Zusatzaktion ab ${school} 2`);
    {
      const t = await H.fresh({ hand: [[name], []] });
      t.setAbilities(0, 0, [[school], [], []]);
      t.setAbilities(0, 1, [[school, school], [], []]);
      const cd = t.DB[name];
      R.check(`${school} 1: keine inherente Aktion`, t.engine.cardHasInherentAction(0, 0, cd, {}) === false);
      R.check(`${school} 2: inherente Aktion`, t.engine.cardHasInherentAction(0, 1, cd, {}) === true);
    }

    R.section('B · der Held darf Spells um seine Schul-Stufe höher wirken (kostenlos)');
    {
      const t = await H.fresh({ hand: [[SPELL3, 'ZZ Filler'], []] });
      t.setAbilities(0, 0, [['Destruction Magic'], [school, school], []]);   // Destruction 1, Schule 2
      t.setAbilities(0, 1, [['Destruction Magic'], [school, school], []]);
      R.check('ohne die Kreatur: Lv3-Spell mit Destruction 1 nicht wirkbar', kannSpielen(t, 0, SPELL3) === false);
      const kreatur = t.put(0, 0, 0, name); kreatur.turnPlayed = 0;
      R.check('mit der Kreatur beim Helden 0: Destruction 1 + 2 ≥ Lv3 → wirkbar', kannSpielen(t, 0, SPELL3) === true);
      R.check('Held 1 (ohne Kreatur) bleibt gesperrt', kannSpielen(t, 1, SPELL3) === false);
      R.check('kostenlos: keine Wisdom-Kosten', t.engine.getWisdomDiscardCost(0, 0, t.DB[SPELL3]) === 0, t.engine.getWisdomDiscardCost(0, 0, t.DB[SPELL3]));
      // Stärke folgt live der Schulstufe
      t.setAbilities(0, 0, [['Destruction Magic'], [school], []]);
      R.check(`${school} sinkt auf 1: nur noch Destruction 1 + 1 = 2 → Lv3 nicht mehr wirkbar`, kannSpielen(t, 0, SPELL3) === false);
      t.setAbilities(0, 0, [['Destruction Magic'], [school, school, school], []]);
      R.check(`${school} 3: Lv3 wirkbar`, kannSpielen(t, 0, SPELL3) === true);
    }

    R.section('C · nur Spells — Attacks und Creatures bleiben außen vor');
    {
      const t = await H.fresh({ hand: [[], []] });
      t.setAbilities(0, 0, [[], [school, school], []]);
      const kreatur = t.put(0, 0, 0, name); kreatur.turnPlayed = 0;
      const attack3 = Object.values(t.DB).find(c => c.cardType === 'Attack' && c.level === 3 && c.spellSchool1 && !c.spellSchool2 && c.spellSchool1 !== school);
      const crea3 = Object.values(t.DB).find(c => c.cardType === 'Creature' && c.level === 3 && c.spellSchool1 === 'Summoning Magic' && !c.spellSchool2);
      if (attack3) R.check(`Attack Lv3 (${attack3.name}): nicht gedeckt`, kannSpielen(t, 0, attack3.name) === false);
      if (crea3) R.check(`Creature Lv3 (${crea3.name}): nicht gedeckt`, kannSpielen(t, 0, crea3.name) === false);
    }

    R.section('D · die Kreatur ruht bei Frost / Betäubung / Negation');
    {
      for (const st of ['frozen', 'stunned', 'negated']) {
        const t = await H.fresh({ hand: [[SPELL3], []] });
        t.setAbilities(0, 0, [['Destruction Magic'], [school, school], []]);
        const kreatur = t.put(0, 0, 0, name); kreatur.turnPlayed = 0;
        if (st === 'negated') kreatur.counters.negated = 1; else kreatur.counters[st] = 1;
        R.check(`${st}: keine Deckung`, kannSpielen(t, 0, SPELL3) === false);
      }
    }

    R.section('E · Skalierende Spells ignorieren den Zuwachs (Deckung ≠ Schulstufe)');
    {
      const t = await H.fresh({ hand: [['Phoenix Tackle'], []] });
      t.setAbilities(0, 0, [['Destruction Magic'], [school, school, school], []]);
      const kreatur = t.put(0, 0, 0, name); kreatur.turnPlayed = 0;
      t.put(1, 0, 0, H.INERT.big);
      const hp0 = t.engine.cardInstances.find(c => c.name === H.INERT.big).counters.currentHp ?? 1000;
      const lv = t.engine.effectiveSchoolLevelForCaster('Destruction Magic', 0, 0);
      R.check('effektive Destruction-Stufe bleibt 1 (nicht 1 + Schule)', lv === 1, lv);
      t.targetFn = (valid) => { const g = valid.find(v => v.cardName === H.INERT.big); return g ? [g.id] : undefined; };
      await t.play(0, 'Phoenix Tackle', { hero: 0, noGrant: true });
      const nach = t.engine.cardInstances.find(c => c.name === H.INERT.big);
      const schaden = hp0 - (nach.counters.currentHp ?? hp0);
      R.check('Phoenix Tackle macht 100 (Stufe 1), nicht 200/300', schaden === 100, schaden);
    }

    R.section('F · „You can only control 1"');
    {
      const t = await H.fresh({ hand: [[name, name], []] });
      t.setAbilities(0, 0, [['Summoning Magic'], [school, school], []]);
      t.setAbilities(0, 1, [['Summoning Magic'], [school, school], []]);
      R.check('vorher beschwörbar', t.engine.isCreatureSummonable(name, 0, 0) === true);
      const k = t.put(0, 0, 0, name); k.turnPlayed = 0;
      R.check('mit einer Kopie auf dem Brett: nicht beschwörbar', t.engine.isCreatureSummonable(name, 0, 1) === false);
      // Zusatzaktion: die Aktion der Phase ist schon verbraucht — mit Schule 2 geht die Beschwörung trotzdem, mit Schule 1 nicht.
      for (const stufe of [2, 1]) {
        const t2 = await H.fresh({ hand: [[name], []] });
        t2.setAbilities(0, 0, [['Summoning Magic'], Array(stufe).fill(school), []]);
        t2.resetActions(0);
        t2.gs.players[0]._actionsPlayedThisPhase = 1; t2.gs.players[0]._actionsPlayedThisTurn = 1; t2.gs.players[0].heroesActedThisTurn = [0];
        const r = await t2.play(0, name, { hero: 0, slot: 0, keepActions: true });
        const steht = t2.zone(0, 0, 0) === name;
        R.check(`${school} ${stufe}, Aktion schon verbraucht: ${stufe === 2 ? 'Beschwörung als Zusatzaktion' : 'keine Beschwörung'}`, stufe === 2 ? steht : !steht, { r, steht });
        if (stufe === 2) var t2ok = t2;
      }
      const t2 = t2ok;
      R.check('keine Engine-Fehler, Zustand sauber', t2.errors.length === 0 && t2.audit().length === 0, [t2.errors, t2.audit()]);
    }
  }

  R.section('G · Rosie + Kai gemeinsam beim selben Helden: die Stärken addieren sich');
  {
    const t = await H.fresh({ hand: [[SPELL3], []] });
    t.setAbilities(0, 0, [[], ['Charme', 'Charme'], ['Fighting', 'Fighting']]);   // keine Destruction: Lv3 braucht 3 Stufen Deckung
    R.check('ohne Kreaturen: nicht wirkbar', kannSpielen(t, 0, SPELL3) === false);
    t.put(0, 0, 0, PAARE[0].name).turnPlayed = 0;
    R.check('nur Rosie (2): Destruction 0 + 2 < 3', kannSpielen(t, 0, SPELL3) === false);
    t.put(0, 0, 1, PAARE[1].name).turnPlayed = 0;
    R.check('Rosie + Kai (2 + 2 = 4 ≥ 3)', kannSpielen(t, 0, SPELL3) === true);
  }

  R.finish();
})().catch(e => { process.stderr.write('THROW ' + (e && e.stack || e) + '\n'); process.exit(2); });
