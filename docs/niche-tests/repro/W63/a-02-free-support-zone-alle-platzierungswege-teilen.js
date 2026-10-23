'use strict';
// W63a-02 · „free Support Zone" im Kartentext + Alice: ALLE Beschwörungs-/Platzierungs-Effekte zählen die Zone einer GLEICHNAMIGEN Creature als verfügbar (Al, 22.10.2026)
//
// Al (Rückfrage 1 aus Welle 62): „Solange Transfer Alices Effekt aktiv ist, JA, das ist ja genau der Pinta-Bug! Und das sollte allgemein für alle Beschwörungs-/Platzierungs-Effekte gelten."
// W62a hatte 13 Karten per Szenario geprüft (W62/a-03). Hier die übrigen Wege: die in W62a nur „geladen/syntaxgeprüften" Karten (Elixir of Immortality, Zombified Assault, Old Couple,
// Ladder to the Sky, Arrival from the Cosmic Depths, Green Dragoneer, Doomed Town Guard, Enhanced Guard Dog, Explosive Drone, Golden Ladybug, Kings-Familie, Ushabti) UND die bei der
// systematischen Suche gefundenen Wege mit eigener Zonenschleife (Glorious Rebirth, Living Illusion, Teal Fishing Rod, The Master's Key, The Root of all Evil, Thep, Stellan, Stellin,
// Vullary, Klaus, Sentient Bomb Golems, Mausoleum Worm, Paraseed, Paraseed Zombie, Calamitusk, Bomblebee Cluster, Loyal Pinpom, Orthos, Psychic Scout, Soul Shard Khet/Ka, Terror Tengu,
// Cute Annoyance Mini, Cute Bunny/Dog/Hydra, Skullmael's Greatsword, Lunatic Hawk, Tharxian Horse, Waitress, Candlestick Squire, Elven Druid, Mischief Invasion, Hipdall; die
// Übernahmen Capture, Dark Gear, Cute Angel Molinda, Spirit of the Heart Bow, Hunting, Diplomacy, Liberation, Secret Spell Book).
// Szene (je Sitz, je Karte): Held 0 = Zone A: Stapel aus 2 GLEICHNAMIGEN Kreaturen X; alle übrigen Zonen voll (andere Kreaturen) — „voll"; Variante „gemischt": zusätzlich Zone B FREI.
//   voll → die Kreatur der Karte landet in A (Stapel ×3), nirgends sonst; gemischt → ebenfalls in A (geteilte Zone ZUERST, Al 22.10.), die freie Zone B bleibt leer;
//   GEGENPROBE ohne Alice (volles Brett) → nichts wird gelegt.
// Exit 0 = korrekt. Mit `FILTER=<Teilstring>` nur passende Fälle.
const L = require('../../lib/alice-brett.js');
const { H, ALICE, BIG, CRE, brett, zoneA, instIn, ohneStapel, gesamt, sicher, antworten } = L;
const FILTER = process.env.FILTER || '';
const PHASE = { MAIN1: 2, ACTION: 3 };

/** Alle Fälle: name, x (Stapelname), opts (für brett), lauf(t, seat) → Ergebnis, plus (zusätzliche Kreaturen in A, Standard 1), nurVoll (keine Variante gemischt), bats … */
const FAELLE = [];
const fall = (f) => FAELLE.push(f);

// ── 1 · die in W62a nur geladenen Karten ───────────────────────────────────────────────────────
fall({ name: 'Old Couple (Reaktion: Partner gleicher Stufe aus dem Deck)', x: 'Cute Bunny', plus: 1, freiZone: [0, 2],
  // Der Ausloeser (ZZ Dummy) belegt eine freie Zone von Held 0; danach bleibt nur die geteilte Zone (voll) bzw. noch eine freie (gemischt).
  zonen: (m) => m === 'gemischt' ? [['Cute Bunny', 'Cute Bunny'], [], []] : [['Cute Bunny', 'Cute Bunny'], [], undefined],
  opts: { hand: ['Old Couple', H.INERT.creature], deck: ['Cute Bunny', CRE, CRE] },
  lauf: async (t, s) => { t.setAbilities(s, 0, [['Support Magic', 'Summoning Magic', 'Summoning Magic'], [], []]); t.policy.confirm = true; return t.play(s, H.INERT.creature, { hero: 0, slot: 1, noGrant: true }); } });


