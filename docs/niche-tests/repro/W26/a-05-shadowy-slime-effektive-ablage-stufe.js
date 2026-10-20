'use strict';
// W26a · Entscheidung Al (21.10.2026, N4, Frage 6 „das effektive Level"): Shadowy Slime („… place a level 0 Creature from your discard pile …") liest die WIRKSAME Stufe der Ablagekarte
// (`engine.effectiveCardLevel(cd, pi, { pileSide: 'discard' })`: Lethe-Stempel o. ä.), nicht die gedruckte – wie Cloudy Slime in der Hand (W24d, N4-11).
// Aufbau: Ablage [Fiery Slime (Lv0), Rocky Slime (Lv0), Bomblebee (Lv1)]; Lethes Welle (`applyLetheStampWave`) stempelt die Creatures der Ablage +1 → keine Karte ist mehr Stufe 0.
// Danach legt die Ablage eine NEUE Fiery-Slime-Kopie obenauf (Neuankunft beginnt bei 0) – sie ist Stufe 0.
// Erwartung: ohne Stempel [Fiery Slime, Rocky Slime]; nach der Welle nichts (Effekt fizzelt, keine Galerie); mit frischer Kopie nur Fiery Slime.
// Aufruf: node docs/niche-tests/repro/W26/a-05-shadowy-slime-effektive-ablage-stufe.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
async function lauf(seat, modus) {
  const hand = [[], []]; hand[seat] = ['Shadowy Slime'];
  const discard = [[], []]; discard[seat] = ['Fiery Slime', 'Rocky Slime', 'Bomblebee'];
  const t = await H.fresh({ active: seat, hand, discard, deckSize: 30 });
  t.setAbilities(seat, 0, [['Summoning Magic'], [], []]);
  if (modus !== 'ohne') await t.run(() => t.engine.applyLetheStampWave(seat));
  if (modus === 'frisch') t.gs.players[seat].discardPile.push('Fiery Slime');
  let galerie = null;
  t.script.push({ match: d => d.type === 'confirm' && /Shadowy/.test(d.title || ''), answer: () => ({ confirmed: true }) });
  t.script.push({ match: d => d.type === 'cardGallery' && /Shadowy/.test(d.title || ''), answer: (d) => { galerie = d.cards.map(c => c.name); return null; } });
  const r = await t.play(seat, 'Shadowy Slime', { hero: 0, slot: 0 });
  return { t, galerie, r, stufen: t.gs.players[seat].discardPile.map(n => [n, t.engine.effectiveCardLevel(t.engine._getCardDB()[n], seat, { pileSide: 'discard' })]) };
}
(async () => {
  const R = H.runner();
  for (const seat of [0, 1]) {
    R.section(`Sitz ${seat}`);
    const k = await lauf(seat, 'ohne');
    R.check('Gegenprobe (ohne Stempel): Galerie = [Fiery Slime, Rocky Slime], Bomblebee (Lv1) fehlt zu Recht', JSON.stringify(k.galerie) === '["Fiery Slime","Rocky Slime"]', { g: k.galerie, r: k.r });
    R.check('sauber', k.t.errors.length === 0 && k.t.audit().length === 0, { e: k.t.errors, a: k.t.audit() });
    const w = await lauf(seat, 'welle');
    R.check('Aufbau: nach Lethes Welle sind alle Ablagekarten wirksam Stufe ≥ 1', w.stufen.every(([, l]) => l >= 1), w.stufen);
    R.check('nach der Welle: keine Stufe-0-Kreatur in der Ablage → keine Galerie', w.galerie === null, w.galerie);
    R.check('sauber', w.t.errors.length === 0 && w.t.audit().length === 0, { e: w.t.errors, a: w.t.audit() });
    const f = await lauf(seat, 'frisch');
    R.check('frische Kopie nach der Welle (wirksam Stufe 0): Galerie = [Fiery Slime]', JSON.stringify(f.galerie) === '["Fiery Slime"]', { g: f.galerie, st: f.stufen });
    R.check('sauber', f.t.errors.length === 0 && f.t.audit().length === 0, { e: f.t.errors, a: f.t.audit() });
  }
  R.finish();
})();
