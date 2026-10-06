'use strict';
// ═══════════════════════════════════════════════════════════════════
//  SKILL TEST — GELERNTES PROFIL DES BOTS
//
//  EINE Datei (`data/skilltest-profile.json`, per `PP_ST_PROFILE` umlenkbar)
//  hält alles, was die Bots aus Selbstspiel-Partien gelernt haben. Der Bot
//  (policy.js, autoprep) liest es nur — geschrieben wird es vom Trainer
//  (learn/train.js) und vom Hintergrund-Lernen (learn/background.js).
//
//  Inhalt (`version` zählt hoch, jede Speicherung ist atomar):
//    games        Anzahl ausgewerteter Partien
//    playValue    Karte → { n, sum }   mittlerer Zuwachs der Stellungsbewertung nach dem Ausspielen
//                                      (Kanal 1: „welche Karten bringen im Moment des Spielens etwas?")
//    cardValue    Karte → { n, sum }   mittlere Platzierungsgüte, wenn die Karte im Basisaufbau stand
//    dealtValue   Karte → { n, sum }   mittlere Platzierungsgüte, wenn die Karte ausgeteilt wurde (Starthand oder Recycler-Auswurf),
//                                      egal ob sie später eingesetzt wurde — vergleichbar über ALLE Kartentypen (Kartenliste)
//                                      (Kanal 2: Kartenwert für Aufbau/Recycling)
//    pairValue    „A|B" → { n, sum }   dasselbe für Kartenpaare (Kombos, Held+Ability, Held+Creature)
//    prepValue    Karte → { n, sum, keep }  Bewertung beim Aufbau: Mittel (sum / n) des Werts, den die Behalten/Recyceln-Entscheidung der Karte
//                                      gegeben hat (positiv: behalten, negativ: recyceln; ohne erkundete Fälle), keep = Anzahl „behalten“
//    keepModel    Behalten/Recyceln mit Kontext (restliche Hand + Brett), siehe learn/keepmodel.js
//    personas     [{ id, name, weights, fitness, games }]  Spielstil-Population (Kanal 3: Liga/ES)
//    totals       Zähler (Aktionen, Spiele je Spielerzahl …)
//
//  Ohne Datei oder bei Fehlern gibt `get()` ein leeres Profil: der Bot spielt dann
//  mit den Standard-Gewichten und der reinen Heuristik.
// ═══════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');

const FILE = () => process.env.PP_ST_PROFILE || path.join(__dirname, '..', '..', 'data', 'skilltest-profile.json');
const CHECK_EVERY_MS = 30 * 1000;

let cache = null, loadedAt = 0, fileMtime = 0;

function emptyProfile() {
  return { version: 0, games: 0, updated: null, playValue: {}, cardValue: {}, dealtValue: {}, pairValue: {}, prepValue: {}, keepModel: null, personas: [], totals: { plays: 0, byPlayers: {} } };
}

function readFile() {
  try {
    const f = FILE();
    const st = fs.statSync(f);
    const data = JSON.parse(fs.readFileSync(f, { encoding: 'utf-8' }));
    return { data: Object.assign(emptyProfile(), data), mtime: st.mtimeMs };
  } catch { return null; }
}

/** Das (zwischengespeicherte) Profil. Wird höchstens alle 30 s auf Änderungen geprüft. */
function get() {
  const now = Date.now();
  if (cache && now - loadedAt < CHECK_EVERY_MS) return cache;
  loadedAt = now;
  try {
    const st = fs.statSync(FILE());
    if (cache && st.mtimeMs === fileMtime) return cache;
  } catch { if (!cache) cache = emptyProfile(); return cache; }
  const r = readFile();
  if (r) { cache = r.data; fileMtime = r.mtime; }
  else if (!cache) cache = emptyProfile();
  return cache;
}

/** Atomar speichern (Temp-Datei + Umbenennen); erhöht `version`. */
function save(profile) {
  const f = FILE();
  fs.mkdirSync(path.dirname(f), { recursive: true });
  profile.version = (profile.version || 0) + 1;
  profile.updated = new Date().toISOString();
  const tmp = f + '.tmp-' + process.pid;
  fs.writeFileSync(tmp, JSON.stringify(profile), { encoding: 'utf-8' });
  fs.renameSync(tmp, f);
  cache = profile; loadedAt = Date.now();
  try { fileMtime = fs.statSync(f).mtimeMs; } catch { /* egal */ }
  return profile;
}

/** Lädt das Profil frisch von der Platte (für den Trainer, der es verändert). */
function load() {
  const r = readFile();
  return r ? r.data : emptyProfile();
}

function reset() { cache = null; loadedAt = 0; fileMtime = 0; }

/** Mittelwert eines { n, sum }-Eintrags (0 ohne Daten). */
function meanOf(e) { return e && e.n > 0 ? e.sum / e.n : 0; }

/** Eintrag { n, sum } um eine Beobachtung ergänzen. */
function addObs(table, key, v) {
  if (!Number.isFinite(v)) return;
  const e = table[key] || (table[key] = { n: 0, sum: 0 });
  e.n++; e.sum += v;
}

/** Eine Persona (Gewichtsvektor) aus der Population ziehen — bessere öfter. `null` ohne Population. */
function samplePersona(profile, rng = Math.random) {
  const pop = (profile && profile.personas) || [];
  if (!pop.length) return null;
  const minF = Math.min(...pop.map(p => p.fitness || 0));
  const ws = pop.map(p => 0.25 + ((p.fitness || 0) - minF));
  let r = rng() * ws.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pop.length; i++) { r -= ws[i]; if (r <= 0) return pop[i]; }
  return pop[pop.length - 1];
}

module.exports = { get, load, save, reset, emptyProfile, meanOf, addObs, samplePersona, FILE };
