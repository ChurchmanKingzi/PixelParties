'use strict';
// W75 · Darion — die „Spirit of …"-Kreaturen erkennen ihren Traeger-Gegenstand (Legendary Sword / Heart-Shaped Bow / Ancient Tech Infinite Energy Core / Shattered Trident) auch im Equip-Stapel (Audit P4b, Klasse B/E).
// Kartentext (Beispiel Barbarian Sword): „This Creature can only be summoned by a Hero equipped with "Legendary Sword of a Barbarian King". …"
// Zusaetzlich Shattered Trident: „You may delete an Artifact equipped to the summoner to make summoning this Creature count as an additional Action." — mit mehreren gleichnamigen Karten im Stapel fragt die Karte jetzt je Karte (instancePick) statt per Namensgalerie;
//   „Whenever Artifacts equipped to Heroes you control would be moved from the board … you may discard 1 card to add them back to your hand instead, and if you do, gain Gold equal to half their Cost" — gilt je Karte des Stapels.
// Erwartet: Beschwoerung mit dem Traeger mitten im Stapel moeglich, ohne ihn nicht; die gewaehlte (zweite) Club of Gobbo wird geloescht; ein zerstoertes Stapel-Equip kehrt einzeln auf die Hand zurueck.
// Aufruf: node docs/niche-tests/repro/W75/h-P4b-06-spirits-traeger-im-stapel.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const D = 'Darion, the Blood-Crazy Groundskeeper', F = H.INERT.filler;
const TR = 'Shattered Trident, Treasure of the Deepsea', SP = 'Spirit of the Shattered Trident';
const TRAEGER = [
  ['Spirit of the Barbarian Sword', 'Legendary Sword of a Barbarian King'],
  ['Spirit of the Heart Bow', 'Heart-Shaped Bow, the Final Proof of Cuteness'],
  ['Spirit of the Ultimate Gun', 'Ancient Tech Infinite Energy Core'],
  [SP, TR],
];
function stapel(t, seat, namen, slot = 1, hi = 0) {
  const ps = t.gs.players[seat]; ps.supportZones[hi][slot] = [];
  return namen.map(n => { ps.supportZones[hi][slot].push(n); const i = t.engine._trackCard(n, seat, 'support', hi, slot); i.turnPlayed = 1; return i; });
}
const atForceDiscard = (t) => t.script.push({ match: d => d.type === 'forceDiscard' || d.type === 'forceDiscardCancellable', answer: () => ({ cardName: t.pile(0, 'hand')[0], handIndex: 0 }) });
(async () => {
  const R = H.runner();

  R.section('1) Beschwoerung nur mit dem Traeger im Stapel (Traeger mitten im 3er-Stapel / Stapel ohne Traeger)');
  for (const [spirit, traeger] of TRAEGER) {
    for (const mit of [true, false]) {
      const t = await H.fresh({ active: 0, heroes: [[D, 'Tushu, the Knowledge Keeper', null], [F, null, null]], hand: [[spirit, F, F], [F]], gold: 100 });
      stapel(t, 0, mit ? ['Club of Gobbo', traeger, 'Cute Crown'] : ['Club of Gobbo', 'Glass Sword', 'Cute Crown'], 1, 0);
      t.policy.confirm = false;   // Trident: „Use the Action" statt Loeschen
      const r = await t.play(0, spirit, { hero: 0, slot: 0 });
      const da = !!t.find(spirit, 'support');
      R.check(`${spirit}: ${mit ? 'mit' : 'ohne'} Traeger im Stapel → ${mit ? 'beschworen' : 'nicht beschworen'}`, da === mit, { r, da });
      R.check('sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
    }
  }

  R.section('2) Trident: Loeschkosten mit zwei gleichnamigen Karten im Stapel — die GEWAEHLTE Karte faellt');
  {
    const t = await H.fresh({ active: 0, heroes: [[D, 'Tushu, the Knowledge Keeper', null], [F, null, null]], hand: [[SP, F, F], [F]], gold: 100 });
    const ins = stapel(t, 0, ['Club of Gobbo', 'Club of Gobbo', TR, 'Cute Crown'], 1, 0);
    t.policy.confirm = true;
    let angebot = null;
    t.script.push({ match: d => d.type === 'instancePick', answer: (d) => { angebot = d.instances.map(i => i.name); return { instId: ins[1].id }; } });
    await t.play(0, SP, { hero: 0, slot: 0 });
    await t.drain();
    const ids = t.inst(c => c.zone === 'support' && c.owner === 0 && c.zoneSlot === 1 && c.heroIdx === 0).map(c => c.id);
    R.note('ergebnis', JSON.stringify({ zonen: t.gs.players[0].supportZones[0], angebot }));
    R.check('Rueckfrage zeigt alle vier Karten', JSON.stringify(angebot) === JSON.stringify(['Club of Gobbo', 'Club of Gobbo', TR, 'Cute Crown']), angebot);
    R.check('die zweite Club of Gobbo ist weg, die erste bleibt (Instanz)', ids.includes(ins[0].id) && !ids.includes(ins[1].id), ids);
    R.check('geloescht (nicht in die Ablage)', t.pile(0, 'deletedPile').includes('Club of Gobbo') && !t.pile(0, 'discardPile').includes('Club of Gobbo'), [t.pile(0, 'deletedPile'), t.pile(0, 'discardPile')]);
    R.check('sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }

  R.section('3) Trident auf dem Brett: das zerstoerte MITTLERE Stapel-Equip kehrt (nur dieses) auf die Hand zurueck, Gold = halbe Kosten');
  {
    const t = await H.fresh({ active: 1, heroes: [[D, 'Tushu, the Knowledge Keeper', null], [F, null, null]], hand: [[F, F, F], [F]], gold: 100 });
    const sp = t.put(0, 1, 0, SP); sp.turnPlayed = 1;
    const ins = stapel(t, 0, ['Club of Gobbo', 'Blade of the Frostbringer', 'Cute Crown'], 1, 0);
    t.policy.confirm = true; atForceDiscard(t);
    const gold0 = t.gs.players[0].gold;
    await t.run(() => t.engine.actionDestroyCard({ name: 'Fireball', owner: 1, heroIdx: 0 }, ins[1], { sourceOwner: 1 }));
    await t.drain();
    const kosten = t.DB['Blade of the Frostbringer'].cost || 0;
    R.note('ergebnis', JSON.stringify({ zonen: t.gs.players[0].supportZones[0], hand: t.pile(0, 'hand'), gold: t.gs.players[0].gold - gold0, kosten }));
    R.check('Blade auf der Hand, Rest bleibt im Stapel', t.pile(0, 'hand').includes('Blade of the Frostbringer') && JSON.stringify(t.gs.players[0].supportZones[0][1]) === '["Club of Gobbo","Cute Crown"]', [t.pile(0, 'hand'), t.gs.players[0].supportZones[0]]);
    R.check('Gold = halbe Kosten (aufgerundet)', t.gs.players[0].gold - gold0 === Math.ceil(kosten / 2), [t.gs.players[0].gold - gold0, kosten]);
    R.check('sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }
  R.finish();
})();