const FRAIL = H.INERT.frail;
/** Sitz `gegner` bekommt einen Held mit Destruction Magic 2 und Burning Finger (50 Schaden) auf der Hand. */
function gegnerAngriff(t, s) {
  const g = 1 - s;
  t.setAbilities(g, 0, [['Destruction Magic', 'Destruction Magic'], [], []]);
  t.addHand(g, 'Burning Finger');
}
/** Field Cannon des Gegners vernichtet eine Kreatur (Zerstoerungspfad: "defeated by an opponent's card or effect"). */
async function feldKanone(t, s, opfer) {
  const g = 1 - s;
  t.put(g, 0, 0, 'Field Cannon');
  return t.run(() => t.engine.actionDestroyCard({ name: 'Field Cannon', owner: g, controller: g }, opfer));
}
/** Eine Instanz des Stapels A (letzte) — die Kreatur, die stirbt. */
const stapelInst = (t, s, name, hi = 0, z = 0) => t.inst(c => c.zone === 'support' && c.owner === s && c.heroIdx === hi && c.zoneSlot === z && c.name === name).slice(-1)[0];

fall({ name: 'Elixir of Immortality (Kreatur kehrt in ihren Platz zurueck, der Stapel bleibt ihr Platz)', x: FRAIL, plus: 0,
  opts: { hand: ['Elixir of Immortality'], gold: 100 },
  a: (m, v) => m === 'gegenprobe' ? v - 1 : v,
  lauf: async (t, s) => {
    await t.play(s, 'Elixir of Immortality', { noGrant: true });
    gegnerAngriff(t, s);
    t.targetFn = (valid) => { const v = valid.find(q => q.type === 'equip' && q.owner === s && q.heroIdx === 0 && q.slotIdx === 0) || valid[0]; return [v.id]; };
    const r = await t.play(1 - s, 'Burning Finger', { hero: 0 });
    await t.endTurn();
    return r;
  } });

fall({ name: 'Zombified Assault (Reaktion: Kreatur aus dem Stapel wiederbeleben)', x: FRAIL, plus: 0,
  opts: { hand: ['Zombified Assault'] },
  a: (m, v) => m === 'gegenprobe' ? v - 1 : v,
  lauf: async (t, s) => {
    t.setAbilities(s, 0, [['Decay Magic', 'Decay Magic'], [], []]);
    gegnerAngriff(t, s);
    const opfer = stapelInst(t, s, FRAIL);
    t.targetFn = (valid) => { const v = valid.find(q => q.type === 'equip' && q.owner === s && q.heroIdx === 0 && q.slotIdx === 0) || valid[0]; return [v.id]; };
    t.policy.confirm = true;
    return t.play(1 - s, 'Burning Finger', { hero: 0 });
  } });

for (const [karte, bedingung] of [['Doomed Town Guard', 'Doomed Town Guard'], ['Explosive Drone', 'Explosive Drone'], ['Enhanced Guard Dog', 'Enhanced Guard Dog']]) {
  fall({ name: `${karte} (Reaktion aus der Hand: Zusatzaktion-Beschwoerung neben ein gleichnamiges)`, x: karte, plus: 1,
    // Das Opfer steht im Stapel eines ANDEREN Helden (Held 2, Zone 0: 2x BIG) — beim Tod EINER BIG bleibt die Zone belegt, es wird keine Zone frei.
    zonen: (m) => m === 'gemischt' ? [[karte, karte], []] : [[karte, karte]],
    opts: { hand: [karte], extra: [[2, 0, [BIG, BIG]]] },
    lauf: async (t, s) => {
      t.setAbilities(s, 0, [['Summoning Magic', 'Summoning Magic'], [], []]);
      t.policy.confirm = true;
      const opfer = t.inst(c => c.zone === 'support' && c.owner === s && c.heroIdx === 2 && c.zoneSlot === 0).slice(-1)[0];
      return feldKanone(t, s, opfer);
    } });
}

fall({ name: 'Green Dragoneer (aus der Hand in die Zone der gefallenen Drago-Creature)', x: 'Green Dragoneer', plus: 0,
  opts: { hand: ['Green Dragoneer'] },
  a: (m, v) => m === 'gegenprobe' ? v - 1 : v,
  lauf: async (t, s) => {
    t.setAbilities(s, 0, [['Summoning Magic', 'Summoning Magic', 'Destruction Magic'], ['Destruction Magic', 'Destruction Magic'], []]);
    t.policy.confirm = true;
    const opfer = stapelInst(t, s, 'Green Dragoneer');
    return feldKanone(t, s, opfer);
  } });

