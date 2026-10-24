'use strict';
// W71c-01 · Stoneskin (neue Karte, Spell Attachment, Support Magic Lv1; Wert 80 → 100, Al 24.10.2026)
//
// Text: „All damage the Hero this card is attached to receives from Attacks is reduced by 100, and it cannot be Poisoned, Burned or Stunned."
// Geprüft: Anlegen (eigener/gegnerischer Held), −100 nur gegen ATTACKS (Attack-Karte, Heldenangriff), nicht gegen Spells/Kreaturen/Status;
//   nie unter 0; Mehrfach-Kopien addieren; Immunität gegen Poisoned/Burned/Stunned (gezielt, Fläche), andere Status (Frozen …) bleiben möglich;
//   bestehende Status bleiben; Wirt wechselt/Karte verlässt Zone → Wirkung endet; Anti-Magic-Schutz verhindert das Anlegen; Zustandsprüfung.
const H = require('../../lib/h.js');
const CARD = 'Stoneskin';
const isHero = (v, owner, hi) => v.type === 'hero' && v.owner === owner && (hi == null || v.heroIdx === hi);
const tragen = (t, seat, hi) => (t.gs.players[seat].supportZones[hi] || []).filter(z => (z || []).includes(CARD)).length;

/** Stoneskin auf (seat,hi) legen — über den echten Spielweg. */
async function anlegen(t, caster, seat, hi) {
  t.targetFn = (valid) => { const v = valid.find(x => isHero(x, seat, hi)); return v ? [v.id] : undefined; };
  const r = await t.play(caster, CARD, { hero: 0 });
  t.targetFn = null;
  return r;
}

