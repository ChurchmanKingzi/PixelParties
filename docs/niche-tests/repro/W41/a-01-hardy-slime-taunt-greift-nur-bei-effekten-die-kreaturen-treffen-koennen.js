'use strict';
// W41a · Punkt 1 · Al, 22.10.2026 (Antwort auf W40a-Rückfrage 1): „Der Taunt greift in beiden Fällen NICHT; das einzige Gegner-Ziel, das Alluring Light wählt, muss ein Hero sein, Effekte, die nur Heroes treffen
//  können, werden von Hardy Slime nicht abgedeckt (das ‚if possible' in seinem Text), also passt das."
// Kartentext Hardy Slime: „When you summon this Creature, your opponent has to choose it with all Attacks and Spells they use until your next turn, if possible."
// Regel: der Taunt gilt nur für Effekte, die den Slime überhaupt WÄHLEN können (Kreaturen-Ziele). Ein Effekt, der nur Helden treffen kann (Alluring Light, Memory Wipe, Whirlwind Strike …), hat den Slime nicht in
//  seiner Zielmenge → „if possible" greift nicht → der Taunt filtert nichts. Ein Effekt, der Kreaturen treffen kann (Attack, Fireball), muss den Slime wählen. Gegenproben ohne Slime.
// Befund: die Engine setzt es überall so um (`_applyForcesTargetingFilter`: ohne den Slime in der Zielliste kein Filter; Aufrufer: promptDamageTarget, promptMultiTarget, normalizeValidTargets) — Ist-Zustand bleibt.
// Aufruf: node docs/niche-tests/repro/W41/a-01-hardy-slime-taunt-greift-nur-bei-effekten-die-kreaturen-treffen-koennen.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
const ids = (v) => v.map(x => x.id).sort().join(',');
const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;

/** Karte spielen; `slime` = der Gegner hat in diesem Zug einen Hardy Slime beschworen (Taunt auf `me`). Liefert alle Listen, die Gegnerziele enthielten. */
async function spiele(me, op, karte, o = {}) {
  const t = await H.fresh({ hand: me === 0 ? [[karte], []] : [[], [karte]], hp: 800, deckSize: 20, active: me });
  for (let hi = 0; hi < 3; hi++) { t.hero(op, hi).atk = 100; t.hero(op, hi).baseAtk = 100; t.hero(me, hi).atk = 100; t.hero(me, hi).baseAtk = 100; }
  const andere = t.put(op, 2, 1, H.INERT.creature); andere.turnPlayed = 1;
  let slime = null;
  if (o.slime) {
    slime = t.put(op, 1, 0, 'Hardy Slime'); slime.turnPlayed = 1;
    // wie `onPlay`: Taunt gegen `me` bis zum nächsten Zug des Beschwörers
    slime.counters.forcesTargeting = true; slime.counters.forcesTargeting_pi = me; slime.counters.forcesTargeting_untilTurn = (t.gs.turn || 0) + 1;
    slime.counters.buffs = { ...(slime.counters.buffs || {}), forcesTargeting: true };
  }
  if (o.aufbau) await o.aufbau(t);
  const listen = [];
  t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
  t.targetFn = (v, cfg) => {
    const gegner = v.filter(x => x.owner === op || (x.type === 'equip' && x.cardInstance && (x.cardInstance.controller ?? x.cardInstance.owner) === op));
    if (!gegner.length) { const el = v.filter(x => !x.ineligible); return el.length ? [el[0].id] : null; }
    const el = v.filter(x => !x.ineligible);
    listen.push({ titel: cfg && cfg.title, waehlbar: ids(el.filter(x => x.owner === op)) });
    const w = (slime && el.find(x => x.cardInstance && x.cardInstance.id === slime.id)) || el.find(x => x.owner === op && x.type === 'hero') || el.find(x => x.owner === op) || el[0];
    return w ? [w.id] : null;
  };
  const r = await t.play(me, karte, { hero: o.hero ?? 0 });
  return { t, r, listen, slime, andere };
}

(async () => {
  const R = H.runner();
  for (const [me, op] of [[0, 1], [1, 0]]) {
    R.section('Sitz ' + me);
    const slimeId = `equip-${op}-1-0`;
    const alleGegner = [0, 1, 2].map(i => `hero-${op}-${i}`);

    // ── Effekte, die Kreaturen treffen können: der Taunt zwingt auf den Slime ──
    for (const karte of ['Attack', 'Fireball']) {
      const x = await spiele(me, op, karte, { slime: true });
      R.check(`${karte} (kann Kreaturen treffen) mit Hardy Slime: der Gegner-Teil der Zielwahl ist NUR der Slime`, x.listen.length >= 1 && x.listen[0].waehlbar === slimeId, x.listen);
      R.check(`${karte} ohne Hardy Slime (Gegenprobe): alle Gegnerziele wählbar`, (await (async () => { const y = await spiele(me, op, karte, {}); return y.listen.length >= 1 && y.listen[0].waehlbar.split(',').length === 4 && y.listen[0].waehlbar.includes(`equip-${op}-2-1`); })()), null);
      R.check(`${karte}: keine Engine-Fehler, Zustand sauber`, sauber(x.t), { errors: x.t.errors, audit: x.t.audit() });
    }

    // ── Effekte, die NUR Helden treffen können: der Taunt greift nicht („if possible") ──
    for (const karte of ['Memory Wipe', 'Whirlwind Strike']) {
      const x = await spiele(me, op, karte, { slime: true, hero: 0 });
      const l = x.listen[0];
      R.check(`${karte} (nur Helden) mit Hardy Slime: alle drei Gegnerhelden wählbar, der Taunt filtert nichts`, l && alleGegner.every(i => l.waehlbar.split(',').includes(i)) && !l.waehlbar.includes(slimeId), x.listen);
      R.check(`${karte}: keine Engine-Fehler, Zustand sauber`, sauber(x.t), { errors: x.t.errors, audit: x.t.audit() });
    }

    // ── Alluring Light: Angreifer-Wahl (Gegnerhelden) und Opfer-Wahl (eigene Ziele): der Taunt greift an keiner Stelle ──
    {
      const x = await spiele(me, op, 'Alluring Light', { slime: true, hero: 1, aufbau: async (t) => { t.grantFor(me, 1, 'Alluring Light'); const c = t.put(me, 2, 0, H.INERT.creature); c.turnPlayed = 1; } });
      const l = x.listen[0];
      R.check('Alluring Light mit Hardy Slime: Angreifer-Wahl = alle drei Gegnerhelden (nur Helden → kein Zwang auf den Slime)', x.r === true && l && l.waehlbar === alleGegner.slice().sort().join(','), x.listen);
      R.check('Alluring Light mit Hardy Slime: die Karte ist gespielt (Angriff lief), der Slime wurde nicht gezwungen/getroffen', x.r === true && (x.slime.counters.currentHp ?? 30) >= 30, { hp: x.slime.counters.currentHp });
      R.check('Alluring Light: keine Engine-Fehler, Zustand sauber', sauber(x.t), { errors: x.t.errors, audit: x.t.audit() });
      const y = await spiele(me, op, 'Alluring Light', { hero: 1, aufbau: async (t) => { t.grantFor(me, 1, 'Alluring Light'); const c = t.put(me, 2, 0, H.INERT.creature); c.turnPlayed = 1; } });
      R.check('Gegenprobe Alluring Light ohne Slime: gleiche Angreifer-Wahl', y.listen[0] && y.listen[0].waehlbar === alleGegner.slice().sort().join(','), y.listen);
    }
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
