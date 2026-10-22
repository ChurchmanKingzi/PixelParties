'use strict';
// W57a · Randfund aus W56a: `handleHeroDeathCleanup` leerte `hero.statuses` ZUERST (der Fluch fiel weg), die DANACH abgelegte ATK-Ausrüstung (Club of Gobbo +30) buchte ihren Abzug
//   dann auf die sichtbare ATK (beim Fluch 0, geklemmt) statt auf den Zwischenspeicher `_cursedAtkSuppressed`; der Abgang der Curse-Karte gab danach den alten Gesamtwert (inkl. Club) zurück →
//   ein verfluchter Held mit +30 ATK-Ausrüstung stand nach dem Tod bei ATK 70 statt 40 (Überhang bis zur Wiederbelebung bzw. zum Formwechsel).
// Grundsatz seit W53: ATK-Boni pro Equip-Instanz genau einmal, nur beim aktuellen Träger; Zustand nach jeder Sequenz == Zustand eines direkt so aufgebauten Helden.
// Differenztest (beide Sitze): Szene mit allem + Tod (+ Wiederbelebung) gegen eine REFERENZ-Szene, die nur enthält, was den Tod überlebt (ohne Ausrüstung, ohne Fluch):
//   Fighting · dauerhafter Zuwachs (`permAtkDelta`) · befristete Gabe · Cykyran-Verdopplung · ATK-Aura (Rioting Village) · Taio/Toras-Heldenpassive (ohne Artifacts).
// Abdeckung: alle 21 ATK-Equips (feste Boni + dynamisch Core/Gun, Laser Cannon) × Fluch {keiner · Curse-Karte VOR/NACH der Ausrüstung · nur Status} · Mischszenen · Quellen dauerhafter Zuwächse ·
//   Taio/Toras · Aura · fremde Seite · Extra Life · Fluch heilen nach dem Tod/der Wiederbelebung · Fluch neu auflegen nach der Wiederbelebung · zweiter Tod · Core/Gun anderer Helden.
// Exit 0 = korrekt.
const U = require('../../lib/umhaengen.js');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });

const DB = U.H.DB;
const CLUB = 'Club of Gobbo', SUN = 'The Sun Sword', GUN = 'Future Tech Gun', CORE = 'Ancient Tech Infinite Energy Core', CLOAK = 'Cloak of Edge';
const CYK = 'Cykyran War Counselor', GOR = 'Gorinthian War Counselor', CEN = 'Censpartan War Counselor';
const TAIO = 'Taio, the Sun Fencer', TORAS = 'Toras, Master of all Weapons', PIKE = 'Phalanx Pike';
const NERO = 'Nero Zira, the Mastermind', RAKAH = 'Rakah, the Loan Shark', MIRJAM = 'Mirjam, the Fallen Cute Angel', CHAORC = 'Chaorc Pyre Grill Master', WAVI = 'Wavilion';
const RIF = 'Future Tech Gunslinger Riffel';
const BLANK = ['Tushu, the Knowledge Keeper', 'Zwei, the Lucky Thief'];

const STATIC = {
  'Blade of the Frostbringer': 10, 'Blade of the Swamp Witch': 10, 'Club of Gobbo': 30, 'Earth-Shattering Hammer, Relic of Deri': 10,
  "Explosivo's Sword": 10, 'Future Tech Laser Cannon': 100, 'Heart-Shaped Bow, the Final Proof of Cuteness': 10, 'Legendary Sword of a Barbarian King': 10,
  'Lunatic Cycle - Full Moon': 100, 'Mana-Consuming Blade': 10, 'Modnir, Hammer of Coolness': 100, 'Phalanx Pike': 30, 'Sacred Hammer of the Volcano': 30,
  'Shattered Trident, Treasure of the Deepsea': 10, 'Super-Killing Knife, the Tool of Liquidation': 10, 'The Hands of Big Gwen': 10, "The Master's Sword": 10,
  'The Sun Sword': 20, 'Vampiric Sword': 10,
};
const ALL = [...Object.keys(STATIC), CORE, GUN];

/** Legt eine ATK-Ausrüstung über den echten Spielweg (Modnir: nur aus dem Coolness Stack spielbar → wie `actionTransferAttachment` einsetzen). */
async function lege(t, me, name, hi = 0) {
  if (name === 'Modnir, Hammer of Coolness') {
    const s = t.gs.players[me].supportZones[hi].findIndex(z => z.length === 0);
    const inst = t.put(me, hi, s, name);
    await t.run(() => t.engine.runHooks('onPlay', { _onlyCard: inst, playedCard: inst, card: inst, cardName: name, zone: 'support', heroIdx: hi, zoneSlot: s, _skipReactionCheck: true }));
    return inst;
  }
  await U.lege(t, me, name, hi);
  return t.inst(c => c.name === name && c.zone === 'support' && c.heroIdx === hi)[0];
}
/** Fluch nur als Status (kein Curse-Karteninstanz): wie `fluchAnlegen` in curse.js — Zwischenspeicher füllen, ATK auf 0, Status setzen. */
async function fluchStatus(t, me, hi = 0) {
  const h = t.hero(me, hi);
  h._cursedAtkSuppressed = h.atk || 0; h.atk = 0;
  await t.engine.addHeroStatus(me, hi, 'cursed', { appliedBy: 1 - me, source: 'Test' });
}

