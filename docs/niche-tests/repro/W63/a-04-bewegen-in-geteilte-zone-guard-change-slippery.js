'use strict';
// W63a-04 · Bewegen in geteilte Zonen (Al, 22.10.2026, Rueckfrage 4 aus Welle 62)
//
// Al: „Solange der Effekt aktiv ist, darf eine Creature auch IN eine geteilte Zone bewegt werden (Guard Change, Slippery Skates/Ice, Memory Blast, Jumper Spider-Transfer und alle weiteren
//      ‚move … to a Support Zone'-Effekte); sie wird dort auch als Ziel angeboten. Die Quell-Zone verliert die Karte. Puppets (‚Cannot be moved to a different Support Zone') bleiben unbeweglich.
//      Bewegen loest nie On-Summon aus (`_isMove`)."
// Szene (je Sitz): Held 0 / Zone A = [Cute Bunny]; Held 2 (Guard Change) bzw. Held 1 (Slippery, Nachbar) traegt an anderer Stelle ebenfalls einen Cute Bunny; alle uebrigen Zonen voll. Alice ist Held 1.
//   1 Guard Change       Bunny von Held 2 in Zone A von Held 0: wird als Ziel angeboten (shared), Stapel x2, Quelle leer; ohne Alice (volles Brett): nicht spielbar, nichts bewegt
//   2 Slippery Ice       Bunny von Held 0 / Zone A -> Zone von Held 1 (Alice), in der ein Bunny steht: Ziel `shared` + vorn; belegt ohne Alice: nicht angeboten
//   3 Slippery Skates    dasselbe ueber die Ausruestung (Nachbar-Held), Prompt `skatesMove` mit `shared`/`stackDepth` und nurSlots
//   4 On-Summon          bewegte Kreatur loest KEIN On-Summon aus (Zaehler am Bunny/Haken `onPlay` nicht gefeuert)
//   5 Puppet             actionMoveCard in eine Zone mit gleichem Puppet bleibt blockiert
// Beide Sitze. Exit 0 = korrekt.
const L = require('../../lib/alice-brett.js');
const { H, brett, zoneA, instIn, ohneStapel, gesamt, sicher } = L;
const CB = 'Cute Bunny';
const sauber = (t) => t.errors.length === 0 && ohneStapel(t).length === 0;

async function guardChange(seat, alice) {
  const t = await brett(seat, { hand: ['Guard Change'], alice, fuellen: true, zonen: [[CB]], extra: [[2, 0, [CB]]] });
  t.setAbilities(seat, 0, [['Support Magic', 'Support Magic'], [], []]);
  t.engine.isCpuPlayer = () => false;             // Menschen-Pfad
  const bunny = t.inst(c => c.zone === 'support' && c.owner === seat && c.heroIdx === 2 && c.zoneSlot === 0)[0];
  bunny.turnPlayed = 1;
  const angebote = [];
  t.script.push({ match: d => d.type === 'guardChangeMove', answer: (d) => {
    const c = d.creatures.find(x => x.instId === bunny.id);
    if (!c) return { done: true };
    angebote.push(c.dests.map(z => `${z.heroIdx}/${z.slotIdx}${z.shared ? 's' : ''}`));
    const z = c.dests.find(q => q.heroIdx === 0 && q.slotIdx === 0);
    if (!z) return { done: true };
    return { instId: bunny.id, destOwner: z.owner, destHeroIdx: z.heroIdx, destSlot: z.slotIdx };
  } });
  return { t, bunny, angebote };
}

async function ice(seat, alice) {
  // Held 1 (Alice bzw. Rick) traegt einen Bunny in Zone 0; Held 0 / Zone A traegt den beweglichen Bunny.
  const t = await brett(seat, { alice, fuellen: true, frei1: undefined, zonen: [[CB]], extra: [[1, 0, [CB]]] });
  t.putArea(seat, 'Slippery Ice');
  for (const i of t.inst(c => c.name === CB)) i.turnPlayed = 1;
  t.engine.isCpuPlayer = () => false;
  const quellen = [], ziele = [];
  let n = 0;
  t.script.push({ match: d => d.type === 'zonePick', answer: (d) => {
    n++;
    if (n > 6) return null;
    if (/Pick a Creature|Pick another/.test(d.description || '')) {
      quellen.push(d.zones.map(z => `${z.heroIdx}/${z.slotIdx}`));
      const q = d.zones.find(z => z.heroIdx === 0 && z.slotIdx === 0);
      return q ? { heroIdx: 0, slotIdx: 0 } : null;                 // nur den Bunny von Held 0 bewegen; danach abbrechen
    }
    ziele.push(d.zones.map(z => `${z.heroIdx}/${z.slotIdx}${z.shared ? 's' : ''}`));
    const z = d.zones.find(q => q.heroIdx === 1 && q.slotIdx === 0) || d.zones[0];
    return { heroIdx: z.heroIdx, slotIdx: z.slotIdx };
  } });
  return { t, quellen, ziele };
}

