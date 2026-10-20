'use strict';
// W33a · Punkt 0 · Al, 22.10.2026: „Weakening Crystal noch nachziehen!" (offen aus W31a: „Status `negated` hängt an der Spalte des Halters")
// Kartentext: „While this card is in your hand, the effects of all your Heroes are negated. This counts as a negative status effect."
// REGEL: „all YOUR Heroes" = die Helden, die der Halter des Kristalls GERADE KONTROLLIERT (`heroSideOf`), nicht die Spalte der Hand. Bei jedem Kontrollwechsel (Charme, Diebstahl,
//   dauerhafte Übernahme, Rückgabe, Zugende-Rückfall) wandert die Negierung SOFORT mit: die des bisherigen Kontrolleurs fällt, die des neuen (liegt bei ihm ein Kristall in der Hand) wird angelegt.
//   Ausnahmen wie bisher: Karian (W13c), Zustandsimmunität (W14a Q11), Big Gwen Guard; neu: ein übernommener Held, der durch die Kontrolle ausdrücklich gegen die EIGENEN Karten des Kontrolleurs
//   immun ist (Charme Lv3 `actionStealHero`, W31a), bekommt sie nicht (zählt als negativer Status). Ohne Kontrollwechsel ändert sich nichts (Gegenproben).
// Aufbau je Halter-Sitz h (0/1), Gegner o: h hält den Kristall; Helden h:0/h:1/h:2 und o:0/o:1/o:2 (Platzhalter).
// Aufruf: node docs/niche-tests/repro/W33/a-00-weakening-crystal-folgt-der-kontrolle.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const WC = 'Weakening Crystal';
const F = H.INERT.filler;
const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;

async function aufbau(h, o = {}) {
  const hand = [[], []];
  hand[h] = [WC];
  if (o.beide) hand[1 - h] = [WC];
  const t = await H.fresh({ hand, deck: [Array(30).fill(F), Array(30).fill(F)], active: o.active ?? h });
  t.engine._refreshWeakeningCrystalNegation({ reapply: true });   // wie beim Eintritt in die Hand
  return t;
}
const neg = (t, s, hi) => !!t.hero(s, hi).statuses?.negated;
const negKr = (t, s, hi) => !!t.hero(s, hi).statuses?.negated?._byWeakeningCrystal;
const zeige = (t) => [0, 1].map(s => [0, 1, 2].map(hi => neg(t, s, hi) ? 'N' : '-').join('')).join(' | ');

