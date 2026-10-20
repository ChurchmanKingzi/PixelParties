'use strict';
// N1-10 · Curse: „afflicted by at least 1 status effect" zählt den Status der Null Zone (`nulled`) nicht – die Zusatzaktion bleibt aus
// Kartentext Curse: „If the target is afflicted by at least 1 status effect and does not have a Spell attached to it, this counts as an additional Action."
// Kartentext Null Zone: „… Heroes cannot use any Spells. This counts as a status effect."  (Status `nulled`, negativ, aber `cleansable: false`)
// Skript (`curse.js` `_heroQualifiesForCurse`): prüft `getCleansableStatuses()` (nur heilbare Status) statt „irgendein negativer Status". `nulled` und `soul_transmitted` fallen heraus.
// Aufbau: Sitz 0 spielt Curse in der Main Phase 1 (dort nur als inhärente Zusatzaktion spielbar) auf Held 1:0 mit Status X.
// Erwartet: X = frozen (Gegenprobe) und X = nulled („counts as a status effect") → spielbar, Curse liegt an; X = keiner → nicht spielbar (Karte bleibt auf der Hand).
// Beobachtet: nulled → abgelehnt, Karte bleibt auf der Hand.
const H = require('../../lib/h.js');
const heroPick = (s, h) => (valid) => { const v = valid.find(x => x.type === 'hero' && x.owner === s && x.heroIdx === h); return v ? [v.id] : undefined; };
(async () => {
  const R = H.runner();
  for (const [status, soll] of [['frozen', true], ['nulled', true], ['none', false]]) {
    const t = await H.fresh({ hand: [['Curse'], []] });
    if (status !== 'none') t.heroStatus(1, 0, status);
    t.targetFn = heroPick(1, 0);
    const r = await t.play(0, 'Curse', { hero: 0, phase: 2 });
    const liegtAn = !!t.hero(1, 0).statuses.cursed;
    R.check(`Status ${status}: Curse in der Main Phase ${soll ? 'spielbar (Zusatzaktion)' : 'nicht spielbar'}`, liegtAn === soll, { r, hand: t.pile(0, 'hand'), cursed: liegtAn });
    R.check(`Status ${status}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
  }
  R.finish();
})();
