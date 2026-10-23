'use strict';
// W66a-04 · Der EFFEKT-Schutz des Ziels gilt für JEDE Form von „defeat" (Al, 23.10.2026): „der Resistance-Schutz sollte JEDE Form von defeat abdecken, auch Hand of Death, Lunatic Golem usw."
//
// Karten (Kartentext „… defeat it"): Hand of Death (Zug-Ende-Effekt, echter Zugwechsel), Lunatic Golem (Stufe 5: „Any target chosen by this Creature is immediately defeated"),
//   Kohta, Master of Super-Killing („choose any target on the board and defeat it", zählt als Attack), Decapitating Strike („Defeat that target", Reaktion), Midnight Assault („ignores any effect that would …
//   prevent the target from being defeated"), Eraser Beam (Referenz: läuft als Schaden durch die Schadens-Pipeline — Schadens-Schutz UND Effekt-Schutz halten ihn ab).
// Regel: ein Kill-Effekt ohne Schaden (HoD, Golem, Kohta, Decapitating Strike, Midnight Assault) ignoriert SCHADENS-Schutz (Schadensimmunität, Immortal, damage_proof, Egg of God …),
//   aber EFFEKT-Schutz greift: Resistance (Lv1/Lv3), Erstrunden-Schutz, Zielschutz, Submerged, Charmed, Anti Magic (Buff nur gegen Spells) / Anti Magic Enchantment (nur Spells), Versteinerung,
//   Kreatur: Cardinal Beast, Time Bomblebee. Midnight Assault („unaufhaltsam") umgeht alles außer Erstrunden-Schutz und Resistance (Ruling W14). Eraser Beam: wie ein Schadens-Spell + Resistance.
// Zwei Ebenen: (1) der Kartenweg je Karte (Welle: Held/Kreatur × Schutz × beide Sitze), (2) der Baustein `engine.actionDefeat(…, { wirkungsSchutz })` direkt (Submerged-Held darf an HoD nicht sterben).
// Exit 0 = korrekt.
const H = require('../../lib/h.js');
const KM = 'Kohta, Master of Super-Killing', HOD = 'Hand of Death', LG = 'Lunatic Golem', DS = 'Decapitating Strike', MA = 'Midnight Assault', EB = 'Eraser Beam';
const CYCLES = ['Lunatic Cycle - New Moon', 'Lunatic Cycle - Crescent Moon', 'Lunatic Cycle - Half Moon', 'Lunatic Cycle - Gibbous Moon', 'Lunatic Cycle - Full Moon'];
const KARTEN = [HOD, LG, KM, DS, MA, EB];

// ── Schutz-Zustände (Ziel = Gegner-Held 0 bzw. Kreatur (opp,0,0)) ──
const SCHUTZ_HELD = {
  'kein Schutz (Kontrolle)':        { prep: () => {}, tot: [1, 1, 1, 1, 1, 1] },
  'Resistance Lv1':                 { prep: (t, o) => t.setAbilities(o, 0, [['Resistance'], [], []]), tot: [0, 0, 0, 0, 0, 0] },
  'Resistance Lv3':                 { prep: (t, o) => t.setAbilities(o, 0, [['Resistance', 'Resistance', 'Resistance'], [], []]), tot: [0, 0, 0, 0, 0, 0] },
  'Erstrunden-Schutz':              { prep: (t, o) => { t.gs.firstTurnProtectedPlayer = o; }, tot: [0, 0, 0, 0, 0, 0] },
  'Submerged':                      { prep: (t, o) => { t.hero(o, 0).buffs = { submerged: { turns: 9 } }; }, tot: [0, 0, 0, 0, 1, 0] },
  'Charme Lv3 (charmed)':           { prep: (t, o) => { t.hero(o, 0).statuses.charmed = { controller: 1 - o, appliedTurn: 0 }; }, tot: [0, 0, 0, 0, 1, 0] },
  'Versteinert (stunned+_petrified)': { prep: (t, o) => { t.hero(o, 0).statuses.stunned = { _petrified: true, appliedTurn: 0, duration: 9 }; }, tot: [0, 0, 0, 0, 1, 0] },
  'Anti Magic Lv3 (Buff)':          { prep: (t, o) => { t.hero(o, 0).buffs = { magic_immune: { level: 3 } }; }, tot: [0, 1, 1, 1, 1, 0] },   // nur gegen Spells (HoD, Eraser Beam)
  'Anti Magic Enchantment (bewaffnet)': { prep: (t, o) => { t.put(o, 0, 2, H.INERT.artifact, { counters: { antiMagicEnchanted: { charges: 1 } } }); }, tot: [0, 1, 1, 1, 1, 0] },   // nur gegen Spells
  // SCHADENS-Schutz: ein Kill-Effekt ist kein Schaden → der Held stirbt; Eraser Beam läuft als Schaden → der Schutz hält ihn ab
  'Schadensimmunität (damage_proof)': { prep: (t, o) => t.heroStatus(o, 0, 'damage_proof'), tot: [1, 1, 1, 1, 1, 0] },
  'Immortal (HP-Boden)':            { prep: (t, o) => { t.hero(o, 0).buffs = { immortal: { turns: 9 } }; }, tot: [1, 1, 1, 1, 1, 0] },
};
const SCHUTZ_KREATUR = {
  'kein Schutz (Kontrolle)':        { prep: () => {}, ctr: {}, tot: [1, 1, 1, 1, 1, 1] },
  'Erstrunden-Schutz':              { prep: (t, o) => { t.gs.firstTurnProtectedPlayer = o; }, ctr: {}, tot: [0, 0, 0, 0, 0, 0] },
  'Cardinal-Beast-Immunität':       { prep: () => {}, ctr: { _cardinalImmune: 1 }, tot: [0, 0, 0, 0, 1, 0] },
  'Time Bomblebee (_damageDestroyImmune)': { prep: () => {}, ctr: { _damageDestroyImmune: 1 }, tot: [0, 0, 0, 0, 1, 0] },
  'Resilient Monkee (Schadensschild)': { prep: () => {}, ctr: { _monkeeShieldUntilTurn: 99 }, big: true, tot: [1, 1, 1, 1, 1, 0] },
};

