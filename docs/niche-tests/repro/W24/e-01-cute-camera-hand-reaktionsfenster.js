'use strict';
// W24e · N5-04 (Cute Camera in den Hand-Reaktionsfenstern der Engine). Prüft über das Befund-Repro hinaus:
//  (1) Post-Target-Fenster (MOE Shield): Ja → negiert, Ja zum +3-Gold-Aufschlag → 7 Gold, Kamera in der Ablage; Ja ohne Aufschlag → 4 Gold;
//  (2) Ablehnen → Kamera bleibt auf der Hand, kein Gold weg, MOE Shield wirkt (0 Schaden);
//  (3) zu wenig Gold (3) → kein Angebot; (4) Pre-Damage-Fenster (Bamboo Shield, Artifact): Kamera negiert die Reaction, der Schaden fällt;
//  (5) Der Gegner hält eine eigene Kamera: sie darf der ersten begegnen (ohne +3), mit +3 nicht.
// Aufruf: node docs/niche-tests/repro/W24/e-01-cute-camera-hand-reaktionsfenster.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const KAM = 'Cute Camera';
const istKamera = (d) => d.type === 'confirm' && d.title === KAM && d._kameraHandFenster;
const istPlus3 = (d) => d.type === 'confirm' && d.title === KAM && !d._kameraHandFenster;
async function lauf(seat, { rx = 'MOE Shield', gold = 100, kamera = 'ja', plus3 = false, oppHand = null }) {
  const opp = 1 - seat;
  const hand = [[], []]; hand[seat] = ['Fireball', KAM]; hand[opp] = oppHand || [rx];
  const t = await H.fresh({ active: seat, hand });
  t.setGold(seat, gold);
  t.grantFor(opp, 0, rx);
  t.policy.confirm = true;
  t.script.push({ match: istKamera, answer: () => (kamera === 'ja' ? { confirmed: true } : null) });
  t.script.push({ match: istPlus3, answer: () => (plus3 ? { confirmed: true } : null) });
  t.targetFn = (v) => { const h = v.find(x => x.type === 'hero' && x.owner === opp && x.heroIdx === 0); return h ? [h.id] : undefined; };
  const hp0 = t.hp(opp, 0);
  await t.play(seat, 'Fireball', { hero: 0, keepActions: true });
  return { t, schaden: hp0 - t.hp(opp, 0), opp };
}
(async () => {
  const R = H.runner();
  for (const seat of [0, 1]) {
    R.section(`Sitz ${seat}`);
    { const { t, schaden } = await lauf(seat, { plus3: true });
      R.check('MOE Shield (Post-Target), Kamera mit +3: negiert → Fireball trifft', schaden === 150, { schaden });
      R.check('Kamera in der Ablage, Gold −7 (Fireball kostet kein Gold)', t.pile(seat, 'discardPile').includes(KAM) && t.gs.players[seat].gold === 93, { gold: t.gs.players[seat].gold, abl: t.pile(seat, 'discardPile') });
      R.check('sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() }); }
    { const { t, schaden } = await lauf(seat, { plus3: false });
      R.check('Kamera ohne +3: negiert, Gold −4', schaden === 150 && t.gs.players[seat].gold === 96, { schaden, gold: t.gs.players[seat].gold });
      R.check('sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() }); }
    { const { t, schaden } = await lauf(seat, { kamera: 'nein' });
      R.check('Kamera abgelehnt: MOE Shield wirkt (0 Schaden), Kamera bleibt auf der Hand, Gold unberührt', schaden === 0 && t.pile(seat, 'hand').includes(KAM) && t.gs.players[seat].gold === 100, { schaden, gold: t.gs.players[seat].gold });
      R.check('sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() }); }
    { const { t, schaden } = await lauf(seat, { gold: 3 });
      R.check('3 Gold (Kamera kostet 4): kein Angebot, MOE Shield wirkt', schaden === 0 && !t.prompts.some(p => p.pi === seat && p.d.title === KAM), { schaden });
      R.check('sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() }); }
    { const { t, schaden } = await lauf(seat, { rx: 'Bamboo Shield' });
      R.check('Bamboo Shield (Pre-Damage-Fenster): Kamera negiert die Reaction → Fireball trifft', schaden === 150 && t.pile(seat, 'discardPile').includes(KAM), { schaden, abl: t.pile(seat, 'discardPile') });
      R.check('sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() }); }
    for (const plus3 of [false, true]) {   // der Gegner hält zusätzlich eine eigene Kamera
      const { t, schaden, opp } = await lauf(seat, { plus3, oppHand: ['MOE Shield', KAM] });
      const oppFragt = t.prompts.some(p => p.pi === opp && p.d.title === KAM && p.d._kameraHandFenster);
      if (!plus3) R.check('Gegner-Kamera begegnet meiner Kamera: sie wird ihm angeboten, MOE Shield wirkt wieder (0 Schaden)', oppFragt && schaden === 0, { oppFragt, schaden });
      else R.check('mit +3 darf der Gegner nicht reagieren: kein Angebot an ihn, Fireball trifft', !oppFragt && schaden === 150, { oppFragt, schaden });
      R.check('sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
    }
  }
  R.finish();
})();
