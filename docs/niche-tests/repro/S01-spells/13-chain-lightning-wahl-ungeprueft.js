'use strict';
// S01-13 · Chain Lightning: die Kettenwahl des Gegners wird serverseitig nicht geprüft (Heldenpflicht, Anzahl, Duplikate)
// Kartentext: „Your opponent has to choose 3 targets they control consecutively (or as many targets as possible). The first chosen target takes 200 damage, the second 150 and the third 100.
//   Your opponent always has to choose their undefeated Heroes first."
// Der Gegner (= das Opfer) wählt. `engine.promptChainTargets` (_engine.js ~Z. 10562) gibt die Antwort des Clients ungeprüft zurück (`result.selectedTargets` → Treffer nach Id);
//   `heroesFirst` ist nur ein Hinweis an die Oberfläche. Im Normalfall (CPU-Antwort, Standard-Client) ist alles in Ordnung (Kontrolle a).
// Aufbau: Gegner hat 3 lebende Helden und 3 Kreaturen (200 HP). Antworten (per Skript wie ein veränderter Client): (b) nur die 3 Kreaturen, (c) dasselbe Ziel dreimal, (e) nur 1 Ziel.
// Erwartet: nach Regel treffen 200/150/100 die drei Helden (die Wahl wird korrigiert bzw. abgelehnt).
// Beobachtet: (b) die Helden bleiben unverletzt, die Kreaturen nehmen den Schaden; (c) ein Held nimmt 450; (e) nur ein Treffer (200).
const H = require('../../lib/h.js');
async function lauf(auswahl) {
  const t = await H.fresh({ hand: [['Chain Lightning'], []] });
  t.put(1, 0, 0, H.INERT.creature); t.put(1, 0, 1, H.INERT.creature); t.put(1, 1, 0, H.INERT.creature);
  t.script.push({ match: d => d.type === 'chainTargetPick', answer: (d) => ({ selectedTargets: auswahl(d.targets).map(id => ({ id })) }) });
  await t.play(0, 'Chain Lightning', { hero: 0 });
  return { t, hp: t.gs.players[1].heroes.map(h => h.hp) };
}
(async () => {
  const R = H.runner();
  const regel = [600, 650, 700];
  const a = await lauf((T) => T.filter(x => x.type === 'hero').map(x => x.id));
  R.check('(a) Kontrolle: drei Helden gewählt → 200/150/100', JSON.stringify(a.hp) === JSON.stringify(regel), a.hp);
  const b = await lauf((T) => T.filter(x => x.type === 'equip').map(x => x.id));
  R.check('(b) nur Kreaturen gewählt, obwohl Helden leben → Heldenpflicht gilt trotzdem', JSON.stringify(b.hp) === JSON.stringify(regel), b.hp);
  const c = await lauf((T) => { const h = T.find(x => x.type === 'hero').id; return [h, h, h]; });
  R.check('(c) dasselbe Ziel dreimal → höchstens ein Treffer je Ziel (kein 450-Schaden)', Math.min(...c.hp) >= 600, c.hp);
  const e = await lauf((T) => [T[0].id]);
  R.check('(e) nur 1 Ziel gewählt → „as many targets as possible" (drei Treffer)', JSON.stringify(e.hp) === JSON.stringify(regel), e.hp);
  R.check('keine Engine-Fehler', [a, b, c, e].every(x => x.t.errors.length === 0));
  R.finish();
})();