fall({ name: 'Golden Ladybug (Zusatzaktion beim Aktivieren einer Surprise)', x: 'Golden Ladybug', plus: 1,
  opts: { hand: ['Golden Ladybug'] },
  lauf: async (t, s) => {
    t.policy.confirm = true;
    return t.run(() => t.engine.runHooks('onSurpriseActivated', { surpriseCardName: 'Booby Trap', surpriseOwner: s, surpriseController: s, heroIdx: 0 }));
  } });

fall({ name: 'Ladder to the Sky (Deck-Suche in die Zone der Opfer-Kopie)', x: 'Cute Bunny', plus: 0,
  opts: { hand: ['Ladder to the Sky'], deck: ['Cute Bunny', CRE, CRE], gold: 100 },
  a: (m, v) => m === 'gegenprobe' ? v - 1 : v,
  lauf: async (t, s) => {
    t.targetFn = (valid) => { const v = valid.find(q => q.owner === s && q.heroIdx === 0 && q.slotIdx === 0) || valid[0]; return [v.id]; };
    t.script.push({ match: d => d.type === 'cardGalleryMulti' || d.type === 'sacrificePick' || /sacrifice/i.test(d.title || ''), answer: () => undefined });
    await t.play(s, 'Ladder to the Sky', { noGrant: true });
    t.gs.turn += 2;
    return t.turnStart(s);
  } });



fall({ name: 'Arrival from the Cosmic Depths (zweite Kreatur auf die eigene Seite)', x: 'Gatherer from the Cosmic Depths', plus: 1,
  opts: { hand: ['Arrival from the Cosmic Depths'], deck: ['Analyzer from the Cosmic Depths', 'Gatherer from the Cosmic Depths', CRE, CRE] },
  lauf: async (t, s) => {
    t.setAbilities(s, 0, [['Summoning Magic', 'Summoning Magic', 'Summoning Magic'], [], []]);
    t.script.unshift({ match: d => d.type === 'cardGallery' && d.title === 'Arrival from the Cosmic Depths' && d.cards.some(c => /Analyzer/.test(c.name)), answer: (d) => ({ cardName: 'Analyzer from the Cosmic Depths', source: 'deck' }) });
    return t.play(s, 'Arrival from the Cosmic Depths', { hero: 0, noGrant: true });
  } });

fall({ name: 'Kasperov [W] (Pawn of Kings aus der Hand als Zusatzaktion)', x: 'Pawn of Kings [W]', plus: 0, held0: 'Kasperov, the King of Kings [W]',
  opts: { hand: ['Pawn of Kings [W]'], held0: 'Kasperov, the King of Kings [W]' },
  a: (m, v) => m === 'gegenprobe' ? v - 1 : v,
  lauf: async (t, s) => {
    t.policy.confirm = true;
    const opfer = stapelInst(t, s, 'Pawn of Kings [W]');
    return feldKanone(t, s, opfer);
  } });

fall({ name: "Bishop of Kings [W] (gefundener Pawn wird platziert)", x: 'Pawn of Kings [W]', plus: 1,
  zonen: (m) => m === 'gemischt' ? [['Pawn of Kings [W]', 'Pawn of Kings [W]'], [], ['Bishop of Kings [W]']] : [['Pawn of Kings [W]', 'Pawn of Kings [W]'], undefined, ['Bishop of Kings [W]']],
  opts: { deck: ['Pawn of Kings [W]', CRE, CRE] },
  vor: (t, s) => { t.putArea(s, 'Board of Kings'); },
  lauf: async (t, s) => { t.policy.confirm = true; t.gs.activePlayer = s; t.gs.turn += 2; return t.turnStart(s); } });



// ── 2 · Wege mit eigener Zonenschleife (bei der systematischen Suche gefunden) ─────────────────────────────────
fall({ name: 'Glorious Rebirth (Coolness-Stack-Kreatur in eine Zone des Nutzers)', x: 'Cute Bunny', plus: 1,
  opts: { hand: ['Glorious Rebirth'] },
  lauf: async (t, s) => { t.gs.players[s].coolnessStack = ['Cute Bunny']; t.engine._trackCard('Cute Bunny', s, 'coolnessStack'); return t.play(s, 'Glorious Rebirth', { hero: 0 }); } });

fall({ name: 'Living Illusion (Deck-Kreatur in eine Zone des Nutzers)', x: 'Cute Bunny', plus: 1, ohneFreiPruefung: true,   // der Pollution Token (Stufe 0 + 1) belegt die freie Zone
  opts: { hand: ['Living Illusion'], deck: ['Cute Bunny', CRE, CRE] },
  lauf: async (t, s) => t.play(s, 'Living Illusion', { hero: 0 }) });

