'use strict';
// W72a · Control Monitors — die Eigenbau-Tutoren und Sonderfälle der Inventur, GEZIELT (der Sweep a-18 erreicht ihre Auslöser nicht alle): ein Fenster je Effekt, mit der richtigen Kartenzahl N.
// Kartentext: „Play this card immediately when your opponent adds 1 or more cards from their deck or discard pile to their hand …"
// Erwartet: Mass Multiplication (3 Kopien aus dem Deck → ein Fenster, N=3), Birthday Present (die 2 EIGENEN Karten zaehlen, die Gabe an den Gegner nicht), Magic Lamp (2 eigene Karten),
//   Kit Modus A, Krates (der Suchende bekommt 1 Karte aus dem eigenen Deck; Krates' Karte aus dem GEGNER-Deck zaehlt nicht), Maho, Crum (Ablage), und KEIN Fenster für Cooldin (Zwischenschritt Deck → Hand → Brett)
//   sowie für Karten mit `ohneZugangsFenster` (Hipdall: aus dem Coolness Stack). Aufruf: node docs/niche-tests/repro/W72/a-20-….js   (Exit 0 = korrekt)
const S = require('../../lib/handzugang-sweep.js');
const { H, F, MC } = S;
const fensterVon = (t, w) => t.rec.fenster.filter(f => f.pi === w);