(async () => {
  const R = H.runner();
  for (const h of [0, 1]) {
    const o = 1 - h;

    R.section(`Halter Sitz ${h} · Gegenprobe ohne Kontrollwechsel`);
    { const t = await aufbau(h);
      R.check(`h${h}: alle drei Helden des Halters negiert, die des Gegners nicht`, [0, 1, 2].every(i => neg(t, h, i)) && [0, 1, 2].every(i => !neg(t, o, i)), zeige(t));
      t.engine.sync();
      R.check(`h${h}: nach sync unverändert`, [0, 1, 2].every(i => neg(t, h, i)) && [0, 1, 2].every(i => !neg(t, o, i)), zeige(t));
      // Heilung gilt bis zum nächsten Rundenbeginn (v1103) – kein Kontrollwechsel, also keine Neuanlage durch sync
      await t.run(() => t.engine.removeHeroStatus(h, 1, 'negated', {}));
      t.engine.sync();
      R.check(`h${h}: geheilte Negierung bleibt bis zum nächsten Rundenbeginn weg (sync legt nicht neu an)`, !neg(t, h, 1) && neg(t, h, 0) && neg(t, h, 2), zeige(t));
      t.setHand(h, [F]); t.engine.sync();
      R.check(`h${h}: Kristall weg → Negierung fällt sofort`, [0, 1, 2].every(i => !neg(t, h, i)), zeige(t));
      R.check(`h${h}: sauber`, sauber(t), { e: t.errors, a: t.audit() }); }

    R.section(`Halter Sitz ${h} · eigener Held an den Gegner abgegeben`);
    for (const art of ['temporaer', 'dauerhaft']) {
      const t = await aufbau(h);
      if (art === 'temporaer') await t.run(() => t.engine.actionStealHero(o, h, 0));
      else await t.run(() => t.engine.actionTakeHeroPermanently(o, h, 0));
      await sleep(250);
      R.check(`h${h}/${art}: abgegebener Held ${h}:0 ist NICHT mehr negiert (der Halter kontrolliert ihn nicht), ${h}:1/${h}:2 bleiben`, !neg(t, h, 0) && neg(t, h, 1) && neg(t, h, 2), zeige(t));
      R.check(`h${h}/${art}: der Gegner hat keinen Kristall → ${h}:0 bleibt frei`, !neg(t, h, 0), zeige(t));
      // Rückgabe
      if (art === 'dauerhaft') { await t.run(() => t.engine.actionReturnHeroControl(h, 0)); await sleep(100); }
      else { await t.endTurn(); await sleep(100); }
      R.check(`h${h}/${art}: Held zurück (${art === 'dauerhaft' ? 'actionReturnHeroControl' : 'Zugwechsel'}) → ${h}:0 sofort wieder negiert`, neg(t, h, 0) && negKr(t, h, 0), zeige(t));
      R.check(`h${h}/${art}: sauber`, sauber(t), { e: t.errors, a: t.audit() });
    }

    R.section(`Halter Sitz ${h} · Gegnerheld übernommen`);
    { // temporär (Charme Lv3: „unaffected by other cards and effects" – immun auch gegen die eigenen Karten)
      const t = await aufbau(h);
      await t.run(() => t.engine.actionStealHero(h, o, 0)); await sleep(250);
      R.check(`h${h}/temporär: Charme-geschützter Gegnerheld ${o}:0 bekommt die Negierung nicht (zählt als negativer Status, Charme schützt)`, !neg(t, o, 0), zeige(t));
      R.check(`h${h}/temporär: eigene Helden bleiben negiert, die anderen Gegnerhelden frei`, [0, 1, 2].every(i => neg(t, h, i)) && !neg(t, o, 1) && !neg(t, o, 2), zeige(t));
      R.check(`h${h}/temporär: sauber`, sauber(t), { e: t.errors, a: t.audit() }); }
    { // dauerhaft
      const t = await aufbau(h);
      await t.run(() => t.engine.actionTakeHeroPermanently(h, o, 0)); await sleep(250);
      R.check(`h${h}/dauerhaft: übernommener Gegnerheld ${o}:0 ist sofort negiert (Kristall des Kontrolleurs, Marke `
        + `_wcFor=${h})`, neg(t, o, 0) && t.hero(o, 0).statuses.negated._wcFor === h, zeige(t));
      R.check(`h${h}/dauerhaft: die gleich indizierte eigene Spalte ist unberührt/negiert wie vorher`, [0, 1, 2].every(i => neg(t, h, i)) && !neg(t, o, 1) && !neg(t, o, 2), zeige(t));
      await t.run(() => t.engine.actionReturnHeroControl(o, 0)); await sleep(100);
      R.check(`h${h}/dauerhaft: Rückgabe → ${o}:0 sofort wieder frei (der Besitzer hat keinen Kristall)`, !neg(t, o, 0), zeige(t));
      R.check(`h${h}/dauerhaft: sauber`, sauber(t), { e: t.errors, a: t.audit() }); }
    { // Kristall kommt NACH der Übernahme in die Hand (echter Eintritt): wirkt auf den dauerhaft übernommenen Gegnerhelden
      const t = await H.fresh({ hand: [[], []], deck: [Array(30).fill(F), Array(30).fill(F)], active: h });
      await t.run(() => t.engine.actionTakeHeroPermanently(h, o, 0)); await sleep(250);
      R.check(`h${h}/Eintritt: vor dem Kristall ist nichts negiert`, !neg(t, o, 0) && !neg(t, h, 0), zeige(t));
      t.gs.players[h].hand.push(WC);
      t.engine._autoRevealOnEnterHand(h, t.gs.players[h].hand.length - 1, WC);
      R.check(`h${h}/Eintritt: Kristall tritt in die Hand → eigene Helden UND der dauerhaft übernommene ${o}:0 negiert, ${o}:1/${o}:2 nicht`, [0, 1, 2].every(i => neg(t, h, i)) && neg(t, o, 0) && !neg(t, o, 1) && !neg(t, o, 2), zeige(t));
      R.check(`h${h}/Eintritt: sauber`, sauber(t), { e: t.errors, a: t.audit() }); }

    R.section(`Halter Sitz ${h} · beide Seiten halten einen Kristall`);
    { // der Gegner hält ebenfalls einen: sein eigener Held, den der Halter dauerhaft übernimmt, folgt dem Kristall des neuen Kontrolleurs
      const t = await aufbau(h, { beide: true });
      t.engine._refreshWeakeningCrystalNegation({ reapply: true });
      R.check(`h${h}/beide: Normalfall – jeder hält seine eigenen Helden negiert`, [0, 1, 2].every(i => neg(t, h, i) && neg(t, o, i)), zeige(t));
      await t.run(() => t.engine.actionTakeHeroPermanently(h, o, 0)); await sleep(250);
      R.check(`h${h}/beide: ${o}:0 dauerhaft von ${h} übernommen → bleibt negiert, jetzt durch den Kristall von ${h} (_wcFor=${h}), nicht mehr den des Besitzers`, neg(t, o, 0) && t.hero(o, 0).statuses.negated._wcFor === h, t.hero(o, 0).statuses.negated);
      t.setHand(h, [F]); t.engine.sync();
      R.check(`h${h}/beide: Kristall von ${h} weg → ${o}:0 ist frei (der Kristall des Besitzers ${o} gilt für den Helden nicht, er kontrolliert ihn nicht)`, !neg(t, o, 0) && neg(t, o, 1) && neg(t, o, 2), zeige(t));
      await t.run(() => t.engine.actionReturnHeroControl(o, 0)); await sleep(100);
      R.check(`h${h}/beide: Rückgabe → der Kristall des Besitzers ${o} negiert ${o}:0 sofort wieder`, neg(t, o, 0) && t.hero(o, 0).statuses.negated._wcFor === o, zeige(t));
      R.check(`h${h}/beide: sauber`, sauber(t), { e: t.errors, a: t.audit() }); }
    { // Charme (temporär) ÜBER den Kristall des Besitzers: die Negierung des Besitzers fällt (Charme-Held wird vom Dieb kontrolliert, der keinen Kristall hat)
      const t = await aufbau(h, { beide: true });
      await t.run(() => t.engine.actionStealHero(h, o, 0)); await sleep(250);
      R.check(`h${h}/beide/temporär: ${o}:0 gecharmt → die Negierung des Besitzers ${o} fällt sofort, der Charme-Schutz hält die des Diebs ${h} ab`, !neg(t, o, 0) && neg(t, o, 1) && neg(t, o, 2), zeige(t));
      R.check(`h${h}/beide/temporär: sauber`, sauber(t), { e: t.errors, a: t.audit() }); }

    R.section(`Halter Sitz ${h} · Ausnahmen bleiben (Karian, Zustandsimmunität)`);
    { // Karian als dauerhaft übernommener Gegnerheld: nie negiert (W13c)
      const t = await aufbau(h);
      t.setHero(o, 0, 'Grand Inquisitor Karian', 800);
      await t.run(() => t.engine.actionTakeHeroPermanently(h, o, 0)); await sleep(250);
      t.engine._refreshWeakeningCrystalNegation({ reapply: true });
      R.check(`h${h}/Karian: übernommener Karian wird nicht negiert (W13c), die eigenen Helden schon`, !neg(t, o, 0) && [0, 1, 2].every(i => neg(t, h, i)), zeige(t));
      R.check(`h${h}/Karian: sauber`, sauber(t), { e: t.errors, a: t.audit() }); }
    { // Zustandsimmunität (negative_status_immune) am übernommenen Helden: keine Negierung (W14a Q11)
      const t = await aufbau(h);
      t.hero(o, 0).buffs = { ...(t.hero(o, 0).buffs || {}), negative_status_immune: { appliedTurn: t.gs.turn } };
      await t.run(() => t.engine.actionTakeHeroPermanently(h, o, 0)); await sleep(250);
      R.check(`h${h}/Immunität: übernommener Held mit Zustandsimmunität bleibt frei`, !neg(t, o, 0), zeige(t));
      R.check(`h${h}/Immunität: sauber`, sauber(t), { e: t.errors, a: t.audit() }); }
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
