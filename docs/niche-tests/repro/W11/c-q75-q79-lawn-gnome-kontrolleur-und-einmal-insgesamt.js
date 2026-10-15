'use strict';
// W11c · Q75 + Q79 (C03-02, C03-13) · Inconspicuous Lawn Gnome: Kontrolleur wählt selbst; „once per turn" gilt für Hand UND Brett zusammen
//
// Kartentext (neu, Welle 11, `data/cards.json`): „You may once per turn change this card's level in your hand or on the board while you control it to any level from 0 to 3."
// ENTSCHIEDEN (Al, Welle 11):
//   Q75: „Der Borger/Dieb darf den Effekt ganz normal aktivieren und die Stufe selbst wählen." -> Prompt an den Aktivierenden/Kontrolleur.
//   Q79: „Nur einmal pro Runde insgesamt!" -> eine Stufenänderung je Zug und Karte, Hand und Brett zusammen.
// Umsetzung: `inconspicuous-lawn-gnome.js` (Handindex-Feld `_handStufenWechsel` -> `counters._stufeGeaendertZug`, `canActivateCreatureEffect`),
//   Feld in `_engine.js` `_registerBuiltinHandIndexedFields`.
// Geprüft: (a) gestohlener Gnom: Prompt geht an den Dieb (Sitz 1), seine Wahl (Stufe 3) gilt; (b) Hand -> Spielen -> Brett im selben Zug: gesperrt; (c) die Sperre
//   gehört der geänderten KOPIE (zwei Kopien in der Hand: die unveränderte darf auf dem Brett umstellen); (d) im nächsten eigenen Zug wieder erlaubt;
//   (e) Brett zuerst (ohne Handänderung): genau eine Änderung, die zweite im selben Zug gesperrt; (f) Kartentext.
const H = require('../../lib/h.js');
const fs = require('fs');
const path = require('path');
const G = 'Inconspicuous Lawn Gnome';

