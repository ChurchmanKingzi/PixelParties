'use strict';
// W71b-03 · Cool Rescuer Monia: ZERSTÖREN / „defeat" / Vom-Brett-Nehmen öffnen das Fenster (Hand of Death, Decapitating Strike, Missing People, Mass Routing)
//
// Hand of Death („choose any target and defeat it", Wirkung erst am Ende des nächsten Gegnerzugs): Monia fragt im Moment der Wirkung, nicht beim Ausspielen.
// Decapitating Strike (Reaktion „Defeat that target" nach Schaden): zweites, eigenes Angebot nach dem des Schadens (andere Karte → anderer Effekt).
// Missing People („place it at the bottom of their deck") und Mass Routing („shuffle all Creatures … back into their original owners' decks"): beide nahmen die Kreatur über rohe Zonen-Schreibzugriffe
// vom Brett — jetzt vorher `engine.kreaturBetroffen(…, 'move')`; Mass Routing fragt je Zauber EIN Angebot (Monias Buchführung `_moniaAngebote`).
// Aufruf: node docs/niche-tests/repro/W71/b-03-….js   (Exit 0 = korrekt; auf dem Stand vor W71b rot)
const S = require('../../lib/monia-sweep.js');
const { H, DB } = S;
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(2); });

const imBrett = (t, c) => c.zone === 'support' && t.gs.players[t.engine.physicalSide(c)].supportZones[c.heroIdx][c.zoneSlot].includes(c.name);

