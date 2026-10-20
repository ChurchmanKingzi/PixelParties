'use strict';
// N3-14 · Spirit of the Super-Killing Knife: auch OPFER (Tribut) wandern in den Gelöscht-Stapel statt in die Ablage (Stufe C)
// Kartentext: „While this Creature remains on the board, any Hero or Creature that is defeated is deleted."
// Frage: Ist ein Tribut/Opfer „defeated"? Die Engine unterscheidet Opfern und Besiegen sonst durchgängig (Thuly/Temple of Sacrifice vs. Defeat-Trigger, Loyal Bone Dog: „gegen Zerstören ja, gegen Opfer nein",
//   Foresta-HP-Kosten „kein Opfer"); der Spirit hängt aber am Weg „Brett → Ablage" (`onCardLeaveZone` mit `toZone === 'discard'`) und löscht damit jede Kreatur, die in die Ablage geht.
// Aufbau: Foresta, the Guard wird mit zwei Dummies als Tribut beschworen; Sitz 0 hat Spirit + Messer auf dem Brett (Spirit steht mit turnPlayed = aktueller Zug, ist also selbst kein Tribut).
// Beobachtet: beide Tribut-Dummies liegen im Gelöscht-Stapel; ohne Spirit in der Ablage.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const KNIFE = 'Super-Killing Knife, the Tool of Liquidation';
  async function lauf(mitSpirit) {
    const t = await H.fresh({ hand: [['Foresta, the Guard'], []] });
    if (mitSpirit) { t.put(0, 0, 0, KNIFE); t.put(0, 0, 1, 'Spirit of the Super-Killing Knife').turnPlayed = 5; }   // Zug 5 = aktueller Zug: kein wählbares Tribut
    t.put(0, 1, 0, H.INERT.creature).turnPlayed = 1; t.put(0, 1, 1, H.INERT.creature).turnPlayed = 1;
    const r = await t.play(0, 'Foresta, the Guard', { hero: 1 });
    return { r, foresta: !!t.find('Foresta, the Guard', 'support'), ablage: t.pile(0, 'discardPile'), geloescht: t.pile(0, 'deletedPile'), errors: t.errors };
  }
  const o = await lauf(false);
  R.check('Gegenprobe: ohne Spirit gehen die zwei Tribut-Dummies in die Ablage', o.foresta && o.ablage.length === 2 && o.geloescht.length === 0, o);
  const m = await lauf(true);
  R.check('mit Spirit: Tribute (Opfer, nicht „defeated") bleiben in der Ablage', m.foresta && m.ablage.length === 2 && m.geloescht.length === 0, m);
  R.check('keine Engine-Fehler', o.errors.length + m.errors.length === 0);
  R.finish();
})();
