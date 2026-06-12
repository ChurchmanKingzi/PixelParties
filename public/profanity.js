// ════════════════════════════════════════════════════════════════
//  PIXEL PARTIES — SHARED PROFANITY FILTER
//  Used by BOTH the Node server (authoritative validation on save) and
//  the browser client (instant feedback while typing). The server is the
//  source of truth — the client copy just spares the user a round-trip.
//
//  Loaded in Node via  require('./public/profanity.js')  and in the
//  browser via  <script src="/profanity.js">  (served from /public),
//  which exposes window.Profanity / window.containsProfanity.
//
//  Scope: deliberately conservative — it targets the common/basic swear
//  words, slurs, and immature taunts, not an exhaustive blocklist. The
//  three lists below are easy to extend. We reject on save rather than
//  censor, so a false positive only means "please reword", never silent
//  mangling. Very mild interjections (damn / hell / crap) are LEFT OUT on
//  purpose so wholesome messages ("Damn, good game!") aren't blocked.
// ════════════════════════════════════════════════════════════════
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) { root.Profanity = api; root.containsProfanity = api.containsProfanity; }
})(typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : this), function () {
  'use strict';

  // Max length (characters) for a Victory / Defeat message — roughly a
  // ten-word sentence. Enforced on both client and server.
  var MESSAGE_MAX_LEN = 80;

  // Stems: the word PLUS any trailing letters is blocked (fuck → fucking,
  // fucker, fucks…). Only safe prefixes belong here — a stem must not be
  // the start of a common clean word.
  var STEMS = [
    'fuck', 'motherfuck', 'shit', 'bullshit', 'dipshit', 'bitch', 'bastard',
    'asshole', 'dumbass', 'jackass', 'smartass', 'dickhead', 'cocksuck',
    'pussy', 'slut', 'whore', 'douch', 'wank', 'fagg', 'faggot', 'retard',
    'cunt', 'nigg', 'jizz', 'dildo', 'goddam',
  ];

  // Exact words (with an optional trailing 's'): blocked only as a whole
  // word, so they don't trip on clean words that merely contain them
  // (e.g. "ass" must not flag "class" or "pass").
  var EXACT = [
    'ass', 'arse', 'dick', 'cock', 'piss', 'prick', 'twat', 'fag', 'cum',
    'spic', 'kike', 'chink', 'dyke', 'tranny', 'idiot', 'moron', 'loser',
    'noob', 'imbecile',
  ];

  // Immature / toxic multi-word phrases (whole-word matched, leet-aware).
  var PHRASES = [
    'your mom', 'ur mom', 'your mum', 'ur mum', 'yo mama', 'yo momma',
    'kill yourself', 'kill urself', 'kys', 'neck yourself', 'you suck',
    'u suck', 'you stink', 'get rekt', 'git gud', 'ez clap', 'you bad',
    'ur bad', 'youre bad', 'get good', 'get gud',
  ];

  // Fold common leetspeak / elongation so "f4ck", "sh!t", "fuuuck" all
  // collapse onto their plain spelling before matching.
  function leetNormalize(text) {
    return String(text || '').toLowerCase()
      .replace(/[@4]/g, 'a')
      .replace(/[$5]/g, 's')
      .replace(/0/g, 'o')
      .replace(/[1!|]/g, 'i')
      .replace(/3/g, 'e')
      .replace(/7/g, 't')
      .replace(/(.)\1{2,}/g, '$1'); // collapse 3+ repeats: fuuuuck → fuck
  }

  // Word-padded, punctuation-stripped form for phrase matching, so
  // "ur-mom!" and "your   mom" both match the "ur mom" / "your mom" entries.
  function spaceNormalize(text) {
    return ' ' + leetNormalize(text).replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim() + ' ';
  }

  // Build a stem pattern that tolerates light obfuscation: a vowel may be
  // masked by a symbol or dropped ("f*ck", "fck"), and single separators may
  // sit between letters ("f.u.c.k", "f u c k"). Consonants stay literal so we
  // don't over-match. EXACT words stay strict (leet only) since they're short
  // and share letters with clean words.
  function buildStem(w) {
    return w.split('').map(function (ch) {
      return 'aeiou'.indexOf(ch) !== -1 ? '[' + ch + '*#%]?' : ch;
    }).join('[^a-z0-9]?');
  }
  var stemRe = new RegExp('\\b(' + STEMS.map(buildStem).join('|') + ')[a-z]*', 'i');
  var exactRe = new RegExp('\\b(' + EXACT.join('|') + ')s?\\b', 'i');

  function containsProfanity(text) {
    if (!text) return false;
    var norm = leetNormalize(text);
    if (stemRe.test(norm) || exactRe.test(norm)) return true;
    var spaced = spaceNormalize(text);
    for (var i = 0; i < PHRASES.length; i++) {
      if (spaced.indexOf(' ' + PHRASES[i] + ' ') !== -1) return true;
    }
    return false;
  }

  return { containsProfanity: containsProfanity, MESSAGE_MAX_LEN: MESSAGE_MAX_LEN };
});
