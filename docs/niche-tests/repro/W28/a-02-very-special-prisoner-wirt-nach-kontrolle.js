'use strict';
// W28a · Frage von W25a zu N1-11 · Al, 21.10.2026: „Soll bei Very Special Prisoner ('Hero you control') ein von mir übernommener Gegnerheld als Wirt für Divinity wählbar sein?" –
//   „Ja, 'you control' bezieht sich IMMER auf aktuelle Kontrolle, also Kontrolleur und nicht Besitzer."
// Kartentext: „Play this card immediately when you take control of an opponent's target. Attach a Divinity Ability from your hand or deck to a Hero you control. That counts as an additional attachment."
// Regel: Wirt = jeder Held, den der Spieler KONTROLLIERT (`heroesControlledBy`): ein von ihm übernommener Gegnerheld (gestohlen/gecharmt/übernommen, dauerhaft ODER temporär) ist ein gültiger Wirt
//   (die Divinity liegt dann in den Ability Zones der Brettseite des Helden, die Karte gehört weiter dem Spieler); ein an den Gegner abgegebener eigener Held (dauerhaft oder gecharmt) nicht.
// Aufbau: Sitz 0 (Kaster: Held 0:1 mit Magic Arts 1) hält Very Special Prisoner + Divinity auf der Hand. Die eigenen Helden 0:0/0:2 sind je nach Variante voll belegt (kein Platz für Divinity) oder frei.
// Aufruf: node docs/niche-tests/repro/W28/a-02-very-special-prisoner-wirt-nach-kontrolle.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const VSP = 'Very Special Prisoner', DIV = 'Divinity';
const VOLL = [['Fighting'], ['Fighting'], ['Fighting']];     // kein freier Platz für Divinity
const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;
const hatDiv = (t, seite, hi) => t.gs.players[seite].abilityZones[hi].flat().includes(DIV);

async function bau({ frei0 = false, frei2 = false } = {}) {
  const t = await H.fresh({ hand: [[VSP, DIV], []], hp: 800 });
  t.setAbilities(0, 0, frei0 ? [[], [], []] : VOLL);
  t.setAbilities(0, 1, [['Magic Arts'], ['Fighting'], ['Fighting']]);   // Kaster, selbst voll
  t.setAbilities(0, 2, frei2 ? [[], [], []] : VOLL);
  t.policy.confirm = true;
  return t;
}
const vspGespielt = (t) => !t.pile(0, 'hand').includes(VSP) && t.pile(0, 'discardPile').includes(VSP);

