'use strict';
// W36a · Punkt 1 · Al, 22.10.2026 (Antwort auf W35a-Rückfrage 1): „Ja, definitiv." — Broghan, Brackle, Arthor (Inheritor), Heragas und Kohta (Master of Super-Killing): wird ihr Treffer im
//  Zielfenster NEGIERT (Invisibility Cloak als Hand-Reaktion; bei Broghan/Arthor/Kohta/Heragas/Brackle jeweils gezielt), gilt dieselbe Regel wie bei Alice (W35a): der Effekt ist für die Runde
//  VERBRAUCHT (Einmal-Stempel bleibt gesetzt, ein zweiter Versuch im selben Zug ist nicht möglich) und der Treffer ZÄHLT als gespielter Attack (`attacksPlayedThisTurn`, `heroesAttackedThisTurn`,
//  `hero._attacksThisTurn`, `onEffectCountedAsArt` → Mirjam-Zähler eines anderen Helden bleibt unberührt, Ghuanjun-Hook ohne Karte namenlos). Muster: `engine.heldenEffektZielwahl`
//  (`null` aus `promptDamageTarget` MIT `gs._spellNegatedByEffect` bzw. `gs._zielNegiertDurchSchutz` = negiert, nicht abgebrochen).
//  Gegenprobe: bricht der SPIELER selbst ab (`targetFn` → null), bleibt der Stempel frei und nichts zählt.
//  Brackle: das Opfer (Kosten) ist bei Negierung bezahlt (die Kreatur ist weg), bei Abbruch („Back"/Abbruch des Opfer-Pickers) bleibt sie stehen.
//  Exit 1 auf der Basis 98a18e17 (Stempel frei, kein Zähler), Exit 0 auf dem Branch.
// Aufruf: node docs/niche-tests/repro/W36/a-01-negierter-treffer-der-attack-helden-verbraucht-und-zaehlt.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;
const ps = (t, s) => t.gs.players[s];
const posHero = (valid, owner, idx) => valid.find(v => v.type === 'hero' && v.owner === owner && v.heroIdx === idx);
const gefragt = (t, pi, n) => t.prompts.filter(p => p.pi === pi && p.d.title === n).length;

const HELDEN = {
  'Broghan, the Frozen Guardian of the North': {},
  'Arthor, Inheritor of the Barbarian Sword': {},
  'Heragas, the Monster Slayer': { ziel: 'kreatur' },
  'Kohta, Master of Super-Killing': { kohta: true },
  'Brackle, the Catapulting Turtle': { ziel: 'held', opfer: true },
};

async function szene(me, op, name, o = {}) {
  const cfg = HELDEN[name];
  const hand = [[], []]; if (o.cloak) hand[op] = ['Invisibility Cloak'];
  const t = await H.fresh({ hand, deckSize: 30, hp: 800, active: me });
  t.setHero(me, 0, name, 800);
  if (o.cloak) t.grantFor(op, 1, 'Invisibility Cloak');
  let opfer = null;
  if (cfg.opfer) { opfer = t.put(me, 0, 0, H.INERT.creature); opfer.turnPlayed = 1; opfer.counters.currentHp = 200; }
  const kreatur = t.put(op, 1, 0, H.INERT.creature); kreatur.turnPlayed = 1;   // für Heragas ein erlaubtes Ziel (vor dem Ende des letzten Zuges beschworen)
  t.gs.players[me]._turnEndStamp = undefined;
  t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
  t.targetFn = (v) => {
    const opferPicker = cfg.opfer && !v.some(x => x.type === 'hero');
    if (o.abbruch && !opferPicker) return null;                                            // Zielwahl des Schadens weggeklickt (Brackle: ‚Back' → Opfer-Picker, dort Abbruch)
    const ziel = cfg.ziel === 'kreatur' ? v.find(x => x.owner === op && x.type === 'equip') : (posHero(v, op, 0) || v[0]);
    if (cfg.ziel === 'kreatur') return [(ziel || v[0]).id];
    if (opferPicker) return o.abbruch ? null : [v[0].id];                                   // Opfer-Picker (Brackle): die eigene Kreatur
    return [ziel.id];
  };
  return { t, kreatur, opfer };
}
const stempel = (t, me, name) => t.gs.hoptUsed?.[t.engine.heroHoptKey(name, me)] === t.gs.turn;
const zaehler = (t, me) => ({ ap: ps(t, me).attacksPlayedThisTurn || 0, h: (ps(t, me).heroesAttackedThisTurn || []).includes(0), hit: t.hero(me, 0)._attacksThisTurn || 0 });
async function feuer(t, me, name) {
  t.gs.activePlayer = me;
  await t.activateHero(me, 0, { phase: name.startsWith('Kohta') ? 3 : 2 });   // Kohta: „spend your Action" → Aktionsphase
}

