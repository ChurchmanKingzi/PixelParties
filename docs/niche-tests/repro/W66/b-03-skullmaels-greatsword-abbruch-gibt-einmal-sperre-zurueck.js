'use strict';
// W66b-03 · Skullmael's Greatsword: ein Abbruch der Kosten-/Opfer-/Tributwahl der beschworenen Kreatur verbraucht die Einmal-Sperre NICHT und zeigt dem Gegner nichts (Al, 23.10.2026)
//
// Kartentext: „Once per turn, when the equipped Hero defeats a target with an Attack, you may immediately summon a Creature from your discard pile with it as an additional Action."
// Al: „Wird einer der Effekte abgebrochen, werden dadurch alle Limits nicht verbraucht. Außerdem werden eventuelle Kosten wie Opfer oder Gold generell immer erst bezahlt, wenn committed ist
//      und nicht mehr abgebrochen werden kann!" (auf die Frage zu Skullmael's Greatsword: JA)
// Vorher: HOPT-Schlüssel, Banner (`showTriggeredEffect`) und Animation (`undead_revival`) kamen NACH der Zonenwahl, aber VOR der Kostenwahl der beschworenen Kreatur — ein Abbruch dort ließ die
//   Einmal-Sperre verbraucht zurück und hatte dem Gegner Banner + Animation gezeigt.
// Jetzt: Galerie → (Zonenwahl) → KOSTENWAHL (letzte Abbruchstelle; Abbruch = Karte zurück in die Ablage, Sperre frei, nichts gezeigt) → erst danach: HOPT stempeln, Banner, Animation, Landung.
// Auslöser: der echte Hook `afterDamage` des Angriffs des Trägers auf einen toten Helden (`runHooks`), Beschwörung aus der Ablage mit Kosten (Archer/Warrior/Guardian of Teocuilatl, Blue-Ice Dragon,
// 500 Piranhas — die Piranhas legt sich in `beforeSummon` selbst: kein Abbruch, keine Rückgabe). Beide Sitze. Exit 0 = korrekt.
const W = require('../../lib/wire.js');
const SG = "Skullmael's Greatsword";
const KREATUREN = [['Archer of Teocuilatl', 1], ['Warrior of Teocuilatl', 1], ['Guardian of Teocuilatl', 1], ['Blue-Ice Dragon', 3], ['500 Piranhas in a Monster Suit', 1]];
const hoptKey = (t) => Object.keys(t.gs.hoptUsed || {}).find(k => k.startsWith('skullmael-greatsword:'));
const bannerGesehen = (r, seat) => r.tl.filter(e => e.k === 'wire' && e.sid !== 'S' + seat && (e.ev === 'triggered_effect' || e.ev === 'play_zone_animation' && e.data && e.data.type === 'undead_revival' || (e.ev === 'card_reveal') || (e.ev === 'announce_active_effect')) && JSON.stringify(e.data).includes(e.ev === 'play_zone_animation' ? 'undead' : SG)).length;

