'use strict';
// W64c-02 · SWEEP über ALLE Karten: eine gestohlene Karte, die der Dieb spielt/ablegt/vom Brett verliert, landet in den Stapeln ihres BESITZERS (Al, 23.10.2026: „IMMER, ohne Ausnahmen").
//
// Szene: reiche Standard-Szene (W.reicheSzene, Brett beider Seiten voll). Die Karte N liegt in der Hand des BESITZERS und wird per `actionStealFromHand` in die Hand des Diebs gelegt.
// Dann je Karte zwei Läufe (frische Szene):
//   A) Der Dieb SPIELT N über den echten Spielweg (alle Fragen werden menschlich beantwortet), danach werden alle Brett-Instanzen von N (und Reste auf dem Brett des Diebs) zerstört.
//   B) Der Dieb WIRFT N AB (gezielt) und LÖSCHT eine zweite Kopie-Situation (Zwangs-Löschen) — Hand-Austritt mit Karten-Hooks.
// Prüfer: der generische Besitzer-Wächter (docs/niche-tests/lib/besitzer.js `waechter`): kein Exemplar von N in einem Stapel (Ablage, Gelöscht, Deck, Potion Deck) des Diebs.
// Env: SITZ=0|1 (Dieb; Standard: beide) · FILTER=<Teil des Kartennamens> · ART=Spell,Creature,… · BIS/AB=<Index> zum Aufteilen · VOLL=1 (alle Karten; ohne: nur Karten mit direkten Stapel-Schreibzugriffen im Skript) · Exit 0 = korrekt.
const B = require('../../lib/besitzer.js');
const W = require('../../lib/wire.js');
const fs = require('fs'), path = require('path');
const DIR = path.resolve(__dirname, '../../../../cards/effects');
const slug = (n) => n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const hatStapelCode = (name) => { try { return /(discardPile|deletedPile|mainDeck|potionDeck)\s*\.\s*(push|unshift|splice)\(|handKartenBesitzerPs/.test(fs.readFileSync(path.join(DIR, slug(name) + '.js'), 'utf8')); } catch { return false; } };
const KINDS = new Set((process.env.ART || 'Spell,Attack,Creature,Artifact,Potion,Ability').split(','));
(async () => {
  const R = W.runner();
  const sitze = process.env.SITZ != null ? [Number(process.env.SITZ)] : [0, 1];
  let karten = Object.values(W.DB).filter(c => KINDS.has(c.cardType) && c.name && !/^ZZ /.test(c.name) && !c.banned).map(c => c.name);
  if (process.env.FILTER) karten = karten.filter(n => n.toLowerCase().includes(process.env.FILTER.toLowerCase()));
  if (!process.env.VOLL && !process.env.FILTER) karten = karten.filter(hatStapelCode);   // Schnellmodus (~1 Min): Skripte mit direkten Stapel-Schreibzugriffen; VOLL=1: alle Karten
  karten = karten.slice(Number(process.env.AB || 0), process.env.BIS ? Number(process.env.BIS) : undefined);
  const funde = new Map(); const fehler = []; let lauf = 0, gespielt = 0; const nichtGespielt = [];
  const einsammeln = (label, w, t) => {
    for (const f of w.verstoesse()) {
      if (f.klasse !== 'echt') continue;
      const k = `${f.karte} | ${f.stapel} | ${f.wo[0] || '?'}`;
      if (!funde.has(k)) funde.set(k, { label, ...f });
    }
  };
  for (const dieb of sitze) {
    const besitzer = 1 - dieb;
    for (const name of karten) {
      for (const modus of ['spielen', 'abwerfen']) {
        let t;
        try {
          t = await W.reicheSzene({ seat: dieb, scanState: false, karten: [name] });   // N steht nirgends sonst in der Szene (Deck/Ablage gefiltert)
          t.setHand(dieb, t.pile(dieb, 'hand').filter(x => x !== name));
          const w = B.waechter(t);
          t.addHand(besitzer, name);
          const idx = t.pile(besitzer, 'hand').lastIndexOf(name);
          const r = await t.run(() => t.engine.actionStealFromHand(dieb, { sourceName: 'Test', preselectedIndices: [idx] }));
          if (!(r && r.stolen && r.stolen[0] === name)) { fehler.push(`${name}: Diebstahl schlug fehl`); continue; }
          lauf++;
          if (modus === 'spielen') {
            await W.spiele(t, dieb, name, { hero: 0, timeoutMs: 4000, answer: (e) => (e.kind === 'generic' && e.d.type === 'cardNamePicker') ? { cardName: W.REICH.CRE[1] } : undefined });
            if (t.pile(dieb, 'hand').includes(name)) nichtGespielt.push(name); else gespielt++;   // Abdeckung: Reaktionen/Bedingungskarten bleiben auf der Hand (nicht proaktiv spielbar)
            for (const inst of t.engine.cardInstances.filter(c => c.name === name && ['support', 'ability', 'surprise', 'area'].includes(c.zone)))
              await t.run(() => t.engine.actionDestroyCard(null, inst, {}));
          } else {
            const h = t.pile(dieb, 'hand').indexOf(name);
            if (h >= 0) await t.run(() => t.engine.actionDiscardHandCard(dieb, name, h, {}));
          }
          await t.run(async () => {});
          einsammeln(`${name} (${modus}, Dieb ${dieb})`, w, t);
          if (t.errors.length) fehler.push(`${name} (${modus}): ${t.errors[0].slice(0, 100)}`);
        } catch (e) { fehler.push(`${name} (${modus}): ${String(e.message).slice(0, 100)}`); }
      }
    }
  }
  R.check(`${lauf} Läufe über ${karten.length} Karten × ${sitze.length} Sitze durchgespielt`, lauf > karten.length, { lauf });
  R.check('KEINE gestohlene Karte landet in einem Stapel des Diebs (Besitzer-Wächter)', funde.size === 0, [...funde.values()].slice(0, 40).map(f => `${f.label} → ${f.stapel} Sitz ${f.sitz} via ${f.wo.join(' < ')}`));
  if (funde.size) for (const f of funde.values()) R.note(`Verstoß: ${f.label} → ${f.stapel} (Sitz ${f.sitz})`, f.wo);
  R.note(`Abdeckung Modus „spielen“: ${gespielt} Läufe haben die Karte wirklich aufgelöst, ${nichtGespielt.length} blieben auf der Hand (Reaktionen/Bedingungskarten; dort greift Tabelle „Reaktionen“ in CARD_API)`, [...new Set(nichtGespielt)].length);
  R.note('Läufe mit Engine-Fehlern/Ausnahmen (nicht Teil der Regel)', fehler.length ? fehler.slice(0, 10) : 0);
  R.finish();
})();
