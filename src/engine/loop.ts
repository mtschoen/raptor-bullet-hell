export type UpdateFunction = (deltaSeconds: number) => void;
export type RenderFunction = (deltaSeconds: number) => void;
export type StopLoopFunction = () => void;

export interface FrameScheduler {
  requestFrame(callback: (timestampMilliseconds: number) => void): number;
  cancelFrame(frameIdentifier: number): void;
}

export const MAXIMUM_DELTA_SECONDS = 1 / 30;

const defaultFrameScheduler: FrameScheduler = {
  requestFrame(callback: (timestampMilliseconds: number) => void): number {
    if (typeof requestAnimationFrame !== 'function') {
      throw new Error('requestAnimationFrame is not available in this environment');
    }
    return requestAnimationFrame(callback);
  },
  cancelFrame(frameIdentifier: number): void {
    if (typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(frameIdentifier);
    }
  },
};

export function startLoop(
  update: UpdateFunction,
  render: RenderFunction,
  frameScheduler: FrameScheduler = defaultFrameScheduler,
): StopLoopFunction {
  let stopped = false;
  let frameIdentifier: number | null = null;
  let previousTimestampMilliseconds: number | null = null;

  const runFrame = (timestampMilliseconds: number): void => {
    if (stopped) {
      return;
    }
    let deltaSeconds = 0;
    if (previousTimestampMilliseconds !== null) {
      deltaSeconds = (timestampMilliseconds - previousTimestampMilliseconds) / 1000;
    }
    previousTimestampMilliseconds = timestampMilliseconds;
    if (deltaSeconds < 0) {
      deltaSeconds = 0;
    }
    if (deltaSeconds > MAXIMUM_DELTA_SECONDS) {
      deltaSeconds = MAXIMUM_DELTA_SECONDS;
    }
    update(deltaSeconds);
    if (stopped) {
      return;
    }
    render(deltaSeconds);
    if (stopped) {
      return;
    }
    frameIdentifier = frameScheduler.requestFrame(runFrame);
  };

  frameIdentifier = frameScheduler.requestFrame(runFrame);

  return function stop(): void {
    if (stopped) {
      return;
    }
    stopped = true;
    if (frameIdentifier !== null) {
      frameScheduler.cancelFrame(frameIdentifier);
      frameIdentifier = null;
    }
  };
}
