'use strict';
// W72a-01 · Shrink (Spell Attachment, Magic Arts Lv2)
//
// Text: „All damage the Hero this Spell is attached to deals with Attacks becomes 1 and all damage it receives from Attacks is doubled. This is treated as a negative status effect."
// Geprüft: Anlegen (beide Seiten, Abbruch), Status `shrunk` (heilbar → Karte fällt ab; immuner Held → keine Wirkung), ausgehender Attack-Schaden = 1 (Held-/Kreaturenziel, Attack-Karte, Rider),
//   eingehender Attack-Schaden × 2, Spells/Status/Kreaturen unberührt, Wechselwirkung mit Stoneskin (Reihenfolge-unabhängig), Shrink gegen Shrink, mehrere Kopien, Zustandsprüfung.
const H = require('../../lib/h.js');
const CARD = 'Shrink';
const isHero = (v, owner, hi) => v.type === 'hero' && v.owner === owner && (hi == null || v.heroIdx === hi);
const tragen = (t, seat, hi, name = CARD) => (t.gs.players[seat].supportZones[hi] || []).filter(z => (z || []).includes(name)).length;

async function anlegen(t, caster, seat, hi, name = CARD) {
  t.targetFn = (valid) => { const v = valid.find(x => isHero(x, seat, hi)); return v ? [v.id] : undefined; };
  const hand = t.pile(caster, 'hand').slice(); const i0 = hand.indexOf(name); if (i0 >= 0) hand.splice(i0, 1);
  t.setHand(caster, [name]);
  const r = await t.play(caster, name, { hero: 0 });
  t.setHand(caster, hand);
  t.targetFn = null;
  return r;
}
const setAtk = (t, seat, hi, atk) => { t.gs.players[seat].heroes[hi].atk = atk; t.gs.players[seat].heroes[hi].baseAtk = atk; };
async function attack(t, seat, hi, zielId) {
  t.targetFn = (valid) => { const v = valid.find(x => x.id === zielId(valid)); return v ? [v.id] : undefined; };
  t.setHand(seat, ['Attack']);
  const r = await t.play(seat, 'Attack', { hero: hi });
  t.targetFn = null;
  return r;
}
const heldId = (owner, hi) => (valid) => (valid.find(v => isHero(v, owner, hi)) || {}).id;
const kreaturId = (owner) => (valid) => (valid.find(v => v.type === 'equip' && v.owner === owner) || {}).id;

