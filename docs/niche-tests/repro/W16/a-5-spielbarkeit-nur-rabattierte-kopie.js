'use strict';
// W16a · Punkt 5 · Al, 19.10.2026: „Soll der Client bei Kopien gleichen Namens nur die rabattierte Kopie hervorheben?" — „Hervorheben *für den Rabatt-Effekt*? Dann nur die rabattierte Karte!"
// Erwartet: Wirkt in der Hand ein Kopien-Rabatt (Divine Gift of Magic, Fiona: `ps._handLevelOffsetsTransient[handIdx]`), liefert der Server die Spielbarkeit zusätzlich JE HANDINDEX
//   (`getHeroPlayableCards(pi).kopien.own|charmed[handIdx] = [heroIdx …]`), und der Client (`canHeroPlayCard`/`canActionCardBePlayed` in `public/app-board.jsx`) nimmt für diese Handkarte NUR diese Liste:
//   leuchtet nur die rabattierte Kopie, die anderen bleiben gedimmt. OHNE Rabatt fehlt der Block und alles bleibt bei der Namensliste (Verhalten unverändert).
// Der Client-Teil wird hier aus dem Quelltext gezogen und mit der echten Server-Liste ausgeführt (keine Browser-Umgebung nötig). Exit 0 = korrekt.
const fs = require('fs');
const path = require('path');
const H = require('../../lib/h.js');
const fbIdx = (ps) => ps.hand.map((n, i) => n === 'Fireball' ? i : -1).filter(i => i >= 0);
(async () => {
  const R = H.runner();

  // ── Client-Funktionen aus dem Quelltext ziehen ──
  const src = fs.readFileSync(path.join(__dirname, '../../../../public/app-board.jsx'), 'utf8');
  const hole = (kopf) => {
    const a = src.indexOf(kopf);
    if (a < 0) throw new Error('nicht gefunden: ' + kopf);
    const b = src.indexOf('\n  };\n', a);
    return src.slice(a, b + 5);
  };
  const clientFns = (me, opp, myIdx, gameState) => new Function('me', 'opp', 'myIdx', 'gameState',
    hole('  const canHeroPlayCard = (playerData, heroIdx, card, handIdx) =>') + '\n' +
    hole('  const canCreatureBePlayed = (card) =>') + '\n' +
    hole('  const canActionCardBePlayed = (card, handIdx) =>') + '\n' +
    'return { canHeroPlayCard, canActionCardBePlayed };')(me, opp, myIdx, gameState);

  R.section('Server: Liste je Handindex, wenn ein Kopien-Rabatt wirkt (Fireball ×3, Rabatt −3 auf die zweite Kopie; Held 0 hat Magic Arts, kein Destruction — Stufe 2 −3 = 0 ist für jeden Helden spielbar)');
  {
    const t = await H.fresh({ hand: [['Fireball', 'Fireball', 'Fireball'], []], abilities: { 0: { 0: [['Magic Arts'], [], []] } } });
    const ps = t.gs.players[0];
    const kontrolle = t.engine.getHeroPlayableCards(0);
    R.check('Kontrolle ohne Rabatt: Fireball ist für keinen Helden spielbar, KEIN `kopien`-Block', !(kontrolle.own[0] || []).includes('Fireball') && kontrolle.kopien === undefined, { own: kontrolle.own, kopien: kontrolle.kopien });
    const idx = fbIdx(ps);
    ps._handLevelOffsetsTransient = { [idx[1]]: -3 };   // genau das, was Divine Gift of Magic / Fiona schreiben
    ps._handLevelOffsetsExpireTurn = { [idx[1]]: t.gs.turn };
    const L = t.engine.getHeroPlayableCards(0);
    R.check('Namensliste bleibt wie bisher: Fireball spielbar, wenn IRGENDEINE Kopie es ist', (L.own[0] || []).includes('Fireball'), L.own);
    R.check('Block `kopien` vorhanden: je Handindex ein Eintrag', !!L.kopien && idx.every(i => Array.isArray(L.kopien.own[i])), L.kopien);
    R.check('nur die rabattierte Kopie ist für Held 0 spielbar (erste und dritte nicht)', L.kopien.own[idx[0]].length === 0 && L.kopien.own[idx[1]].includes(0) && L.kopien.own[idx[2]].length === 0, L.kopien.own);
    R.check('die rabattierte Kopie (Stufe 0) ist für JEDEN Helden spielbar, die anderen Kopien für keinen', L.kopien.own[idx[1]].join() === '0,1,2' && L.kopien.own[idx[0]].length === 0 && L.kopien.own[idx[2]].length === 0, L.kopien.own);

    // ── Client auf Basis der echten Serverliste ──
    const gameState = { heroPlayableCards: L };
    const me = { hand: ps.hand.slice(), heroes: ps.heroes }, opp = { heroes: [] };
    const { canHeroPlayCard, canActionCardBePlayed } = clientFns(me, opp, 0, gameState);
    const card = { name: 'Fireball', cardType: 'Spell' };
    R.check('Client: Handkarten-Glühen je Kopie — nur die rabattierte leuchtet', !canActionCardBePlayed(card, idx[0]) && canActionCardBePlayed(card, idx[1]) && !canActionCardBePlayed(card, idx[2]), idx.map(i => canActionCardBePlayed(card, i)));
    R.check('Client: Held 0 darf mit der rabattierten Kopie, mit den anderen nicht', canHeroPlayCard(me, 0, card, idx[1]) && !canHeroPlayCard(me, 0, card, idx[0]) && !canHeroPlayCard(me, 0, card, idx[2]), null);
    R.check('Client ohne Handindex (Namensabfrage): wie bisher, Held 0 darf', canHeroPlayCard(me, 0, card) === true && canActionCardBePlayed(card) === true, null);
    // Gegenprobe: ohne `kopien` (kein Rabatt) bleibt es bei der Namensliste für alle Kopien
    const ohne = { heroPlayableCards: { own: { 0: ['Fireball'], 1: [], 2: [] }, charmed: {} } };
    const c2 = clientFns(me, opp, 0, ohne);
    R.check('Client ohne `kopien`: alle Kopien leuchten wie bisher (Namensliste)', idx.every(i => c2.canActionCardBePlayed(card, i)), null);
    // Hand und Liste passen nicht mehr zusammen (z. B. Hand umsortiert, Liste noch alt) → Namensliste statt falscher Treffer
    const c3 = clientFns({ hand: ['ZZ Dummy', 'ZZ Dummy', 'ZZ Dummy'], heroes: ps.heroes }, opp, 0, gameState);
    R.check('Client: steht an dem Index eine andere Karte, gilt die Namensliste', c3.canHeroPlayCard({ hand: [] }, 0, card, idx[1]) === c3.canHeroPlayCard({ hand: [] }, 0, card), null);

    // Server verweigert die falsche Kopie weiterhin (W15b), die rabattierte spielt
    const rFalsch = await t.play(0, 'Fireball', { hero: 0, noGrant: true, keepActions: true, handIndex: idx[0] });
    const rRichtig = await t.play(0, 'Fireball', { hero: 0, noGrant: true, keepActions: true, handIndex: idx[1] });
    R.check('Spielweg: falsche Kopie abgelehnt, rabattierte gespielt', rFalsch === false && rRichtig === true && ps.hand.filter(n => n === 'Fireball').length === 2, { rFalsch, rRichtig });
    const nachher = t.engine.getHeroPlayableCards(0);
    R.check('Nach dem Spielen ist der Rabatt weg: kein `kopien`-Block mehr, Fireball für niemanden spielbar', nachher.kopien === undefined && !(nachher.own[0] || []).includes('Fireball'), { kopien: nachher.kopien, own: nachher.own });
    R.check('keine Fehler / sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }

  R.section('Wenn der Held die Karte auch OHNE Rabatt spielen darf, leuchten alle Kopien (der Rabatt ändert dann nichts)');
  {
    const t = await H.fresh({ hand: [['Fireball', 'Fireball'], []], abilities: { 0: { 0: [['Destruction Magic', 'Destruction Magic'], [], []] } } });
    const ps = t.gs.players[0];
    const idx = fbIdx(ps);
    ps._handLevelOffsetsTransient = { [idx[1]]: -3 };
    ps._handLevelOffsetsExpireTurn = { [idx[1]]: t.gs.turn };
    const L = t.engine.getHeroPlayableCards(0);
    R.check('beide Kopien für Held 0 spielbar', L.kopien.own[idx[0]].includes(0) && L.kopien.own[idx[1]].includes(0), L.kopien);
  }

  R.section('Nur Namen mit ≥ 2 Kopien bekommen Einträge; eine einzige rabattierte Kopie braucht keine Indexliste');
  {
    const t = await H.fresh({ hand: [['Fireball', 'ZZ Filler'], []], abilities: { 0: { 0: [['Magic Arts'], [], []] } } });
    const ps = t.gs.players[0];
    ps._handLevelOffsetsTransient = { 0: -3 };
    ps._handLevelOffsetsExpireTurn = { 0: t.gs.turn };
    const L = t.engine.getHeroPlayableCards(0);
    R.check('einzelne Kopie: Namensliste genügt, kein `kopien`', L.kopien === undefined && (L.own[0] || []).includes('Fireball'), L);
  }

  R.section('Server-Zustand an den Client: `heroPlayableCards` kommt unverändert aus `getHeroPlayableCards`');
  {
    const server = fs.readFileSync(path.join(__dirname, '../../../../server.js'), 'utf8');
    R.check('server.js reicht das Ergebnis (inkl. `kopien`) durch', /heroPlayableCards: room\.engine \? room\.engine\.getHeroPlayableCards\(playerIdx\)/.test(server), null);
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
