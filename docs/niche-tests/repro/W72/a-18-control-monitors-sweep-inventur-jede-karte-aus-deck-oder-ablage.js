'use strict';
// W72a · WAECHTER-SWEEP über die Inventur: „Karte kam aus Deck/Ablage auf die Hand, ohne dass das Fenster geöffnet wurde" (Control Monitors, Fehlerbericht Magnetic Potion).
//
// Methode (lib/handzugang-sweep.js): Jede Karte (Spell, Attack, Creature, Artifact, Potion, Ability — alle spielbaren Handkarten), jede Aktivierung (Held, Area, Kreatur, Ausrüstung, freie/aktive Ability,
// Permanent, Ablage-Effekt) und ein Teil der Passiven (Auslöser: Zugbeginn, Fireball, Attack, Beschwörung, Abwurf, Opfer, Schaden, Zugwechsel) läuft über den echten Spielweg. Der Gegner hält Control Monitors
// (er lehnt immer ab — gemessen wird das FENSTER), der Wirker hat ein Deck mit JEDER Karte einmal und eine reiche Ablage. Gemessen wird der Zustand: Zuwachs der Wirker-Hand an Karte n (ohne Ziehen), soweit sie
// aus Deck/Ablage kam = „Herkunft"; Lücke = Herkunft(n) > Zahl der Karten n, die ein Hook `onHandAddFromPile` gemeldet hat. Auf dem Stand vor W72a: 45 Lücken allein bei den Handkarten (nur Abwurf-Tutoren meldeten).
// Dokumentierte Ausnahmen (`AUSNAHMEN`) sind Karten, bei denen der Zuwachs NICHT aus dem eigenen Deck/der eigenen Ablage kommt.
// Neue Tutor-Karten, die an den zentralen Primitiven vorbeigehen, fallen hier (und im statischen Wächter a-19) auf. Aufruf: node …/a-18-….js   (Exit 0 = korrekt; PP_W72_VOLL=1: auch alle Passiven, ~10 min)
const S = require('../../lib/handzugang-sweep.js');
const Zs = require('../../lib/zustands-sweep.js');
const { H } = S;
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(2); });

const AUSNAHMEN = new Map([
  ['Teleportal', 'Teleportal: das Deck → „offen vor dir" (Permanent-Zone); erst zu Beginn des nächsten Zuges „add it to your hand" — die Quelle des Zugangs ist die Zone, nicht Deck/Ablage (Rückfrage an Al)'],
  ["held:Rha'Bi, the Living Skeleton", 'Rha\'Bi: legt Deckkarten verdeckt auf das Brett des Gegners, nimmt sie später von dort auf die Hand — Quelle ist das Brett (Rückfrage an Al, wie Teleportal)'],
]);

