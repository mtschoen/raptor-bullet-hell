import { describe, expect, it } from 'vitest';
import { circlesOverlap } from '../src/engine/collision';

describe('circlesOverlap', () => {
  it('detects overlap and separation', () => {
    expect(circlesOverlap(0, 0, 10, 15, 0, 10)).toBe(true);
    expect(circlesOverlap(0, 0, 10, 25, 0, 10)).toBe(false);
  });

  it('treats a graze inside the combined radius as a hit', () => {
    expect(circlesOverlap(100, 100, 6, 100, 111, 6)).toBe(true);
    expect(circlesOverlap(100, 100, 6, 100, 113, 6)).toBe(false);
  });
});
