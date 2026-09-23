'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Sticky Wand"  (v1306)
//  Artifact (Normal) — Cost 6
//
//  "Choose a Hero you control and immediately have it use an Attachment
//   Attack/Spell from your hand as an additional Action. You can only
//   play 1 "Sticky Wand" per turn."
//
//  • Zielwahl ueber den Artefakt-Zielpfad (`isTargetingArtifact`):
//    eigene lebende Helden; wer gerade KEIN Attachment wirken kann, steht
//    ausgegraut im Angebot (Als Regel 21.8.) — Helden ohne Aktionsfaehig-
//    keit (Frozen/Stunned/Bound), ohne passende Abilities oder ohne
//    Attachment-Karte auf der Hand.
//  • Die Zusatzaktion laeuft ueber `performImmediateAction`, auf den
//    gewaehlten Helden gesperrt, nur Spells/Attacks mit Subtyp
//    „Attachment". Wirt-/Zonenwahl macht das Attachment selbst
//    (`pickAttachmentHost`); alte Drop-Hinweise werden vorher geloescht,
//    damit sie den Wirt nicht fehlleiten.
//  • „Nur 1 pro Zug": hart, pro Spieler — Sperre erst, wenn die Karte
//    wirklich aufgeloest hat.
//  • Abbrechbar bis zuletzt (Als Regel 23.9.): wer die Kartenwahl oder die
//    Zielwahl des Attachments abbricht, landet wieder in der Heldenwahl
//    (`{ aborted: true }`), Gold kommt zurueck. Das Kartenbild bleibt so
//    lange zurueckgehalten (`deferReveal` + `_holdCardReveal`) und geht
//    erst zum Gegner, wenn das Attachment ANFAENGT aufzuloesen
//    (`zusageAuftritt` als Funktion, v1306) — wie bei Junshi.
//  • Bild: klebriger Glibber am Helden (`hydra_goo`, vorhandener Klang),
//    im selben Moment wie der Reveal.
// ═══════════════════════════════════════════
const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Sticky Wand';
const SPERRE = (pi) => `sticky-wand:${pi}`;

function istAttachment(engine, name) {
  const cd = engine._getCardDB()[name];
  if (!cd) return false;
  if (!(hasCardType(cd, 'Spell') || hasCardType(cd, 'Attack'))) return false;
  return String(cd.subtype || '').toLowerCase() === 'attachment';
}

/** Attachments, die dieser Held JETZT als Zusatzaktion wirken koennte. */
function wirkbareAttachments(engine, pi, hi) {
  const hero = engine.gs.players[pi]?.heroes?.[hi];
  if (!hero?.name || hero.hp <= 0) return [];
  if (engine.isHeroIncapacitated(pi, hi)) return [];
  return engine.getHeroEligibleActionCards(pi, hi).filter(n => istAttachment(engine, n));
}

function heldenZiele(gs, pi, engine) {
  const ps = gs.players[pi];
  const out = [];
  (ps?.heroes || []).forEach((h, hi) => {
    if (!h?.name || h.hp <= 0) return;
    const t = { id: `hero-${pi}-${hi}`, type: 'hero', owner: pi, heroIdx: hi, cardName: h.name };
    if (!engine || wirkbareAttachments(engine, pi, hi).length === 0) t.ineligible = true;
    out.push(t);
  });
  return out;
}

module.exports = {
  isTargetingArtifact: true,
  deferReveal: true,                 // Bild erst beim Zusagepunkt
  animationType: 'none',             // eigenes Bild im Zusagepunkt

  canActivate(gs, pi, engine) {
    const eng = engine || gs._engineRef;
    if (gs.hoptUsed?.[SPERRE(pi)] === gs.turn) return false;
    if (!eng) return true;
    return heldenZiele(gs, pi, eng).some(t => !t.ineligible);
  },

  getValidTargets(gs, pi, engine) {
    return heldenZiele(gs, pi, engine || gs._engineRef);
  },

  targetingConfig: {
    description: 'Choose a Hero you control. It immediately uses an Attachment Attack/Spell from your hand.',
    confirmLabel: '🪄 Stick!',
    confirmClass: 'btn-success',
    cancellable: true,
    greenSelect: true,
    exclusiveTypes: true,
    maxPerType: { hero: 1 },
  },

  validateSelection: (ids) => Array.isArray(ids) && ids.length === 1,

  resolve: async (engine, pi, selectedIds, validTargets) => {
    const gs = engine.gs;
    if (gs.hoptUsed?.[SPERRE(pi)] === gs.turn) return { cancelled: true };
    const ziel = (validTargets || []).find(t => t.id === selectedIds?.[0]);
    if (!ziel || ziel.type !== 'hero' || ziel.ineligible) return { aborted: true };
    const hi = ziel.heroIdx;
    const hero = gs.players[pi]?.heroes?.[hi];
    if (wirkbareAttachments(engine, pi, hi).length === 0) return { aborted: true };

    // Alte Drop-Hinweise raus — sie stammen aus einem frueheren Zug der
    // Hand und wuerden `pickAttachmentHost` sonst den Wirt vorgeben.
    delete gs._attachmentHeroIdx; delete gs._attachmentZoneSlot; delete gs._attachmentOwner;

    gs._holdCardReveal = true;
    let res;
    try {
      res = await engine.performImmediateAction(pi, hi, {
        title: CARD_NAME,
        description: `${hero.name} immediately uses an Attachment Attack/Spell from your hand!`,
        allowedCardTypes: ['Spell', 'Attack'],
        cardNameFilter: (name) => istAttachment(engine, name),
        // Zusagepunkt: das Attachment beginnt aufzuloesen → jetzt darf der
        // Gegner Sticky Wand sehen, und der Glibber klebt am Helden.
        zusageAuftritt: () => {
          delete gs._holdCardReveal;
          engine._broadcastEvent('play_zone_animation', { type: 'hydra_goo', owner: pi, heroIdx: hi, zoneSlot: -1 });
          engine._firePendingCardReveal();
        },
      });
    } finally {
      delete gs._holdCardReveal;
    }
    if (!res?.played) return { aborted: true };   // zurueck in die Heldenwahl, Gold zurueck

    if (!gs.hoptUsed) gs.hoptUsed = {};
    gs.hoptUsed[SPERRE(pi)] = gs.turn;
    engine.log('sticky_wand', { player: gs.players[pi]?.username, hero: hero.name, card: res.cardName || null });
    engine.sync();
  },

  _test: { istAttachment, wirkbareAttachments, heldenZiele },
};