(async () => {
  const R = H.runner();
  const funde = [], fehler = [];
  let laeufe = 0, mitHerkunft = 0, mitFenster = 0; const herkunftKarten = new Set();
  const pruefe = (name, a, t) => {
    laeufe++;
    if (a.herkunft.size) { mitHerkunft++; herkunftKarten.add(name); }
    if (a.fenster.size) mitFenster++;
    for (const l of a.luecken) if (!AUSNAHMEN.has(name)) funde.push(`${name}: ${l.name} (Herkunft ${l.herkunft}, gemeldet ${l.gemeldet}, notiert ${l.notiert})`);
    if (t.errors.length) fehler.push(`${name}: ${t.errors[0].slice(0, 120)}`);
  };

  // ── Selbsttest: der Wächter ist kein stummer Alarm ──
  R.section('Selbsttest: ein Eigenbau-Zugang (takeFromPile OHNE toHand + handZugangSync) wird als Lücke gemeldet, der kanonische Weg nicht');
  {
    const roh = await S.eigenlauf(1, async (t, w) => { await t.engine.takeFromPile(w, 'deck', 'Fireball', { source: 'Probe' }); t.engine.handZugangSync(w, 'Fireball', { source: 'Probe' }); });
    R.check('Eigenbau ohne Meldung → Lücke', roh.a.luecken.some(l => l.name === 'Fireball'), roh.a.luecken);
    const ok = await S.eigenlauf(1, async (t, w) => { await t.engine.actionAddCardFromDeckToHand(w, 'Fireball', { source: 'Probe', reveal: false }); });
    R.check('actionAddCardFromDeckToHand → Fenster, keine Lücke', ok.a.luecken.length === 0 && ok.a.fenster.get('Fireball') === 1, { l: ok.a.luecken, f: [...ok.a.fenster] });
    const ok2 = await S.eigenlauf(1, async (t, w) => { await t.engine.takeFromPile(w, 'deck', 'Fireball', { source: 'Probe', toHand: true }); t.engine.handZugangSync(w, 'Fireball', { source: 'Probe' }); });
    R.check('takeFromPile(toHand) + handZugangSync → Fenster, keine Lücke', ok2.a.luecken.length === 0 && ok2.a.fenster.get('Fireball') === 1, { l: ok2.a.luecken, f: [...ok2.a.fenster] });
    const ok3 = await S.eigenlauf(1, async (t, w) => { await t.engine.takeFromPile(w, 'deck', 'Fireball', { source: 'Probe' }); t.engine.handZugangSync(w, 'Fireball', { source: 'Probe' }); t.engine.noteHandZugangAusStapel(w, 'Fireball', { pile: 'deck', source: 'Probe' }); });
    R.check('Eigenbau-Vertrag: takeFromPile + handZugangSync + noteHandZugangAusStapel → Fenster, keine Lücke', ok3.a.luecken.length === 0 && ok3.a.fenster.get('Fireball') === 1, { l: ok3.a.luecken, f: [...ok3.a.fenster] });
  }

  // ── Handkarten ──
  for (const [w, mod] of [[1, 1], [0, 4]]) {
    R.section(`Handkarten · Wirker Sitz ${w} (${mod === 1 ? 'alle' : 'jede 4.'})`);
    const liste = S.handkartenListe(mod, 0);
    for (const c of liste) {
      try { const { t, a } = await S.spieleKarte(c, { w }); pruefe(c.name, a, t); }
      catch (e) { fehler.push(`${c.name}: ${String(e.message).slice(0, 100)}`); }
    }
    R.note('Handkarten', `${liste.length} Karten, davon ${mitHerkunft} mit Herkunft Deck/Ablage (bisher)`);
  }
  // ── Aktivierungen ──
  for (const [w, mod] of [[1, 1], [0, 3]]) {
    R.section(`Aktivierungen · Wirker Sitz ${w} (${mod === 1 ? 'alle' : 'jede 3.'})`);
    const liste = Zs.aktivierungsListe().filter((x, i) => i % mod === 0);
    for (const [g, name] of liste) {
      try { const { t, a } = await S.aktiviere(g, name, { w }); pruefe(`${g}:${name}`, a, t); }
      catch (e) { fehler.push(`${g}:${name}: ${String(e.message).slice(0, 100)}`); }
    }
    R.note('Aktivierungen', `${liste.length} Einträge`);
  }
  // ── Passive ──
  {
    const voll = !!process.env.PP_W72_VOLL;
    const liste = S.passivListe(voll ? 1 : 8, 0);
    for (const pflicht of [['held', 'Monsieur Pete, the Booty Raider'], ['kreatur', 'Slippery Narw'], ['kreatur', 'Bishop of Kings [W]'], ['area', 'Spatial Crevice']]) if (!liste.some(x => x[0] === pflicht[0] && x[1] === pflicht[1]) && H.DB[pflicht[1]]) liste.push(pflicht);
    R.section(`Passive und Auslöser · Wirker Sitz 1 (${voll ? 'alle' : 'jede 8. + Pflichtliste'}, ${liste.length} Einträge)`);
    for (const [g, name] of liste) {
      try { const { t, a } = await S.passiv(g, name, { w: 1 }); pruefe(`${g}:${name}`, a, t); }
      catch (e) { fehler.push(`${g}:${name}: ${String(e.message).slice(0, 100)}`); }
    }
  }

  R.section('Auswertung');
  R.check(`${laeufe} Läufe, ${mitHerkunft} mit Zugang aus Deck/Ablage, ${mitFenster} mit Fenster (Sweep misst etwas)`, mitHerkunft >= 45 && mitFenster >= 45, { laeufe, mitHerkunft, mitFenster });
  for (const n of ['Magnetic Potion', 'Magnetic Glove', 'Gate to the Armory', 'Shooting Star', 'Elixir of Mana', 'Divine Gift of Creation', 'Relic in the Sky', 'Magic Sapphire', 'Meditation', 'Mass Multiplication', 'Birthday Present', 'Spatial Crevice', 'kreatur:Cute Dog', 'frei:Navigation', 'held:Cute Annoyance Mini', 'ausruestung:Lunatic Cycle - New Moon', 'kreatur:Slippery Narw', 'kreatur:Bishop of Kings [W]']) {
    R.check(`Pflichtfall mit Zugang und Fenster: ${n}`, herkunftKarten.has(n) || herkunftKarten.has('kreatur:' + n) || herkunftKarten.has('area:' + n), n);
  }
  R.check('KEINE Lücke: jede Karte, die aus Deck/Ablage auf die Hand kam, hat das Fenster geöffnet (außer den dokumentierten Ausnahmen)', funde.length === 0, funde.slice(0, 20));
  for (const [k, v] of AUSNAHMEN) R.note('dokumentierte Ausnahme', `${k} — ${v}`);
  R.check('keine Engine-Fehler in den Läufen', fehler.length === 0, fehler.slice(0, 8));
  R.finish();
})().catch(e => { process.stderr.write(String(e && e.stack || e) + '\n'); process.exit(2); });
