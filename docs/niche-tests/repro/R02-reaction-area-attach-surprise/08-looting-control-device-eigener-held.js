'use strict';
// R02-08 · Looting rüstet „Future Tech Control Device" (Text: „Equip this card to a Hero your opponent controls") am EIGENEN Helden des Nutzers aus – auch aus der eigenen Ablage
// Kartentexte: Looting – „… Choose an Equip Artifact from either discard pile and equip it to the user without paying its Cost."
//              Future Tech Control Device – „Equip this card to a Hero your opponent controls. Your opponent may once per turn, during their turn, take control of this Hero for the rest of the turn. …"
// Aufbau: Sitz 0 (Destruction Magic + Support Magic) besiegt mit Fireball Held 2 von Sitz 1 (HP 100) und spielt danach Looting. In der EIGENEN Ablage (Sitz 0) liegt nur die Control Device.
// Erwartet: Eine Ausrüstung, die der Text nur an Helden des GEGNERS erlaubt, ist kein legaler Träger-Fall für den Nutzer von Looting (Skriptkopf _equip-shared.js: „eine Ausrüstung ohne legalen Träger ist keine legale Wahl")
//   ⇒ Control Device steht nicht in der Auswahl bzw. landet nicht in der Support Zone des Nutzers.
// Beobachtet: Die Galerie bietet sie an; sie liegt danach in der Support Zone von Held 0 des Wirkers; im nächsten Zug von Sitz 1 ist sie über die Cross-Side-Aktivierung nutzbar,
//   d. h. der Gegner darf den Helden von Sitz 0 übernehmen („take control of this Hero"). Aus der Gegner-Ablage (Karte gehört dem Gegner) ist dieselbe Lage stimmig (Hero des Gegners des Kartenbesitzers) – nur der Weg aus der EIGENEN Ablage widerspricht dem Text.
// Ursache (vermutet): `istAusruestTraeger` (_equip-shared.js ~64) kennt die Cross-Side-Klausel (`placesOnOpponentBoard`, future-tech-control-device.js) nicht; `looting.js kandidaten()` nimmt beide Ablagen ungeprüft.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Fireball', 'Looting'], []], hp: 800, discard: [['Future Tech Control Device'], []] });
  t.hero(1, 2).hp = 100;
  t.setAbilities(0, 0, [['Destruction Magic'], ['Support Magic'], []]);
  t.grantFor(0, 0, 'Fireball'); t.grantFor(0, 0, 'Looting');
  t.targetFn = (valid) => { const h = valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 2); return [(h || valid[0]).id]; };
  t.policy.confirm = true;
  let galerie = null;
  t.script.push({ match: d => d.type === 'cardGallery' && d.title === 'Looting', answer: d => { galerie = d.cards.map(c => c.name); return { cardName: d.cards[0].name }; } });
  await t.play(0, 'Fireball', { hero: 0, noGrant: true });
  R.check('Aufbau – Looting wurde angeboten', galerie !== null, t.prompts.map(p => p.d.type + ':' + (p.d.title || '')));
  R.check('Control Device (nur am Helden des Gegners erlaubt) wird für den Nutzer NICHT angeboten', !(galerie || []).includes('Future Tech Control Device'), galerie);
  R.check('Control Device liegt NICHT in den Support Zones des eigenen Helden 0', !t.gs.players[0].supportZones[0].flat().includes('Future Tech Control Device'), t.gs.players[0].supportZones[0]);
  await t.endTurn();
  const act = t.engine.getActivatableEquipsCrossSide ? t.engine.getActivatableEquipsCrossSide(1) : [];
  R.check('Der Gegner (Sitz 1) kann den Helden von Sitz 0 NICHT per Control Device übernehmen', act.length === 0, act);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
