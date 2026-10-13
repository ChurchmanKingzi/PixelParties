'use strict';
// A09-18 · Bonded Companion Thuly: Opfer eines HELDEN löst „when you sacrifice a target" nicht aus (Stufe C)
// Kartentext Thuly: „Once per turn, when you sacrifice a target, you may choose a target and deal 150 damage to it."
// Teocuilatl: „You may once per turn sacrifice a Creature you control … OR a Hero you control, except this one, to gain 10/30 Gold."
// Skript: bonded-companion-thuly.js hört nur auf `onSacrificeBatch` / `onCreatureSacrificed`. Ein Helden-Opfer läuft über `actionDefeatHero({isSacrifice:true})` → nur `onHeroKO`
// (teocuilatl-the-embodiment-of-gods.js Z. ~150–170; `resolveSacrificeCost` gibt bei `extraPicked` vor jedem Opfer-Hook zurück, _engine.js ~27051).
// Aufbau: Seed 1234. Sitz 0: Teocuilatl (Held 0), Rick (Held 1) mit Bonded Companion Thuly, Zwei (Held 2); Kreatur „ZZ Dummy" bei Held 0. Phase Main 1.
// Schritte: Heldeneffekt Teocuilatl aktivieren, (A) die Kreatur opfern, (B) Held 2 opfern; Thuly-Schlag auf Gegner-Held 0 wählen.
// Erwartet (Lesart „target" = auch Helden): in beiden Fällen bietet Thuly die 150 Schaden an.
// Beobachtet: (A) 150 Schaden (Kontrolle), (B) 0 – Thuly meldet sich nicht.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const weg of ['Kreatur', 'Held']) {
    const t = await H.fresh({ hand: [[], []], gold: [50, 50], phase: 2,
      heroes: [['Teocuilatl, the Embodiment of Gods', 'Rick, the Trigger Happy Undertaker', 'Zwei, the Lucky Thief'], null] });
    const thuly = t.put(0, 1, 0, 'Bonded Companion Thuly'); thuly.turnPlayed = 1;
    const op = t.put(0, 0, 0, H.INERT.creature); op.turnPlayed = 1;
    t.targetFn = (valid, cfg) => {
      if (/Thuly/.test((cfg && cfg.title) || '')) return [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
      if (weg === 'Held') { const h = valid.find(v => v.type === 'hero' && v.owner === 0 && v.heroIdx === 2); if (h) return [h.id]; }
      return [(valid.find(v => v.type === 'equip' && v.owner === 0 && v.cardName === H.INERT.creature) || valid[0]).id];
    };
    const hp0 = t.hp(1, 0);
    await t.activateHero(0, 0, {});
    const geopfert = weg === 'Held' ? t.hp(0, 2) === 0 : !t.find(H.INERT.creature, 'support');
    R.check(weg + ': Opfer fand statt (Voraussetzung)', geopfert, { hero2hp: t.hp(0, 2) });
    R.check(weg + ': Thuly schlägt zu (150 Schaden)', hp0 - t.hp(1, 0) === 150, { dmg: hp0 - t.hp(1, 0) });
    R.check(weg + ': keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
