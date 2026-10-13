'use strict';
// H01-heroes-24 · Cool Rescuer Monia schützt nur vor SCHADEN an Kreaturen – Status-/Kontroll-/Bounce-Effekte (Instant Cryo Stasis …) werden nicht abgefangen
//
// Kartentext: „Once per turn, when 1 or more Creatures either player controls would be affected by a card or effect, you may discard 1 card to negate any effects that card or
//   effect has on all Creatures."
// Aufbau: Sitz 1: Monia (Held 0, `onGameStart` gefeuert), eine alte Kreatur (200 HP) auf Held 1, zwei Handkarten. Sitz 0 spielt „Instant Cryo Stasis" („Choose a Creature your opponent controls
//   and Freeze it for the rest of the game") auf diese Kreatur. Kontrolle: „Fireball" auf dieselbe Kreatur (Schaden).
// Erwartet: Monia bietet das Abfangen an (Option „Cool Rescue!"), nach Zustimmung ist die Kreatur nicht gefroren und 1 Karte abgeworfen.
// Beobachtet: Fireball: Angebot erscheint ✓. Instant Cryo Stasis: KEIN Angebot, die Kreatur ist gefroren (`counters.frozen = 1`, Dauer 9999).
// Ursache: `cool-rescuer-monia.js` Kopfkommentar: „Hooks into beforeCreatureDamageBatch … Future: also intercept status, healing, control changes." – nur `beforeCreatureDamageBatch` ist
//   verdrahtet; für Status/Heilung/Kontrolle/Bounce/Zerstören gibt es keinen Auslöser (die Marke `gs._moniaShieldActive` wird erst durch den Schadensweg gesetzt, vgl. -08).
const H = require('../../lib/h.js');
const MO = 'Cool Rescuer Monia', D = H.INERT.creature;
(async () => {
  const R = H.runner();
  async function lauf(zauber) {
    const t = await H.fresh({ heroes: [null, [MO, H.BLANK_HEROES_B[1], H.BLANK_HEROES_B[2]]], hand: [[zauber], ['ZZ Filler', 'ZZ Filler']] });
    await t.run(() => t.engine.runHooks('onGameStart', {}));
    const c = t.put(1, 1, 0, D); c.turnPlayed = 1; c.counters.currentHp = 200;
    t.script.push({ match: d => d.type === 'optionPicker' && /Cool Rescue/.test(d.title || ''), answer: (d) => ({ optionId: d.options[0].id }) });
    t.targetFn = (valid) => [valid.find(x => x.owner === 1 && x.type === 'equip').id];
    const r = await t.play(0, zauber, { hero: 0 });
    return { t, r, angebot: t.prompts.filter(p => p.d.type === 'optionPicker' && /Cool Rescue/.test(p.d.title || '')).length, gefroren: !!c.counters.frozen };
  }
  const f = await lauf('Fireball');
  R.check('Kontrolle Fireball: Monia bietet Abfangen an', f.r === true && f.angebot === 1, [f.r, f.angebot]);
  const x = await lauf('Instant Cryo Stasis');
  R.check('Instant Cryo Stasis: Spell gespielt', x.r === true, x.r);
  R.check('Instant Cryo Stasis: Monia bietet Abfangen an', x.angebot === 1, x.angebot);
  R.check('Instant Cryo Stasis: Kreatur nicht gefroren (nach Zustimmung)', x.gefroren === false, x.gefroren);
  R.check('keine Engine-Fehler', x.t.errors.length === 0, x.t.errors);
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
