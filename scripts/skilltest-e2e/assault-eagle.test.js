'use strict';
// Assault Eagle: „You may once per turn choose up to 3 different targets on the board and deal 100 damage to them.
// Then, your opponent may choose up to the same number of targets on the board and deal 50 damage to them."
// Dazu die allgemeine Engine-Option `promptMultiTarget({ chooser })` (ein anderer Spieler waehlt).
//   node scripts/skilltest-e2e/assault-eagle.test.js
process.env.PP_ST_SIM = '1';
const fs = require('fs');
const path = require('path');
const { runGame } = require('../../skilltest/sim');
const { loadCardEffect } = require('../../cards/effects/_loader');
let fails = 0;
const check = (name, cond, info) => { if (cond) console.log('  ✓', name); else { fails++; console.log('  ✗', name, info !== undefined ? '→ ' + JSON.stringify(info).slice(0, 300) : ''); } };

const EAGLE = 'Assault Eagle';

/** Ein Spiel; das Eagle steht auf Held 0, Platz 0 des Sitzes am Zug (`A`), der andere Sitz (`B`) hat Barkeeper + Archer. */
async function fresh({ eagleSlot = 0 } = {}) {
  const oL = console.log, oE = console.error; console.log = () => {}; console.error = () => {};
  let out;
  try { out = await runGame({ seats: 2, setupOnly: true, noProfileSeats: [0, 1], seed: 11 }); }
  finally { console.log = oL; console.error = oE; }
  const { room, host, engine, gs } = out;
  const A = gs.activePlayer, B = A === 0 ? 1 : 0;
  gs.turn = 5; gs.currentPhase = 2;
  for (const c of engine.cardInstances.filter(c => c.zone === 'support' || c.zone === 'surprise')) engine._untrackCard(c.id);
  for (const p of gs.players) for (const hz of p.supportZones) for (let i = 0; i < hz.length; i++) hz[i] = [];
  // Keine Surprises im Spiel: eine gesetzte Surprise (Divine Rain …) wuerde die Zielwahl abwehren und den Test verfaelschen.
  for (const p of gs.players) for (let i = 0; i < (p.surpriseZones || []).length; i++) p.surpriseZones[i] = [];
  // Keine Handkarten: eine Reaktionskarte (Divine Gift of Rain …) wuerde die Zielwahl abwehren und den Test verfaelschen.
  for (const p of gs.players) p.hand = [];
  const stelle = (pi, name, hi, slot) => {
    gs.players[pi].supportZones[hi][slot] = [name];
    const inst = engine._trackCard(name, pi, 'support', hi, slot);
    inst.turnPlayed = 1;
    return inst;
  };
  const eagle = stelle(A, EAGLE, 0, eagleSlot);
  const barkeeper = stelle(B, 'Barkeeper', 0, 0);
  const archer = stelle(B, 'Archer', 0, 1);
  const t = { room, host, engine, gs, A, B, eagle, barkeeper, archer, stelle, prompts: [], events: [], antworten: [] };
  // Zielwahlen mitschreiben und aus `antworten` beantworten (Funktion (pi, ziele, cfg) → Liste von IDs).
  engine.promptEffectTarget = async (pi, ziele, cfg) => {
    t.prompts.push({ pi, ids: ziele.map(z => z.id), eligible: ziele.filter(z => !z.ineligible).map(z => z.id), cfg });
    const f = t.antworten.shift();
    return f ? f(pi, ziele, cfg) : [];
  };
  // Flaechenschlaege mitschreiben (Reihenfolge gegen die Animationen pruefen).
  const origAoe = engine.beginAoeStrike.bind(engine);
  engine.beginAoeStrike = (n, o) => { t.events.push({ ev: 'AOE', data: { n, amount: o.amount } }); return origAoe(n, o); };
  const origBc = engine._broadcastEvent.bind(engine);
  engine._broadcastEvent = (ev, data, ...r) => { t.events.push({ ev, data }); return origBc(ev, data, ...r); };
  return t;
}
const aktivieren = (t) => t.host.doActivateCreatureEffect(t.room, t.A, { heroIdx: 0, zoneSlot: t.eagle.zoneSlot });
const heroHp = (t, pi, hi) => t.gs.players[pi].heroes[hi].hp;
const anims = (t, typ) => t.events.filter(e => e.ev === 'play_zone_animation' && e.data.type === typ).map(e => e.data);
const aufBrett = (t, name) => t.engine.cardInstances.some(c => c.name === name && c.zone === 'support');

