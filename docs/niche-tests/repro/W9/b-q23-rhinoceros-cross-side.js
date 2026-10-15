'use strict';
// W9b · Q23 (A03-futuretech-29) · Cybug RHINOCEROS trifft auch eine Cross-Side-Ausrüstung des Gegners in der EIGENEN Support Zone
//
// Kartentext: „Activate this Surprise when your opponent places a card into an Area or Support Zone by deleting 1 "Excavator Bucket" … Send that card to the discard pile …“
// ENTSCHIEDEN (Al, Welle 9, Q23): „Ja, solange der Gegner die Karte ausspielt, ist es egal, in wessen Zone er sie spielt.“ Entscheidend ist, wer die Karte anlegt.
// Geprüft: (a) Control Device, (b) Powder Keg, (c) Copy Device als Control Device, die Sitz 0 in die Zone von Sitz 1 legt: Rhinoceros (Sitz 1) löst aus, Excavator Bucket gelöscht, die Karte
//   geht in die Ablage von SITZ 0 (Anleger), Rhinoceros steht im Support von Sitz 1; (d) Gegenprobe: legt Sitz 1 (der Besitzer der Rhinoceros) selbst eine Control Device an Sitz 0, löst NICHTS aus.
const H = require('../../lib/h.js');
const RH = 'Cybug RHINOCEROS', EB = 'Excavator Bucket', CTL = 'Future Tech Control Device', KEG = 'Powder Keg', CD = 'Future Tech Copy Device';
(async () => {
  const R = H.runner();
  for (const karte of [CTL, KEG, CD]) {
    const t = await H.fresh({ hand: [[karte], [EB]], discard: [karte === CD ? [CTL, CTL] : [], []], gold: 100 });
    t.putSurprise(1, 0, RH); t.grantFor(1, 0, RH);
    if (karte === CD) t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ cardName: CTL }), once: true });
    await t.play(0, karte, { hero: 0, targetOwner: 1 });
    const gefragt = t.prompts.some(p => /Cybug RHINOCEROS/.test(JSON.stringify(p.d)));
    R.check(karte + ': Rhinoceros löst aus', gefragt, t.prompts.map(p => p.d.type));
    R.check(karte + ': Excavator Bucket gelöscht', t.pile(1, 'deletedPile').includes(EB), t.pile(1, 'deletedPile'));
    R.check(karte + ': Karte in der Ablage des Anlegers (Sitz 0), nicht des Gastgebers', t.pile(0, 'discardPile').includes(karte) && !t.pile(1, 'discardPile').includes(karte), { d0: t.pile(0, 'discardPile'), d1: t.pile(1, 'discardPile') });
    R.check(karte + ': Rhinoceros steht in einer Support Zone von Sitz 1, die Karte nicht mehr', [0, 1, 2].some(s => t.zone(1, 0, s) === RH) && ![0, 1, 2].some(s => t.zone(1, 0, s) === karte), [0, 1, 2].map(s => t.zone(1, 0, s)));
    R.check(karte + ': keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }
  // (d) Gegenprobe: der Besitzer legt selbst
  const t = await H.fresh({ hand: [[], [CTL]], gold: 100, active: 1 });
  t.putSurprise(1, 0, RH); t.grantFor(1, 0, RH); t.addHand(1, EB);
  await t.play(1, CTL, { hero: 0, targetOwner: 0 });
  R.check('(d) eigene Control Device an den Gegner: Rhinoceros löst NICHT aus', !t.prompts.some(p => /Cybug RHINOCEROS/.test(JSON.stringify(p.d))) && !t.pile(1, 'deletedPile').includes(EB), { prompts: t.prompts.map(p => p.d.type), del: t.pile(1, 'deletedPile'), z0: [0, 1, 2].map(s => t.zone(0, 0, s)) });
  R.check('(d) keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
