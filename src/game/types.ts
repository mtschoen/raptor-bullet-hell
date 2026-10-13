export const PLAY_FIELD_WIDTH = 480;
export const PLAY_FIELD_HEIGHT = 720;

export interface Vec2 {
  x: number;
  y: number;
}

export type Faction = 'allies' | 'axis';

export type EnemyKind =
  'fighter' | 'dive-bomber' | 'ace' | 'flak-barge' | 'boss' | 'tank' | 'flak-site';

export type Altitude = 'air' | 'ground';

export type PowerUpKind = 'spread' | 'missiles' | 'rail' | 'shield' | 'bomb';

export type WeaponKind = 'standard' | 'spread' | 'missiles' | 'rail';

export interface Bullet {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  radius: number;
  damage: number;
  faction: Faction;
  alive: boolean;
  piercing?: boolean;
  homing?: boolean;
  lifetimeSeconds?: number;
}

export interface EnemyShip {
  kind: EnemyKind;
  altitude?: Altitude;
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  radius: number;
  health: number;
  maximumHealth: number;
  faction: Faction;
  alive: boolean;
  fireCooldownSeconds?: number;
  elapsedSeconds?: number;
  scoreValue?: number;
  phase?: number;
}

export interface PlayerShip {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  radius: number;
  health: number;
  maximumHealth: number;
  faction: Faction;
  alive: boolean;
  speed: number;
  fireCooldownSeconds?: number;
  weapon?: WeaponKind;
  weaponTimeRemainingSeconds?: number;
  shieldActive?: boolean;
  shieldTimeRemainingSeconds?: number;
  invulnerabilitySeconds?: number;
  bombs?: number;
  lives?: number;
}

export interface PowerUp {
  kind: PowerUpKind;
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  radius: number;
  alive: boolean;
  elapsedSeconds?: number;
}

export type GameEvent =
  | { type: 'player-fired'; x: number; y: number }
  | { type: 'enemy-fired'; x: number; y: number; kind: EnemyKind }
  | { type: 'bullet-hit'; x: number; y: number; faction: Faction }
  | { type: 'enemy-damaged'; x: number; y: number; kind: EnemyKind; health: number }
  | { type: 'enemy-destroyed'; x: number; y: number; kind: EnemyKind; scoreValue: number }
  | { type: 'player-hit'; x: number; y: number; health: number }
  | { type: 'shield-absorbed'; x: number; y: number }
  | { type: 'player-destroyed'; x: number; y: number }
  | { type: 'powerup-spawned'; x: number; y: number; kind: PowerUpKind }
  | { type: 'powerup-collected'; x: number; y: number; kind: PowerUpKind }
  | { type: 'bomb-used'; x: number; y: number }
  | { type: 'explosion'; x: number; y: number; size: number }
  | { type: 'boss-spawned'; x: number; y: number; health: number }
  | { type: 'boss-defeated'; x: number; y: number; scoreValue: number }
  | { type: 'wave-started'; waveNumber: number }
  | { type: 'wave-cleared'; waveNumber: number }
  | { type: 'game-over'; score: number }
  | { type: 'game-paused' }
  | { type: 'game-resumed' };

export type GameEventType = GameEvent['type'];

export type GameEventListener = (event: GameEvent) => void;
