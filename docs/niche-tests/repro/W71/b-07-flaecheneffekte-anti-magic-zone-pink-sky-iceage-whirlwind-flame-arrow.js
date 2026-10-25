'use strict';
// W71b-07 · Cool Rescuer Monia: FLÄCHENEFFEKTE (Status auf alle Kreaturen, Schaden an Helden und Kreaturen) und Pfeile
//
// Ein Flächeneffekt ist EIN Effekt: Monia wird je Karte/Effekt UND Seite höchstens einmal gefragt (angenommen: ein Angebot für den ganzen Effekt, abgelehnt: höchstens eines je Seite).
//   · Anti Magic Zone / Pink Sky („negate the effects of all Creatures") nutzten `selfInflicted` nur, um das Tor zu überspringen — das schaltete auch das Schutzfenster ab; jetzt `fensterTrotzdem`.
//   · Iceage / Medusa's Curse treffen erst die Helden: Monias Held wäre eingefroren, bevor die erste Kreatur dran ist. Jetzt öffnet das Fenster vorab für alle Kreaturen (`engine.kreaturenVorab`).
//   · Whirlwind Strike (Attack: Schaden an Helden UND allen Kreaturen) und Flame Arrow (Pfeil: Brennen auf das Ziel einer Attack) bleiben wie sie waren — Gegenprobe, dass nichts doppelt fragt.
//   · Tearing Mountain (Ruling 23.10.: „effects that would prevent Burning" sind aufgehoben, Monia eingeschlossen) bleibt die dokumentierte AUSNAHME: kein Angebot, die Kreaturen brennen.
// Aufruf: node docs/niche-tests/repro/W71/b-07-….js   (Exit 0 = korrekt; auf dem Stand vor W71b rot)
const S = require('../../lib/monia-sweep.js');
const { H } = S;
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(2); });

const DEFS = [
  { name: 'Anti Magic Zone', hand: ['Anti Magic Zone'], flaeche: true, ziel: 'gegner', spiel: (t, W, h) => t.play(W, 'Anti Magic Zone', { hero: h }) },
  { name: 'Pink Sky', hand: ['Pink Sky'], flaeche: true, ziel: 'gegner', spiel: (t, W, h) => t.play(W, 'Pink Sky', { hero: h }) },
  { name: 'Iceage', hand: ['Iceage'], flaeche: true, ziel: 'gegner', spiel: (t, W, h) => t.play(W, 'Iceage', { hero: h }) },
  { name: 'Forbidden Zone', hand: ['Forbidden Zone'], ablage: 0, flaeche: true, ziel: 'gegner', spiel: (t, W, h) => t.play(W, 'Forbidden Zone', { hero: h }) },
  { name: 'Armageddon', hand: ['Armageddon'], flaeche: true, ziel: 'gegner', spiel: (t, W, h) => t.play(W, 'Armageddon', { hero: h }) },
  { name: 'Whirlwind Strike', hand: ['Whirlwind Strike'], flaeche: true, targetFn: (V) => (valid) => valid.filter(v => v.type === 'hero' && v.owner === V).slice(0, 2).map(v => v.id), ziel: 'gegner', spiel: (t, W, h) => t.play(W, 'Whirlwind Strike', { hero: h }) },
];

(async () => {
  const R = H.runner();
  await S.tabelle(R, DEFS);

  // ═══ Pfeil: Flame Arrow („Burn the target") — Monia fragt für den Pfeil, nicht doppelt ═══
  for (const m of [0, 1]) {
    const o = 1 - m;
    for (const wirker of ['gegner', 'eigen']) {
      const W = wirker === 'gegner' ? o : m, V = 1 - W, hero = wirker === 'gegner' ? 0 : 1;
      for (const antwort of ['nein', 'ja']) {
        R.section(`Flame Arrow · Monia Sitz ${m} · Wirker Sitz ${W} (${wirker === 'gegner' ? 'Gegner' : 'Monias Besitzer'}) · Attack auf eine Kreatur von Sitz ${V} · Monia ${antwort === 'ja' ? 'nimmt an' : 'lehnt ab'} (nur den Pfeil)`);
        const { t } = await S.szene({ m, handM: W === m ? ['Flame Arrow', 'Attack'] : [], handO: W === o ? ['Flame Arrow', 'Attack'] : [] });
        t.setAbilities(W, hero, [['Fighting'], [], []]);
        const log = S.skript(t, antwort, V, /Flame Arrow/);
        t.targetFn = (valid) => { const k = valid.find(v => v.type === 'equip' && v.owner === V); return k ? [k.id] : undefined; };
        const kre = t.engine.cardInstances.find(c => c.zone === 'support' && (c.controller ?? c.owner) === V && c.name === 'ZZ Dummy Big');
        await t.play(W, 'Attack', { hero });
        await S.ende(t, W);
        const ang = S.angebote(t);
        const arrow = ang.filter(a => a.d.triggerCardName === 'Flame Arrow');
        R.check('der Pfeil wurde gespielt', t.gs.players[W].discardPile.includes('Flame Arrow'), t.gs.players[W].discardPile);
        R.check('Monia fragt für „Flame Arrow" genau einmal (zusätzlich zum Schaden der Attack)', arrow.length === 1, ang.map(a => a.d.triggerCardName));
        R.check(antwort === 'nein' ? 'abgelehnt: die Kreatur brennt' : 'angenommen: die Kreatur brennt NICHT (der Schaden der Attack lief weiter)', antwort === 'nein' ? !!kre.counters.burned : !kre.counters.burned && S.hp(kre) < 1000, { burned: kre.counters.burned, hp: S.hp(kre) });
        R.check('keine Engine-Fehler', t.errors.length === 0, t.errors.slice(0, 2));
      }
    }
  }

  // ═══ Ausnahme: Tearing Mountain ═══
  // „At the start of a player's turn, that player must choose a target they control and Burn it … any effects that would prevent targets from being Burned are negated" — Monia eingeschlossen.
  for (const m of [0, 1]) {
    const o = 1 - m;
    R.section(`Tearing Mountain (dokumentierte Ausnahme, Ruling 23.10.) · Monia Sitz ${m} brennt am eigenen Zugbeginn eine eigene Kreatur — Monia kann es nicht verhindern`);
    const { t } = await S.szene({ m, handO: ['Tearing Mountain'] });
    S.skript(t, 'ja', m);
    t.targetFn = (valid) => { const k = valid.find(v => v.type === 'equip' && v.owner === m); return k ? [k.id] : undefined; };
    await t.play(o, 'Tearing Mountain', { hero: 0 });
    await S.ende(t, o);
    await t.endTurn();              // Zugwechsel: Sitz m ist am Zug und muss ein eigenes Ziel brennen
    const brennen = t.engine.cardInstances.filter(c => c.zone === 'support' && (c.controller ?? c.owner) === m && c.counters.burned).length;
    R.check('kein Angebot: das Brennen ignoriert jeden Schutz inklusive Monia', S.angebote(t).length === 0, S.angebote(t).length);
    R.check('die gewählte Kreatur brennt', brennen === 1, brennen);
  }
  R.finish();
})().catch(e => { process.stderr.write(String(e && e.stack || e) + '\n'); process.exit(2); });
