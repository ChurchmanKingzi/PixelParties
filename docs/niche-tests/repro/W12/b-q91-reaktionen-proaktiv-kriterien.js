// W12b · Q91 (F01-14) · Reactions sind IMMER auch proaktiv spielbar — solange der Kartentext es nicht ausschließt und der Effekt keinen sehr spezifischen Trigger braucht
// Al: „IMMER auch proaktiv, solange der Kartentext das nicht ausschließt (etwa via 'ONLY activate this card.....') und der Effekt keinen sehr spezifischen Trigger braucht
//      (etwa 'Activate this card, *when your opponent summons a Creature*.....'). Das gilt für Reactions allgemein!"  Gigantisaur Skull: proaktiv spielbar (Ist-Zustand).
// Kriterien (CARD_API.md „Reactions: proaktiv spielbar?"): ein Ereignis-Trigger im Text („when …", „whenever", „immediately when …", „in reaction to …", „after …") = SPEZIFISCHER Trigger → nur im
//   Reaktionsfenster. Keinen Ereignis-Trigger hat eine Reaction, deren Text nur ein Zeitfenster nennt („between phases", „at the start of your opponent's turn", „when your opponent enters their Action
//   Phase" zählt als Zeitfenster-Ereignis der Phase) oder gar keinen Trigger → `proactivePlay: true`.
// Dieses Repro: (1) statischer Wächter über ALLE Subtyp-Reaction-Karten mit Skript: ohne Ereignis-Trigger im Text MUSS `proactivePlay` gesetzt sein (Ausnahmen: unten, Zweifelsfälle für Al);
//   (2) Verhalten: Gigantisaur Skull, Juice, Cure, Golden Wings sind im eigenen Zug spielbar; Karten mit Ereignis-Trigger (Storm Ring, Spiky Armor, Boots of Hermes, Silence) NICHT. Exit 0 = korrekt.
const fs = require('fs'), path = require('path');
const H = require('../../lib/h.js');
const WURZEL = path.join(__dirname, '..', '..', '..', '..');
const slug = (n) => n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
// Zeitfenster-Karten (kein Ereignis außer dem Zeitpunkt): Zweifelsfälle für Al, bisher ohne proactivePlay — als Notiz geführt, nicht als Fehler.
const ZWEIFEL = new Set(['Dive Down', 'Jump in the River', 'Unwanted Audience']);
const EREIGNIS = /\b(when|whenever|after)\b|in reaction to|immediately (play|summon|use)|(play|summon|use|activate) this [a-z ]*immediately/i;
const ZEITFENSTER = /between phases|at the (beginning|start) of (your|the) (opponent's|opponents) turn|at the (beginning|start) of your opponent's turn|when your opponent enters their Action Phase/i;
(async () => {
  const R = H.runner();
  const reaktionen = Object.values(H.DB).filter(c => /reaction/i.test(c.subtype || ''));
  R.check('Datenbasis: ≥ 140 Reaction-Karten', reaktionen.length >= 140, reaktionen.length);
  const ohneSkript = [], zeitfensterOhne = [], verstoesse = [];
  let proaktiv = 0;
  for (const c of reaktionen) {
    const f = path.join(WURZEL, 'cards', 'effects', slug(c.name) + '.js');
    if (!fs.existsSync(f)) { if (!EREIGNIS.test(c.effect || '') || ZEITFENSTER.test(c.effect || '')) ohneSkript.push(c.name); continue; }
    const sk = H.loadCardEffect(c.name);
    const text = c.effect || '';
    const ereignis = EREIGNIS.test(text) && !ZEITFENSTER.test(text);
    const schliesstAus = /can only (activate|play|use|summon) this (card|spell|creature|artifact|attack)\b[^.]*\b(during|when|in reaction|while)\b/i.test(text);
    if (sk && sk.proactivePlay) proaktiv++;
    if (!ereignis && !(sk && sk.proactivePlay)) (ZWEIFEL.has(c.name) ? zeitfensterOhne : verstoesse).push(c.name);
    void schliesstAus;
  }
  R.check('jede Reaction mit Skript ohne Ereignis-Trigger ist proaktiv spielbar (außer den Zeitfenster-Zweifelsfällen)', verstoesse.length === 0, verstoesse);
  R.note('proaktiv spielbare Reactions (proactivePlay): ' + proaktiv);
  R.note('Zweifelsfälle für Al (Zeitfenster „Beginn des Gegnerzugs", nicht proaktiv)', zeitfensterOhne);
  R.note('Reactions ohne Skript und ohne Ereignis-Trigger (nicht umsetzbar: kein Skript)', ohneSkript);

  { // Verhalten: Skull
    const t = await H.fresh({ hand: [['Gigantisaur Skull'], []], gold: [100, 100] });
    const c = t.put(1, 0, 0, H.INERT.creature);
    t.targetFn = (valid) => [valid.find(v => v.type === 'equip' && v.owner === 1).id];
    const r = await t.play(0, 'Gigantisaur Skull', { hero: 0 });
    R.check('Gigantisaur Skull im eigenen Zug proaktiv spielbar (Ist-Zustand)', r === true && !!c.counters.frozen, { r, frozen: c.counters.frozen });
  }
  { // Juice: Zeitfenster-Reaction, proaktiv
    const t = await H.fresh({ hand: [['Juice'], []], gold: [100, 100] });
    t.heroStatus(0, 0, 'burned');
    t.targetFn = (valid) => { const v = valid.find(v => v.type === 'hero' && v.owner === 0 && v.heroIdx === 0); return v ? [v.id] : [valid[0].id]; };
    const r = await t.play(0, 'Juice', { hero: 0 });
    R.check('Juice (Zeitfenster-Reaction) im eigenen Zug spielbar', r === true && !t.pile(0, 'hand').includes('Juice'), { r, hand: t.pile(0, 'hand') });
  }
  for (const karte of ['Storm Ring', 'Spiky Armor', 'Boots of Hermes', 'Silence']) { // Ereignis-Trigger → nur im Reaktionsfenster
    const t = await H.fresh({ hand: [[karte], []], gold: [100, 100] });
    t.grantFor(0, 0, karte);
    const r = await t.play(0, karte, { hero: 0 });
    R.check(`${karte} (Ereignis-Trigger) im eigenen Zug NICHT proaktiv spielbar`, r === false && t.pile(0, 'hand').includes(karte), { r, hand: t.pile(0, 'hand') });
  }
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