(async () => {
  const R = H.runner();

  R.section('A · Anlegen und Status');
  {
    const t = await H.fresh({ hand: [[CARD], []] });
    const r = await anlegen(t, 0, 1, 0);
    R.check('gespielt (auf Gegnerheld 0)', r === true, r);
    R.check('liegt am Gegnerhelden', tragen(t, 1, 0) === 1, t.gs.players[1].supportZones);
    R.check('Status „shrunk" am Wirt', !!t.hero(1, 0).statuses.shrunk, t.hero(1, 0).statuses);
    R.check('Status trägt die Karte (`_fromAttachment`), negativ + heilbar', t.hero(1, 0).statuses.shrunk._fromAttachment === CARD, t.hero(1, 0).statuses.shrunk);
    R.check('Karte weder auf der Hand noch in der Ablage', !t.pile(0, 'hand').includes(CARD) && !t.pile(0, 'discardPile').includes(CARD));
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
    R.check('Zustand sauber', t.audit().length === 0, t.audit());
  }
  {
    const t = await H.fresh({ hand: [[CARD], []] });
    await anlegen(t, 0, 0, 2);
    R.check('auch auf den eigenen Helden legbar', tragen(t, 0, 2) === 1 && !!t.hero(0, 2).statuses.shrunk);
    R.check('Zielliste bot beide Seiten', t.targets[0].valid.some(v => isHero(v, 0)) && t.targets[0].valid.some(v => isHero(v, 1)));
  }
  {
    const t = await H.fresh({ hand: [[CARD], []] });
    t.policy.cancelTargets = true;
    await t.play(0, CARD, { hero: 0 });
    R.check('Abbruch: Karte zurück auf die Hand, kein Status', t.pile(0, 'hand').includes(CARD) && !t.hero(1, 0).statuses.shrunk && tragen(t, 1, 0) + tragen(t, 0, 0) === 0);
  }
  {
    // Held immun gegen negative Status → die Karte liegt ohne Wirkung am Helden
    const t = await H.fresh({ hand: [[CARD], []] });
    await t.run(() => t.engine.actionAddBuff(t.hero(1, 0), 1, 0, 'negative_status_immune', { sourceOwner: 1, source: 'Test' }));
    await anlegen(t, 0, 1, 0);
    R.check('immuner Held: Karte liegt da, aber KEIN Status', tragen(t, 1, 0) === 1 && !t.hero(1, 0).statuses.shrunk, t.hero(1, 0).statuses);
    setAtk(t, 1, 0, 200);
    setAtk(t, 0, 0, 100);
    await attack(t, 0, 0, heldId(1, 0));
    R.check('immuner Held: Schaden unverdoppelt (100)', t.hp(1, 0) === 700, t.hp(1, 0));
  }

  R.section('B · ausgehender Attack-Schaden wird 1');
  for (const atk of [250, 100, 2, 1]) {
    const t = await H.fresh({ hand: [['Attack'], []] });
    await anlegen(t, 1, 0, 0);                 // Gegner (Sitz 1) legt Shrink auf Held 0 von Sitz 0
    setAtk(t, 0, 0, atk);
    const r = await attack(t, 0, 0, heldId(1, 1));
    R.check(`ATK ${atk} → Gegnerheld verliert 1`, r === true && t.hp(1, 1) === 799, [r, t.hp(1, 1)]);
    R.check(`ATK ${atk}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
  }
  {
    // ATK 0: kein Schaden, der „zu 1" werden könnte
    const t = await H.fresh({ hand: [['Attack'], []] });
    await anlegen(t, 1, 0, 0);
    setAtk(t, 0, 0, 0);
    await attack(t, 0, 0, heldId(1, 1));
    R.check('ATK 0 bleibt 0 Schaden', t.hp(1, 1) === 800, t.hp(1, 1));
  }
  {
    // Kreaturenziel
    const t = await H.fresh({ hand: [['Attack'], []] });
    await anlegen(t, 1, 0, 0);
    setAtk(t, 0, 0, 250);
    const c = t.put(1, 0, 0, H.INERT.big);
    await attack(t, 0, 0, kreaturId(1));
    R.check('Kreaturenziel: 1 Schaden (1000 → 999)', c.counters.currentHp === 999, c.counters.currentHp);
  }
  {
    // ein anderer Held desselben Spielers (ohne Shrink) macht vollen Schaden
    const t = await H.fresh({ hand: [['Attack'], []] });
    await anlegen(t, 1, 0, 0);
    setAtk(t, 0, 1, 250);
    await attack(t, 0, 1, heldId(1, 1));
    R.check('anderer Held ohne Shrink: voller Schaden 250', t.hp(1, 1) === 550, t.hp(1, 1));
  }
  {
    // Spell-Schaden des Shrink-Helden bleibt voll
    const t = await H.fresh({ hand: [['Fireball'], []] });
    await anlegen(t, 1, 0, 0);
    t.grantFor(0, 0, 'Fireball');
    t.targetFn = (valid) => [valid.find(v => isHero(v, 1, 1)).id];
    t.setHand(0, ['Fireball']);
    const r = await t.play(0, 'Fireball', { hero: 0 });
    R.check('Fireball vom Shrink-Helden: volle Wirkung (nicht 1)', r === true && t.hp(1, 1) < 799, [r, t.hp(1, 1)]);
  }

  R.section('C · eingehender Attack-Schaden wird verdoppelt');
  for (const [atk, erw] of [[250, 500], [100, 200], [1, 2], [0, 0]]) {
    const t = await H.fresh({ hand: [['Attack'], []] });
    await anlegen(t, 0, 1, 0);
    setAtk(t, 0, 0, atk);
    const r = await attack(t, 0, 0, heldId(1, 0));
    R.check(`ATK ${atk} gegen Shrink-Held: ${erw}`, r === true && t.hp(1, 0) === 800 - erw, [r, t.hp(1, 0)]);
  }
  {
    // Gegenprobe: anderer Held desselben Gegners nimmt den einfachen Schaden
    const t = await H.fresh({ hand: [['Attack'], []] });
    await anlegen(t, 0, 1, 0);
    setAtk(t, 0, 0, 100);
    await attack(t, 0, 0, heldId(1, 1));
    R.check('Held ohne Shrink: einfacher Schaden', t.hp(1, 1) === 700, t.hp(1, 1));
  }
  {
    // Spells verdoppeln NICHT
    const t = await H.fresh({ hand: [['Fireball'], []] });
    await anlegen(t, 0, 1, 0);
    t.grantFor(0, 0, 'Fireball');
    const ref = await H.fresh({ hand: [['Fireball'], []] });
    ref.grantFor(0, 0, 'Fireball');
    for (const x of [t, ref]) {
      x.targetFn = (valid) => [valid.find(v => isHero(v, 1, 0)).id];
      x.setHand(0, ['Fireball']);
      await x.play(0, 'Fireball', { hero: 0 });
    }
    R.check('Fireball auf den Shrink-Held: derselbe Schaden wie ohne Shrink', t.hp(1, 0) === ref.hp(1, 0), [t.hp(1, 0), ref.hp(1, 0)]);
  }
  {
    // Gift-Tick verdoppelt nicht
    const t = await H.fresh({ hand: [[CARD], []] });
    await anlegen(t, 0, 1, 0);
    const ref = await H.fresh({ hand: [[], []] });
    for (const x of [t, ref]) await x.run(() => x.engine.addHeroStatus(1, 0, 'poisoned', { appliedBy: 0, stacks: 1 }));
    for (const x of [t, ref]) await x.run(() => x.engine.runHooks('onTurnStart', { turn: x.gs.turn, activePlayer: 1 }));
    R.check('Giftschaden: wie ohne Shrink', t.hp(1, 0) === ref.hp(1, 0), [t.hp(1, 0), ref.hp(1, 0)]);
  }

  R.section('D · Shrink gegen Shrink, Stoneskin, mehrere Kopien');
  {
    const t = await H.fresh({ hand: [['Attack'], []] });
    await anlegen(t, 1, 0, 0); await anlegen(t, 0, 1, 1);
    setAtk(t, 0, 0, 250);
    await attack(t, 0, 0, heldId(1, 1));
    R.check('beide Helden geschrumpft: Schaden 1 (nicht 2)', t.hp(1, 1) === 799, t.hp(1, 1));
  }
  for (const reihenfolge of [['Shrink', 'Stoneskin'], ['Stoneskin', 'Shrink']]) {
    const t = await H.fresh({ hand: [['Attack'], []] });
    for (const n of reihenfolge) await anlegen(t, 0, 1, 0, n);
    setAtk(t, 0, 0, 250);
    await attack(t, 0, 0, heldId(1, 0));
    R.check(`Ziel mit ${reihenfolge.join(' + ')}: 250×2 − 100 = 400 (Punkt vor Strich, Reihenfolge egal)`, t.hp(1, 0) === 400, t.hp(1, 0));
  }
  for (const reihenfolge of [['Shrink', 'Stoneskin'], ['Stoneskin', 'Shrink']]) {
    const t = await H.fresh({ hand: [['Attack'], []] });
    await anlegen(t, 1, 0, 0);                      // Angreifer geschrumpft
    for (const n of reihenfolge) { if (n === 'Stoneskin') await anlegen(t, 0, 1, 1, n); }
    setAtk(t, 0, 0, 250);
    await attack(t, 0, 0, heldId(1, 1));
    R.check('Angreifer geschrumpft, Ziel mit Stoneskin: 1 − 100 → 0 Schaden', t.hp(1, 1) === 800, t.hp(1, 1));
  }
  {
    // zwei Shrink-Karten am Ziel: zweimal verdoppelt
    const t = await H.fresh({ hand: [['Attack'], []] });
    await anlegen(t, 0, 1, 0); await anlegen(t, 0, 1, 0);
    setAtk(t, 0, 0, 100);
    await attack(t, 0, 0, heldId(1, 0));
    R.check('zwei Shrink am Ziel: 100 → 400', tragen(t, 1, 0) === 2 && t.hp(1, 0) === 400, [tragen(t, 1, 0), t.hp(1, 0)]);
  }
  {
    // zwei Shrink am Angreifer: weiter 1
    const t = await H.fresh({ hand: [['Attack'], []] });
    await anlegen(t, 1, 0, 0); await anlegen(t, 1, 0, 0);
    setAtk(t, 0, 0, 250);
    await attack(t, 0, 0, heldId(1, 1));
    R.check('zwei Shrink am Angreifer: Schaden bleibt 1', t.hp(1, 1) === 799, t.hp(1, 1));
  }

  R.section('E · Heilen / Abgang / Wechsel');
  {
    const t = await H.fresh({ hand: [[CARD], []] });
    await anlegen(t, 0, 1, 0);
    await t.run(() => t.engine.removeHeroStatus(1, 0, 'shrunk', {}));
    R.check('geheilt: Status weg, Karte in der Ablage ihres Besitzers (Sitz 0)', !t.hero(1, 0).statuses.shrunk && tragen(t, 1, 0) === 0 && t.pile(0, 'discardPile').includes(CARD), [t.hero(1, 0).statuses, t.pile(0, 'discardPile')]);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  {
    const t = await H.fresh({ hand: [['Attack', CARD], []] });
    await anlegen(t, 0, 1, 0);
    const inst = t.find(CARD, 'support');
    await t.run(() => t.engine.actionDestroyCard({ name: 'x', owner: 0 }, inst));
    R.check('Karte zerstört: Status endet mit ihr', !t.hero(1, 0).statuses.shrunk);
    setAtk(t, 0, 0, 100);
    await attack(t, 0, 0, heldId(1, 0));
    R.check('danach einfacher Schaden', t.hp(1, 0) === 700, t.hp(1, 0));
  }
  {
    // Held fällt → kein Fehler, kein Rest
    const t = await H.fresh({ hand: [['Attack'], []] });
    await anlegen(t, 0, 1, 0);
    setAtk(t, 0, 0, 300);
    t.gs.players[1].heroes[0].hp = 500;
    await attack(t, 0, 0, heldId(1, 0));
    R.check('300 × 2 = 600 ≥ 500 HP: Held besiegt, keine Fehler', t.hp(1, 0) <= 0 && t.errors.length === 0, [t.hp(1, 0), t.errors]);
    R.check('Zustand sauber', t.audit().length === 0, t.audit());
  }

  R.finish();
})().catch(e => { process.stderr.write('THROW ' + (e && e.stack || e) + '\n'); process.exit(2); });
