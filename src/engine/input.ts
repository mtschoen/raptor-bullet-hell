import type { Vec2 } from '../game/types';

export interface InputEventTarget {
  addEventListener(
    type: string,
    listener: EventListener,
    options?: boolean | AddEventListenerOptions,
  ): void;
  removeEventListener(
    type: string,
    listener: EventListener,
    options?: boolean | EventListenerOptions,
  ): void;
}

const GAME_CODES = new Set([
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'KeyA',
  'KeyD',
  'KeyW',
  'KeyS',
  'Space',
  'ShiftLeft',
  'ShiftRight',
  'KeyP',
  'Escape',
]);

export type TouchControl = 'left' | 'right' | 'up' | 'down' | 'fire' | 'bomb';

export class InputState {
  private attachedTarget: InputEventTarget | null = null;
  private pressedCodes = new Set<string>();
  private touchDirections = new Set<TouchControl>();
  private touchFiring = false;
  private touchBombIsHeld = false;
  private pendingBombPressed = false;
  private pendingPausedPressed = false;
  private currentPointerTarget: Vec2 | null = null;
  private pointerIsDown = false;
  private pointerSteeringIsActive = false;

  private handleKeyDown = (event: Event): void => {
    const keyboardEvent = event as KeyboardEvent;
    const code = keyboardEvent.code;
    if (GAME_CODES.has(code) && typeof keyboardEvent.preventDefault === 'function') {
      keyboardEvent.preventDefault();
    }
    if (!keyboardEvent.repeat) {
      if (code === 'ShiftLeft' || code === 'ShiftRight') {
        this.pendingBombPressed = true;
      }
      if (code === 'KeyP' || code === 'Escape') {
        this.pendingPausedPressed = true;
      }
    }
    this.pressedCodes.add(code);
  };

  private handleKeyUp = (event: Event): void => {
    const keyboardEvent = event as KeyboardEvent;
    this.pressedCodes.delete(keyboardEvent.code);
  };

  private handleBlur = (): void => {
    this.pressedCodes.clear();
    this.clearTouchButtons();
    this.pointerIsDown = false;
    this.pointerSteeringIsActive = false;
  };

  private clearTouchButtons(): void {
    this.touchDirections.clear();
    this.touchFiring = false;
    this.touchBombIsHeld = false;
  }

  touchButtonDown(control: TouchControl): void {
    if (control === 'fire') {
      this.touchFiring = true;
      return;
    }
    if (control === 'bomb') {
      if (!this.touchBombIsHeld) {
        this.touchBombIsHeld = true;
        this.pendingBombPressed = true;
      }
      return;
    }
    this.touchDirections.add(control);
  }

  touchButtonUp(control: TouchControl): void {
    if (control === 'fire') {
      this.touchFiring = false;
      return;
    }
    if (control === 'bomb') {
      this.touchBombIsHeld = false;
      return;
    }
    this.touchDirections.delete(control);
  }

  private handlePointerDown = (event: Event): void => {
    const pointerEvent = event as PointerEvent;
    this.currentPointerTarget = { x: pointerEvent.clientX, y: pointerEvent.clientY };
    this.pointerIsDown = true;
    this.pointerSteeringIsActive = true;
  };

  private handlePointerMove = (event: Event): void => {
    if (!this.pointerIsDown) {
      return;
    }
    const pointerEvent = event as PointerEvent;
    this.currentPointerTarget = { x: pointerEvent.clientX, y: pointerEvent.clientY };
    this.pointerSteeringIsActive = true;
  };

  private handlePointerUp = (): void => {
    this.pointerIsDown = false;
    this.pointerSteeringIsActive = false;
  };

  attach(target?: InputEventTarget | Window): void {
    const resolvedTarget =
      target ?? (typeof window !== 'undefined' ? (window as unknown as InputEventTarget) : null);
    if (resolvedTarget === null) {
      throw new Error('InputState.attach requires a window or event target');
    }
    if (this.attachedTarget === resolvedTarget) {
      return;
    }
    this.detach();
    this.attachedTarget = resolvedTarget as InputEventTarget;
    this.attachedTarget.addEventListener('keydown', this.handleKeyDown);
    this.attachedTarget.addEventListener('keyup', this.handleKeyUp);
    this.attachedTarget.addEventListener('blur', this.handleBlur);
    this.attachedTarget.addEventListener('pointerdown', this.handlePointerDown);
    this.attachedTarget.addEventListener('pointermove', this.handlePointerMove);
    this.attachedTarget.addEventListener('pointerup', this.handlePointerUp);
    this.attachedTarget.addEventListener('pointercancel', this.handlePointerUp);
  }

