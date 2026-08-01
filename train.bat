@echo off
set PP_TRAIN=1
set PP_TRAIN_GAMES=50
node --max-old-space-size=6144 --expose-gc server.js
pause