(async () => {
  const R = W.runner();
  for (const seat of [0, 1]) {
    for (const [kre, lvl] of KREATUREN) {
      const label = `[S${seat}] ${SG} → ${kre}`;
      R.section(label);
      const mk = async () => {
        const t = await W.reicheSzene({ seat, karten: [], board: async (t2, s) => {
          t2.gs.players[s].discardPile.push(kre);
          t2.put(s, 0, 0, SG).turnPlayed = 1;
          t2.setAbilities(s, 0, [Array(lvl).fill('Summoning Magic'), Array(lvl).fill('Fighting'), []]);
        } });
        t._ablVor = t.gs.players[seat].discardPile.slice();
        t._kreVor = t.gs.players[seat].discardPile.filter(x => x === kre).length;
        return t;
      };
      const tot = (t) => { const h = t.gs.players[1 - seat].heroes[2]; h.hp = 0; return h; };
      const callFn = (t) => {
        const eq = t.find(SG, 'support'); const ziel = tot(t);
        return t.engine.runHooks('afterDamage', { source: { name: t.gs.players[seat].heroes[0].name, owner: seat, heroOwner: seat, heroIdx: 0, zone: 'hero' }, type: 'attack', target: ziel, amount: 100, _skipReactionCheck: true });
      };
      const antwort = (e) => (e.kind === 'generic' && e.d.type === 'cardGallery' && e.d.title === SG) ? { cardName: kre, source: 'discard' } : undefined;
      const undoneFn = (t) => !hoptKey(t) && t.gs.players[seat].discardPile.filter(x => x === kre).length === t._kreVor && !t.inst(c => c.name === kre && c.zone === 'support').length;
      const d = await W.durchlauf(mk, seat, SG, { seat, hero: 0, maxCancel: 6, prepFn: async () => {}, callFn, answer: antwort, undoneFn, aktivierung: true });
      const c = d.clean;
      R.check(`${label}: Durchlauf — Kreatur beschworen, Einmal-Sperre gestempelt, Karte nicht mehr in der Ablage`, !!hoptKey(c.t) && c.t.inst(x => x.name === kre && x.zone === 'support').length === 1 && c.t.gs.players[seat].discardPile.filter(x => x === kre).length === c.t._kreVor - 1, { hopt: hoptKey(c.t), abl: c.t.gs.players[seat].discardPile.length, err: c.t.errors });
      R.check(`${label}: Durchlauf — Banner/Animation gehen an den Gegner (erst NACH der Kostenwahl)`, bannerGesehen(c.r, seat) > 0, c.r.tl.filter(e => e.k === 'wire' && e.sid === 'S' + (1 - seat)).map(e => e.ev).slice(0, 12));
      const kostenIdx = d.cancels.filter(x => x.r.cancelled && !x.r.undone === false).map(x => x.k);
      for (const { k, r, t } of d.cancels) {
        R.check(`${label}: Abbruch an Stelle ${k} — abgebrochen`, r.cancelled, null);
        // JEDE abbrechbare Stelle dieses Auslösers ist eine echte Abbruchstelle (Galerie, Zonenwahl, Kostenwahl): danach ist die Einmal-Sperre frei und die Karte noch in der Ablage
        // (Eine Rückfrage NACH der bezahlten Opferung — Blue-Ice Dragon fragt noch einmal — ist keine Abbruchstelle des Auslösers mehr: dann ist ALLES verbindlich [Sperre gestempelt UND Opfer bezahlt], nie halb.)
        const bezahlt = !!hoptKey(t) && t.gs.players[seat].discardPile.length !== t._ablVor.length;
        R.check(`${label}: Abbruch an Stelle ${k} — entweder alles zurück (Einmal-Sperre frei, Karte in der Ablage) oder alles verbindlich (Sperre UND Opfer), nie halb`, r.undone || bezahlt, { hopt: hoptKey(t), abl: t.gs.players[seat].discardPile.length, vor: t._ablVor.length });
        if (r.undone) {
          R.check(`${label}: Abbruch an Stelle ${k} — Einmal-Sperre FREI, Karte noch in der Ablage (an ihrem Platz), nichts beschworen`, !hoptKey(t) && JSON.stringify(t.gs.players[seat].discardPile) === JSON.stringify(t._ablVor) && !t.inst(x => x.name === kre && x.zone === 'support').length, { hopt: hoptKey(t), abl: t.gs.players[seat].discardPile.length });
          R.check(`${label}: Abbruch an Stelle ${k} — Gegner/Zuschauer sehen weder Banner noch Animation noch Karte`, bannerGesehen(r, seat) === 0 && r.tl.filter(e => e.k === 'wire' && e.sid !== 'S' + seat && /pile_transfer|summon_effect|undead_revival/.test(e.ev + JSON.stringify(e.data || ''))).length === 0, r.tl.filter(e => e.k === 'wire' && e.sid !== 'S' + seat && e.ev !== 'game_state' && e.ev !== 'spectator_state').map(e => e.ev));
          R.check(`${label}: Abbruch an Stelle ${k} — Zustandsdifferenz nach Abbruch = 0`, (r.zustandsDiff || []).filter(x => !/heroes\[2\]\.hp/.test(x)).length === 0, (r.zustandsDiff || []).slice(0, 6));
        }
      }
      const echt = d.cancels.filter(x => x.r.undone).length;
      R.check(`${label}: mindestens eine echte Abbruchstelle (Galerie)${kre === '500 Piranhas in a Monster Suit' || lvl ? '' : ''} — gefunden ${echt}`, echt >= 1, d.cancels.map(x => [x.k, x.r.undone]));
      // Kostenwahl: bei den Kosten-Kreaturen (außer Piranhas: eigene Wahl vor dem Auftritt) gibt es MEHR als die Galerie als Abbruchstelle
      if (kre !== '500 Piranhas in a Monster Suit') R.check(`${label}: die Kostenwahl der Kreatur ist selbst eine echte Abbruchstelle (mindestens 2 echte Stellen: Galerie + Kostenwahl)`, echt >= 2, d.cancels.map(x => [x.k, x.r.undone]));
    }
  }
  R.finish();
})().catch(e => { process.stderr.write(String(e && e.stack || e) + '\n'); process.exit(2); });
