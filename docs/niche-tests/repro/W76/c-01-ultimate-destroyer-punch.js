'use strict';
// W76c-01 · Ultimate Destroyer Punch (Attack Normal Lv2, Fighting)
// „Choose a Creature your opponent controls and defeat it. Then, deal damage equal to that Creature's max HP to the corresponding Hero, to a maximum of 300. This Attack's level is reduced by 1 for each of your defeated Heroes."
const H = require('../../lib/h.js');
const CARD = 'Ultimate Destroyer Punch';
const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;

async function aufbau(o = {}) {
  const t = await H.fresh({ hand: [[CARD, CARD, 'ZZ Filler'], []], deckSize: 20, gold: [100, 100], active: 0 });
  if (o.fighting !== 0) t.setAbilities(0, 0, [Array(o.fighting ?? 2).fill('Fighting'), [], []]);
  const k = t.put(1, o.heroIdx ?? 1, 1, o.big ? H.INERT.big : H.INERT.creature, { counters: { currentHp: o.hp ?? 100, maxHp: o.maxHp ?? 100, ...(o.counters || {}) } });
  t.targetFn = (valid) => { const x = valid.find(v => v.cardInstance === k); return x ? [x.id] : undefined; };
  return { t, k };
}

(async () => {
  const R = H.runner();

  R.section('A · Creature wird besiegt, der zugehörige Held (nicht der Gastgeber irgendeines Helden) erleidet die Max-HP, höchstens 300');
  for (const [maxHp, erwartet] of [[100, 100], [250, 250], [300, 300], [500, 300]]) {
    const { t, k } = await aufbau({ maxHp, hp: 40, heroIdx: 1 });
    const hp = [0, 1, 2].map(h => t.hp(1, h));
    await t.play(0, CARD, { hero: 0, noGrant: true });
    R.check(`Max-HP ${maxHp} (aktuell nur 40): Held 1:1 erleidet ${erwartet}`, hp[1] - t.hp(1, 1) === erwartet, [hp, [0, 1, 2].map(h => t.hp(1, h))]);
    R.check(`Max-HP ${maxHp}: die anderen Helden bleiben heil`, t.hp(1, 0) === hp[0] && t.hp(1, 2) === hp[2], [0, 1, 2].map(h => t.hp(1, h)));
    R.check(`Max-HP ${maxHp}: Creature besiegt`, k.zone !== 'support', k.zone);
    R.check('sauber', sauber(t), { e: t.errors, a: t.audit() });
  }

  R.section('B · Level: −1 je besiegtem eigenen Helden (Fighting 1 reicht für Lv2 mit einem besiegten Helden)');
  {
    const { t } = await aufbau({ fighting: 1 });
    const cd = t.DB[CARD];
    R.check('Fighting 1, kein besiegter Held: Level 2 nicht erreichbar', t.engine.heroMeetsLevelReq(0, 0, cd) === false, t.engine.heroMeetsLevelReq(0, 0, cd));
    t.hero(0, 2).hp = 0;
    R.check('Fighting 1, 1 besiegter Held: Level 1 → erreichbar', t.engine.heroMeetsLevelReq(0, 0, cd) === true, t.engine.heroMeetsLevelReq(0, 0, cd));
  }
  {
    const { t } = await aufbau({ fighting: 0 });
    const cd = t.DB[CARD];
    t.hero(0, 1).hp = 0; t.hero(0, 2).hp = 0;
    R.check('Fighting 0, 2 besiegte Helden: Level 0 → erreichbar', t.engine.heroMeetsLevelReq(0, 0, cd) === true, t.engine.heroMeetsLevelReq(0, 0, cd));
    R.check('Fighting 0, nur 1 besiegter Held (2 − 1 = 1): nicht erreichbar', (() => { t.hero(0, 2).hp = 800; return t.engine.heroMeetsLevelReq(0, 0, cd); })() === false);
  }
  {
    // Zwei Kopien auf der Hand senken nicht doppelt (selbstsenkungZaehlt)
    const { t } = await aufbau({ fighting: 0 });
    const cd = t.DB[CARD];
    t.hero(0, 2).hp = 0;
    R.check('zwei Kopien auf der Hand, 1 besiegter Held: Level 1 (nicht 0)', t.engine.heroMeetsLevelReq(0, 0, cd) === false, t.engine.heroMeetsLevelReq(0, 0, cd));
  }

  R.section('C · Choreografie: Rammen, Impact, Wurf auf den Helden, Landung');
  {
    const { t } = await aufbau({ maxHp: 200, heroIdx: 1 });
    await t.play(0, CARD, { hero: 0, noGrant: true });
    const ram = t.evs('play_ram_animation')[0];
    R.check('der Angreifer rammt die Zone der Creature (1:1, Slot 1) vorwärts', !!ram && ram.targetOwner === 1 && ram.targetHeroIdx === 1 && ram.targetZoneSlot === 1 && !ram.rueckwaerts, ram);
    const typen = t.evs('play_zone_animation').map(e => e.type);
    R.check('Reihenfolge: udp_impact → Wurf → udp_land', typen.indexOf('udp_impact') >= 0 && typen.indexOf('udp_land') > typen.indexOf('udp_impact'), typen);
    const th = t.evs('play_card_throw').find(e => e.mode === 'throw');
    R.check('Wurf von der Creature (mit Kartenname) zum Helden 1:1, Standardflug zur Ablage unterdrückt', !!th && th.fromHeroIdx === 1 && th.fromSlot === 1 && th.cardName === H.INERT.creature && th.toKind === 'hero' && th.toHeroIdx === 1 && th.suppressDiscard === true, th);
    R.check('Karte liegt in der Ablage', t.pile(0, 'discardPile').includes(CARD), t.pile(0, 'discardPile'));
  }

  R.section('D · Schutz: geschützte Creature bleibt stehen, der Schaden fällt trotzdem („Then"); besiegter Held: kein Schaden');
  {
    const { t, k } = await aufbau({ maxHp: 200, heroIdx: 1, counters: { _cardinalImmune: 1 } });
    const hp = t.hp(1, 1);
    await t.play(0, CARD, { hero: 0, noGrant: true });
    R.check('Cardinal-Immunität: Creature bleibt stehen', k.zone === 'support', k.zone);
    R.check('… der Held nimmt trotzdem 200', hp - t.hp(1, 1) === 200, [hp, t.hp(1, 1)]);
  }
  {
    const { t, k } = await aufbau({ maxHp: 200, heroIdx: 1 });
    t.hero(1, 1).hp = 0;
    await t.play(0, CARD, { hero: 0, noGrant: true });
    R.check('Held schon besiegt: Creature besiegt, kein Schaden, keine Fehler', k.zone !== 'support' && t.hero(1, 1).hp === 0 && sauber(t), { z: k.zone, e: t.errors });
  }
  {
    // Spielbar nur mit einer gegnerischen Creature
    const t = await H.fresh({ hand: [[CARD], []], deckSize: 20, gold: [100, 100], active: 0 });
    t.setAbilities(0, 0, [['Fighting', 'Fighting'], [], []]);
    t.put(0, 1, 1, H.INERT.creature);
    const r = await t.play(0, CARD, { hero: 0, noGrant: true });
    R.check('nur EIGENE Creature auf dem Brett: nicht spielbar', r !== true && t.pile(0, 'hand').includes(CARD), r);
  }
  R.finish();
})().catch(e => { process.stderr.write('THROW ' + (e && e.stack || e) + '\n'); process.exit(2); });
