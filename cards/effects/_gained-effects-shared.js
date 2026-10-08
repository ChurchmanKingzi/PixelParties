// ═══════════════════════════════════════════
//  GEWONNENE HELDENEFFEKTE — „This Hero gains the effects of X"
//  (v1186, Als Auftrag 18.9. zu „Tempeluna, the Convergence Fairy")
//
//  Vier Karten im Bestand tragen diesen Satz: Tempeluna, Night the
//  Herald of Chess, Pseudonia the Skill Devourer und Initiation
//  Ritual. Er hat ZWEI Haelften, und beide brauchen eine eigene
//  Antwort:
//
//    ① HOOKS haengen an einer KARTENINSTANZ. Liegt die gewonnene
//       Karte als Ausruestung am Helden (Tempelunas angelegte Feen),
//       ist SIE der Traeger — `treatAsEquip` plus die vorhandene
//       Regel in `CardInstance.isActiveIn` lassen ein
//       `activeIn: ['hero']`-Skript aus der Support Zone feuern.
//       Ist die Karte dagegen geloescht oder ueberbaut (die beiden
//       Grundfeen unter Tempeluna), gibt es keine Karte mehr — dann
//       traegt eine unsichtbare Instanz in der Zone `gained`.
//
//    ② VERTRAEGE sind Flags und Praedikate, die Engine und Server
//       ueber `loadCardEffect(hero.name)` DIREKT am Helden
//       nachschlagen. Genau daran waere „gains the effects" sonst
//       gescheitert, und zwar lautlos: Lunas ganze Wirkung steckt in
//       `canBypassLevelReqForCard` und `firewallModifiers`, Tempestes
//       Nachteil in `heroDamageCannotBeReducedOrNegated`. Kein
//       einziger Hook. Dafuer gibt es hier `heroScriptOf(hero)`.
//
//  ★ WARUM EINE REINE FUNKTION UND KEINE ENGINE-METHODE: die Frage
//  wird auch aus `server.js` gestellt (Helden-Effekt-Liste,
//  Bakhm-Zonen, Potion-Sperre), und dort ist nicht ueberall eine
//  Engine-Referenz zur Hand. Der ganze Zustand steht ohnehin am
//  Helden (`hero.gainedEffectNames`), eine Engine braucht es nicht.
//
//  ★ OHNE GEWONNENE EFFEKTE liefert `heroScriptOf` das eigene Skript
//  UNVERAENDERT — dasselbe Objekt, das `loadCardEffect` liefert. Die
//  Umstellung der 42 Abfragestellen ist damit fuer jede normale
//  Partie ein No-op, und der Schnellweg kostet einen Feldzugriff.
// ═══════════════════════════════════════════

const { loadCardEffect } = require('./_loader');

/**
 * Was NICHT mitwandert. „Effekt" meint die gedruckte WIRKUNG der
 * Karte, nicht ihre Identitaet und nicht ihren Lebenslauf. Ohne diese
 * Liste erbte Tempeluna z.B. die Aufstiegsbedingung einer angelegten
 * Fee und waere von da an selbst deren Grundform.
 */
const GAINED_EFFECT_DENYLIST = new Set([
  'hooks', 'activeIn', 'isActiveIn',
  'ascensionCondition', 'ascensionConditionUnskippable', 'payAscensionCost',
  'onAscendSetup', 'onAscensionBonus', 'formsAscensionStack',
  'blockEndPhaseOnAscend', 'evolutionAnimation', 'ascendsFromDefeat',
  'plainHeroForm', 'cheatAscensionBlocked',
  'gameStartPickPriority', 'startingAbilities',
  'onIdentityGained', 'onIdentityLost',
  'neverPlayable', 'banned',
]);

/** Die Namen, deren Effekte dieser Held gerade hat (Gewinnreihenfolge). */
function gainedNames(hero) {
  const liste = hero?.gainedEffectNames;
  if (!Array.isArray(liste) || liste.length === 0) return [];
  return liste.filter(n => n && n !== hero.name);
}

