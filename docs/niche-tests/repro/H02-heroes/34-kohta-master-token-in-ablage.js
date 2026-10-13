// H02-heroes-34 · Kohta, Master of Super-Killing: ein besiegter Token landet als Karte in der Ablage (statt gelöscht zu werden)
//
// Kartentext Kohta Master: „… choose any target on the board and defeat it."  Konvention (A05-02/A05-12/R01-02/M01-05, CARD_API „Tokens … überall verboten"): Tokens sind keine Karten – sie kommen nie in Hand/Deck/Ablage, ein besiegter Token liegt im Gelöscht-Stapel (so im Schadensweg: H02-15 Kontrolle).
// Das Skript besiegt Kreaturen über `engine.actionDestroyCard(quelle, opfer, …)` (kohta-master-of-super-killing.js, Z. ~222). `_actionMoveCardKern` (`_engine.js` ~13731) schiebt den „Kadaver" unbedingt auf `discardPile`.
// Aufbau: Kohta Master als Held 0 (Sitz 0), ein Mummy Token (bzw. Biomancy Token) auf Sitz 1; Heldeneffekt in der Action Phase, Zielwahl = der Token.
// Erwartung: Ablage von Sitz 1 enthält keinen Token, der Token liegt im Gelöscht-Stapel. Beobachtung: der Token liegt in der Ablage von Sitz 1 (Gelöscht-Stapel leer).
// Aufruf: node docs/niche-tests/repro/H02-heroes/34-kohta-master-token-in-ablage.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
const KM = 'Kohta, Master of Super-Killing';
(async () => {
  const R = H.runner();
  for (const tok of ['Mummy Token', 'Biomancy Token']) {
    const t = await H.fresh({ heroes: [[KM, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null] });
    t.put(1, 0, 0, tok);
    t.targetFn = (v) => [v.find(x => x.type === 'equip' && x.owner === 1).id];
    const r = await t.activateHero(0, 0, { effect: KM, phase: 3 });
    R.check(`${tok}: Super-Kill ausgeführt`, r === true && t.inst(c => c.zone === 'support').length === 0, { r });
    R.check(`${tok}: kein Token in der Ablage`, !t.pile(1, 'discardPile').includes(tok), { ablage: t.pile(1, 'discardPile'), geloescht: t.pile(1, 'deletedPile') });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})();
