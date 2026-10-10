'use strict';
// UI-Test: Deckbau-Regeln im ECHTEN Browser (`canAddCard`, `isDeckLegal`, `countInDeck`, `trimOverLimitCopies`,
// `canCardTypeEnterSection` aus app-shared.jsx) — Kerthwack, the Reality Breaker (10.10.):
//   „When this is one of your starting Heroes, your Potion Deck may contain any card, but only up to 2 copies of each card.
//    Copies of cards played in your Potion Deck, except Potions, do not count towards the number of copies of those cards in your deck."
//   • Erlaubnis, kein Verbot: Potions bleiben im Potion Deck erlaubt, es kommen nur andere Karten dazu (je Name hoechstens 2).
//   • Diese Kopien (ausser Potions) zaehlen nicht zu den Kopien im Deck (Main-Deck-Grenze 4, Sacred Jewel & Co.).
//   • Potions zaehlen immer mit — mit Nicolas im Team gelten weiter 15 Potions / 2 Kopien je Potion ueber Main + Potion Deck.
//   • Chaos-Diamond / Pinta im Team: deren STRENGE Klausel ueberschreibt die laxe, schliesst Kerthwack aber nicht aus; ihre Karten
//     zaehlen dann ebenfalls nicht zu den Main-Deck-Grenzen.
//   NODE_PATH=/tmp/st-tools/node_modules:/opt/node22/lib/node_modules node scripts/skilltest-e2e/ui-deck-rules.js
const { chromium } = require('playwright');
const { startServer, BASE, sleep, createAccount, check, finish } = require('./lib');
const fs = require('fs');
const path = require('path');
const toolsDir = (process.env.NODE_PATH || '').split(path.delimiter).find(d => fs.existsSync(path.join(d, 'react', 'umd')));