(async () => {
  const R = H.runner();

  // Übernahme-Arten für einen Gegnerhelden (Sitz 1, Held 0): jede löst `onTakeControl` für Sitz 0 aus
  const UEBERNAHMEN = [
    ['dauerhaft übernommen (actionTakeHeroPermanently)', (t) => t.engine.actionTakeHeroPermanently(0, 1, 0)],
    ['temporär gestohlen (actionStealHero)', (t) => t.engine.actionStealHero(0, 1, 0)],
  ];
  for (const [label, uebernimm] of UEBERNAHMEN) {
    R.section(`Gegnerheld ${label} – einziger freier Wirt`);
    const t = await bau();   // alle eigenen Helden voll
    await t.run(() => uebernimm(t));
    await sleep(400);
    R.check(`${label}: Very Special Prisoner wurde gespielt`, vspGespielt(t), { hand: t.pile(0, 'hand'), abl: t.pile(0, 'discardPile') });
    R.check(`${label}: die Divinity liegt in den Ability Zones des übernommenen Helden (Brettseite 1, Held 0)`, hatDiv(t, 1, 0), t.gs.players[1].abilityZones[0]);
    R.check(`${label}: Divinity nicht mehr auf der Hand, nicht in den eigenen Zonen`, !t.pile(0, 'hand').includes(DIV) && !hatDiv(t, 0, 0) && !hatDiv(t, 0, 1) && !hatDiv(t, 0, 2), t.pile(0, 'hand'));
    const inst = t.inst(i => i.name === DIV && i.zone === 'ability');
    R.check(`${label}: genau eine Divinity-Instanz, Brettseite 1, Karte gehört Sitz 0`, inst.length === 1 && inst[0].owner === 1 && inst[0].originalOwner === 0, inst.map(i => [i.owner, i.originalOwner, i.heroIdx]));
    R.check(`${label}: sauber`, sauber(t), { e: t.errors, a: t.audit() });
  }

  R.section('Wahl zwischen eigenem freiem Helden und übernommenem Gegnerhelden');
  for (const [label, uebernimm] of UEBERNAHMEN) {
    for (const wahl of ['fremd', 'eigen']) {
      const t = await bau({ frei2: true });
      let angeboten = null;
      t.targetFn = (valid) => {
        angeboten = valid.map(v => `${v.owner}:${v.heroIdx}`);
        const ziel = wahl === 'fremd' ? valid.find(v => v.owner === 1 && v.heroIdx === 0) : valid.find(v => v.owner === 0 && v.heroIdx === 2);
        return ziel ? [ziel.id] : null;
      };
      t.script.push({ match: d => d.type === 'abilityAttachTarget', answer: (d) => { angeboten = d.eligibleHeroIdxs.map(i => `0:${i}`); return { heroIdx: 2 }; } });
      await t.run(() => uebernimm(t));
      await sleep(400);
      R.check(`${label} / Wahl ${wahl}: das Angebot enthält den übernommenen Gegnerhelden 1:0 UND den eigenen freien 0:2`, Array.isArray(angeboten) && angeboten.includes('1:0') && angeboten.includes('0:2'), angeboten);
      R.check(`${label} / Wahl ${wahl}: Divinity landet beim gewählten Helden`, wahl === 'fremd' ? (hatDiv(t, 1, 0) && !hatDiv(t, 0, 2)) : (hatDiv(t, 0, 2) && !hatDiv(t, 1, 0)), { fremd: hatDiv(t, 1, 0), eigen: hatDiv(t, 0, 2) });
      R.check(`${label} / Wahl ${wahl}: sauber`, sauber(t), { e: t.errors, a: t.audit() });
    }
  }

  R.section('Abgegebener eigener Held ist KEIN Wirt');
  for (const [label, abgabe] of [
    ['dauerhaft an den Gegner abgegeben', (t) => t.engine.actionTakeHeroPermanently(1, 0, 0)],
    ['vom Gegner gestohlen/gecharmt', (t) => t.engine.actionStealHero(1, 0, 0)],
  ]) {
    // Held 0:0 ist der einzige freie eigene Held; Sitz 0 übernimmt danach eine Gegner-KREATUR (Auslöser) – Very Special Prisoner darf nicht angeboten werden
    const t = await bau({ frei0: true });
    const ziel = t.put(1, 1, 0, H.INERT.creature);
    await t.run(() => abgabe(t));
    await sleep(300);
    t.reset?.();
    await t.run(() => t.engine.actionStealCreature(0, ziel));
    await sleep(400);
    R.check(`${label}: Very Special Prisoner wird NICHT gespielt (kein Wirt)`, t.pile(0, 'hand').includes(VSP) && t.pile(0, 'hand').includes(DIV), t.pile(0, 'hand'));
    R.check(`${label}: die Divinity liegt nirgends`, !hatDiv(t, 0, 0) && !hatDiv(t, 1, 0) && !hatDiv(t, 0, 2), null);
    R.check(`${label}: sauber`, sauber(t), { e: t.errors, a: t.audit() });
  }

  R.section('Gegenprobe: normal, eigener freier Held (nichts übernommen/abgegeben)');
  { const t = await bau({ frei0: true });
    const ziel = t.put(1, 1, 0, H.INERT.creature);
    t.script.push({ match: d => d.type === 'abilityAttachTarget', answer: () => ({ heroIdx: 0 }) });
    await t.run(() => t.engine.actionStealCreature(0, ziel));
    await sleep(400);
    R.check('Very Special Prisoner gespielt, Divinity bei Held 0:0', vspGespielt(t) && hatDiv(t, 0, 0), { abl: t.gs.players[0].abilityZones[0] });
    R.check('sauber', sauber(t), { e: t.errors, a: t.audit() }); }

  R.section('Gegenseite: Sitz 1 übernimmt einen Helden von Sitz 0');
  { const t = await H.fresh({ hand: [[], [VSP, DIV]], hp: 800 });
    t.setAbilities(1, 0, VOLL); t.setAbilities(1, 1, [['Magic Arts'], ['Fighting'], ['Fighting']]); t.setAbilities(1, 2, VOLL);
    t.policy.confirm = true;
    await t.run(() => t.engine.actionStealHero(1, 0, 2));
    await sleep(400);
    R.check('Sitz 1: Very Special Prisoner gespielt, Divinity beim übernommenen Helden 0:2 (Brettseite 0)', !t.pile(1, 'hand').includes(VSP) && hatDiv(t, 0, 2), { z: t.gs.players[0].abilityZones[2], hand: t.pile(1, 'hand') });
    const inst = t.inst(i => i.name === DIV && i.zone === 'ability');
    R.check('Instanz auf Brettseite 0, Karte gehört Sitz 1', inst.length === 1 && inst[0].owner === 0 && inst[0].originalOwner === 1, inst.map(i => [i.owner, i.originalOwner]));
    R.check('sauber', sauber(t), { e: t.errors, a: t.audit() }); }

  R.finish();
})();
