'use strict';
// ═══════════════════════════════════════════════════════════════════════════
//  H03-heroes-23 · Gewonnener Luna-Effekt (Pseudonia / Tempeluna): „Firewall"-Bonus (+100 Schaden, alle Gegnerziele brennen) fehlt
//
//  Karten: Luna, the Flame Fairy (`luna-the-flame-fairy.js`: `canBypassLevelReqForCard`, `firewallModifiers`), Pseudonia, the Skill Devourer, Tempeluna, the Convergence Fairy;
//          Verbraucher `firewall.js:42-50` (`firewallMods`)
//  Kartentext Luna: „This Hero's „Firewall" Spells deal 100 additional damage and Burn all targets your opponent controls, not just the attacker."
//  Registry-Kopf `_gained-effects-shared.js` / Tempeluna: Lunas ganze Wirkung steckt in den Verträgen `canBypassLevelReqForCard` und `firewallModifiers`; „die 42 Abfragestellen in Engine und
//  Server laufen seit v1186 über `heroScriptOf`".
//  Aufbau: Sitz 0: Held 0 = Pseudonia (bzw. Tempeluna) mit gewonnenem Luna-Effekt, Firewall unter Held 0, Gegner greift Held 0 mit Fireball an; Kontrolle: echte Luna.
//  Erwartung: wie bei der echten Luna: Firewall-Schaden 200 (100 + 100) auf den Angreifer, ALLE Gegnerhelden brennen.
//  Beobachtung (✗): Der Level-Bypass kommt an (Firewall löst aus), aber `firewallMods` schlägt den Vertrag über `loadCardEffect(hero.name)` nach – ohne die gewonnenen Effekte:
//  nur 100 Schaden, nur der Angreifer brennt.
//  Aufruf: node docs/niche-tests/repro/H03-heroes/23-pseudonia-luna-firewall-bonus-fehlt.js   (✗ = Fehler tritt auf)
// ═══════════════════════════════════════════════════════════════════════════
const H = require('../../lib/h.js');
const LUNA = 'Luna, the Flame Fairy';
const fill = ['Tushu, the Knowledge Keeper', 'Zwei, the Lucky Thief'];
(async () => {
  const R = H.runner();
  for (const [held, gewonnen] of [[LUNA, false], ['Pseudonia, the Skill Devourer', true], ['Tempeluna, the Convergence Fairy', true]]) {
    const t = await H.fresh({ heroes: [[held, ...fill], null], hp: 600, hand: [[], ['Fireball']] });
    await t.run(() => t.engine.runHooks('onGameStart', {}));
    if (gewonnen) { t.engine.grantHeroEffect(0, 0, LUNA); await t.run(() => t.engine.finishGainedHeroEffects(0, 0)); }
    t.setAbilities(0, 0, [[], [], []]);                     // keine Destruction Magic: der Bypass muss den Level ersetzen
    t.putSurprise(0, 0, 'Firewall');
    t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
    t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === 0 && x.heroIdx === 0).id];
    await t.play(1, 'Fireball', { hero: 0 });
    const hp = [0, 1, 2].map(i => t.hp(1, i)), brennt = [0, 1, 2].map(i => !!t.hero(1, i).statuses.burned);
    R.note(`${held}${gewonnen ? ' (Luna gewonnen)' : ''}`, { hp, brennt, firewallImZone: t.gs.players[0].surpriseZones[0] });
    R.check(`${held}: Firewall hat ausgelöst (Angreifer verliert HP)`, hp[0] < 600, hp);
    R.check(`${held}: Angreifer verliert 200 (100 + 100 Zusatz)`, hp[0] === 400, hp[0]);
    R.check(`${held}: ALLE Gegnerhelden brennen`, brennt.every(Boolean), brennt);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})();