/**
 * Szene für Sitz `me`: Held 0 = F.held (Standard: neutraler Held), Held 1/2 neutral, Gegner neutral.
 * F: { held, equips:[…], fluch: null|'vor'|'nach'|'status', fight, perm, temp, cyk, aura, quelle:'cloak'|…, ohneAusruestung (Referenz) }
 * Reihenfolge: Grundlagen (Aura, Ratgeber, Fighting, Zuwachs, Gabe) → ggf. Fluch VOR den Equips → Equips → ggf. Fluch NACH den Equips.
 */
async function bau(me, F, ref = false) {
  const op = 1 - me;
  const equips = ref ? [] : (F.equips || []);
  const fluch = ref ? null : F.fluch;
  const hand = [...equips, ...(F.fight ? ['Fighting'] : []), ...(fluch === 'vor' || fluch === 'nach' ? ['Curse'] : []), ...(F.cyk ? [CYK, GOR, CEN] : []), ...(F.quelle === 'cloak' ? [CLOAK] : []), ...(F.extra || [])];
  const held = F.held || BLANK[0];
  const t = await U.fresh(me, { hand, heroes: { [me]: [held, BLANK[0], BLANK[1]], [op]: [BLANK[0], BLANK[0], BLANK[1]] }, opts: F.opts });
  t.gs.turn = Math.max(t.gs.turn || 0, 3);
  if (equips.includes('Lunatic Cycle - Full Moon')) t.put(me, 2, 0, 'Lunatic Cycle - Gibbous Moon');
  if (F.aura) { t.putArea(me, 'Rioting Village'); t.engine.syncAlleAtkAuren(); }
  if (F.cyk) { let s = 0; for (const r of [CYK, GOR, CEN]) await t.play(me, r, { hero: 2, slot: s++, active: me }); }
  if (F.fight) await t.play(me, 'Fighting', { hero: 0, zoneSlot: 0, active: me });
  if (F.perm) t.engine.actionPermAtk(t.hero(me, 0), me, 0, 25, 'Test');
  if (F.temp) t.engine.grantTempHeroAtk(me, 0, 100, { expiresAtTurn: t.gs.turn + 5, expiresForPlayer: op, source: 'Test' });
  if (F.quelle === 'cloak') { await U.lege(t, me, CLOAK, 0); t.gs.hoptUsed = {}; await t.activateEquip(me, 0, t.find(CLOAK, 'support').zoneSlot, {}); }
  if (F.vorher) await F.vorher(t, me, ref);
  if (fluch === 'vor') await U.haenge(t, me, 'Curse', 0);
  if (fluch === 'status' && !ref) await fluchStatus(t, me, 0);
  for (const e of equips) await lege(t, me, e, 0);
  if (fluch === 'nach') await U.haenge(t, me, 'Curse', 0);
  t.errors.length = 0;
  return t;
}

const tempSumme = (h) => (Array.isArray(h._tempAtkGrants) ? h._tempAtkGrants.reduce((n, g) => n + (g.amount || 0), 0) : 0);
/** Alles, was den ATK-Zustand eines Helden ausmacht (inkl. Heldenpassiv-Zähler). */
function zust(t, me, hi = 0) {
  const h = t.hero(me, hi), hinst = t.inst(c => c.zone === 'hero' && c.owner === me && c.heroIdx === hi)[0];
  const fight = t.inst(c => c.name === 'Fighting' && c.zone === 'ability' && c.owner === me).reduce((n, c) => n + (c.counters.atkGranted || 0), 0);
  return {
    atk: h.atk, base: h.baseAtk, perm: h.permAtkDelta || 0, cyk: h._cykyranBonus || 0, supp: h._cursedAtkSuppressed === undefined ? '-' : h._cursedAtkSuppressed,
    cursed: !!(h.statuses && h.statuses.cursed), aura: h._atkAuraGrant || 0, temp: tempSumme(h), fight,
    taio: hinst && hinst.counters._taioAtkTotal || 0, toras: hinst && hinst.counters.torasAtkBonus || 0,
  };
}
const gleich = (a, b) => JSON.stringify(a) === JSON.stringify(b);
/** Equips verlassen den Helden vollständig: keine Instanz auf dem Brett, keine Restbuchung, Karte in der Ablage ihres Besitzers. */
function ausruestungWeg(t, me, equips) {
  const bad = [];
  for (const e of equips) {
    if (t.inst(c => c.name === e && c.zone === 'support').length) bad.push(`${e} liegt noch`);
  }
  for (const c of t.engine.cardInstances) {
    if (c.zone !== 'support' && c.zone !== 'ability' && c.zone !== 'hero' && (c.counters && (c.counters.atkGranted || 0) > 0)) bad.push(`verwaiste Buchung ${c.name} (${c.zone}) ${c.counters.atkGranted}`);
  }
  return bad;
}