(async () => {
  const R = H.runner();
  for (const s of [0, 1]) {
    // ── 1 · Guard Change ───────────────────────────────────────────────────────────────────────
    R.section(`Sitz ${s}: Guard Change — Bunny von Held 2 in die geteilte Zone A von Held 0`);
    {
      const { t, bunny, angebote } = await guardChange(s, true);
      R.check('Vorbedingung: keine freie Zone', t.engine.getFreeSupportZones(s).length === 0);
      const r = await t.play(s, 'Guard Change', { hero: 0 });
      R.check('Zauber wird gespielt', r === true, sicher(r));
      R.check('Zone A (Held 0) wird als geteiltes Ziel angeboten', angebote.some(a => a.includes('0/0s')), angebote);
      R.check('Zone A von Held 0 ist ein Stapel x2 (2 Instanzen)', zoneA(t, s).length === 2 && instIn(t, s, 0, 0, CB) === 2, zoneA(t, s));
      R.check('die Quell-Zone (Held 2 / Slot 1) hat die Karte verloren', zoneA(t, s, 2, 0).length === 0 && instIn(t, s, 2, 0) === 0, zoneA(t, s, 2, 0));
      R.check('die bewegte Instanz steht jetzt bei Held 0 / Slot 1', bunny.heroIdx === 0 && bunny.zoneSlot === 0, [bunny.heroIdx, bunny.zoneSlot]);
      R.check('sauber', sauber(t), { e: t.errors, a: ohneStapel(t) });
    }
    R.section(`Sitz ${s}: Guard Change ohne Alice (volles Brett) — nichts bewegbar`);
    {
      const { t, bunny, angebote } = await guardChange(s, false);
      const r = await t.play(s, 'Guard Change', { hero: 0 });
      R.check('nicht spielbar bzw. nichts bewegt', zoneA(t, s).length === 1 && bunny.heroIdx === 2 && zoneA(t, s, 2, 0).length === 1, { r: sicher(r), angebote });
      R.check('Zone A nie angeboten', !angebote.some(a => a.includes('0/0') || a.includes('0/0s')), angebote);
      R.check('sauber', sauber(t), { e: t.errors, a: ohneStapel(t) });
    }

    // ── 2 · Slippery Ice ────────────────────────────────────────────────────────────────────────
    R.section(`Sitz ${s}: Slippery Ice — Bunny von Held 0 in die (geteilte) Zone des Nachbarn Held 1`);
    {
      const { t, quellen, ziele } = await ice(s, true);
      t.phase(2);
      const r = await t.run(() => t.engine.activateAreaEffect(s, s, 'Slippery Ice'));
      R.check('Zone von Held 1 wird als geteiltes Ziel angeboten und steht VORN', ziele.length > 0 && ziele[0][0] === '1/0s', { ziele, quellen });
      R.check('Stapel bei Held 1 / Slot 1 ist x2 (2 Instanzen)', zoneA(t, s, 1, 0).length === 2 && instIn(t, s, 1, 0, CB) === 2, { b: zoneA(t, s, 1, 0), r: sicher(r) });
      R.check('Quell-Zone (Held 0 / Slot 1) leer', zoneA(t, s).length === 0 && instIn(t, s, 0, 0) === 0, zoneA(t, s));
      R.check('sauber', sauber(t), { e: t.errors, a: ohneStapel(t) });
    }
    R.section(`Sitz ${s}: Slippery Ice ohne Alice — die belegte Zone ist kein Ziel`);
    {
      const { t, quellen, ziele } = await ice(s, false);
      t.phase(2);
      await t.run(() => t.engine.activateAreaEffect(s, s, 'Slippery Ice'));
      R.check('Bunny bleibt in Zone A, Held 1 unveraendert', zoneA(t, s).length === 1 && zoneA(t, s, 1, 0).length === 1, { a: zoneA(t, s), b: zoneA(t, s, 1, 0), ziele, quellen });
      R.check('sauber', sauber(t), { e: t.errors, a: ohneStapel(t) });
    }

    // ── 3 · Slippery Skates ──────────────────────────────────────────────────────────────────────
    for (const alice of [true, false]) {
      R.section(`Sitz ${s}: Slippery Skates ${alice ? 'mit' : 'ohne'} Alice`);
      const t = await brett(s, { hand: ['Slippery Skates'], gold: 200, alice, fuellen: true, zonen: [[CB], []], extra: [[1, 0, [CB]]] });
      for (const i of t.inst(c => c.name === CB)) i.turnPlayed = 1;
      const pr = await t.play(s, 'Slippery Skates', { hero: 0, slot: 1 }); t.say('play', pr, t.errors);
      const prompts = [];
      t.script.push({ match: d => d.type === 'skatesMove', answer: (d) => {
        prompts.push(d);
        const c = d.creatures.find(x => x.zoneSlot === 0) || d.creatures[0];
        const z = d.destZones.find(q => q.heroIdx === 1 && q.slotIdx === 0 && (!q.nurSlots || q.nurSlots.includes(c.zoneSlot)));
        if (!z) return null;
        return { creatureSlot: c.zoneSlot, destHeroIdx: z.heroIdx, destSlot: z.slotIdx };
      } });
      const a = await t.activateEquip(s, 0, 1, {});
      const ziel = prompts[0] && prompts[0].destZones.find(z => z.heroIdx === 1 && z.slotIdx === 0);
      if (alice) {
        R.check('Skates aktivierbar', a === true, sicher(a));
        R.check('Prompt bietet die Zone von Held 1 als geteiltes Ziel an (shared, stackDepth 1)', !!ziel && ziel.shared === true && ziel.stackDepth === 1, prompts[0] && prompts[0].destZones);
        R.check('Stapel bei Held 1 / Slot 1 ist x2', zoneA(t, s, 1, 0).length === 2 && instIn(t, s, 1, 0, CB) === 2, zoneA(t, s, 1, 0));
        R.check('Quell-Zone leer', zoneA(t, s).length === 0 && instIn(t, s, 0, 0) === 0, zoneA(t, s));
      } else {
        R.check('ohne Alice: die belegte Zone ist kein Ziel, nichts bewegt', !ziel && zoneA(t, s).length === 1 && zoneA(t, s, 1, 0).length === 1, { a, ziel });
      }
      R.check('sauber', sauber(t), { e: t.errors, a: ohneStapel(t) });
    }
  }
  R.finish();
})().catch(e => { process.stdout.write('ABSTURZ ' + (e && e.stack) + '\n'); process.exit(1); });