/**
 * ★ Traegt dieser Held den Effekt der Karte `kartenName` — als die Karte
 * SELBST oder als GEWONNENEN Effekt?
 *
 * Fuer Skripte, die in ihren Vertraegen (`reduceCardLevel`, …) nach „dem
 * eigenen Helden" suchen. Eine Pruefung `hero.name === CARD_NAME` laesst
 * jeden Erben (Pseudonia & Co.) stumm zurueck: der Vertrag selbst kommt ueber
 * `heroScriptOf` an, aber der Code darin erkennt den Erben nicht als sich.
 */
function hatEffekt(hero, kartenName) {
  if (!hero?.name || !kartenName) return false;
  return hero.name === kartenName || gainedNames(hero).includes(kartenName);
}

/**
 * ★ Ist `inst` ein TRAEGER fuer einen Heldenvertrag — die eigene Helden-
 * Instanz (Zone `hero`) oder die Instanz eines GEWONNENEN Effekts?
 *
 * Gewonnene Effekte haengen an einer Karteninstanz in der Zone `support`
 * (unsichtbar ohne Platz, oder die angelegte Fee bei Tempeluna) mit
 * `counters._gainedEffectFor` = Platz des ERBEN. Eine Zonenpruefung
 * `inst.zone !== 'hero'` schliesst sie aus. Ihr `heroIdx` ist der des Erben,
 * `hero` also dort der Traeger des Effekts, nicht die Karte, die ihn druckt.
 */
function istHeldenTraeger(inst) {
  return !!inst && (inst.zone === 'hero' || inst.counters?._gainedEffectFor != null);
}

/**
 * ★ v1285 — WESSEN gedruckter Effekt liefert den AKTIVEN Heldeneffekt?
 *
 * Als Befund 22.9.: „hat Pseudonia einen Effekt geerbt, soll ein Klick
 * auf sie NICHT ‚Pseudonia' als aktivierbaren Effekt anzeigen — sie hat
 * selbst keinen aktiven Effekt." Engine und Server fragten dafuer das
 * VERSCHMOLZENE Skript (`heroScriptOf`) und schrieben den HELDENNAMEN in
 * den Eintrag. Traegt der Held einen gewonnenen Aktiveffekt, stand er
 * damit unter dem falschen Namen im Menue.
 *
 * Liefert `{ name, script }` der Karte, die `onHeroEffect` stellt —
 * eigenes Skript zuerst, danach die gewonnenen in Gewinnreihenfolge —
 * oder `null`, wenn es gar keinen aktiven Effekt gibt. Der Name ist
 * zugleich der HOPT-Schluessel (v1275: pro Spieler und Kartenname), ein
 * gewonnener Effekt teilt seine Sperre also mit dem Original.
 */
function heroEffectSource(hero) {
  if (!hero?.name) return null;
  const eigen = loadCardEffect(hero.name);
  if (eigen?.heroEffect && typeof eigen.onHeroEffect === 'function') return { name: hero.name, script: eigen };
  for (const name of gainedNames(hero)) {
    const sc = loadCardEffect(name);
    if (sc?.heroEffect && typeof sc.onHeroEffect === 'function') return { name, script: sc };
  }
  return null;
}

/**
 * ★ v1286 — NUR der gedruckte Aktiveffekt des Helden selbst.
 *
 * Fuer Menue-Zweige, die ausdruecklich den eigenen Effekt meinen:
 * gewonnene Aktiveffekte stehen ueber ihre Traegerinstanzen schon im
 * Menue, ein zweiter Eintrag hier waere ein Doppel (Als Befund 22.9.:
 * Pseudonia bot einen gefressenen Effekt zweimal an). Ein Held ohne
 * eigenen aktiven Effekt liefert `null` und taucht damit gar nicht auf.
 */
function eigenesHeldenSkript(hero) {
  if (!hero?.name) return null;
  const eigen = loadCardEffect(hero.name);
  if (eigen?.heroEffect && typeof eigen.onHeroEffect === 'function') return { name: hero.name, script: eigen };
  return null;
}

