'use strict';
// W11a · R1 + Q59 (Equip-Fenster, Spell-/Attack-Anhängsel) · Al, 15.10.2026: „Ja, soll es" (Anhängsel zählen als „equips or attaches a card").
//   Afflicted Pests (Text neu): „Activate this Surprise when your opponent equips or attaches a card into a Hero's Support Zone."
//   Cybug LOCUST: „Activate this Surprise when your opponent equips or attaches a card to a Hero they control …"
// Erwartet:
//   * Jedes Spell-/Attack-Anhängsel, das der GEGNER anlegt (Curse, Light Ball, Berserk, Guardian Angel, …), öffnet das Fenster von Afflicted Pests
//     (der Anleger zählt, nicht die Seite des Wirts: Curse auf den Helden des Pests-Besitzers ebenso wie Light Ball auf den eigenen Helden des Gegners).
//   * Das eigene Anlegen (Sitz 1 legt selbst an) öffnet die eigene Pests nicht.
//   * Abilities (Fighting) lösen Pests NICHT aus (Ability-Zonen sind keine Support Zones).
//   * LOCUST: nur, wenn der Held dem Anleger gehört/von ihm kontrolliert wird (Light Ball auf den eigenen Helden: ja; Curse auf den Helden des LOCUST-Besitzers: nein).
const H = require('../../lib/h.js');
const PESTS = 'Afflicted Pests', LOC = 'Cybug LOCUST', FUEL = "Treasure Hunter's Backpack";
const gefragt = (t, n) => t.prompts.some(p => new RegExp(n).test(JSON.stringify(p.d)));
const ANHAENGSEL = ['Alliance', 'Anti Magic', 'Berserk', 'Call of the Deepsea', 'Castling', 'Curse', 'Decisive Defeat', 'Dichotomy of Luna and Tempeste',
  'Divine Gift of Coolness', 'Energy Aura', 'Forbidden Curse of Aging', 'Gathering Storm', 'Guardian Angel', 'Intrude', 'Invisibility', 'Light Ball',
  'Overheal Shock', 'Prayer', 'Prophecy of Tempeste', 'Quest of the Chosen One', 'Royal Treasury', 'Siege'];
(async () => {
  const R = H.runner();
  // (a) jedes Anhängsel des Gegners öffnet Pests
  for (const n of ANHAENGSEL) {
    const t = await H.fresh({ hand: [[n], [FUEL]], gold: 100 });
    t.putSurprise(1, 0, PESTS); t.grantFor(1, 0, PESTS);
    t.put(1, 0, 0, H.INERT.creature);
    const r = await t.play(0, n, { hero: 0, targetOwner: 1 });
    R.check(n + ': gespielt', r === true, r);
    R.check(n + ': Afflicted Pests des Gegners löst aus', gefragt(t, PESTS) && !!t.find(PESTS, 'support'), t.prompts.map(p => p.d.type));
    R.check(n + ': keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }
  // (b) Curse auf den Helden des Pests-Besitzers (Host = Besitzerseite) und Light Ball auf den eigenen Helden des Anlegers
  {
    const t = await H.fresh({ hand: [['Curse'], []], gold: 100 });
    t.putSurprise(1, 0, PESTS); t.grantFor(1, 0, PESTS);
    t.put(1, 0, 0, H.INERT.creature);
    t.targetFn = (valid) => { const v = valid.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 1); return v ? [v.id] : [valid[0].id]; };
    await t.play(0, 'Curse', { hero: 0, targetOwner: 1 });
    R.check('Curse auf Held 1 des Pests-Besitzers: Pests löst aus', gefragt(t, PESTS), t.prompts.map(p => p.d.type));
  }
  // (c) das EIGENE Anlegen löst die eigene Pests nicht aus
  {
    const t = await H.fresh({ hand: [[], ['Light Ball']], gold: 100, active: 1 });
    t.putSurprise(1, 0, PESTS); t.grantFor(1, 0, PESTS);
    await t.play(1, 'Light Ball', { hero: 0 });
    R.check('Sitz 1 legt selbst Light Ball an: die eigene Pests löst NICHT aus', !gefragt(t, PESTS), t.prompts.map(p => p.d.type));
    R.check('Sitz 1 legt selbst an: keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  // (d) Abilities lösen Pests nicht aus (Q59: Ability-Zonen sind keine Support Zones)
  for (const ab of ['Fighting', 'Resistance']) {
    const t = await H.fresh({ gold: [100, 100], hand: [[], []] });
    t.grantFor(0, 0, PESTS); t.putSurprise(0, 0, PESTS);
    t.put(0, 0, 0, H.INERT.creature).turnPlayed = 1;
    t.reset();
    await t.play(1, ab, { hero: 0 });
    R.check(ab + ' angelegt: Pests löst NICHT aus', !t.inst(c => c.name === PESTS).some(c => c.zone === 'support') && !gefragt(t, PESTS), t.prompts.map(p => p.d.type));
  }
  // (e) LOCUST: Anhängsel an den eigenen Helden des Anlegers löst aus, Anhängsel an den Helden des LOCUST-Besitzers nicht
  {
    const t = await H.fresh({ hand: [['Light Ball'], [FUEL]], gold: 100 });
    t.putSurprise(1, 0, LOC); t.grantFor(1, 0, LOC);
    await t.play(0, 'Light Ball', { hero: 0 });
    R.check('Light Ball an den eigenen Helden des Gegners: LOCUST löst aus', gefragt(t, LOC), t.prompts.map(p => p.d.type));
    R.check('Light Ball + LOCUST: keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }
  {
    const t = await H.fresh({ hand: [['Curse'], [FUEL]], gold: 100 });
    t.putSurprise(1, 0, LOC); t.grantFor(1, 0, LOC);
    t.targetFn = (valid) => { const v = valid.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 1); return v ? [v.id] : [valid[0].id]; };
    await t.play(0, 'Curse', { hero: 0, targetOwner: 1 });
    R.check('Curse liegt am Helden des LOCUST-Besitzers', [0, 1, 2].some(h => [0, 1, 2].some(s => t.zone(1, h, s) === 'Curse')), 'Curse nicht bei Sitz 1');
    R.check('Curse auf einen Helden des LOCUST-Besitzers: LOCUST löst NICHT aus („they control")', !gefragt(t, LOC), t.prompts.map(p => p.d.type));
  }
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
