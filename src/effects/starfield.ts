export interface StarfieldItemView {
  x: number;
  y: number;
  size: number;
  alpha: number;
  layer: number;
}

export interface StarfieldLayerDefinition {
  count: number;
  speedFactor: number;
  size: number;
  alpha: number;
}

export interface ParallaxFieldOptions {
  seed?: number;
  layers?: readonly StarfieldLayerDefinition[];
}

const defaultLayers: readonly StarfieldLayerDefinition[] = [
  { count: 42, speedFactor: 0.25, size: 1.5, alpha: 0.45 },
  { count: 30, speedFactor: 0.55, size: 2.5, alpha: 0.7 },
  { count: 18, speedFactor: 1, size: 3.5, alpha: 1 },
];

function createRandomGenerator(seed: number): () => number {
  let state = seed >>> 0;
  if (state === 0) {
    state = 0x9e3779b9;
  }
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

interface StarfieldItem extends StarfieldItemView {
  speedFactor: number;
}

export class ParallaxField {
  readonly width: number;
  readonly height: number;
  private readonly items: StarfieldItem[] = [];
  private readonly layerDefinitions: readonly StarfieldLayerDefinition[];

  constructor(
    width = 480,
    height = 720,
    options: ParallaxFieldOptions = {},
  ) {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.layerDefinitions = options.layers ?? defaultLayers;
    const randomValue = createRandomGenerator(options.seed ?? 1337);
    this.layerDefinitions.forEach((definition, layer) => {
      const count = Math.max(0, Math.floor(definition.count));
      for (let index = 0; index < count; index += 1) {
        this.items.push({
          x: randomValue() * this.width,
          y: randomValue() * this.height,
          size: definition.size * (0.7 + randomValue() * 0.6),
          alpha: definition.alpha,
          layer,
          speedFactor: definition.speedFactor,
        });
      }
    });
  }

  get itemCount(): number {
    return this.items.length;
  }

  get layerCount(): number {
    return this.layerDefinitions.length;
  }

  update(deltaSeconds: number, speed: number): void {
    if (deltaSeconds <= 0 || speed === 0) {
      return;
    }
    for (const item of this.items) {
      item.y += speed * item.speedFactor * deltaSeconds;
      item.y = ((item.y % this.height) + this.height) % this.height;
    }
  }

  forEachLayer(callback: (item: Readonly<StarfieldItemView>) => void): void {
    for (const item of this.items) {
      callback(item);
    }
  }

  forEachItem(callback: (item: Readonly<StarfieldItemView>) => void): void {
    this.forEachLayer(callback);
  }

  getLayerItems(layer: number): readonly StarfieldItemView[] {
    return this.items.filter((item) => item.layer === layer);
  }
}
