// ═══════════════════════════════════════════
//  SHARED: "Aquatic" family (v697)
//
//  Die EINZIGE Auslegungsstelle des Namensbezugs
//  „an "Aquatic" Surprise" (Als bindende Regel:
//  Namensbezuege in Kartentexten sind Teilstring-
//  Treffer im GANZEN Kartennamen, case-sensitive)
//  — plus der geteilte Discard-Rider der Serie:
//  „Then, you may choose any "Aquatic" Surprise
//  from your deck, reveal it and place it face-
//  down into the Surprise Zone this card
//  occupied."
//
//  Der Rider laeuft NACH dem kartenspezifischen
//  Teil (defeat / Schilde / 100 Schaden) und nur,
//  wenn die Herkunftszone eine Surprise Zone war —
//  eine andere Zone kann die Karte gar nicht
//  „occupied" haben.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

/** Teilstring-Kanon: zaehlt jede Karte mit "Aquatic" im Namen. */
function isAquaticName(name) {
  return typeof name === 'string' && name.includes('Aquatic');
}

/** „"Aquatic" Surprise" = Aquatic im Namen UND Surprise-Kartenart. */
function isAquaticSurprise(cardDB, name) {
  if (!isAquaticName(name)) return false;
  const cd = cardDB[name];
  return !!(cd && hasCardType(cd, 'Surprise'));
}

/**
 * Discard-Rider der Serie. `heroIdx` ist der Held, dessen Surprise Zone
 * die abgelegte Karte belegte. Bedingungen:
 *   • Herkunft war eine Surprise Zone (der Aufrufer prueft ctx.fromZone),
 *   • der Held lebt noch und seine Surprise Zone ist (wieder) frei,
 *   • das Deck enthaelt mindestens eine "Aquatic" Surprise.
 * „you may" — cancellable. Reveal fuer BEIDE Spieler, dann verdeckt in
 * die Zone; das Deck wird danach gemischt (Standard nach jeder Suche).
 */
async function offerAquaticReplacement(engine, pi, heroIdx, sourceName) {
  const gs = engine.gs;
  const ps = gs.players[pi];
  if (!ps) return false;

  // Als Ruling: der Nachschub ist KOMPLETT vom Helden-Zustand
  // losgeloest — auch die Zone eines toten Helden wird nachbestueckt.
  // Es muss nur die Zone existieren und frei sein.
  const hero = ps.heroes?.[heroIdx];
  if (!hero?.name) return false;
  const zone = ps.surpriseZones?.[heroIdx];
  if (!zone || zone.length > 0) return false; // Zone belegt → kein Nachschub

  const cardDB = engine._getCardDB();
  const kandidaten = [];
  const gesehen = new Set();
  for (const n of (ps.mainDeck || [])) {
    if (gesehen.has(n)) continue;
    gesehen.add(n);
    if (isAquaticSurprise(cardDB, n)) kandidaten.push(n);
  }
  if (kandidaten.length === 0) return false;

  const pick = await engine.promptGeneric(pi, {
    type: 'cardGallery',
    cards: kandidaten.map(n => ({ name: n, source: 'deck' })),
    title: sourceName,
    description: `You may choose an "Aquatic" Surprise from your deck to place face-down into the freed Surprise Zone.`,
    confirmLabel: '🌊 Set it!',
    cancellable: true,
    gerrymanderEligible: true, // echtes "you may"
  });
  const gewaehlt = pick?.cardName || (typeof pick === 'string' ? pick : null);
  if (!gewaehlt || pick?.cancelled) return false;

  const _taken_deckIdx = await engine.takeFromPile(ps, 'deck', gewaehlt, { source: '_aquatic-shared' });   // v820: Stapel-Schicht
  if (!_taken_deckIdx) return false; // Deck hat sich veraendert — sauber aussteigen

  // Reveal fuer beide Seiten — die Identitaet ist danach oeffentlich,
  // der Flug-Broadcast unten darf den Namen also tragen.
  await engine.showTriggeredEffect(gewaehlt, { delayMs: 650 });

  // Verdeckt in die freigewordene Zone. Flug Deck → Surprise Zone
  // der Client kennt 'surprise' als Zielanker (elementFor).
  //
  // ★ REIHENFOLGE (v698, Als Befund): Zustand und Sync erst NACH der
  // Fluglandung. Vorher wurde direkt nach dem Broadcast gepusht und
  // gesynct — die Karte stand also schon in der Zone, waehrend der
  // Flug gerade erst losging (doppelt sichtbar). Der Client kennt fuer
  // Surprise-Ziele kein Ziel-Verstecken (das gibt es nur fuer
  // Support-Slots), also traegt der SERVER die Ordnung: waehrend der
  // 700-ms-Transitzeit des Pile-Flugs ist die Karte physisch „in der
  // Luft" — weder im Deck (schon gezogen und gemischt) noch in der
  // Zone. Der Ablauf haelt hier ohnehin, nichts laeuft nebenher.
  engine._broadcastEvent('play_pile_transfer', {
    owner: pi, cardName: gewaehlt,
    from: 'deck', to: 'surprise', toHeroIdx: heroIdx,
    faceDown: true,
  });
  engine.shuffleDeck(pi);
  await engine._delay(700);   // Transitzeit des Pile-Flugs (Client: 700 ms)
  zone.push(gewaehlt);
  const inst = engine._trackCard(gewaehlt, pi, 'surprise', heroIdx, -1);
  inst.faceDown = true;

  engine.log('aquatic_replacement_set', {
    player: ps.username, card: gewaehlt, hero: hero?.name, via: sourceName,
  });
  engine.sync();
  return true;
}

/**
 * CPU-Antwort auf die Nachschub-Galerie — von allen drei Karten geteilt.
 * Nimmt bevorzugt eine Karte mit ANDEREM Namen als die Quelle (Vielfalt
 * in der Zone schlaegt eine zweite Kopie derselben), sonst die erste.
 */
function cpuPickReplacement(promptData, sourceName) {
  const namen = (promptData?.cards || []).map(c => (typeof c === 'string' ? c : c?.name)).filter(Boolean);
  if (namen.length === 0) return undefined;
  const anders = namen.find(n => n !== sourceName);
  return { cardName: anders || namen[0], source: 'deck' };
}

module.exports = { isAquaticName, isAquaticSurprise, offerAquaticReplacement, cpuPickReplacement };
