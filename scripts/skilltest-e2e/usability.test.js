'use strict';
// Start-Abilities auf Stufe 3, Ability-Regeln und Nutzbarkeit/Nutzung beim Behalten (headless).
//   node scripts/skilltest-e2e/usability.test.js
const Rules = require('../../public/skilltest-rules.js');
const KM = require('../../skilltest/learn/keepmodel');
const { getCardDB } = require('../../cards/effects/_card-db');
const train = require('../../skilltest/learn/train');
let fails = 0;
const check = (name, cond, info) => { if (cond) console.log('  ✓', name); else { fails++; console.log('  ✗', name, info !== undefined ? '→ ' + JSON.stringify(info).slice(0, 300) : ''); } };

const cards = getCardDB();
const env = { cards, areaLimitOf: () => undefined };
const heroes = Object.values(cards).filter(c => c.cardType === 'Hero' && c.skilltestLegal && !Rules.HAND_ONLY_HEROES.includes(c.name));
const withHand = (hand) => { const ps = Rules.emptyPlayer(); ps.hand = [...hand]; return ps; };
const place = (ps, name, to) => Rules.applyMove(env, ps, { type: 'place', from: { kind: 'hand', idx: ps.hand.indexOf(name) }, to });

console.log('Start-Abilities auf Stufe 3');
const two = heroes.find(h => h.startingAbility1 && h.startingAbility2 && h.startingAbility1 !== h.startingAbility2);
const same = heroes.find(h => h.startingAbility1 && h.startingAbility1 === h.startingAbility2);
const one = heroes.find(h => (h.startingAbility1 && !h.startingAbility2) || (!h.startingAbility1 && h.startingAbility2));
for (const [label, h] of [['zwei verschiedene', two], ['doppelte', same], ['eine', one]]) {
  if (!h) { console.log('  (kein Hero mit ' + label + ' Start-Ability in den Daten)'); continue; }
  const ps = withHand([h.name, ...heroes.filter(x => x !== h).slice(0, 3).map(x => x.name)]);
  const r = place(ps, h.name, { kind: 'hero', hi: 0 });
  const zones = r.ps.abilityZones[0].filter(Boolean);
  check(`${label} Start-Ability(s) (${h.name}): jede auf Stufe 3`, r.ok && zones.length >= 1 && zones.every(z => Rules.abilityLevel(z) === 3 && z.s === 3), zones);
  check('…Engine-Stapel hat je 3 Karten', Rules.abilityStacks(r.ps)[0].filter(st => st.length).every(st => st.length === 3));
}

console.log('Ability-Regeln');
{
  const h = two;
  const abName = h.startingAbility1;
  const ability = Object.values(cards).find(c => c.cardType === 'Ability' && c.name === abName);
  if (ability) {
    const ps = withHand([h.name, ...heroes.filter(x => x !== h).slice(0, 2).map(x => x.name), abName]);
    let r = place(ps, h.name, { kind: 'hero', hi: 0 }); let st = r.ps;
    const own = st.abilityZones[0].findIndex(z => z && z.n === abName);
    const free = st.abilityZones[0].findIndex(z => !z);
    r = place(st, abName, { kind: 'ability', hi: 0, slot: own });
    check('Gleiche Ability von der Hand auf eine Stufe-3-Start-Ability: abgelehnt (Maximum)', !r.ok && /Maximales Level/.test(r.reason), r.reason);
    if (free >= 0) {
      r = place(st, abName, { kind: 'ability', hi: 0, slot: free });
      check('…und nicht als zweite Zone desselben Heroes', !r.ok && /schon/.test(r.reason), r.reason);
      check('canDrop spiegelt das (Zone mit Ability, freie Zone)', !Rules.canDrop(env, st, abName, { kind: 'ability', hi: 0, slot: own }) && !Rules.canDrop(env, st, abName, { kind: 'ability', hi: 0, slot: free }));
    }
  }
  // Andere Ability von der Hand: wie bisher Stufe 3 auf der Hand-Karte
  const other = Object.values(cards).find(c => c.cardType === 'Ability' && c.skilltestLegal && c.name !== two.startingAbility1 && c.name !== two.startingAbility2);
  const ps = withHand([two.name, ...heroes.filter(x => x !== two).slice(0, 2).map(x => x.name), other.name]);
  let st = place(ps, two.name, { kind: 'hero', hi: 0 }).ps;
  const free = st.abilityZones[0].findIndex(z => !z);
  const r2 = place(st, other.name, { kind: 'ability', hi: 0, slot: free });
  check('Neue Ability von der Hand: Stufe 3 (wie bisher)', r2.ok && Rules.abilityLevel(r2.ps.abilityZones[0][free]) === 3, r2.reason);
}

