'use strict';
// A03-futuretech-23 · Debt-O-Tron Model Backup Duplicator: unter Such-/Handsperre wird die Suche angeboten, nichts geholt – die Rundenladung ist trotzdem weg
//
// Kartentext: „Once per turn, when you have negative Gold after spending Gold, you may **search your deck** for a "Debt-O-Tron" Artifact for every 10 Gold you spent in excess … reveal them and **add them to your hand**.“
// Konvention (B-querschnitt „Sperren": `searchLocked` sperrt Deck-Suchen und Adds, `handLocked` sperrt Adds; Karten mit solcher Hauptwirkung werden gesperrt/nicht angeboten, vgl. Blueprints `blockedByHandLock`).
// Erwartung: Bei gesetzter Such- oder Handsperre löst der Duplicator gar nicht aus: keine Abfrage, die Ladung bleibt.
// Beobachtet: Die Auswahl (`cardGalleryMulti`) erscheint trotzdem, nach der Bestätigung landet nichts in der Hand, `remainingCharges` = 0 (Ladung verbraucht), das Gold wurde bezahlt.
// Ursache: cards/effects/debt-o-tron-model-backup-duplicator.js `afterResourceSpend`: keine Prüfung von `ps.searchLocked`/`ps.handLocked`; `treffer.verbuche()` steht vor dem `takeFromPile`, dessen Fehlschlag mit `return` still bleibt.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const KENT = 'Kent, the Indebted Apprentice', BD = 'Debt-O-Tron Model Backup Duplicator', DF = 'Debt-O-Tron Damage Fees';
  for (const lock of ['searchLocked', 'handLocked']) {
    const t = await H.fresh({ hand: [['Future Tech Gun'], []], gold: [0, 100], deck: [[DF, DF, H.INERT.creature, H.INERT.creature], []] });
    t.setHero(0, 0, KENT, 400);
    const bd = t.put(0, 2, 1, BD); bd.turnPlayed = 1;
    t.gs.players[0][lock] = true;
    t.script.push({ match: d => d.type === 'cardGalleryMulti', answer: (d) => ({ selectedCards: [d.cards[0].name] }) });
    await t.play(0, 'Future Tech Gun', { hero: 0 });                 // 10 Gold bei 0 Gold -> -10, Überziehung 10
    const geholt = t.pile(0, 'hand').includes(DF);
    const abgefragt = t.prompts.some(p => p.d.type === 'cardGalleryMulti');
    const ladung = H.loadCardEffect(BD).remainingCharges(bd, t.gs);
    R.check(`${lock}: keine Abfrage, wenn nichts geholt werden kann`, !abgefragt || geholt, { abgefragt, geholt });
    R.check(`${lock}: Ladung bleibt, wenn nichts geholt wurde`, geholt || ladung.remaining === 1, { ladung, geholt });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
