'use strict';
// W5b-B1 (zu M02-24) · Singing auf „Surprise-Kreaturen" – Entscheidung Al (Welle 5):
//   „Sie werden bei Singing ggf einfach face-down in die Surprise Zone ihres Trägers zurückgesetzt (außer bei Bakhm, da Support Zone),
//    wobei der Owner des Heroes Permanente Kontrolle über die Surprise erhält."
// Erwartung: Singing darf die Kreatur wählen; der Effekt wirkt auf die ECHTE Instanz (zone 'surprise', faceDown, heroIdx konsistent, Audit leer),
//   die Kontrolle über die Surprise hat der Besitzer des Helden (Sitz 1), nicht der Singing-Nutzer (Sitz 0); die Rückfrage („Place … into … Surprise Zone?")
//   geht an den Singing-Nutzer (er aktiviert), nicht an den Gegner. Bakhm: bleibt in der Support Zone, face-down.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const names = ['Pure Advantage Camel', 'Cactus Creature', 'Afflicted Pests', 'Afflicted Vermin', 'Mummy Maker Machine', 'Noble Mummy Guards'];
  for (const name of names) {
    const t = await H.fresh({ hand: [[], []], hp: 800, deck: [Array(8).fill('ZZ Dummy'), Array(8).fill('ZZ Dummy')] });
    t.setAbilities(0, 0, [['Singing', 'Singing', 'Singing'], [], []]);
    const c = t.put(1, 0, 0, name);
    c.turnPlayed = 1;
    // Rückfrage sichtbar machen: im Harness sind beide Sitze „CPU" (kein Prompt) – nur für den Reset auf Mensch umstellen
    const orig = t.engine.surpriseCreatureReset.bind(t.engine), oc = t.engine.isCpuPlayer.bind(t.engine);
    t.engine.surpriseCreatureReset = async (ctx) => { t.engine.isCpuPlayer = () => false; try { return await orig(ctx); } finally { t.engine.isCpuPlayer = oc; } };
    t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
    t.gs.activePlayer = 0; t.phase(2);
    await t.run(() => t.host.doActivateFreeAbility(t.room, 0, { heroIdx: 0, zoneIdx: 0 }));
    const ps = t.gs.players[1];
    R.check(`${name}: Singing wählbar, Karte liegt in der Surprise Zone von Sitz 1 Held 0`, (ps.surpriseZones[0] || []).includes(name) && (ps.supportZones[0][0] || []).length === 0, { sz: ps.surpriseZones[0], sup: ps.supportZones[0][0] });
    R.check(`${name}: echte Instanz zone/heroIdx/faceDown konsistent`, c.zone === 'surprise' && c.heroIdx === 0 && c.faceDown === true, { zone: c.zone, hi: c.heroIdx, fd: c.faceDown });
    R.check(`${name}: Kontrolle liegt beim Heldenbesitzer (Sitz 1), nicht beim Singing-Nutzer`, (t.engine.surpriseKontrolleur(1, 0) === 1) && (c.controller ?? c.owner) === 1 && c.owner === 1 && c.stolenBy == null, { k: t.engine.surpriseKontrolleur(1, 0), ctrl: c.controller, owner: c.owner });
    const frage = t.prompts.find(p => p.d && p.d.type === 'confirm' && /Surprise|face-down/i.test(String(p.d.message || '')));
    R.check(`${name}: Rückfrage geht an den Singing-Nutzer (Sitz 0)`, !!frage && frage.pi === 0, frage && frage.pi);
    R.check(`${name}: Audit leer, keine Engine-Fehler`, t.audit().length === 0 && t.errors.length === 0, { a: t.audit(), e: t.errors });
  }
  // Bakhm: Support Zones dienen als Surprise Zones – die Kreatur bleibt in der Support Zone, face-down
  {
    const t = await H.fresh({ hand: [[], []], hp: 800, deck: [Array(8).fill('ZZ Dummy'), Array(8).fill('ZZ Dummy')] });
    t.setHero(1, 0, 'Bakhm, the Desert Digger', 800);
    t.setAbilities(0, 0, [['Singing', 'Singing', 'Singing'], [], []]);
    const c = t.put(1, 0, 0, 'Pure Advantage Camel'); c.turnPlayed = 1;
    t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
    t.gs.activePlayer = 0; t.phase(2);
    await t.run(() => t.host.doActivateFreeAbility(t.room, 0, { heroIdx: 0, zoneIdx: 0 }));
    R.check('Bakhm: Kamel bleibt in der Support Zone, face-down, Besitzer Sitz 1', c.zone === 'support' && c.faceDown === true && c.owner === 1 && (c.controller ?? c.owner) === 1 && (t.gs.players[1].supportZones[0][0] || []).includes('Pure Advantage Camel'), { zone: c.zone, fd: c.faceDown });
    R.check('Bakhm: Audit leer, keine Engine-Fehler', t.audit().length === 0 && t.errors.length === 0, { a: t.audit(), e: t.errors });
  }
  R.finish();
})();
