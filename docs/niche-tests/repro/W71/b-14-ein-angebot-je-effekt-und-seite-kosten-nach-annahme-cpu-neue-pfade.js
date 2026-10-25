'use strict';
// W71b-14 · Cool Rescuer Monia in den neu erfassten Pfaden: ein Angebot je Karte/Effekt und Seite · Kosten erst bei Annahme · Angebots-Text · CPU-Entscheidung
//
//  (A) Ein Angebot je Karte/Effekt UND Seite (W58a: je Karte/Effekt; W71b: Einzelfenster einer Kreatur lehnt nur SEINE Seite ab): ein Flächeneffekt, der zuerst die Kreatur des Gegners trifft (abgelehnt)
//      und dann Monias eigene, fragt noch einmal — höchstens zweimal, nie je Kreatur; angenommen → genau ein Angebot für den ganzen Effekt.
//  (B) „Kosten erst nach dem Commit": solange das Angebot offen ist, hat Monias Besitzer noch keine Karte abgeworfen; abgelehnt kostet nichts, angenommen genau 1 Karte, danach.
//  (C) Angebots-Text der neuen Fenster: Titel „… — Cool Rescue!", links die auslösende Karte (`triggerCardName`), Beschreibung mit Karte, Kreatur und Wirkung, genau eine Option „Protect <Kreatur> (discard 1)".
//  (D) CPU (Monia ohne Skript): nimmt Kontrollverlust/Bounce gegen die EIGENE Kreatur durch den GEGNER an (genügend Wert), lehnt Buff/Debuff mit geringem Wert, eigene Effekte und fremde Kreaturen ab; zahlt nie für einen Effekt mit unbekanntem Verursacher.
// Aufruf: node docs/niche-tests/repro/W71/b-14-….js   (Exit 0 = korrekt)
const S = require('../../lib/monia-sweep.js');
const { H } = S;
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(2); });