console.log('Nutzbarkeit (Brett-bewusst)');
{
  // Hero mit einer Schul-Start-Ability (Stufe 3): Zauber dieser Schule bis Stufe 3 sind sofort nutzbar, fremde Schulen nicht
  const schoolHero = heroes.find(h => [h.startingAbility1, h.startingAbility2].some(a => a && Object.values(cards).some(c => c.cardType === 'Spell' && c.skilltestLegal && c.level === 3 && (c.spellSchool1 === a))));
  const school = [schoolHero.startingAbility1, schoolHero.startingAbility2].find(a => a && Object.values(cards).some(c => c.cardType === 'Spell' && c.skilltestLegal && c.level === 3 && c.spellSchool1 === a));
  const own = Object.values(cards).find(c => c.cardType === 'Spell' && c.skilltestLegal && c.level === 3 && c.spellSchool1 === school && !c.spellSchool2 && (c.subtype || 'Normal') === 'Normal');
  const heroSchools = new Set([...heroes.slice(0, 3), schoolHero].flatMap(h => [h.startingAbility1, h.startingAbility2]));
  const foreign = Object.values(cards).find(c => c.cardType === 'Spell' && c.skilltestLegal && c.level === 3 && c.spellSchool1 && !c.spellSchool2 && !heroSchools.has(c.spellSchool1) && (c.subtype || 'Normal') === 'Normal');
  // Brett: schoolHero + zwei Heroes ohne diese Schule und ohne die fremde Schule
  const fillers = heroes.filter(h => h !== schoolHero && ![h.startingAbility1, h.startingAbility2].includes(school) && ![h.startingAbility1, h.startingAbility2].includes(foreign.spellSchool1)).slice(0, 2);
  let ps = withHand([schoolHero.name, ...fillers.map(h => h.name), own.name, foreign.name]);
  for (let i = 0; i < 3; i++) ps = place(ps, [schoolHero, ...fillers][i].name, { kind: 'hero', hi: i }).ps;
  const ctx = KM.buildContext(env, ps, [own.name, foreign.name]);
  check(`${own.name} (${school} Lv3) ist mit dem Brett sofort nutzbar`, KM.usability(env, own.name, ctx) === 'now', KM.usability(env, own.name, ctx));
  check(`${foreign.name} (${foreign.spellSchool1} Lv3, Schule fehlt) ist nicht nutzbar`, KM.usability(env, foreign.name, ctx) === 'no', KM.usability(env, foreign.name, ctx));
  // Mit einer passenden Ability auf der Hand: 'hand'
  const abil = Object.values(cards).find(c => c.cardType === 'Ability' && c.name === foreign.spellSchool1);
  if (abil) {
    const ctx2 = KM.buildContext(env, ps, [own.name, foreign.name, abil.name]);
    check('…mit der passenden Ability auf der Hand: „erst mit Hand-Abilities"', KM.usability(env, foreign.name, ctx2) === 'hand', KM.usability(env, foreign.name, ctx2));
  }
  const model = KM.newModel();
  const usableFn = (c) => !!c;
  const pNow = KM.prior(model, own.name, true, 'now'), pNo = KM.prior(model, foreign.name, true, 'no');
  check('Vorgabe: nutzbar positiv, nicht nutzbar deutlich negativ', pNow > 0 && pNo < 0 && Math.abs(pNo) > pNow, [pNow, pNo]);
  const decide = KM.makeDecider({ env, model, usable: usableFn, maxKeep: 5 });
  const res = decide(ps);
  const recycled = res.recycle.map(i => ps.hand[i]);
  check('Entscheider behält den nutzbaren und recycelt den nicht nutzbaren Zauber', recycled.includes(foreign.name) && !recycled.includes(own.name), recycled);
  const logOf = (n) => res.log.find(e => e.c === n);
  check('Protokoll hält die Nutzbarkeit fest (u)', logOf(foreign.name) && logOf(foreign.name).u === 'no' && logOf(own.name) && logOf(own.name).u === 'now', res.log.map(e => [e.c, e.u]));
  check('Merkmale enthalten use:…', logOf(foreign.name).f.some(f => f.startsWith('use:')), logOf(foreign.name).f);

  console.log('Gelernte Nutzung');
  const usage = {}, usageClass = {};
  const prof = { usage, usageClass };
  const rec = (name, cls, used, n) => { for (let i = 0; i < n; i++) { const keepLog = [{ c: name, a: 1, u: cls, f: [], d: 0.1, x: 0 }]; const learnLog = used ? [{ seat: 0, key: 'spell:' + name }] : []; train.learnUsage(prof, keepLog, learnLog, 0); } };
  rec(own.name, 'now', false, 40);                       // nutzbar, wird aber nie gespielt
  const cardLike = Object.values(cards).find(c => c.cardType === 'Spell' && c !== own && c.skilltestLegal && (c.subtype || 'Normal') === 'Normal' && c.name !== foreign.name);
  rec(cardLike.name, 'now', true, 40);
  check('Nutzung wird je Karte gezählt (n, gespielt)', usage[own.name].n === 40 && usage[own.name].sum === 0 && usage[cardLike.name].sum === 40, [usage[own.name], usage[cardLike.name]]);
  check('…und je Typ und Klasse (Spell:now, *:Spell)', usageClass['Spell:now'].n >= 80 && usageClass['*:Spell'].n >= 80, usageClass);
  const never = KM.usagePrior(usage, usageClass, own.name, 'Spell', 'now'), always = KM.usagePrior(usage, usageClass, cardLike.name, 'Spell', 'now');
  check('Nutzungs-Vorgabe: nie gespielt < immer gespielt', never < 0 && always > 0 && never < always, [never, always]);
  const decide2 = KM.makeDecider({ env, model: KM.newModel(), usable: usableFn, maxKeep: 5, usage, usageClass });
  const res2 = decide2(ps);
  const dOwn = res2.log.find(e => e.c === own.name);
  check('Eine nutzbare, aber nie gespielte Karte verliert dadurch an Wert', dOwn && dOwn.d < res.log.find(e => e.c === own.name).d, [dOwn && dOwn.d, res.log.find(e => e.c === own.name).d]);
}
console.log('Heldenwahl nach wirkbaren Zaubern der Hand');
{
  const policy = require('../../skilltest/policy');
  const destruction = heroes.find(h => [h.startingAbility1, h.startingAbility2].includes('Destruction Magic'));
  const other = heroes.find(h => ![h.startingAbility1, h.startingAbility2].includes('Destruction Magic') && ![h.startingAbility1, h.startingAbility2].includes('Magic Arts'));
  const hand = ['Armageddon', 'Calm Diatribe'];
  check('Hero mit Destruction Magic wirkt Armageddon (Lv3) aus der Hand, ein fremder Hero nicht',
    policy.castableInHand(cards, hand, destruction) >= 1 && policy.castableInHand(cards, hand, other) < 1, [policy.castableInHand(cards, hand, destruction), policy.castableInHand(cards, hand, other)]);
  check('Karten ohne Stufe zählen halb, Fremdkarten (Potion) nicht', policy.castableInHand(cards, ['Healing Potion'], destruction) === 0);
}
console.log(fails ? `\n✗ ${fails} Fehler` : '\n✓ Nutzbarkeits-Tests grün');
process.exit(fails ? 1 : 0);
