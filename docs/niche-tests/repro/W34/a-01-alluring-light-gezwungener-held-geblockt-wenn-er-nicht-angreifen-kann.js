'use strict';
// W34a · Punkt 1 · Al, 22.10.2026 (Antwort auf W32a-Frage 1): „Ja, ist korrekt" – der von Alluring Light gezwungene Held ist GEBLOCKT, wenn er nicht angreifen kann (gefroren, betäubt usw.).
// Kartentext: „Choose a Hero your opponent controls and a target you control. Your chosen target takes damage equal to the chosen Hero's Attack stat. This is treated as the chosen Hero attacking your chosen target."
// REGEL (wie die übrigen als Attack zählenden Effekte, W32a): ein Held, der nicht angreifen kann (`engine.heroKannAngreifen`: Frozen, Stunned, Webbed, Bound, harte Negierung, Berserk-Limit, Rioting Village …),
// ist als gezwungener Angreifer NICHT wählbar; ist keiner wählbar, ist die Karte nicht spielbar; wird er zwischen Wahl und Treffer gesperrt, passiert nichts (Karte verbraucht).
// Der provozierte Angriff zählt dem GEGNER (Besitzer des gezwungenen Helden): dessen Attack-Zähler steigen (W34a Punkt 3), die Karte selbst bleibt ein Spell von `me`.
// Aufruf: node docs/niche-tests/repro/W34/a-01-alluring-light-gezwungener-held-geblockt-wenn-er-nicht-angreifen-kann.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;
const ps = (t, s) => t.gs.players[s];

/** Szene: `me` spielt Alluring Light (Caster Held 1); Angreifer-Wahl: Gegner-Held `wahl` (Standard 0), Opfer: der EIGENE Held 0. `o.nachWahl` läuft beim Opfer-Prompt (Reaktion zwischen Wahl und Treffer). */
async function szene(me, op, o = {}) {
  const t = await H.fresh({ hand: me === 0 ? [['Alluring Light'], []] : [[], ['Alluring Light']], deckSize: 30, hp: 800, active: me });
  for (let hi = 0; hi < 3; hi++) { t.hero(op, hi).atk = 100 + 10 * hi; t.hero(op, hi).baseAtk = 100 + 10 * hi; }
  if (o.vorbereiten) o.vorbereiten(t, me, op);
  t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
  const wahlen = [];
  t.targetFn = (v) => {
    const a = v.filter(x => x.owner === op && x.type === 'hero');
    if (a.length) { wahlen.push(a.map(x => x.heroIdx)); const w = a.find(x => x.heroIdx === (o.wahl ?? 0)) || a[0]; return [w.id]; }
    if (o.nachWahl) o.nachWahl(t, me, op);
    return [v.find(x => x.owner === me && x.type === 'hero' && x.heroIdx === 0).id];
  };
  const hp0 = t.hp(me, 0);
  const erg = await t.play(me, 'Alluring Light', { hero: 1 });
  return { t, erg, wahlen, schaden: hp0 - t.hp(me, 0) };
}
const STATUS = {
  Frozen: (t, s, h) => t.heroStatus(s, h, 'frozen'),
  Stunned: (t, s, h) => t.heroStatus(s, h, 'stunned'),
  Webbed: (t, s, h) => t.heroStatus(s, h, 'webbed'),
  Bound: (t, s, h) => t.heroStatus(s, h, 'bound'),
  'hart negiert': (t, s, h) => t.heroStatus(s, h, 'negated'),
};

