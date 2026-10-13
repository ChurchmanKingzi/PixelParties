'use strict';
// F03-artifacts-08 · Slippery Fridge umgeht die Ausrüst-Regeln: Je-Held-Limits (Wanted Poster, Vampiric Sword) und gefrorene Zielhelden
// Kartentexte: Slippery Fridge „… equip them to a different Hero the same player controls (without paying their Cost again)."
//              Wanted Poster „A Hero can only have 1 "Wanted Poster" equipped to it." · Vampiric Sword „You can only equip 1 "Vampiric Sword" to any Hero."
// Regel (CARD_API.md Z. ~18921 „Je-Held-Sperren … zählen"; `_hooks.heroCanBeEquipped`: tot/gefroren sperrt das Ausrüsten): Ausrüsten läuft über `canEquipCardToHero` und `heroCanBeEquipped`.
// Erwartung: B) Poster von Held 0 → Held 1, der schon ein Poster trägt: nicht möglich (Ziel nicht angeboten/abgelehnt). C) dasselbe mit Vampiric Sword. F) Ziel ist gefroren: nicht wählbar.
// Beobachtet (✗): Das Ziel wird angeboten und die Ausrüstung dort abgelegt: Held 1 trägt 2 Poster / 2 Schwerter bzw. die Ausrüstung liegt auf dem gefrorenen Helden.
// Ursache: `cards/effects/slippery-fridge.js` Schritt 3 („destTargets") prüft nur Lebendigkeit und freie Zonen – weder `engine.canEquipCardToHero` noch `heroCanBeEquipped`.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const SF = 'Slippery Fridge';
  const mv = async (t, srcHi, equipName, destHi) => {
    t.targetFn = (valid, cfg) => {
      const ti = (cfg && cfg.title) || '';
      if (ti === SF) { const v = valid.find(v => v.type === 'equip' && v.cardName === equipName && v.heroIdx === srcHi); return v ? [v.id] : undefined; }
      if (/Slippery Fridge — Move/.test(ti)) { const v = valid.find(v => v.type === 'equip' && v.heroIdx === destHi) || valid.find(v => v.type === 'hero' && v.heroIdx === destHi); return v ? [v.id] : undefined; }
      return undefined;
    };
    return t.play(0, SF);
  };
  const count = (t, name, hi) => [0, 1, 2].filter(s => t.zone(0, hi, s) === name).length;
  for (const [fall, eq, gold] of [['B', 'Wanted Poster', 100], ['C', 'Vampiric Sword', 200]]) {
    const t = await H.fresh({ hand: [[eq, eq, SF], []], gold });
    await t.play(0, eq, { hero: 0, slot: 0 });
    await t.play(0, eq, { hero: 1, slot: 0 });
    R.check(`${fall}) Aufbau: Held 0 und Held 1 tragen je 1 ${eq}`, count(t, eq, 0) === 1 && count(t, eq, 1) === 1, [count(t, eq, 0), count(t, eq, 1)]);
    await mv(t, 0, eq, 1);
    R.check(`${fall}) kein Held trägt 2 ${eq}`, [0, 1, 2].every(h => count(t, eq, h) <= 1), [0, 1, 2].map(h => count(t, eq, h)));
  }
  const t = await H.fresh({ hand: [['Warhorse', SF], []], gold: 100 });
  await t.play(0, 'Warhorse', { hero: 0, slot: 0 });
  t.heroStatus(0, 1, 'frozen'); t.heroStatus(0, 2, 'frozen');
  await mv(t, 0, 'Warhorse', 1);
  R.check('F) Ausrüstung liegt nicht auf einem gefrorenen Helden', ![1, 2].some(h => count(t, 'Warhorse', h) > 0), [0, 1, 2].map(h => count(t, 'Warhorse', h)));
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