fall({ name: 'Teal Fishing Rod (Level-0-Kreatur aus der Ablage)', x: 'Cute Bunny', plus: 1,
  opts: { hand: ['Teal Fishing Rod'], discard: ['Cute Bunny'], gold: 50 },
  lauf: async (t, s) => t.play(s, 'Teal Fishing Rod', {}) });

fall({ name: "The Master's Key (Level-3-Kreatur aus der Hand)", x: '3-Headed Giant', plus: 1,
  opts: { hand: ["The Master's Key", '3-Headed Giant'], gold: 100 },
  lauf: async (t, s) => t.play(s, "The Master's Key", {}) });

fall({ name: 'The Root of all Evil (Kreatur aus der Ablage)', x: 'Cute Bunny', plus: 1,
  opts: { discard: ['Cute Bunny'], eigene: [['The Root of all Evil', 0, 2]] },
  lauf: async (t, s) => { t.phase(PHASE.MAIN1); return t.activateCreature(s, 0, 2); } });

fall({ name: 'Thep (Soul Shard aus der Ablage in ihre Zonen)', x: 'Soul Shard Ka', plus: 1, held0: 'Thep, the Court Scribe',
  opts: { held0: 'Thep, the Court Scribe', discard: ['Soul Shard Ka'], deck: [H.INERT.filler, H.INERT.filler, H.INERT.filler] },   // Ka sucht beim Auftritt im Deck — keine Kreatur dort
  lauf: async (t, s) => { t.setAbilities(s, 0, [['Summoning Magic'], [], []]); return t.activateHero(s, 0); } });

fall({ name: 'Stellan (Level-0-Kreatur aus der Hand beim Schaden)', x: 'Cute Bunny', plus: 1, held0: 'Stellan, the Calm Cat',
  opts: { held0: 'Stellan, the Calm Cat', hand: ['Cute Bunny'] },
  lauf: async (t, s) => {
    gegnerAngriff(t, s);
    t.targetFn = (valid) => { const v = valid.find(q => q.type === 'hero' && q.owner === s && q.heroIdx === 0) || valid[0]; return [v.id]; };
    return t.play(1 - s, 'Burning Finger', { hero: 0 });
  } });

fall({ name: 'Sentient Bomb Golems (Nachlegen am Zugende neben das Golem)', x: 'Sentient Bomb Golems', plus: 1,
  zonen: (m) => m === 'gemischt' ? [['Sentient Bomb Golems'], []] : [['Sentient Bomb Golems']],
  opts: { hand: ['Sentient Bomb Golems'] },
  lauf: async (t, s) => { t.policy.confirm = true; return t.endTurn(); } });

fall({ name: 'Mausoleum Worm (aus der Ablage in die Zone des gefallenen Helden)', x: 'Mausoleum Worm', plus: 1, held0: 'Tushu, the Knowledge Keeper',
  opts: { discard: ['Mausoleum Worm'] },
  lauf: async (t, s) => {
    t.hero(s, 0).hp = 30;
    gegnerAngriff(t, s);
    t.policy.confirm = true;
    t.targetFn = (valid) => { const v = valid.find(q => q.type === 'hero' && q.owner === s && q.heroIdx === 0) || valid[0]; return [v.id]; };
    return t.play(1 - s, 'Burning Finger', { hero: 0 });
  } });


// ── 3 · Kreatureneffekte mit "summon … with the corresponding Hero" ─────────────────────────────────
fall({ freiZone: [0, 2], zonen: (m) => m === 'gemischt' ? [['Elven Archer','Elven Archer'], [], []] : [['Elven Archer','Elven Archer'], [], undefined], name: 'Elven Druid (Elven aus dem Deck zum Helden des Druiden)', x: 'Elven Archer', plus: 1,
  opts: { deck: ['Elven Archer', CRE, CRE], eigene: [['Elven Druid', 0, 1]] },
  vor: async (t, s) => { t.setAbilities(s, 0, [['Summoning Magic', 'Summoning Magic'], [], []]); },
  lauf: async (t, s) => { t.policy.confirm = true; t.phase(2); return t.activateCreature(s, 0, 1); } });
