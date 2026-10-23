'use strict';
// W64c-05 · SWEEP über ALLE Karten: kein Effekt legt eine Karte des Gegners (Hand, Brett, Deck, Ablage, Potion Deck) oder eine übernommene Kreatur in einen Stapel eines Nicht-Besitzers (Al, 23.10.2026: „IMMER, ohne Ausnahmen")
//
// Szene (jeder Name kommt nur bei EINEM Spieler vor — außer den Platzhaltern): der Spieler `A` spielt die Karte N; der Gegner `Y` hat 3 Handkarten, 3 Brettkreaturen + 1 Ausrüstung, eigenes Deck/Ablage/Potion Deck mit eigenen Namen,
// und `A` kontrolliert dauerhaft eine Y-Kreatur (`ZZ Dummy Frail`, übernommen per `actionTransferCreature`). Danach `endTurn` ×2 (volle Runde: Zugende-Hooks, Rückkehr-Effekte).
// Zielwahl-Politiken je Karte: 'erste' (erstes zulässiges Ziel) · 'gegner' (bevorzugt Ziele des Gegners) · 'uebernommen' (bevorzugt die übernommene Kreatur).
// Prüfer: der generische Besitzer-Wächter (lib/besitzer.js `waechter`): ein Exemplar eines Namens in einem Stapel eines Spielers, dem es nicht gehört, ist ein Verstoß.
// Standard (schnell, ~1 Min): nur Karten, deren Skript direkte Stapel-Schreibzugriffe (push/unshift/splice) enthält; VOLL=1: ALLE Karten (~10 Min, in Kapiteln per ART=Spell …). Env: SITZ=0|1 · FILTER=<Name> · ART=Spell,Creature,…  Exit 0 = korrekt.
const fs = require('fs'), path = require('path');
const B = require('../../lib/besitzer.js');
const { H } = B;
const DIR = path.resolve(__dirname, '../../../../cards/effects');
const slug = (n) => n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const SCHREIBT = /(discardPile|deletedPile|mainDeck|potionDeck)\s*\.\s*(push|unshift|splice)\(|handKartenBesitzerPs/;   // Schnellmodus: Karten-Skripte mit direkten Stapel-Schreibzugriffen
const hatStapelCode = (name) => { try { return SCHREIBT.test(fs.readFileSync(path.join(DIR, slug(name) + '.js'), 'utf8')); } catch { return false; } };
const KINDS = new Set((process.env.ART || 'Spell,Attack,Creature,Artifact,Potion,Ability').split(','));
const DB = H.DB;
const pool = (f, n) => Object.values(DB).filter(f).slice(0, n).map(c => c.name);
const POOL = {
  cre: pool(c => c.cardType === 'Creature' && c.level === 0 && (c.subtype || '') === 'Normal' && !/^ZZ /.test(c.name), 40),
  spl: pool(c => c.cardType === 'Spell' && (c.subtype || '') === 'Normal' && c.level === 0, 40),
  eq: pool(c => c.cardType === 'Artifact' && (c.subtype || '') === 'Equipment', 20),
  art: pool(c => c.cardType === 'Artifact' && (c.subtype || '') === 'Normal', 20),
  pot: pool(c => c.cardType === 'Potion', 20),
};
(async () => {
  const R = H.runner();
  const sitze = process.env.SITZ != null ? [Number(process.env.SITZ)] : [0, 1];
  let karten = Object.values(DB).filter(c => KINDS.has(c.cardType) && c.name && !/^ZZ /.test(c.name) && !c.banned).map(c => c.name);
  if (process.env.FILTER) karten = karten.filter(n => n.toLowerCase().includes(process.env.FILTER.toLowerCase()));
  if (!process.env.VOLL && !process.env.FILTER) karten = karten.filter(hatStapelCode);
  const POL = ['erste', 'gegner', 'uebernommen'];
  const funde = new Map(); const fehler = []; let lauf = 0;
  for (const A of sitze) {
    const Y = 1 - A;
    for (const name of karten) for (const pol of POL) {
      try {
        const nimm = (arr, k, n) => arr.filter(x => x !== name).slice(k, k + n);
        const mk = (s) => ({ hand: nimm(POOL.spl, s * 10, 3), deck: [...nimm(POOL.art, s * 5, 5), ...Array(10).fill('ZZ Dummy')], discard: nimm(POOL.cre, s * 10 + 6, 2), pot: nimm(POOL.pot, s * 5, 2), cre: nimm(POOL.cre, s * 10, 3), eq: nimm(POOL.eq, s * 3, 1) });
        const sc = [mk(0), mk(1)];
        const hand = [sc[0].hand.slice(), sc[1].hand.slice()]; hand[A] = [name, ...hand[A]];
        const t = await H.fresh({ gold: [300, 300], active: A, hand, deck: [sc[0].deck, sc[1].deck], discard: [sc[0].discard, sc[1].discard], potionDeck: [sc[0].pot, sc[1].pot] });
        const w = B.waechter(t);
        t.put(A, 0, 0, 'ZZ Dummy Big').turnPlayed = 1; t.put(A, 1, 0, sc[A].cre[0]).turnPlayed = 1;
        t.put(Y, 0, 0, sc[Y].cre[0]).turnPlayed = 1; t.put(Y, 1, 0, sc[Y].cre[1]).turnPlayed = 1; t.put(Y, 1, 1, 'ZZ Dummy Big').turnPlayed = 1; t.put(Y, 2, 1, sc[Y].eq[0]);
        const fr = t.put(Y, 2, 0, 'ZZ Dummy Frail'); fr.turnPlayed = 1;
        await t.run(() => t.engine.actionTransferCreature(fr, A, 2, 0, {}));
        t.targetFn = (valid) => {
          const need = 1;
          let l = valid;
          if (pol === 'gegner') l = [...valid.filter(v => v.owner === Y), ...valid.filter(v => v.owner !== Y)];
          if (pol === 'uebernommen') l = [...valid.filter(v => v.cardName === 'ZZ Dummy Frail'), ...valid];
          return l.slice(0, need).map(v => v.id);
        };
        lauf++;
        await t.play(A, name, { hero: 0, timeoutMs: 4000 });
        for (let r = 0; r < 2; r++) { t.reset(); await t.endTurn({ timeoutMs: 4000 }); }
        for (const f of w.echte()) { const k = `${f.karte} | ${f.stapel} | ${f.wo[0] || '?'}`; if (!funde.has(k)) funde.set(k, { label: `${name} (${pol}, Spieler ${A})`, ...f }); }
        if (t.errors.length) fehler.push(`${name} (${pol}): ${t.errors[0].slice(0, 100)}`);
      } catch (e) { fehler.push(`${name} (${pol}): ${String(e.message).slice(0, 100)}`); }
    }
  }
  R.check(`${lauf} Läufe über ${karten.length} Karten × ${sitze.length} Sitze × ${POL.length} Zielwahl-Politiken durchgespielt`, lauf > karten.length, { lauf });
  R.check('KEINE Karte (Gegnerkarte, übernommene Kreatur) landet in einem Stapel eines Nicht-Besitzers (Besitzer-Wächter)', funde.size === 0, [...funde.values()].slice(0, 40).map(f => `${f.label}: ${f.karte} → ${f.stapel} Sitz ${f.sitz} via ${f.wo.join(' < ')}`));
  R.note('Läufe mit Engine-Fehlern/Ausnahmen (nicht Teil der Regel)', fehler.length ? fehler.slice(0, 8) : 0);
  R.finish();
})();
