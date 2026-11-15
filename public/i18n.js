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
  P.cardName = (n) => (P.cards[n] && P.cards[n].name) || n;
  P.cardEffect = (c) => (P.cards[c.name] && P.cards[c.name].effect) || c.effect;
  // Laedt die Uebersetzungen; Kartenobjekte bekommen `effectEn`/`nameEn` und die deutsche `effect`.
  P.load = async () => {
    if (lang === 'en') return;
    try {
      const j = await (await fetch('/data/i18n/' + lang + '-cards.json')).json();
      P.names = j._names || {}; delete j._names; P.cards = j;
    } catch (e) { /* ohne Datei: englisch */ }
  };
  P.apply = (cards) => {
    for (const c of cards) { const t = P.cards[c.name]; if (t) { c.nameEn = c.name; c.effectEn = c.effect; c.effect = t.effect; c.displayName = t.name; } }
  };
  window.PP_I18N = P;
  document.documentElement.lang = lang;
})();
