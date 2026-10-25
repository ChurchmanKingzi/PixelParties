'use strict';
// W71b-02 · Cool Rescuer Monia: ÜBERNAHMEN öffnen das Fenster (Al, 25.10.2026: „Laut Testern fehlen mindestens Racket Arrow und Dark Gear")
//
// „take permanent control of it" (Dark Gear), Diplomacy, Capture, Cute Conversion, Deepsea Succubus, Kidnapping/Capture Net („add it to your hand"): jede Übernahme ist ein Effekt auf die Kreatur.
// Vorher fragte Monia nur bei Schaden, Zerstören, Gift/Status, Heilung und `actionMoveCard`; Kontrollwechsel (`actionTransferCreature`, `actionStealCreature`) hatte kein Fenster.
// Jetzt fragen `actionTransferCreature` / `actionStealCreatureGefragt` (Effektart 'control', `engine.kreaturBetroffen`) — NACH Immunität, Tor und Regeln, VOR der Änderung; die Kosten der Karte sind bezahlt
// (Dark Gear/Diplomacy: Gold), wenn Monia negiert: Kreatur bleibt wo sie ist.
//
// Je Karte × Monia auf Sitz 0/1 × Wirker = Gegner von Monia / Monias Besitzer × Monia lehnt ab / nimmt an:
//   · genau 1 Angebot, `triggerCardName` = die Karte · abgelehnt: Kreatur gewechselt (Kontrolle/Hand), Monias Hand unberührt · angenommen: kein Kreaturzustand verändert, genau 1 Handkarte weg
// Aufruf: node docs/niche-tests/repro/W71/b-02-….js   (Exit 0 = korrekt; auf dem Stand vor W71b rot)
const S = require('../../lib/monia-sweep.js');
const { H, DB } = S;
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(2); });

// Definitionen: spiel(t, W, hero) führt die Karte aus; `hand` = Handkarten des Wirkers; `karten` = wie viele Karten des Wirkers dabei die Hand verlassen
const DEFS = [
  { name: 'Dark Gear', hand: ['Dark Gear'], karten: 1, spiel: (t, W, h) => t.play(W, 'Dark Gear', { hero: h }) },
  { name: 'Diplomacy', abilities: ['Diplomacy'], karten: 0, spiel: async (t, W, h) => { t.gs.activePlayer = W; t.phase(2); await t.run(() => t.host.doActivateFreeAbility(t.room, W, { heroIdx: h, zoneIdx: 0 })); } },
  { name: 'Capture', hand: ['Capture'], karten: 1, spiel: (t, W, h) => t.play(W, 'Capture', { hero: h }) },
  { name: 'Cute Conversion', hand: ['Cute Conversion'], karten: 1, spiel: (t, W, h) => t.play(W, 'Cute Conversion', { hero: h }) },
  { name: 'Deepsea Succubus', hand: ['Deepsea Succubus'], karten: 1, spiel: (t, W, h) => t.play(W, 'Deepsea Succubus', { hero: h, slot: 2 }) },
  { name: 'Kidnapping', hand: ['Kidnapping'], karten: 1, zurHand: true, spiel: (t, W, h) => t.play(W, 'Kidnapping', { hero: h }) },
  { name: 'Capture Net', hand: ['Capture Net'], karten: 1, zurHand: true, spiel: (t, W, h) => t.play(W, 'Capture Net', { hero: h }) },
];

