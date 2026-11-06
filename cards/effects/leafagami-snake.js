'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Leafagami Snake"
//  Creature (Normal, Lv 1, Summoning Magic, 50 HP)
//
//  „When Abilities would be removed from Heroes you control, don't remove them and draw a card for each affected Ability instead."
//
//  Rein passiv; die Wirkung sitzt zentral in der Engine (`laubSchlangeFuer`, `abilityEntfernungVerhindert`), das Skript trägt nur die Marke `protectsAbilitiesFromRemoval`.
//
//  ── WANN ────────────────────────────────────────────────────────────────
//  Solange eine Leafagami Snake aktiv auf dem Brett steht (Support Zone, offen, nicht Frost/Betäubung/Negation), gilt der Schutz für JEDEN Helden, den ihr KONTROLLEUR kontrolliert (eigene Spalte
//  ohne abgegebene Helden, dazu übernommene/geliehene — `heroSideOf`), unabhängig davon, in wessen Spalte die Schlange steht und wer die Entfernung verursacht (Gegner: The Yeeting, Memory Wipe,
//  Rain of Death …; eigene Kosten: Barrier of Faith, Weapon Storm, Weapon Unleashing, Quest of the Chosen One …).
//  „Removed" = die Ability-Karte würde den Helden verlassen: Ablage, Gelöscht, Hand, Deck. Gilt auch für Ability-Karten in Support Zonen (Xal, Xalibur, Cloak of Edge). Umhängen in andere Zonen
//  (Ability ↔ Support) ist keine Entfernung; ein Held, der gelöscht wird (Night, Soul Absorption …), nimmt seine Abilities mit — das ist kein „Entfernen von Abilities".
//
//  ── WAS GESCHIEHT ───────────────────────────────────────────────────────
//  Je betroffener Ability-KARTE (ein Stapel der Höhe 2 sind zwei Karten): die Karte bleibt liegen, der Kontrolleur der Schlange zieht 1 Karte, ein Wirbel bunten Laubs (`leafagami_leaves`) umkreist die
//  Karte. KOSTEN-Wege („send Abilities … to the discard pile" als Preis) melden dem Aufrufer, die Karte sei abgeworfen — der Effekt feuert, als wären die Abilities weg (Schaden × Anzahl, Negation …),
//  die Abilities bleiben geschützt. Eine Schleife schickt dieselbe Karte nicht zweimal (`_laubGeschuetzt`). Effekte, die die Ability nur zerstören/bewegen (The Yeeting, Rain of Death), lassen sie
//  liegen; die Ziehung passiert trotzdem.
// ═══════════════════════════════════════════

module.exports = {
  activeIn: ['support'],
  protectsAbilitiesFromRemoval: true,
  hooks: {},   // rein passiv (Engine-Prüfung `laubSchlangeFuer`); der Lader will ein `hooks`-Feld sehen
};
