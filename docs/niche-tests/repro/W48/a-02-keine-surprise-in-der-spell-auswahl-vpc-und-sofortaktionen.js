'use strict';
// W48a · Punkt 3b · Al, 22.10.2026: „In diesem Timeframe von ‚Choose a Spell to activate' sollte überhaupt keine Surprise aktivierbar sein!" — gilt für Victory Phoenix Cannon und ALLE gleichartigen Sofort-Spell-
// Wahlen. Zentral: `engine.spellAuswahlOffen()` (Zähler, gesetzt von `promptSpellAuswahl`/`_mitSpellAuswahl`), geprüft in `_canHeroActivateSurprise` und `_activateSurprise`.
// Messung: im offenen Auswahl-Prompt löst die Antwortfunktion einen Gold-Gewinn des Wählenden aus (Auslöser der Surprise Gold Trap des Gegners). Im Fenster: keine Aktivierung, das Gold geht an den
// Wählenden; Gegenprobe NACH der Wahl (derselbe Auslöser aktiviert die Surprise) und: was der gewählte Spell danach regulär auslöst (Zielwahl/Treffer des Spells), liegt hinter dem Fenster und bleibt normal.
// Matrix: VPC (Bestätigung + Galerie) · performImmediateAction · performImmediateActionAnyHero · Call for Help · Yukana-/Difficulty-Lever-artige Galerien (Quelltext-Prüfung, siehe Tabelle) × beide Sitze.
// Exit ≠ 0 auf der Basis 581e4ca6 (Fehlschläge bzw. Absturz, weil `spellAuswahlOffen` fehlt), Exit 0 auf dem Branch.
// Aufruf: node docs/niche-tests/repro/W48/a-02-keine-surprise-in-der-spell-auswahl-vpc-und-sofortaktionen.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const fs = require('fs');
const path = require('path');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;
const aktiv = (t, pi, name) => t.logs.filter(l => l.type === 'surprise_activated' && l.data.card === name && l.data.player === 'P' + (pi + 1)).length;
const DM3 = [['Destruction Magic', 'Destruction Magic', 'Destruction Magic'], ['Support Magic', 'Support Magic', 'Support Magic', 'Support Magic'], []];

/** Szene: `pi` wählt, der Gegner hält Gold Trap (Held 1). `messe` wird im offenen Prompt aufgerufen. */
async function szene(pi, hand) {
  const t = await H.fresh({ hand: [[], []], hp: 800, deckSize: 20, active: pi, gold: 200 });
  const op = 1 - pi;
  for (const n of hand) t.addHand(pi, n);
  t.setAbilities(pi, 0, DM3);
  t.putSurprise(op, 1, 'Gold Trap'); t.grantFor(op, 1, 'Gold Trap');
  t.rec = [];
  t.messe = async (tag) => {
    const vor = aktiv(t, op, 'Gold Trap'), g0 = t.gs.players[pi].gold;
    await t.engine.actionGainGold(pi, 30);
    t.rec.push({ tag, offen: t.engine.spellAuswahlOffen(), aktiviert: aktiv(t, op, 'Gold Trap') - vor, gold: t.gs.players[pi].gold - g0 });
  };
  return t;
}
const imFenster = (t, tag) => t.rec.filter(r => r.tag === tag);

