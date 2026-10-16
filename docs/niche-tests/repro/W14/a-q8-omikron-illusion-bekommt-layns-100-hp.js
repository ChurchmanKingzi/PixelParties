'use strict';
// W14a · Rückfrage 8 (Welle 13 / W13b; H03-heroes-05 Omikron × H02-heroes-34 Layn, Defender of Deri) · Al, 16.10.2026: „Ja, kriegen sie" —
//   Omikrons Illusion bekommt Layns +100 HP (HP 1 plus 100; Folge von Q122: die Illusion löst fremde „Creature placed"-Trigger aus). Ist-Zustand, Absicherung.
// Layn: „Increase the current and max HP of any Creature you summon by 100." Die Illusion ist negiert (eigene Effekte stumm), die Layn-Wirkung ist Layns Passive.
// Erwartet: Layn (Held) + Omikron aktiviert → Illusion hat 101 aktuelle/maximale HP; ohne Layn bleibt es bei 1. Gegenprobe: Layn auf der GEGNERseite wirkt nicht.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const OM = 'Omikron, the Faceless Illusionist';
  const LAYN = 'Layn, Defender of Deri';
  async function lauf(heroes, layn) {
    const t = await H.fresh({ heroes: [heroes, layn ? [LAYN, H.BLANK_HEROES[1], H.BLANK_HEROES[2]] : null], hp: 400 });
    t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ cardName: 'Skeleton Healer' }) });
    t.targetFn = (valid) => [valid[0].id];
    const r = await t.activateHero(0, 1, { effect: OM });
    const ill = t.inst(x => x.zone === 'support' && x.owner === 0 && x.name === 'Skeleton Healer')[0];
    return { t, r, ill };
  }
  { const x = await lauf([LAYN, OM, H.BLANK_HEROES[2]]);
    R.check('Layn + Omikron: Illusion liegt auf dem Brett', x.r && x.ill, { r: x.r });
    R.check('Illusion hat 101 maximale HP (1 + 100)', x.ill && x.ill.counters.maxHp === 101, x.ill && x.ill.counters.maxHp);
    R.check('Illusion hat 101 aktuelle HP', x.ill && x.ill.counters.currentHp === 101, x.ill && x.ill.counters.currentHp);
    R.check('Illusion bleibt negiert (eigene Effekte stumm)', x.ill && !!x.ill.counters.negated, x.ill && x.ill.counters.negated);
    R.check('keine Engine-Fehler / Zustand sauber', x.t.errors.length === 0 && x.t.audit().length === 0, { e: x.t.errors, a: x.t.audit() }); }
  { const x = await lauf([H.BLANK_HEROES[0], OM, H.BLANK_HEROES[2]]);
    R.check('Kontrolle ohne Layn: Illusion hat 1 HP', x.ill && x.ill.counters.maxHp === 1 && x.ill.counters.currentHp === 1, x.ill && x.ill.counters); }
  { const x = await lauf([H.BLANK_HEROES[0], OM, H.BLANK_HEROES[2]], true);
    R.check('Gegenprobe: Layn beim GEGNER wirkt nicht (Illusion 1 HP)', x.ill && x.ill.counters.maxHp === 1 && x.ill.counters.currentHp === 1, x.ill && x.ill.counters); }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
