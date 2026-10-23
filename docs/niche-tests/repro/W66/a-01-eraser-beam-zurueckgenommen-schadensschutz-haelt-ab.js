'use strict';
// W66a-01 · ZURÜCKNAHME der W64a-Auslegung „defeat umgeht Schadensimmunität" für Eraser Beam
//
// Hintergrund: Al meldete in W63 „der lingering Effect feuert nie, wenn Inya den Spell als Creature-Token macht" und nannte dabei irrtümlich ERASER BEAM; gemeint war HAND OF DEATH (Al, 23.10.2026:
//   „Bitte nimm alles zurück, was ich fälschlicherweise zu Eraser Beam angemerkt habe"). W64a hatte daraufhin Eraser Beams Kill von 999999 Schaden auf `engine.actionDefeat` umgestellt (Schadens-Schutz
//   griff nicht mehr). Jetzt wieder: Eraser Beam läuft als 999999 `destruction_spell`-Schaden durch die Schadens-/Zerstörungs-Pipelines — ALLE Schutzschichten greifen (Inyas „takes no damage", Immortal,
//   Storm Piano, Carris, Egg of God, Resilient Monkee, Erstrunden-Schutz, Zielschutz, Anti Magic, Charmed/Submerged/Petrified …). Zeitpunkt des Kills: SOFORT (Kartentext „Choose a target … and defeat it").
//   Neu seit W66a (Al: Resistance gilt gegen JEDE Form von defeat): Resistance (Lv1: erste Karte des Zuges, Lv3: alles außer Schaden) fängt das Helden-„defeat" ab.
// Szene (je Sitz): Wirker Held 2 (frei für die Pollution-Kosten); Gegner: Held 0 = Ziel; Inya-Fälle mit echtem Fantasy Buddy Token (Zähler `_fantasyBuddyToken`).
// Exit 0 = korrekt.
const H = require('../../lib/h.js');
const EB = 'Eraser Beam', IN = 'Card Game Player Inya';
const buddyOverride = { ...H.DB['Fireball'], name: 'Fantasy Buddy Token', cardType: 'Creature/Token', subtype: 'Token', hp: 10 };

async function lauf(seat, o = {}) {
  const opp = 1 - seat;
  const eigene = [H.BLANK_HEROES[0], H.BLANK_HEROES[1], H.BLANK_HEROES[2]];
  const gegner = [o.held || H.BLANK_HEROES_B[0], H.BLANK_HEROES_B[1], H.BLANK_HEROES_B[2]];
  const heroes = seat === 0 ? [eigene, gegner] : [gegner, eigene];
  const hand = [[], []]; hand[seat] = [EB, H.INERT.filler];
  const t = await H.fresh({ heroes, hand, turn: 5, active: seat });
  t.put(opp, 2, 0, H.INERT.creature);
  let buddy = null;
  if (o.buddy) buddy = t.put(opp, 0, 1, 'Fireball', { counters: { _fantasyBuddyToken: true, currentHp: 10, maxHp: 10, _cardDataOverride: buddyOverride } });
  if (o.prep) o.prep(t, opp);
  t.targetFn = (v) => {
    const x = o.ziel === 'buddy' ? v.find(q => q.owner === opp && q.type === 'equip' && q.slotIdx === 1 && q.heroIdx === 0)
      : v.find(q => q.type === 'hero' && q.owner === opp && q.heroIdx === 0);
    return x ? [x.id] : undefined;
  };
  const r = await t.play(seat, EB, { hero: 2 });
  return { t, r, opp, buddy, h0: t.hero(opp, 0) };
}

