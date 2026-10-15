'use strict';
// W12a · Rückfrage 3 (Anti Magic Enchantment auf einem gegnerischen Artefakt) · Al, 15.10.2026:
//   „Der Halter des Equips; dieses wird 'enchanted' und trägt dann den Effekt."
//   AME: „… the controlling player may once per turn make the Hero unaffected by a Spell that hits it" — die Fähigkeit gehört dem Kontrolleur des TRÄGER-Helden
//   (Halter des Equips), nicht dem AME-Spieler und nicht dem Kontrolleur des Artefakts; sie wandert mit dem Helden (Übernahme).
// Geprüft: (1) Gegner-Artefakt am Gegner-Helden (AME von Sitz 0): der Sitz des Trägers (1) entscheidet über die Negierung, nicht der AME-Spieler;
//   (2) Control Device (Sitz 1 legt an einen Helden von Sitz 0 an): der Träger-Held gehört Sitz 0 -> Sitz 0 entscheidet; (3) der Träger-Held wird später
//   dauerhaft übernommen: der Übernehmer (Sitz 0) entscheidet jetzt; (4) Regression: eigenes Artefakt, AME-Spieler = Halter.
const H = require('../../lib/h.js');
const AME = 'Anti Magic Enchantment';
const fragen = (t) => t.prompts.filter(p => p.d && p.d.title === AME && /Negate the Spell/.test(p.d.message || '')).map(p => p.pi);
(async () => {
  const R = H.runner();
  const zielHeld = (seat) => (valid) => [valid.find(v => v.type === 'hero' && v.owner === seat && v.heroIdx === 0).id];

  R.section('(1) Gegner-Artefakt am Gegner-Helden: der Halter (Kontrolleur des Trägers, Sitz 1) entscheidet');
  {
    const t = await H.fresh({ hand: [[AME, 'Fireball'], ['Future Tech Gun']], gold: 100, active: 1 });
    t.policy.confirm = true;
    await t.play(1, 'Future Tech Gun', { hero: 0 });
    const art = t.find('Future Tech Gun', 'support');
    R.check('AME verzaubert das Artefakt von Sitz 1; Halter = Kontrolleur des Trägers (Sitz 1)', !!art && !!art.counters.antiMagicEnchanted && art.counters.antiMagicEnchanted.ownerPi === 1, art && art.counters.antiMagicEnchanted);
    // Sitz 0 trifft den Träger mit einem Spell
    t.gs.activePlayer = 0; t.phase(3); t.reset();
    t.targetFn = zielHeld(1);
    const hp0 = t.hp(1, 0);
    await t.play(0, 'Fireball', { hero: 0 });
    R.check('die Negier-Frage geht an Sitz 1 (den Halter), nicht an den AME-Spieler Sitz 0', JSON.stringify(fragen(t)) === '[1]', fragen(t));
    R.check('Sitz 1 bestätigt (Standard) -> der Held bleibt unversehrt', t.hp(1, 0) === hp0, [hp0, t.hp(1, 0)]);
    R.check('(1) keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }

  R.section('(2) Control Device: Sitz 1 legt es an einen Helden von Sitz 0; der Träger gehört Sitz 0');
  {
    const t = await H.fresh({ hand: [[AME], ['Future Tech Control Device', 'Fireball']], gold: 100, active: 1 });
    t.policy.confirm = true;
    await t.play(1, 'Future Tech Control Device', { hero: 0, targetOwner: 0 });
    const art = t.find('Future Tech Control Device', 'support');
    R.check('AME wurde angeboten und verzaubert das Artefakt am Helden von Sitz 0', !!art && !!art.counters.antiMagicEnchanted, art && art.counters);
    t.reset();
    t.targetFn = zielHeld(0);
    await t.play(1, 'Fireball', { hero: 0 });
    R.check('die Negier-Frage geht an Sitz 0 (Kontrolleur des Träger-Helden)', JSON.stringify(fragen(t)) === '[0]', fragen(t));
    R.check('(2) keine Engine-Fehler', t.errors.length === 0, t.errors);
  }

  R.section('(3) der Träger-Held wird später dauerhaft übernommen: die Fähigkeit wandert zum Übernehmer');
  {
    const t = await H.fresh({ hand: [[AME], ['Future Tech Gun']], gold: 100, active: 1 });
    t.policy.confirm = true;
    await t.play(1, 'Future Tech Gun', { hero: 0 });
    // Sitz 0 übernimmt Held 0 von Sitz 1 dauerhaft
    await t.run(() => t.engine.actionTakeHeroPermanently(0, 1, 0, { sourceName: 'Test' }));
    t.gs.activePlayer = 1; t.phase(3); t.reset();
    // Sitz 1 trifft mit einem Spell den (jetzt von Sitz 0 geführten) Träger-Helden
    await t.run(() => t.engine.actionDealDamage({ name: 'Fireball', owner: 1 }, t.hero(1, 0), 100, 'spell'));
    const f = fragen(t);
    R.check('die Frage geht an Sitz 0 (Kontrolleur des Helden), nicht mehr an Sitz 1', f.length >= 1 && f.every(x => x === 0), f);
    R.check('(3) keine Engine-Fehler', t.errors.length === 0, t.errors);
  }

  R.section('(4) Regression: eigenes Artefakt, AME-Spieler = Halter');
  {
    const t = await H.fresh({ hand: [[AME, 'Future Tech Gun'], ['Fireball']], gold: 100 });
    t.policy.confirm = true;
    await t.play(0, 'Future Tech Gun', { hero: 0 });
    const art = t.find('Future Tech Gun', 'support');
    R.check('eigenes Artefakt verzaubert, Halter Sitz 0', !!art && art.counters.antiMagicEnchanted && art.counters.antiMagicEnchanted.ownerPi === 0, art && art.counters.antiMagicEnchanted);
    t.gs.activePlayer = 1; t.phase(3); t.reset();
    t.targetFn = zielHeld(0);
    await t.play(1, 'Fireball', { hero: 0 });
    R.check('die Frage geht an Sitz 0', JSON.stringify(fragen(t)) === '[0]', fragen(t));
    R.check('(4) keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
