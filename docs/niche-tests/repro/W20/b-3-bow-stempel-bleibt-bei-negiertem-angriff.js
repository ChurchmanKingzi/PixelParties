'use strict';
// W20b-3 · Bow of the Hunt Goddess — bestätigt (Al, 20.10.2026, Rückfrage 1 der Welle 19): „Soll das Once-per-turn des Bow auch dann frei bleiben, wenn der Pfeil
//   aufgelöst hat, der Angriff selbst aber danach negiert wird oder verpufft?" - Al: „nein".
// Erwartet (Ist-Zustand): hat der Pfeil gewirkt (aufgelöst), bleibt der Stempel des Bow gesetzt, auch wenn der ANGRIFF anschließend negiert wird (Invisibility Cloak
//   des Gegners). Im selben Zug wird der Bow nicht noch einmal angeboten. Gegenprobe: wird der PFEIL negiert (Rusty Touch), bleibt der Bow frei (W19c).
//   Beide Seiten. Exit 0 = korrekt.
const H = require('../../lib/h.js');
const BOW = 'Bow of the Hunt Goddess';
const istBowPrompt = (p) => /Bow/.test(p.d.title || '');
const stempel = (t) => Object.keys(t.gs.hoptUsed || {}).some(k => /^bowHuntGoddess#/.test(k) && t.gs.hoptUsed[k] === t.gs.turn);
async function aufbau(seite, gegenkarte) {
  const gegner = 1 - seite;
  const hand = [[], []]; hand[seite] = ['Attack', 'Attack']; hand[gegner] = [gegenkarte];
  const deck = [undefined, undefined]; deck[seite] = ['Bomb Arrow', 'Poisoned Arrow', 'ZZ Dummy', 'ZZ Dummy', 'ZZ Dummy'];
  const t = await H.fresh({ hand, deck, gold: [100, 100], active: seite });
  t.policy.confirm = true;
  t.put(seite, 0, 0, BOW);
  const opfer = t.put(gegner, 1, 0, H.INERT.big);   // Ziel für Bomb Arrow („deal 100 damage to a Creature your opponent controls"): wirkt unabhängig vom Angriff
  t.grantFor(gegner, 0, gegenkarte);
  t.targetFn = (valid) => { const k = valid.find(v => v.type === 'equip' && v.owner === gegner); return [(k || valid.find(v => v.type === 'hero' && v.owner === gegner && v.heroIdx === 0)).id]; };   // Kreatur für Bomb Arrow, sonst der Held
  t.script.push({ match: d => d.type === 'cardGallery' && /Bow/.test(d.title || ''), answer: () => ({ cardName: 'Bomb Arrow', source: 'deck' }), once: true });
  return { t, gegner, opfer };
}
(async () => {
  const R = H.runner();
  for (const seite of [0, 1]) {
    R.section(`Sitz ${seite} am Zug: Pfeil (Bomb Arrow) wirkt, der Angriff wird von Invisibility Cloak negiert -> Stempel bleibt`);
    { const { t, gegner, opfer } = await aufbau(seite, 'Invisibility Cloak');
      const hp0 = t.hp(gegner, 0);
      t.reset();
      await t.play(seite, 'Attack', { hero: 0 });
      R.check(`${seite}: Bow bot an und der Pfeil ist gespielt (Ablage)`, t.prompts.some(istBowPrompt) && t.pile(seite, 'discardPile').includes('Bomb Arrow'), { p: t.prompts.map(p => p.d.title), d: t.pile(seite, 'discardPile') });
      R.check(`${seite}: der Angriff wurde negiert (kein Schaden am Helden, Cloak in der Ablage des Gegners)`, t.hp(gegner, 0) === hp0 && t.pile(gegner, 'discardPile').includes('Invisibility Cloak'), { hp: t.hp(gegner, 0), hp0, d: t.pile(gegner, 'discardPile') });
      const pfeilWirkte = opfer.counters?.currentHp === 900;   // ZZ Dummy Big hat 1000 HP
      R.check(`${seite}: der Pfeil hat trotzdem gewirkt (Bomb Arrow: 100 Schaden an der Kreatur)`, pfeilWirkte, opfer.counters);
      R.check(`${seite}: Stempel des Bow bleibt gesetzt (Al: nein, nicht zurückgeben)`, stempel(t), t.gs.hoptUsed);
      t.addHand(seite, 'Attack'); t.reset();
      await t.play(seite, 'Attack', { hero: 0 });
      R.check(`${seite}: kein zweites Bow-Angebot im selben Zug`, !t.prompts.some(istBowPrompt), t.prompts.map(p => p.d.title));
      R.check(`${seite}: keine Engine-Fehler, Zustand sauber`, t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() }); }
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