(async () => {
  const R = H.runner();
  const lvl = (t, inst) => t.engine.getEffectiveCardData(inst)?.level;
  const wahl = (t, id) => t.script.push({ match: d => d.title === G, answer: () => ({ optionId: id }) });

  R.section('(a) Q75: gestohlener Gnom, der Dieb wählt selbst');
  {
    const t = await H.fresh({});
    const g = t.put(0, 0, 0, G); g.turnPlayed = 1;
    t.engine.actionStealCreature(1, g);
    wahl(t, 'lvl3');
    t.gs.activePlayer = 1; t.phase(2);
    const r = await t.run(() => t.host.doActivateCreatureEffect(t.room, 1, { heroIdx: 0, zoneSlot: 0, charmedOwner: 0 }));
    R.check('(a) Aktivierung angenommen', r === true, r);
    R.check('(a) Prompt nur an den Dieb (Sitz 1)', t.prompts.length > 0 && t.prompts.every(p => p.pi === 1), t.prompts.map(p => p.pi));
    R.check('(a) die gewählte Stufe 3 gilt', lvl(t, g) === 3, lvl(t, g));
    R.check('(a) keine Engine-Fehler', t.errors.length === 0, t.errors);
  }

  R.section('(b) Q79: Hand -> Spielen -> Brett im selben Zug gesperrt');
  {
    const t = await H.fresh({ hand: [[G], []] });
    t.setAbilities(0, 0, [Array(3).fill('Summoning Magic'), [], []]);
    wahl(t, 'lvl2');
    t.gs.activePlayer = 0; t.phase(2);
    const r1 = await t.run(() => t.engine.doHandActivate(0, G, 0));
    const p = await t.play(0, G, { hero: 0, slot: 0, noGrant: true });
    const g = t.inst(c => c.name === G && c.zone === 'support')[0];
    g.turnPlayed = 1;
    t.script.length = 0; wahl(t, 'lvl3');
    t.gs.activePlayer = 0; t.phase(2);
    const r2 = await t.run(() => t.host.doActivateCreatureEffect(t.room, 0, { heroIdx: 0, zoneSlot: 0 }));
    R.note('Hand / Spielen / Brett', [r1, p, r2]);
    R.check('(b) Handänderung angenommen, Gnom gespielt', r1 === true && p === true && !!g, [r1, p]);
    R.check('(b) zweite Stufenänderung im selben Zug (Brett) wird NICHT angenommen', r2 === false, r2);
    R.check('(b) Stufe auf dem Brett unverändert (nicht 3)', lvl(t, g) !== 3, lvl(t, g));
    R.check('(b) der Client sieht den Gnom nicht als aktivierbar', !(t.engine.getActivatableCreatures?.(0) || []).some?.(a => a.cardName === G && a.canActivate), (t.engine.getActivatableCreatures?.(0) || []).filter?.(a => a.cardName === G));
    R.check('(b) keine Engine-Fehler', t.errors.length === 0, t.errors);

    R.section('(d) im nächsten eigenen Zug wieder erlaubt');
    await t.endTurn(); await t.endTurn();
    t.script.length = 0; wahl(t, 'lvl1');
    t.gs.activePlayer = 0; t.phase(2);
    const r3 = await t.run(() => t.host.doActivateCreatureEffect(t.room, 0, { heroIdx: 0, zoneSlot: 0 }));
    R.check('(d) Änderung im nächsten Zug angenommen, Stufe 1', r3 === true && lvl(t, g) === 1, [r3, lvl(t, g)]);
    R.check('(d) keine Engine-Fehler', t.errors.length === 0, t.errors);
  }

  R.section('(c) die Sperre gehört der geänderten KOPIE');
  {
    const t = await H.fresh({ hand: [[G, G], []] });
    t.setAbilities(0, 0, [Array(3).fill('Summoning Magic'), [], []]);
    wahl(t, 'lvl2');
    t.gs.activePlayer = 0; t.phase(2);
    await t.run(() => t.engine.doHandActivate(0, G, 1));          // die ZWEITE Kopie umstellen
    const p1 = await t.play(0, G, { hero: 0, slot: 0, noGrant: true, handIndex: 0 });   // die unveränderte spielen
    const gs1 = t.inst(c => c.name === G && c.zone === 'support');
    R.check('(c) erste Kopie (unverändert) liegt auf dem Brett', p1 === true && gs1.length === 1, [p1, gs1.length]);
    const a = gs1[0]; a.turnPlayed = 1;
    t.script.length = 0; wahl(t, 'lvl3');
    t.gs.activePlayer = 0; t.phase(2);
    const r1 = await t.run(() => t.host.doActivateCreatureEffect(t.room, 0, { heroIdx: 0, zoneSlot: 0 }));
    R.check('(c) die unveränderte Kopie darf auf dem Brett umstellen', r1 === true && lvl(t, a) === 3, [r1, lvl(t, a)]);
    const p2 = await t.play(0, G, { hero: 0, slot: 1, noGrant: true, handIndex: 0 });   // jetzt die in der Hand umgestellte Kopie
    const b = t.inst(c => c.name === G && c.zone === 'support' && c.id !== a.id)[0];
    R.check('(c) die in der Hand umgestellte Kopie liegt auf dem Brett', p2 === true && !!b, [p2, !!b]);
    if (b) {
      b.turnPlayed = 1;
      t.script.length = 0; wahl(t, 'lvl3');
      t.gs.activePlayer = 0; t.phase(2);
      const r2 = await t.run(() => t.host.doActivateCreatureEffect(t.room, 0, { heroIdx: 0, zoneSlot: 1 }));
      R.check('(c) ... und ist auf dem Brett im selben Zug gesperrt', r2 === false, r2);
    }
    R.check('(c) keine Engine-Fehler', t.errors.length === 0, t.errors);
  }

  R.section('(e) Brett zuerst: genau eine Änderung je Zug');
  {
    const t = await H.fresh({});
    const g = t.put(0, 0, 0, G); g.turnPlayed = 1;
    wahl(t, 'lvl2');
    t.gs.activePlayer = 0; t.phase(2);
    R.check('(e) Gegenprobe: vorher meldet der Client den Gnom als aktivierbar', (t.engine.getActivatableCreatures(0) || []).some(a => a.cardName === G && a.canActivate), t.engine.getActivatableCreatures(0));
    const r1 = await t.run(() => t.host.doActivateCreatureEffect(t.room, 0, { heroIdx: 0, zoneSlot: 0 }));
    t.script.length = 0; wahl(t, 'lvl3');
    const r2 = await t.run(() => t.host.doActivateCreatureEffect(t.room, 0, { heroIdx: 0, zoneSlot: 0 }));
    R.check('(e) erste Änderung ja, zweite im selben Zug nein; Stufe 2', r1 === true && r2 === false && lvl(t, g) === 2, [r1, r2, lvl(t, g)]);
    R.check('(e) keine Engine-Fehler', t.errors.length === 0, t.errors);
  }

  R.section('(f) Kartentext');
  {
    const cards = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../../data/cards.json'), 'utf8'));
    const list = Array.isArray(cards) ? cards : Object.values(cards.cards || cards);
    const eff = (list.find(c => c.name === G) || {}).effect || '';
    R.check('(f) Text nennt „while you control it", nicht mehr „your side of the board"', /while you control it/.test(eff) && !/your side of the board/.test(eff), eff);
  }

  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