(async () => {
  const srv = await startServer();
  const browser = await chromium.launch({ headless: true });
  try {
    const acc = await createAccount('UiDeck' + Date.now().toString(36) + Math.floor(Math.random() * 1e4));
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    await ctx.request.post(BASE + '/api/auth/login', { data: { username: acc.username, password: acc.password } });
    if (toolsDir) {
      await ctx.route(/unpkg\.com\/react@18\/umd\/react\.production\.min\.js/, r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(path.join(toolsDir, 'react/umd/react.production.min.js')) }));
      await ctx.route(/unpkg\.com\/react-dom@18\/umd\/react-dom\.production\.min\.js/, r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(path.join(toolsDir, 'react-dom/umd/react-dom.production.min.js')) }));
    }
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    const page = await ctx.newPage();
    const fehler = [];
    page.on('pageerror', (e) => { fehler.push(e.message); console.log('[pageerror]', e.message); });
    await page.goto(BASE + '/');
    await page.waitForSelector('text=PLAY ONLINE', { timeout: 20000 });
    await page.waitForFunction(() => window.socket && window.CARDS_BY_NAME && window.canAddCard && window.potionPermissions, null, { timeout: 20000 });

    const r = await page.evaluate(() => {
      const C = window.CARDS_BY_NAME;
      const KERTH = 'Kerthwack, the Reality Breaker', NICOLAS = 'Nicolas, the Hidden Alchemist';
      const CHAOS = 'Chaos-Diamond, the Cracked Keeper', PINTA = 'Pinta, the Singing Ship', OTHER = 'Reiza, the Chief Tormentor';
      const pick = (pred, n) => Object.values(C).filter(pred).sort((a, b) => (a.level || 0) - (b.level || 0) || a.name.localeCompare(b.name)).slice(0, n).map(c => c.name);
      const spells = pick(c => c.cardType === 'Spell' && (c.subtype === 'Normal' || c.subtype === 'Attachment') && c.level === 0 && c.maxCopies == null, 20);
      const creatures = pick(c => c.cardType === 'Creature' && c.level === 0 && c.maxCopies == null && c.subtype !== 'Artifact', 20);
      const potions = pick(c => c.cardType === 'Potion', 12);
      const artifacts = pick(c => c.cardType === 'Artifact' && c.subtype === 'Equipment' && c.maxCopies == null && c.name !== 'The Sacred Jewel', 3);
      const JEWEL = 'The Sacred Jewel';
      const rep = (n, k) => Array.from({ length: k }, () => n);
      const hs = (...names) => [0, 1, 2].map(i => ({ hero: names[i] || null, ability1: null, ability2: null }));
      const deck = (heroes, o = {}) => ({ heroes: hs(...heroes), mainDeck: o.main || [], potionDeck: o.potion || [], sideDeck: o.side || [] });
      const can = (d, n, s) => window.canAddCard(d, n, s);
      const gruende = (d) => window.isDeckLegal(d).reasons;
      const out = {};

      // ── Was ins Potion Deck darf ──
      out.ohne = { spell: can(deck([OTHER]), spells[0], 'potion'), creature: can(deck([OTHER]), creatures[0], 'potion'), potion: can(deck([OTHER]), potions[0], 'potion') };
      out.mit = { spell: can(deck([KERTH]), spells[0], 'potion'), creature: can(deck([KERTH]), creatures[0], 'potion'), potion: can(deck([KERTH]), potions[0], 'potion'),
        artifact: can(deck([KERTH]), artifacts[0], 'potion'), held: can(deck([KERTH]), 'Beato, the Bishop of Old' in C ? 'Beato, the Bishop of Old' : OTHER, 'potion') };
      out.abschnitt = { mit: window.canCardTypeEnterSection(deck([KERTH]), creatures[0], 'potion'), ohne: window.canCardTypeEnterSection(deck([OTHER]), creatures[0], 'potion') };
      out.perm = { kerth: window.potionPermissions(deck([KERTH])).length, ohne: window.potionPermissions(deck([OTHER, CHAOS])).length };

      // ── Je Name hoechstens 2 Kopien im Potion Deck ──
      out.kopien = {
        eine: can(deck([KERTH], { potion: [spells[0]] }), spells[0], 'potion'),
        zwei: can(deck([KERTH], { potion: [spells[0], spells[0]] }), spells[0], 'potion'),
        andere: can(deck([KERTH], { potion: [spells[0], spells[0]] }), spells[1], 'potion'),
      };
      // Potion Deck voll (15): nichts mehr
      out.voll = can(deck([KERTH], { potion: [...creatures.slice(0, 8).flatMap(n => [n, n]).slice(0, 15)] }), spells[0], 'potion');

      // ── Kopien zaehlen nicht zum Deck ──
      const vier = deck([KERTH], { main: rep(spells[0], 4), potion: [spells[0], spells[0]] });
      out.zaehlung = { imDeck: window.countInDeck(vier, spells[0]), mainVoll: can(vier, spells[0], 'main'),
        potionNochMoeglich: can(deck([KERTH], { main: rep(spells[0], 4), potion: [spells[0]] }), spells[0], 'potion'),
        mainNochFrei: can(deck([KERTH], { main: rep(spells[0], 3), potion: [spells[0], spells[0]] }), spells[0], 'main'),
        side: can(deck([KERTH], { main: rep(spells[0], 3), potion: [spells[0], spells[0]] }), spells[0], 'side') };
      // Gegenprobe ohne Kerthwack mit Chaos-Diamond: dieselben Kopien zaehlen (4 im Main → kein Platz im Potion Deck)
      out.chaosOhneKerth = { imDeck: window.countInDeck(deck([CHAOS], { main: rep(spells[0], 4), potion: [spells[0]] }), spells[0]),
        potion: can(deck([CHAOS], { main: rep(spells[0], 4) }), spells[0], 'potion') };

      // ── Potions zaehlen immer ──
      const p = potions[0];
      out.potions = {
        imDeck: window.countInDeck(deck([KERTH], { potion: [p, p] }), p),
        dritte: can(deck([KERTH], { potion: [p, p] }), p, 'potion'),
        // mit Nicolas: je 1 im Main und im Potion Deck = 2 → keine dritte, weder hier noch dort
        nicolasImDeck: window.countInDeck(deck([KERTH, NICOLAS], { main: [p], potion: [p] }), p),
        nicolasMain: can(deck([KERTH, NICOLAS], { main: [p], potion: [p] }), p, 'main'),
        nicolasPotion: can(deck([KERTH, NICOLAS], { main: [p], potion: [p] }), p, 'potion'),
        ohneNicolasMain: can(deck([KERTH], { potion: [p] }), p, 'main'),
      };
      // 15er-Grenze ueber Main + Potion Deck: Nicht-Potions im Potion Deck zaehlen NICHT mit
      const zehnPotions = potions.slice(0, 5).flatMap(n => [n, n]);                       // 10 Potions im Potion Deck
      const mitFuenfMain = deck([KERTH, NICOLAS], { main: potions.slice(5, 10), potion: zehnPotions });   // + 5 im Main = 15
      out.fuenfzehn = { potionNeu: can(mitFuenfMain, potions[10], 'potion'), mainNeu: can(mitFuenfMain, potions[10], 'main'),
        nichtPotion: can(mitFuenfMain, spells[0], 'potion'),
        gruende: gruende({ ...mitFuenfMain, mainDeck: [...mitFuenfMain.mainDeck, potions[10]] }).filter(t => /Combined Potions/.test(t)).length,
        zaehltNichtPotionsMit: gruende({ ...mitFuenfMain, potionDeck: [...zehnPotions, spells[0], spells[0], creatures[0]] }).filter(t => /Combined Potions/.test(t)).length };

      // ── Strenge Klausel ueberschreibt die laxe ──
      const dc = deck([CHAOS, KERTH]);
      out.chaos = { spell: can(dc, spells[0], 'potion'), creature: can(dc, creatures[0], 'potion'), potion: can(dc, potions[0], 'potion'),
        zweiteKopie: can({ ...dc, potionDeck: [spells[0]] }, spells[0], 'potion'),
        vierImMain: can({ ...dc, mainDeck: rep(spells[0], 4) }, spells[0], 'potion'),
        kerthRein: can(deck([CHAOS]), KERTH, 'hero'), chaosRein: can(deck([KERTH]), CHAOS, 'hero') };
      out.chaosZaehlung = window.countInDeck({ ...dc, mainDeck: rep(spells[0], 4), potionDeck: [spells[0]] }, spells[0]);
      const pd15 = spells.slice(0, 15);
      out.chaosLegal = gruende({ ...dc, mainDeck: Array.from({ length: 60 }, (_, i) => creatures[i % 20]).slice(0, 60), potionDeck: pd15 })
        .filter(t => /Potion/.test(t));
      out.chaosZuWenig = gruende({ ...dc, potionDeck: pd15.slice(0, 14) }).filter(t => /exactly 15/.test(t)).length;
      out.chaosZwei = gruende({ ...dc, potionDeck: [...pd15.slice(0, 14), pd15[0]] }).filter(t => /different names/.test(t)).length;
      const dp = deck([PINTA, KERTH]);
      out.pinta = { creature: can(dp, creatures[0], 'potion'), spell: can(dp, spells[0], 'potion'), potion: can(dp, potions[0], 'potion'),
        vierImMain: can({ ...dp, mainDeck: rep(creatures[0], 4) }, creatures[0], 'potion') };
      out.pintaChaosKerth = { pintaZuChaosKerth: can(deck([CHAOS, KERTH]), PINTA, 'hero'), chaosZuPintaKerth: can(deck([PINTA, KERTH]), CHAOS, 'hero') };

      // ── Legalitaet ──
      const nurPotions = (g) => g.filter(t => /Potion Deck may only contain Potions/.test(t)).length;
      out.legal = {
        ohneKerthMitCreature: nurPotions(gruende(deck([OTHER], { potion: [creatures[0], potions[0], potions[1], potions[2], potions[3]] }))),
        mitKerthMitCreature: nurPotions(gruende(deck([KERTH], { potion: [creatures[0], potions[0], potions[1], potions[2], potions[3]] }))),
        dreiKopien: gruende(deck([KERTH], { potion: [creatures[0], creatures[0], creatures[0], spells[0], spells[1]] })).filter(t => /at most 2 copies/.test(t)).length,
        zweiKopien: gruende(deck([KERTH], { potion: [creatures[0], creatures[0], spells[0], spells[1], spells[2]] })).filter(t => /at most 2 copies/.test(t)).length,
        groesse: gruende(deck([KERTH], { potion: [creatures[0], creatures[1]] })).filter(t => /0 or 5-15/.test(t)).length,
      };

      // ── Aufraeumen (Sacred Jewel): ausgenommene Kopien bleiben stehen ──
      // 5 Kopien eines Artifacts sind nur mit 4 Sacred Jewel erlaubt; faellt eines weg, kappt `trimOverLimitCopies` den Ueberhang.
      // Kerthwack-Kopien im Potion Deck zaehlen nicht und duerfen dabei NICHT als erste verschwinden.
      const a = artifacts[0];
      const gekappt = window.trimOverLimitCopies(deck([KERTH], { main: [...rep(a, 5), ...rep(JEWEL, 3)], potion: [a, a] }));
      out.trim = { main: gekappt.mainDeck.filter(n => n === a).length, potion: gekappt.potionDeck.filter(n => n === a).length };
      const ohneErl = window.trimOverLimitCopies(deck([OTHER], { main: [...rep(a, 5), ...rep(JEWEL, 3)] }));
      out.trimOhne = ohneErl.mainDeck.filter(n => n === a).length;
      // Sacred Jewel in Kerthwacks Potion Deck zaehlt NICHT zu den 4 Exemplaren
      out.jewel = { mit: window.hasSacredJewelArtifactBonus(deck([KERTH], { main: rep(JEWEL, 2), potion: [JEWEL, JEWEL] })),
        ohne: window.hasSacredJewelArtifactBonus(deck([OTHER], { main: rep(JEWEL, 4) })) };

      // ── Kopienfamilie ──
      const fam = Object.keys(C).find(n => /\[B\]$/.test(n));
      if (fam) {
        const w = fam.replace(/\[B\]$/, '[W]');
        out.familie = C[w] ? can(deck([KERTH], { potion: [fam, w] }), fam, 'potion') : null;
      }
      return out;
    });

    console.log('Was ins Potion Deck darf');
    check('ohne Kerthwack: nur Potions (Spell/Creature abgelehnt)', r.ohne.spell === false && r.ohne.creature === false && r.ohne.potion === true, r.ohne);
    check('mit Kerthwack: JEDE Karte (Spell, Creature, Artifact, Held)', r.mit.spell && r.mit.creature && r.mit.artifact && r.mit.held, r.mit);
    check('…und Potions bleiben erlaubt (Erlaubnis, kein Verbot)', r.mit.potion === true, r.mit);
    check('canCardTypeEnterSection spiegelt es (Seitenwechsel-Regel)', r.abschnitt.mit === true && r.abschnitt.ohne === false, r.abschnitt);
    check('potionPermissions: Kerthwack ja, andere Helden nein', r.perm.kerth === 1 && r.perm.ohne === 0, r.perm);

    console.log('Höchstens 2 Kopien je Karte im Potion Deck');
    check('1 Kopie darin: noch eine geht', r.kopien.eine === true, r.kopien);
    check('2 Kopien darin: die dritte nicht', r.kopien.zwei === false, r.kopien);
    check('…eine andere Karte geht weiter', r.kopien.andere === true, r.kopien);
    check('Potion Deck voll (15): auch mit Kerthwack nichts mehr', r.voll === false);

    console.log('Diese Kopien zählen nicht zum Deck');
    check('4 im Main + 2 im Potion Deck: Kopien im Deck = 4', r.zaehlung.imDeck === 4, r.zaehlung);
    check('…das Main Deck ist bei 4 trotzdem voll', r.zaehlung.mainVoll === false, r.zaehlung);
    check('…aber ins Potion Deck passt trotz 4 im Main noch eine (die Main-Grenze greift dort nicht)', r.zaehlung.potionNochMoeglich === true, r.zaehlung);
    check('3 im Main + 2 im Potion Deck: eine vierte ins Main geht (die Potion-Kopien zählen nicht)', r.zaehlung.mainNochFrei === true && r.zaehlung.side === true, r.zaehlung);
    check('Gegenprobe Chaos-Diamond OHNE Kerthwack: 4 im Main + 1 im Potion Deck = 5 Kopien, kein Platz im Potion Deck', r.chaosOhneKerth.imDeck === 5 && r.chaosOhneKerth.potion === false, r.chaosOhneKerth);
    check('Sacred Jewel im Potion Deck zählt nicht zu den 4 Exemplaren (2 Main + 2 Potion = kein Bonus); ohne Erlaubnis 4 im Main = Bonus', r.jewel.mit === false && r.jewel.ohne === true, r.jewel);
    check('Kopienfamilie ([B]/[W]) gilt auch für die Grenze von 2 im Potion Deck (je eine Kopie [B] und [W] darin: keine dritte)', r.familie === false, r.familie);

    console.log('Potions zählen immer mit');
    check('Potions im Potion Deck zählen zu den Kopien (2 → die dritte geht nicht)', r.potions.imDeck === 2 && r.potions.dritte === false, r.potions);
    check('mit Nicolas: 1 im Main + 1 im Potion Deck = 2, weder hier noch dort eine dritte', r.potions.nicolasImDeck === 2 && r.potions.nicolasMain === false && r.potions.nicolasPotion === false, r.potions);
    check('ohne Nicolas bleiben Potions aus dem Main Deck (Kerthwack öffnet das Main Deck nicht)', r.potions.ohneNicolasMain === false, r.potions);
    check('mit Nicolas: 15 Potions über Main + Potion Deck — keine weitere Potion, auch nicht ins Main Deck', r.fuenfzehn.potionNeu === false && r.fuenfzehn.mainNeu === false, r.fuenfzehn);
    check('…eine Nicht-Potion geht trotzdem ins Potion Deck (zählt nicht zu den 15)', r.fuenfzehn.nichtPotion === true, r.fuenfzehn);
    check('…die 16. Potion macht das Deck illegal („Combined Potions … 15")', r.fuenfzehn.gruende === 1, r.fuenfzehn);
    check('…Nicht-Potions im Potion Deck erhöhen diese Zahl nicht', r.fuenfzehn.zaehltNichtPotionsMit === 0, r.fuenfzehn);

    console.log('Strenge Klausel überschreibt Kerthwacks laxere');
    check('Chaos-Diamond + Kerthwack: nur Normal-/Attachment-Spells (Creature und Potion abgelehnt)', r.chaos.spell === true && r.chaos.creature === false && r.chaos.potion === false, r.chaos);
    check('…je Name eine Kopie (die zweite wird abgelehnt, obwohl Kerthwack 2 erlauben würde)', r.chaos.zweiteKopie === false, r.chaos);
    check('…Karten der Klausel zählen NICHT zu den Main-Deck-Grenzen (4 im Main, trotzdem ins Potion Deck)', r.chaos.vierImMain === true && r.chaosZaehlung === 4, [r.chaos, r.chaosZaehlung]);
    check('Kerthwack schließt Chaos-Diamond nicht aus (in beide Richtungen ins Team)', r.chaos.kerthRein === true && r.chaos.chaosRein === true, r.chaos);
    check('…die Karten für das Potion Deck bleiben streng: genau 15 und verschiedene Namen', r.chaosZuWenig === 1 && r.chaosZwei === 1, [r.chaosZuWenig, r.chaosZwei]);
    check('…ein Deck mit 15 verschiedenen Spells hat keinen Potion-Deck-Verstoß', r.chaosLegal.length === 0, r.chaosLegal);
    check('Pinta + Kerthwack: nur Creatures, Karten der Klausel zählen nicht zum Main Deck', r.pinta.creature === true && r.pinta.spell === false && r.pinta.potion === false && r.pinta.vierImMain === true, r.pinta);
    check('Chaos-Diamond und Pinta schließen einander weiter aus — auch mit Kerthwack im Team', r.pintaChaosKerth.pintaZuChaosKerth === false && r.pintaChaosKerth.chaosZuPintaKerth === false, r.pintaChaosKerth);

    console.log('Legalität');
    check('ohne Kerthwack: eine Creature im Potion Deck ist ein Verstoß', r.legal.ohneKerthMitCreature === 1, r.legal);
    check('mit Kerthwack: dieselbe Creature ist erlaubt', r.legal.mitKerthMitCreature === 0, r.legal);
    check('drei Kopien einer Karte im Potion Deck: Verstoß (höchstens 2)', r.legal.dreiKopien === 1 && r.legal.zweiKopien === 0, r.legal);
    check('die Kartenzahl bleibt 0 oder 5–15 (keine feste Zahl wie bei Chaos/Pinta)', r.legal.groesse === 1, r.legal);

    console.log('Aufräumen beim Entfernen eines Helden');
    check('Überhang (5 Kopien, nur 3 Sacred Jewel) wird im MAIN gekappt, die 2 Kopien im Potion Deck bleiben', r.trim.main === 4 && r.trim.potion === 2, r.trim);
    check('Gegenprobe ohne Kerthwack: derselbe Überhang wird gekappt', r.trimOhne === 4, r.trimOhne);
    check('keine JS-Fehler im Browser', fehler.length === 0, fehler);
    await ctx.close();
  } finally {
    await browser.close(); srv.child.kill();
  }
  process.exit(finish() ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
