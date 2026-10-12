'use strict';
// ═══════════════════════════════════════════════════════════════════
//  ALLES, WAS NICHT WÄHLBAR IST, AUSGEGRAUT ANBIETEN
//  (Als Vorgabe 12.10., Disarm: „Wenn mich Disarm einen Hero wählen lässt, sollten alle Karten ausser eligible Heroes ausgegraut sein — sonst versuche ich
//   intuitiv erstmal, auf Equips zu klicken!")
//
//  Der Client graut nur Ziele aus, die mit `ineligible: true` in der Zielliste stehen (`validTargets`). Eine Karte, die nur ihre echten Ziele hereinreicht, lässt
//  den Rest des Bretts unberührt — wählbar sieht es zwar anders aus (Leuchten), aber nichts SAGT dem Spieler, dass ein Klick auf eine Ausrüstung nichts bringt.
//
//    ausgegrauteRestkarten(engine, ziele) → Array<Ziel>   (alle mit `ineligible: true`)
//
//  Liefert für jeden benannten HELDEN beider Seiten (`hero-<Seite>-<Idx>`) und jede Karte in den Support Zonen (`equip-<Seite>-<Idx>-<Slot>`; Ausrüstung,
//  Kreaturen, verdeckte Karten) einen ausgegrauten Eintrag — ausser dem, was `ziele` schon wählbar anbietet (gleiche Id ODER gleiche Karteninstanz). Die Ergebnisliste
//  wird einfach hinter die echten Ziele gehängt:
//
//      const alle = [...ziele, ...ausgegrauteRestkarten(engine, ziele)];
//      await engine.promptEffectTarget(pi, alle, { … });
//
//  Die Engine behandelt markierte Einträge überall gleich: der Client graut sie aus, die CPU wählt nur unter den unmarkierten, die Serverprüfung weist eine Antwort
//  mit einem markierten Ziel ab, und die Schutz-Verträge (Stealth, Dive Down, Alliance …) zählen sie nicht als Ausweichziele.
//  Nicht erfasst: Ability-, Surprise-, Area- und Permanent-Zonen — der Client zeigt dort keine ausgegraute Darstellung für Zielwahlen.
//  Die Kartennamen verdeckter Karten bleiben weg (der Eintrag geht nur an den Wählenden, aber er braucht den Namen nicht).
// ═══════════════════════════════════════════════════════════════════

function ausgegrauteRestkarten(engine, ziele = []) {
  const gs = engine.gs;
  const ids = new Set();
  const instanzen = new Set();
  for (const z of ziele) {
    if (!z) continue;
    if (z.id != null) ids.add(z.id);
    const inst = z.cardInstance || z._cardInstance;
    if (inst) instanzen.add(inst);
  }
  const out = [];

  // Helden beider Seiten
  for (let seite = 0; seite < (gs.players || []).length; seite++) {
    const heroes = gs.players[seite]?.heroes || [];
    for (let hi = 0; hi < heroes.length; hi++) {
      const hero = heroes[hi];
      if (!hero?.name) continue;
      const id = `hero-${seite}-${hi}`;
      if (ids.has(id)) continue;
      out.push({ id, type: 'hero', owner: seite, heroIdx: hi, cardName: hero.name, ineligible: true });
    }
  }

  // Karten in den Support Zonen (Ausrüstung, Kreaturen, verdeckte Karten)
  for (const inst of (engine.cardInstances || [])) {
    if (!inst || inst.zone !== 'support' || inst.heroIdx < 0 || inst.zoneSlot < 0) continue;
    if (instanzen.has(inst)) continue;
    const seite = engine.physicalSide(inst);
    const id = `equip-${seite}-${inst.heroIdx}-${inst.zoneSlot}`;
    if (ids.has(id)) continue;
    ids.add(id);                                   // je Platz ein Eintrag (gestapelte Instanzen)
    out.push({
      id, type: 'equip', owner: seite, heroIdx: inst.heroIdx, slotIdx: inst.zoneSlot,
      ...(inst.faceDown ? {} : { cardName: inst.name }), cardInstance: inst, ineligible: true,
    });
  }
  return out;
}

module.exports = { ausgegrauteRestkarten };