(async () => {
  const R = H.runner();
  for (const [me, op] of [[0, 1], [1, 0]]) {
    R.section(`Sitz ${me}: Gegenprobe – ungestörter Angreifer`);
    { const r = await szene(me, op);
      R.check('Alluring Light gespielt, der Gegner-Held 0 greift an (100 Schaden = sein Attack-Wert)', r.erg === true && r.schaden === 100 && r.t.pile(me, 'discardPile').includes('Alluring Light'), { erg: r.erg, s: r.schaden });
      R.check('alle drei Gegner-Helden waren als Angreifer wählbar', r.wahlen[0] && r.wahlen[0].join() === '0,1,2', r.wahlen);
      R.check('der provozierte Angriff zählt dem GEGNER (attacksPlayedThisTurn des Gegners == 1, heroesAttackedThisTurn [0], _attacksThisTurn 1); mein Attack-Zähler bleibt 0, mein Spell-Zähler steigt',
        (ps(r.t, op).attacksPlayedThisTurn || 0) === 1 && (ps(r.t, op).heroesAttackedThisTurn || []).join() === '0' && (r.t.hero(op, 0)._attacksThisTurn || 0) === 1 && (ps(r.t, me).attacksPlayedThisTurn || 0) === 0 && (ps(r.t, me).spellsPlayedThisTurn || 0) === 1,
        { opA: ps(r.t, op).attacksPlayedThisTurn, opL: ps(r.t, op).heroesAttackedThisTurn, meA: ps(r.t, me).attacksPlayedThisTurn, meS: ps(r.t, me).spellsPlayedThisTurn });
      R.check('sauber', sauber(r.t), { e: r.t.errors, a: r.t.audit() }); }

    for (const [name, f] of Object.entries(STATUS)) {
      R.section(`Sitz ${me}: gezwungener Held ${name}`);
      { // Held 0 kann nicht angreifen: nicht wählbar, die anderen schon
        const r = await szene(me, op, { vorbereiten: (t) => f(t, op, 0), wahl: 1 });
        R.check(`${name}: Gegner-Held 0 ist als Angreifer NICHT wählbar (angeboten: 1, 2)`, r.wahlen[0] && r.wahlen[0].join() === '1,2', r.wahlen);
        R.check(`${name}: der gewählte Held 1 greift an (110 Schaden)`, r.schaden === 110, r.schaden);
        R.check('sauber', sauber(r.t), { e: r.t.errors, a: r.t.audit() }); }
      { // alle drei gesperrt: Karte nicht spielbar, bleibt auf der Hand
        const r = await szene(me, op, { vorbereiten: (t) => { for (let hi = 0; hi < 3; hi++) f(t, op, hi); } });
        R.check(`${name}: kein Gegner-Held kann angreifen → Alluring Light ist NICHT spielbar (bleibt auf der Hand, kein Schaden)`, r.erg === false && r.t.pile(me, 'hand').includes('Alluring Light') && r.schaden === 0, { erg: r.erg, hand: r.t.pile(me, 'hand'), s: r.schaden });
        R.check('sauber', sauber(r.t), { e: r.t.errors, a: r.t.audit() }); }
      { // zwischen Wahl und Treffer gesperrt (Reaktion): nichts passiert, Karte verbraucht
        const r = await szene(me, op, { nachWahl: (t) => f(t, op, 0) });
        R.check(`${name} zwischen Wahl und Treffer: der gezwungene Held greift NICHT an (kein Schaden), die Karte ist verbraucht`, r.schaden === 0 && r.t.pile(me, 'discardPile').includes('Alluring Light') && (ps(r.t, op).attacksPlayedThisTurn || 0) === 0, { s: r.schaden, a: ps(r.t, op).attacksPlayedThisTurn });
        R.check('sauber', sauber(r.t), { e: r.t.errors, a: r.t.audit() }); }
    }

    R.section(`Sitz ${me}: leichte Negierung (nur der Effekt) sperrt NICHT – wie bei den übrigen Fighting-Level-Effekten`);
    { const r = await szene(me, op, { vorbereiten: (t) => { t.heroStatus(op, 0, 'negated'); const n = t.hero(op, 0).statuses.negated; if (n && typeof n === 'object') n.effectOnly = true; else t.hero(op, 0).statuses.negated = { effectOnly: true }; } });
      R.check('Gegner-Held 0 mit nur-Effekt-Negierung kann angreifen → wählbar, Schaden 100', r.wahlen[0] && r.wahlen[0].includes(0) && r.schaden === 100, { w: r.wahlen, s: r.schaden });
      R.check('sauber', sauber(r.t), { e: r.t.errors, a: r.t.audit() }); }

    R.section(`Sitz ${me}: Attack-Zähler/-Sperren des Gegners (W34a Punkt 3) – Berserk-Limit, Rioting Village`);
    { const r = await szene(me, op, { vorbereiten: (t) => { t.heroStatus(op, 0, 'berserked'); t.hero(op, 0)._attacksThisTurn = 2; } });
      R.check('Berserker-Held 0 mit 2 Attacks ist als gezwungener Angreifer NICHT wählbar', r.wahlen[0] && r.wahlen[0].join() === '1,2', r.wahlen);
      R.check('sauber', sauber(r.t), { e: r.t.errors, a: r.t.audit() }); }
    { const r = await szene(me, op, { vorbereiten: (t) => { t.putArea(me, 'Rioting Village'); ps(t, op).attacksPlayedThisTurn = 1; } });
      R.check('Rioting Village: der Gegner hat diesen Zug schon eine Attack gespielt → KEIN Held kann (gezwungen) angreifen, Karte unspielbar', r.erg === false && r.t.pile(me, 'hand').includes('Alluring Light'), { erg: r.erg });
      R.check('sauber', sauber(r.t), { e: r.t.errors, a: r.t.audit() }); }
    { const r = await szene(me, op, { vorbereiten: (t) => { t.putArea(me, 'Rioting Village'); } });
      R.check('Rioting Village (Gegenprobe): der Gegner hat noch nicht angegriffen → der provozierte Angriff läuft (zählt 1)', r.erg === true && r.schaden > 0 && (ps(r.t, op).attacksPlayedThisTurn || 0) === 1, { erg: r.erg, s: r.schaden });
      R.check('sauber', sauber(r.t), { e: r.t.errors, a: r.t.audit() }); }
  }
  R.finish();
})();