(async () => {
  const R = H.runner();
  for (const pi of [0, 1]) {
    const op = 1 - pi;
    R.section(`Sitz ${pi} wählt: Victory Phoenix Cannon (Bestätigung „Cast another Spell?" und Galerie „Choose a … Spell")`);
    {
      const t = await szene(pi, ['Victory Phoenix Cannon', 'Meteor Crash']);
      t.script.push({ match: d => d.type === 'confirm' && d.title === 'Victory Phoenix Cannon', answer: async () => { await t.messe('vpc-confirm'); return { confirmed: true }; } });
      t.script.push({ match: d => d.type === 'cardGallery' && d.title === 'Victory Phoenix Cannon', answer: async (d) => { await t.messe('vpc-galerie'); return { cardName: 'Meteor Crash' }; } });
      t.script.push({ match: d => d.type === 'playerPicker', answer: () => ({ playerIdx: op }) });
      t.targetFn = (valid) => { const v = valid.find(q => q.type === 'hero' && q.owner === op && q.heroIdx === 0); return [(v || valid[0]).id]; };
      await t.play(pi, 'Victory Phoenix Cannon', { hero: 0, noGrant: true });
      for (const tag of ['vpc-confirm', 'vpc-galerie']) {
        const r = imFenster(t, tag)[0];
        R.check(`VPC ${tag}: Fenster offen, Gold Trap des Gegners aktiviert NICHT (der Gold-Gewinn läuft normal: +30 für den Wählenden)`, !!r && r.offen === true && r.aktiviert === 0 && r.gold === 30, r);
      }
      R.check('VPC: der Folgezauber (Meteor Crash) wurde gewirkt, Rückstoß 200 auf den Helden', t.pile(pi, 'discardPile').includes('Meteor Crash') && t.hp(pi, 0) === 600, { ablage: t.pile(pi, 'discardPile'), hp: t.hp(pi, 0) });
      R.check('VPC: nach dem Fenster ist der Zähler geschlossen', t.engine.spellAuswahlOffen() === false, t.engine._spellAuswahlTiefe);
      const vor = aktiv(t, op, 'Gold Trap');
      await t.run(() => t.engine.actionGainGold(pi, 30));
      R.check('VPC Gegenprobe NACH dem Fenster: derselbe Auslöser aktiviert Gold Trap', aktiv(t, op, 'Gold Trap') === vor + 1, { vor, nach: aktiv(t, op, 'Gold Trap') });
      R.check('VPC: sauber', sauber(t), { e: t.errors, a: t.audit() });
    }
    {   // Abbruch der Galerie: das Fenster schließt sich auch bei Abbruch
      const t = await szene(pi, ['Victory Phoenix Cannon', 'Meteor Crash']);
      t.script.push({ match: d => d.type === 'confirm' && d.title === 'Victory Phoenix Cannon', answer: () => ({ confirmed: true }) });
      t.script.push({ match: d => d.type === 'cardGallery' && d.title === 'Victory Phoenix Cannon', answer: async () => { await t.messe('abbruch'); return { cancelled: true }; } });
      t.script.push({ match: d => d.type === 'playerPicker', answer: () => ({ playerIdx: op }) });
      t.targetFn = (valid) => { const v = valid.find(q => q.type === 'hero' && q.owner === op && q.heroIdx === 0); return [(v || valid[0]).id]; };
      await t.play(pi, 'Victory Phoenix Cannon', { hero: 0, noGrant: true });
      const r = imFenster(t, 'abbruch')[0];
      R.check('VPC Abbruch der Galerie: im Fenster gesperrt, danach geschlossen', !!r && r.offen && r.aktiviert === 0 && t.engine.spellAuswahlOffen() === false, { r, tiefe: t.engine._spellAuswahlTiefe });
    }

    R.section(`Sitz ${pi} wählt: performImmediateAction / performImmediateActionAnyHero (Coffee, Elixir of Rage, Junshi, Hu, Master's Plan, Dream Dust, Shamanic Curse …)`);
    for (const art of ['performImmediateAction', 'performImmediateActionAnyHero']) {
      const t = await szene(pi, ['Meteor Crash']);
      t.script.push({ match: d => d.type === 'heroAction', answer: async () => { await t.messe(art); return { cancelled: true }; } });
      await t.run(() => art === 'performImmediateAction' ? t.engine.performImmediateAction(pi, 0, { title: 'Test', cancellable: true }) : t.engine.performImmediateActionAnyHero(pi, { title: 'Test', cancellable: true }));
      const r = imFenster(t, art)[0];
      R.check(`${art}: im Auswahl-Prompt ist keine Surprise aktivierbar (Gold Trap bleibt zu, Zähler offen)`, !!r && r.offen === true && r.aktiviert === 0 && r.gold === 30, r);
      R.check(`${art}: nach der Wahl/dem Abbruch geschlossen; derselbe Auslöser aktiviert Gold Trap wieder`, t.engine.spellAuswahlOffen() === false && await (async () => { const v = aktiv(t, op, 'Gold Trap'); await t.run(() => t.engine.actionGainGold(pi, 30)); return aktiv(t, op, 'Gold Trap') === v + 1; })(), t.engine._spellAuswahlTiefe);
      R.check(`${art}: sauber`, sauber(t), { e: t.errors, a: t.audit() });
    }
    {   // Wirkt der Spieler den gewählten Spell, gelten Zielwahl/Treffer des Spells normal (hinter dem Fenster): Booby Trap des Gegners reagiert auf den Treffer
      const t = await szene(pi, ['Meteor Crash']);
      t.putSurprise(op, 0, 'Booby Trap'); t.grantFor(op, 0, 'Booby Trap');
      t.script.push({ match: d => d.type === 'heroAction', answer: (d) => ({ cardName: 'Meteor Crash', handIndex: t.gs.players[pi].hand.indexOf('Meteor Crash'), heroIdx: 0 }) });
      t.targetFn = (valid) => { const v = valid.find(q => q.type === 'hero' && q.owner === op && q.heroIdx === 0); return [(v || valid[0]).id]; };
      await t.run(() => t.engine.performImmediateAction(pi, 0, { title: 'Test', cancellable: true }));
      R.check('Der gewählte Spell (Meteor Crash) trifft; die Surprise des Gegners (Booby Trap) reagiert regulär NACH dem Fenster auf den Treffer (-100 auf den Wirker)', aktiv(t, op, 'Booby Trap') === 1 && t.hp(op, 0) <= 700 && t.hp(pi, 0) === 700, { bt: aktiv(t, op, 'Booby Trap'), hpOp: t.hp(op, 0), hpMe: t.hp(pi, 0) });
    }

    R.section(`Sitz ${pi} wählt: Call for Help (Galerie „Choose a level 2 or lower Spell … play it immediately")`);
    {
      const t = await szene(pi, ['Call for Help', 'Meteor Crash']);
      t.gs.players[pi]._lastCreatureDefeatedTurn = t.gs.turn;   // „a Creature you control was defeated since the start of your turn"
      t.script.push({ match: d => d.type === 'cardGallery' && d.title === 'Call for Help', answer: async (d) => { await t.messe('cfh'); return { cardName: 'Meteor Crash', source: 'hand' }; } });
      t.targetFn = (valid) => { const v = valid.find(q => q.type === 'hero' && q.owner === op && q.heroIdx === 0); return [(v || valid[0]).id]; };
      await t.play(pi, 'Call for Help', { hero: 0 });
      const r = imFenster(t, 'cfh')[0];
      R.check('Call for Help: im Galerie-Fenster ist keine Surprise aktivierbar', !!r && r.offen === true && r.aktiviert === 0 && r.gold === 30, r);
      R.check('Call for Help: sauber, Zähler geschlossen', sauber(t) && t.engine.spellAuswahlOffen() === false, { e: t.errors });
    }
  }

  // Quelltext-Inventar: jede Sofort-Spell-Auswahl-Stelle geht über `promptSpellAuswahl`/`_mitSpellAuswahl` (zentral)
  R.section('Inventar: Sofort-Spell-Auswahl-Stellen nutzen das zentrale Fenster');
  const E = path.resolve(__dirname, '../../../../cards/effects');
  const stellen = [
    ['victory-phoenix-cannon.js', /_mitSpellAuswahl\(\(\) => ctx\.promptConfirmEffect/], ['victory-phoenix-cannon.js', /promptSpellAuswahl\(pi, \{\s*\/\/ W48a: Zeitfenster der Spell-Auswahl\s*type: 'cardGallery'/],
    ['yukana-the-scholar-on-the-run.js', /promptSpellAuswahl\(pi/], ['friedhelm-the-misled-avenger.js', /_mitSpellAuswahl\(\(\) => ctx\.promptCardGallery/], ['call-for-help.js', /promptSpellAuswahl\(pi/],
    ['difficulty-lever.js', /promptSpellAuswahl\(pi/], ['aurora-borealis.js', /promptSpellAuswahl\(pi/], ['_hell-circles-shared.js', /promptSpellAuswahl\(pi/], ['learning.js', /promptSpellAuswahl\(pi/],
    ['archibald-the-archmage.js', /promptSpellAuswahl\(ctx\.cardOwner/], ['_engine.js', /promptSpellAuswahl\(playerIdx, \{[^\n]*\n\s*type: 'heroAction',\s*\n\s*heroIdx,/], ['_engine.js', /promptSpellAuswahl\(playerIdx, \{[^\n]*\n\s*type: 'heroAction',\s*\n\s*\/\/ heroIdx intentionally omitted/],
  ];
  for (const [f, re] of stellen) R.check(`${f}: ${re.source.slice(0, 50)}…`, re.test(fs.readFileSync(path.join(E, f), 'utf8')), f);
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