(async () => {
  const R = H.runner();

  R.section('A · Anlegen');
  {
    const t = await H.fresh({ hand: [[CARD], []] });
    const r = await anlegen(t, 0, 0, 1);
    R.check('gespielt', r === true, r);
    R.check('liegt in einer Support Zone von Held 1 (eigene Seite)', tragen(t, 0, 1) === 1, t.gs.players[0].supportZones);
    R.check('Karte nicht auf der Hand und nicht in der Ablage', !t.pile(0, 'hand').includes(CARD) && !t.pile(0, 'discardPile').includes(CARD), [t.pile(0, 'hand'), t.pile(0, 'discardPile')]);
    R.check('Instanz im Support, Besitzer-Herkunft = Wirker', !!t.find(CARD, 'support') && t.find(CARD, 'support').originalOwner === 0, t.find(CARD, 'support') && t.find(CARD, 'support').originalOwner);
    R.check('Zielliste bot eigene UND gegnerische Helden', t.targets[0].valid.some(v => isHero(v, 0)) && t.targets[0].valid.some(v => isHero(v, 1)));
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
    R.check('Zustand sauber', t.audit().length === 0, t.audit());
  }
  {
    const t = await H.fresh({ hand: [[CARD], []] });
    await anlegen(t, 0, 1, 2);
    R.check('auch auf einen Gegnerhelden legbar', tragen(t, 1, 2) === 1);
    R.check('Besitzer-Herkunft bleibt der Wirker (Ablage-Ziel später: Sitz 0)', t.find(CARD, 'support').originalOwner === 0);
  }
  {
    const t = await H.fresh({ hand: [[CARD], []] });
    t.policy.cancelTargets = true;
    await t.play(0, CARD, { hero: 0 });
    R.check('Abbruch: Karte zurück auf die Hand, nichts am Brett', t.pile(0, 'hand').includes(CARD) && tragen(t, 0, 0) + tragen(t, 0, 1) + tragen(t, 0, 2) === 0, t.pile(0, 'hand'));
  }

  R.section('B · −100 gegen ATTACKS (Basis-Karte „Attack": Schaden = ATK des Angreifers)');
  for (const [atk, erwartet] of [[250, 150], [100, 0], [60, 0], [101, 1], [400, 300]]) {
    const t = await H.fresh({ hand: [['Attack', CARD], []] });
    t.gs.players[0].heroes[0].atk = atk; t.gs.players[0].heroes[0].baseAtk = atk;
    await anlegen(t, 0, 1, 0);   // Stoneskin auf Gegner-Held 0 (der Wirker legt es dem Gegner an)
    t.targetFn = (valid) => [valid.find(v => isHero(v, 1, 0)).id];
    t.setHand(0, ['Attack']);
    const r = await t.play(0, 'Attack', { hero: 0 });
    R.check(`ATK ${atk} gegen Stoneskin-Held: Schaden ${erwartet}`, r === true && t.hp(1, 0) === 800 - erwartet, [r, t.hp(1, 0)]);
    R.check(`ATK ${atk}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
  }
  {
    // Gegenprobe: ohne Stoneskin voller Schaden; anderer Held desselben Gegners ohne Stoneskin voller Schaden
    const t = await H.fresh({ hand: [['Attack'], []] });
    t.gs.players[0].heroes[0].atk = 250;
    t.targetFn = (valid) => [valid.find(v => isHero(v, 1, 1)).id];
    await t.play(0, 'Attack', { hero: 0 });
    R.check('Gegenprobe ohne Stoneskin: volle 250', t.hp(1, 1) === 550, t.hp(1, 1));
  }
  {
    // Stoneskin am Held 0, Angriff auf Held 1 → unberührt (Karte wirkt nur für ihren Wirt)
    const t = await H.fresh({ hand: [['Attack', CARD], []] });
    t.gs.players[0].heroes[0].atk = 250;
    await anlegen(t, 0, 1, 0);
    t.setHand(0, ['Attack']);
    t.targetFn = (valid) => [valid.find(v => isHero(v, 1, 1)).id];
    await t.play(0, 'Attack', { hero: 0 });
    R.check('anderer Held ohne Stoneskin: volle 250', t.hp(1, 1) === 550, t.hp(1, 1));
  }

  R.section('C · KEINE Minderung gegen Spells, Status, Kreaturen, Rückstoß');
  {
    const t = await H.fresh({ hand: [['Fireball', CARD], []] });
    await anlegen(t, 0, 1, 0);
    t.setHand(0, ['Fireball']);
    t.targetFn = (valid) => [valid.find(v => isHero(v, 1, 0)).id];
    await t.play(0, 'Fireball', { hero: 0 });
    R.check('Fireball (Spell): voller Schaden 150', t.hp(1, 0) === 650, t.hp(1, 0));
  }
  {
    const t = await H.fresh({ hand: [[CARD], []] });
    await anlegen(t, 0, 1, 0);
    await t.run(() => t.engine.actionDealDamage({ name: 'ZZ', owner: 0, heroIdx: 0 }, t.gs.players[1].heroes[0], 150, 'creature'));
    await t.run(() => t.engine.actionDealDamage({ name: 'ZZ', owner: 0, heroIdx: 0 }, t.gs.players[1].heroes[0], 80, 'other'));
    await t.run(() => t.engine.actionDealDamage({ name: 'ZZ', owner: 0, heroIdx: 0 }, t.gs.players[1].heroes[0], 70, 'artifact'));
    R.check('Kreatur-/Sonstiger-/Artefakt-Schaden ungemindert (150+80+70)', t.hp(1, 0) === 500, t.hp(1, 0));
  }
  {
    const t = await H.fresh({ hand: [[CARD], []] });
    await anlegen(t, 0, 1, 0);
    await t.run(() => t.engine.actionDealDamage({ name: 'ZZ', owner: 0, heroIdx: 0 }, t.gs.players[1].heroes[0], 300, 'attack'));
    R.check('direkter Engine-Schaden vom Typ attack: 300 − 100 = 200', t.hp(1, 0) === 600, t.hp(1, 0));
  }

  R.section('D · mehrere Kopien am selben Helden addieren sich; nie unter 0');
  {
    const t = await H.fresh({ hand: [[CARD, CARD], []] });
    await anlegen(t, 0, 1, 0);
    t.setHand(0, [CARD]);
    await anlegen(t, 0, 1, 0);
    R.check('zwei Stoneskin am Gegnerhelden 0', tragen(t, 1, 0) === 2, tragen(t, 1, 0));
    await t.run(() => t.engine.actionDealDamage({ name: 'ZZ', owner: 0, heroIdx: 0 }, t.gs.players[1].heroes[0], 350, 'attack'));
    R.check('zwei Kopien: 350 − 200 = 150', t.hp(1, 0) === 650, t.hp(1, 0));
    await t.run(() => t.engine.actionDealDamage({ name: 'ZZ', owner: 0, heroIdx: 0 }, t.gs.players[1].heroes[0], 150, 'attack'));
    R.check('zwei Kopien: 150 Schaden → 0 (nicht negativ, kein Heilen)', t.hp(1, 0) === 650, t.hp(1, 0));
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }

  R.section('E · Immunität gegen Poisoned, Burned, Stunned');
  {
    const t = await H.fresh({ hand: [[CARD], []] });
    await anlegen(t, 0, 1, 0);
    const h = t.gs.players[1].heroes[0];
    for (const s of ['poisoned', 'burned', 'stunned']) await t.run(() => t.engine.addHeroStatus(1, 0, s, { duration: 2, appliedBy: 0 }));
    R.check('addHeroStatus: kein Poisoned, kein Burned, kein Stunned', !h.statuses.poisoned && !h.statuses.burned && !h.statuses.stunned, Object.keys(h.statuses));
    await t.run(() => t.engine.addHeroStatus(1, 0, 'frozen', { duration: 1, appliedBy: 0 }));
    R.check('andere Status (Frozen) sind weiter möglich', !!h.statuses.frozen, Object.keys(h.statuses));
    R.check('Log status_blocked mit Grund', t.lg('status_blocked').filter(l => l.reason === 'status_immunity_attachment').length === 3, t.lg('status_blocked'));
    const ctxAdd = await t.run(() => t.engine.actionAddStatus(h, 'poisoned', { appliedBy: 0 }));
    R.check('actionAddStatus-Weg (ctx.addStatus): ebenfalls geblockt', !h.statuses.poisoned, Object.keys(h.statuses));
    R.check('heroBlocksStatusNow meldet true für alle drei, false für Frozen-freien Zweitheld', t.engine.heroBlocksStatusNow(1, 0, 'poisoned') && t.engine.heroBlocksStatusNow(1, 0, 'burned') && t.engine.heroBlocksStatusNow(1, 0, 'stunned') && !t.engine.heroBlocksStatusNow(1, 1, 'poisoned'));
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  {
    // echte Karten: Gift-Zauber (The Warlord's Bite), Flächenstatus (Poisoned Well), Stun (Petrifier), Burn (Heat Wave)
    const t = await H.fresh({ hand: [[CARD], []] });
    await anlegen(t, 0, 1, 0);
    const h = t.gs.players[1].heroes[0], h1 = t.gs.players[1].heroes[1];
    t.setHand(0, ["The Warlord's Bite"]);
    t.targetFn = (valid) => [valid.find(v => isHero(v, 1, 0)).id];
    await t.play(0, "The Warlord's Bite", { hero: 0 });
    R.check("The Warlord's Bite auf den Stoneskin-Helden: keine Vergiftung", !h.statuses.poisoned, h.statuses);
    t.setHand(0, ['Poisoned Well']);
    t.targetFn = null;
    await t.play(0, 'Poisoned Well', { hero: 0 });
    R.check('Poisoned Well (Fläche): Stoneskin-Held verschont, Nachbarheld vergiftet', !h.statuses.poisoned && !!h1.statuses.poisoned, [Object.keys(h.statuses), Object.keys(h1.statuses)]);
    t.setHand(0, ['Petrifier']);
    t.targetFn = (valid) => [valid.find(v => isHero(v, 1, 0)).id];
    await t.play(0, 'Petrifier', { hero: 0 });
    R.check('Petrifier (Stun) auf den Stoneskin-Helden: nicht betäubt', !h.statuses.stunned, h.statuses);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  {
    // bestehende Status bleiben
    const t = await H.fresh({ hand: [[CARD], []] });
    t.heroStatus(1, 0, 'poisoned', { stacks: 1, appliedTurn: 4 });
    await anlegen(t, 0, 1, 0);
    R.check('bereits liegender Poison-Status bleibt (verhindert nur NEUE)', !!t.gs.players[1].heroes[0].statuses.poisoned);
  }

  R.section('F · Wirkung endet, wenn die Karte geht');
  {
    const t = await H.fresh({ hand: [[CARD], []] });
    await anlegen(t, 0, 1, 0);
    const inst = t.find(CARD, 'support');
    await t.run(() => t.engine.sendBoardCardToDiscard(inst));
    R.check('Stoneskin in der Ablage seines Besitzers (Sitz 0)', t.pile(0, 'discardPile').includes(CARD) && !t.pile(1, 'discardPile').includes(CARD), [t.pile(0, 'discardPile'), t.pile(1, 'discardPile')]);
    await t.run(() => t.engine.actionDealDamage({ name: 'ZZ', owner: 0, heroIdx: 0 }, t.gs.players[1].heroes[0], 300, 'attack'));
    await t.run(() => t.engine.addHeroStatus(1, 0, 'poisoned', { appliedBy: 0 }));
    R.check('danach voller Schaden und Vergiftung möglich', t.hp(1, 0) === 500 && !!t.gs.players[1].heroes[0].statuses.poisoned, [t.hp(1, 0), Object.keys(t.gs.players[1].heroes[0].statuses)]);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }

  R.section('G · Schutzmechanismen beim Anlegen');
  {
    const t = await H.fresh({ hand: [[CARD], []] });
    t.gs.players[1].heroes[0].buffs = { magic_immune: { level: 3 } };
    const r = await anlegen(t, 0, 1, 0);
    R.check('Anti-Magic-Held: Stoneskin liegt nicht am Helden (kein Absturz)', tragen(t, 1, 0) === 0 && t.errors.length === 0, [tragen(t, 1, 0), t.errors]);
  }
  {
    const t = await H.fresh({ hand: [[CARD], []] });
    for (let s = 0; s < 3; s++) t.put(0, 0, s, H.INERT.creature);
    t.targetFn = (valid) => { t._v = valid.slice(); return valid.filter(v => isHero(v, 0, 0)).map(v => v.id); };
    const r = await t.play(0, CARD, { hero: 0 });
    R.check('Held ohne freie Support Zone ist kein Wirt (nicht angeboten)', !(t._v || []).some(v => isHero(v, 0, 0) && !v.ineligible), (t._v || []).map(v => v.id));
  }
  {
    const t = await H.fresh({ hand: [[CARD], []] });
    t.setHero(0, 1, null, 0); t.setHero(0, 2, null, 0); t.setHero(1, 0, null, 0); t.setHero(1, 1, null, 0); t.setHero(1, 2, null, 0);
    t.targetFn = (valid) => { t._v = valid.slice(); return valid.slice(0, 1).map(v => v.id); };
    await t.play(0, CARD, { hero: 0 });
    R.check('besiegte/leere Helden nie als Wirt angeboten', !(t._v || []).some(v => v.type === 'hero' && (v.owner !== 0 || v.heroIdx !== 0)), (t._v || []).map(v => v.id));
  }

  R.finish();
})();
