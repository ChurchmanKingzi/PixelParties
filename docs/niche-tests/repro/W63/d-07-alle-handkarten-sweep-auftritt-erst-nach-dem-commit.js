'use strict';
// W63d-07 · Sweep über ALLE spielbaren Handkarten (Spell/Attack/Creature/Artifact/Potion/Ability): keine Karte zeigt sich dem Gegner/Zuschauer, bevor sie committed ist (Al, 22.10.2026)
//
// Regel (CARD_API „Auftritt streamen — erst nach dem Commit"). Dieser Sweep ist der Wächter dafür, dass neue Karten die Regel nicht wieder brechen: jede Karte, deren Skript überhaupt eine abbrechbare Frage
//   enthalten KANN (`cancellable`, Zielwahl-Vertrag), wird in der reichen Standard-Szene über den echten Spielweg gespielt (MENSCH-Modus, Leitung zu Gegner und Zuschauer aufgezeichnet):
//   ein Durchlauf, dann je ein Abbruch ab jeder abbrechbaren Stelle (ab dort durchgehend abbrechen). Gilt als LECK, wenn nach einem Abbruch, der die Karte auf der Hand zurücklässt, irgendetwas über die Karte
//   (Ereignis, Protokollzeile, Flug, Kartenname im Zustand) an Gegner oder Zuschauer ging. (Fragen NACH dem Verbrauch der Karte sind keine Abbruchstellen des Spiels und zählen nicht.)
// Bekannte, dokumentierte Ausnahme (CARD_API „Welle 63 / W63d", Audit-Tabelle): Forceful Revival × Kreatur mit abbrechbarer Beschwörungs-Opferwahl (die Beschwörungsanimation läuft vor der Opferwahl der wiederbelebten Karte).
// Exit 0 = korrekt.
const fs = require('fs'), path = require('path');
const W = require('../../lib/wire.js');
const AUSNAHMEN = new Set(['Forceful Revival']);
const kinds = new Set(['Spell', 'Attack', 'Creature', 'Artifact', 'Potion', 'Ability']);
const DIR = path.resolve(__dirname, '../../../../cards/effects');
const kannAbbrechen = (name) => {
  const f = path.join(DIR, name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') + '.js');
  try { const src = fs.readFileSync(f, 'utf8'); return /cancellable|isTargetingArtifact|getValidTargets|payActivationCost|payArtifactCost|paySummonCost|beforeSummon/.test(src); } catch { return false; }
};
(async () => {
  const R = W.runner();
  const karten = Object.values(W.DB).filter(c => kinds.has(c.cardType) && c.name && !/^ZZ /.test(c.name) && kannAbbrechen(c.name));
  let geprueft = 0, mitAbbruch = 0; const lecks = [], fehler = [];
  for (const c of karten) {
    let t;
    try {
      t = await W.reicheSzene({ seat: 0, karten: [c.name] });
      const clean = await W.spiele(t, 0, c.name, { hero: 0, timeoutMs: 6000, answer: (e) => (e.kind === 'generic' && e.d.type === 'cardNamePicker') ? { cardName: W.REICH.CRE[1] } : undefined });
      geprueft++;
      const nCanc = clean.tl.filter(e => e.k === 'answer-begin' && e.cancellable).length;
      for (let k = 0; k < Math.min(nCanc, 4); k++) {
        const t2 = await W.reicheSzene({ seat: 0, karten: [c.name] });
        const r = await W.spiele(t2, 0, c.name, { hero: 0, timeoutMs: 6000, cancelAt: k, persist: true });
        mitAbbruch++;
        if (r.undone && (r.appearances.length > 0 || r.stateLeaks.length > 0)) lecks.push(`${c.name} (Abbruch an Stelle ${k}: ${r.appearances.length} Sendungen, ${r.stateLeaks.length} Zustände)`);
        if (t2.errors.length) fehler.push(`${c.name}@${k}: ${t2.errors[0].slice(0, 120)}`);
      }
      if (t.errors.length) fehler.push(`${c.name}: ${t.errors[0].slice(0, 120)}`);
    } catch (e) { fehler.push(`${c.name}: ${String(e.message).slice(0, 100)}`); }
  }
  R.check(`${karten.length} Karten mit möglicher Abbruchfrage durchgespielt (${geprueft} Durchläufe, ${mitAbbruch} Abbruch-Läufe)`, geprueft > 500, { geprueft });
  const echte = lecks.filter(l => !AUSNAHMEN.has(l.replace(/ \(Abbruch.*$/, '')));
  R.check('KEINE Karte zeigt sich dem Gegner/Zuschauer vor dem Commit (außer der dokumentierten Ausnahme)', echte.length === 0, echte.slice(0, 20));
  R.check('die Ausnahme ist noch die einzige (sonst: Ausnahme streichen)', lecks.length - echte.length <= AUSNAHMEN.size * 6, lecks.filter(l => AUSNAHMEN.has(l.replace(/ \(Abbruch.*$/, ''))));
  R.check('keine Engine-Fehler in den Läufen', fehler.length === 0, fehler.slice(0, 8));
  R.finish();
})();
