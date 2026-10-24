'use strict';
// W71e-04 · Teleport × Tri Fecta / Tri Ad (Al, 24.10.2026): die Puppet-Tokens wandern als einzige Ausnahme MIT dem Helden;
// fänden sie keinen Platz, ist das Paar nicht erlaubt (Tri Fecta/Tri Ad lassen sich nur mit einem Helden tauschen, der freie Support Zones für die Puppets hat).
const H = require('../../lib/h.js');
const P = require('../../../../cards/effects/_puppets-shared.js');
const CARD = 'Teleport';
const FECTA = P.TRI_FECTA, AD = P.TRI_AD;
const RICK = 'Rick, the Trigger Happy Undertaker', ZWEI = 'Zwei, the Lucky Thief';
const waehle = (t, a, b, seat = 0) => { t.targetFn = (valid) => [`hero-${seat}-${a}`, `hero-${seat}-${b}`].filter(id => valid.some(v => v.id === id)); };
const tokens = (t, col) => t.engine.cardInstances.filter(c => c.zone === 'support' && c.owner === 0 && c.heroIdx === col && P.isPuppetToken(c.name));
const szene = async (extra = {}) => {
  const t = await H.fresh({ hand: [[CARD], []], heroes: [[FECTA, RICK, ZWEI], null], ...extra });
  await t.run(() => t.engine.runHooks('onGameStart', {}));   // Tri Fecta legt ihren Startsatz (3 Puppets) in ihre Spalte
  return t;
};

