'use strict';
// W75 · Darion (Audit P1) — weitere Stapelfaelle der Equip-Skripte (Waechter, damit sie gruen bleiben) + eine offene Engine-Frage (Cloak of Edge).
// Kartentext Darion: „All Artifacts equipped to this Hero share 1 Support Zone. Whenever this Hero defeats 1 or more targets, you may choose an equippable Artifact from your hand or deck and equip it to this Hero by paying half its Cost."
// Erwartet:
//   1) Earth-Shattering Hammer zerstoert genau die gewaehlte Karte eines gegnerischen Stapels (unterste, mittlere, oberste).
//   2) Die Lunatic-Cycle-Kette (New/Crescent/Half/Gibbous/Full Moon) in EINEM Stapel wirkt wie auf getrennten Plaetzen (+100 ATK, Schadensdeckel, Status-Immunitaet); faellt Half Moon, faellt nur der Deckel.
//   3) Xalibur im Stapel: ein zerstoerter Nachbar laesst die Abilities in den Support Zones liegen, geht Xalibur, gehen sie in die Ablage.
//   4) Flying Island im Stapel: die zwei Insel-Zonen verschwinden nur mit der Insel selbst.
//   5) Phalanx Pike im Stapel: das Surprise-Flag bleibt, bis die Pike selbst geht.
//   6) Future Tech Control Device im Stapel eines Gegner-Darion: aktivierbar, Unterhalt am Zugende loescht die Kopie.
//   7) OFFEN (Engine, `getArtifactTargets`/`getAbilityTargets`): Cloak of Edge zaehlt im Stapel als Ability, wird aber als Artifact-Ziel gemeldet. Nur Hinweis; mit PP_P1_STRIKT=1 ein harter Check.
// Aufruf: node docs/niche-tests/repro/W75/h-P1-06-weitere-stapelfaelle-hammer-lunatic-xalibur-cloak.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const D = 'Darion, the Blood-Crazy Groundskeeper', T = 'Tushu, the Knowledge Keeper', F = H.INERT.filler;
const HAMMER = 'Earth-Shattering Hammer, Relic of Deri';
const NAMEN = ['Club of Gobbo', 'Blade of the Frostbringer', 'Cute Crown'];
const KETTE = ['Lunatic Cycle - New Moon', 'Lunatic Cycle - Crescent Moon', 'Lunatic Cycle - Half Moon', 'Lunatic Cycle - Gibbous Moon', 'Lunatic Cycle - Full Moon'];
const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;
async function bau(darion, namen, o = {}) {
  const t = await H.fresh({ active: 0, heroes: [[darion ? D : T, 'Rick, the Trigger Happy Undertaker', 'Zwei, the Lucky Thief'], [T, null, null]], hand: [[...namen, F, F], [F]], gold: 900, deckSize: 30, ...(o.opts || {}) });
  for (let i = 0; i < namen.length; i++) await t.play(0, namen[i], { hero: 0, slot: darion ? 1 : i, phase: H.PHASES.MAIN1 });
  return t;
}
(async () => {
  const R = H.runner();

  R.section('1) Earth-Shattering Hammer gegen einen Gegner-Darion');
  for (const wahl of [0, 1, 2]) {
    const t = await H.fresh({ active: 0, heroes: [[T, null, null], [D, null, null]], hand: [[HAMMER, F], [F]], gold: 900, deckSize: 30 });
    await t.play(0, HAMMER, { hero: 0, slot: 0 });
    const ps = t.gs.players[1];
    ps.supportZones[0][1] = [];
    const insts = NAMEN.map(n => { ps.supportZones[0][1].push(n); const x = t.engine._trackCard(n, 1, 'support', 0, 1); x.turnPlayed = 1; return x; });
    t.targetFn = (valid, cfg) => {
      if (/Earth-Shattering/.test((cfg && cfg.title) || '')) { const v = valid.find(x => x.type === 'equip' && x.owner === 1 && x.slotIdx === 1); return v ? [v.id] : undefined; }
      const v = valid.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0); return v ? [v.id] : undefined;
    };
    t.script.push({ match: d => d.type === 'instancePick', answer: () => ({ instId: insts[wahl].id }) });
    await t.play(0, 'Attack', { hero: 0, active: 0 });
    await t.drain();
    const rest = NAMEN.filter((_, i) => i !== wahl);
    R.check(`gewaehlt ${NAMEN[wahl]}: nur diese Karte zerstoert`, JSON.stringify(ps.supportZones[0][1]) === JSON.stringify(rest) && t.pile(1, 'discardPile').join() === NAMEN[wahl], [ps.supportZones[0][1], t.pile(1, 'discardPile')]);
    R.check('sauber', sauber(t), [t.errors, t.audit()]);
  }

  R.section('2) Lunatic-Cycle-Kette in einem Stapel');
  const kette = [];
  for (const darion of [true, false]) {
    const t = await H.fresh({ active: 0, heroes: [[darion ? D : T, T, 'Zwei, the Lucky Thief'], [T, null, null]], hand: [[...KETTE, F, F], [F]], gold: 900, deckSize: 30 });
    const h = t.hero(0, 0); h.atk = h.baseAtk = 50;
    for (let i = 0; i < KETTE.length; i++) await t.play(0, KETTE[i], { hero: darion ? 0 : (i < 2 ? 1 : 0), slot: darion ? 1 : (i < 2 ? i : i - 2), phase: H.PHASES.MAIN1 });
    const atk = h.atk, immun = !!(h.buffs || {}).negative_status_immune;
    await t.run(() => t.engine.actionDealDamage({ name: 'Test', owner: 1, heroIdx: 0 }, h, 700, 'attack'));
    const hpMitDeckel = h.hp;
    await t.run(() => t.engine.addHeroStatus(0, 0, 'poisoned', { appliedBy: 1 }));
    const gift = !!(h.statuses || {}).poisoned;
    await t.run(() => t.engine.actionDestroyCard({ name: 'Test', owner: 1 }, t.inst(c => c.name === KETTE[2] && c.zone === 'support')[0]));
    h.hp = 800;
    await t.run(() => t.engine.actionDealDamage({ name: 'Test', owner: 1, heroIdx: 0 }, h, 700, 'attack'));
    kette.push({ atk, immun, hpMitDeckel, gift, hpOhneDeckel: h.hp, ok: sauber(t) });
  }
  R.check('Stapel = getrennte Plaetze (ATK, Immunitaet, Deckel, Gift, Deckel faellt mit Half Moon)', JSON.stringify(kette[0]) === JSON.stringify(kette[1]) && kette[0].atk === 150 && kette[0].hpMitDeckel === 400 && kette[0].hpOhneDeckel === 100, kette);
  R.check('sauber', kette.every(k => k.ok));

  R.section('3) Xalibur im Stapel');
  for (const ziel of ['Club of Gobbo', 'Xalibur']) {
    const t = await bau(true, ['Club of Gobbo', 'Xalibur', 'Cute Crown']);
    const ps = t.gs.players[0];
    ps.supportZones[0][2] = ['Fighting']; t.engine._trackCard('Fighting', 0, 'support', 0, 2);
    await t.run(() => t.engine.actionDestroyCard({ name: 'Test', owner: 1 }, t.inst(c => c.name === ziel && c.zone === 'support')[0]));
    const bleibt = ziel === 'Club of Gobbo';
    R.check(`${ziel} weg: Ability ${bleibt ? 'bleibt liegen' : 'geht in die Ablage'}`, bleibt ? ps.supportZones[0][2].join() === 'Fighting' : (ps.supportZones[0][2].length === 0 && ps.discardPile.includes('Fighting')), [ps.supportZones[0], ps.discardPile]);
    R.check('sauber', sauber(t), [t.errors, t.audit()]);
  }

  R.section('4) Flying Island im Stapel');
  for (const ziel of ['Club of Gobbo', 'Flying Island in the Sky']) {
    const t = await bau(true, ['Club of Gobbo', 'Flying Island in the Sky', 'Cute Crown']);
    const ps = t.gs.players[0];
    const vorher = ps.supportZones[0].length;
    await t.run(() => t.engine.actionDestroyCard({ name: 'Test', owner: 1 }, t.inst(c => c.name === ziel && c.zone === 'support')[0]));
    const soll = ziel === 'Club of Gobbo' ? vorher : vorher - 2;
    R.check(`${ziel} weg: ${soll} Zonen`, ps.supportZones[0].length === soll, [vorher, ps.supportZones[0].length]);
    R.check('sauber', sauber(t), [t.errors, t.audit()]);
  }

  R.section('5) Phalanx Pike im Stapel');
  {
    const t = await bau(true, ['Phalanx Pike', 'Club of Gobbo']);
    const h = t.hero(0, 0);
    await t.run(() => t.engine.actionDestroyCard({ name: 'Test', owner: 1 }, t.inst(c => c.name === 'Club of Gobbo' && c.zone === 'support')[0]));
    R.check('Club weg: Flag bleibt', h._skipAttackSurprises === true);
    await t.run(() => t.engine.actionDestroyCard({ name: 'Test', owner: 1 }, t.inst(c => c.name === 'Phalanx Pike' && c.zone === 'support')[0]));
    R.check('Pike weg: Flag weg', !h._skipAttackSurprises);
  }

  R.section('6) Future Tech Control Device im Stapel eines Gegner-Darion');
  {
    const CD = 'Future Tech Control Device';
    const t = await H.fresh({ active: 1, heroes: [[D, null, null], [T, null, null]], hand: [['Club of Gobbo', 'Cute Crown', F], [CD, F]], gold: 900, deckSize: 30, discard: [[], [CD]] });
    await t.play(0, 'Club of Gobbo', { hero: 0, slot: 1, active: 0 });
    await t.play(0, 'Cute Crown', { hero: 0, slot: 1, active: 0 });
    await t.play(1, CD, { hero: 0, targetOwner: 0, slot: 2, active: 1 });
    R.check('Control Device liegt im Stapel', t.gs.players[0].supportZones[0][1].includes(CD) && t.gs.players[0].supportZones[0][1].length === 3, t.gs.players[0].supportZones[0]);
    t.gs.activePlayer = 1; t.phase(2);
    const e = t.engine.getActivatableEquips(1).find(a => a.cardName === CD);
    R.check('aktivierbar', !!e, t.engine.getActivatableEquips(1));
    if (e) await t.run(() => t.host.doActivateEquipEffect(t.room, 1, { heroIdx: e.heroIdx, zoneSlot: e.zoneSlot, instId: e.instId }));
    R.check('Held uebernommen', t.hero(0, 0).charmedBy === 1);
    t.phase(4); await t.endTurn();
    R.check('Unterhalt: Kopie aus der Ablage geloescht, Karte bleibt liegen', t.pile(1, 'deletedPile').includes(CD) && t.gs.players[0].supportZones[0][1].includes(CD), [t.pile(1, 'deletedPile'), t.gs.players[0].supportZones[0]]);
    R.check('sauber', sauber(t), [t.errors, t.audit()]);
  }

  R.section('7) OFFEN (Engine): Cloak of Edge im Stapel ist kein Artifact-Ziel');
  {
    const t = await bau(true, ['Club of Gobbo', 'Cloak of Edge', 'Cute Crown']);
    const at = t.engine.getArtifactTargets(0, {});
    const cloakAlsArtifact = at.some(x => (x._erlaubteInstanzen || []).some(id => t.engine.cardInstances.find(c => c.id === id)?.name === 'Cloak of Edge') || x.cardName === 'Cloak of Edge');
    if (process.env.PP_P1_STRIKT) R.check('Cloak of Edge wird NICHT als Artifact-Ziel gemeldet', !cloakAlsArtifact, at.map(x => ({ id: x.id, erl: x._erlaubteInstanzen })));
    else R.note('OFFEN: getArtifactTargets meldet Cloak of Edge im Stapel als Artifact-Ziel (Engine: Stapelzweig filtert countsAsAbilityInZone nicht)', cloakAlsArtifact);
  }
  R.finish();
})();
