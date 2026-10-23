'use strict';
// W66b-04 · Call of the Deepsea: ein Abbruch der Opfer-/Tribut-Wahl der beschworenen Kreatur gibt die Einmal-Sperre zurück, zeigt nichts — die besiegte Karte wird erst NACH der Kostenwahl gelöscht (Al, 23.10.2026)
//
// Kartentext: „Once per turn, when a Creature in one of your Heroes' Support Zones is defeated, you may delete it and summon a Creature with a different name from your hand or discard pile into the same
//   Support Zone as an additional Action."
// Vorher: HOPT, Banner, Strudel-Animation UND „delete it" (die besiegte Karte wanderte in den Gelöscht-Stapel) liefen VOR der Kostenwahl der beschworenen Kreatur — ein Abbruch dort ließ die Einmal-Sperre
//   verbraucht und die besiegte Karte gelöscht zurück (und hatte dem Gegner Banner + Strudel gezeigt).
// Jetzt: Galerie → KOSTENWAHL (`summonFromPile` fragt zuerst; letzte Abbruchstelle) → erst danach: HOPT, Banner, Strudel, „delete it", Flug und Landung.
// Auslöser: ein echter Tod (`actionDestroyCard`) der eigenen Kreatur im Platz eines eigenen Helden; Kandidaten aus der Hand (Blue-Ice Dragon) und aus der Ablage (500 Piranhas, die sich selbst legt).
// Beide Sitze. Exit 0 = korrekt.
const W = require('../../lib/wire.js');
const CD = 'Call of the Deepsea';
const OPFER = W.INERT.frail;
const hoptKey = (t) => Object.keys(t.gs.hoptUsed || {}).find(k => k.startsWith('call-of-the-deepsea:'));
const gezeigt = (r, seat) => r.tl.filter(e => e.k === 'wire' && e.sid !== 'S' + seat && e.ev !== 'game_state' && e.ev !== 'spectator_state' && (/triggered|whirlpool/.test(e.ev + JSON.stringify(e.data || '')) || (e.ev === 'play_zone_animation' && e.data && e.data.type === 'deepsea_summon_whirlpool'))).length;

(async () => {
  const R = W.runner();
  for (const seat of [0, 1]) {
    for (const [kre, quelle, lvl] of [['Blue-Ice Dragon', 'hand', 3], ['500 Piranhas in a Monster Suit', 'discard', 1], ['Blue-Ice Dragon', 'discard', 3]]) {
      const label = `[S${seat}] ${CD} → ${kre} (${quelle})`;
      R.section(label);
      const mk = async () => {
        const t = await W.reicheSzene({ seat, karten: quelle === 'hand' ? [kre] : [], board: async (t2, s) => {
          if (quelle === 'discard') t2.gs.players[s].discardPile.push(kre);
          t2.put(s, 0, 2, CD).turnPlayed = 1;
          t2.setAbilities(s, 0, [Array(lvl).fill('Summoning Magic'), Array(lvl).fill('Fighting'), []]);
        } });
        const ps = t.gs.players[seat];
        // der Sterbende: eigene schwache Kreatur im Platz 0 von Held 0 (die reiche Szene hat dort BIG → ersetzen)
        const alt = t.find(W.INERT.big, 'support'); t.inst(c => c.zone === 'support' && c.owner === seat && c.heroIdx === 0 && c.zoneSlot === 0).forEach(c => t.engine._untrackCard(c.id));
        ps.supportZones[0][0] = [];
        const opfer = t.put(seat, 0, 0, OPFER); opfer.turnPlayed = 1; opfer.counters.currentHp = 10; opfer.counters.maxHp = 10;
        t._opfer = opfer;
        t._ablVor = ps.discardPile.slice(); t._handVor = ps.hand.slice(); t._geloeschtVor = ps.deletedPile.slice();
        return t;
      };
      const callFn = (t) => t.engine.actionDestroyCard({ name: 'Test', owner: 1 - seat }, t._opfer);
      const antwort = (e) => (e.kind === 'generic' && e.d.type === 'cardGallery' && e.d.title === CD) ? { cardName: kre, source: quelle } : undefined;
      // Vor dem Tod (Szenenzustand) → der Tod selbst ändert den Zustand (Kreatur in die Ablage); die Abbruch-Prüfung vergleicht darum den Zustand NACH dem Tod, VOR dem Angebot (am Galerie-Fenster)
      const undoneFn = (t) => !hoptKey(t) && t.gs.players[seat].deletedPile.length === t._geloeschtVor.length && !t.inst(c => c.name === kre && c.zone === 'support').length;
      const d = await W.durchlauf(mk, seat, CD, { seat, hero: 0, maxCancel: 6, prepFn: async () => {}, callFn, answer: antwort, undoneFn, aktivierung: true, zustandsdiff: false });
      const c = d.clean;
      R.check(`${label}: Durchlauf — Kreatur beschworen, Sperre gestempelt, die besiegte Karte GELÖSCHT`, !!hoptKey(c.t) && c.t.inst(x => x.name === kre && x.zone === 'support').length === 1 && c.t.gs.players[seat].deletedPile.includes(OPFER), { hopt: hoptKey(c.t), del: c.t.gs.players[seat].deletedPile, err: c.t.errors });
      R.check(`${label}: Durchlauf — Banner/Strudel gehen an den Gegner`, gezeigt(c.r, seat) > 0, c.r.tl.filter(e => e.k === 'wire' && e.sid === 'S' + (1 - seat)).map(e => e.ev).slice(0, 14));
      for (const { k, r, t } of d.cancels) {
        const ps = t.gs.players[seat];
        const bezahlt = !!hoptKey(t) && ps.deletedPile.includes(OPFER);
        R.check(`${label}: Abbruch an Stelle ${k} — entweder alles zurück (Sperre frei, besiegte Karte in der Ablage, nichts beschworen) oder alles verbindlich (Sperre UND gelöscht), nie halb`, r.undone || bezahlt, { hopt: hoptKey(t), del: ps.deletedPile.length, vor: t._geloeschtVor.length });
        if (r.undone) {
          R.check(`${label}: Abbruch an Stelle ${k} — die besiegte Karte (${OPFER}) liegt noch in der Ablage, Beschwörungs-Kandidat an seinem Platz (${quelle})`, ps.discardPile.includes(OPFER) && !ps.deletedPile.includes(OPFER) && (quelle === 'hand' ? ps.hand.includes(kre) : ps.discardPile.includes(kre)), { abl: ps.discardPile.length, hand: ps.hand.length });
          R.check(`${label}: Abbruch an Stelle ${k} — Gegner/Zuschauer sehen weder Banner noch Strudel`, gezeigt(r, seat) === 0, r.tl.filter(e => e.k === 'wire' && e.sid !== 'S' + seat && e.ev !== 'game_state').map(e => e.ev).slice(0, 14));
        }
      }
      const echt = d.cancels.filter(x => x.r.undone).length;
      R.check(`${label}: mindestens eine echte Abbruchstelle — gefunden ${echt}`, echt >= 1, d.cancels.map(x => [x.k, x.r.undone]));
      R.check(`${label}: die Kostenwahl der Kreatur ist selbst eine echte Abbruchstelle (Galerie + Kostenwahl = mindestens 2)`, kre === '500 Piranhas in a Monster Suit' ? echt >= 1 : echt >= 2, d.cancels.map(x => [x.k, x.r.undone]));
    }
  }
  R.finish();
})().catch(e => { process.stderr.write(String(e && e.stack || e) + '\n'); process.exit(2); });