(async () => {
  console.log('Karte: Daten und Kunst');
  {
    const cards = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/cards.json'), 'utf8'));
    const c = cards.find(x => x.name === EAGLE);
    check('Level 0 (Als Vorgabe 10.10.), 50 HP, Creature', c && c.level === 0 && c.hp === 50 && c.cardType === 'Creature', c && [c.level, c.hp, c.cardType]);
    const idx = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/card-art/index.json'), 'utf8'));
    check('Kunst im Index und als natives 76×51-Bild abgelegt', idx[EAGLE] && idx[EAGLE].kind === 'a' && fs.existsSync(path.join(__dirname, '../../data/card-art/native', idx[EAGLE].id + '.png')));
    const atlas = JSON.parse(fs.readFileSync(path.join(__dirname, '../../public/cardgen/art.json'), 'utf8'));
    check('Kunst im Atlas (76×51)', atlas.a[EAGLE] && atlas.a[EAGLE][2] === 76 && atlas.a[EAGLE][3] === 51, atlas.a[EAGLE]);
    const s = loadCardEffect(EAGLE);
    check('aktiver Kreatureneffekt, ohne Aktionskosten', s.creatureEffect === true && !s.creatureActionCost && typeof s.onCreatureEffect === 'function');
  }

  console.log('Erste Haelfte: bis zu 3 verschiedene Ziele, 100 Schaden');
  {
    const t = await fresh();
    const hp0 = heroHp(t, t.B, 0), hp1 = heroHp(t, t.B, 1);
    t.antworten = [
      () => [`hero-${t.B}-0`, `equip-${t.B}-0-0`, `hero-${t.B}-1`],      // Kontrolleur: zwei Helden + Barkeeper
      () => [],                                                          // Gegner verzichtet
    ];
    const ok = await aktivieren(t);
    check('Aktivierung gelingt', ok === true);
    const p1 = t.prompts[0];
    check('erste Wahl: der Kontrolleur, bis zu 3 Ziele, mindestens 1, 100 Schaden', p1.pi === t.A && p1.cfg.maxTotal === 3 && p1.cfg.minRequired === 1 && p1.cfg.baseDamage === 100, [p1.pi, p1.cfg.maxTotal, p1.cfg.minRequired, p1.cfg.baseDamage]);
    check('…ALLE Seiten wahlbar: eigene und gegnerische Helden und Creatures (auch das Eagle selbst)',
      [`hero-${t.A}-0`, `hero-${t.B}-0`, `equip-${t.B}-0-0`, `equip-${t.B}-0-1`, `equip-${t.A}-0-0`].every(id => p1.ids.includes(id)), p1.ids);
    check('…die Wahl ist abbrechbar und ohne Zauber-Abbruchmarke', p1.cfg.cancellable === true && t.gs._spellCancelled !== true);
    check('100 Schaden auf jeden gewaehlten Helden', heroHp(t, t.B, 0) === hp0 - 100 && heroHp(t, t.B, 1) === hp1 - 100, [hp0, heroHp(t, t.B, 0), hp1, heroHp(t, t.B, 1)]);
    check('…und auf die gewaehlte Creature (Barkeeper faellt)', !aufBrett(t, 'Barkeeper'));
    check('…nicht gewaehlte Ziele bleiben unberuehrt (Archer steht, eigener Held ganz)', aufBrett(t, 'Archer') && heroHp(t, t.A, 0) === t.gs.players[t.A].heroes[0].maxHp);
    const g = anims(t, 'gunfire_volley');
    check('Pistolenschuesse: EINE Brett-Animation, Ursprung = Platz des Eagles, alle drei Ziele darin',
      g.length === 1 && g[0].zoneType === 'board' && g[0].originOwner === t.A && g[0].originHeroIdx === 0 && g[0].originZoneSlot === 0 && g[0].targets.length === 3, g);
    check('…Ziele als {owner, heroIdx, zoneSlot}: Helden mit -1, die Creature mit ihrem Platz',
      g[0].targets.some(x => x.owner === t.B && x.heroIdx === 0 && x.zoneSlot === -1) && g[0].targets.some(x => x.owner === t.B && x.heroIdx === 0 && x.zoneSlot === 0), g[0].targets);
    const aoe = t.events.filter(e => e.ev === 'AOE').map(e => e.data);
    check('EIN Flaechenschlag fuer die drei Ziele: 100 Schaden', aoe.length === 1 && aoe[0].n === 3 && aoe[0].amount === 100, aoe);
    check('die Schuesse kommen VOR dem Schaden', t.events.findIndex(e => e.data && e.data.type === 'gunfire_volley') < t.events.findIndex(e => e.ev === 'AOE'));
    check('zweite Wahl: der GEGNER, bis zu 3, 50 Schaden', t.prompts[1] && t.prompts[1].pi === t.B && t.prompts[1].cfg.maxTotal === 3 && t.prompts[1].cfg.baseDamage === 50, t.prompts[1] && [t.prompts[1].pi, t.prompts[1].cfg.maxTotal, t.prompts[1].cfg.baseDamage]);
    check('…„may": abbrechbar, ohne Zauber-Abbruchmarke', t.prompts[1].cfg.cancellable === true && t.gs._spellCancelled !== true);
    check('Gegner verzichtet: keine Welle', anims(t, 'shockwave_volley').length === 0);
    // einmal pro Zug
    t.antworten = [() => [`hero-${t.B}-0`], () => []];
    check('einmal pro Zug: die zweite Aktivierung wird abgelehnt', (await aktivieren(t)) === false && heroHp(t, t.B, 0) === hp0 - 100);
  }

  console.log('Zweite Haelfte: der Gegner waehlt bis zu so viele Ziele — auch das Eagle selbst');
  {
    const t = await fresh();
    const ownHp = heroHp(t, t.A, 0), bHp = heroHp(t, t.B, 0);
    t.antworten = [
      () => [`hero-${t.B}-0`, `equip-${t.B}-0-1`],                       // 2 Ziele: Held + Archer
      (pi, z) => [`equip-${t.A}-0-0`, `hero-${t.A}-0`],                  // Gegner schiesst auf Eagle + Held des Kontrolleurs
    ];
    await aktivieren(t);
    const p2 = t.prompts[1];
    check('der Gegner darf so viele Ziele waehlen, wie der Kontrolleur gewaehlt hat (2)', p2.pi === t.B && p2.cfg.maxTotal === 2, [p2.pi, p2.cfg.maxTotal]);
    check('…ausdruecklich das Assault Eagle selbst ist waehlbar', p2.ids.includes(`equip-${t.A}-0-0`) && p2.eligible.includes(`equip-${t.A}-0-0`), p2.ids);
    check('…50 Schaden: das Eagle (50 HP) faellt, der gewaehlte Held verliert 50', !aufBrett(t, EAGLE) && heroHp(t, t.A, 0) === ownHp - 50, [aufBrett(t, EAGLE), ownHp, heroHp(t, t.A, 0)]);
    check('…die erste Haelfte traf wie gewaehlt (Held −100, Archer faellt)', heroHp(t, t.B, 0) === bHp - 100 && !aufBrett(t, 'Archer'));
    const w = anims(t, 'shockwave_volley');
    check('Welle: EINE Brett-Animation mit BEIDEN Zielen, Ursprung = Platz des Eagles (auch wenn es selbst Ziel ist)',
      w.length === 1 && w[0].zoneType === 'board' && w[0].originOwner === t.A && w[0].originZoneSlot === 0 && w[0].targets.length === 2
        && w[0].targets.some(x => x.owner === t.A && x.heroIdx === 0 && x.zoneSlot === 0), w);
    const ix = (f) => t.events.findIndex(f);
    const i1 = ix(e => e.data && e.data.type === 'gunfire_volley'), a1 = ix(e => e.ev === 'AOE' && e.data.amount === 100);
    const i2 = ix(e => e.data && e.data.type === 'shockwave_volley'), a2 = ix(e => e.ev === 'AOE' && e.data.amount === 50);
    check('Reihenfolge: Schuesse → 100 Schaden → Welle → 50 Schaden', i1 >= 0 && i1 < a1 && a1 < i2 && i2 < a2, [i1, a1, i2, a2]);
    check('…die Welle trifft 2 Ziele in EINEM Flaechenschlag', t.events.find(e => e.ev === 'AOE' && e.data.amount === 50).data.n === 2);
  }

  console.log('Sonderfaelle');
  {
    // Das Eagle waehlt sich selbst — „Then" laeuft trotzdem, die Schuesse beginnen an seinem Platz.
    const t = await fresh({ eagleSlot: 2 });
    t.antworten = [
      () => [`equip-${t.A}-0-2`],                                        // Selbstbeschuss: 100 Schaden, es faellt
      (pi, z) => [`hero-${t.A}-0`],                                      // der Gegner antwortet trotzdem
    ];
    const ownHp = heroHp(t, t.A, 0);
    await aktivieren(t);
    check('das Eagle darf sich selbst waehlen und faellt', !aufBrett(t, EAGLE));
    check('„Then": die zweite Haelfte laeuft trotzdem — der Gegner hat gewaehlt', t.prompts.length === 2 && heroHp(t, t.A, 0) === ownHp - 50, [t.prompts.length, ownHp, heroHp(t, t.A, 0)]);
    const w = anims(t, 'shockwave_volley');
    check('…und die Welle beginnt am Platz des gefallenen Eagles (Platz 3)', w.length === 1 && w[0].originZoneSlot === 2, w);
  }
  {
    // Abbruch vor der ersten Wahl kostet nichts.
    const t = await fresh();
    t.antworten = [() => []];
    const ok = await aktivieren(t);
    check('Abbruch der ersten Wahl: nichts geschieht, keine Animation, keine Gegnerwahl', t.prompts.length === 1 && anims(t, 'gunfire_volley').length === 0 && heroHp(t, t.B, 0) === t.gs.players[t.B].heroes[0].maxHp);
    t.antworten = [() => [`hero-${t.B}-0`], () => []];
    const nochmal = await aktivieren(t);
    check('…und die Sperre ist NICHT verbraucht (er darf es in diesem Zug noch einmal)', nochmal === true && heroHp(t, t.B, 0) === t.gs.players[t.B].heroes[0].maxHp - 100, [ok, nochmal]);
  }
  {
    // Ein einziges Ziel: der Gegner darf hoechstens 1 waehlen.
    const t = await fresh();
    t.antworten = [() => [`hero-${t.B}-1`], () => []];
    await aktivieren(t);
    check('ein einziges Ziel: der Gegner darf hoechstens 1 waehlen', t.prompts[1].cfg.maxTotal === 1, t.prompts[1].cfg.maxTotal);
  }
  {
    // Zielschutz gilt aus der Sicht des WAEHLENDEN (`chooser`): eine Creature des Kontrolleurs, die „der Gegner nicht waehlen
    // kann", ist fuer ihn selbst waehlbar, fuer den Gegner in der zweiten Haelfte nicht.
    const t = await fresh();
    const geschuetzt = t.stelle(t.A, 'Baby Spider', 1, 0);
    geschuetzt.counters.untargetable_by_opponent = true;
    geschuetzt.counters.untargetable_by_opponent_pi = t.B;
    t.antworten = [() => [`hero-${t.B}-0`], () => []];
    await aktivieren(t);
    const id = `equip-${t.A}-1-0`;
    check('der Kontrolleur (Wahl 1) sieht seine eigene geschuetzte Creature', t.prompts[0].ids.includes(id), t.prompts[0].ids);
    check('der Gegner (Wahl 2) kann sie NICHT waehlen — Zielschutz aus SEINER Sicht (chooser)', !t.prompts[1].ids.includes(id), t.prompts[1].ids);
  }

  console.log(fails === 0 ? '\n✓ Assault-Eagle-Tests grün' : `\n✗ ${fails} Fehler`);
  process.exit(fails === 0 ? 0 : 1);
})();
