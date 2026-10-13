import { describe, expect, it } from 'vitest';
import { InputState, type InputEventTarget } from '../src/engine/input';

class FakeEventTarget implements InputEventTarget {
  private listeners = new Map<string, Set<EventListener>>();

  addEventListener(type: string, listener: EventListener): void {
    const listeners = this.listeners.get(type) ?? new Set<EventListener>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: EventListener): void {
    this.listeners.get(type)?.delete(listener);
  }

  dispatch(type: string, event: unknown): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event as Event);
    }
  }
}

function keyboardEvent(code: string): unknown {
  return { code, repeat: false, preventDefault: () => undefined };
}

describe('touch controls', () => {
  it('steers proportionally to stick tilt', () => {
    const input = new InputState();
    input.setTouchSteering(0.5, -0.25);
    expect(input.axisX).toBeCloseTo(0.5);
    expect(input.axisY).toBeCloseTo(-0.25);
  });

  it('ignores stick tilt inside the dead zone', () => {
    const input = new InputState();
    input.setTouchSteering(0.05, -0.08);
    expect(input.axisX).toBe(0);
    expect(input.axisY).toBe(0);
  });

  it('clamps stick tilt beyond full deflection', () => {
    const input = new InputState();
    input.setTouchSteering(2, -3);
    expect(input.axisX).toBe(1);
    expect(input.axisY).toBe(-1);
  });

  it('stops steering when the stick is released', () => {
    const input = new InputState();
    input.setTouchSteering(-0.75, 0.5);
    input.clearTouchSteering();
    expect(input.axisX).toBe(0);
    expect(input.axisY).toBe(0);
  });

  it('combines keyboard and stick steering without exceeding full speed', () => {
    const input = new InputState();
    const target = new FakeEventTarget();
    input.attach(target);
    target.dispatch('keydown', keyboardEvent('ArrowRight'));
    expect(input.axisX).toBe(1);
    input.setTouchSteering(-0.5, 0);
    expect(input.axisX).toBeCloseTo(0.5);
    input.setTouchSteering(0.5, 0);
    expect(input.axisX).toBe(1);
    input.detach();
  });

  it('holding fire fires until it is released', () => {
    const input = new InputState();
    input.touchButtonDown('fire');
    expect(input.firing).toBe(true);
    input.touchButtonUp('fire');
    expect(input.firing).toBe(false);
  });

  it('tapping bomb queues one bomb press per tap', () => {
    const input = new InputState();
    input.touchButtonDown('bomb');
    expect(input.consumeBombPressed()).toBe(true);
    expect(input.consumeBombPressed()).toBe(false);
    input.touchButtonDown('bomb');
    expect(input.consumeBombPressed()).toBe(false);
    input.touchButtonUp('bomb');
    input.touchButtonDown('bomb');
    expect(input.consumeBombPressed()).toBe(true);
  });

  it('clears stick and buttons on blur', () => {
    const input = new InputState();
    const target = new FakeEventTarget();
    input.attach(target);
    input.setTouchSteering(-1, 0);
    input.touchButtonDown('fire');
    target.dispatch('blur', {});
    expect(input.axisX).toBe(0);
    expect(input.firing).toBe(false);
    input.detach();
  });

  it('clears stick on detach', () => {
    const input = new InputState();
    const target = new FakeEventTarget();
    input.attach(target);
    input.setTouchSteering(0, 1);
    input.detach();
    expect(input.axisY).toBe(0);
  });
});