(async () => {
  const R = H.runner();
  for (const def of DEFS) {
    for (const m of [0, 1]) {
      const o = 1 - m;
      for (const wirker of ['gegner', 'eigen']) {
        const W = wirker === 'gegner' ? o : m, V = 1 - W, hero = wirker === 'gegner' ? 0 : 1;
        for (const antwort of ['nein', 'ja']) {
          R.section(`${def.name} · Monia Sitz ${m} · Wirker Sitz ${W} (${wirker === 'gegner' ? 'Gegner' : 'Monias Besitzer'}) auf Sitz ${V} · Monia ${antwort === 'ja' ? 'nimmt an' : 'lehnt ab'}`);
          const sc = await S.szene({ m, handM: W === m ? (def.hand || []) : [], handO: W === o ? (def.hand || []) : [] });
          const { t } = sc;
          if (def.abilities) t.setAbilities(W, hero, [def.abilities, [], []]);
          const log = S.skript(t, antwort, V);
          // Zonenwahl für die übernommene Kreatur: die erste freie Zone des Wirkers
          t.script.push({ match: d => d && d.type === 'zonePick', answer: () => { const sz = t.gs.players[W].supportZones; for (let hi = 0; hi < 3; hi++) for (let si = 0; si < 3; si++) if (((sz[hi] || [])[si] || []).length === 0) return { heroIdx: hi, slotIdx: si }; return null; } });
          t.targetFn = (valid, config) => {
            const need = Math.max(1, (config && (config.minTargets || config.minRequired)) || 1);
            const kre = valid.filter(v => v.type === 'equip' && v.owner === V);
            return (kre.length ? kre : valid.filter(v => v.type === 'equip')).slice(0, need).map(v => v.id);
          };
          const vor = S.schnappschuss(t); const ids = Object.keys(vor);
          const handM0 = S.handAnz(t, m);
          const handW0 = S.handAnz(t, W);
          await def.spiel(t, W, hero);
          if (t.gs.potionTargeting && t.gs.potionTargeting.ownerIdx === W) await t.resolveTargeting(W);
          await S.ende(t, W);
          const diff = S.unterschied(vor, S.schnappschuss(t), ids);
          const ang = S.angebote(t);
          const stolen = diff.some(d => /ctl|owner|weg/.test(d));
          R.check('mindestens ein Monia-Angebot, ausgelöst von der Karte', ang.length >= 1 && ang.every(a => a.d.triggerCardName === def.name), ang.map(a => ({ trig: a.d.triggerCardName, t: a.d.title })));
          if (def.name !== 'Cute Conversion' && def.name !== 'Capture Net') R.check('genau EIN Angebot (kein Doppelfenster)', ang.length === 1, ang.length);
          if (antwort === 'nein') {
            R.check('abgelehnt: die Kreatur wurde übernommen / auf die Hand genommen', stolen, diff);
            R.check('abgelehnt: Monias Hand verliert nur die selbst gespielte Karte (kein Abwurf)', S.handAnz(t, m) === handM0 - (W === m ? def.karten : 0) + (W === m && def.zurHand ? 1 : 0), { hand: [handM0, S.handAnz(t, m)] });
          } else {
            const stolenProtected = diff.filter(d => { const mm = d.match(/@(\d)\//); return mm && +mm[1] === V; });
            R.check('angenommen: keine Kreatur der geschützten Seite verändert (weder Kontrolle noch Platz noch Hand)', stolenProtected.length === 0, stolenProtected);
            R.check('angenommen: Monias Besitzer wirft genau 1 Handkarte ab', S.handAnz(t, m) === handM0 - (W === m ? def.karten : 0) - 1, { hand: [handM0, S.handAnz(t, m)] });
          }
          R.check('keine Engine-Fehler', t.errors.length === 0, t.errors.slice(0, 2));
        }
      }
    }
  }

  // ═══ Treacherous Crystal (server.js-Weg): derselbe zentrale Diebstahl-Weg mit Fenster ═══
  for (const m of [0, 1]) {
    const o = 1 - m;
    for (const antwort of ['nein', 'ja']) {
      R.section(`Treacherous Crystal (Weg über actionStealCreatureGefragt) · Monia Sitz ${m} · Dieb Sitz ${o} · Monia ${antwort === 'ja' ? 'nimmt an' : 'lehnt ab'}`);
      const { t } = await S.szene({ m });
      S.skript(t, antwort, m);
      const vor = S.schnappschuss(t); const ids = Object.keys(vor);
      const kre = t.engine.cardInstances.filter(c => c.zone === 'support' && c.owner === m);
      for (const inst of kre) await t.run(() => t.engine.actionStealCreatureGefragt(o, inst, { sourceName: 'Treacherous Crystal' }));
      await S.ende(t, o);
      const ang = S.angebote(t);
      const gestohlen = kre.filter(c => c.controller === o).length;
      R.check('genau 1 Angebot für den ganzen Effekt (Crystal übernimmt alle Kreaturen von Monias Seite)', ang.length === 1 && ang[0].d.triggerCardName === 'Treacherous Crystal', ang.map(a => a.d.triggerCardName));
      R.check(antwort === 'ja' ? 'angenommen: keine Kreatur von Monias Seite gestohlen' : 'abgelehnt: alle Kreaturen von Monias Seite gestohlen', antwort === 'ja' ? gestohlen === 0 : gestohlen === kre.length, { gestohlen, von: kre.length });
    }
  }
  R.finish();
})().catch(e => { process.stderr.write(String(e && e.stack || e) + '\n'); process.exit(2); });
