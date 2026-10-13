import './style.css';
import { AudioEngine } from './audio/audio-engine';
import { InputState } from './engine/input';
import { startLoop } from './engine/loop';
import { Game } from './game/game';
import { PLAY_FIELD_HEIGHT, PLAY_FIELD_WIDTH } from './game/types';
import { Renderer } from './render/renderer';

function createElement<K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  className: string,
  textContent = '',
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tagName);
  element.className = className;
  if (textContent.length > 0) element.textContent = textContent;
  return element;
}

function buildHudItem(label: string, valueClassName = 'hud-value'): { item: HTMLDivElement; value: HTMLSpanElement } {
  const item = createElement('div', 'hud-item');
  const labelElement = createElement('span', 'hud-label', label);
  const value = createElement('span', valueClassName, '-');
  item.append(labelElement, value);
  return { item, value };
}

function boot(): void {
  const application = document.querySelector<HTMLDivElement>('#app');
  if (application === null) throw new Error('Missing #app element');

  const audioEngine = new AudioEngine();
  const game = new Game(audioEngine);
  const input = new InputState();

  const cabinet = createElement('main', 'cabinet');
  const header = createElement('header', 'cabinet-header');
  const title = createElement('h1', 'game-title');
  title.innerHTML = 'RAPTOR <span>BULLET HELL</span>';
  const subtitle = createElement('p', 'game-subtitle', 'Allies vs Axis');
  header.append(title, subtitle);

  const hudBar = createElement('section', 'hud-bar');
  hudBar.setAttribute('aria-label', 'Game status');
  const scoreHud = buildHudItem('Score');
  const livesHud = buildHudItem('Lives');
  const bombsHud = buildHudItem('Bombs');
  const waveHud = buildHudItem('Wave');
  const weaponHud = buildHudItem('Weapon', 'hud-value weapon');
  hudBar.append(scoreHud.item, livesHud.item, bombsHud.item, waveHud.item, weaponHud.item);

  const stageFrame = createElement('div', 'stage-frame');
  const canvas = createElement('canvas', 'game-canvas');
  canvas.width = PLAY_FIELD_WIDTH;
  canvas.height = PLAY_FIELD_HEIGHT;
  canvas.setAttribute('aria-label', 'Raptor Bullet Hell game field');
  const context = canvas.getContext('2d');
  if (context === null) throw new Error('Canvas 2D is not available');
  const renderer = new Renderer(context);

  const startOverlay = createElement('div', 'overlay');
  const startTitle = createElement('h2', '', 'RAPTOR BULLET HELL');
  const startText = createElement('p', '', 'Pilot the Allied jet through Axis waves, a tribute to Raptor: Call of the Shadows. Move with arrow keys or WASD, fire with Space, bomb with Shift, pause with P or Esc.');
  const startButton = createElement('button', 'primary-button', 'Start Mission');
  startButton.type = 'button';
  startOverlay.append(startTitle, startText, startButton);

  const pauseOverlay = createElement('div', 'overlay');
  pauseOverlay.hidden = true;
  const pauseTitle = createElement('h2', '', 'Paused');
  const resumeButton = createElement('button', 'primary-button', 'Resume');
  resumeButton.type = 'button';
  pauseOverlay.append(pauseTitle, resumeButton);

  const gameOverOverlay = createElement('div', 'overlay');
  gameOverOverlay.hidden = true;
  const gameOverTitle = createElement('h2', '', 'Mission Over');
  const finalScore = createElement('p', 'final-score', 'Score 0');
  const restartButton = createElement('button', 'primary-button', 'Restart Mission');
  restartButton.type = 'button';
  gameOverOverlay.append(gameOverTitle, finalScore, restartButton);

  stageFrame.append(canvas, startOverlay, pauseOverlay, gameOverOverlay);

  const controlsBar = createElement('div', 'controls-bar');
  const pauseButton = createElement('button', 'control-button', 'Pause');
  pauseButton.type = 'button';
  const muteButton = createElement('button', 'control-button', 'Mute');
  muteButton.type = 'button';
  const controlsRestartButton = createElement('button', 'control-button', 'Restart');
  controlsRestartButton.type = 'button';
  controlsBar.append(pauseButton, muteButton, controlsRestartButton);

  const helpText = createElement('p', 'help-text', 'Keyboard: arrows or WASD move, Space fires, Shift drops a bomb, P or Esc pauses. Collect S, M, R, shield and bomb pickups.');
  cabinet.append(header, hudBar, stageFrame, controlsBar, helpText);
  application.replaceChildren(cabinet);

  let displayedState = '';

  function refreshInterface(): void {
    const snapshot = game.getSnapshot();
    scoreHud.value.textContent = String(snapshot.score);
    livesHud.value.textContent = String(Math.max(0, snapshot.lives));
    bombsHud.value.textContent = String(snapshot.bombs);
    waveHud.value.textContent = String(snapshot.wave);
    weaponHud.value.textContent = snapshot.weaponName;
    pauseButton.textContent = snapshot.state === 'paused' ? 'Resume' : 'Pause';
    muteButton.textContent = audioEngine.isMuted ? 'Unmute' : 'Mute';
    if (snapshot.state !== displayedState) {
      displayedState = snapshot.state;
      startOverlay.hidden = snapshot.state !== 'ready';
      pauseOverlay.hidden = snapshot.state !== 'paused';
      gameOverOverlay.hidden = snapshot.state !== 'over';
      if (snapshot.state === 'over') finalScore.textContent = `Score ${snapshot.score} - Wave ${snapshot.wave}`;
      if (snapshot.state === 'ready') startButton.focus();
      if (snapshot.state === 'over') restartButton.focus();
    }
  }

  function startMission(): void {
    audioEngine.handleUserGesture();
    audioEngine.unlock();
    game.start();
    refreshInterface();
    canvas.focus();
  }

  startButton.addEventListener('click', startMission);
  restartButton.addEventListener('click', startMission);
  controlsRestartButton.addEventListener('click', startMission);
  resumeButton.addEventListener('click', () => { game.resume(); refreshInterface(); });
  pauseButton.addEventListener('click', () => { game.togglePause(); refreshInterface(); });
  muteButton.addEventListener('click', () => {
    audioEngine.toggleMuted();
    try { audioEngine.effects.uiClick(); } catch { /* audio is optional */ }
    refreshInterface();
  });

  window.addEventListener('keydown', (event) => {
    audioEngine.handleUserGesture();
    if (event.code === 'Enter') {
      if (game.state === 'ready' || game.state === 'over') { event.preventDefault(); startMission(); }
      else if (game.state === 'paused') { event.preventDefault(); game.resume(); refreshInterface(); }
    }
    if (event.code === 'KeyM') { audioEngine.toggleMuted(); refreshInterface(); }
  });
  window.addEventListener('blur', () => {
    if (game.state === 'playing') { game.pause(); refreshInterface(); }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game.state === 'playing') { game.pause(); refreshInterface(); }
  });

  input.attach(window);
  startLoop(
    (deltaSeconds) => { game.update(deltaSeconds, input); },
    () => { renderer.render(game.getRenderView()); refreshInterface(); },
  );
  refreshInterface();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