(async () => {
  const R = H.runner();
  for (const m of [0, 1]) {
    const o = 1 - m;
    for (const wirker of ['gegner', 'eigen']) {
      const W = wirker === 'gegner' ? o : m, V = 1 - W, hero = wirker === 'gegner' ? 0 : 1;
      for (const antwort of ['nein', 'ja']) {
        const wer = `Monia Sitz ${m} · Wirker Sitz ${W} (${wirker === 'gegner' ? 'Gegner' : 'Monias Besitzer'}) auf Sitz ${V} · Monia ${antwort === 'ja' ? 'nimmt an' : 'lehnt ab'}`;
        const zielV = (t) => { t.targetFn = (valid) => { const k = valid.find(v => v.type === 'equip' && v.owner === V); return k ? [k.id] : undefined; }; };

        // ═══ Hand of Death (verzögert) ═══
        {
          R.section(`Hand of Death · ${wer}`);
          const { t } = await S.szene({ m, handM: W === m ? ['Hand of Death'] : [], handO: W === o ? ['Hand of Death'] : [] });
          S.skript(t, antwort, V); zielV(t);
          const vor = S.schnappschuss(t); const ids = Object.keys(vor);
          const kreV0 = t.engine.cardInstances.filter(c => c.zone === 'support' && (c.controller ?? c.owner) === V).length;
          const abl0 = t.gs.players[m].discardPile.length;
          await t.play(W, 'Hand of Death', { hero });
          R.check('beim Ausspielen noch kein Angebot (die Wirkung kommt erst am Ende des nächsten Gegnerzugs)', S.angebote(t).length === 0, S.angebote(t).length);
          await t.endTurn(); await t.endTurn();
          const ang = S.angebote(t);
          const kreV1 = t.engine.cardInstances.filter(c => c.zone === 'support' && (c.controller ?? c.owner) === V).length;
          R.check('zur Wirkung genau EIN Angebot, ausgelöst von „Hand of Death"', ang.length === 1 && ang[0].d.triggerCardName === 'Hand of Death', ang.map(a => a.d.triggerCardName));
          if (antwort === 'nein') R.check('abgelehnt: eine Kreatur wurde besiegt', kreV1 === kreV0 - 1, [kreV0, kreV1]);
          else R.check('angenommen: keine Kreatur besiegt, genau 1 Handkarte abgeworfen (Ablage +1 [+1 für die gespielte Karte])', kreV1 === kreV0 && t.gs.players[m].discardPile.length === abl0 + (W === m ? 1 : 0) + 1, { kre: [kreV0, kreV1], abl: [abl0, t.gs.players[m].discardPile.length] });
          R.check('keine Engine-Fehler', t.errors.length === 0, t.errors.slice(0, 2));
        }

        // ═══ Decapitating Strike (Reaktion auf Schaden) ═══
        // Die CPU-Harness bietet die Karte nur dem KONTROLLEUR der beschädigten Kreatur an (Gegner-Auslöser nur für Menschen) — Halter = Sitz V.
        {
          R.section(`Decapitating Strike (Halter Sitz ${V}, Kontrolleur der Kreatur) nach Fireball von Sitz ${W} auf eine Kreatur mit 180 HP · ${wer}`);
          const { t } = await S.szene({ m, handM: W === m ? ['Fireball'] : ['Decapitating Strike'], handO: W === o ? ['Fireball'] : ['Decapitating Strike'] });
          // Fireball immer ablehnen; die Antwort der Reihe gilt dem Angebot von Decapitating Strike
          S.skript(t, antwort, V, /Decapitating Strike/); zielV(t);
          const heroV = V === m ? 1 : 0;
          t.grantFor(V, heroV, 'Decapitating Strike');
          const kre = t.engine.cardInstances.find(c => c.zone === 'support' && (c.controller ?? c.owner) === V && c.name === 'ZZ Dummy Big');
          kre.counters.currentHp = 180; kre.counters.maxHp = 1000;
          const abl0 = t.gs.players[m].discardPile.length;
          await t.play(W, 'Fireball', { hero });
          await S.ende(t, W);
          const ang = S.angebote(t);
          const ds = ang.filter(a => /Decapitating Strike/.test(`${a.d.triggerCardName} ${a.d.description}`));
          R.check('Decapitating Strike wurde gespielt', t.gs.players[V].discardPile.includes('Decapitating Strike'), t.gs.players[V].discardPile);
          R.check('Monia fragt zweimal: Fireball-Schaden UND „Decapitating Strike" (eigene Karte, eigenes Angebot)', ang.length === 2 && ds.length === 1, ang.map(a => a.d.triggerCardName));
          // abl0: Ablage von Monia vorher; Karten, die ihr Besitzer selbst verbraucht: Fireball (Wirker m) bzw. Decapitating Strike (Halter m)
          const eigene = (W === m ? 1 : 0) + (V === m ? 1 : 0);
          if (antwort === 'nein') R.check('abgelehnt: die Kreatur (30 HP übrig) wurde besiegt', !imBrett(t, kre), kre.zone);
          else R.check('angenommen: die Kreatur lebt mit 30 HP, genau 1 Handkarte (Monia) abgeworfen', imBrett(t, kre) && S.hp(kre) === 30 && t.gs.players[m].discardPile.length === abl0 + eigene + 1, { hp: S.hp(kre), abl: [abl0, t.gs.players[m].discardPile.length], eigene });
          R.check('keine Engine-Fehler', t.errors.length === 0, t.errors.slice(0, 2));
        }

        // ═══ Missing People ═══
        {
          R.section(`Missing People · ${wer}`);
          const { t } = await S.szene({ m, handM: W === m ? ['Missing People'] : [], handO: W === o ? ['Missing People'] : [] });
          S.skript(t, antwort, V); zielV(t);
          const vor = S.schnappschuss(t); const ids = Object.keys(vor);
          const deckV0 = t.gs.players[V].mainDeck.length;
          const abl0 = t.gs.players[m].discardPile.length;
          await t.play(W, 'Missing People', { hero });
          await S.ende(t, W);
          const ang = S.angebote(t);
          const diff = S.unterschied(vor, S.schnappschuss(t), ids);
          R.check('genau EIN Angebot, ausgelöst von „Missing People"', ang.length === 1 && ang[0].d.triggerCardName === 'Missing People', ang.map(a => a.d.triggerCardName));
          if (antwort === 'nein') R.check('abgelehnt: die Kreatur liegt am Deckende', diff.some(d => /weg/.test(d)) && t.gs.players[V].mainDeck.length === deckV0 + 1, { diff, deck: [deckV0, t.gs.players[V].mainDeck.length] });
          else R.check('angenommen: Kreatur unverändert, Deck unverändert, 1 Handkarte weg', diff.length === 0 && t.gs.players[V].mainDeck.length === deckV0 && t.gs.players[m].discardPile.length === abl0 + (W === m ? 1 : 0) + 1, { diff, deck: [deckV0, t.gs.players[V].mainDeck.length], abl: [abl0, t.gs.players[m].discardPile.length] });
          R.check('keine Engine-Fehler', t.errors.length === 0, t.errors.slice(0, 2));
        }

        // ═══ Mass Routing (Flächeneffekt über beide Seiten) ═══
        {
          R.section(`Mass Routing · ${wer}`);
          const { t } = await S.szene({ m, handM: W === m ? ['Mass Routing'] : [], handO: W === o ? ['Mass Routing'] : [] });
          const log = S.skript(t, antwort, V);
          const vor = S.schnappschuss(t); const ids = Object.keys(vor);
          const abl0 = t.gs.players[m].discardPile.length;
          await t.play(W, 'Mass Routing', { hero });
          await S.ende(t, W);
          const ang = S.angebote(t);
          const geschuetzt = antwort === 'ja' && log[0] && log[0].gewaehlt ? +log[0].gewaehlt.slice(5) : null;
          const diff = S.unterschied(vor, S.schnappschuss(t), ids);
          // Ein Angebot je Karte/Effekt UND Seite: angenommen → ein Angebot für den ganzen Zauber; abgelehnt → Monia wird für die zweite Seite noch einmal gefragt (nicht je Kreatur: höchstens 2 Angebote).
          R.check(antwort === 'ja' ? 'angenommen: genau EIN Angebot für den ganzen Zauber (nicht je Kreatur)' : 'abgelehnt: höchstens ein Angebot je Seite (2), nicht je Kreatur',
            ang.every(a => a.d.triggerCardName === 'Mass Routing') && (antwort === 'ja' ? ang.length === 1 : (ang.length === 2 && new Set(ang.map(a => a.d.options[0].id)).size === 2)), ang.map(a => a.d.options.map(x => x.id)));
          const weg = (s) => diff.filter(d => new RegExp('@' + s + '/').test(d) && /weg/.test(d)).length;
          if (antwort === 'nein') R.check('abgelehnt: Kreaturen beider Seiten wurden zurückgemischt', weg(0) > 0 && weg(1) > 0, diff.length);
          else R.check('angenommen: die geschützte Seite verliert keine Kreatur, 1 Handkarte weg', weg(geschuetzt) === 0 && t.gs.players[m].discardPile.length === abl0 + (W === m ? 1 : 0) + 1, { geschuetzt, diff: diff.length, abl: [abl0, t.gs.players[m].discardPile.length] });
          R.check('keine Engine-Fehler', t.errors.length === 0, t.errors.slice(0, 2));
        }
      }
    }
  }
  R.finish();
})().catch(e => { process.stderr.write(String(e && e.stack || e) + '\n'); process.exit(2); });