const toeten = (t, me) => t.run(() => t.engine.actionDefeatHero({ name: 'T', owner: 1 - me, heroIdx: 0 }, t.hero(me, 0), {}));
const beleben = (t, me) => t.run(() => t.engine.actionReviveHero(me, 0, 100, { source: 'Test' }));

(async () => {
  const R = U.H.runner();
  for (const me of [0, 1]) {
    const op = 1 - me;

    // ═══ (A) Alle 21 ATK-Equips × Fluch {keiner, Karte vor, Karte nach, nur Status} ═══
    R.section(`Sitz ${me} · (A) ${ALL.length} ATK-Equips × Fluch-Varianten: Tod → Wiederbelebung == Referenz ohne Ausrüstung/Fluch`);
    for (const name of ALL) {
      const fehler = [];
      for (const fl of [null, 'vor', 'nach', 'status']) {
        const F = { equips: [name], fluch: fl }, tag = `${fl || 'ohne Fluch'}`;
        const t = await bau(me, F), ref = await bau(me, F, true), soll = zust(ref, me);
        const vorTod = zust(t, me);
        if (fl && !(vorTod.cursed && vorTod.atk === 0)) fehler.push(`${tag}: vor dem Tod nicht verflucht/0: ${JSON.stringify(vorTod)}`);
        await toeten(t, me);
        const tot = zust(t, me);
        if (!gleich(tot, soll)) fehler.push(`${tag} TOT: ${JSON.stringify(tot)} != ${JSON.stringify(soll)}`);
        const weg = ausruestungWeg(t, me, [name]); if (weg.length) fehler.push(`${tag} TOT: ${weg.join(', ')}`);
        if (t.errors.length) fehler.push(`${tag} TOT ERR ${t.errors[0]}`);
        await beleben(t, me);
        const leb = zust(t, me);
        if (!gleich(leb, soll)) fehler.push(`${tag} WIEDERBELEBT: ${JSON.stringify(leb)} != ${JSON.stringify(soll)}`);
        if (t.errors.length) fehler.push(`${tag} REV ERR ${t.errors[0]}`);
      }
      R.check(`${name}: Tod und Wiederbelebung (4 Fluch-Varianten) == direkt aufgebauter Held ohne Ausrüstung/Fluch`, fehler.length === 0, fehler);
    }

    // ═══ (B) Mischszenen: alle Quellen zusammen, ± Fluch, ± Aura ═══
    R.section(`Sitz ${me} · (B) Mischszenen (Fighting, Zuwachs, Gabe, Cykyran, Club, Sun Sword, ± Fluch, ± Aura)`);
    for (const aura of [false, true]) for (const fl of [null, 'vor', 'nach', 'status']) {
      const F = { equips: [CLUB, SUN], fluch: fl, fight: 1, perm: 1, temp: 1, cyk: 1, aura };
      const t = await bau(me, F), ref = await bau(me, F, true), soll = zust(ref, me);
      const fehler = [];
      await toeten(t, me);
      const tot = zust(t, me); if (!gleich(tot, soll)) fehler.push(`TOT ${JSON.stringify(tot)} != ${JSON.stringify(soll)}`);
      const weg = ausruestungWeg(t, me, [CLUB, SUN]); if (weg.length) fehler.push(weg.join(', '));
      await beleben(t, me);
      const leb = zust(t, me); if (!gleich(leb, soll)) fehler.push(`REV ${JSON.stringify(leb)} != ${JSON.stringify(soll)}`);
      // weiterer Zuwachs nach der Wiederbelebung wirkt genau einmal (ATK-Aura multipliziert den Zuwachs)
      t.engine.actionPermAtk(t.hero(me, 0), me, 0, 20, 'Test'); ref.engine.actionPermAtk(ref.hero(me, 0), me, 0, 20, 'Test');
      const nach = zust(t, me), nsoll = zust(ref, me); if (!gleich(nach, nsoll)) fehler.push(`+20 danach ${JSON.stringify(nach)} != ${JSON.stringify(nsoll)}`);
      if (t.errors.length) fehler.push('ERR ' + t.errors[0]);
      R.check(`Mischung ${aura ? 'mit Aura' : 'ohne Aura'}, Fluch ${fl || 'keiner'}: Tod, Wiederbelebung, Zuwachs danach == Referenz`, fehler.length === 0, fehler);
    }

    // ═══ (C) Einzelne Quellen ohne Ausrüstung: Fighting · Zuwachs · Gabe · Cykyran · Aura (± Fluch) ═══
    R.section(`Sitz ${me} · (C) Einzelquellen, ohne Equip, ± Fluch`);
    for (const q of ['fight', 'perm', 'temp', 'cyk', 'aura']) for (const fl of [null, 'vor', 'status']) {
      const F = { [q]: 1, fluch: fl };
      const t = await bau(me, F), ref = await bau(me, F, true), soll = zust(ref, me), fehler = [];
      await toeten(t, me);
      const tot = zust(t, me); if (!gleich(tot, soll)) fehler.push(`TOT ${JSON.stringify(tot)} != ${JSON.stringify(soll)}`);
      await beleben(t, me);
      const leb = zust(t, me); if (!gleich(leb, soll)) fehler.push(`REV ${JSON.stringify(leb)} != ${JSON.stringify(soll)}`);
      if (t.errors.length) fehler.push('ERR ' + t.errors[0]);
      R.check(`${q}, Fluch ${fl || 'keiner'}: Tod + Wiederbelebung == Referenz (Quelle überlebt genau einmal)`, fehler.length === 0, fehler);
    }

    // ═══ (D) Cloak of Edge (echte Aktivierung, +20 dauerhaft; die Karte selbst geht mit dem Tod) ± Fluch ═══
    R.section(`Sitz ${me} · (D) Cloak of Edge: der dauerhafte Zuwachs bleibt, die Karte geht`);
    for (const fl of [null, 'vor', 'nach']) {
      const F = { quelle: 'cloak', fluch: fl, equips: [CLUB] };
      const t = await bau(me, F), fehler = [];
      const ref = await bau(me, { quelle: 'cloak' }, true), soll = zust(ref, me);
      // Referenz: Cloak liegt dort (nicht Teil der Referenz-Karten) — Zuwachs +20 steht in beiden; nur der Club/Fluch fehlen
      const vor = zust(t, me);
      await toeten(t, me);
      const tot = zust(t, me);
      // der Cloak geht mit dem Tod (Equip), der Zuwachs bleibt: Referenz = gleiche Szene, in der der Cloak nach der Aktivierung zerstört wurde
      const ref2 = await bau(me, { quelle: 'cloak' }, true); await ref2.run(() => ref2.engine.actionDestroyCard({ name: 'T', owner: 1 - me }, ref2.find(CLOAK, 'support'), {}));
      const s2 = zust(ref2, me);
      if (!gleich(tot, s2)) fehler.push(`TOT ${JSON.stringify(tot)} != ${JSON.stringify(s2)}`);
      await beleben(t, me);
      const leb = zust(t, me); if (!gleich(leb, s2)) fehler.push(`REV ${JSON.stringify(leb)} != ${JSON.stringify(s2)}`);
      if (!(vor.perm === 20 && s2.perm === 20)) fehler.push(`Probe: Zuwachs +20 gebucht? vor ${vor.perm}, ref ${s2.perm}`);
      void soll;
      R.check(`Cloak + Club, Fluch ${fl || 'keiner'}: Tod + Wiederbelebung → gedruckter Wert + 20 (permanent), nichts darüber`, fehler.length === 0, fehler);
    }

    // ═══ (E) Quellen dauerhafter Zuwächse (Nero, Rakah, Mirjam, Chaorc, Wavilion) mit Club ± Fluch: Tod ═══
    R.section(`Sitz ${me} · (E) Heldenpassive/Kreaturen mit dauerhaftem Zuwachs + Club ± Fluch`);
    const QU = {
      [NERO]: { held: NERO, G: 30, gewinn: async (t) => { t.gs.hoptUsed = {}; const slot = t.gs.players[me].supportZones[0].findIndex(z => z.length === 0); await t.play(me, 'ZZ Dummy', { hero: 0, slot }); } },
      [RAKAH]: { held: RAKAH, G: 10, gewinn: async (t) => { const slot = t.gs.players[me].supportZones[0].findIndex(z => z.length === 0); const k = t.put(me, 0, slot, 'ZZ Dummy Frail'); k.turnPlayed = 0;
        await t.run(() => t.engine.opfereKreatur(k, { name: 'Test', owner: me, heroIdx: 0 }, { animation: false })); } },
      [MIRJAM]: { held: MIRJAM, G: 50, kannNichtLeben: true, gewinn: async (t) => { await t.run(() => t.engine.actionDealDamage({ name: 'Test', owner: 1 - me, heroIdx: 0 }, t.hero(me, 0), 50, 'fire')); } },
      [CHAORC]: { held: RIF, G: 40, vorher: async (t) => { const c = t.put(me, 1, 0, CHAORC); c.turnPlayed = 1; },
        gewinn: async (t) => { t.gs.hoptUsed = {}; const slot = t.gs.players[me].supportZones[1].findIndex(z => z.length === 0); const k = t.put(me, 1, slot, 'ZZ Dummy'); k.turnPlayed = 1; t.gs.currentPhase = 2; t.gs.activePlayer = me; t.policy.confirm = true;
          t.script.push({ match: d => d && d.type === 'optionPicker' && d.title === CHAORC, answer: () => ({ optionId: 'atk' }) }); await t.activateCreature(me, 1, 0); } },
      [WAVI]: { held: RIF, G: 100, vorher: async (t) => { const w = t.put(me, 0, 2, WAVI); w.turnPlayed = 0; },
        gewinn: async (t) => { t.hero(1 - me, 0).hp = 30; await t.run(() => t.engine.actionDealDamage({ name: 'Test', owner: me, heroIdx: 0 }, t.hero(1 - me, 0), 100, 'attack')); t.hero(1 - me, 0).hp = 800; } },
    };
    for (const [name, q] of Object.entries(QU)) for (const fl of [null, 'vor', 'nach']) {
      const F = { held: q.held, equips: [CLUB], fluch: fl, vorher: q.vorher };
      const t = await bau(me, F), fehler = [];
      // Zuwachs NACH dem Aufbau auslösen (Ausrüstung und Fluch liegen schon) — wie im Spiel
      await q.gewinn(t);
      const ref = await bau(me, { held: q.held, vorher: q.vorher }, true); await q.gewinn(ref);
      const soll = zust(ref, me);
      if (soll.perm !== q.G) fehler.push(`Probe: Zuwachs ${q.G} nicht gebucht (${soll.perm})`);
      await toeten(t, me);
      const tot = zust(t, me); if (!gleich(tot, soll)) fehler.push(`TOT ${JSON.stringify(tot)} != ${JSON.stringify(soll)}`);
      if (!q.kannNichtLeben) { await beleben(t, me); const leb = zust(t, me); if (!gleich(leb, soll)) fehler.push(`REV ${JSON.stringify(leb)} != ${JSON.stringify(soll)}`); }
      if (t.errors.length) fehler.push('ERR ' + t.errors[0]);
      R.check(`${name.split(',')[0]} + Club, Fluch ${fl || 'keiner'}: Tod${q.kannNichtLeben ? '' : ' + Wiederbelebung'} == Referenz (Zuwachs ${q.G} bleibt, Club weg)`, fehler.length === 0, fehler);
    }

    // ═══ (F) Taio / Toras: Bonus je Artifact; beim Tod gehen die Artifacts, der Bonus mit ═══
    R.section(`Sitz ${me} · (F) Taio/Toras (je Artifact) ± Fluch`);
    for (const held of [TAIO, TORAS]) for (const fl of [null, 'vor', 'nach', 'status']) {
      const F = { held, equips: [CLUB, PIKE], fluch: fl, fight: held === TAIO ? 1 : 0 };
      const t = await bau(me, F), ref = await bau(me, F, true), soll = zust(ref, me), fehler = [];
      await toeten(t, me);
      const tot = zust(t, me); if (!gleich(tot, soll)) fehler.push(`TOT ${JSON.stringify(tot)} != ${JSON.stringify(soll)}`);
      await beleben(t, me);
      const leb = zust(t, me); if (!gleich(leb, soll)) fehler.push(`REV ${JSON.stringify(leb)} != ${JSON.stringify(soll)}`);
      if (t.errors.length) fehler.push('ERR ' + t.errors[0]);
      R.check(`${held.split(',')[0]} + Club + Pike, Fluch ${fl || 'keiner'}: Tod + Wiederbelebung == Held ohne Artifacts`, fehler.length === 0, fehler);
    }

    // ═══ (G) Der Held eines Gegners trägt MEINE Ausrüstung (Besitzer ≠ Träger-Seite) ═══
    R.section(`Sitz ${me} · (G) fremde Seite: Gegnerheld mit meinem Club und Fluch`);
    for (const fl of [null, 'nach']) {
      const t = await U.fresh(me, { hand: [CLUB, 'Curse'] });
      await t.play(me, CLUB, { hero: 0, targetOwner: op, active: me });
      if (fl) { t.targetFn = (v) => { const h = v.find(x => x.type === 'hero' && x.owner === op && x.heroIdx === 0); return h ? [h.id] : undefined; }; await t.play(me, 'Curse', { hero: 0, targetOwner: op, active: me }); }
      t.errors.length = 0;
      const ref = await U.fresh(me, {}), soll = zust(ref, op), fehler = [];
      const vor = zust(t, op); if (fl && !vor.cursed) fehler.push('Probe: Gegnerheld nicht verflucht ' + JSON.stringify(vor));
      await t.run(() => t.engine.actionDefeatHero({ name: 'T', owner: me, heroIdx: 0 }, t.hero(op, 0), {}));
      const tot = zust(t, op); if (!gleich(tot, soll)) fehler.push(`TOT ${JSON.stringify(tot)} != ${JSON.stringify(soll)}`);
      await t.run(() => t.engine.actionReviveHero(op, 0, 100, { source: 'Test' }));
      const leb = zust(t, op); if (!gleich(leb, soll)) fehler.push(`REV ${JSON.stringify(leb)} != ${JSON.stringify(soll)}`);
      if (t.errors.length) fehler.push('ERR ' + t.errors[0]);
      R.check(`fremde Seite, Fluch ${fl || 'keiner'}: Gegnerheld mit meinem Club stirbt/lebt wieder == Held ohne Club`, fehler.length === 0, fehler);
    }

    // ═══ (H) Extra Life (Wiederbelebung IM Todesablauf, kein actionReviveHero) ═══
    R.section(`Sitz ${me} · (H) Extra Life: Tod mit sofortiger Rückkehr`);
    for (const fl of [null, 'vor', 'nach', 'status']) {
      const F = { equips: [CLUB], fluch: fl, fight: 1 };
      const t = await bau(me, F), ref = await bau(me, F, true), soll = zust(ref, me), fehler = [];
      t.hero(me, 0)._extraLife = { by: 'Trial of Coolness' };
      await toeten(t, me);
      const leb = zust(t, me);
      if (!(t.hero(me, 0).hp > 0)) fehler.push('Probe: Extra Life griff nicht, hp ' + t.hero(me, 0).hp);
      if (!gleich(leb, soll)) fehler.push(`${JSON.stringify(leb)} != ${JSON.stringify(soll)}`);
      if (t.errors.length) fehler.push('ERR ' + t.errors[0]);
      R.check(`Extra Life, Fluch ${fl || 'keiner'}: ATK == Referenz (Club weg, Fighting bleibt)`, fehler.length === 0, fehler);
    }

    // ═══ (I) Fluch heilen / neu auflegen NACH Tod und Wiederbelebung ═══
    R.section(`Sitz ${me} · (I) Fluch nach dem Tod: heilen (nichts doppelt), nach der Wiederbelebung neu auflegen und heilen`);
    for (const fl of ['vor', 'nach', 'status']) {
      const F = { equips: [CLUB], fluch: fl, fight: 1, perm: 1 };
      const t = await bau(me, F), ref = await bau(me, F, true), soll = zust(ref, me), fehler = [];
      await toeten(t, me);
      // Heilen eines nicht (mehr) vorhandenen Fluchs ändert nichts
      t.engine.cleanseHeroStatuses(t.hero(me, 0), me, 0, ['cursed'], 'Test');
      await t.run(async () => {});
      const a = zust(t, me); if (!gleich(a, soll)) fehler.push(`Heilen im Tod ${JSON.stringify(a)} != ${JSON.stringify(soll)}`);
      if (t.inst(c => c.name === 'Curse' && c.zone === 'support').length) fehler.push('Curse-Karte liegt noch');
      await beleben(t, me);
      t.engine.cleanseHeroStatuses(t.hero(me, 0), me, 0, ['cursed'], 'Test'); await t.run(async () => {});
      const b = zust(t, me); if (!gleich(b, soll)) fehler.push(`Heilen nach Wiederbelebung ${JSON.stringify(b)} != ${JSON.stringify(soll)}`);
      // neuer Fluch am lebenden Helden, danach Ausrüstung, danach Heilen
      t.addHand(me, 'Curse'); t.addHand(me, CLUB);
      await U.haenge(t, me, 'Curse', 0); await lege(t, me, CLUB, 0);
      const c = zust(t, me); if (!(c.cursed && c.atk === 0 && c.supp === soll.atk + 30)) fehler.push(`neuer Fluch+Club ${JSON.stringify(c)} (Zwischenspeicher erwartet ${soll.atk + 30})`);
      await t.run(() => t.engine.actionDestroyCard({ name: 'T', owner: op }, t.find('Curse', 'support'), {}));
      const d = zust(t, me); if (d.atk !== soll.atk + 30 || d.cursed || d.supp !== '-') fehler.push(`Fluch geheilt ${JSON.stringify(d)} (erwartet ATK ${soll.atk + 30})`);
      await t.run(() => t.engine.actionDestroyCard({ name: 'T', owner: op }, t.find(CLUB, 'support'), {}));
      const e = zust(t, me); if (!gleich(e, soll)) fehler.push(`Club zerstört ${JSON.stringify(e)} != ${JSON.stringify(soll)}`);
      if (t.errors.length) fehler.push('ERR ' + t.errors[0]);
      R.check(`Fluch (${fl}): Heilen nach Tod/Wiederbelebung ändert nichts; neuer Fluch + Club + Heilen + Club weg → Referenz`, fehler.length === 0, fehler);
    }

    // ═══ (J) Zweiter Tod mit neuer Ausrüstung und neuem Fluch ═══
    R.section(`Sitz ${me} · (J) Tod → Wiederbelebung → neue Ausrüstung + Fluch → zweiter Tod`);
    for (const fl of ['vor', 'nach']) {
      const F = { equips: [CLUB], fluch: fl, perm: 1 };
      const t = await bau(me, F), ref = await bau(me, F, true), soll = zust(ref, me), fehler = [];
      await toeten(t, me); await beleben(t, me);
      t.addHand(me, 'Curse'); t.addHand(me, SUN); t.addHand(me, CLUB);
      if (fl === 'vor') await U.haenge(t, me, 'Curse', 0);
      await lege(t, me, SUN, 0); await lege(t, me, CLUB, 0);
      if (fl === 'nach') await U.haenge(t, me, 'Curse', 0);
      const mid = zust(t, me); if (!(mid.cursed && mid.supp === soll.atk + 50)) fehler.push(`Mitte ${JSON.stringify(mid)}`);
      await toeten(t, me);
      const tot = zust(t, me); if (!gleich(tot, soll)) fehler.push(`2. TOT ${JSON.stringify(tot)} != ${JSON.stringify(soll)}`);
      await beleben(t, me);
      const leb = zust(t, me); if (!gleich(leb, soll)) fehler.push(`2. REV ${JSON.stringify(leb)} != ${JSON.stringify(soll)}`);
      if (t.errors.length) fehler.push('ERR ' + t.errors[0]);
      R.check(`zwei Tode (Fluch ${fl}): jeweils == Referenz`, fehler.length === 0, fehler);
    }

    // ═══ (K) Core/Gun auf ANDEREN Helden: beim Tod eines Helden wandern seine Karten in die Ablage — die dynamischen Boni der übrigen müssen nach der Aktion folgen ═══
    //   (Das Heldentod-Aufräumen legt direkt in die Ablage, ohne Hook; die Wächter von Core/Gun rechnen am Ende der Aktion — `onAnyActionResolved`, wie der Server es nach jeder Aktion feuert — bzw. zu Zugbeginn neu.)
    R.section(`Sitz ${me} · (K) Core/Gun an Held 1, Held 0 stirbt mit Karten → Held 1 == direkt so aufgebauter Held (nach der Aktion)`);
    for (const [dyn, mit] of [[GUN, [CLUB, SUN]], [CORE, [CLUB, SUN]], [GUN, [GUN]], [CORE, [CORE]]]) {
      const t = await U.fresh(me, { hand: [dyn, ...mit] });
      await lege(t, me, dyn, 1); for (const m of mit) await lege(t, me, m, 0);
      t.errors.length = 0;
      await toeten(t, me);
      await t.run(() => t.engine.runHooks('onAnyActionResolved', {}));   // Ende der Aktion
      const abl = t.pile(me, 'discardPile').slice();
      // direkt aufgebaut: Held 1 trägt dyn, die Ablage enthält dieselben Karten
      const ref = await U.fresh(me, { hand: [dyn], opts: { discard: [0, 1].map(s => s === me ? abl : []) } });
      await lege(ref, me, dyn, 1);
      const ist = t.hero(me, 1).atk, soll = ref.hero(me, 1).atk;
      R.check(`${dyn.split(' ').slice(-1)[0]} an Held 1, Held 0 stirbt mit ${mit.map(m => m.split(' ')[0]).join('+')} → Held 1 == direkt aufgebauter Held 1 (${soll})`, ist === soll && t.errors.length === 0, { ist, soll, ablage: abl, e: t.errors.slice(0, 2) });
    }

    // ═══ (L) Aura (Rioting Village) kommt oder geht, WÄHREND der Held tot ist — nach der Wiederbelebung gilt der Zustand eines direkt so aufgebauten Helden ═══
    R.section(`Sitz ${me} · (L) Aura kommt/geht während der Tod andauert`);
    for (const fl of [null, 'nach']) for (const modus of ['kommt', 'geht']) {
      const F = { equips: [CLUB], fluch: fl, perm: 1, aura: modus === 'geht' };
      const t = await bau(me, F), fehler = [];
      await toeten(t, me);
      const area = () => (t.gs.areaZones[me] || []);
      if (modus === 'kommt') { t.putArea(me, 'Rioting Village'); t.engine.syncAlleAtkAuren(); }
      else { const i = area().indexOf('Rioting Village'); if (i >= 0) area().splice(i, 1); else { const o2 = t.gs.areaZones[1 - me]; const k = o2.indexOf('Rioting Village'); if (k >= 0) o2.splice(k, 1); } t.engine.syncAlleAtkAuren(); }
      await beleben(t, me);
      const ref = await bau(me, { perm: 1, aura: modus === 'kommt' }, true), soll = zust(ref, me), leb = zust(t, me);
      if (!gleich(leb, soll)) fehler.push(`${JSON.stringify(leb)} != ${JSON.stringify(soll)}`);
      if (t.errors.length) fehler.push('ERR ' + t.errors[0]);
      R.check(`Aura ${modus} im Tod (Fluch ${fl || 'keiner'}): wiederbelebter Held == direkt aufgebauter Held ${modus === 'kommt' ? 'mit' : 'ohne'} Aura`, fehler.length === 0, fehler);
    }

    // ═══ (M) Cykyran: Ratgeber kommen/gehen während der Tod andauert ═══
    R.section(`Sitz ${me} · (M) Cykyran-Bedingung ändert sich während der Tod andauert`);
    for (const modus of ['geht', 'kommt']) for (const fl of [null, 'nach']) {
      const F = { equips: [CLUB], fluch: fl, cyk: modus === 'geht', fight: 1 };
      const t = await bau(me, F), fehler = [];
      await toeten(t, me);
      if (modus === 'geht') await t.run(() => t.engine.actionDestroyCard({ name: 'T', owner: 1 - me }, t.find(GOR, 'support'), {}));
      else { t.addHand(me, CYK); t.addHand(me, GOR); t.addHand(me, CEN); let sl = 0; for (const r of [CYK, GOR, CEN]) await t.play(me, r, { hero: 2, slot: sl++, active: me }); }
      await beleben(t, me);
      const ref = await bau(me, { cyk: modus === 'kommt', fight: 1 }, true), soll = zust(ref, me), leb = zust(t, me);
      if (!gleich(leb, soll)) fehler.push(`${JSON.stringify(leb)} != ${JSON.stringify(soll)}`);
      if (t.errors.length) fehler.push('ERR ' + t.errors[0]);
      R.check(`Cykyran ${modus} im Tod (Fluch ${fl || 'keiner'}): wiederbelebter Held == direkt aufgebauter Held ${modus === 'kommt' ? 'mit' : 'ohne'} Verdopplung`, fehler.length === 0, fehler);
    }

    // ═══ (N) Befristete Gabe läuft im Tod / nach der Wiederbelebung ab; Fighting wird nach der Wiederbelebung abgelegt ═══
    R.section(`Sitz ${me} · (N) Gabe läuft ab, Fighting geht — nach Tod/Wiederbelebung`);
    for (const fl of [null, 'vor', 'nach']) for (const wann of ['im Tod', 'nach Wiederbelebung']) {
      const F = { equips: [CLUB], fluch: fl, temp: 1, fight: 1 };
      const t = await bau(me, F), fehler = [];
      const ablauf = async (x) => { x.gs.turn += 5; x.gs.activePlayer = 1 - me; await x.run(() => x.engine._processBuffExpiry({})); };
      await toeten(t, me);
      if (wann === 'im Tod') await ablauf(t);
      await beleben(t, me);
      if (wann !== 'im Tod') await ablauf(t);
      const fg = t.inst(c => c.name === 'Fighting' && c.zone === 'ability' && c.owner === me);
      for (const f of fg) await t.run(() => t.engine.actionMoveCard(f, 'discard', -1, -1, { source: 'T', sourceOwner: 1 - me }));
      const ref = await bau(me, {}, true), soll = zust(ref, me), leb = zust(t, me);
      leb.fight = 0; if (!gleich(leb, soll)) fehler.push(`${JSON.stringify(leb)} != ${JSON.stringify(soll)}`);
      if (t.errors.length) fehler.push('ERR ' + t.errors[0]);
      R.check(`Gabe läuft ${wann} ab + Fighting abgelegt (Fluch ${fl || 'keiner'}): ATK == gedruckter Wert (kein Über-/Unterhang)`, fehler.length === 0, fehler);
    }

    // ═══ (O) Sicherheitsnetz Wiederbelebung: ein Besiegter mit Fluch-Zustand (künstlich gesetzt) bekommt beim Wiederbeleben seine ATK zurück ═══
    R.section(`Sitz ${me} · (O) Wiederbelebung gibt einen stehengebliebenen Fluch-Zwischenspeicher zurück`);
    { const t = await bau(me, { perm: 1 }), fehler = [];
      await toeten(t, me);
      const h = t.hero(me, 0), a0 = h.atk;
      h.statuses.cursed = { appliedTurn: 0 }; h._cursedAtkSuppressed = a0; h.atk = 0;   // künstlich: verfluchter Besiegter
      await beleben(t, me);
      const leb = zust(t, me); if (!(leb.atk === a0 && !leb.cursed && leb.supp === '-')) fehler.push(JSON.stringify({ leb, a0 }));
      if (t.errors.length) fehler.push('ERR ' + t.errors[0]);
      R.check('Besiegter mit Fluch-Zustand → Wiederbelebung: ATK wieder da, kein Zwischenspeicher, nicht verflucht', fehler.length === 0, fehler); }
  }
  R.finish();
})();