(async () => {
  const R = H.runner();
  for (const w of [1, 0]) {
    const m = 1 - w;
    const heroesMitHeld = (heldName, platz = 1) => { const a = w === 0 ? H.BLANK_HEROES.slice() : H.BLANK_HEROES_B.slice(); a[platz] = heldName; const o = m === 0 ? H.BLANK_HEROES : H.BLANK_HEROES_B; return w === 0 ? [a, o] : [o, a]; };

    R.section(`Wirker Sitz ${w} · Mass Multiplication: 3 Kopien aus dem Deck = EIN Fenster, N=3`);
    let t = await S.szene({ w, seed: 'mm' });
    t.gs.players[w].mainDeck = ['Fireball', 'Fireball', 'Fireball', 'Fireball', F, F]; t.gs.players[w].hand = ['Fireball', F, F];
    await t.play(w, 'Mass Multiplication'); await t.drain();
    let f = fensterVon(t, w);
    R.check('ein Fenster mit 3 × Fireball, hinzugefuegt = 3', f.length === 1 && f[0].namen.join() === 'Fireball,Fireball,Fireball' && f[0].hinzugefuegt === 3, f);
    R.check('keine Fehler', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });

    R.section(`Wirker Sitz ${w} · Birthday Present: die 2 EIGENEN Karten zaehlen (N=2), die Gabe an den Gegner nicht`);
    t = await S.szene({ w, seed: 'bp' });
    await t.play(w, 'Birthday Present'); await t.drain();
    f = fensterVon(t, w);
    R.check('ein Fenster fuer den Wirker mit 2 Karten', f.length === 1 && f[0].namen.length === 2 && f[0].hinzugefuegt === 2, f);
    R.check('fuer den Gegner (bekommt eine Karte aus FREMDEM Deck) kein Fenster', fensterVon(t, m).length === 0, fensterVon(t, m));

    R.section(`Wirker Sitz ${w} · Magic Lamp: die 2 eigenen Karten (N=2)`);
    t = await S.szene({ w, seed: 'ml' });
    t.script.unshift({ match: d => d.type === 'cardGalleryMulti' && d.title === 'Magic Lamp', answer: (d) => ({ selectedCards: [0, 1, 2].map(i => d.cards[i].name), selectedIndices: [0, 1, 2] }) });
    await t.play(w, 'Magic Lamp'); await t.drain();
    f = fensterVon(t, w);
    R.check('ein Fenster mit 2 Karten', f.length === 1 && f[0].namen.length === 2 && f[0].hinzugefuegt === 2, f);

    R.section(`Wirker Sitz ${w} · Kit, the Shark Researcher: Ability anlegen → Modus A (Kreatur aus dem Deck auf die Hand)`);
    t = await S.szene({ w, seed: 'kit', heroes: heroesMitHeld('Kit, the Shark Researcher', 0) });
    t.script.unshift({ match: d => d.type === 'optionPicker' && /Kit/.test(d.title || ''), answer: () => ({ optionId: 'A' }) });
    await t.play(w, 'Fighting', { hero: 0 }); await t.drain();
    f = fensterVon(t, w);
    R.check('ein Fenster mit 1 Karte, Quelle Kit', f.length === 1 && f[0].namen.length === 1 && /Kit/.test(f[0].quelle || ''), f);

    R.section(`Wirker Sitz ${w} · Krates beim Gegner: der Suchende bekommt 1 Karte aus dem EIGENEN Deck (N=1); Krates' Karte aus dem Gegner-Deck zaehlt nicht`);
    {
      const hs = m === 0 ? [['Tushu, the Knowledge Keeper', 'Krates, the Smartass', H.BLANK_HEROES[2]], H.BLANK_HEROES_B] : [H.BLANK_HEROES, ['Cuberto, Supreme Lord of Edges', 'Krates, the Smartass', H.BLANK_HEROES_B[2]]];
      t = await S.szene({ w, seed: 'kr', heroes: hs });
      await t.play(w, 'Magnetic Potion'); await t.drain();
      f = fensterVon(t, w);
      R.check('ein Fenster fuer den Suchenden mit 1 Karte (Quelle Krates)', f.length === 1 && f[0].namen.length === 1 && /Krates/.test(f[0].quelle || ''), f);
      R.check('fuer Krates\' eigene Karte (aus dem Deck des Suchenden) kein Fenster', fensterVon(t, m).length === 0, fensterVon(t, m));
    }

    R.section(`Wirker Sitz ${w} · Maho: Beschwoerung → Double Spell aus dem Deck`);
    t = await S.szene({ w, seed: 'maho', heroes: heroesMitHeld('Maho, the Cute Magical Girl', 0) });
    t.script.unshift({ match: d => d.type === 'cardGallery' && /Maho/.test(d.title || ''), answer: (d) => ({ cardName: d.cards[0].name, source: d.cards[0].source }) });
    await t.play(w, 'ZZ Dummy', { hero: 0, slot: 2 }); await t.drain();
    f = fensterVon(t, w);
    R.check('ein Fenster mit 1 Karte, Quelle Maho', f.length === 1 && f[0].namen.length === 1 && /Maho/.test(f[0].quelle || ''), f);

    R.section(`Wirker Sitz ${w} · Crum, the Class Pet: Tausch mit einem Double Spell aus der Ablage`);
    {
      const { t: tc, a } = await S.aktiviere('kreatur', 'Crum, the Class Pet', { w });
      f = fensterVon(tc, w);
      R.check('ein Fenster mit 1 Karte (aus der Ablage), Quelle Crum', f.length === 1 && f[0].namen.length === 1 && /Crum/.test(f[0].quelle || ''), f);
    }

    R.section(`Wirker Sitz ${w} · KEIN Fenster: Cooldin (Deck → Hand → Brett in einem Zug) und \`ohneZugangsFenster\` (Hipdall: Coolness Stack)`);
    t = await S.szene({ w, seed: 'cd', heroes: heroesMitHeld('Cooldin, King of Coolness') });
    t.gs.players[w].mainDeck = ["Cottage at the Forest's Edge", F, F, F]; t.gs.players[w].hand = [F, F];
    await t.activateHero(w, 1); await t.drain();
    R.check('Cooldin: Area liegt auf dem Brett, kein Fenster, nichts vorgemerkt', (t.gs.areaZones[w] || []).includes("Cottage at the Forest's Edge") && fensterVon(t, w).length === 0 && t.rec.noten.length === 0, { area: t.gs.areaZones[w], f: t.rec.fenster, n: t.rec.noten });
    t = await S.szene({ w, seed: 'hd' });
    t.gs.players[w].discardPile.push('Fireball');
    await t.run(async () => { await t.engine.takeFromPile(w, 'discard', 'Fireball', { source: 'Hipdall', toHand: true, ohneZugangsFenster: true }); await t.engine.handZugang(w, 'Fireball', { von: 'ablage', source: 'Hipdall', ohneInstanz: true, ohneZugangsFenster: true }); });
    await t.drain();
    R.check('ohneZugangsFenster (takeFromPile + handZugang): Karte auf der Hand, kein Fenster', t.pile(w, 'hand').includes('Fireball') && fensterVon(t, w).length === 0, { f: t.rec.fenster });
  }
  R.finish();
})().catch(e => { process.stderr.write('THROW ' + (e && e.stack || e) + '\n'); process.exit(2); });
