'use strict';
// Rang-Rahmen (Duplikate): welche Item-Id gehört zu einer Avatar-/Sleeve-URL?
//   Shop-Item                    /data/shop/<avatars|sleeves>/<id>.<ext>   → <id>
//   Standard-Avatar (von Anfang an)  /avatars/<Name>.<ext>                 → 'std:<Name>'
//   Standard-Sleeve (von Anfang an)  keine URL oder /cardback.png          → 'default'
// Server (server.js, player-profile.js) und Client (ppShopIdOfUrl in app-shared.jsx) müssen dieselbe Zuordnung benutzen.
function itemIdOfUrl(url, subdir) {
  const u = String(url || '').split('?')[0];
  const dec = (s) => { try { return decodeURIComponent(s); } catch { return s; } };
  let m = new RegExp('^/data/shop/' + subdir + '/([^/]+)\\.[a-z]+$', 'i').exec(u);
  if (m) return dec(m[1]);
  if (subdir === 'avatars') { m = /^\/avatars\/([^/]+)\.[a-z]+$/i.exec(u); if (m) return 'std:' + dec(m[1]); }
  if (subdir === 'sleeves' && (!u || u === '/cardback.png')) return 'default';
  return null;
}
module.exports = { itemIdOfUrl };
