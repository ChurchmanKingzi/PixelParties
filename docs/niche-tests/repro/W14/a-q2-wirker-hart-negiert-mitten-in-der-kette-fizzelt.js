'use strict';
// W14a · Rückfrage 2 (Welle 13 / W13a) · Al, 16.10.2026: „Ja" — wird die Abilities-Negierung (HARTE Form) des Wirkers mitten in der Kette ausgelöst,
//   lässt er sein Kettenglied weiter fizzeln (Ist-Zustand, Absicherung; v1328 + Welle 13 A2).
// Aufbau: echte `_resolveReactionChain` mit zwei Gliedern (Ketten lösen rückwärts auf): die Reaktion (Sitz 1) negiert beim Auflösen den Wirker der Initialkarte
//   (Sitz 0, Held 0); danach prüft die Engine das Initialglied: HARTE Negierung (Standard-`negated`) ⇒ Fizzle ('negated', kein `resolve`);
//   LEICHTE Negierung (nur Effekt: `effectOnly`) ⇒ die Karte löst auf (A2). Kontrolle: Frost ⇒ Fizzle.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  async function kette(modus) {
    const t = await H.fresh({ hand: [[], []] });
    const e = t.engine;
    let aufgeloest = false;
    const initial = { isInitialCard: true, cardName: 'Fireball', cardType: 'Spell', owner: 0, heroIdx: 0, casterOwner: 0, resolve: async () => { aufgeloest = true; } };
    const reaktion = {
      isInitialCard: false, cardName: H.INERT.filler, cardType: 'Spell', owner: 1, casterHeroIdx: 1, casterOwner: 1,
      resolve: async () => {
        if (modus === 'hart') await e.addHeroStatus(0, 0, 'negated', { appliedBy: 1, duration: 2 });
        else if (modus === 'leicht') await e.addHeroStatus(0, 0, 'negated', { appliedBy: 1, duration: 2, effectOnly: true });
        else if (modus === 'frost') await e.addHeroStatus(0, 0, 'frozen', { appliedBy: 1, duration: 2 });
      },
    };
    const chain = [initial, reaktion];
    await t.run(() => e._resolveReactionChain(chain));
    return { t, aufgeloest, link: initial, hart: e.heroAbilityLevelsBlanked(0, 0) };
  }
  const k0 = await kette('keine');
  R.check('Kontrolle: ohne Negierung löst die Initialkarte auf', k0.aufgeloest === true && !k0.link.fizzled, { a: k0.aufgeloest });
  const kh = await kette('hart');
  R.check('Wirker ist hart negiert (Abilities-Stufen leer)', kh.hart === true, kh.hart);
  R.check('harte Negierung mitten in der Kette: das Glied fizzelt (Grund negated), kein resolve', kh.link.fizzled === true && kh.link.fizzleReason === 'negated' && kh.aufgeloest === false, { fz: kh.link.fizzled, grund: kh.link.fizzleReason, aufgeloest: kh.aufgeloest });
  R.check('Fizzle ist keine Negation (negated bleibt false)', !kh.link.negated, kh.link.negated);
  R.check('Logeintrag chain_link_fizzled', kh.t.lg('chain_link_fizzled').length >= 1, kh.t.lg('chain_link_fizzled').length);
  R.check('harte Negierung: keine Engine-Fehler', kh.t.errors.length === 0, kh.t.errors);
  const kl = await kette('leicht');
  R.check('leichte Negierung (nur Effekt, A2): das Glied löst NORMAL auf', kl.aufgeloest === true && !kl.link.fizzled, { a: kl.aufgeloest, fz: kl.link.fizzled });
  const kf = await kette('frost');
  R.check('Frost mitten in der Kette: das Glied fizzelt (frozen)', kf.link.fizzled === true && kf.link.fizzleReason === 'frozen' && kf.aufgeloest === false, { fz: kf.link.fizzled, grund: kf.link.fizzleReason });
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
