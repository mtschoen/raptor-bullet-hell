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
  it('holding a direction button steers until it is released', () => {
    const input = new InputState();
    input.touchButtonDown('left');
    expect(input.axisX).toBe(-1);
    input.touchButtonUp('left');
    expect(input.axisX).toBe(0);
  });

  it('holding two direction buttons flies diagonally and releasing one keeps the other', () => {
    const input = new InputState();
    input.touchButtonDown('left');
    input.touchButtonDown('up');
    expect(input.axisX).toBe(-1);
    expect(input.axisY).toBe(-1);
    input.touchButtonUp('left');
    expect(input.axisX).toBe(0);
    expect(input.axisY).toBe(-1);
  });

  it('holding opposing directions cancels steering', () => {
    const input = new InputState();
    input.touchButtonDown('left');
    input.touchButtonDown('right');
    expect(input.axisX).toBe(0);
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

  it('combines keyboard and touch steering', () => {
    const input = new InputState();
    const target = new FakeEventTarget();
    input.attach(target);
    target.dispatch('keydown', keyboardEvent('ArrowRight'));
    expect(input.axisX).toBe(1);
    input.touchButtonDown('left');
    expect(input.axisX).toBe(0);
    input.touchButtonUp('left');
    expect(input.axisX).toBe(1);
    input.detach();
  });

  it('clears held touch buttons on blur', () => {
    const input = new InputState();
    const target = new FakeEventTarget();
    input.attach(target);
    input.touchButtonDown('left');
    input.touchButtonDown('fire');
    target.dispatch('blur', {});
    expect(input.axisX).toBe(0);
    expect(input.firing).toBe(false);
    input.detach();
  });

  it('clears held touch buttons on detach', () => {
    const input = new InputState();
    const target = new FakeEventTarget();
    input.attach(target);
    input.touchButtonDown('down');
    input.detach();
    expect(input.axisY).toBe(0);
  });
});
