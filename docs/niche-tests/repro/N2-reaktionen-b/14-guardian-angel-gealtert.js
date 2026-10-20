'use strict';
// N2-14 · Guardian Angel + Forbidden Curse of Aging: der Held überlebt mit 1 HP, der Engel ist verbraucht
// Kartentext (Guardian Angel): „If the Hero this card is attached to would be defeated, fully heal its HP instead and delete this card."
// Kartentext (Forbidden Curse of Aging): „The HP of the Hero this Spell is attached to cannot be healed …"
// guardian-angel.js onHeroKO: löscht den Engel, setzt `hero.hp = 1` (Todesverhinderung), ruft dann `actionHealHero(…, maxHp − 1)` — Aging blockt das Heilen.
// Beobachtet: Held bleibt mit 1 HP am Leben, Guardian Angel liegt im Gelöscht-Stapel (einmal pro Spiel verbraucht).
// Lesart A (heute): der Ersatzeffekt „heal instead" verhindert die Niederlage, das Heilen scheitert an der Sperre → 1 HP.
// Lesart B: kann nicht geheilt werden, tritt der Ersatz nicht ein → Held wird besiegt, der Engel bleibt liegen.
// Lesart C: Engel schützt nur, wenn er auch heilen kann (kein Verbrauch, Held besiegt).
// ★ W25b (Al, Welle 25: „ist-Zustand passt"): Lesart A gilt — der Held bleibt mit 1 HP am Leben, der Engel verbraucht sich (Gelöscht-Stapel des Besitzers). Das Repro prüft jetzt genau das (Exit 0);
//   Gegenprobe ohne Aging: der Held wird voll geheilt.
const H = require('../../lib/h.js');
const sup = (t, s, h) => t.gs.players[s].supportZones[h].map(z => z[0] || '');
(async () => {
  const R = H.runner();
  for (const [me, op] of [[0, 1], [1, 0]]) {
    R.section(`Sitz ${me} legt Guardian Angel und Aging auf Held 0 von Sitz ${op}, dann ein tödlicher Zauber`);
    const t = await H.fresh({ hand: me === 0 ? [['Guardian Angel', 'Forbidden Curse of Aging', 'Burning Finger'], []] : [[], ['Guardian Angel', 'Forbidden Curse of Aging', 'Burning Finger']], deckSize: 30 });
    t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
    t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === op && x.heroIdx === 0).id];
    await t.play(me, 'Guardian Angel', { hero: 0 });
    await t.play(me, 'Forbidden Curse of Aging', { hero: 0 });
    t.hero(op, 0).hp = 100;
    await t.play(me, 'Burning Finger', { hero: 0 });
    R.note('Ergebnis', { hp: t.hp(op, 0), engelGeloescht: t.pile(me, 'deletedPile').includes('Guardian Angel'), support: sup(t, op, 0) });
    const lebt = t.hp(op, 0) > 0, engelWeg = t.pile(me, 'deletedPile').includes('Guardian Angel');
    R.check('Held überlebt mit genau 1 HP (Heilung am gealterten Helden gesperrt)', lebt && t.hp(op, 0) === 1, t.hp(op, 0));
    R.check('Guardian Angel hat sich verbraucht (Gelöscht-Stapel des Wirkers, nicht mehr am Helden)', engelWeg && !sup(t, op, 0).includes('Guardian Angel'), { engelWeg, support: sup(t, op, 0) });
    R.check('Aging bleibt am Helden liegen', sup(t, op, 0).includes('Forbidden Curse of Aging'), sup(t, op, 0));
    R.check('keine Engine-Fehler / sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }
  {
    R.section('Gegenprobe ohne Aging: der Held wird voll geheilt');
    const t = await H.fresh({ hand: [['Guardian Angel', 'Burning Finger'], []], deckSize: 30 });
    t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
    t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0).id];
    await t.play(0, 'Guardian Angel', { hero: 0 });
    t.hero(1, 0).hp = 100;
    await t.play(0, 'Burning Finger', { hero: 0 });
    R.check('Held lebt mit voller HP', t.hp(1, 0) === 800, t.hp(1, 0));
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
