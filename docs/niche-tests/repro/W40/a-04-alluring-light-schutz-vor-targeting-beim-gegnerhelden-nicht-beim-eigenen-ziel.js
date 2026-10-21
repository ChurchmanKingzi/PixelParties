'use strict';
// W40a · Punkt 5 · Al, 22.10.2026 (Antwort auf W39a-Rückfrage 5): „Alluring Light wählt ein gegnerisches UND ein eigenes Ziel. Beim eigenen Ziel greift kein Schutz vor Targeting wie Butterfly Cloud — aber beim
//  gegnerischen schon. Ein per Butterfly Cloud untargetable Hero kann NICHT als der Angreifer für Alluring Light gewählt werden!"
// Kartentext: „Choose a Hero your opponent controls and a target you control. Your chosen target takes damage equal to the chosen Hero's Attack stat. This is treated as the chosen Hero attacking your chosen target."
// Regel: Die Wahl des gegnerischen Helden (des gezwungenen Angreifers) ist eine normale Zielwahl gegen den Gegner — Butterfly Cloud (`untargetable`), Invisibility (`invisible`), Stealth (Stufe 1 der Karte), Alliance …
//  gelten; ein Truth-Seeing Eye des Wirkers hebt sie auf. Die Schutzrechnung läuft über ALLE lebenden Gegnerhelden („solange andere Heroes gewählt werden können" — sind alle geschützt, bricht der Schutz zusammen);
//  danach fallen Helden heraus, die nicht angreifen können (W34a). Ist keiner wählbar, ist die Karte unspielbar. Das EIGENE Ziel (Opfer) prüft keinen Schutz vor Targeting. Der Angriff ist ein Attack des gezwungenen
//  Helden (W32a/W34a unverändert). Hardy Slime (Taunt): die Karte lässt den Gegner nichts „choosen" — kein Zwang (Ja/Nein-Frage an Al).
// Exit 1 auf der Basis (der Schutz zählte nur gegen die Liste der angriffsfähigen Helden, Karte spielbar mit dem einzigen angriffsfähigen Helden, Truth-Seeing Eye ohne Wirkung), Exit 0 auf dem Branch.
// Aufruf: node docs/niche-tests/repro/W40/a-04-alluring-light-schutz-vor-targeting-beim-gegnerhelden-nicht-beim-eigenen-ziel.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;
const ids = (v) => v.map(x => x.id).sort().join(',');

/** Alluring Light spielen; erfasst die angebotenen Listen von Angreifer-Wahl (nur Gegnerhelden) und Opfer-Wahl (eigene Ziele). */
async function licht(me, op, aufbau, o = {}) {
  const t = await H.fresh({ hand: me === 0 ? [['Alluring Light'], []] : [[], ['Alluring Light']], hp: 800, deckSize: 20, active: me });
  t.grantFor(me, 1, 'Alluring Light');
  for (let hi = 0; hi < 3; hi++) { t.hero(op, hi).atk = 100; t.hero(op, hi).baseAtk = 100; }
  if (aufbau) await aufbau(t);
  const angebot = { angreifer: null, opfer: null };
  t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
  t.targetFn = (v, cfg) => {
    if (!cfg || cfg.title !== 'Alluring Light') return undefined;
    const el = v.filter(x => !x.ineligible);
    if (el.length && el.every(x => x.owner === op && x.type === 'hero') && !angebot.angreifer) {
      angebot.angreifer = { alle: ids(v), waehlbar: ids(el), inel: ids(v.filter(x => x.ineligible)) };
      const wunsch = el.find(x => x.heroIdx === (o.angreifer ?? el[0].heroIdx)) || el[0];
      return [wunsch.id];
    }
    angebot.opfer = { alle: ids(v), waehlbar: ids(el) };
    const w = (o.opfer && el.find(x => x.id === o.opfer)) || el.find(x => x.owner === me && x.type === 'hero') || el[0];
    return w ? [w.id] : null;
  };
  const hpVorher = [0, 1, 2].map(i => t.hp(me, i));
  const r = await t.play(me, 'Alluring Light', { hero: 1 });
  return { t, r, angebot, hpVorher, hpNachher: [0, 1, 2].map(i => t.hp(me, i)), treffer: t.gs.players[op] };
}

