'use strict';
// W39a · a-15 · Klassifikation der Quellen: jede Quelle, die als Attack zählt, ist für ALLE Leser eine Attack des schlagenden Helden mit der Stufe = Fighting-Level
// Auftrag (Al, 22.10.2026): "Es gibt viele Karten, die triggern, wenn eine Attack ausgeführt wird … Reagieren die auch ALLE schon auf Broghan und co?" — Regel (W32a/W34a/W35a): Effekte, die als Attack eines
// Helden zählen, lösen JEDEN Attack-Leser genauso aus wie eine echte Attack. Matrix: Leser × Quellen (Referenz "Echte Attack"; Broghan, Brackle, Arthor, Heragas, Kohta, Javelin Throw, Sword in a Bottle,
// Crusader's ×4, Bamboo Staff, Sacrificial Dagger, Infected Greatmaw, Alluring Light, Duel) × beide Sitze × Heldenziel/Kreaturenziel (`_helfer.js`, `_leser.js`, `_pruefe.js`).
// Alle Leser, die eine Quelle nicht über den Schaden, sondern über ihre ART lesen (Alleria, Dream World Switcheroo, Deepsea Encounter, Idej Projector, Chaorc Interception, Anti-Magnet, Challenge, Martyry, Empty Armor,
// Ghoul Guard, Fireshield …), fragen `engine.sourceEffectKind` / `_zaehltAlsArt` / `quelleIstAttackOderSpell`. Hier wird je Quelle das echte Quellobjekt des Treffers mitgeschnitten und geprüft, dazu der Abschluss
// `afterSpellResolved`: Attack-Kartendaten, Stufe = Fighting-Level des schlagenden Helden (deshalb lösen die stufengebundenen Leser Andras ["original level lower than Fighting"], Gobbo ["higher level than Fighting"] und
// Pharaoh ["couldn't without Divinity"] bei Effekten NIE aus — bewusst), `_alsEffekt`, genau ein getroffenes Ziel.
// Aufruf: node docs/niche-tests/repro/W39/a-15-klassifikation-der-quellen-attack-zaehlt-stufe-ist-fighting-level.js   (Exit 0 = korrekt; auf der Basis 72ed5383 Exit 1)
const H = require('./_helfer.js').H;
const P = require('./_pruefe.js');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
(async () => {
  const R = H.runner();
  const L = require('./_helfer.js');
  const Q = [...P.POSITIV.filter(n => n !== 'Echte Attack'), 'Echte Attack'];
  for (const [me, op] of [[0, 1], [1, 0]]) for (const name of Q) {
    R.section(`Sitz ${me}: ${name}`);
    const ereignis = { quellen: [], fertig: [] };
    const r = await L.szene(name, me, op, { ziel: L.TREIBER[name].ziele.includes('hero') ? 'hero' : 'creature', F: 2, vorbereiten: async (t, k) => {
      const e = t.engine;
      for (const fn of ['actionDealDamage', 'actionDealCreatureDamage']) { const o = e[fn].bind(e); e[fn] = (q, ...rest) => { if (rest[2] === 'attack') ereignis.quellen.push(q); return o(q, ...rest); }; }
      const od = e.actionDefeatHero.bind(e); e.actionDefeatHero = (q, ...rest) => { ereignis.quellen.push(q); return od(q, ...rest); };
      const oh = e.runHooks.bind(e); e.runHooks = (hn, c, ...rest) => { if (hn === 'afterSpellResolved' && c && c.spellCardData && c.spellCardData.cardType === 'Attack') ereignis.fertig.push(c); return oh(hn, c, ...rest); };
    } });
    const q = ereignis.quellen[0], e = r.t.engine;
    R.check('der Treffer wurde mitgeschnitten', !!q, ereignis.quellen.length);
    if (!q) continue;
    const spielerKarte = name === 'Echte Attack' || name === 'Duel';
    R.check('`sourceEffectKind` == attack', e.sourceEffectKind(q) === 'attack', e.sourceEffectKind(q));
    R.check('`quelleIstAttackOderSpell` (Typ attack) == true', require('../../../../cards/effects/_hooks').quelleIstAttackOderSpell(e, q, 'attack') === true, null);
    if (!spielerKarte) R.check('`_zaehltAlsArt` == attack (Effekt ohne Attack-Karte)', e._zaehltAlsArt(q) === 'attack', e._zaehltAlsArt(q));
    const fe = ereignis.fertig.filter(c => c.spellName !== 'Duel' || name === 'Duel');
    R.check('`afterSpellResolved` als Attack gemeldet', fe.length >= 1, fe.length);
    const c = fe[0];
    if (c && !spielerKarte) {
      R.check('Effekt ohne Karte: `_alsEffekt`, Stufe = Fighting-Level des Helden (2), genau ein Ziel', c._alsEffekt === true && c.spellCardData.level === 2 && c.damageTargets.length === 1, { a: c._alsEffekt, l: c.spellCardData.level, n: c.damageTargets.length });
      R.check('Wirker = Kontrolleur, Held = schlagender Held', Number.isInteger(c.casterIdx) && c.heroIdx === r.k.held, { c: c.casterIdx, h: c.heroIdx });
    }
    R.check('sauber', L.sauber(r.t), { e: r.t.errors, a: r.t.audit() });
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