(async () => {
  const R = H.runner();
  for (const seat of [0, 1]) {
    R.section(`── Sitz ${seat} ──`);
    // Kontrolle: ohne Schutz stirbt der Held SOFORT (im selben Spielzug, nicht verzögert)
    {
      const x = await lauf(seat);
      R.check(`[S${seat}] Kontrolle: Eraser Beam besiegt den ungeschützten Helden sofort (noch im Spielzug des Wirkers)`, x.r === true && x.h0.hp <= 0 && x.t.gs.activePlayer === seat && x.t.gs.turn === 5, { r: x.r, hp: x.h0.hp });
      R.check(`[S${seat}] Kontrolle: Stempel/Sperre gesetzt (Einmal pro Spiel, nur-Spell dieses Zuges)`, x.t.gs.players[seat]._oncePerGameUsed.has('eraserBeam') && x.t.gs.players[seat]._spellLockTurn === 5, { }) ;
    }
    // Inya: lebender Fantasy Buddy → „takes no damage" hält Eraser Beam ab (Held überlebt, Karte verbraucht)
    {
      const x = await lauf(seat, { held: IN, buddy: true });
      R.check(`[S${seat}] Inya + lebender Fantasy Buddy: Eraser Beam wird vom „takes no damage"-Schild abgehalten, Inya überlebt`, x.r === true && x.h0.hp > 0 && x.t.gs.players[seat]._oncePerGameUsed.has('eraserBeam'), { r: x.r, hp: x.h0.hp });
      R.check(`[S${seat}] Inya + lebender Fantasy Buddy: der Buddy lebt weiter, keine Engine-Fehler`, x.t.inst(c => c.id === x.buddy.id && c.zone === 'support').length === 1 && x.t.errors.length === 0 && x.t.audit().length === 0, { e: x.t.errors, a: x.t.audit() });
    }
    // Inya ohne Buddy (oder Buddy schon tot) → der Schild fehlt, Inya stirbt
    {
      const x = await lauf(seat, { held: IN });
      R.check(`[S${seat}] Inya ohne Fantasy Buddy: Eraser Beam besiegt Inya`, x.r === true && x.h0.hp <= 0, { r: x.r, hp: x.h0.hp });
    }
    // Der Buddy selbst als Ziel (Kreatur): stirbt, seine Karte geht in die Ablage seines Besitzers (W64a-Regel bleibt)
    {
      const x = await lauf(seat, { held: IN, buddy: true, ziel: 'buddy' });
      R.check(`[S${seat}] Eraser Beam auf den Fantasy Buddy (Kreatur): der Token stirbt, Inya bleibt unberührt`, x.r === true && x.t.inst(c => c.id === x.buddy.id && c.zone === 'support').length === 0 && x.h0.hp > 0, { r: x.r, hp: x.h0.hp });
    }
    // Weitere Schadens-Schutzschichten halten ihn ab
    const SCHADEN = {
      'Immortal (HP-Boden)': (t, o) => { t.hero(o, 0).buffs = { immortal: { turns: 9 } }; },
      'Storm-Piano-Status damage_proof': (t, o) => t.heroStatus(o, 0, 'damage_proof'),
      'Schadens-Multiplikator 0': (t, o) => { t.hero(o, 0).buffs = { cloudy_test: { damageMultiplier: 0 } }; },
    };
    for (const [name, prep] of Object.entries(SCHADEN)) {
      const x = await lauf(seat, { prep });
      R.check(`[S${seat}] ${name}: Eraser Beam gespielt, Held überlebt (Schaden wird abgehalten)`, x.r === true && x.h0.hp > 0 && x.t.gs.players[seat]._oncePerGameUsed.has('eraserBeam'), { r: x.r, hp: x.h0.hp });
    }
    const EFFEKT = {
      'Erstrunden-Schutz': (t, o) => { t.gs.firstTurnProtectedPlayer = o; },
      'Anti Magic (Buff Lv3)': (t, o) => { t.hero(o, 0).buffs = { magic_immune: { level: 3 } }; },
      'Submerged': (t, o) => { t.hero(o, 0).buffs = { submerged: { turns: 9 } }; },
      'Charme Lv3': (t, o) => { t.hero(o, 0).statuses.charmed = { controller: 1 - o, appliedTurn: 0 }; },
      'Versteinert': (t, o) => { t.hero(o, 0).statuses.stunned = { _petrified: true, appliedTurn: 0, duration: 9 }; },
      'Resistance Lv1 (W66a: defeat ist ein Nicht-Schaden-Effekt)': (t, o) => t.setAbilities(o, 0, [['Resistance'], [], []]),
      'Resistance Lv3 (W66a)': (t, o) => t.setAbilities(o, 0, [['Resistance', 'Resistance', 'Resistance'], [], []]),
    };
    for (const [name, prep] of Object.entries(EFFEKT)) {
      const x = await lauf(seat, { prep });
      R.check(`[S${seat}] ${name}: der Held überlebt, Eraser Beam ist verbraucht`, x.r === true && x.h0.hp > 0 && x.t.gs.players[seat]._oncePerGameUsed.has('eraserBeam'), { r: x.r, hp: x.h0.hp });
    }
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
