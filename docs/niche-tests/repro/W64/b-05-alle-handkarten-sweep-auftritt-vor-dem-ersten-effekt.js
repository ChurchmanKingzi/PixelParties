'use strict';
// W64b-05 · Sweep über ALLE spielbaren Handkarten: der Auftritt kommt bei Gegner UND Zuschauer VOR dem ersten Effekt (Al, 23.10.2026)
//
// Jede Karte (Spell, Attack, Artifact, Potion, Ability; Creature s. u.) wird in der reichen Standard-Szene über den echten Spielweg gespielt (MENSCH-Modus, alle Fragen zustimmend beantwortet; Leitungs-Harness).
// Gilt als VERSTOSS, wenn Gegner oder Zuschauer vor dem Auftritt (card_reveal / Karten-Protokollzeile / Flug) a) ein Effekt-Ereignis, b) eine Effekt-Protokollzeile oder c) einen veränderten Zustand
// (Brett, Hand, Stapel, Gold, Status, Sperren) erhalten. Ausnahme: KREATUREN mit Beschwörungskosten (Opfer, Schaden, Bleed …) — ihr Auftritt ist die Landung, die Kosten laufen davor (offene Frage an Al).
// Der Wächter für „Abbruch → nichts gesehen" bleibt W63/d-07; dieser Sweep ist der Wächter für die Reihenfolge. Exit 0 = korrekt.
const W = require('../../lib/wire.js');
const kinds = new Set(['Spell', 'Attack', 'Creature', 'Artifact', 'Potion', 'Ability']);
(async () => {
  const R = W.runner();
  const karten = Object.values(W.DB).filter(c => kinds.has(c.cardType) && c.name && !/^ZZ /.test(c.name));
  let gespielt = 0, mitAuftritt = 0, geprueft = 0, kreaturen = 0; const verstoesse = [], fehler = [];
  for (const c of karten) {
    try {
      const t = await W.reicheSzene({ seat: 0, karten: [c.name] });
      const r = await W.spiele(t, 0, c.name, { hero: 0, timeoutMs: 6000, answer: (e) => (e.kind === 'generic' && e.d.type === 'cardNamePicker') ? { cardName: W.REICH.CRE[1] } : undefined });
      if (t.errors.length) fehler.push(`${c.name}: ${t.errors[0].slice(0, 120)}`);
      if (!(r.handNachher < r.handVorher)) continue;     // in dieser Szene nicht spielbar / nicht gespielt
      gespielt++;
      const pro = r.pro || {};
      if (!Object.values(pro).some(p => p.R >= 0)) continue;     // verdeckt gelegt (Surprise) o. Ä.: kein Auftritt
      mitAuftritt++;
      if (c.cardType === 'Creature') { kreaturen++; continue; }
      geprueft++;
      for (const [sid, p] of Object.entries(pro)) if (p.R >= 0 && !p.vorEffekt) verstoesse.push(`${c.name} (${sid}: Auftritt ${p.R}, Ereignis ${p.ereignis}, Zeile ${p.effektLog}, Zustand ${p.wechsel})`);
    } catch (e) { fehler.push(`${c.name}: ${String(e.message).slice(0, 100)}`); }
  }
  R.check(`${karten.length} Karten in der Standardszene gespielt (${gespielt} gespielt, ${mitAuftritt} mit Auftritt, ${geprueft} Nicht-Kreaturen geprüft, ${kreaturen} Kreaturen ausgenommen)`, geprueft > 400, { gespielt, mitAuftritt, geprueft });
  R.check('KEINE Karte zeigt Gegner oder Zuschauer vor dem Auftritt einen Effekt (Ereignis, Zeile, Zustandswechsel)', verstoesse.length === 0, verstoesse.slice(0, 30));
  R.check('keine Engine-Fehler in den Läufen', fehler.length === 0, fehler.slice(0, 8));
  R.finish();
})();
