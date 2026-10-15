'use strict';
// W11c · Q85 (C05-08) · Gleichzeitiges Aus beider Seiten: ohne eigene Klausel gewinnt der Karten-Wirker
//
// ENTSCHIEDEN (Al, Welle 11, Q85): „Wenn nichts anderes angegeben ist, gewinnt der Karten-Wirker." Gilt für jeden Effekt ohne eigene
//   Klausel, der beide Seiten gleichzeitig auslöscht (The Spawn Mother „alles", Cataclysm, Flächenkarten). Karteneigene Klauseln
//   (`gs._drawLoserIdx`: Bunny Bombs „you lose", Armageddon „most Creatures wins") haben Vorrang. Zentral: `_engine.js` `checkAllHeroesDead`
//   (`draw_resolved`) mit `_kartenWirker()`. Ohne jede Karte (reiner Spielablauf) bleibt der alte Standard (Sitz 0 verliert).
// Geprüft (je beide Sitze): (a) The Spawn Mother „alles"-Modus, (b) Cataclysm (Spell, 100 auf alles), (c) gestohlene Spawn Mother
//   (Wirker = Kontrolleur/Dieb), (d) Armageddon mit Klausel: wer die meisten Kreaturen führt, gewinnt - auch gegen den Wirker.
//   Die Reihenfolgeregel aus Welle 9 („alle Gegner getötet" vor der Doom-Clock-Niederlage) bleibt unberührt (Repro W9).
const H = require('../../lib/h.js');

(async () => {
  const R = H.runner();

  R.section('(a) The Spawn Mother („alles"): der Wirker gewinnt, egal welcher Sitz');
  for (const seat of [0, 1]) {
    const hands = [[], []]; hands[seat] = ['The Spawn Mother'];
    const t = await H.fresh({ hand: hands, hp: 100, active: seat });
    t.script.push({ match: d => d.type === 'optionPicker', answer: () => ({ optionId: 'all' }) });
    await t.play(seat, 'The Spawn Mother', { hero: 0 });
    const o = t.engine.over;
    R.check(`Sitz ${seat} beschwört -> Sitz ${seat} gewinnt`, !!o && o.winnerIdx === seat && o.reason === 'draw_resolved', o);
    R.check(`Sitz ${seat}: Log nennt den Wirker (decidedBy caster)`, t.lg('draw_resolved').some(l => l.decidedBy === 'caster'), t.lg('draw_resolved'));
    R.check(`Sitz ${seat}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
  }

  R.section('(b) Cataclysm (Spell: 100 Schaden auf alle Ziele auf dem Brett)');
  for (const seat of [0, 1]) {
    const hands = [[], []]; hands[seat] = ['Cataclysm'];
    const t = await H.fresh({ hand: hands, hp: 100, active: seat });
    const r = await t.play(seat, 'Cataclysm', { hero: 0 });
    const o = t.engine.over;
    R.note(`Sitz ${seat} Spielergebnis`, [r, JSON.stringify(o)]);
    R.check(`Sitz ${seat} wirkt Cataclysm -> Sitz ${seat} gewinnt`, !!o && o.winnerIdx === seat, o);
    R.check(`Sitz ${seat}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
  }

  R.section('(c) Eine fremde Spawn Mother auf dem Brett ändert den Wirker nicht');
  {
    // Sitz 1 spielt seine Mutter; eine Mutter von Sitz 0 liegt schon auf dem Brett (gehört dem Gegner) - Wirker bleibt Sitz 1.
    const t = await H.fresh({ hand: [[], ['The Spawn Mother']], hp: 100, active: 1 });
    t.put(0, 0, 0, 'The Spawn Mother');
    t.script.push({ match: d => d.type === 'optionPicker', answer: () => ({ optionId: 'all' }) });
    await t.play(1, 'The Spawn Mother', { hero: 0 });
    const o = t.engine.over;
    R.check('Sitz 1 beschwört (fremde Mutter auf dem Brett) -> Sitz 1 gewinnt', !!o && o.winnerIdx === 1, o);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }

  R.section('(d) Karten-Klausel hat Vorrang: Armageddon (die meisten Kreaturen gewinnen)');
  for (const seat of [0, 1]) {
    const other = 1 - seat;
    const hands = [[], []]; hands[seat] = ['Armageddon'];
    const t = await H.fresh({ hand: hands, hp: 50, active: seat });
    // Der Gegner des Wirkers führt mehr Kreaturen (die Kreaturen sterben mit - gezählt wird vor dem Schlag).
    t.put(other, 0, 0, H.INERT.big); t.put(other, 0, 1, H.INERT.big);
    t.put(seat, 1, 0, H.INERT.big);
    await t.play(seat, 'Armageddon', { hero: 0 });
    const o = t.engine.over;
    R.note(`Sitz ${seat} wirkt Armageddon`, JSON.stringify(o));
    R.check(`Armageddon von Sitz ${seat}: der Sitz mit den meisten Kreaturen (Sitz ${other}) gewinnt, nicht der Wirker`, !!o && o.winnerIdx === other, o);
  }

  R.section('(e) Rangfolge des Wirkers (Einheitenprobe `_kartenWirker`)');
  {
    const t = await H.fresh({});
    const e = t.engine;
    e._currentEffectSource = null; e._rxResolvingOwner = undefined; e._activationSource = null;
    R.check('ohne Quelle: kein Wirker (Spielablauf; alter Standard)', e._kartenWirker() === null, e._kartenWirker());
    e._currentEffectSource = { cardName: 'X', owner: 0, cardType: 'Spell' };
    R.check('Spell-Quelle ohne Kette: deren Besitzer', e._kartenWirker() === 0, e._kartenWirker());
    e._rxResolvingOwner = 1;
    R.check('Kettenglied des Gegners löst gerade auf: dessen Besitzer', e._kartenWirker() === 1, e._kartenWirker());
    e._currentEffectSource = { cardName: 'Y', owner: 0, cardType: 'Creature', instId: 'abc' };
    R.check('Hook einer Brettkarte (instId) ist der innerste Verursacher', e._kartenWirker() === 0, e._kartenWirker());
    e._currentEffectSource = null; e._rxResolvingOwner = undefined;
    e._activationSource = { cardName: 'Z', owner: 1, turn: t.gs.turn };
    R.check('nur aktivierende Karte: deren Besitzer', e._kartenWirker() === 1, e._kartenWirker());
    e._activationSource = null;
  }

  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
