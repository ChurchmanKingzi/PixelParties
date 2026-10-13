'use strict';
// M01-02 · Elixir of Immortality: ist der letzte Held nicht wiederbelebbar (Mirjam: „HP cannot be healed"), löst das Elixir nicht aus – hält aber die Niederlage trotzdem auf
// Kartentext: „The next time a target you control is defeated, delete this card and revive and heal that target's HP for half their maximum instead (rounded up)."
// Ruling v1466/v1467 (_revive-shared.js Kopf, _engine.js:6595 `_heroOwnHealBlock`): Immortality triggert für nicht heilbare / 0-max-HP-Helden NIE
//   (`elixir-of-immortality.js` onHeroKO: `if (!engine.canReviveHero(hero, { heilt: true })) return;`).
// Engine: `checkAllHeroesDead` (_engine.js:48356 ff.) wertet `preventsAllHeroesDeadLoss` des Elixirs STATISCH aus („solange das Permanent auf der Seite liegt, endet die Partie nicht").
// Aufbau: Sitz 0 hat nur den Helden Mirjam, the Fallen Cute Angel (100 HP) und das Elixir als Permanent; Sitz 1 tötet Mirjam (500 Schaden).
// Erwartet: Das Elixir kann nicht auslösen (Ruling) → alle Helden von Sitz 0 sind besiegt → Sitz 0 verliert (Sieger Sitz 1, Grund all_heroes_dead). Kontrolle ohne Elixir: Spiel endet.
// Beobachtet: Mirjam bleibt tot, das Elixir bleibt liegen, `onGameOver` wird nie gerufen – die Partie läuft mit einem Spieler ohne lebenden Helden weiter.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  R.section('Kontrolle: Mirjam stirbt ohne Elixir');
  {
    const t = await H.fresh({ heroes: [['Mirjam, the Fallen Cute Angel'], ['Atta, Speaker of Desires']], hp: 100 });
    await t.run(() => t.engine.actionDealDamage({ name: 'Test', owner: 1, heroIdx: 0 }, t.hero(0, 0), 500, 'spell'));
    R.check('ohne Elixir: Spiel endet, Sitz 1 gewinnt', t.engine.over.called && t.engine.over.winnerIdx === 1, t.engine.over);
  }
  R.section('Mit Elixir of Immortality auf der Seite des toten, nicht heilbaren Helden');
  {
    const t = await H.fresh({ heroes: [['Mirjam, the Fallen Cute Angel'], ['Atta, Speaker of Desires']], hand: [['Elixir of Immortality'], []], hp: 100 });
    await t.play(0, 'Elixir of Immortality');
    R.check('Vorbedingung: Elixir liegt als Permanent', t.gs.players[0].permanents.length === 1, t.gs.players[0].permanents);
    await t.run(() => t.engine.actionDealDamage({ name: 'Test', owner: 1, heroIdx: 0 }, t.hero(0, 0), 500, 'spell'));
    R.check('Mirjam ist tot (das Elixir konnte nicht wiederbeleben)', t.hero(0, 0).hp === 0, t.hero(0, 0).hp);
    R.check('Elixir hat nicht ausgelöst (liegt noch)', t.gs.players[0].permanents.length === 1, t.gs.players[0].permanents);
    R.check('Spiel endet: Sitz 0 hat keinen lebenden Helden, Sieger Sitz 1', t.engine.over.called && t.engine.over.winnerIdx === 1, t.engine.over);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})();
