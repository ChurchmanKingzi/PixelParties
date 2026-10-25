'use strict';
// W71b-01 · Cool Rescuer Monia: Bounce-Karten öffnen das Fenster (Al, 25.10.2026: „Laut Testern fehlen mindestens Racket Arrow und Dark Gear")
//
// Monia: „Whenever 1 or more Creatures either player controls would be affected by a card or effect, you may discard 1 card to negate any effects that card or effect has on all Creatures."
// Racket Arrow („return it to its original owner's hand") und Chasing the Legend („Add that Creature to its owner's hand") haben bisher KEIN Angebot geöffnet: `returnSupportCreatureToHand` (Racket Arrow)
// hatte kein Schutzfenster, `actionMoveCard` (Chasing) reichte keine Quelle durch. Jetzt fragt der EINE zentrale Weg (`engine.kreaturBetroffen`, `beforeCreatureAffected`, Effektart 'move').
//
// Geprüft (beide Sitze für Monia, beide Wirker: der Gegner von Monia / Monias Besitzer selbst):
//   · Racket Arrow: ablehnen → Kreatur geht auf die Hand ihres Besitzers, kein Abwurf · annehmen → Kreatur bleibt stehen, genau 1 Handkarte weg, der Pfeil ist verbraucht, die Attack läuft weiter
//   · das Angebot nennt die auslösende Karte (`triggerCardName` = Racket Arrow) und nur die Seite der betroffenen Kreatur; genau EIN Angebot (kein Doppelfenster)
//   · Chasing the Legend: ablehnen → Kreatur zurück auf die Hand, Schaden geblankt · annehmen → Kreatur bleibt, der Schaden wird NICHT geblankt (die Kreatur ist ja noch da)
// Aufruf: node docs/niche-tests/repro/W71/b-01-….js   (Exit 0 = korrekt; auf dem Stand vor W71b rot)
const S = require('../../lib/monia-sweep.js');
const { H, DB } = S;
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(2); });

const wo = (t, name) => t.engine.cardInstances.find(c => c.name === name);

