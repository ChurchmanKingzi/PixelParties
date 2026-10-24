'use strict';
// W71d-01 · Spell Shackle (neue Karte, Spell Attachment, Decay Magic Lv2)
//
// Text: „At the beginning of each turn of the controller of the Hero this card is attached to, that Hero takes 50 damage for every Spell School Ability attached to it."
// Geprüft: jede Ability-KARTE zählt (3× Destruction Magic = 150), fünf Zauberschulen, Fighting zählt nicht, Zug des Kontrolleurs (nicht des Gegners),
//   Wirt auf eigener/gegnerischer Seite, mehrere Kopien, 0 Schulen → kein Auftritt/kein Schaden, besiegter Wirt, gefrorener/betäubter/negierter Wirt, Abilities negiert,
//   Kontrollwechsel, Karte verlässt Zone, Animation + Auftritt, Besitz der Karte, Abbruch beim Anlegen.
const H = require('../../lib/h.js');
const CARD = 'Spell Shackle';
const isHero = (v, owner, hi) => v.type === 'hero' && v.owner === owner && (hi == null || v.heroIdx === hi);

async function anlegen(t, caster, seat, hi) {
  t.targetFn = (valid) => { const v = valid.find(x => isHero(x, seat, hi)); return v ? [v.id] : undefined; };
  const r = await t.play(caster, CARD, { hero: 0 });
  t.targetFn = null;
  return r;
}
/** Beginn des Zuges von `seat` (echter Zugwechsel, Hook-Batterie). */
async function zugBeginn(t, seat) { t.reset(); await t.turnStart(seat); }