  detach(): void {
    if (this.attachedTarget === null) {
      return;
    }
    this.attachedTarget.removeEventListener('keydown', this.handleKeyDown);
    this.attachedTarget.removeEventListener('keyup', this.handleKeyUp);
    this.attachedTarget.removeEventListener('blur', this.handleBlur);
    this.attachedTarget.removeEventListener('pointerdown', this.handlePointerDown);
    this.attachedTarget.removeEventListener('pointermove', this.handlePointerMove);
    this.attachedTarget.removeEventListener('pointerup', this.handlePointerUp);
    this.attachedTarget.removeEventListener('pointercancel', this.handlePointerUp);
    this.attachedTarget = null;
    this.pressedCodes.clear();
    this.clearTouchButtons();
    this.pendingBombPressed = false;
    this.pendingPausedPressed = false;
    this.currentPointerTarget = null;
    this.pointerIsDown = false;
    this.pointerSteeringIsActive = false;
  }

  get attached(): boolean {
    return this.attachedTarget !== null;
  }

  get axisX(): number {
    const left =
      this.pressedCodes.has('ArrowLeft') ||
      this.pressedCodes.has('KeyA') ||
      this.touchDirections.has('left')
        ? 1
        : 0;
    const right =
      this.pressedCodes.has('ArrowRight') ||
      this.pressedCodes.has('KeyD') ||
      this.touchDirections.has('right')
        ? 1
        : 0;
    return right - left;
  }

  get axisY(): number {
    const up =
      this.pressedCodes.has('ArrowUp') ||
      this.pressedCodes.has('KeyW') ||
      this.touchDirections.has('up')
        ? 1
        : 0;
    const down =
      this.pressedCodes.has('ArrowDown') ||
      this.pressedCodes.has('KeyS') ||
      this.touchDirections.has('down')
        ? 1
        : 0;
    return down - up;
  }

  get firing(): boolean {
    return this.pressedCodes.has('Space') || this.touchFiring;
  }

  get bombPressed(): boolean {
    const wasPressed = this.pendingBombPressed;
    this.pendingBombPressed = false;
    return wasPressed;
  }

  get pausedPressed(): boolean {
    const wasPressed = this.pendingPausedPressed;
    this.pendingPausedPressed = false;
    return wasPressed;
  }

  get pausePressed(): boolean {
    return this.pausedPressed;
  }

  get pointerTarget(): Vec2 | null {
    if (!this.pointerSteeringIsActive || this.currentPointerTarget === null) {
      return null;
    }
    return { x: this.currentPointerTarget.x, y: this.currentPointerTarget.y };
  }

  get steerTarget(): Vec2 | null {
    return this.pointerTarget;
  }

  get pointerPosition(): Vec2 | null {
    if (this.currentPointerTarget === null) {
      return null;
    }
    return { x: this.currentPointerTarget.x, y: this.currentPointerTarget.y };
  }

  get pointerX(): number | null {
    return this.currentPointerTarget === null ? null : this.currentPointerTarget.x;
  }

  get pointerY(): number | null {
    return this.currentPointerTarget === null ? null : this.currentPointerTarget.y;
  }

  get pointerDown(): boolean {
    return this.pointerIsDown;
  }

  get touchSteering(): boolean {
    return this.pointerSteeringIsActive;
  }

  get hasSteerTarget(): boolean {
    return this.pointerSteeringIsActive && this.currentPointerTarget !== null;
  }

  consumeBombPressed(): boolean {
    return this.bombPressed;
  }

  consumePausedPressed(): boolean {
    return this.pausedPressed;
  }

  clearPressedEdges(): void {
    this.pendingBombPressed = false;
    this.pendingPausedPressed = false;
  }
}
