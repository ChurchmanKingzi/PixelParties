'use strict';
// Titel-Liste (data/titles.json) neu erzeugen: die Titel aller Helden + eine handverlesene Liste thematischer Titel.
//
//   node scripts/titles/build.js
//
// Hero-Titel entstehen durch die UMGEKEHRTE Namensregel von heroDisplayName (public/app-shared.jsx), die den Namen vom Titel trennt:
//   1. "[Name], [Titel]"    → Titel = Rest NACH dem Komma ("the Nature Fairy")            (dahinter)
//   2. "[Name] the [Titel]" → Titel = ab "the" ("the Traveler")                            (dahinter)
//   3. "[Titel] [Name]"     → Titel = alles außer dem letzten Wort ("Bomb Berserker")      (davor)
//   Ausnahmen wie bei heroDisplayName: Wortspiel-Eigennamen ohne Titel; bei Crestina zählt nur der Teil nach dem Komma.
// Deutsch genauso aus data/i18n/de-cards.json (Komma → Rest dahinter; " der/die/das " → ab dort dahinter; sonst alles außer dem letzten Wort davor).
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', '..');
const cards = JSON.parse(fs.readFileSync(path.join(root, 'data', 'cards.json'), 'utf8'));
const de = JSON.parse(fs.readFileSync(path.join(root, 'data', 'i18n', 'de-cards.json'), 'utf8'));

const NO_TITLE = new Set(['Mary Crestmas', 'Saint Nicolas', 'Santa Klaus']);   // HERO_NAME_OVERRIDES: der ganze Name ist der Eigenname

function splitEn(full) {
  const n = full.trim();
  if (NO_TITLE.has(n)) return null;
  const comma = n.indexOf(',');
  if (comma > 0) return { t: n.slice(comma + 1).trim(), pos: 'after' };
  const the = n.match(/^(.+?)\s+(the\s+.+)$/i);
  if (the) return { t: the[2].trim(), pos: 'after' };
  const parts = n.split(/\s+/);
  return parts.length > 1 ? { t: parts.slice(0, -1).join(' '), pos: 'before' } : null;
}
function splitDe(full) {
  const n = String(full || '').trim();
  if (!n) return null;
  const comma = n.indexOf(',');
  if (comma > 0) return { t: n.slice(comma + 1).trim(), pos: 'after' };
  const art = n.match(/^(.+?)\s+((?:der|die|das)\s+.+)$/i);
  if (art) return { t: art[2].trim(), pos: 'after' };
  const parts = n.split(/\s+/);
  return parts.length > 1 ? { t: parts.slice(0, -1).join(' '), pos: 'before' } : null;
}
const slug = (s) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// Thematische Titel (Lore und Spielmechanik)
const THEMED = [
  ["Antonia's Apprentice", 'after', 'Antonias Lehrling', 'after'],
  ['Control Menace', 'after', 'Kontroll-Schreck', 'after'],
  ['Final Boss of Aggro', 'after', 'Endboss der Aggro-Decks', 'after'],
  ['Creature Spammer Extraordinaire', 'after', 'Kreaturen-Spammer par excellence', 'after'],
  ['Combo Connoisseur', 'after', 'Kombo-Kenner', 'after'],
  ['Spell Slinger', 'before', 'Zauberschleuderer', 'before'],
  ['Potion Hoarder', 'before', 'Trank-Hamsterer', 'before'],
  ['Artifact Hoarder', 'before', 'Artefakt-Hamsterer', 'before'],
  ['Master of Surprises', 'after', 'Meister der Überraschungen', 'after'],
  ['Smug Coin Tycoon', 'before', 'Smug-Coin-Tycoon', 'before'],
  ['Bulk Baron', 'before', 'Ramschbaron', 'before'],
  ['Dart Master', 'before', 'Dartmeister', 'before'],
  ['Wheel Whisperer', 'before', 'Glücksrad-Flüsterer', 'before'],
  ['Umbra Hunter', 'before', 'Umbra-Jäger', 'before'],
  ['Mulligan Survivor', 'after', 'Mulligan-Überlebender', 'after'],
  ["Monia's Biggest Fan", 'after', 'Monias größter Fan', 'after'],
  ["the Raccoon's Best Customer", 'after', 'bester Kunde des Waschbären', 'after'],
  ['the Ascended', 'after', 'der Aufgestiegene', 'after'],
  ['Hero Collector', 'before', 'Helden-Sammler', 'before'],
  ['Tutorial Graduate', 'after', 'Tutorial-Absolvent', 'after'],
  ['Sleeve Collector', 'before', 'Sleeve-Sammler', 'before'],
  ['Skin Collector', 'before', 'Skin-Sammler', 'before'],
  ['Deck Tinkerer', 'before', 'Deck-Tüftler', 'before'],
  ['Draw-Go Menace', 'after', 'Draw-Go-Schreck', 'after'],
  ['Board Wipe Enthusiast', 'after', 'Brett-Räumer aus Leidenschaft', 'after'],
  ['Unlucky Dart Thrower', 'after', 'unglücklicher Dartwerfer', 'after'],
];

const out = [], seen = new Set();
const push = (id, en, de) => { if (!id || seen.has(id)) return; seen.add(id); out.push({ id, en: { t: en.t, pos: en.pos }, de: { t: de.t, pos: de.pos } }); };
for (const [en, pe, dd, pd] of THEMED) push(slug(en), { t: en, pos: pe }, { t: dd, pos: pd });
for (const c of cards) {
  if (c.cardType !== 'Hero' && c.cardType !== 'Ascended Hero') continue;
  const e = splitEn(c.name); if (!e || !e.t) continue;
  const d = splitDe((de[c.name] || {}).name) || e;
  push(slug(e.t), e, d);
}
fs.writeFileSync(path.join(root, 'data', 'titles.json'), JSON.stringify({ titles: out }, null, 1) + '\n', 'utf8');
console.log(out.length + ' Titel (' + THEMED.length + ' thematische)');