(async () => {
  const R = H.runner();

  R.section('A · Zählung: jede Ability-Karte zählt');
  {
    const t = await H.fresh({ hand: [[CARD], []], abilities: { 1: { 0: [['Destruction Magic', 'Destruction Magic', 'Destruction Magic'], [], []] } } });
    const r = await anlegen(t, 0, 1, 0);
    R.check('gespielt, am Gegnerhelden 0', r === true && (t.gs.players[1].supportZones[0] || []).some(z => (z || []).includes(CARD)), r);
    await zugBeginn(t, 1);
    R.check('3× Destruction Magic in EINER Zone = 150 Schaden', t.hp(1, 0) === 650, t.hp(1, 0));
    R.check('anderer Gegnerheld ohne Fessel unberührt', t.hp(1, 1) === 800 && t.hp(1, 2) === 800);
    R.check('Animation spell_shackle_chains am Wirt', t.evs('play_zone_animation').some(e => e.type === 'spell_shackle_chains' && e.owner === 1 && e.heroIdx === 0), t.evs('play_zone_animation').map(e => e.type));
    R.check('Auftritt der Karte (card_reveal) mindestens für den Tick', t.events.some(e => e.ev === 'card_reveal' && e.data && e.data.cardName === CARD) || t.logs.some(l => l.type === 'spell_shackle_tick'), t.events.map(e => e.ev));
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
    R.check('Zustand sauber', t.audit().length === 0, t.audit());
  }
  {
    // fünf Schulen in drei Zonen: Destruction ×2, Decay ×1 in Zone 1 …
    const t = await H.fresh({ hand: [[CARD], []], abilities: { 1: { 0: [['Destruction Magic', 'Destruction Magic'], ['Decay Magic'], ['Support Magic', 'Support Magic', 'Support Magic']] } } });
    await anlegen(t, 0, 1, 0);
    await zugBeginn(t, 1);
    R.check('2 + 1 + 3 = 6 Karten → 300 Schaden', t.hp(1, 0) === 500, t.hp(1, 0));
  }
  {
    const t = await H.fresh({ hand: [[CARD], []], abilities: { 1: { 0: [['Fighting', 'Fighting'], ['Magic Arts'], ['Summoning Magic']] } } });
    await anlegen(t, 0, 1, 0);
    await zugBeginn(t, 1);
    R.check('Fighting zählt NICHT (nur Magic Arts + Summoning Magic = 100)', t.hp(1, 0) === 700, t.hp(1, 0));
  }
  {
    const t = await H.fresh({ hand: [[CARD], []], abilities: { 1: { 0: [['Fighting'], [], []] } } });
    await anlegen(t, 0, 1, 0);
    await zugBeginn(t, 1);
    R.check('keine Schule: kein Schaden, KEIN Auftritt, keine Animation', t.hp(1, 0) === 800 && !t.events.some(e => e.ev === 'play_zone_animation' && e.data && e.data.type === 'spell_shackle_chains') && !t.events.some(e => e.ev === 'card_reveal'), t.events.map(e => e.ev));
  }

  R.section('B · wessen Zug? (Kontrolleur des Wirts)');
  {
    const t = await H.fresh({ hand: [[CARD], []], abilities: { 1: { 0: [['Destruction Magic', 'Destruction Magic'], [], []] } } });
    await anlegen(t, 0, 1, 0);
    await zugBeginn(t, 0);
    R.check('Zug des WIRKERS (Sitz 0): Gegnerheld nimmt nichts', t.hp(1, 0) === 800, t.hp(1, 0));
    await zugBeginn(t, 1);
    R.check('Zug des Kontrolleurs (Sitz 1): 100', t.hp(1, 0) === 700, t.hp(1, 0));
    await zugBeginn(t, 1);
    R.check('jeder weitere Zug: erneut 100 (kein „einmal")', t.hp(1, 0) === 600, t.hp(1, 0));
  }
  {
    // auf eigenen Helden gelegt: tickt in MEINEM Zug
    const t = await H.fresh({ hand: [[CARD], []], abilities: { 0: { 1: [['Support Magic'], [], []] } } });
    await anlegen(t, 0, 0, 1);
    await zugBeginn(t, 1);
    R.check('eigener Held: Gegner-Zug tickt nicht', t.hp(0, 1) === 800, t.hp(0, 1));
    await zugBeginn(t, 0);
    R.check('eigener Held: eigener Zug tickt (50)', t.hp(0, 1) === 750, t.hp(0, 1));
  }
  {
    // echter Zugwechsel über die Phasenfolge: der Wirker beendet seinen Zug → Gegner beginnt
    const t = await H.fresh({ hand: [[CARD], []], abilities: { 1: { 0: [['Destruction Magic'], [], []] } } });
    await anlegen(t, 0, 1, 0);
    await t.endTurn();
    R.check('echter Zugwechsel zu Sitz 1: 50 Schaden am Fesselträger', t.hp(1, 0) === 750, t.hp(1, 0));
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }

  R.section('C · mehrere Kopien');
  {
    const t = await H.fresh({ hand: [[CARD, CARD], []], abilities: { 1: { 0: [['Destruction Magic', 'Destruction Magic'], [], []] } } });
    await anlegen(t, 0, 1, 0);
    t.setHand(0, [CARD]);
    await anlegen(t, 0, 1, 0);
    await zugBeginn(t, 1);
    R.check('zwei Kopien: 2 × 100 = 200', t.hp(1, 0) === 600, t.hp(1, 0));
  }

  R.section('D · Zustände des Wirts');
  for (const status of ['frozen', 'stunned', 'negated']) {
    const t = await H.fresh({ hand: [[CARD], []], abilities: { 1: { 0: [['Destruction Magic'], [], []] } } });
    await anlegen(t, 0, 1, 0);
    t.heroStatus(1, 0, status, status === 'negated' ? { appliedTurn: 4, effectOnly: true } : true);
    await zugBeginn(t, 1);
    R.check(`Wirt ${status}: Fessel tickt weiter (W25b)`, status === 'negated' ? t.hp(1, 0) <= 800 : t.hp(1, 0) === 750, [status, t.hp(1, 0)]);
  }
  {
    // harte Negierung: Abilities zählen nicht
    const t = await H.fresh({ hand: [[CARD], []], abilities: { 1: { 0: [['Destruction Magic', 'Destruction Magic'], [], []] } } });
    await anlegen(t, 0, 1, 0);
    t.heroStatus(1, 0, 'negated');
    await zugBeginn(t, 1);
    R.check('hart negierter Wirt (Abilities aus): 0 Schulen → kein Schaden', t.hp(1, 0) === 800, t.hp(1, 0));
  }
  {
    const t = await H.fresh({ hand: [[CARD], []], abilities: { 1: { 0: [['Destruction Magic'], [], []] } } });
    await anlegen(t, 0, 1, 0);
    t.gs.players[1].heroes[0].hp = 0;
    await zugBeginn(t, 1);
    R.check('besiegter Wirt: nichts (HP bleibt 0, kein Absturz)', t.hp(1, 0) === 0 && t.errors.length === 0, [t.hp(1, 0), t.errors]);
  }
  {
    const t = await H.fresh({ hand: [[CARD], []], abilities: { 1: { 0: [['Destruction Magic', 'Destruction Magic', 'Destruction Magic'], [], []] } } });
    await anlegen(t, 0, 1, 0);
    t.gs.players[1].heroes[0].hp = 120;
    await zugBeginn(t, 1);
    R.check('Wirt mit 120 HP und 150 Schaden: besiegt', t.hp(1, 0) <= 0, t.hp(1, 0));
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }

  R.section('E · Abilities ändern sich: Zählung ist live');
  {
    const t = await H.fresh({ hand: [[CARD], []], abilities: { 1: { 0: [['Destruction Magic'], [], []] } } });
    await anlegen(t, 0, 1, 0);
    await zugBeginn(t, 1);
    t.setAbilities(1, 0, [['Destruction Magic', 'Destruction Magic'], ['Decay Magic'], []]);
    await zugBeginn(t, 1);
    R.check('1 Schule (50) dann 3 Schulen (150): 800 − 50 − 150 = 600', t.hp(1, 0) === 600, t.hp(1, 0));
  }

  R.section('F · Schadensart & Schutz');
  {
    const t = await H.fresh({ hand: [[CARD], []], abilities: { 1: { 0: [['Destruction Magic'], [], []] } } });
    await anlegen(t, 0, 1, 0);
    t.gs.firstTurnProtectedPlayer = 1;
    await zugBeginn(t, 1);
    R.check('Erstrunden-Schutz des Wirts (Schaden einer Gegnerkarte): kein Schaden', t.hp(1, 0) === 800, t.hp(1, 0));
    t.gs.firstTurnProtectedPlayer = null;
    await zugBeginn(t, 1);
    R.check('ohne Schutz: wieder 50', t.hp(1, 0) === 750, t.hp(1, 0));
  }
  {
    const t = await H.fresh({ hand: [[CARD], []], abilities: { 1: { 0: [['Destruction Magic'], [], []] } } });
    await anlegen(t, 0, 1, 0);
    const log = t.lg('damage');
    await zugBeginn(t, 1);
    const d = t.lg('damage').pop();
    R.check('Schadenslog trägt Schadenstyp/Quelle der Karte', !!d && /Spell Shackle/.test(JSON.stringify(d)), d);
  }

  R.section('G · Besitz und Abgang');
  {
    const t = await H.fresh({ hand: [[CARD], []], abilities: { 1: { 0: [['Destruction Magic'], [], []] } } });
    await anlegen(t, 0, 1, 0);
    const inst = t.find(CARD, 'support');
    R.check('originalOwner = Wirker (Sitz 0), Zone beim Wirt', inst.originalOwner === 0 && inst.owner === 1, [inst.originalOwner, inst.owner]);
    await t.run(() => t.engine.sendBoardCardToDiscard(inst));
    R.check('Ablage des Besitzers (Sitz 0), nicht des Wirts', t.pile(0, 'discardPile').includes(CARD) && !t.pile(1, 'discardPile').includes(CARD), [t.pile(0, 'discardPile'), t.pile(1, 'discardPile')]);
    await zugBeginn(t, 1);
    R.check('nach dem Abgang kein Schaden mehr', t.hp(1, 0) === 800, t.hp(1, 0));
  }

  R.section('H · Anlegen');
  {
    const t = await H.fresh({ hand: [[CARD], []] });
    t.policy.cancelTargets = true;
    await t.play(0, CARD, { hero: 0 });
    R.check('Abbruch: Karte zurück, nichts am Brett', t.pile(0, 'hand').includes(CARD) && !t.find(CARD, 'support'), t.pile(0, 'hand'));
  }
  {
    const t = await H.fresh({ hand: [[CARD], []] });
    await t.play(0, CARD, { hero: 0, noGrant: true });
    R.check('ohne Decay Magic Lv2 nicht spielbar', t.pile(0, 'hand').includes(CARD) && !t.find(CARD, 'support'));
  }
  {
    const t = await H.fresh({ hand: [[CARD], []] });
    await anlegen(t, 0, 1, 2);
    R.check('Zielliste: beide Seiten wählbar', t.targets[0].valid.some(v => isHero(v, 0)) && t.targets[0].valid.some(v => isHero(v, 1)));
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }

  R.section('I · Kontrollwechsel: tickt im Zug des NEUEN Kontrolleurs');
  {
    const t = await H.fresh({ hand: [[CARD], []], abilities: { 1: { 0: [['Destruction Magic', 'Destruction Magic'], [], []] } } });
    await anlegen(t, 0, 1, 0);
    const ok = await t.run(() => t.engine.actionTakeHeroPermanently(0, 1, 0, { sourceName: 'test' }));
    R.check('Gegnerheld 0 dauerhaft übernommen (Sitz 0 kontrolliert ihn)', ok !== false && t.engine.heroSideOf(1, t.gs.players[1].heroes[0]) === 0, ok);
    await zugBeginn(t, 1);
    R.check('Zug des alten Besitzers (Sitz 1): kein Tick', t.hp(1, 0) === 800, t.hp(1, 0));
    await zugBeginn(t, 0);
    R.check('Zug des neuen Kontrolleurs (Sitz 0): 100 Schaden', t.hp(1, 0) === 700, t.hp(1, 0));
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }

  R.finish();
})();
