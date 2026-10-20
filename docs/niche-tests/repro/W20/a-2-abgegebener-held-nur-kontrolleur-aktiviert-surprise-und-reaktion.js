'use strict';
// W20a · Held unter fremder Kontrolle — Al (20.10.2026), kehrt W19b um (Regel A–D):
//  (A) Surprises der Zone und Hand-Reaktionszauber (Cure …) über den Helden: NUR der aktuelle Kontrolleur; der Besitzer nicht, solange ein anderer den Helden kontrolliert;
//      sobald er ihn wieder kontrolliert, darf er wieder — auch eine Surprise, die der Kontrolleur in die Zone gelegt hat (sie bleibt Karte ihres Legers).
//  (B) verdeckte Surprises gehen bei jedem Kontrollwechsel mit dem Helden mit.
//  (C) eine aufgedeckte Kreatur-Surprise gehört, solange sie faceup ist, dem Spieler, der sie aktiviert hat.
//  (D) der Besitzer setzt an seinem abgegebenen Helden nichts.
// Teil 1 Gold Trap („when your opponent would gain Gold through an effect“) — Sitz 0 = Besitzer von Held 0:0 samt Falle, Sitz 1 = Kontrolleur.
// Teil 2 Cure als Hand-Reaktion im Phasenfenster des Gegnerzugs; Teil 3 Kreatur-Surprise (Pure Advantage Camel).
const H = require('../../lib/h.js');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const fragen = (t, titel) => t.prompts.filter(p => p.d.title === titel).map(p => p.pi);
async function uebernehmen(t, v, ctrl = 1, besitzer = 0) {
  if (v === 'dauerhaft') { await t.engine.actionTakeHeroPermanently(ctrl, besitzer, 0); await sleep(300); }
  else if (v === 'temporaer') { await t.engine.actionStealHero(ctrl, besitzer, 0); await sleep(300); }   // Harness-Falle: onTakeControl läuft asynchron nach
}
(async () => {
  const R = H.runner();
  for (const v of ['dauerhaft', 'temporaer']) {
    R.section(`Teil 1 (${v}): Gold Trap in der Zone des abgegebenen Helden — nur der Kontrolleur löst aus`);
    {
      const t = await H.fresh({ gold: [100, 100] });
      t.putSurprise(0, 0, 'Gold Trap'); t.grantFor(0, 0, 'Gold Trap');
      await uebernehmen(t, v);
      R.check(`${v}: Held 0:0 steht unter Kontrolle von Sitz 1`, t.engine.heroSideOf(0, t.gs.players[0].heroes[0]) === 1, null);
      R.check('Fenster-Prüfung: der Besitzer darf die Surprise nicht aktivieren, der Kontrolleur schon',
        t.engine._canHeroActivateSurprise(0, 0, 'Gold Trap', { reaktor: 0 }) === false && t.engine._canHeroActivateSurprise(0, 0, 'Gold Trap') === false
        && t.engine._canHeroActivateSurprise(0, 0, 'Gold Trap', { reaktor: 1 }) === true, null);
      R.check('Sammler: Zone von 0:0 gehört zu den Surprises des Kontrolleurs, nicht des Besitzers',
        t.engine._getAllSurpriseEntries(1).some(e => e.seite === 0 && e.heroIdx === 0) && !t.engine._getAllSurpriseEntries(0).some(e => e.seite === 0 && e.heroIdx === 0), null);
      t.reset();
      await t.run(() => t.engine.actionGainGold(1, 30, { source: 'test' }));
      R.check(`${v}: Sitz 1 (Kontrolleur) gewinnt Gold → niemand wird gefragt (der Besitzer darf nicht, der Kontrolleur ist selbst der Gewinner)`, !t.prompts.some(p => p.d.title === 'Gold Trap'), t.prompts.map(p => [p.pi, p.d.title]));
      R.check(`${v}: Gold unverändert für Sitz 0 (100), Sitz 1 hat 130; die Falle liegt weiter in der Zone von 0:0`, t.gs.players[0].gold === 100 && t.gs.players[1].gold === 130 && t.gs.players[0].surpriseZones[0].includes('Gold Trap'), [t.gs.players[0].gold, t.gs.players[1].gold, t.gs.players[0].surpriseZones]);
      t.reset();
      await t.run(() => t.engine.actionGainGold(0, 30, { source: 'test' }));   // Sitz 0 gewinnt Gold → der Kontrolleur (Sitz 1) löst die Falle des übernommenen Helden aus
      R.check(`${v}: Sitz 0 gewinnt Gold → genau Sitz 1 (Kontrolleur) wird gefragt`, J(fragen(t, 'Gold Trap')) === '[1]', fragen(t, 'Gold Trap'));
      R.check(`${v}: Sitz 1 bekommt die 30 Gold, die Falle liegt in der Ablage ihres Besitzers (Sitz 0)`, t.gs.players[1].gold === 160 && t.gs.players[0].gold === 100 && t.pile(0, 'discardPile').includes('Gold Trap'), [t.gs.players[0].gold, t.gs.players[1].gold, t.pile(0, 'discardPile')]);
      R.check(`${v}: keine Engine-Fehler, Zustand sauber`, t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
    }
  }
  R.section('Teil 1: nach der Rückgabe löst der Besitzer wieder aus (dauerhafte Übernahme zurückgegeben)');
  {
    const t = await H.fresh({ gold: [100, 100] });
    t.putSurprise(0, 0, 'Gold Trap'); t.grantFor(0, 0, 'Gold Trap');
    await uebernehmen(t, 'dauerhaft');
    await t.engine.actionReturnHeroControl(0, 0); await sleep(300);
    R.check('Held 0:0 gehört wieder Sitz 0', t.engine.heroSideOf(0, t.gs.players[0].heroes[0]) === 0, null);
    t.reset();
    await t.run(() => t.engine.actionGainGold(1, 30, { source: 'test' }));
    R.check('Sitz 1 gewinnt Gold → genau Sitz 0 (Besitzer) wird gefragt', J(fragen(t, 'Gold Trap')) === '[0]', fragen(t, 'Gold Trap'));
    R.check('Sitz 0 bekommt die 30 Gold (130), Sitz 1 bleibt bei 100, Falle in der Ablage von Sitz 0', t.gs.players[0].gold === 130 && t.gs.players[1].gold === 100 && t.pile(0, 'discardPile').includes('Gold Trap'), [t.gs.players[0].gold, t.gs.players[1].gold, t.pile(0, 'discardPile')]);
  }
  R.section('Teil 1: temporäre Übernahme endet mit dem Zugwechsel → der Besitzer löst wieder aus');
  {
    const t = await H.fresh({ gold: [100, 100], active: 1 });
    t.putSurprise(0, 0, 'Gold Trap'); t.grantFor(0, 0, 'Gold Trap');
    await uebernehmen(t, 'temporaer');
    await t.endTurn(); await sleep(300);
    R.check('Held 0:0 gehört wieder Sitz 0', t.engine.heroSideOf(0, t.gs.players[0].heroes[0]) === 0, null);
    t.reset();
    const g0 = t.gs.players[0].gold;
    await t.run(() => t.engine.actionGainGold(1, 30, { source: 'test' }));
    R.check('Sitz 1 gewinnt Gold → Sitz 0 (Besitzer) wird gefragt und bekommt es', J(fragen(t, 'Gold Trap')) === '[0]' && t.gs.players[0].gold === g0 + 30, [fragen(t, 'Gold Trap'), g0, t.gs.players[0].gold]);
  }
  R.section('Teil 1: eine vom Kontrolleur gelegte Surprise darf der Besitzer auslösen, sobald er den Helden wieder kontrolliert (Karte bleibt die ihres Legers)');
  {
    const t = await H.fresh({ gold: [100, 100], active: 1, hand: [[], ['Gold Trap']], deckSize: 30 });
    await uebernehmen(t, 'dauerhaft');
    t.grantFor(0, 0, 'Gold Trap');   // Held 0:0 braucht die Schule der Surprise (Decay Magic 1)
    // Kontrolleur (Sitz 1) legt Gold Trap über den ECHTEN Spielweg in die Zone des übernommenen Helden 0:0
    t.phase(2); t.resetActions(1);
    const rSet = await t.run(() => t.host.doPlaySurprise(t.room, 1, { cardName: 'Gold Trap', handIndex: 0, heroIdx: 0, heroOwner: 0 }));
    R.check('Kontrolleur setzt Gold Trap in die Zone des übernommenen Helden 0:0', rSet === true && t.gs.players[0].surpriseZones[0].includes('Gold Trap'), [rSet, t.gs.players[0].surpriseZones]);
    const inst = t.find('Gold Trap', 'surprise');
    R.check('die Karte gehört dem Leger (originalOwner = Sitz 1), liegt auf der Brettseite von Sitz 0', inst && inst.originalOwner === 1 && inst.owner === 0, inst && [inst.owner, inst.originalOwner]);
    // (a) während der Übernahme darf der Besitzer sie nicht auslösen: Sitz 1 gewinnt Gold — für den Leger selbst ohnehin kein Auslöser („your opponent“); Sitz 0 gewinnt Gold → Sitz 1 darf
    R.check('während der Übernahme: der Besitzer (Sitz 0) darf nicht, der Kontrolleur (Sitz 1) darf', t.engine._canHeroActivateSurprise(0, 0, 'Gold Trap', { reaktor: 0 }) === false && t.engine._canHeroActivateSurprise(0, 0, 'Gold Trap', { reaktor: 1 }) === true, null);
    // (b) Rückgabe der Kontrolle
    await t.engine.actionReturnHeroControl(0, 0); await sleep(300);
    R.check('die Surprise liegt nach der Rückgabe unverändert in der Zone (ging mit dem Helden mit)', t.gs.players[0].surpriseZones[0].includes('Gold Trap'), t.gs.players[0].surpriseZones);
    R.check('nach der Rückgabe: der Besitzer darf auslösen', t.engine._canHeroActivateSurprise(0, 0, 'Gold Trap', { reaktor: 0 }) === true, null);
    t.reset();
    const g0 = t.gs.players[0].gold, g1 = t.gs.players[1].gold;
    await t.run(() => t.engine.actionGainGold(1, 30, { source: 'test' }));
    R.check('Sitz 1 gewinnt Gold → Sitz 0 (Besitzer des Helden) wird gefragt und löst die Falle seines Gegners aus', J(fragen(t, 'Gold Trap')) === '[0]', fragen(t, 'Gold Trap'));
    R.check('Sitz 0 bekommt die 30 Gold, Sitz 1 nicht', t.gs.players[0].gold === g0 + 30 && t.gs.players[1].gold === g1, [g0, t.gs.players[0].gold, g1, t.gs.players[1].gold]);
    R.check('die Karte bleibt die ihres Legers: sie liegt in der Ablage von Sitz 1, Zone leer', t.pile(1, 'discardPile').includes('Gold Trap') && !t.pile(0, 'discardPile').includes('Gold Trap') && t.gs.players[0].surpriseZones[0].length === 0, [t.pile(1, 'discardPile'), t.pile(0, 'discardPile'), t.gs.players[0].surpriseZones]);
    R.check('keine Engine-Fehler, Zustand sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }
  R.section('Teil 1 (D): der Besitzer setzt am abgegebenen Helden nichts');
  {
    const t = await H.fresh({ hand: [['Gold Trap'], []], deckSize: 30 });
    await uebernehmen(t, 'dauerhaft');
    t.grantFor(0, 0, 'Gold Trap'); t.grantFor(0, 1, 'Gold Trap');
    const r0 = await t.play(0, 'Gold Trap', { hero: 0 });
    R.check('Besitzer setzt an 0:0 nichts (abgelehnt, Karte bleibt auf der Hand, Zone leer)', r0 === false && t.pile(0, 'hand').includes('Gold Trap') && t.gs.players[0].surpriseZones[0].length === 0, [r0, t.pile(0, 'hand'), t.gs.players[0].surpriseZones]);
    const r1 = await t.play(0, 'Gold Trap', { hero: 1 });
    R.check('an 0:1 setzt er normal', r1 === true && t.gs.players[0].surpriseZones[1].includes('Gold Trap'), [r1, t.gs.players[0].surpriseZones]);
  }
  for (const v of ['dauerhaft', 'temporaer', 'normal']) {
    R.section(`Teil 2 (${v}): Hand-Reaktion Cure des Besitzers über den abgegebenen Helden`);
    const t = await H.fresh({ hand: [['Cure'], []], deckSize: 30, abilities: { 0: { 0: [['Support Magic'], [], []] } } });
    await uebernehmen(t, v);
    t.heroStatus(1, 1, 'burned');
    t.reset();
    t.script.push({ match: d => d.type === 'confirm' && /Cure/.test(d.title || ''), answer: () => ({ confirmed: true }) });
    await t.endTurn();   // Sitz 1 beginnt seinen Zug (Phasenfenster); die temporäre Übernahme würde hier erst enden — für ‚temporaer‘ wird sie vorher neu gesetzt (s. u.)
    if (v === 'temporaer') {
      // Der Zugwechsel hat die Charme-Marke beendet; Prüfung der Sperre daher im Zug des Kontrolleurs: neu übernehmen und das Fenster direkt fragen.
      t.reset(); await uebernehmen(t, 'temporaer');
      const hi = t.engine._rxHandCastingHero(0, 'Cure');
      R.check('temporär: Hand-Reaktionswirker des Besitzers — Held 0:0 ist es nicht (kein Wirker)', hi === -1, hi);
    } else if (v === 'dauerhaft') {
      R.check('dauerhaft: Sitz 0 (Besitzer) wird nicht nach Cure gefragt', !t.prompts.some(p => p.pi === 0 && /Cure/.test(p.d.title || '')), t.prompts.map(p => [p.pi, p.d.title]));
      R.check('dauerhaft: Burn von 1:1 bleibt, Cure bleibt auf der Hand von Sitz 0', !!t.gs.players[1].heroes[1].statuses?.burned && t.pile(0, 'hand').includes('Cure') && !t.pile(0, 'discardPile').includes('Cure'), [t.gs.players[1].heroes[1].statuses, t.pile(0, 'hand'), t.pile(0, 'discardPile')]);
    } else {
      R.check('normal: Sitz 0 wird nach Cure gefragt', t.prompts.some(p => p.pi === 0 && /Cure/.test(p.d.title || '')), t.prompts.map(p => [p.pi, p.d.title]));
      R.check('normal: Burn von 1:1 geheilt, Cure in der Ablage von Sitz 0', !t.gs.players[1].heroes[1].statuses?.burned && t.pile(0, 'discardPile').includes('Cure'), [t.gs.players[1].heroes[1].statuses, t.pile(0, 'discardPile')]);
    }
    R.check(`${v}: keine Engine-Fehler, Zustand sauber`, t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }
  R.section('Teil 2: der KONTROLLEUR wirkt Hand-Reaktionen über den übernommenen Helden (Jump in the River: seit W20c dauerhaft und temporär)');
  {
    const jump = H.loadCardEffect('Jump in the River');
    for (const v of ['dauerhaft', 'temporaer']) {
      const t = await H.fresh({ hand: [[], ['Cure', 'Jump in the River']], deckSize: 30, active: 1, abilities: { 0: { 0: [['Support Magic', 'Support Magic'], [], []] } } });
      t.grantFor(0, 0, 'Jump in the River');
      await uebernehmen(t, v);
      R.check(`${v}: Fenster-Prüfung Cure — Kontrolleur darf über 0:0 (Prädikat), Besitzer nicht`, t.engine._canHeroActivateSurprise(0, 0, 'Cure', { spellInHand: true, reaktor: 1 }) === true && t.engine._canHeroActivateSurprise(0, 0, 'Cure', { spellInHand: true, reaktor: 0 }) === false && t.engine._canHeroActivateSurprise(0, 0, 'Cure', { spellInHand: true }) === false, null);
      const kand = t.engine._rxCastKandidaten(t.gs.players[1], 'Jump in the River', jump).map(c => c.casterSeite + ':' + c.casterIdx);
      const kandB = t.engine._rxCastKandidaten(t.gs.players[0], 'Jump in the River', jump).map(c => c.casterSeite + ':' + c.casterIdx);
      // W20c (Al 20.10.): Reactions gelten für JEDEN kontrollierten Helden, dauerhaft ODER temporär (vorher nur dauerhaft, Karten-Schalter `fremdeWirker`).
      R.check(`${v}: Wirker-Kandidaten für Jump in the River: Kontrolleur enthält 0:0 (dauerhaft und temporär), Besitzer nie`, kand.includes('0:0') && !kandB.includes('0:0'), [kand, kandB]);
    }
  }
  R.section('Teil 2: nach der Rückgabe wirkt der Besitzer wieder (Fenster-Prüfung)');
  {
    const t = await H.fresh({ hand: [['Cure'], []], deckSize: 30, abilities: { 0: { 0: [['Support Magic'], [], []] } } });
    await uebernehmen(t, 'dauerhaft');
    R.check('übernommen: kein Wirker für den Besitzer', t.engine._rxHandCastingHero(0, 'Cure') === -1, t.engine._rxHandCastingHero(0, 'Cure'));
    await t.engine.actionReturnHeroControl(0, 0); await sleep(300);
    R.check('zurückgegeben: Held 0:0 ist wieder Wirker', t.engine._rxHandCastingHero(0, 'Cure') === 0, t.engine._rxHandCastingHero(0, 'Cure'));
  }
  R.section('Teil 2: Frozen/Silenced sperren auch den Kontrolleur (Reaktion über den übernommenen Helden)');
  {
    const t = await H.fresh({ hand: [[], ['Cure']], deckSize: 30, abilities: { 0: { 0: [['Support Magic'], [], []] } } });
    await t.engine.actionTakeHeroPermanently(1, 0, 0); await sleep(300);
    t.heroStatus(0, 0, 'frozen');
    R.check('eingefroren: der Kontrolleur wirkt über 0:0 keine Reaktion', t.engine._canHeroActivateSurprise(0, 0, 'Cure', { spellInHand: true, reaktor: 1 }) === false, null);
    delete t.gs.players[0].heroes[0].statuses.frozen;
    t.heroStatus(0, 0, 'magic_silenced');
    R.check('magic_silenced: Zauber-Reaktion gesperrt', t.engine._canHeroActivateSurprise(0, 0, 'Cure', { spellInHand: true, reaktor: 1 }) === false, null);
  }
  R.section('Teil 3 (C): Kreatur-Surprise — Pure Advantage Camel gehört dem Aktivierenden');
  {
    // a) Kontrolleur aktiviert (dauerhafte Übernahme erlaubt das Beschwören): Sitz 0 zieht außerhalb seiner Resource Phase → Sitz 1 löst die Camel in der Zone von 0:0 aus
    const t = await H.fresh({ deckSize: 30, active: 0, hand: [[], []] });
    t.putSurprise(0, 0, 'Pure Advantage Camel'); t.grantFor(0, 0, 'Pure Advantage Camel');
    await t.engine.actionTakeHeroPermanently(1, 0, 0); await sleep(300);
    R.check('abgegeben: der Besitzer darf die Kreatur-Surprise nicht aktivieren, der Kontrolleur schon (Recht beschwoeren der Übernahme)',
      t.engine._canHeroActivateSurprise(0, 0, 'Pure Advantage Camel', { reaktor: 0 }) === false && t.engine._canHeroActivateSurprise(0, 0, 'Pure Advantage Camel', { reaktor: 1 }) === true, null);
    t.reset(); t.phase(3);
    await t.run(async () => { await t.engine.actionDrawCards(0, 1); await t.engine._flushSurpriseDrawChecks(); });   // Sitz 0 zieht in der Aktionsphase („your opponent draws … outside their Resource Phase“ aus Sicht von Sitz 1)
    const camel = t.find('Pure Advantage Camel', 'support');
    R.check('a) die Kamel steht aufgedeckt auf dem Brett (Support Zone von 0:0)', !!camel && !camel.faceDown, camel && [camel.zone, camel.faceDown]);
    R.check('a) Brettseite = Sitz 0, Kontrolleur UND Besitz der aufgedeckten Kreatur = Sitz 1 (Aktivierender)', !!camel && t.engine.physicalSide(camel) === 0 && camel.controller === 1 && t.engine.kartenBesitzerVon(camel) === 1, camel && [t.engine.physicalSide(camel), camel.controller, t.engine.kartenBesitzerVon(camel)]);
    R.check('a) Sitz 1 hat die Karte gezogen (Effekt für den Aktivierenden), Sitz 0 nur den ausgelösten Zug', t.pile(1, 'hand').length === 1, [t.pile(1, 'hand'), t.pile(0, 'hand')]);
    R.check('a) keine Engine-Fehler, Zustand sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }
  {
    // b) Besitzer aktiviert eine vom Kontrolleur gelegte Kreatur-Surprise nach der Rückgabe: Besitz = Besitzer (Aktivierender)
    const t = await H.fresh({ deckSize: 30, active: 0, hand: [[], []] });
    t.putSurprise(0, 0, 'Pure Advantage Camel'); t.grantFor(0, 0, 'Pure Advantage Camel');
    const inst = t.find('Pure Advantage Camel', 'surprise');
    inst.originalOwner = 1;   // vom Kontrolleur gelegt (wie `doPlaySurpriseFremd`)
    t.reset(); t.phase(3);
    await t.run(async () => { await t.engine.actionDrawCards(1, 1); await t.engine._flushSurpriseDrawChecks(); });   // Sitz 1 zieht in der Aktionsphase → Sitz 0 (Besitzer, kontrolliert seinen Helden wieder) löst aus
    const camel = t.find('Pure Advantage Camel', 'support');
    R.check('b) die Kamel steht aufgedeckt auf dem Brett', !!camel && !camel.faceDown, camel && [camel.zone, camel.faceDown]);
    R.check('b) Besitz und Kontrolle der aufgedeckten Kreatur = Sitz 0 (Aktivierender), obwohl Sitz 1 die Karte gelegt hat', !!camel && camel.controller !== 1 && t.engine.kartenBesitzerVon(camel) === 0, camel && [camel.controller, camel.originalOwner, camel.owner]);
    R.check('b) keine Engine-Fehler, Zustand sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }
  R.finish();
})().catch(e => { process.stdout.write('AUSNAHME ' + (e && e.stack) + '\n'); process.exit(1); });
function J(x) { return JSON.stringify(x); }
