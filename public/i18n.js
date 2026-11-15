// Sprachumschaltung (en = Standard, de). Wahl liegt in localStorage 'pp-lang'.
// Kartentexte: data/i18n/<lang>-cards.json  { "<EN-Name>": { name, effect }, "_names": { "<EN>": "<DE>" } }
// Der Kartenschluessel (c.name) bleibt IMMER englisch (Spiellogik, Decks, Bilder) – nur die Anzeige wechselt.
(function () {
  let lang = 'en';
  try { const v = localStorage.getItem('pp-lang'); if (v === 'de' || v === 'en') lang = v; } catch (e) {}
  const P = { lang, cards: {}, names: {} };
  P.get = () => lang;
  P.set = (l) => { try { localStorage.setItem('pp-lang', l); } catch (e) {} location.reload(); };
  P.toggle = () => P.set(lang === 'en' ? 'de' : 'en');
  // Anzeigename einer Karte (Fallback: englischer Name)
  P.ui = {};
  // UI-Begriff uebersetzen (Kartentyp, Untertyp, Schule, Archetyp, Startfaehigkeit, ...); ohne Eintrag oder auf Englisch: Original
  P.t = (s) => (lang === 'en' || s == null) ? s : (P.ui[s] || P.archetypes[s] || P.names[s] || s);
  P.archetypes = {};
  P.cardName = (n) => (P.cards[n] && P.cards[n].name) || n;
  P.cardEffect = (c) => (P.cards[c.name] && P.cards[c.name].effect) || c.effect;
  // Laedt die Uebersetzungen; Kartenobjekte bekommen `effectEn`/`nameEn` und die deutsche `effect`.
  P.load = async () => {
    if (lang === 'en') return;
    try {
      try { P.ui = await (await fetch('/data/i18n/' + lang + '-ui.json')).json(); } catch (e) { P.ui = {}; }
      const j = await (await fetch('/data/i18n/' + lang + '-cards.json')).json();
      P.names = Object.assign({}, j._names || {}); P.archetypes = j._archetypes || {}; delete j._names; delete j._archetypes; P.cards = j; for (const k in j) P.names[k] = j[k].name;
    } catch (e) { /* ohne Datei: englisch */ }
  };
  // Faehigkeits-Bonus ("Leadership 3", "Fighting") -> Namensliste; sonst Freitext aus der Uebersetzung der Karte
  const saDe = (v, t, k) => {
    if (!v) return v;
    if (t && t[k]) return t[k];
    if (P.names[v]) return P.names[v];
    const m = /^(.+) (\d+)$/.exec(v);
    return m && P.names[m[1]] ? P.names[m[1]] + ' ' + m[2] : v;
  };
  P.apply = (cards) => {
    for (const c of cards) {
      const t = P.cards[c.name];
      if (c.startingAbility1 || c.startingAbility2) { c.sa1De = saDe(c.startingAbility1, t, 'startingAbility1'); c.sa2De = saDe(c.startingAbility2, t, 'startingAbility2'); }   // Anzeige; die Originalfelder bleiben (Logik)
      if (t) { c.nameEn = c.name; c.effectEn = c.effect; c.effect = t.effect; c.displayName = t.name; }
    }
  };
  window.PP_I18N = P;
  window.ppT = P.t;
  document.documentElement.lang = lang;
})();
