'use strict';
// N4-archetypen-14 · Sandy Blob feuert für On-Summon-Effekte, die abgelehnt/abgebrochen wurden oder unter Such-Sperre nichts tun (Cloudy Slime, Shadowy Slime, Deepsea Witch, Sparkfly Architect)
// Ruling (CARD_API.md Z. 20472, Welle 11 R4, Al: „Nein, die sollen auch nicht auslösen. Nur ein wirklich feuernder Effekt löst Sandy Blob aus!"): „Ein abgelehntes ‚you may‘ und ein leeres
//   Suchen/Wählen (… Wahl abgebrochen) sind kein feuernder On-Summon-Effekt: `engine.summonEffektFizzelt(…, { stumm: true })` an jedem solchen Ausstieg. Neue On-Summon-Effekte mit ‚you may‘/Suche/Wahl
//   stempeln an jedem Ausstieg ohne Wirkung."
// Kartentext Cloudy Slime: „When you summon this Creature, you may immediately place a level 0 Creature from your hand …"; Shadowy Slime: „… you may choose a level 0 Creature from your discard pile …";
//   Deepsea Witch / Sparkfly Architect: „… you may search your deck for …".
// Erwartung: Sandy Blob (Sitz 0) bietet seinen Schlag nur für Effekte an, die wirklich gefeuert haben. Hier: Angebot abgelehnt / Galerie abgebrochen / Zonenwahl abgebrochen / Such-Sperre → KEIN Blob-Angebot.
// Beobachtet: cloudy-slime.js (`if (!confirmed) return;`, `if (!selected) return;`, `if (!gewaehlt) continue;`), shadowy-slime.js (gleiche Ausstiege), deepsea-witch.js und sparkfly-architect.js (Such-Sperre:
//   `return` ohne `summonEffektFizzelt`) stempeln nicht → Sandy Blob feuert. (Die Ausstiege „kein Kandidat / kein freier Platz" sind bereits gestempelt, Repro A05/10.)
// Gegenprobe: Cloudy Slime platziert wirklich → 2 Blob-Angebote (Cloudy selbst + die platzierte Fiery Slime).
const H = require('../../lib/h.js');
async function lauf(s) {
  const t = await H.fresh({ hand: [[s.karte, ...(s.hand || [])], ['ZZ Filler']], deckSize: 30 });
  t.setAbilities(0, 0, [['Summoning Magic', 'Summoning Magic', 'Summoning Magic'], [], []]);
  t.setAbilities(0, 1, [['Summoning Magic'], [], []]);
  const blob = t.put(0, 1, 0, 'Sandy Blob'); blob.turnPlayed = 1;
  t.put(1, 0, 0, H.INERT.big);
  if (s.discard) t.setDiscard(0, s.discard);
  if (s.deck) t.setDeck(0, s.deck.concat(Array(10).fill('ZZ Filler')));
  if (s.sperre === 'search') t.gs.players[0].searchLocked = true;
  t.targetFn = (valid) => [valid.find(v => v.owner === 1)?.id || valid[0].id];
  t.script.push({ match: d => d.type === 'confirm' && /Cloudy|Shadowy|Witch|Architect/.test(d.title || ''), answer: () => s.antwort === 'nein' ? null : ({ confirmed: true }) });
  t.script.push({ match: d => d.type === 'cardGallery' && /Cloudy|Shadowy|Witch|Architect/.test(d.title || ''), answer: (d) => s.antwort === 'galerie-abbruch' ? null : ({ cardName: d.cards[0].name }) });
  t.script.push({ match: d => d.type === 'zonePick' && /Cloudy|Shadowy/.test(d.title || ''), answer: (d) => s.antwort === 'zone-abbruch' ? null : ({ heroIdx: d.zones[0].heroIdx, slotIdx: d.zones[0].slotIdx, owner: d.zones[0].owner }) });
  await t.play(0, s.karte, { hero: 0, slot: 0 });
  return { t, blob: t.targets.filter(x => x.config && x.config.title === 'Sandy Blob').length };
}
(async () => {
  const R = H.runner();
  const k = await lauf({ karte: 'Cloudy Slime', hand: ['Fiery Slime'], antwort: 'ja' });
  R.check('Gegenprobe: Cloudy platziert wirklich → 2 Blob-Angebote', k.blob === 2, k.blob);
  const faelle = [
    { name: 'Cloudy Slime: „you may“ abgelehnt', karte: 'Cloudy Slime', hand: ['Fiery Slime'], antwort: 'nein' },
    { name: 'Cloudy Slime: Kartenwahl abgebrochen', karte: 'Cloudy Slime', hand: ['Fiery Slime'], antwort: 'galerie-abbruch' },
    { name: 'Cloudy Slime: Zonenwahl abgebrochen', karte: 'Cloudy Slime', hand: ['Fiery Slime'], antwort: 'zone-abbruch' },
    { name: 'Shadowy Slime: „you may“ abgelehnt', karte: 'Shadowy Slime', discard: ['Fiery Slime'], antwort: 'nein' },
    { name: 'Shadowy Slime: Kartenwahl abgebrochen', karte: 'Shadowy Slime', discard: ['Fiery Slime'], antwort: 'galerie-abbruch' },
    { name: 'Deepsea Witch unter Such-Sperre', karte: 'Deepsea Witch', deck: ['Deepsea Zombie'], sperre: 'search' },
    { name: 'Sparkfly Architect unter Such-Sperre', karte: 'Sparkfly Architect', deck: ['Sparkfly Worker'], sperre: 'search' },
  ];
  for (const f of faelle) {
    const r = await lauf(f);
    R.check(`${f.name}: kein Sandy-Blob-Angebot`, r.blob === 0, r.blob);
  }
  R.finish();
})();
