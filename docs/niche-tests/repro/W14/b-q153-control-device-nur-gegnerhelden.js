'use strict';
// W14b · Q153 (R02-08, Looting und Stapel-Ausrüster; Future Tech Control Device) · Al, 16.10.2026: „Control Device soll NUR an gegnerische Heroes anlegbar sein!"
// Kartentext: „Equip this card to a Hero your opponent controls. …"
// Erwartet: (a) Looting aus der EIGENEN Ablage bietet die Device nicht an (der Nutzer wäre ein eigener Held), aus der GEGNER-Ablage schon (der Nutzer ist dann ein Held des
//   Gegners des Kartenbesitzers); (b) die übrigen Stapel-Ausrüster (Weapon Collecting Wight, Treasure Hunter's Backpack, Riffel, Secret Spell Book – gemeinsamer Helfer
//   `_equip-shared`) lassen die Device an KEINEN eigenen Helden; (c) der Handweg legt sie nur auf die Gegnerseite; (d) `engine.canEquipCardToHero` ist die EINE Stelle:
//   ohne Besitzerangabe nie, mit Besitzer ≠ Kontrolleur ja; (e) eine liegende Device darf weiter umgehängt werden, aber nur auf Helden der Gegnerseite ihres Besitzers.
const H = require('../../lib/h.js');
const D = 'Future Tech Control Device';
(async () => {
  const R = H.runner();
  const ES = require('../../../../cards/effects/_equip-shared.js');

  async function looting(ablage0, ablage1) {
    const t = await H.fresh({ hand: [['Fireball', 'Looting'], []], hp: 800, discard: [ablage0, ablage1] });
    t.hero(1, 2).hp = 100;
    t.setAbilities(0, 0, [['Destruction Magic'], ['Support Magic'], []]);
    t.grantFor(0, 0, 'Fireball'); t.grantFor(0, 0, 'Looting');
    t.targetFn = (valid) => { const h = valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 2); return [(h || valid[0]).id]; };
    t.policy.confirm = true;
    let galerie = null;
    t.script.push({ match: d => d.type === 'cardGallery' && d.title === 'Looting', answer: d => { galerie = d.cards.map(c => c.name); return { cardName: d.cards.find(c => c.name === D)?.name || d.cards[0].name }; } });
    await t.play(0, 'Fireball', { hero: 0, noGrant: true });
    return { t, galerie };
  }

  R.section('(a) Looting');
  {
    const { t, galerie } = await looting([D, 'Glass Sword'], []);
    R.check('eigene Ablage: Looting wird (wegen Glass Sword) angeboten, Device NICHT in der Galerie', galerie && !galerie.includes(D) && galerie.includes('Glass Sword'), galerie);
    R.check('Device liegt nicht bei Sitz 0 auf dem Brett', !t.gs.players[0].supportZones.flat(2).includes(D));
  }
  {
    const { t, galerie } = await looting([], [D]);
    R.check('Gegner-Ablage: Device wird angeboten', galerie && galerie.includes(D), galerie);
    R.check('Device liegt in der Support Zone eines Helden von Sitz 0 (der Nutzer ist der Gegner des Kartenbesitzers)', t.gs.players[0].supportZones.flat(2).includes(D), t.gs.players[0].supportZones);
    R.check('keine Fehler / sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }
  {
    const { galerie } = await looting([D], []);
    R.check('nur die Device in der eigenen Ablage: Looting wird gar nicht angeboten (kein legaler Kandidat)', galerie === null, galerie);
  }

  R.section('(b)/(d) Stapel-Ausrüster: gemeinsamer Helfer und Engine-Stelle');
  {
    const t = await H.fresh({ hand: [[], []] });
    const e = t.engine;
    R.check('ausruestTraegerMitSeite(Device) für den Besitzer: kein Träger', ES.ausruestTraegerMitSeite(e, 0, D).length === 0, ES.ausruestTraegerMitSeite(e, 0, D));
    R.check('Gegenprobe: ein gewöhnliches Equip (Glass Sword) hat Träger', ES.ausruestTraegerMitSeite(e, 0, 'Glass Sword').length > 0);
    R.check('istAusruestTraeger(Device, eigener Held, Besitzer = ich): nein', ES.istAusruestTraeger(e, 0, 0, D) === false);
    R.check('istAusruestTraeger(Device, eigener Held, Besitzer = Gegner): ja', ES.istAusruestTraeger(e, 0, 0, D, 0, 1) === true);
    R.check('canEquipCardToHero(Device, Seite 0, Held 0) ohne Angabe: nein', e.canEquipCardToHero(D, 0, 0) === false);
    R.check('canEquipCardToHero(Device, Seite 0, Held 0, Besitzer Sitz 1): ja', e.canEquipCardToHero(D, 0, 0, { kartenBesitzer: 1 }) === true);
    R.check('canEquipCardToHero(Device, Seite 1, Held 0, Besitzer Sitz 0): ja (Gegnerheld)', e.canEquipCardToHero(D, 1, 0, { kartenBesitzer: 0 }) === true);
    R.check('canEquipCardToHero(Device, Seite 0, Besitzer Sitz 0): nein', e.canEquipCardToHero(D, 0, 0, { kartenBesitzer: 0 }) === false);
    R.check('gewöhnliche Karten unberührt: canEquipCardToHero(Glass Sword, 0, 0)', e.canEquipCardToHero('Glass Sword', 0, 0) === true);
  }

  R.section('(c) Handweg');
  {
    const t = await H.fresh({ hand: [[D], []], gold: 100 });
    const r = await t.play(0, D, { hero: 0, targetOwner: 0 });
    const eigen = t.gs.players[0].supportZones.flat(2).includes(D), gegner = t.gs.players[1].supportZones.flat(2).includes(D);
    R.check('Hand: auch mit Ziel „eigene Seite" liegt die Device nur beim Gegner', r !== false && gegner && !eigen, { r, eigen, gegner });
  }

  R.section('(e) Umhängen einer liegenden Device');
  {
    const t = await H.fresh({ hand: [[D], []], gold: 100 });
    await t.play(0, D, { hero: 0 });
    const inst = t.find(D, 'support');
    const r1 = await t.engine.actionTransferAttachment(inst, 1, 1, 0, {});
    R.check('Umhängen auf einen anderen Helden der Gegnerseite: erlaubt', r1.success !== false && !r1.equipRestricted, r1);
    const r2 = await t.engine.actionTransferAttachment(inst, 0, 0, 0, {});
    R.check('Umhängen auf einen Helden des Besitzers (Sitz 0): verweigert', r2.success === false, r2);
    R.check('keine Fehler / sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }
  R.finish();
})();
