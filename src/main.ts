import './style.css';
import { AudioEngine } from './audio/audio-engine';
import { InputState, type TouchControl } from './engine/input';
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

function buildHudItem(
  label: string,
  valueClassName = 'hud-value',
): { item: HTMLDivElement; value: HTMLSpanElement } {
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
  const startText = createElement(
    'p',
    '',
    'Pilot the Allied jet through Axis waves, a tribute to Raptor: Call of the Shadows. Move with arrow keys or WASD, fire with Space, bomb with Shift, pause with P or Esc. On a phone, steer with the D-pad and hold FIRE.',
  );
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

  const helpText = createElement(
    'p',
    'help-text',
    'Keyboard: arrows or WASD move, Space fires, Shift drops a bomb, P or Esc pauses. Touch: steer with the D-pad, hold FIRE, tap BOMB. Collect S, M, R, shield and bomb pickups.',
  );

  const touchDeck = createElement('div', 'touch-deck');
  touchDeck.setAttribute('role', 'group');
  touchDeck.setAttribute('aria-label', 'Touch controls');
  const directionPad = createElement('div', 'touch-direction-pad');
  directionPad.setAttribute('role', 'group');
  directionPad.setAttribute('aria-label', 'Movement');
  const actionPad = createElement('div', 'touch-action-pad');
  actionPad.setAttribute('role', 'group');
  actionPad.setAttribute('aria-label', 'Weapons');

  function buildTouchButton(
    control: TouchControl,
    label: string,
    svgPath: string | null,
    text = '',
  ): HTMLButtonElement {
    const button = createElement('button', 'touch-button', text);
    button.type = 'button';
    button.dataset.touchControl = control;
    button.setAttribute('aria-label', label);
    if (svgPath !== null) {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('aria-hidden', 'true');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', svgPath);
      svg.append(path);
      button.append(svg);
    }
    return button;
  }

  const upButton = buildTouchButton('up', 'Move up', 'M12 5l7 10H5z');
  const leftButton = buildTouchButton('left', 'Move left', 'M5 12l10-7v14z');
  const rightButton = buildTouchButton('right', 'Move right', 'M19 12L9 5v14z');
  const downButton = buildTouchButton('down', 'Move down', 'M12 19L5 9h14z');
  const fireButton = buildTouchButton('fire', 'Fire, hold to keep firing', null, 'FIRE');
  const bombButton = buildTouchButton('bomb', 'Drop bomb', null, 'BOMB');
  const touchButtons = [upButton, leftButton, rightButton, downButton, fireButton, bombButton];
  directionPad.append(upButton, leftButton, rightButton, downButton);
  actionPad.append(fireButton, bombButton);
  touchDeck.append(directionPad, actionPad);

  cabinet.append(header, hudBar, stageFrame, controlsBar, helpText, touchDeck);
  application.replaceChildren(cabinet);

  const touchPointers = new Map<number, TouchControl>();
  const touchControls: TouchControl[] = ['left', 'right', 'up', 'down', 'fire', 'bomb'];

  function releaseTouchPointer(pointerId: number): void {
    const control = touchPointers.get(pointerId);
    if (control === undefined) return;
    touchPointers.delete(pointerId);
    input.touchButtonUp(control);
    if (![...touchPointers.values()].includes(control)) {
      for (const button of touchButtons) {
        if (button.dataset.touchControl === control) button.classList.remove('is-held');
      }
    }
  }

  function clearTouchButtons(): void {
    touchPointers.clear();
    for (const control of touchControls) input.touchButtonUp(control);
    for (const button of touchButtons) button.classList.remove('is-held');
  }

  for (const button of touchButtons) {
    const control = button.dataset.touchControl as TouchControl;
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      audioEngine.handleUserGesture();
      if (event.button > 0 || touchPointers.has(event.pointerId)) return;
      try {
        button.setPointerCapture(event.pointerId);
      } catch {
        /* capture is a nicety, the release handlers still run */
      }
      touchPointers.set(event.pointerId, control);
      input.touchButtonDown(control);
      button.classList.add('is-held');
    });
    button.addEventListener('pointerup', (event) => releaseTouchPointer(event.pointerId));
    button.addEventListener('pointercancel', (event) => releaseTouchPointer(event.pointerId));
    button.addEventListener('lostpointercapture', (event) => releaseTouchPointer(event.pointerId));
    button.addEventListener('click', (event) => {
      // Pointer contact already fired on touch down. Keep keyboard and assistive activation.
      if (event.detail !== 0) return;
      input.touchButtonDown(control);
      input.touchButtonUp(control);
    });
  }

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
      cabinet.classList.toggle('is-playing', snapshot.state === 'playing');
      touchDeck.classList.toggle('is-visible', snapshot.state === 'playing');
      if (snapshot.state !== 'playing') clearTouchButtons();
      startOverlay.hidden = snapshot.state !== 'ready';
      pauseOverlay.hidden = snapshot.state !== 'paused';
      gameOverOverlay.hidden = snapshot.state !== 'over';
      if (snapshot.state === 'over')
        finalScore.textContent = `Score ${snapshot.score} - Wave ${snapshot.wave}`;
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
  resumeButton.addEventListener('click', () => {
    game.resume();
    refreshInterface();
  });
  pauseButton.addEventListener('click', () => {
    game.togglePause();
    refreshInterface();
  });
  muteButton.addEventListener('click', () => {
    audioEngine.toggleMuted();
    try {
      audioEngine.effects.uiClick();
    } catch {
      /* audio is optional */
    }
    refreshInterface();
  });

  window.addEventListener('keydown', (event) => {
    audioEngine.handleUserGesture();
    if (event.code === 'Enter') {
      if (game.state === 'ready' || game.state === 'over') {
        event.preventDefault();
        startMission();
      } else if (game.state === 'paused') {
        event.preventDefault();
        game.resume();
        refreshInterface();
      }
    }
    if (event.code === 'KeyM') {
      audioEngine.toggleMuted();
      refreshInterface();
    }
  });
  window.addEventListener('blur', () => {
    if (game.state === 'playing') {
      game.pause();
      refreshInterface();
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game.state === 'playing') {
      game.pause();
      refreshInterface();
    }
  });

  input.attach(window);
  startLoop(
    (deltaSeconds) => {
      game.update(deltaSeconds, input);
    },
    () => {
      renderer.render(game.getRenderView());
      refreshInterface();
    },
  );
  refreshInterface();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