(async () => {
  const R = H.runner();
  for (const m of [0, 1]) {
    const o = 1 - m;

    // ═══ (A) ein Angebot je Seite ═══
    R.section(`Monia Sitz ${m} · (A) Pink Sky (alle Kreaturen beider Seiten) von Sitz ${o}: erste Seite abgelehnt → die zweite Seite wird noch gefragt`);
    {
      const { t } = await S.szene({ m, handO: ['Pink Sky'] });
      const log = [];
      t.script.unshift({ match: S.isMo, answer: (d) => { if (t.engine._inMctsSim) return null; log.push(d.options.map(x => x.id).join()); return log.length === 1 ? null : { optionId: d.options[0].id }; } });
      const vor = S.schnappschuss(t); const ids = Object.keys(vor);
      await t.play(o, 'Pink Sky', { hero: 0 });
      await S.ende(t, o);
      const seiten = new Set(log);
      R.check('genau 2 Angebote (eines je Seite), nie eines je Kreatur', log.length === 2 && seiten.size === 2, log);
      const negiert = (s) => t.engine.cardInstances.filter(c => c.zone === 'support' && (c.controller ?? c.owner) === s && c.name === 'ZZ Dummy Big' && c.counters.negated).length;
      const zweite = +log[1].slice(5), erste = +log[0].slice(5);
      R.check('die zweite Seite (angenommen) bleibt unberührt, die erste (abgelehnt) ist negiert', negiert(zweite) === 0 && negiert(erste) > 0, { erste, zweite, n: [negiert(0), negiert(1)] });
    }
    R.section(`Monia Sitz ${m} · (A) Pink Sky: gleich die erste Seite angenommen → kein zweites Angebot`);
    {
      const { t } = await S.szene({ m, handO: ['Pink Sky'] });
      const log = S.skript(t, 'ja');
      await t.play(o, 'Pink Sky', { hero: 0 });
      await S.ende(t, o);
      R.check('genau 1 Angebot für den ganzen Effekt', S.angebote(t).length === 1, S.angebote(t).length);
    }

    // ═══ (B) Kosten erst nach der Annahme ═══
    for (const antwort of ['nein', 'ja']) {
      R.section(`Monia Sitz ${m} · (B) Kosten erst bei Annahme — Monia ${antwort === 'ja' ? 'nimmt an' : 'lehnt ab'}`);
      const { t } = await S.szene({ m, handO: ['Dark Gear'] });
      let handBeiFrage = null, ablageBeiFrage = null;
      t.script.unshift({ match: S.isMo, answer: (d) => { if (t.engine._inMctsSim) return null; handBeiFrage = t.gs.players[m].hand.length; ablageBeiFrage = t.gs.players[m].discardPile.length; return antwort === 'ja' ? { optionId: d.options[0].id } : null; } });
      t.targetFn = (valid) => { const k = valid.find(v => v.type === 'equip' && v.owner === m); return k ? [k.id] : undefined; };
      const hand0 = t.gs.players[m].hand.length, abl0 = t.gs.players[m].discardPile.length;
      await t.play(o, 'Dark Gear', { hero: 0 });
      await S.ende(t, o);
      R.check('während das Angebot offen ist, ist noch nichts bezahlt (Hand und Ablage unverändert)', handBeiFrage === hand0 && ablageBeiFrage === abl0, { handBeiFrage, hand0, ablageBeiFrage, abl0 });
      R.check(antwort === 'ja' ? 'angenommen: danach genau 1 Handkarte weniger / 1 mehr in der Ablage' : 'abgelehnt: nichts bezahlt', antwort === 'ja' ? (t.gs.players[m].hand.length === hand0 - 1 && t.gs.players[m].discardPile.length === abl0 + 1) : (t.gs.players[m].hand.length === hand0 && t.gs.players[m].discardPile.length === abl0), { hand: [hand0, t.gs.players[m].hand.length], abl: [abl0, t.gs.players[m].discardPile.length] });
    }

    // ═══ (C) Angebots-Text ═══
    R.section(`Monia Sitz ${m} · (C) Angebots-Text der neuen Fenster (Dark Gear, Disruption Ray)`);
    for (const [karte, wer, hero] of [['Dark Gear', o, 0], ['Disruption Ray', o, 0]]) {
      const { t } = await S.szene({ m, handO: [karte] });
      S.skript(t, 'nein');
      t.targetFn = (valid) => { const k = valid.find(v => v.type === 'equip' && v.owner === m); return k ? [k.id] : undefined; };
      await t.play(wer, karte, { hero });
      const a = S.angebote(t)[0];
      R.check(`${karte}: Titel, Karte links (triggerCardName), Beschreibung mit Wirkung, eine Option`, a && /Cool Rescuer Monia — Cool Rescue!/.test(a.d.title) && a.d.triggerCardName === karte && new RegExp(karte).test(a.d.description) && /ZZ Dummy Big/.test(a.d.description) && /iscard 1 card/.test(a.d.description) && a.d.options.length === 1 && /Protect ZZ Dummy Big \(discard 1\)/.test(a.d.options[0].label) && a.d.cancellable === true,
        a && { title: a.d.title, trig: a.d.triggerCardName, desc: a.d.description, opt: a.d.options });
    }

    // ═══ (D) CPU ═══
    R.section(`Monia Sitz ${m} · (D) CPU-Entscheidung ohne Skript`);
    const cpu = async (karte, W, hero, opts = {}) => {
      const { t } = await S.szene({ m, handO: W === o ? [karte] : [], handM: W === m ? [karte] : [] });
      t.targetFn = (valid) => { const k = valid.find(v => v.type === 'equip' && v.owner === (opts.ziel ?? m)); return k ? [k.id] : undefined; };
      const abl0 = t.gs.players[m].discardPile.length;
      await t.play(W, karte, { hero });
      return { fragt: S.angebote(t).length, bezahlt: t.gs.players[m].discardPile.length - abl0 - (W === m ? 1 : 0) };
    };
    const dg = await cpu('Dark Gear', o, 0);
    R.check('Dark Gear (Kontrollverlust der eigenen Kreatur durch den Gegner): CPU nimmt an und zahlt 1 Karte', dg.fragt === 1 && dg.bezahlt === 1, dg);
    const dr = await cpu('Disruption Ray', o, 0);
    R.check('Disruption Ray (Debuff, geringer Wert): CPU lehnt ab', dr.fragt === 1 && dr.bezahlt === 0, dr);
    const eigen = await cpu('Cloud Pillow', m, 1, { ziel: m });
    R.check('eigener Cloud Pillow auf die eigene Kreatur: CPU lehnt ab (nie gegen den eigenen Effekt)', eigen.fragt === 1 && eigen.bezahlt === 0, eigen);
    const fremd = await cpu('Cloud Pillow', o, 0, { ziel: o });
    R.check('Cloud Pillow des Gegners auf SEINE Kreatur: CPU zahlt nichts (nie die Kreaturen des Gegners retten)', fremd.bezahlt === 0, fremd);
    {
      // Verursacher unbekannt (kein Besitzer): die CPU zahlt nie
      const { t } = await S.szene({ m });
      const k = t.engine.cardInstances.find(c => c.zone === 'support' && c.name === 'ZZ Dummy Big' && (c.controller ?? c.owner) === m);
      const abl0 = t.gs.players[m].discardPile.length;
      await t.run(() => t.engine.kreaturBetroffen(k, 'control', 'Mystery', {}));
      R.check('Effekt ohne bekannten Verursacher: CPU zahlt nie', t.gs.players[m].discardPile.length === abl0, t.gs.players[m].discardPile.length - abl0);
    }
  }
  R.finish();
})().catch(e => { process.stderr.write(String(e && e.stack || e) + '\n'); process.exit(2); });
