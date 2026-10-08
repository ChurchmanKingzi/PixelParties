import 'pixi.js/unsafe-eval';
import { Game } from './ui/game';

Game.boot().then((g) => { (window as unknown as { game: Game }).game = g; }).catch((e) => {
  console.error(e);
  const box = document.getElementById('box');
  const ov = document.getElementById('overlay');
  if (box && ov) {
    box.textContent = 'Could not start the game: ' + (e instanceof Error ? e.message : String(e));
    ov.classList.add('show');
  }
});