// ── Szene + Auslöser je Karte ──
async function lauf(karte, seat, schutz, art) {
  const opp = 1 - seat;
  const me = [karte === KM ? KM : H.BLANK_HEROES[0], H.BLANK_HEROES[1], H.BLANK_HEROES[2]];
  const gegner = [H.BLANK_HEROES_B[0], H.BLANK_HEROES_B[1], H.BLANK_HEROES_B[2]];
  const heroes = seat === 0 ? [me, gegner] : [gegner, me];
  const hand = [[], []];
  if (karte === MA || karte === EB) hand[seat] = [karte, H.INERT.filler];
  const t = await H.fresh({ heroes, hand, turn: 5, active: seat, deckSize: 20 });
  const ziel = art === 'kreatur' ? t.put(opp, 0, 0, schutz.big ? H.INERT.big : H.INERT.creature, { counters: schutz.ctr }) : null;
  if (art === 'held') t.put(opp, 0, 0, H.INERT.creature);   // Held-Fälle: irgendeine Kreatur (Auswahl-Alternative)
  t.put(opp, 1, 1, H.INERT.creature);                         // weiteres mögliches Ziel (Submerged: „solange es andere Ziele gibt")
  schutz.prep(t, opp);
  const h0 = t.hero(opp, 0);
  if (karte === MA && art === 'held') h0.hp = 100;           // „Hero with 150 or less HP"
  const wahl = (v) => {
    const x = art === 'kreatur' ? v.find(q => q.owner === opp && q.type === 'equip' && q.heroIdx === 0 && q.slotIdx === 0) : v.find(q => q.type === 'hero' && q.owner === opp && q.heroIdx === 0);
    return x ? [x.id] : undefined;
  };
  t.targetFn = wahl;
  let r;
  if (karte === HOD) {
    t.gs.players[seat]._handOfDeathArmed = { armedOnTurn: 4, casterHeroIdx: 0, casterHeroOwner: seat };
    t.gs.activePlayer = opp; t.gs.currentPhase = H.PHASES.MAIN2;
    r = await t.endTurn();                                    // echter Zugwechsel: Ende des gegnerischen Zuges
  } else if (karte === LG) {
    CYCLES.forEach((n, i) => t.put(seat, 1, i, n));
    t.put(seat, 0, 0, LG).turnPlayed = 1;
    t.gs.activePlayer = seat; t.phase(2);
    r = await t.activateCreature(seat, 0, 0);
  } else if (karte === KM) {
    r = await t.activateHero(seat, 0, { effect: KM, phase: 3 });
  } else if (karte === DS) {
    const sk = H.loadCardEffect(DS);
    const quelle = { name: 'ZZ', owner: seat, controller: seat, heroIdx: 0 };
    if (art === 'held') { h0.hp = 40; r = await t.run(() => sk.afterDamageResolve(t.engine, seat, h0, 0, quelle, 60, 'destruction_spell')); }
    else { ziel.counters.currentHp = 40; r = await t.run(() => sk.afterCreatureDamageResolve(t.engine, seat, ziel, quelle, 60, 'destruction_spell')); }
  } else if (karte === MA || karte === EB) {
    r = await t.play(seat, karte, { hero: 2 });
  }
  const inst = art === 'kreatur' ? t.inst(c => c.id === ziel.id && c.zone === 'support')[0] : null;
  const tot = art === 'kreatur' ? !inst : h0.hp <= 0;
  return { t, tot, r };
}

