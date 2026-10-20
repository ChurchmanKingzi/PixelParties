'use strict';
// N3-04 · Spirit of the Forbidden Grimoire: der Effekt einer GEGNERISCHEN Kreatur wirkt für deren Kontrolleur (den Gegner), nicht für den Nutzer des Grimoires
// Kartentext: „This Creature may once per turn use the active effects of up to 2 Creatures on the board with different names, except …" – „on the board" = beide Seiten.
// Erwartung (wie „Aligning Goals": „use that Creature's active effect as if you controlled it"; Kohta/Grimoire „verwenden" Effekte): „you/your opponent/your deck" im geliehenen Effekt
//   meinen den NUTZER (Kontrolleur des Grimoires). Sonst wäre das Leihen gegnerischer Kreaturen sinnlos und schädlich (der Gegner zieht, mahlt, schlägt zu).
// Aufbau: Sitz 0 hat das Grimoire (Held 2), Sitz 1 einen Gangster Angel (10 Schaden an „all targets your opponent controls") bzw. eine Populated Island Turtle (zieht bis 10 Karten).
// Erwartet (Gangster): Helden von Sitz 1 verlieren je 10, Helden von Sitz 0 nichts.   Beobachtet: umgekehrt (`reactivateCreatureEffect` baut den Kontext aus der Instanz → `ctx.cardOwner` = Gegner).
// Erwartet (Turtle): Sitz 0 zieht bis 10.   Beobachtet: Sitz 1 zieht.
// Ursache: _engine.js `reactivateCreatureEffect` (Z. 26846, Kontext Z. 26882): `this._createContext(inst, …)` – der Kontext nennt den Kontrolleur der geliehenen Kreatur; der Nutzer `playerIdx` wird nur als Effektquelle gestempelt.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const SG = 'Spirit of the Forbidden Grimoire';
  const ziele = (t, borgt) => (valid, cfg) => (cfg && cfg.title === SG)
    ? valid.filter(x => !x.ineligible && x.cardName === borgt).map(x => x.id).slice(0, 1)
    : [valid.find(v => v.type === 'hero')?.id];
  async function lauf(besitzer, borgt) {
    const t = await H.fresh({ hand: [['ZZ Dummy'], ['ZZ Dummy', 'ZZ Dummy']], deck: [Array(20).fill(H.INERT.creature), Array(20).fill(H.INERT.creature)] });
    t.put(0, 2, 0, SG).turnPlayed = 1;
    const b = t.put(besitzer, 0, 0, borgt); b.turnPlayed = 1;
    t.targetFn = ziele(t, borgt);
    t.gs.activePlayer = 0; t.phase(2); t.resetActions(0); t.reset();
    const hpVor = [t.gs.players[0].heroes.map(h => h.hp), t.gs.players[1].heroes.map(h => h.hp)];
    const handVor = [t.pile(0, 'hand').length, t.pile(1, 'hand').length];
    const r = await t.run(() => t.host.doActivateCreatureEffect(t.room, 0, { heroIdx: 2, zoneSlot: 0 }));
    const hpD = [t.gs.players[0].heroes.map((h, i) => h.hp - hpVor[0][i]), t.gs.players[1].heroes.map((h, i) => h.hp - hpVor[1][i])];
    return { r, hpD, handD: [t.pile(0, 'hand').length - handVor[0], t.pile(1, 'hand').length - handVor[1]], errors: t.errors };
  }
  const own = await lauf(0, 'Gangster Angel');
  R.check('Gegenprobe: eigener Gangster Angel geliehen → Helden von Sitz 1 verlieren je 10', own.r === true && own.hpD[1].every(d => d === -10) && own.hpD[0].every(d => d === 0), own);
  const opp = await lauf(1, 'Gangster Angel');
  R.check('gegnerischer Gangster Angel geliehen → Helden von Sitz 1 (Gegner des Nutzers) verlieren je 10', opp.r === true && opp.hpD[1].every(d => d === -10), opp);
  R.check('gegnerischer Gangster Angel geliehen → Helden des Nutzers (Sitz 0) bleiben unversehrt', opp.hpD[0].every(d => d === 0), opp);
  const ownT = await lauf(0, 'Populated Island Turtle');
  R.check('Gegenprobe: eigene Turtle geliehen → Sitz 0 zieht bis 10', ownT.r === true && ownT.handD[0] > 0 && ownT.handD[1] === 0, ownT);
  const oppT = await lauf(1, 'Populated Island Turtle');
  R.check('gegnerische Turtle geliehen → der NUTZER (Sitz 0) zieht, nicht der Gegner', oppT.handD[0] > 0 && oppT.handD[1] === 0, oppT);
  R.check('keine Engine-Fehler', [own, opp, ownT, oppT].every(x => x.errors.length === 0));
  R.finish();
})();