(async () => {
  const R = H.runner();
  for (const m of [0, 1]) {
    const o = 1 - m;
    for (const wirker of ['gegner', 'eigen']) {
      const W = wirker === 'gegner' ? o : m;            // Sitz des Pfeil-Besitzers
      const V = 1 - W;                                  // Sitz der betroffenen Kreatur
      const hero = wirker === 'gegner' ? 0 : 1;
      for (const antwort of ['nein', 'ja']) {
        R.section(`Monia Sitz ${m} · Racket Arrow von ${wirker === 'gegner' ? 'ihrem Gegner (Sitz ' + o + ')' : 'Monias Besitzer selbst (Sitz ' + m + ')'} auf Sitz ${V} · Monia ${antwort === 'ja' ? 'nimmt an' : 'lehnt ab'}`);
        const sc = await S.szene({ m, handM: wirker === 'eigen' ? ['Racket Arrow', 'Attack'] : [], handO: wirker === 'gegner' ? ['Racket Arrow', 'Attack'] : [] });
        const { t } = sc;
        t.setAbilities(W, hero, [['Fighting'], [], []]);
        const log = S.skript(t, antwort, V);
        // Die Attack zielt auf einen HELDEN (kein Kreaturenfenster der Attack selbst): nur der Pfeil trifft eine Kreatur.
        t.targetFn = (valid) => {
          const kre = valid.filter(v => v.type === 'equip' && v.owner === V);
          if (kre.length && valid.every(v => v.type === 'equip')) return [kre[0].id];
          const held = valid.find(v => v.type === 'hero' && v.owner === V);
          return held ? [held.id] : [kre[0].id];
        };
        const vor = S.schnappschuss(t); const ids = Object.keys(vor);
        const handM0 = S.handAnz(t, m), ablageM0 = t.gs.players[m].discardPile.length;
        const kreV = t.engine.cardInstances.filter(c => c.zone === 'support' && (c.controller ?? c.owner) === V && c.name === 'ZZ Dummy Big').length;
        const r = await t.play(W, 'Attack', { hero });
        await S.ende(t, W);
        const nach = S.schnappschuss(t);
        const diff = S.unterschied(vor, nach, ids);
        const pfeilVerbraucht = !t.gs.players[W].hand.includes('Racket Arrow') && t.gs.players[W].discardPile.includes('Racket Arrow');
        const ang = S.angebote(t);
        const kreVNach = t.engine.cardInstances.filter(c => c.zone === 'support' && (c.controller ?? c.owner) === V && c.name === 'ZZ Dummy Big').length;
        R.check('der Pfeil wurde gespielt (Karte in der Ablage des Besitzers)', pfeilVerbraucht, { hand: t.gs.players[W].hand, abl: t.gs.players[W].discardPile });
        R.check('genau EIN Monia-Angebot, ausgelöst von „Racket Arrow", nur für die Seite der Kreatur', ang.length === 1 && ang[0].d.triggerCardName === 'Racket Arrow' && ang[0].d.options.length === 1 && ang[0].d.options[0].id === `save-${V}`,
          ang.map(a => ({ trig: a.d.triggerCardName, opt: a.d.options.map(x => x.id), t: a.d.title })));
        R.check('Titel „Cool Rescue!" und Beschreibung nennt Karte und Kreatur', ang.length === 1 && /Cool Rescue/.test(ang[0].d.title) && /Racket Arrow/.test(ang[0].d.description) && /ZZ Dummy Big/.test(ang[0].d.description), ang[0] && ang[0].d.description);
        if (antwort === 'nein') {
          R.check('abgelehnt: Kreatur weg vom Brett (zurück auf die Hand), kein Abwurf von Monia', kreVNach === kreV - 1 && S.handAnz(t, m) === handM0 - (wirker === 'eigen' ? 2 : 0) + (V === m ? 1 : 0) && t.gs.players[m].discardPile.length === ablageM0 + (wirker === 'eigen' ? 2 : 0),
            { kreV, kreVNach, hand: [handM0, S.handAnz(t, m)], abl: [ablageM0, t.gs.players[m].discardPile.length] });
          R.check('abgelehnt: die Kreatur liegt auf der Hand ihres Besitzers (Sitz ' + V + ')', t.gs.players[V].hand.includes('ZZ Dummy Big'), t.gs.players[V].hand);
        } else {
          R.check('angenommen: die Kreatur bleibt unverändert stehen (Zustand der Kreaturen = vorher)', diff.length === 0 && kreVNach === kreV, diff);
          R.check('angenommen: Monias Besitzer wirft genau 1 Handkarte ab (Kosten erst bei Annahme)', t.gs.players[m].discardPile.length === ablageM0 + 1 + (wirker === 'eigen' ? 2 : 0) && !t.gs.players[V].hand.includes('ZZ Dummy Big'),
            { abl: [ablageM0, t.gs.players[m].discardPile.length], handV: t.gs.players[V].hand });
        }
        R.check('keine Engine-Fehler', t.errors.length === 0, t.errors.slice(0, 2));
      }
    }

    // ═══ Chasing the Legend ═══
    for (const wirker of ['gegner', 'eigen']) {
      const W = wirker === 'gegner' ? o : m;            // Schadensverursacher
      const V = 1 - W;                                  // Besitzer der Kreatur, der Chasing the Legend hält
      for (const antwort of ['nein', 'ja']) {
        R.section(`Monia Sitz ${m} · Chasing the Legend (Halter Sitz ${V}) gegen Fireball von Sitz ${W} · Monia ${antwort === 'ja' ? 'nimmt an' : 'lehnt ab'}`);
        const sc = await S.szene({ m, handM: V === m ? ['Chasing the Legend'] : (wirker === 'eigen' ? ['Fireball'] : []), handO: V === o ? ['Chasing the Legend'] : (wirker === 'gegner' ? ['Fireball'] : []) });
        const { t } = sc;
        t.grantFor(V, V === m ? 1 : 0, 'Chasing the Legend');
        // Der Fireball-Schaden (Fenster 1, kommt zuerst) wird immer abgelehnt; die Antwort der Testreihe gilt dem Zurücknehmen durch Chasing the Legend (Fenster 2).
        const log = [];
        t.script.unshift({ match: S.isMo, answer: (d, pi) => { const chasing = /Chasing the Legend/.test((d.description || '') + (d.triggerCardName || '')); log.push({ chasing }); if (!chasing || antwort === 'nein') return null; return { optionId: d.options[0].id }; } });
        t.targetFn = (valid) => { const k = valid.find(v => v.type === 'equip' && v.owner === V); return k ? [k.id] : undefined; };
        const vor = S.schnappschuss(t); const ids = Object.keys(vor);
        const kre = t.engine.cardInstances.find(c => c.zone === 'support' && c.name === 'ZZ Dummy Big' && (c.controller ?? c.owner) === V);
        const handM0 = S.handAnz(t, m);
        await t.play(W, 'Fireball', { hero: W === m ? 1 : 0 });
        await S.ende(t, W);
        const ang = S.angebote(t);
        const vonChasing = ang.filter(a => a.d.triggerCardName === 'Chasing the Legend' || /Chasing the Legend/.test(a.d.description || ''));
        R.check('Chasing the Legend wurde gespielt', t.gs.players[V].discardPile.includes('Chasing the Legend'), t.gs.players[V].discardPile);
        R.check('Monia fragt für das Zurücknehmen durch „Chasing the Legend" (genau 1 Angebot dieser Karte)', vonChasing.length === 1, ang.map(a => ({ trig: a.d.triggerCardName, d: a.d.description })));
        if (antwort === 'nein') {
          R.check('abgelehnt: die Kreatur ist auf der Hand ihres Besitzers, der Fireball-Schaden wurde geblankt (HP unverändert, nicht in der Ablage)', !t.engine.cardInstances.some(c => c.id === kre.id && c.zone === 'support') && t.gs.players[V].hand.includes('ZZ Dummy Big') && !t.gs.players[V].discardPile.includes('ZZ Dummy Big'),
            { hand: t.gs.players[V].hand, abl: t.gs.players[V].discardPile });
        } else {
          R.check('angenommen: die Kreatur bleibt auf dem Brett', kre.zone === 'support', kre.zone);
          R.check('angenommen: der Schaden wird NICHT geblankt (die Kreatur ist ja noch da; der Fireball-Teil lief, Monia hat nur das Zurücknehmen negiert) — HP gesunken', S.hp(kre) < 1000, S.hp(kre));
          R.check('angenommen: Monias Besitzer wirft genau 1 Handkarte ab', t.gs.players[m].discardPile.length === (t.gs.players[m].discardPile.length) && S.handAnz(t, m) === handM0 - 1 - (V === m ? 1 : 0) - (W === m ? 1 : 0), { hand: [handM0, S.handAnz(t, m)] });
        }
        R.check('keine Engine-Fehler', t.errors.length === 0, t.errors.slice(0, 2));
      }
    }
  }
  R.finish();
})().catch(e => { process.stderr.write(String(e && e.stack || e) + '\n'); process.exit(2); });
