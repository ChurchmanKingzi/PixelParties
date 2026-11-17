'use strict';
// ═══════════════════════════════════════════════════════════════════
//  „PERFORM"-KARTEN: NUR NORMAL-, AREA- UND ATTACHMENT-KARTEN (Love Shot, Time Distortion)
//
//  Spielgestalter-Entscheidung 17.11.2026: „Ergänze bei Time Distortion und Love Shot im Text, dass es ein ‚Normal, Area, or Attachment‘ Spell sein muss. Reactions und Surprises
//  sind keine legitimen Ziele." (Kartentext in `data/cards.json` entsprechend ergänzt.) Reaction- und Surprise-Karten werden von diesen Karten nie „performt": Love Shot graut sie in der
//  Kartenwahl aus (vorher: Booby Trap & Co. wählbar, dann ohne Wirkung abgelegt — die Karte war verloren; Reaction-Spells mit `proactivePlay` wie Deepsea Spores liefen als normaler Spell),
//  Time Distortion graut sie in der Auswahl-Galerie aus. Die Regel gilt für Spells UND Attacks (auch Surprise-/Reaction-Attacks verfielen sonst wirkungslos). Chaos Magic lässt ohnehin nur
//  Normal Spells zu und bleibt unberührt.
//
//    performbarerUntertyp(cd) → true, wenn der Untertyp der Karte Normal, Area oder Attachment ist (kein Untertyp zählt als Normal)
// ═══════════════════════════════════════════════════════════════════

const ERLAUBT = new Set(['normal', 'area', 'attachment']);

function performbarerUntertyp(cd) {
  const st = String(cd?.subtype || '').toLowerCase();
  return st === '' || ERLAUBT.has(st);
}

module.exports = { performbarerUntertyp };
