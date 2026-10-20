'use strict';
// N3-07 · Elusive Hind: ihr Kontrolleur kann sein eigenes Tributopfer (Foresta) „negieren" – Foresta kommt trotzdem, die Hind überlebt (Gratis-Tribut gegen 2 Handkarten)
// Kartentext (Hind): „When this Creature would be affected by a card or effect, its controller may discard 2 cards to negate any effects that card or effect would have on it (including damage)."
// Kartentext (Foresta): „You can only summon this Creature by sacrificing 2 Creatures you control that were not summoned this turn …"
// Konvention: Die Engine meldet Tribut-/Opferzerstörungen an die Schutz-Hooks mit `ctx.isSacrifice` (CARD_API „Tribut", `actionDestroyCard` → BEFORE_CREATURE_AFFECTED `isSacrifice`);
//   Schutzkarten, die sich nicht gegen EIGENE Opferkosten richten, steigen dort aus (z. B. Cool Rescuer Monia: `if (ctx.isSacrifice) return;`). Die Hind tut das nicht.
// Aufbau: Sitz 0 spielt die Hind (liegt dann bei Sitz 1, Kontrolle Sitz 1, Besitzer Sitz 0). Sitz 1 hat Foresta auf der Hand und opfert Hind + ein ZZ Dummy.
//   Auf die Hind-Frage („Discard 2 cards to negate?") antwortet Sitz 1 mit Ja (wirft 2 Karten ab).
// Erwartet: entweder kein Hind-Angebot für das eigene Opfer (Hind stirbt, Foresta zahlt zwei Opfer) – oder, wenn man es negieren darf, ist das Tributopfer NICHT erbracht und Foresta kommt nicht.
// Beobachtet: Foresta liegt auf dem Brett, die Hind lebt weiter; nur EIN Tribut (der Dummy) wurde wirklich geopfert, die Hind-Negation zählte als bezahltes Opfer.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const F = 'Foresta, the Guard';
  async function lauf(antwortJa) {
    const t = await H.fresh({ hand: [['Elusive Hind'], [F, 'ZZ Dummy', 'ZZ Dummy', 'ZZ Dummy']] });
    await t.play(0, 'Elusive Hind', { hero: 0 });
    const hind = t.find('Elusive Hind', 'support'); hind.turnPlayed = 1;
    const ph = hind.heroIdx;
    t.put(1, ph, (hind.zoneSlot + 1) % 3, H.INERT.creature).turnPlayed = 1;
    t.script.push({
      match: d => d.type === 'forceDiscard' && d.title === 'Elusive Hind',
      answer: (d) => { if (!antwortJa) return null; const idx = (d.eligibleIndices && d.eligibleIndices[0]) ?? 0; return { handIndex: idx, cardName: t.pile(1, 'hand')[idx] }; },
    });
    t.reset();
    t.gs.activePlayer = 1;
    const r = await t.play(1, F, { hero: ph });
    const dummiesAufBrett = t.inst(c => c.zone === 'support' && c.name === H.INERT.creature).length;
    return { r, forestaDa: !!t.find(F, 'support'), hindLebt: !!t.find('Elusive Hind', 'support'), dummyGeopfert: dummiesAufBrett === 0, handSitz1: t.pile(1, 'hand'), ablage1: t.pile(1, 'discardPile'), ablage0: t.pile(0, 'discardPile'), errors: t.errors };
  }
  const nein = await lauf(false);
  R.check('Gegenprobe (Hind-Angebot abgelehnt): Foresta kommt, Hind UND Dummy sind geopfert', nein.forestaDa && !nein.hindLebt && nein.dummyGeopfert, nein);
  R.check('Gegenprobe: die geopferte Hind liegt in der Ablage ihres Besitzers (Sitz 0)', nein.ablage0.includes('Elusive Hind'), nein);
  const ja = await lauf(true);
  R.check('Hind-Negation angenommen: Foresta darf nur kommen, wenn auch die Hind wirklich geopfert wurde', !ja.forestaDa || !ja.hindLebt, ja);
  R.check('keine Engine-Fehler', nein.errors.length + ja.errors.length === 0);
  R.finish();
})();