(async () => {
  const R = H.runner();
  for (const [me, op] of [[0, 1], [1, 0]]) {
    R.section('Sitz ' + me);
    const hero = (i) => `hero-${op}-${i}`;

    // ── Gegenprobe ohne Schutz: Held 0 des Gegners ist als Angreifer wählbar und schlägt ──
    {
      const x = await licht(me, op, null, { angreifer: 0 });
      R.check('ohne Schutz: alle drei Gegnerhelden wählbar', x.r === true && x.angebot.angreifer && x.angebot.angreifer.waehlbar === [hero(0), hero(1), hero(2)].sort().join(','), x.angebot.angreifer);
      R.check('ohne Schutz: Held 0 greift an (Opfer = eigener Held 0 verliert HP)', x.hpNachher[0] === x.hpVorher[0] - 100, { vorher: x.hpVorher, nachher: x.hpNachher });
      R.check('ohne Schutz: keine Engine-Fehler, Zustand sauber', sauber(x.t), { errors: x.t.errors, audit: x.t.audit() });
    }

    // ── Butterfly Cloud (`untargetable`) und Invisibility (`invisible`) auf dem Gegnerhelden: nicht als Angreifer wählbar ──
    for (const status of ['untargetable', 'invisible']) {
      const x = await licht(me, op, async (t) => { t.heroStatus(op, 0, status); }, { angreifer: 0 });
      R.check(`${status} auf Held 0 des Gegners: er steht nicht zur Wahl, die anderen beiden schon`, x.r === true && x.angebot.angreifer && !x.angebot.angreifer.waehlbar.includes(hero(0)) && x.angebot.angreifer.waehlbar === [hero(1), hero(2)].sort().join(','), x.angebot.angreifer);
      R.check(`${status}: der gezwungene Angreifer ist Held 1 oder 2 (nicht der geschützte Held 0): der eigene Held 0 bekommt Schaden von 100, und Held 0 des Gegners hat nicht geschlagen`, x.hpNachher[0] === x.hpVorher[0] - 100, { vorher: x.hpVorher, nachher: x.hpNachher });
      R.check(`${status}: keine Engine-Fehler, Zustand sauber`, sauber(x.t), { errors: x.t.errors, audit: x.t.audit() });
    }

    // ── Normaler Zusammenbruch: sind ALLE Gegnerhelden geschützt, bleibt der Schutz wirkungslos (wie bei jeder Zielwahl) ──
    {
      const x = await licht(me, op, async (t) => { for (let i = 0; i < 3; i++) t.heroStatus(op, i, 'untargetable'); });
      R.check('alle drei Gegnerhelden untargetable: Schutz bricht zusammen, alle wählbar (wie bei jeder anderen Zielwahl)', x.r === true && x.angebot.angreifer && x.angebot.angreifer.waehlbar === [hero(0), hero(1), hero(2)].sort().join(','), x.angebot.angreifer);
    }

    // ── Einziger angriffsfähiger Held ist geschützt, die anderen sind eingefroren: kein wählbarer Angreifer → Karte unspielbar ──
    {
      const x = await licht(me, op, async (t) => { t.heroStatus(op, 0, 'untargetable'); t.heroStatus(op, 1, 'frozen'); t.heroStatus(op, 2, 'frozen'); });
      R.check('Held 0 untargetable, Helden 1 und 2 eingefroren: Alluring Light ist unspielbar (kein wählbarer Angreifer)', x.r === false && !x.angebot.angreifer && x.hpNachher.every((h, i) => h === x.hpVorher[i]), { r: x.r, angebot: x.angebot.angreifer });
      R.check('  die Karte bleibt auf der Hand', x.t.gs.players[me].hand.includes('Alluring Light'), x.t.gs.players[me].hand);
    }
    {
      const x = await licht(me, op, async (t) => { t.heroStatus(op, 0, 'invisible'); t.heroStatus(op, 1, 'stunned'); t.heroStatus(op, 2, 'stunned'); });
      R.check('Held 0 invisible, Helden 1 und 2 betäubt: unspielbar', x.r === false, { r: x.r });
    }

    // ── Stealth Lv 1 (Gegner-Held 0): Alluring Light ist ein Spell Lv 1 → der Held ist als Angreifer nicht wählbar ──
    {
      const x = await licht(me, op, async (t) => { t.setAbilities(op, 0, [['Stealth'], [], []]); });
      R.check('Stealth Lv 1 auf Held 0: nicht als Angreifer wählbar', x.r === true && x.angebot.angreifer && !x.angebot.angreifer.waehlbar.includes(hero(0)), x.angebot.angreifer);
    }

    // ── Truth-Seeing Eye des Wirkers hebt den Schutz auf ──
    {
      const x = await licht(me, op, async (t) => { t.heroStatus(op, 0, 'untargetable'); t.put(me, 1, 0, 'Truth-Seeing Eye'); }, { angreifer: 0 });
      R.check('Truth-Seeing Eye am Wirker: der geschützte Held 0 ist wählbar (wie bei jedem anderen Angriff/Spell)', x.angebot.angreifer && x.angebot.angreifer.waehlbar.includes(hero(0)), x.angebot.angreifer);
    }

    // ── EIGENES Ziel: kein Schutz vor Targeting ──
    for (const status of ['untargetable', 'invisible']) {
      const x = await licht(me, op, async (t) => { t.heroStatus(me, 0, status); }, { opfer: `hero-${me}-0`, angreifer: 0 });
      R.check(`eigener Held 0 ${status}: als Opfer wählbar (kein Schutz beim eigenen Ziel)`, x.angebot.opfer && x.angebot.opfer.waehlbar.includes(`hero-${me}-0`), x.angebot.opfer);
      R.check(`eigener Held 0 ${status}: er nimmt den Schaden des erzwungenen Angriffs`, x.hpNachher[0] === x.hpVorher[0] - 100, { vorher: x.hpVorher, nachher: x.hpNachher });
      R.check(`eigener Held 0 ${status}: keine Engine-Fehler, Zustand sauber`, sauber(x.t), { errors: x.t.errors, audit: x.t.audit() });
    }
    {
      // alle eigenen Helden geschützt und trotzdem wählbar; Stealth Lv 1 auf dem eigenen Opfer greift ebenfalls nicht
      const x = await licht(me, op, async (t) => { for (let i = 0; i < 3; i++) t.heroStatus(me, i, 'untargetable'); t.setAbilities(me, 0, [['Stealth'], [], []]); }, { opfer: `hero-${me}-0` });
      R.check('alle eigenen Helden untargetable (+ Stealth auf Held 0): alle drei als Opfer wählbar', x.angebot.opfer && x.angebot.opfer.waehlbar === [0, 1, 2].map(i => `hero-${me}-${i}`).sort().join(','), x.angebot.opfer);
    }
    {
      // eigene Kreatur als Opfer wählbar (Gegenprobe: ein Kreaturen-Opfer wird nicht gefiltert)
      const x = await licht(me, op, async (t) => { const c = t.put(me, 2, 0, H.INERT.creature); c.turnPlayed = 1; t.heroStatus(me, 0, 'invisible'); }, { opfer: `equip-${me}-2-0` });
      R.check('eigene Kreatur als Opfer wählbar', x.angebot.opfer && x.angebot.opfer.waehlbar.includes(`equip-${me}-2-0`), x.angebot.opfer);
    }
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
