'use strict';
// Brücke zu den do*-Handlern aus server.js (nicht exportierte Modul-Funktionen).
// Lädt den Server im Simulationsmodus (PP_ST_SIM=1: nichts wird gestartet, nur exportiert).
let _h = null;
function handlers() {
  if (_h) return _h;
  process.env.PP_ST_SIM = '1';
  if (!process.env.NODE_ENV) process.env.NODE_ENV = 'production';   // kein Datei-Wächter im Simulator
  _h = require('../server.js').skillTestHandlers;
  return _h;
}
module.exports = { handlers };
