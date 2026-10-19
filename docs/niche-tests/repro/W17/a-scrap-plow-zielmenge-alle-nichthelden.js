'use strict';
// W17a · Debt-O-Tron Model Scrap Plow (A03-16, Al 19.10.2026): „Ja, das gilt grundsätzlich für Effekte, die ‚any card on the board that is not a Hero' treffen können"
//
// Kartentext: „… you may choose any card on the board that is not a Hero and send it to the discard pile. Creatures sent this way count as being defeated."
// Regel: ein solcher Effekt kann verdeckte Surprises, Areas, Ausrüstung, Attachments, Kreaturen, Abilities (jede Karte außer Helden) wählen - und KEINEN Helden.
//   Dieser Repro sichert den Ist-Zustand von Scrap Plow ab (Zielmenge, Wahl einer verdeckten Surprise, Kreatur zählt als besiegt); die Zielmengen der gleichartigen
//   Karten prüft a-nichtheld-karten-bieten-verdeckte-surprise.js. Exit 0 = korrekt.
const H = require('../../lib/h.js');
const KENT = 'Kent, the Indebted Apprentice', SP = 'Debt-O-Tron Model Scrap Plow';
async function szene() {
  const t = await H.fresh({ hand: [['Future Tech Fists'], []], gold: [0, 100] });
  t.setHero(0, 0, KENT, 400);
  t.putArea(1, 'Rioting Village');
  t.put(0, 2, 2, SP).turnPlayed = 1;
  t.put(1, 0, 0, H.INERT.creature);
  t.put(1, 0, 1, 'Blade of the Swamp Witch');                 // Ausrüstung
  t.putSurprise(1, 1, 'Booby Trap');                           // verdeckte Surprise
  return t;
}
(async () => {
  const R = H.runner();
  { const t = await szene();
    let liste = null;
    t.targetFn = (valid) => { liste = valid.map(v => ({ id: v.id, type: v.type, name: v.cardName })); return null; };
    await t.play(0, 'Future Tech Fists', { hero: 0, slot: 0 });    // Kent: Überziehung -> Scrap Plow löst aus
    R.check('Zielwahl wurde geöffnet', Array.isArray(liste), liste);
    const hat = (typ, n) => (liste || []).some(x => x.type === typ && (n == null || x.name === n));
    R.check('Kreatur wählbar', hat('equip', H.INERT.creature), liste);
    R.check('Ausrüstung wählbar', hat('equip', 'Blade of the Swamp Witch'), liste);
    R.check('Area wählbar', hat('area', 'Rioting Village'), liste);
    R.check('verdeckte Surprise wählbar (Typ surprise)', hat('surprise', 'Booby Trap'), liste);
    R.check('keine Helden in der Liste', !(liste || []).some(x => x.type === 'hero'), liste);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors); }

  { const t = await szene();
    t.targetFn = (valid) => { const s = valid.find(v => v.type === 'surprise'); return s ? [s.id] : null; };
    await t.play(0, 'Future Tech Fists', { hero: 0, slot: 0 });
    R.check('gewählte verdeckte Surprise liegt in der Ablage ihres Besitzers', t.pile(1, 'discardPile').includes('Booby Trap') && (t.gs.players[1].surprise?.length ?? (t.gs.players[1].surpriseZones || []).flat().length) === 0,
      { abl: t.pile(1, 'discardPile'), sz: t.gs.players[1].surpriseZones });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors); }

  { const t = await szene();
    t.targetFn = (valid) => { const s = valid.find(v => v.type === 'equip' && v.cardName === H.INERT.creature); return s ? [s.id] : null; };
    let tod = 0;
    const orig = t.engine.runHooks.bind(t.engine);
    t.engine.runHooks = async (name, ctx) => { if (name === 'onCreatureDeath' && ctx?.creature?.name === H.INERT.creature) tod++; return orig(name, ctx); };
    await t.play(0, 'Future Tech Fists', { hero: 0, slot: 0 });
    R.check('gewählte Kreatur zählt als besiegt (onCreatureDeath) und liegt in der Ablage', tod >= 1 && t.pile(1, 'discardPile').includes(H.INERT.creature), { tod, abl: t.pile(1, 'discardPile') });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors); }
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
