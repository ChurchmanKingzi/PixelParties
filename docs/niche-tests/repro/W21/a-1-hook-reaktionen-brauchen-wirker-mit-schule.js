'use strict';
// W21a · Frage 1 aus W20c · Al, 20.10.2026: „Sollen Divine Gift of Time, Unwanted Audience und Divine Gift of the Guardian einen Wirker mit der passenden Schule verlangen,
// auch über übernommene Helden?“ — „ja“
//
// Kartendaten (data/cards.json): Divine Gift of Time = Magic Arts Lv2, Unwanted Audience = Decay Magic (+ Magic Arts) Lv1, Divine Gift of the Guardian = Summoning Magic Lv1.
// Regel: Wie jede Hand-Reaktion braucht jede der drei Karten einen WIRKER-Helden mit der Schule/Stufe laut Kartendaten — einen eigenen Helden des Spielers ODER einen von ihm
// kontrollierten (übernommenen) Helden der Gegenspalte (Schule/Stufe von IHM, Hand/Gold/Wisdom vom Kontrolleur). Der Besitzer eines abgegebenen Helden wirkt mit ihm nichts.
// Ohne Wirker: kein Angebot, die Karte bleibt auf der Hand, der „Divine Gift“-Stempel (1 pro Spiel) bleibt frei.
// Gegenproben: eigener Held mit Schule → Angebot wie vorher; Wisdom deckt eine Stufe Differenz (Abwurf aus der Hand des Kontrolleurs, nie die Reaktionskarte selbst).
const H = require('../../lib/h.js');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;
const frage = (t, titel, seat) => t.prompts.filter(p => p.d.title === titel && (seat == null || p.pi === seat));
async function uebernehmen(t, v, ctrl, besitzer, hi) {
  if (v === 'dauerhaft') await t.engine.actionTakeHeroPermanently(ctrl, besitzer, hi);
  else t.engine.actionStealHero(ctrl, besitzer, hi);
  await sleep(150);   // Harness-Falle: onTakeControl läuft asynchron nach
}

// Je Karte: Aufbau (Hand des Halters `s`), Auslöser, Erfolgsprüfung.
const KARTEN = {
  'Divine Gift of Time': {
    hand: (s) => ['Divine Gift of Time', 'ZZ Filler'],
    zeitpunkt: 'sofort',
    async ausloesen(t, s) { await t.run(() => t.engine.actionMillCards(s, 2, { selfInflicted: true })); await sleep(80); },
    erfolg: (t, s) => t.pile(s, 'discardPile').includes('Divine Gift of Time'),
  },
  'Divine Gift of the Guardian': {
    hand: (s) => ['Divine Gift of the Guardian'],
    zeitpunkt: 'sofort',
    async ausloesen(t, s) {
      const k = t.put(s, 1, 0, H.INERT.creature);
      await t.run(() => t.engine.actionDealCreatureDamage({ name: 'Test', owner: 1 - s }, k, 50, 'creature')); await sleep(80);
    },
    erfolg: (t, s) => t.pile(s, 'discardPile').includes('Divine Gift of the Guardian'),
  },
  'Unwanted Audience': {
    hand: (s) => ['Unwanted Audience'],
    zeitpunkt: 'gegnerzugbeginn',   // am Anfang des GEGNER-Zugs: der Halter ist nicht am Zug; eine temporäre Übernahme endet vorher
    async ausloesen(t, s) { await t.endTurn(); await sleep(150); },
    erfolg: (t, s) => t.pile(s, 'discardPile').includes('Unwanted Audience'),
  },
};