/** Alle Skripte, deren Vertraege fuer diesen Helden gelten — eigenes zuerst. */
function heroScriptsOf(hero) {
  if (!hero?.name) return [];
  const raus = [];
  const eigen = loadCardEffect(hero.name);
  if (eigen) raus.push(eigen);
  for (const name of gainedNames(hero)) {
    const sc = loadCardEffect(name);
    if (sc && !raus.includes(sc)) raus.push(sc);
  }
  return raus;
}

// Verschmelzungen liegen am Helden selbst (`hero._gainedScriptCache`),
// nicht in einer Map: sie sterben dann mit ihm und ueberleben keinen
// Snapshot/Restore der MCTS-Suche als Leiche. Der Schluessel enthaelt
// alles, was die Verschmelzung aendern kann.
function heroScriptOf(hero) {
  if (!hero?.name) return null;
  const gewonnen = gainedNames(hero);
  // ★ SCHNELLWEG — der Normalfall. Diese Funktion steht in Hook-Filtern
  // und im Schadenspfad; ohne gewonnene Effekte darf sie nichts tun.
  if (gewonnen.length === 0) return loadCardEffect(hero.name) || null;

  const key = `${hero.name}|${gewonnen.join('|')}`;
  const cache = hero._gainedScriptCache;
  // `_pruefeLebt` ist eine Funktion: eine JSON-Kopie des Helden (Snapshot/Restore der Suche) behielte die Flaggen des Skripts, verlöre aber alle
  // Funktionen — dann gilt der Zwischenspeicher als tot und wird neu gebaut.
  if (cache && cache.key === key && cache.script && typeof cache.script._pruefeLebt === 'function') return cache.script;

  const eigen = loadCardEffect(hero.name) || null;
  const merged = {};
  // Gewonnene zuerst legen, das eigene zuletzt — so gewinnt das eigene
  // Skript jeden Schluessel (ein gewonnener Effekt ERGAENZT, er
  // ueberschreibt nie), und unter den gewonnenen der zuerst gewonnene.
  for (const name of gewonnen.slice().reverse()) {
    const sc = loadCardEffect(name);
    if (!sc) continue;
    for (const k of Object.keys(sc)) {
      if (GAINED_EFFECT_DENYLIST.has(k)) continue;
      merged[k] = sc[k];
    }
  }
  if (eigen) for (const k of Object.keys(eigen)) merged[k] = eigen[k];
  merged._istVerschmolzen = true;
  merged._eigenesSkript = eigen;
  merged._gewonneneNamen = gewonnen.slice();
  merged._pruefeLebt = () => true;
  // Nicht aufzählbar: der Zwischenspeicher gehört nicht in Kopien/Schnappschüsse des Helden (JSON, Lookahead-Snapshots).
  Object.defineProperty(hero, '_gainedScriptCache', { value: { key, script: merged }, writable: true, configurable: true, enumerable: false });
  return merged;
}

/**
 * Die Effekttexte, die dieser Held gerade vereinigt — fuer den
 * Tooltip. Liefert `[{ card, effect }]`, eigener Effekt zuerst.
 * Ohne gewonnene Effekte: leere Liste (der Client zeigt dann seinen
 * normalen Text, nichts aendert sich).
 */
function gainedEffectTexts(hero, cardDB) {
  const gewonnen = gainedNames(hero);
  if (gewonnen.length === 0) return [];
  const raus = [];
  const eigen = cardDB?.[hero.name];
  if (eigen?.effect) raus.push({ card: hero.name, effect: eigen.effect, own: true });
  for (const name of gewonnen) {
    const cd = cardDB?.[name];
    if (cd?.effect) raus.push({ card: name, effect: cd.effect, own: false });
  }
  return raus;
}

module.exports = {
  GAINED_EFFECT_DENYLIST,
  gainedNames,
  hatEffekt,
  istHeldenTraeger,
  heroEffectSource,
  eigenesHeldenSkript,
  heroScriptsOf,
  heroScriptOf,
  gainedEffectTexts,
};
