'use strict';
// W25a · N1-14 (Al 21.10.2026: „ja, soll verhindert werden!"). Dichotomy of Luna and Tempeste: „… damage they take cannot be reduced further" gilt auch für Vor-Schaden-Reduktionen von Surprises.
// Hero: Burned + Dichotomy + Aquatic Shield (−100) → 200 Schaden bleiben bei 100 (nicht (200−100)/2 = 50). Gegenproben: nicht Burned → die Surprise reduziert (200 → 100);
// Dichotomy liegt am GEGNER (Ziel nicht von ihrem Anhangs-Spieler kontrolliert) → keine Sperre, Surprise reduziert (200 → 100, keine Halbierung); eigener Burn-Tick → ausgenommen
// (Dichotomy gilt nicht für Burn-Schaden), die Surprise reduziert den Tick (150 → 50). Banner Bearer (−150, negiert sonst ganz) unter der Sperre: Schaden fällt (halbiert), nichts wird negiert, das Ziel friert trotzdem ein.
// Kreaturenpfad: Banner Bearer auf eine Burned Kreatur unter Dichotomy.
// Aufruf: node docs/niche-tests/repro/W25/a-03-dichotomy-sperrt-surprise-reduktion.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const DICH = 'Dichotomy of Luna and Tempeste';
const SRC = { name: 'ZZ', owner: 0, controller: 0, heroIdx: 0, counters: {} };
(async () => {
  const R = H.runner();
  const heldenlauf = async ({ burned = true, dichSeat = 1, surprise = 'Aquatic Shield', betrag = 200, type = 'attack', quelle = SRC }) => {
    const t = await H.fresh({ hand: [[], []] });
    t.put(dichSeat, dichSeat === 1 ? 1 : 1, 0, DICH);
    if (burned) await t.run(() => t.engine.addHeroStatus(1, 0, 'burned', { appliedBy: 0 }));
    t.putSurprise(1, 0, surprise); t.grantFor(1, 0, surprise);
    const b = t.hp(1, 0);
    await t.run(() => t.engine.actionDealDamage(quelle, t.hero(1, 0), betrag, type));
    return { t, schaden: b - t.hp(1, 0), gefeuert: t.prompts.some(p => p.pi === 1 && p.d.title === surprise) };
  };
  R.section('Aquatic Shield am Helden');
  { const { t, schaden, gefeuert } = await heldenlauf({});
    R.check('Burned + Dichotomy: Surprise löst aus, Schaden bleibt 100', gefeuert && schaden === 100, { gefeuert, schaden });
    R.check('sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() }); }
  { const { t, schaden, gefeuert } = await heldenlauf({ burned: false });
    R.check('Gegenprobe nicht Burned (Dichotomy liegt): die Surprise reduziert 200 → 100', gefeuert && schaden === 100, { gefeuert, schaden });
    R.check('sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() }); }
  { // Dichotomy liegt am Angreifer (Sitz 0): das Ziel (Sitz 1) wird nicht von Sitz 0 kontrolliert
    const { t, schaden, gefeuert } = await heldenlauf({ dichSeat: 0 });
    R.check('Gegenprobe Dichotomy am Gegner (Held 1:0 nicht unter ihrer Kontrolle): keine Halbierung, keine Sperre, die Surprise reduziert 200 → 100', gefeuert && schaden === 100, { gefeuert, schaden }); }
  { // Burn-Tick: Dichotomy nimmt Burn aus → die Reduktion greift
    const t = await H.fresh({ hand: [[], []] });
    t.put(1, 1, 0, DICH);
    await t.run(() => t.engine.addHeroStatus(1, 0, 'burned', { appliedBy: 0 }));
    t.putSurprise(1, 0, 'Aquatic Shield'); t.grantFor(1, 0, 'Aquatic Shield');
    const b = t.hp(1, 0);
    await t.run(() => t.engine.actionDealDamage({ name: 'Burn' }, t.hero(1, 0), 150, 'fire'));
    R.check('Burn-Tick (von Dichotomy ausgenommen): Aquatic Shield reduziert 150 → 50', b - t.hp(1, 0) === 50, b - t.hp(1, 0));
    R.check('sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() }); }
  R.section('Banner Bearer (Held und Kreatur)');
  { const { t, schaden, gefeuert } = await heldenlauf({ surprise: 'Mischief Militia - Banner Bearer', betrag: 120 });
    R.check('Banner Bearer unter der Sperre: Surprise löst aus, der Schaden wird NICHT negiert (halbiert: 60)', gefeuert && schaden === 60, { gefeuert, schaden });
    R.check('Banner Bearer: das Ziel ist trotzdem eingefroren', !!t.hero(1, 0).statuses.frozen, t.hero(1, 0).statuses);
    R.check('sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() }); }
  { const { t, schaden, gefeuert } = await heldenlauf({ surprise: 'Mischief Militia - Banner Bearer', betrag: 120, burned: false });
    R.check('Gegenprobe Banner Bearer ohne Burn: 150 ≥ 120 → negiert (0 Schaden)', gefeuert && schaden === 0, { gefeuert, schaden }); }
  { const t = await H.fresh({ hand: [[], []] });
    t.put(1, 1, 0, DICH);
    const c = t.put(1, 2, 0, H.INERT.big);
    t.engine.applyCreatureStatus(c, 'burned', { sourceOwner: 0 });
    t.putSurprise(1, 0, 'Mischief Militia - Banner Bearer'); t.grantFor(1, 0, 'Mischief Militia - Banner Bearer');
    const hpVon = () => c.counters.currentHp ?? 1000;
    const hp0 = hpVon();
    await t.run(() => t.engine.actionDealCreatureDamage(SRC, c, 120, 'attack'));
    const gefeuert = t.prompts.some(p => p.pi === 1 && p.d.title === 'Mischief Militia - Banner Bearer');
    R.check('Kreatur Burned + Dichotomy + Banner Bearer: Schaden 60 (halbiert, nicht negiert)', gefeuert && hp0 - hpVon() === 60, { gefeuert, schaden: hp0 - hpVon() });
    R.check('sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() }); }
  R.finish();
})();