(async () => {
  const R = H.runner();

  R.section('A · Tri Fecta ↔ Held mit freien Zonen: die Puppets wandern mit');
  {
    const t = await szene();
    R.check('Vorbedingung: 3 Puppets in Spalte 0', tokens(t, 0).length === 3, tokens(t, 0).map(i => i.name));
    const luck = tokens(t, 0)[0]; luck.counters.luck = 2;
    const preserve = tokens(t, 0)[2]; preserve.counters.preserve = 1;
    t.gs._puppetActiveLock = { '0-0': { turn: t.gs.turn, instId: luck.id } };
    const ids = tokens(t, 0).map(i => i.id);
    waehle(t, 0, 1);
    const r = await t.play(0, CARD, { hero: 2 });
    R.check('gespielt', r === true, r);
    R.check('Tri Fecta steht auf Platz 1, Rick auf Platz 0', t.gs.players[0].heroes[1].name === FECTA && t.gs.players[0].heroes[0].name === RICK);
    R.check('alle 3 Puppets stehen in Spalte 1 (gleiche Instanzen), Spalte 0 hat keine', tokens(t, 1).length === 3 && tokens(t, 0).length === 0 && tokens(t, 1).every(i => ids.includes(i.id)), [tokens(t, 1).length, tokens(t, 0).length]);
    R.check('Slots 0–2 der Spalte 1 tragen die Puppet-Namen (Zone ↔ Instanz konsistent)', [0, 1, 2].every(s => (t.gs.players[0].supportZones[1][s] || []).length === 1 && t.gs.players[0].supportZones[1][s][0] === tokens(t, 1).find(i => i.zoneSlot === s).name), t.gs.players[0].supportZones[1]);
    R.check('Spalte 0 hat keine Puppet-Namen mehr', t.gs.players[0].supportZones[0].every(z => (z || []).length === 0), t.gs.players[0].supportZones[0]);
    R.check('Luck-/Preserve-Counter bleiben an ihren Puppets', luck.counters.luck === 2 && preserve.counters.preserve === 1);
    R.check('Aktivsperre der Spalte wandert mit (0-0 → 0-1)', !t.gs._puppetActiveLock['0-0'] && !!t.gs._puppetActiveLock['0-1'], t.gs._puppetActiveLock);
    R.check('Tri Fecta lebt, kein „no tokens"-Tod', t.hp(0, 1) === 800 && !t.lg('puppet_hero_no_tokens').length, [t.hp(0, 1), t.lg('puppet_hero_no_tokens')]);
    await t.turnStart(0);
    R.check('auch nach dem Zugbeginn (Niederlage-Prüfung) lebt Tri Fecta', t.hp(0, 1) === 800 && t.errors.length === 0, [t.hp(0, 1), t.errors]);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
    R.check('Zustand sauber', t.audit().length === 0, t.audit());
  }

  R.section('B · Platzmangel: Paar nicht erlaubt');
  {
    // Rick (Spalte 1) hat 1 Kreatur → nur 2 freie Zonen, Tri Fecta braucht 3. Zwei (Zwei, Spalte 2) hat Platz.
    const t = await szene();
    t.put(0, 1, 0, H.INERT.creature);
    const tg = []; t.targetFn = (valid) => { tg.push(valid.slice()); return [`hero-0-0`, `hero-0-1`].filter(id => valid.some(v => v.id === id)); };
    const vor = JSON.stringify(t.gs.players[0].heroes.map(h => h.name));
    const r = await t.play(0, CARD, { hero: 2 });
    R.check('Wahl „Tri Fecta + Rick (nur 2 freie Zonen)" führt NICHT zum Tausch', JSON.stringify(t.gs.players[0].heroes.map(h => h.name)) === vor || t.gs.players[0].heroes[1].name !== FECTA, t.gs.players[0].heroes.map(h => h.name));
    R.check('Puppets unverändert in Spalte 0', tokens(t, 0).length === 3 && tokens(t, 1).length === 0, [tokens(t, 0).length, tokens(t, 1).length]);
    R.check('Tri Fecta ist als Ziel NICHT ausgegraut (Zwei hat Platz)', tg[0] && tg[0].find(v => v.id === 'hero-0-0') && !tg[0].find(v => v.id === 'hero-0-0').ineligible, tg[0] && tg[0].map(v => [v.id, !!v.ineligible]));
  }
  {
    const t = await szene();
    t.put(0, 1, 0, H.INERT.creature);
    waehle(t, 0, 2);
    await t.play(0, CARD, { hero: 1 });
    R.check('Tri Fecta ↔ Zwei (Spalte 2 leer) klappt: Puppets in Spalte 2', t.gs.players[0].heroes[2].name === FECTA && tokens(t, 2).length === 3 && tokens(t, 0).length === 0, [t.gs.players[0].heroes.map(h => h.name), tokens(t, 2).length]);
    R.check('Rick (Spalte 1) bleibt samt Kreatur unberührt', (t.gs.players[0].supportZones[1][0] || [])[0] === H.INERT.creature);
  }
  {
    // alle anderen Spalten voll: Tri Fecta hat KEINEN gültigen Partner → Karte nicht spielbar
    const t = await szene();
    t.put(0, 1, 0, H.INERT.creature); t.put(0, 2, 0, H.INERT.creature);
    // Rick ↔ Zwei bleibt ein gültiges Paar → spielbar, aber Tri Fecta ausgegraut
    const tg = []; t.targetFn = (valid) => { tg.push(valid.slice()); return [`hero-0-1`, `hero-0-2`]; };
    const r = await t.play(0, CARD, { hero: 2 });
    R.check('Rick ↔ Zwei bleibt möglich; Tri Fecta ist ausgegraut (kein Partner mit 3 freien Zonen)', r === true && (!tg[0].find(v => v.id === 'hero-0-0') || tg[0].find(v => v.id === 'hero-0-0').ineligible === true) && !tg[0].find(v => v.id === 'hero-0-1').ineligible, tg[0] && tg[0].map(v => [v.id, !!v.ineligible]));
    R.check('Tri Fecta blieb stehen', t.gs.players[0].heroes[0].name === FECTA && tokens(t, 0).length === 3);
  }
  {
    // nur zwei Helden, der andere ohne Platz → Karte gar nicht spielbar
    const t = await szene();
    t.setHero(0, 2, null, 0);
    t.put(0, 1, 0, H.INERT.creature);
    const r = await t.play(0, CARD, { hero: 1 });
    R.check('einziges mögliches Paar ohne Platz: Teleport nicht spielbar, Karte bleibt auf der Hand', r === false && t.pile(0, 'hand').includes(CARD), r);
  }

  R.section('C · Tri Fecta ↔ Tri Ad: beide Puppet-Sätze tauschen die Spalten');
  {
    const t = await H.fresh({ hand: [[CARD], []], heroes: [[FECTA, AD, ZWEI], null] });
    await t.run(() => t.engine.runHooks('onGameStart', {}));
    for (const [slot, name] of [[0, P.PAVI], [1, P.SARAS], [2, P.LAKI]]) await t.run(() => P.placePuppetToken(t.engine, 0, 1, name, slot, { source: AD }));
    R.check('Vorbedingung: je 3 Puppets in beiden Spalten', tokens(t, 0).length === 3 && tokens(t, 1).length === 3, [tokens(t, 0).length, tokens(t, 1).length]);
    const aus0 = tokens(t, 0).map(i => i.name).sort(), aus1 = tokens(t, 1).map(i => i.name).sort();
    waehle(t, 0, 1);
    const r = await t.play(0, CARD, { hero: 2 });
    R.check('gespielt, Helden getauscht', r === true && t.gs.players[0].heroes[0].name === AD && t.gs.players[0].heroes[1].name === FECTA, [r, t.gs.players[0].heroes.map(h => h.name)]);
    R.check('Spalte 0 trägt jetzt Tri Ads Satz, Spalte 1 Tri Fectas Satz', JSON.stringify(tokens(t, 0).map(i => i.name).sort()) === JSON.stringify(aus1) && JSON.stringify(tokens(t, 1).map(i => i.name).sort()) === JSON.stringify(aus0), [tokens(t, 0).map(i => i.name), tokens(t, 1).map(i => i.name)]);
    await t.turnStart(0);
    R.check('beide Helden leben, keine Fehler', t.hp(0, 0) === 800 && t.hp(0, 1) === 800 && t.errors.length === 0, [t.hp(0, 0), t.hp(0, 1), t.errors]);
  }

  R.section('D · Puppets und Ausrüstung: Nicht-Puppet-Karten der Zielspalte bleiben, Puppets füllen die freien Slots');
  {
    const t = await szene();
    t.put(0, 1, 2, H.INERT.creature);               // Rick: Slot 2 belegt, Slots 0/1 frei → Platz für 2 Puppets, nicht 3
    waehle(t, 0, 1);
    const vor = t.gs.players[0].heroes.map(h => h.name);
    await t.play(0, CARD, { hero: 2 });
    R.check('2 freie Zonen reichen für 3 Puppets NICHT', JSON.stringify(t.gs.players[0].heroes.map(h => h.name)) === JSON.stringify(vor) || t.gs.players[0].heroes[1].name !== FECTA);
  }
  {
    const t = await szene();
    // Tri Fecta: eine Puppet stirbt vorher (2 Puppets) → 2 freie Zonen genügen
    const weg = tokens(t, 0)[2];
    await t.run(() => t.engine.actionDestroyCard({ name: 'x', owner: 1 }, weg));
    t.put(0, 1, 2, H.INERT.creature);
    waehle(t, 0, 1);
    await t.play(0, CARD, { hero: 2 });
    R.check('2 Puppets + 2 freie Zonen: Tausch klappt, Puppets in Slots 0/1, Kreatur bleibt in Slot 2', t.gs.players[0].heroes[1].name === FECTA && tokens(t, 1).length === 2 && tokens(t, 1).every(i => i.zoneSlot < 2) && (t.gs.players[0].supportZones[1][2] || [])[0] === H.INERT.creature, [tokens(t, 1).map(i => i.zoneSlot), t.gs.players[0].supportZones[1]]);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }

  R.finish();
})().catch(e => { process.stderr.write('THROW ' + (e && e.stack || e) + '\n'); process.exit(2); });