(async () => {
  const R = H.runner();
  for (const [me, op] of [[0, 1], [1, 0]]) {
    for (const name of Object.keys(HELDEN)) {
      const cfg = HELDEN[name];
      const kurz = name.split(',')[0];
      const hpOp = (t) => t.hp(op, 0);
      // ── Normalfall (Gegenprobe): ohne Reaktion trifft der Effekt, Stempel verbraucht, zählt ──
      R.section(`Sitz ${me}: ${kurz} · ohne Reaktion (Gegenprobe) – trifft, Stempel verbraucht, zählt als Attack`);
      { const { t, kreatur } = await szene(me, op, name);
        const hp0 = hpOp(t), k0 = kreatur.counters.currentHp;
        await feuer(t, me, name);
        const traf = cfg.ziel === 'kreatur' ? (kreatur.zone !== 'support' || (kreatur.counters.currentHp ?? 1e9) < (k0 ?? 1e9)) : hpOp(t) < hp0;
        R.check('der Effekt traf', traf, { hp0, hp: hpOp(t) });
        R.check('Stempel verbraucht', stempel(t, me, name) || (cfg.kohta && t.gs.hoptUsed?.[`kohta-super-kill:${me}`] === t.gs.turn), t.gs.hoptUsed);
        R.check('zählt als gespielter Attack (genau einmal)', JSON.stringify(zaehler(t, me)) === JSON.stringify({ ap: 1, h: true, hit: 1 }), zaehler(t, me));
        R.check('sauber', sauber(t), { e: t.errors, a: t.audit() }); }

      // ── Negierung im Zielfenster (Invisibility Cloak) ──
      R.section(`Sitz ${me}: ${kurz} · Invisibility Cloak negiert den Treffer – Stempel bleibt verbraucht, zählt als Attack`);
      { const { t, kreatur, opfer } = await szene(me, op, name, { cloak: true });
        const hp0 = hpOp(t), k0 = kreatur.counters.currentHp;
        await feuer(t, me, name);
        R.check('Invisibility Cloak wurde angeboten', gefragt(t, op, 'Invisibility Cloak') >= 1 || t.prompts.some(p => p.pi === op && /Invisibility Cloak/.test(JSON.stringify(p.d))), t.prompts.map(p => p.d.title));
        R.check('kein Schaden am Ziel', hpOp(t) === hp0 && kreatur.zone === 'support' && (kreatur.counters.currentHp ?? k0) === k0, { hp: hpOp(t) });
        R.check('der Einmal-Stempel ist VERBRAUCHT', stempel(t, me, name) || (cfg.kohta && t.gs.hoptUsed?.[`kohta-super-kill:${me}`] === t.gs.turn), t.gs.hoptUsed);
        if (cfg.kohta) R.check('Kohta: die harte Sperre `kohta-super-kill` steht', t.gs.hoptUsed?.[`kohta-super-kill:${me}`] === t.gs.turn, t.gs.hoptUsed);
        R.check('der negierte Treffer zählt als gespielter Attack (attacksPlayedThisTurn 1, Held in heroesAttackedThisTurn, hero._attacksThisTurn 1; Spell-Zähler 0)', JSON.stringify(zaehler(t, me)) === JSON.stringify({ ap: 1, h: true, hit: 1 }) && (ps(t, me).spellsPlayedThisTurn || 0) === 0, zaehler(t, me));
        if (cfg.opfer) R.check('Brackle: das Opfer (Kosten) ist bezahlt – die Kreatur ist weg', opfer.zone !== 'support', opfer.zone);
        R.check('kein Flag-Rest: `_spellNegatedByEffect` und `_zielNegiertDurchSchutz` sind frei', !t.gs._spellNegatedByEffect && !t.gs._zielNegiertDurchSchutz, { a: t.gs._spellNegatedByEffect, b: t.gs._zielNegiertDurchSchutz });
        // zweiter Versuch im selben Zug: nicht möglich (kein Schaden, keine neue Abfrage)
        const fragen0 = t.prompts.length;
        await feuer(t, me, name);
        R.check('zweiter Versuch im selben Zug nicht möglich (kein Schaden, keine neue Abfrage)', hpOp(t) === hp0 && t.prompts.length === fragen0, { neu: t.prompts.length - fragen0 });
        R.check('sauber', sauber(t), { e: t.errors, a: t.audit() }); }

      // ── Abbruch durch den Spieler selbst: bleibt ein Abbruch ──
      R.section(`Sitz ${me}: ${kurz} · der Spieler bricht die Zielwahl ab – Stempel frei, zählt nicht`);
      { const { t, kreatur, opfer } = await szene(me, op, name, { abbruch: true });
        await feuer(t, me, name);
        R.check('Stempel NICHT verbraucht', !stempel(t, me, name) && !(cfg.kohta && t.gs.hoptUsed?.[`kohta-super-kill:${me}`] === t.gs.turn), t.gs.hoptUsed);
        R.check('zählt nicht als Attack', JSON.stringify(zaehler(t, me)) === JSON.stringify({ ap: 0, h: false, hit: 0 }), zaehler(t, me));
        R.check('kein Schaden', hpOp(t) === 800 && kreatur.zone === 'support', { hp: hpOp(t) });
        if (cfg.opfer) R.check('Brackle: das Opfer ist NICHT weg (Abbruch kostet nichts)', opfer.zone === 'support', opfer.zone);
        R.check('sauber', sauber(t), { e: t.errors, a: t.audit() }); }
    }
  }
  R.finish();
})();