fall({ freiZone: [0, 2], zonen: (m) => m === 'gemischt' ? [['Cute Bunny','Cute Bunny'], [], []] : [['Cute Bunny','Cute Bunny'], [], undefined], name: 'Psychic Scout (Level-0-Kreatur aus der Hand zum Helden des Scouts)', x: 'Cute Bunny', plus: 1,
  opts: { hand: ['Cute Bunny'], eigene: [['Psychic Scout', 0, 1]] },
  vor: async (t, s) => { t.setAbilities(s, 0, [['Summoning Magic', 'Summoning Magic'], [], []]); },
  lauf: async (t, s) => { t.policy.confirm = true; t.phase(2); return t.activateCreature(s, 0, 1); } });

// ── 4 · Uebernahmen: die fremde Kreatur kommt in die Zone der gleichnamigen eigenen ───────────────────
/** Gegner-Kreatur `name` auf der Seite des Gegners (Held 0 / Slot 0) und ein Zielauswahl-Skript, das genau sie waehlt. */
function beute(name) {
  return {
    vor: async (t, s) => { const i = t.put(1 - s, 0, 0, name); i.turnPlayed = 1; t.targetFn = (valid) => { const v = valid.find(q => q.type === 'equip' && q.owner === 1 - s && q.heroIdx === 0 && q.slotIdx === 0) || valid.find(q => q.owner === 1 - s) || valid[0]; return [v.id]; }; },
  };
}
fall({ name: 'Capture (Level-1-Kreatur des Gegners in die Zone der gleichnamigen)', x: 'Cute Bunny', plus: 1, ...beute('Cute Bunny'),
  opts: { hand: ['Capture'] },
  lauf: async (t, s) => { t.setAbilities(s, 0, [['Fighting', 'Fighting'], [], []]); return t.play(s, 'Capture', { hero: 0 }); } });
fall({ name: 'Dark Gear (Kreatur des Gegners in die Zone der gleichnamigen)', x: 'Cute Bunny', plus: 1, ...beute('Cute Bunny'),
  opts: { hand: ['Dark Gear'], gold: 200 },
  lauf: async (t, s) => { t.policy.confirm = true; return t.play(s, 'Dark Gear', { hero: 0 }); } });

(async () => {
  const R = H.runner();
  const sel = FAELLE.filter(f => !FILTER || f.name.includes(FILTER));
  for (const seat of [0, 1]) {
    for (const f of sel) {
      for (const modus of ['voll', 'gemischt', 'gegenprobe']) {
        if (modus === 'gemischt' && f.nurVoll) continue;
        R.section(`Sitz ${seat}: ${f.name} — ${modus}`);
        const gemischt = modus === 'gemischt';
        const opts = { ...f.opts, fuellen: true, alice: modus !== 'gegenprobe' };
        if (f.zonen) opts.zonen = f.zonen(modus);
        else opts.zonen = gemischt ? [[f.x, f.x], []] : [[f.x, f.x]];
        const t = await brett(seat, opts);
        if (f.vor) await f.vor(t, seat);
        antworten(t, f.x, { anzahl: f.anzahl });
        const vorher = gesamt(t, seat), vorherA = zoneA(t, seat).length;
        const r = await f.lauf(t, seat);
        const nachA = zoneA(t, seat).length;
        const fz = f.freiZone || [0, 1];
        const nachB = zoneA(t, seat, fz[0], fz[1]).length;
        const plus = f.plus ?? 1;
        const soll = f.a ? f.a(modus, vorherA) : (modus === 'gegenprobe' ? vorherA : vorherA + plus);
        if (modus === 'gegenprobe') {
          R.check(`ohne Alice: Stapel A endet bei ${soll} (kein Zuwachs durch Teilung)`, nachA === soll, { r: sicher(r), nachA, soll });
        } else {
          R.check(`Stapel A endet bei ${soll} (vorher ${vorherA})`, nachA === soll && instIn(t, seat, 0, 0, f.x) === nachA, { r: sicher(r), nachA, soll, prompts: t.prompts.map(p => p.d.type + ':' + (p.d.title || '')) });
          if (gemischt && !f.ohneFreiPruefung) R.check(`die freie Zone (Held ${fz[0]}, Slot ${fz[1] + 1}) bleibt leer (geteilte Zone zuerst)`, nachB === 0, { b: zoneA(t, seat, fz[0], fz[1]) });
        }
        R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
        R.check('Zustand sauber (bis auf die Alice-Stapel)', ohneStapel(t).length === 0, ohneStapel(t));
      }
    }
  }
  R.finish();
})().catch(e => { process.stdout.write('ABSTURZ ' + (e && e.stack) + '\n'); process.exit(1); });