(async () => {
  const R = H.runner();
  for (const seat of [0, 1]) {
    R.section(`── Sitz ${seat} · Held-Ziel ──`);
    for (const [name, s] of Object.entries(SCHUTZ_HELD)) {
      for (let i = 0; i < KARTEN.length; i++) {
        const karte = KARTEN[i];
        const x = await lauf(karte, seat, s, 'held');
        const soll = !!s.tot[i];
        R.check(`[S${seat}] ${karte} · Held · ${name}: ${soll ? 'wird besiegt' : 'überlebt'}`, x.tot === soll && x.t.errors.length === 0, { tot: x.tot, hp: x.t.hp(1 - seat, 0), r: x.r, err: x.t.errors });
      }
    }
    R.section(`── Sitz ${seat} · Kreatur-Ziel ──`);
    for (const [name, s] of Object.entries(SCHUTZ_KREATUR)) {
      for (let i = 0; i < KARTEN.length; i++) {
        const karte = KARTEN[i];
        const x = await lauf(karte, seat, s, 'kreatur');
        const soll = !!s.tot[i];
        R.check(`[S${seat}] ${karte} · Kreatur · ${name}: ${soll ? 'wird besiegt' : 'überlebt'}`, x.tot === soll && x.t.errors.length === 0, { tot: x.tot, r: x.r, err: x.t.errors });
      }
    }
  }

  // ── Ebene 2: der Baustein direkt (Submerged-Held darf nicht an „defeat" sterben; Selbstopfer umgeht alles) ──
  R.section('── Baustein engine.actionDefeat ──');
  for (const seat of [0, 1]) {
    const opp = 1 - seat;
    for (const [name, s] of Object.entries(SCHUTZ_HELD)) {
      if (/Anti Magic/.test(name)) continue;   // typabhängig (Spell-Quelle nötig) — im Kartenweg oben geprüft
      const t = await H.fresh({ turn: 5, active: seat });
      t.put(opp, 1, 1, H.INERT.creature);
      s.prep(t, opp);
      const quelle = { name: 'Hand of Death', owner: seat, controller: seat, heroIdx: 0, heroOwner: seat };
      const mit = await t.run(() => t.engine.actionDefeat(quelle, t.hero(opp, 0), { sourceOwner: seat, damageType: 'destruction_spell', wirkungsSchutz: true }));
      const wirkungsschutzTot = t.hero(opp, 0).hp <= 0;
      // Effekt-Schutz (alles außer Schadens-Schutz) hält; Schadens-Schutz gilt nicht
      const sollTot = !!s.tot[0];
      R.check(`[S${seat}] actionDefeat(wirkungsSchutz) · ${name}: ${sollTot ? 'Held stirbt' : 'Held überlebt'}`, wirkungsschutzTot === sollTot && t.errors.length === 0, { hp: t.hero(opp, 0).hp, mit });
    }
    // Opfer/Eigenfolge bleiben ungeschützt: Selbstopfer eines Submerged-/Resistance-Helden gelingt
    const t = await H.fresh({ turn: 5, active: seat });
    t.setAbilities(seat, 0, [['Resistance', 'Resistance', 'Resistance'], [], []]);
    t.hero(seat, 0).buffs = { submerged: { turns: 9 } };
    await t.run(() => t.engine.actionDefeat({ name: 'Divine Gift of Sacrifice', owner: seat }, t.hero(seat, 0), { reason: 'Divine Gift of Sacrifice', isSacrifice: true, respectFirstTurnProtection: false, wirkungsSchutz: true, damageType: 'other' }));
    R.check(`[S${seat}] freiwilliges Selbstopfer umgeht jeden Schutz (Resistance Lv3 + Submerged)`, t.hero(seat, 0).hp <= 0, t.hp(seat, 0));
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