(async () => {
  const R = H.runner();
  for (const [name, K] of Object.entries(KARTEN)) {
    const nur = (v) => !(K.zeitpunkt === 'gegnerzugbeginn' && v === 'temporaer');
    const szene = async (s) => {
      const hand = [[], []]; hand[s] = K.hand(s);
      return H.fresh({ hand, deckSize: 30, active: s });
    };

    R.section(`${name}: kein Held mit der Schule → kein Angebot, Karte bleibt auf der Hand`);
    for (const s of [0, 1]) {
      const t = await szene(s);
      await K.ausloesen(t, s);
      R.check(`Sitz ${s}: keine Abfrage "${name}"`, frage(t, name, s).length === 0, frage(t, name, s).map(p => p.d.message));
      R.check(`Sitz ${s}: Karte noch auf der Hand, nicht in der Ablage, Stempel frei`, t.pile(s, 'hand').includes(name) && !K.erfolg(t, s) && !t.gs.players[s]._oncePerGameUsed?.has('divineGift'), { hand: t.pile(s, 'hand'), abl: t.pile(s, 'discardPile') });
      R.check(`Sitz ${s}: sauber`, sauber(t), { e: t.errors, a: t.audit() });
    }

    R.section(`${name}: eigener Held mit der Schule (Gegenprobe: Angebot wie bisher)`);
    for (const s of [0, 1]) {
      const t = await szene(s);
      t.grantFor(s, 1, name);
      await K.ausloesen(t, s);
      R.check(`Sitz ${s}: Abfrage "${name}" genau einmal`, frage(t, name, s).length === 1, frage(t, name, s).length);
      R.check(`Sitz ${s}: Karte gespielt (Ablage)`, K.erfolg(t, s), t.pile(s, 'discardPile'));
      R.check(`Sitz ${s}: sauber`, sauber(t), { e: t.errors, a: t.audit() });
    }

    for (const v of ['dauerhaft', 'temporaer']) {
      if (!nur(v)) continue;
      R.section(`${name}: nur ein ${v} ÜBERNOMMENER Held der Gegenspalte hat die Schule — der Kontrolleur reagiert, nicht der Besitzer`);
      for (const s of [0, 1]) {
        // Kontrolleur = s hält die Karte; der Held 0:(1-s) steht in der Spalte des Gegners und hat die Schule
        const t = await szene(s);
        t.grantFor(1 - s, 0, name);
        await uebernehmen(t, v, s, 1 - s, 0);
        await K.ausloesen(t, s);
        R.check(`${v}, Kontrolleur Sitz ${s}: Abfrage "${name}" kommt (Wirker = übernommener Held)`, frage(t, name, s).length >= 1, frage(t, name, s).length);
        R.check(`${v}, Kontrolleur Sitz ${s}: Karte gespielt`, K.erfolg(t, s), t.pile(s, 'discardPile'));
        R.check(`${v}, Kontrolleur Sitz ${s}: sauber`, sauber(t), { e: t.errors, a: t.audit() });
      }
      // Besitzer: die Schule steckt nur im abgegebenen Helden → kein Angebot
      for (const s of [0, 1]) {
        const t = await szene(s);
        t.grantFor(s, 0, name);
        await uebernehmen(t, v, 1 - s, s, 0);
        await K.ausloesen(t, s);
        R.check(`${v}, Besitzer Sitz ${s}: keine Abfrage (der abgegebene Held wirkt nichts)`, frage(t, name, s).length === 0, frage(t, name, s).length);
        R.check(`${v}, Besitzer Sitz ${s}: Karte bleibt auf der Hand, Stempel frei`, !K.erfolg(t, s) && t.pile(s, 'hand').includes(name) && !t.gs.players[s]._oncePerGameUsed?.has('divineGift'), { hand: t.pile(s, 'hand'), abl: t.pile(s, 'discardPile') });
        R.check(`${v}, Besitzer Sitz ${s}: sauber`, sauber(t), { e: t.errors, a: t.audit() });
      }
    }

    R.section(`${name}: übernommener Held ohne Schule (Gegenprobe) → kein Angebot`);
    {
      const s = 0;
      const t = await szene(s);
      await uebernehmen(t, 'dauerhaft', s, 1 - s, 0);
      await K.ausloesen(t, s);
      R.check('keine Abfrage', frage(t, name, s).length === 0 && !K.erfolg(t, s), frage(t, name, s).length);
    }
    // (Unwanted Audience feuert erst nach dem Zugwechsel; ein Frost-Stempel taut dabei auf — dort nicht messbar, die Sperre ist dieselbe Engine-Prüfung.)
    if (K.zeitpunkt !== 'gegnerzugbeginn') {
      R.section(`${name}: Wirker gefroren → kein Angebot (Cast-Sperre gilt wie bei jeder Reaktion)`);
      const s = 0;
      const t = await szene(s);
      t.grantFor(s, 1, name);
      t.heroStatus(s, 1, 'frozen');
      await K.ausloesen(t, s);
      R.check('keine Abfrage', frage(t, name, s).length === 0 && !K.erfolg(t, s), frage(t, name, s).length);
    }
  }

  R.section('Divine Gift of Time: Wisdom deckt eine Stufe Differenz (Magic Arts 1 + Wisdom) — Abwurf aus der Hand, nie Time selbst');
  {
    const t = await H.fresh({ hand: [['Divine Gift of Time', 'ZZ Filler', 'ZZ Filler'], []], deckSize: 30, active: 1,
      abilities: { 0: { 1: [['Magic Arts'], ['Wisdom'], []] } } });
    await t.run(() => t.engine.actionMillCards(0, 2, { selfInflicted: true })); await sleep(120);
    R.check('Abfrage kommt (Wisdom deckt die fehlende Stufe)', frage(t, 'Divine Gift of Time', 0).length === 1, frage(t, 'Divine Gift of Time', 0).length);
    const abl = t.pile(0, 'discardPile');
    R.check('Time in der Ablage, genau EIN Filler als Wisdom-Abwurf', abl.includes('Divine Gift of Time') && abl.filter(n => n === 'ZZ Filler').length === 1, abl);
    R.check('die zwei gemillten Karten sind auf der Hand (+ 1 Filler)', t.pile(0, 'hand').length === 3, t.pile(0, 'hand'));
    R.check('sauber', sauber(t), { e: t.errors, a: t.audit() });
  }
  R.section('Divine Gift of Time: Wisdom, aber keine Karte zum Abwerfen → kein Angebot');
  {
    const t = await H.fresh({ hand: [['Divine Gift of Time'], []], deckSize: 30, active: 1,
      abilities: { 0: { 1: [['Magic Arts'], ['Wisdom'], []] } } });
    await t.run(() => t.engine.actionMillCards(0, 2, { selfInflicted: true })); await sleep(80);
    R.check('keine Abfrage (Wisdom nicht zahlbar), Time bleibt auf der Hand', frage(t, 'Divine Gift of Time', 0).length === 0 && t.pile(0, 'hand').includes('Divine Gift of Time'), t.pile(0, 'hand'));
  }
  R.finish();
})().catch(e => { process.stdout.write('AUSNAHME ' + (e && e.stack) + '\n'); process.exit(1); });
