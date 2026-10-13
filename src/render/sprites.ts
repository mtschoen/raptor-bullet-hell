// Pre-rendered sprite cache: every sprite is painted once onto an offscreen
// canvas and then blitted by the renderer with drawImage each frame.
export type SpriteKind =
  'player' | 'fighter' | 'dive-bomber' | 'ace' | 'flak-barge' | 'boss' | 'tank' | 'flak-site';
export type BossDamageLevel = 0 | 1 | 2;
export interface PreRenderedSprite {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
}
const spriteDimensions: Record<SpriteKind, { width: number; height: number }> = {
  player: { width: 60, height: 68 },
  fighter: { width: 56, height: 60 },
  'dive-bomber': { width: 60, height: 64 },
  ace: { width: 58, height: 66 },
  'flak-barge': { width: 128, height: 80 },
  boss: { width: 200, height: 118 },
  tank: { width: 52, height: 56 },
  'flak-site': { width: 60, height: 52 },
};
const SPRITE_RESOLUTION_SCALE = 2;
const spriteCache = new Map<string, PreRenderedSprite>();
function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}
function createFallbackCanvas(width: number, height: number): HTMLCanvasElement {
  const gradient = { addColorStop: (): void => undefined };
  let canvasReference: unknown = null;
  const contextProxy = new Proxy(
    {},
    {
      get: (_target, property) => {
        if (property === 'createLinearGradient' || property === 'createRadialGradient')
          return () => gradient;
        if (property === 'canvas') return canvasReference;
        return (): undefined => undefined;
      },
      set: () => true,
    },
  );
  const canvas = {
    width,
    height,
    getContext: () => contextProxy,
    toDataURL: () => '',
  } as unknown as HTMLCanvasElement;
  canvasReference = canvas;
  return canvas;
}
function createSpriteCanvas(
  width: number,
  height: number,
): { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D } {
  if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (context !== null && context !== undefined) return { canvas, context };
    } catch {
      // Fall through to the fallback canvas below.
    }
  }
  if (typeof OffscreenCanvas !== 'undefined') {
    try {
      const offscreen = new OffscreenCanvas(width, height);
      const context = offscreen.getContext('2d');
      if (context !== null)
        return {
          canvas: offscreen as unknown as HTMLCanvasElement,
          context: context as unknown as CanvasRenderingContext2D,
        };
    } catch {
      // Fall through to the fallback canvas below.
    }
  }
  const canvas = createFallbackCanvas(width, height);
  return { canvas, context: canvas.getContext('2d') as CanvasRenderingContext2D };
}
function polygon(
  context: CanvasRenderingContext2D,
  points: readonly number[],
  fillStyle: string,
  _strokeStyle?: string,
  _lineWidth = 1.2,
): void {
  void _strokeStyle;
  void _lineWidth;
  context.fillStyle = fillStyle;
  context.beginPath();
  context.moveTo(points[0], points[1]);
  for (let index = 2; index < points.length; index += 2)
    context.lineTo(points[index], points[index + 1]);
  context.closePath();
  context.fill();
}
function ellipse(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radiusX: number,
  radiusY: number,
  fillStyle: string,
  rotation = 0,
): void {
  context.fillStyle = fillStyle;
  context.beginPath();
  context.ellipse(x, y, radiusX, radiusY, rotation, 0, Math.PI * 2);
  context.fill();
}
function rectangle(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  fillStyle: string,
): void {
  context.fillStyle = fillStyle;
  context.fillRect(x, y, width, height);
}
function line(
  context: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  strokeStyle: string,
  width = 1,
): void {
  context.strokeStyle = strokeStyle;
  context.lineWidth = width;
  context.beginPath();
  context.moveTo(x1, y1);
  context.lineTo(x2, y2);
  context.stroke();
}
function linearGradient(
  context: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  stops: readonly (readonly [number, string])[],
): CanvasGradient {
  const gradient = context.createLinearGradient(x1, y1, x2, y2);
  for (const [offset, color] of stops) gradient.addColorStop(offset, color);
  return gradient;
}
function drawPanelLines(
  context: CanvasRenderingContext2D,
  points: readonly (readonly [number, number, number, number])[],
  color = 'rgba(10, 14, 18, 0.16)',
): void {
  for (const [x1, y1, x2, y2] of points) line(context, x1, y1, x2, y2, color, 0.55);
}
function drawRivets(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  count: number,
  stepX: number,
  stepY: number,
): void {
  context.fillStyle = 'rgba(230, 238, 245, 0.28)';
  for (let index = 0; index < count; index += 1) {
    context.beginPath();
    context.arc(x + stepX * index, y + stepY * index, 0.65, 0, Math.PI * 2);
    context.fill();
  }
}
function drawCamouflageBlobs(
  context: CanvasRenderingContext2D,
  seed: number,
  centerX: number,
  centerY: number,
  spreadX: number,
  spreadY: number,
  colors: readonly string[],
  count = 9,
): void {
  const random = createSeededRandom(seed);
  for (let index = 0; index < count; index += 1) {
    const blobX = centerX + (random() - 0.5) * spreadX;
    const blobY = centerY + (random() - 0.5) * spreadY;
    const radiusX = 4 + random() * 7;
    const radiusY = 3 + random() * 5;
    const rotation = random() * 0.8 - 0.4;
    const color = colors[index % colors.length];
    context.save();
    context.globalAlpha = 0.35;
    context.shadowColor = color;
    context.shadowBlur = 6;
    ellipse(context, blobX, blobY, radiusX * 1.45, radiusY * 1.45, color, rotation);
    context.restore();
    context.save();
    context.globalAlpha = 0.55;
    ellipse(context, blobX + 1, blobY + 1, radiusX, radiusY, color, rotation);
    context.restore();
    context.save();
    context.globalAlpha = 0.7;
    ellipse(context, blobX - 0.7, blobY - 0.7, radiusX * 0.62, radiusY * 0.62, color, rotation);
    context.restore();
  }
}
function radialGradient(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  stops: readonly (readonly [number, string])[],
): CanvasGradient {
  const gradient = context.createRadialGradient(x, y, 0, x, y, Math.max(1, radius));
  for (const [offset, color] of stops) gradient.addColorStop(offset, color);
  return gradient;
}
function drawPainterlyShading(
  context: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  width: number,
  height: number,
): void {
  context.save();
  context.fillStyle = radialGradient(
    context,
    centerX - width * 0.28,
    centerY - height * 0.3,
    Math.max(width, height) * 0.75,
    [
      [0, 'rgba(255, 252, 235, 0.34)'],
      [0.45, 'rgba(255, 255, 255, 0.08)'],
      [1, 'rgba(255, 255, 255, 0)'],
    ],
  );
  context.beginPath();
  context.ellipse(
    centerX,
    centerY,
    Math.max(2, width / 2),
    Math.max(2, height / 2),
    0,
    0,
    Math.PI * 2,
  );
  context.fill();
  context.fillStyle = radialGradient(
    context,
    centerX + width * 0.34,
    centerY + height * 0.36,
    Math.max(width, height) * 0.8,
    [
      [0, 'rgba(8, 8, 10, 0.30)'],
      [0.55, 'rgba(8, 8, 10, 0.10)'],
      [1, 'rgba(8, 8, 10, 0)'],
    ],
  );
  context.beginPath();
  context.ellipse(
    centerX,
    centerY,
    Math.max(2, width / 2),
    Math.max(2, height / 2),
    0,
    0,
    Math.PI * 2,
  );
  context.fill();
  ellipse(
    context,
    centerX - width * 0.22,
    centerY - height * 0.3,
    Math.max(1.4, width * 0.16),
    Math.max(1, height * 0.08),
    'rgba(255, 255, 255, 0.38)',
    -0.5,
  );
  context.restore();
}
function drawWeathering(
  context: CanvasRenderingContext2D,
  seed: number,
  width: number,
  height: number,
  count = 12,
): void {
  const random = createSeededRandom(seed);
  for (let index = 0; index < count; index += 1) {
    const scratchX = random() * width;
    const scratchY = random() * height;
    line(
      context,
      scratchX,
      scratchY,
      scratchX + 3 + random() * 7,
      scratchY + (random() - 0.5) * 3,
      'rgba(205, 200, 185, 0.14)',
      0.55,
    );
  }
  for (let index = 0; index < 6; index += 1) {
    ellipse(
      context,
      random() * width,
      height * 0.55 + random() * height * 0.4,
      2 + random() * 4,
      1.4 + random() * 3,
      'rgba(28, 22, 16, 0.16)',
    );
  }
  for (let index = 0; index < 26; index += 1) {
    ellipse(
      context,
      random() * width,
      random() * height,
      0.7 + random() * 1.5,
      0.6 + random() * 1.2,
      random() < 0.5 ? 'rgba(20, 16, 10, 0.13)' : 'rgba(235, 228, 205, 0.12)',
    );
  }
}
function drawCanopy(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radiusX: number,
  radiusY: number,
): void {
  context.fillStyle = radialGradient(
    context,
    x - radiusX * 0.3,
    y - radiusY * 0.35,
    Math.max(radiusX, radiusY) * 1.5,
    [
      [0, '#3d6a86'],
      [0.45, '#162c3d'],
      [1, '#070e16'],
    ],
  );
  context.beginPath();
  context.ellipse(x, y, radiusX, radiusY, 0, 0, Math.PI * 2);
  context.fill();
  line(
    context,
    x - radiusX * 0.55,
    y + radiusY * 0.45,
    x + radiusX * 0.45,
    y - radiusY * 0.55,
    'rgba(190, 230, 250, 0.85)',
    1.6,
  );
  line(
    context,
    x - radiusX * 0.2,
    y + radiusY * 0.6,
    x + radiusX * 0.65,
    y - radiusY * 0.3,
    'rgba(190, 230, 250, 0.35)',
    1,
  );
}
function drawTurretDome(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  barrelAngle: number,
  barrelLength: number,
): void {
  context.save();
  context.translate(x, y);
  context.rotate(barrelAngle);
  rectangle(context, -1.6, 1, 3.2, barrelLength, '#17130f');
  rectangle(context, -2.4, barrelLength - 2, 4.8, 3, '#241d16');
  context.restore();
  context.fillStyle = radialGradient(context, x - radius * 0.3, y - radius * 0.3, radius * 1.7, [
    [0, '#a49a8c'],
    [0.55, '#6d675f'],
    [1, '#37312b'],
  ]);
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fill();
  ellipse(
    context,
    x - radius * 0.3,
    y - radius * 0.3,
    radius * 0.42,
    radius * 0.3,
    'rgba(240, 238, 230, 0.65)',
    -0.4,
  );
  ellipse(context, x, y, radius * 0.34, radius * 0.34, '#8c2f26');
}
function drawPropellerBlur(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
): void {
  ellipse(context, x, y, radius, radius * 0.3, 'rgba(225, 232, 238, 0.20)');
  ellipse(context, x, y, radius * 0.92, radius * 0.22, 'rgba(225, 232, 238, 0.14)');
  context.strokeStyle = 'rgba(240, 244, 248, 0.16)';
  context.lineWidth = 1;
  context.beginPath();
  context.ellipse(x, y, radius, radius * 0.3, 0, 0, Math.PI * 2);
  context.stroke();
  ellipse(context, x, y, 2.6, 2.6, '#191411');
  ellipse(context, x - 0.8, y - 0.8, 1, 1, 'rgba(255,255,255,0.7)');
}
function paintPlayer(context: CanvasRenderingContext2D, width: number, height: number): void {
  const centerX = width / 2;
  // Twin canted tails and delta wings, nose pointing up.
  polygon(
    context,
    [centerX - 7, 12, centerX - 12, 4, centerX - 9, 20, centerX - 4, 22],
    '#2b3542',
    '#7d8ea3',
    1,
  );
  polygon(
    context,
    [centerX + 7, 12, centerX + 12, 4, centerX + 9, 20, centerX + 4, 22],
    '#2b3542',
    '#7d8ea3',
    1,
  );
  polygon(
    context,
    [centerX - 5, 34, centerX - 27, 52, centerX - 26, 58, centerX - 7, 54, centerX - 4, 44],
    '#39485c',
    '#8fa5bd',
    1.1,
  );
  polygon(
    context,
    [centerX + 5, 34, centerX + 27, 52, centerX + 26, 58, centerX + 7, 54, centerX + 4, 44],
    '#39485c',
    '#8fa5bd',
    1.1,
  );
  line(context, centerX - 25, 52, centerX - 7, 38, 'rgba(190, 220, 245, 0.35)', 1);
  line(context, centerX + 25, 52, centerX + 7, 38, 'rgba(190, 220, 245, 0.35)', 1);
  const fuselage = linearGradient(context, centerX - 10, 0, centerX + 10, 0, [
    [0, '#202a36'],
    [0.38, '#5d7086'],
    [0.52, '#aebfd2'],
    [0.66, '#54687e'],
    [1, '#1a232f'],
  ]);
  context.fillStyle = fuselage;
  context.beginPath();
  context.moveTo(centerX, 3);
  context.lineTo(centerX + 5, 16);
  context.lineTo(centerX + 7, 38);
  context.lineTo(centerX + 6, 60);
  context.lineTo(centerX + 2, 60);
  context.lineTo(centerX, 50);
  context.lineTo(centerX - 2, 60);
  context.lineTo(centerX - 6, 60);
  context.lineTo(centerX - 7, 38);
  context.lineTo(centerX - 5, 16);
  context.closePath();
  context.fill();
  drawPainterlyShading(context, centerX, 32, 22, 52);
  line(context, centerX, 8, centerX, 48, 'rgba(235, 245, 255, 0.38)', 1.1);
  drawCanopy(context, centerX, 24, 4.2, 9);
  drawPanelLines(context, [
    [centerX - 6, 34, centerX + 6, 34],
    [centerX - 6, 46, centerX + 6, 46],
    [centerX - 18, 50, centerX - 8, 42],
    [centerX + 18, 50, centerX + 8, 42],
  ]);
  drawRivets(context, centerX - 5, 38, 3, 5, 0);
  drawRivets(context, centerX - 5, 56, 3, 5, 0);
  rectangle(context, centerX - 8, 58, 5, 5, '#59331d');
  rectangle(context, centerX + 3, 58, 5, 5, '#59331d');
  ellipse(context, centerX - 5, 62, 3.4, 2.2, 'rgba(30, 20, 12, 0.55)');
  ellipse(context, centerX + 5, 62, 3.4, 2.2, 'rgba(30, 20, 12, 0.55)');
  rectangle(context, centerX - 24, 53, 6, 2.4, 'rgba(200, 214, 228, 0.55)');
  rectangle(context, centerX + 18, 53, 6, 2.4, 'rgba(200, 214, 228, 0.55)');
  drawWeathering(context, 7101, width, height, 7);
}
function paintFighter(context: CanvasRenderingContext2D, width: number, height: number): void {
  const centerX = width / 2;
  // Nose pointing down-field.
  polygon(
    context,
    [
      centerX,
      57,
      centerX + 5,
      44,
      centerX + 24,
      26,
      centerX + 25,
      19,
      centerX + 8,
      24,
      centerX + 6,
      10,
      centerX + 10,
      4,
      centerX - 10,
      4,
      centerX - 6,
      10,
      centerX - 8,
      24,
      centerX - 25,
      19,
      centerX - 24,
      26,
      centerX - 5,
      44,
    ],
    '#5a683a',
    '#c9cf9e',
    1.1,
  );
  drawCamouflageBlobs(
    context,
    1207,
    centerX,
    30,
    34,
    34,
    ['rgba(74, 88, 44, 0.85)', 'rgba(112, 116, 66, 0.8)', 'rgba(58, 66, 34, 0.85)'],
    10,
  );
  rectangle(context, centerX - 24, 21, 48, 3, '#e8e2c2');
  rectangle(context, centerX - 24, 25, 48, 1.4, 'rgba(60, 50, 30, 0.5)');
  const fuselage = linearGradient(context, centerX - 7, 0, centerX + 7, 0, [
    [0, '#48542e'],
    [0.45, '#87936a'],
    [0.55, '#a9b184'],
    [1, '#3c4826'],
  ]);
  context.fillStyle = fuselage;
  context.beginPath();
  context.moveTo(centerX, 58);
  context.lineTo(centerX + 5, 42);
  context.lineTo(centerX + 5, 12);
  context.lineTo(centerX + 3, 4);
  context.lineTo(centerX - 3, 4);
  context.lineTo(centerX - 5, 12);
  context.lineTo(centerX - 5, 42);
  context.closePath();
  context.fill();
  drawPainterlyShading(context, centerX, 31, 24, 48);
  ellipse(context, centerX, 49, 5, 4, '#a52a20');
  ellipse(context, centerX, 50.5, 3.4, 2.4, '#c8402f');
  drawCanopy(context, centerX, 34, 3.8, 7);
  drawPanelLines(context, [
    [centerX - 5, 20, centerX + 5, 20],
    [centerX - 20, 27, centerX - 7, 31],
    [centerX + 20, 27, centerX + 7, 31],
  ]);
  drawRivets(context, centerX - 4, 14, 3, 4, 0);
  ellipse(context, centerX - 3, 8, 2.2, 4.5, 'rgba(30, 26, 18, 0.45)', 0.3);
  ellipse(context, centerX + 3, 8, 2.2, 4.5, 'rgba(30, 26, 18, 0.45)', -0.3);
  drawPropellerBlur(context, centerX, 55, 15);
  drawWeathering(context, 2213, width, height, 8);
}
function paintDiveBomber(context: CanvasRenderingContext2D, width: number, height: number): void {
  const centerX = width / 2;
  polygon(
    context,
    [
      centerX,
      61,
      centerX + 5,
      47,
      centerX + 13,
      40,
      centerX + 27,
      30,
      centerX + 28,
      23,
      centerX + 10,
      27,
      centerX + 6,
      12,
      centerX + 11,
      5,
      centerX - 11,
      5,
      centerX - 6,
      12,
      centerX - 10,
      27,
      centerX - 28,
      23,
      centerX - 27,
      30,
      centerX - 13,
      40,
      centerX - 5,
      47,
    ],
    '#4d5a52',
    '#c8cec2',
    1.1,
  );
  drawCamouflageBlobs(
    context,
    3301,
    centerX,
    32,
    38,
    36,
    ['rgba(56, 70, 60, 0.8)', 'rgba(96, 106, 88, 0.75)'],
    7,
  );
  rectangle(context, centerX - 27, 26, 54, 3.4, '#d9a81c');
  ellipse(context, centerX - 14, 18, 3.6, 6, '#333a35', 0.25);
  ellipse(context, centerX + 14, 18, 3.6, 6, '#333a35', -0.25);
  ellipse(context, centerX - 14, 18, 2, 3.4, '#59645c', 0.25);
  ellipse(context, centerX + 14, 18, 2, 3.4, '#59645c', -0.25);
  const fuselage = linearGradient(context, centerX - 7, 0, centerX + 7, 0, [
    [0, '#37423c'],
    [0.5, '#77847a'],
    [1, '#2e3833'],
  ]);
  context.fillStyle = fuselage;
  context.beginPath();
  context.moveTo(centerX, 62);
  context.lineTo(centerX + 6, 44);
  context.lineTo(centerX + 6, 12);
  context.lineTo(centerX + 3, 4);
  context.lineTo(centerX - 3, 4);
  context.lineTo(centerX - 6, 12);
  context.lineTo(centerX - 6, 44);
  context.closePath();
  context.fill();
  drawPainterlyShading(context, centerX, 33, 24, 50);
  drawCanopy(context, centerX, 36, 4.2, 8);
  drawPanelLines(context, [
    [centerX - 6, 22, centerX + 6, 22],
    [centerX - 6, 48, centerX + 6, 48],
  ]);
  drawRivets(context, centerX - 4, 16, 3, 4, 0);
  ellipse(context, centerX, 57, 5.2, 3.4, '#14181a');
  drawPropellerBlur(context, centerX, 58, 13);
  drawWeathering(context, 4417, width, height, 9);
}
function paintAce(context: CanvasRenderingContext2D, width: number, height: number): void {
  const centerX = width / 2;
  polygon(
    context,
    [centerX - 4, 8, centerX - 24, 22, centerX - 25, 29, centerX - 8, 27, centerX - 6, 14],
    '#3a2024',
    '#c98a8a',
    1,
  );
  polygon(
    context,
    [centerX + 4, 8, centerX + 24, 22, centerX + 25, 29, centerX + 8, 27, centerX + 6, 14],
    '#3a2024',
    '#c98a8a',
    1,
  );
  polygon(
    context,
    [centerX - 5, 38, centerX - 23, 52, centerX - 22, 58, centerX - 7, 52],
    '#46262a',
    '#d59a9a',
    1,
  );
  polygon(
    context,
    [centerX + 5, 38, centerX + 23, 52, centerX + 22, 58, centerX + 7, 52],
    '#46262a',
    '#d59a9a',
    1,
  );
  const fuselage = linearGradient(context, centerX - 9, 0, centerX + 9, 0, [
    [0, '#241a1e'],
    [0.4, '#5c4a4e'],
    [0.52, '#c2b2b4'],
    [0.64, '#6b555a'],
    [1, '#1c1418'],
  ]);
  context.fillStyle = fuselage;
  context.beginPath();
  context.moveTo(centerX, 63);
  context.lineTo(centerX + 4, 46);
  context.lineTo(centerX + 6, 18);
  context.lineTo(centerX + 4, 5);
  context.lineTo(centerX, 10);
  context.lineTo(centerX - 4, 5);
  context.lineTo(centerX - 6, 18);
  context.lineTo(centerX - 6, 46);
  context.lineTo(centerX - 4, 60);
  context.closePath();
  context.fill();
  drawPainterlyShading(context, centerX, 34, 22, 52);
  polygon(context, [centerX, 63, centerX + 3.4, 50, centerX - 3.4, 50], '#c0271e', '#f0a0a0', 0.8);
  rectangle(context, centerX - 22, 24, 44, 3, '#b0231c');
  line(context, centerX, 14, centerX, 48, 'rgba(255, 235, 235, 0.8)', 1.5);
  drawCanopy(context, centerX, 34, 3.8, 8);
  drawPanelLines(
    context,
    [
      [centerX - 6, 24, centerX + 6, 24],
      [centerX - 5, 44, centerX + 5, 44],
    ],
    'rgba(20, 10, 12, 0.55)',
  );
  drawRivets(context, centerX - 4, 28, 3, 4, 0);
  rectangle(context, centerX - 7, 6, 4, 5, '#7e1d18');
  rectangle(context, centerX + 3, 6, 4, 5, '#7e1d18');
  drawWeathering(context, 5519, width, height, 7);
}
function paintFlakBarge(context: CanvasRenderingContext2D, width: number, height: number): void {
  const centerX = width / 2;
  const centerY = height / 2;
  polygon(
    context,
    [
      centerX,
      76,
      centerX + 14,
      58,
      centerX + 58,
      46,
      centerX + 62,
      36,
      centerX + 20,
      38,
      centerX + 12,
      12,
      centerX - 12,
      12,
      centerX - 20,
      38,
      centerX - 62,
      36,
      centerX - 58,
      46,
      centerX - 14,
      58,
    ],
    '#4a423c',
    '#d8d0c4',
    1.4,
  );
  drawCamouflageBlobs(
    context,
    6613,
    centerX,
    centerY,
    90,
    42,
    ['rgba(70, 62, 48, 0.7)', 'rgba(96, 88, 70, 0.65)'],
    8,
  );
  rectangle(context, centerX - 46, 14, 18, 44, '#554c44');
  rectangle(context, centerX + 28, 14, 18, 44, '#554c44');
  rectangle(context, centerX - 46, 14, 18, 6, '#6b6156');
  rectangle(context, centerX + 28, 14, 18, 6, '#6b6156');
  drawPropellerBlur(context, centerX - 37, 62, 13);
  drawPropellerBlur(context, centerX + 37, 62, 13);
  const fuselage = linearGradient(context, centerX - 16, 0, centerX + 16, 0, [
    [0, '#2c2723'],
    [0.42, '#6e655c'],
    [0.54, '#a79c90'],
    [0.68, '#5d554d'],
    [1, '#211d1a'],
  ]);
  context.fillStyle = fuselage;
  context.beginPath();
  context.ellipse(centerX, centerY + 4, 15, 34, 0, 0, Math.PI * 2);
  context.fill();
  drawPainterlyShading(context, centerX, centerY + 4, 38, 62);
  ellipse(context, centerX, 70, 8, 6, '#24333e');
  line(context, centerX - 5, 66, centerX + 5, 73, 'rgba(190, 230, 250, 0.8)', 1.4);
  drawPanelLines(
    context,
    [
      [centerX - 58, 42, centerX + 58, 42],
      [centerX - 34, 26, centerX + 34, 26],
      [centerX, 8, centerX, 68],
    ],
    'rgba(18, 14, 10, 0.5)',
  );
  drawRivets(context, centerX - 12, 22, 5, 6, 0);
  drawRivets(context, centerX - 12, 52, 5, 6, 0);
  rectangle(context, centerX - 7, 30, 14, 12, 'rgba(140, 40, 32, 0.75)');
  drawTurretDome(context, centerX - 28, 30, 6, 0.6, 11);
  drawTurretDome(context, centerX + 28, 30, 6, -0.6, 11);
  drawTurretDome(context, centerX, 52, 6.5, 0, 12);
  drawWeathering(context, 7727, width, height, 14);
}
function paintBoss(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  damageLevel: BossDamageLevel,
): void {
  const centerX = width / 2;
  polygon(
    context,
    [
      centerX,
      112,
      centerX + 20,
      78,
      centerX + 92,
      62,
      centerX + 98,
      48,
      centerX + 30,
      52,
      centerX + 20,
      18,
      centerX - 20,
      18,
      centerX - 30,
      52,
      centerX - 98,
      48,
      centerX - 92,
      62,
      centerX - 20,
      78,
    ],
    '#33302e',
    '#d8b8b0',
    1.8,
  );
  drawCamouflageBlobs(
    context,
    8839,
    centerX,
    58,
    150,
    62,
    ['rgba(52, 48, 44, 0.75)', 'rgba(88, 80, 72, 0.65)'],
    12,
  );
  rectangle(context, centerX - 62, 24, 24, 52, '#453f3a');
  rectangle(context, centerX + 38, 24, 24, 52, '#453f3a');
  drawPropellerBlur(context, centerX - 50, 80, 16);
  drawPropellerBlur(context, centerX + 50, 80, 16);
  drawPropellerBlur(context, centerX - 78, 58, 12);
  drawPropellerBlur(context, centerX + 78, 58, 12);
  const fuselage = linearGradient(context, centerX - 22, 0, centerX + 22, 0, [
    [0, '#211e1c'],
    [0.4, '#5d5752'],
    [0.52, '#a89e96'],
    [0.66, '#4c4642'],
    [1, '#171414'],
  ]);
  context.fillStyle = fuselage;
  context.beginPath();
  context.ellipse(centerX, 60, 21, 52, 0, 0, Math.PI * 2);
  context.fill();
  drawPainterlyShading(context, centerX, 60, 52, 92);
  ellipse(context, centerX, 104, 11, 8, '#24333e');
  line(context, centerX - 7, 99, centerX + 7, 108, 'rgba(190, 230, 250, 0.85)', 1.8);
  rectangle(context, centerX - 38, 46, 76, 20, 'rgba(145, 28, 24, 0.85)');
  drawPanelLines(
    context,
    [
      [centerX - 92, 56, centerX + 92, 56],
      [centerX - 48, 34, centerX + 48, 34],
      [centerX - 48, 84, centerX + 48, 84],
      [centerX, 12, centerX, 106],
    ],
    'rgba(15, 12, 10, 0.55)',
  );
  drawRivets(context, centerX - 18, 28, 7, 6, 0);
  drawRivets(context, centerX - 18, 76, 7, 6, 0);
  drawRivets(context, centerX - 18, 94, 7, 6, 0);
  drawTurretDome(context, centerX - 58, 44, 7, 0.5, 13);
  drawTurretDome(context, centerX + 58, 44, 7, -0.5, 13);
  drawTurretDome(context, centerX - 24, 30, 6.5, 0.25, 12);
  drawTurretDome(context, centerX + 24, 30, 6.5, -0.25, 12);
  drawTurretDome(context, centerX, 66, 7.5, 0, 14);
  ellipse(context, centerX, 58, 8, 8, '#d8a098');
  ellipse(context, centerX - 2, 55, 3, 3, 'rgba(255,255,255,0.65)');
  drawWeathering(context, 9949, width, height, 20);
  if (damageLevel >= 1) {
    ellipse(context, centerX - 34, 36, 16, 9, 'rgba(22, 16, 12, 0.55)', 0.3);
    ellipse(context, centerX + 48, 66, 13, 8, 'rgba(22, 16, 12, 0.5)', -0.2);
    ellipse(context, centerX - 12, 84, 10, 6, 'rgba(40, 32, 24, 0.55)');
    rectangle(context, centerX - 58, 50, 22, 3, 'rgba(20, 14, 10, 0.6)');
  }
  if (damageLevel >= 2) {
    ellipse(context, centerX + 22, 28, 20, 11, 'rgba(16, 10, 8, 0.68)', -0.3);
    ellipse(context, centerX - 52, 72, 18, 10, 'rgba(16, 10, 8, 0.62)', 0.2);
    ellipse(context, centerX, 48, 15, 14, 'rgba(30, 18, 10, 0.55)');
    ellipse(context, centerX - 70, 44, 9, 6, 'rgba(90, 40, 18, 0.5)');
    line(context, centerX - 80, 62, centerX - 30, 50, 'rgba(12, 8, 6, 0.7)', 2);
    line(context, centerX + 84, 58, centerX + 34, 70, 'rgba(12, 8, 6, 0.7)', 2);
  }
}
function paintTank(context: CanvasRenderingContext2D, width: number, height: number): void {
  const centerX = width / 2;
  const centerY = height / 2;
  context.fillStyle = linearGradient(context, 7, 5, width - 7, height - 5, [
    [0, '#5a6b36'],
    [0.5, '#46522e'],
    [1, '#2c361e'],
  ]);
  context.beginPath();
  if (typeof context.roundRect === 'function') context.roundRect(7, 5, width - 14, height - 10, 7);
  else context.rect(7, 5, width - 14, height - 10);
  context.fill();
  drawPainterlyShading(context, centerX, centerY, width - 16, height - 12);
  drawCamouflageBlobs(
    context,
    11027,
    centerX,
    centerY,
    30,
    36,
    ['rgba(84, 96, 52, 0.85)', 'rgba(58, 66, 36, 0.85)', 'rgba(110, 116, 72, 0.7)'],
    9,
  );
  rectangle(context, 5, 5, 8, height - 10, '#20261a');
  rectangle(context, width - 13, 5, 8, height - 10, '#20261a');
  for (let tread = 8; tread < height - 6; tread += 6) {
    line(context, 5, tread, 13, tread, 'rgba(210, 208, 170, 0.65)', 1.2);
    line(context, width - 13, tread, width - 5, tread, 'rgba(210, 208, 170, 0.65)', 1.2);
  }
  ellipse(context, centerX - 9, centerY - 12, 4.5, 4.5, 'rgba(52, 62, 34, 0.8)');
  ellipse(context, centerX + 10, centerY + 11, 5.5, 5.5, 'rgba(52, 62, 34, 0.8)');
  rectangle(context, centerX - 2.2, centerY + 1, 4.4, 24, '#242e18');
  rectangle(context, centerX - 3, centerY + 22, 6, 4, '#171f10');
  context.fillStyle = radialGradient(context, centerX - 3, centerY - 3, 16, [
    [0, '#93a45e'],
    [0.55, '#67763f'],
    [1, '#39451f'],
  ]);
  context.beginPath();
  context.arc(centerX, centerY, 11, 0, Math.PI * 2);
  context.fill();
  ellipse(context, centerX - 3, centerY - 3, 4, 3, 'rgba(235, 238, 200, 0.55)', -0.4);
  ellipse(context, centerX, centerY, 4, 4, '#1d2514');
  const random = createSeededRandom(12301);
  context.fillStyle = 'rgba(72, 58, 38, 0.6)';
  for (let index = 0; index < 14; index += 1) {
    context.beginPath();
    context.arc(
      8 + random() * (width - 16),
      6 + random() * (height - 12),
      0.9 + random() * 1.2,
      0,
      Math.PI * 2,
    );
    context.fill();
  }
}
function paintFlakSite(context: CanvasRenderingContext2D, width: number, height: number): void {
  const centerX = width / 2;
  const centerY = height / 2;
  context.fillStyle = linearGradient(context, 5, 7, width - 5, height - 7, [
    [0, '#8b857e'],
    [0.5, '#6f6a64'],
    [1, '#47423d'],
  ]);
  context.beginPath();
  if (typeof context.roundRect === 'function') context.roundRect(5, 7, width - 10, height - 14, 6);
  else context.rect(5, 7, width - 10, height - 14);
  context.fill();
  drawPainterlyShading(context, centerX, centerY, width - 12, height - 16);
  context.strokeStyle = 'rgba(230, 226, 218, 0.22)';
  context.beginPath();
  context.arc(centerX, centerY, 19, 0, Math.PI * 2);
  context.stroke();
  context.beginPath();
  context.arc(centerX, centerY, 13, 0, Math.PI * 2);
  context.stroke();
  for (let bag = 0; bag < 5; bag += 1) {
    ellipse(context, 11 + bag * 9.5, height - 9, 5.4, 3.6, '#9d968c');
    ellipse(context, 11 + bag * 9.5, 9, 5.4, 3.6, '#8d867e');
  }
  drawPanelLines(
    context,
    [
      [8, centerY - 8, 22, centerY - 8],
      [width - 22, centerY + 8, width - 8, centerY + 8],
    ],
    'rgba(30, 26, 22, 0.5)',
  );
  rectangle(context, centerX - 13, centerY - 7, 26, 15, '#403c38');
  rectangle(context, centerX - 7, centerY + 3, 4, 17, '#17130f');
  rectangle(context, centerX + 3, centerY + 3, 4, 17, '#17130f');
  rectangle(context, centerX - 8, centerY + 18, 5.5, 3, '#0f0d0b');
  rectangle(context, centerX + 2.5, centerY + 18, 5.5, 3, '#0f0d0b');
  context.fillStyle = radialGradient(context, centerX - 3, centerY - 3, 13, [
    [0, '#8d8378'],
    [0.55, '#554e48'],
    [1, '#2e2a26'],
  ]);
  context.beginPath();
  context.arc(centerX, centerY, 9, 0, Math.PI * 2);
  context.fill();
  ellipse(context, centerX - 3, centerY - 3, 3.4, 2.6, 'rgba(240, 235, 228, 0.6)', -0.4);
  drawWeathering(context, 13411, width, height, 8);
}
function paintSprite(
  kind: SpriteKind,
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  damageLevel: BossDamageLevel,
): void {
  if (kind === 'player') paintPlayer(context, width, height);
  else if (kind === 'fighter') paintFighter(context, width, height);
  else if (kind === 'dive-bomber') paintDiveBomber(context, width, height);
  else if (kind === 'ace') paintAce(context, width, height);
  else if (kind === 'flak-barge') paintFlakBarge(context, width, height);
  else if (kind === 'boss') paintBoss(context, width, height, damageLevel);
  else if (kind === 'tank') paintTank(context, width, height);
  else paintFlakSite(context, width, height);
}
export function getSprite(kind: SpriteKind, damageLevel: BossDamageLevel = 0): PreRenderedSprite {
  const effectiveDamageLevel: BossDamageLevel = kind === 'boss' ? damageLevel : 0;
  const cacheKey = kind === 'boss' ? `boss:${effectiveDamageLevel}` : kind;
  const cached = spriteCache.get(cacheKey);
  if (cached !== undefined) return cached;
  const dimensions = spriteDimensions[kind];
  const canvasWidth = dimensions.width * SPRITE_RESOLUTION_SCALE;
  const canvasHeight = dimensions.height * SPRITE_RESOLUTION_SCALE;
  const { canvas, context } = createSpriteCanvas(canvasWidth, canvasHeight);
  context.save();
  context.scale(SPRITE_RESOLUTION_SCALE, SPRITE_RESOLUTION_SCALE);
  paintSprite(kind, context, dimensions.width, dimensions.height, effectiveDamageLevel);
  context.restore();
  const sprite: PreRenderedSprite = { canvas, width: canvasWidth, height: canvasHeight };
  spriteCache.set(cacheKey, sprite);
  return sprite;
}
export function getBossSprite(healthFraction: number): PreRenderedSprite {
  return getSprite('boss', getBossDamageLevel(healthFraction));
}
export function getBossDamageLevel(healthFraction: number): BossDamageLevel {
  const clampedFraction = Math.min(1, Math.max(0, healthFraction));
  return clampedFraction < 0.33 ? 2 : clampedFraction < 0.66 ? 1 : 0;
}
export function preloadSprites(): void {
  const kinds: readonly SpriteKind[] = [
    'player',
    'fighter',
    'dive-bomber',
    'ace',
    'flak-barge',
    'tank',
    'flak-site',
  ];
  for (const kind of kinds) getSprite(kind);
  getSprite('boss', 0);
  getSprite('boss', 1);
  getSprite('boss', 2);
}
export function clearSpriteCache(): void {
  spriteCache.clear();
}
export function getSpriteCacheSize(): number {
  return spriteCache.size;
}
export function getSpriteDimensions(kind: SpriteKind): { width: number; height: number } {
  return spriteDimensions[kind];
}
