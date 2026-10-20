'use strict';
// W19b · Held unter fremder Kontrolle — Al (19.10.2026): „ja [Zauber und Attacken wirken], und auch Surprises aktivieren".
// Auslegung (a): Ein vom Gegner kontrollierter Held bleibt für seinen BESITZER handlungsfähig; neu darf der Besitzer auch die Surprise aktivieren, die in der
//   Surprise Zone DIESES Helden liegt (bisher: nur der Kontrolleur). Das Setzen neuer Surprises am abgegebenen Helden bleibt verboten (Ruling 29.9., s. b-4).
// Aufbau: Sitz 0 hat in der Surprise Zone seines Helden 0 verdeckt „Gold Trap" (Decay Magic 1: Activate when your opponent would gain Gold through an effect).
//   Sitz 1 übernimmt Held 0:0 (a: dauerhaft/Paraseed-Art `actionTakeHeroPermanently`, b: temporär/Charme-Art `actionStealHero`).
//   Sitz 1 gewinnt per Effekt 30 Gold (`actionGainGold`).
// ★ W20a (Al, 20.10.2026) UMGESTELLT: Al hat W19b umgekehrt („nur der aktuelle Kontrolleur“). Erwartet jetzt: Sitz 0 (Besitzer) wird NICHT gefragt, solange Sitz 1 den Helden kontrolliert
//   (Sitz 1 ist hier selbst der Gewinner, also löst niemand aus: Gold bei Sitz 1, Falle bleibt liegen); normal (ohne Kontrollwechsel) fragt Sitz 0 wie immer. Siehe W20/a-2 für die volle Matrix.
// Gegenproben: c) Normalspiel ohne Kontrollwechsel unverändert (Besitzer wird gefragt); d) der KONTROLLEUR darf die Surprise weiter auslösen (Sitz 0 gewinnt Gold →
//   Sitz 1 wird gefragt und bekommt es); e) eine vom Kontrolleur selbst in die Zone gelegte Karte (`originalOwner` = Kontrolleur) löst der Besitzer NICHT aus.
const H = require('../../lib/h.js');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function szene(variante) {
  const t = await H.fresh({ gold: [100, 100] });
  t.putSurprise(0, 0, 'Gold Trap'); t.grantFor(0, 0, 'Gold Trap');
  if (variante === 'dauerhaft') { await t.engine.actionTakeHeroPermanently(1, 0, 0); await sleep(300); }
  else if (variante === 'temporaer') { await t.engine.actionStealHero(1, 0, 0); await sleep(300); }   // Harness-Falle: onTakeControl läuft asynchron nach
  return t;
}
(async () => {
  const R = H.runner();
  for (const v of ['dauerhaft', 'temporaer', 'normal']) {
    R.section(`Besitzer-Aktivierung: ${v}`);
    const t = await szene(v);
    const h0 = t.gs.players[0].heroes[0];
    if (v !== 'normal') R.check(`${v}: Held 0:0 steht unter Kontrolle von Sitz 1`, t.engine.heroSideOf(0, h0) === 1, t.engine.heroSideOf(0, h0));
    t.reset();
    await t.run(() => t.engine.actionGainGold(1, 30, { source: 'test' }));
    const fragen = t.prompts.filter(p => p.d.title === 'Gold Trap').map(p => p.pi);
    if (v === 'normal') {
      R.check('normal: genau Sitz 0 (Besitzer) wird nach der Gold Trap gefragt', fragen.length === 1 && fragen[0] === 0, fragen);
      R.check('normal: Sitz 0 bekommt die 30 Gold (130), Sitz 1 bleibt bei 100', t.gs.players[0].gold === 130 && t.gs.players[1].gold === 100, [t.gs.players[0].gold, t.gs.players[1].gold]);
      R.check('normal: Gold Trap liegt in der Ablage des Besitzers, Zone leer', t.pile(0, 'discardPile').includes('Gold Trap') && t.gs.players[0].surpriseZones[0].length === 0, [t.pile(0, 'discardPile'), t.gs.players[0].surpriseZones]);
    } else {
      R.check(`${v}: der Besitzer wird NICHT gefragt (W20a: nur der Kontrolleur; er ist selbst der Gewinner)`, fragen.length === 0, fragen);
      R.check(`${v}: Gold: Sitz 0 bleibt bei 100, Sitz 1 bekommt die 30 (130); die Falle bleibt in der Zone`, t.gs.players[0].gold === 100 && t.gs.players[1].gold === 130 && t.gs.players[0].surpriseZones[0].includes('Gold Trap'), [t.gs.players[0].gold, t.gs.players[1].gold, t.gs.players[0].surpriseZones]);
    }
    R.check(`${v}: keine Engine-Fehler, Zustand sauber`, t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }
  R.section('Gegenprobe d): der Kontrolleur löst die Surprise weiter aus');
  {
    const t = await szene('dauerhaft');
    t.reset();
    await t.run(() => t.engine.actionGainGold(0, 30, { source: 'test' }));   // Sitz 0 (Besitzer) gewinnt Gold → Sitz 1 kontrolliert Held 0:0 samt Falle
    const fragen = t.prompts.filter(p => p.d.title === 'Gold Trap').map(p => p.pi);
    R.check('d: Sitz 1 (Kontrolleur) wird gefragt, Sitz 0 nicht', fragen.length === 1 && fragen[0] === 1, fragen);
    R.check('d: Sitz 1 bekommt die 30 Gold, die Falle liegt in der Ablage ihres Besitzers (Sitz 0)', t.gs.players[1].gold === 130 && t.gs.players[0].gold === 100 && t.pile(0, 'discardPile').includes('Gold Trap'), [t.gs.players[0].gold, t.gs.players[1].gold, t.pile(0, 'discardPile')]);
    R.check('d: keine Engine-Fehler, Zustand sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }
  R.section('Gegenprobe e): vom Kontrolleur gelegte Karte — der Besitzer löst sie erst nach der Rückgabe aus');
  {
    const t = await szene('dauerhaft');
    const inst = t.find('Gold Trap', 'surprise');
    inst.originalOwner = 1;   // wie `doPlaySurpriseFremd`: die Karte gehört dem Kontrolleur
    t.reset();
    await t.run(() => t.engine.actionGainGold(1, 30, { source: 'test' }));
    R.check('e: während der Übernahme wird niemand gefragt', !t.prompts.some(p => p.d.title === 'Gold Trap'), t.prompts.map(p => [p.pi, p.d.title]));
    R.check('e: Gold unverändert für Sitz 0, Falle bleibt liegen', t.gs.players[0].gold === 100 && t.gs.players[1].gold === 130 && t.gs.players[0].surpriseZones[0].includes('Gold Trap'), [t.gs.players[0].gold, t.gs.players[1].gold]);
    await t.engine.actionReturnHeroControl(0, 0); await sleep(300);
    t.reset();
    await t.run(() => t.engine.actionGainGold(1, 30, { source: 'test' }));
    R.check('e: nach der Rückgabe wird der Besitzer gefragt und bekommt das Gold', t.prompts.some(p => p.pi === 0 && p.d.title === 'Gold Trap') && t.gs.players[0].gold === 130, [t.prompts.map(p => [p.pi, p.d.title]), t.gs.players[0].gold]);
  }
  R.finish();
})().catch(e => { process.stdout.write('AUSNAHME ' + (e && e.stack) + '\n'); process.exit(1); });
