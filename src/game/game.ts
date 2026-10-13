import { circlesOverlap } from '../engine/collision';
import { ParticlePool } from '../effects/particles';
import { FloatingTextPool } from '../effects/floating-text';
import { ScreenShake } from '../effects/screen-shake';
import { ParallaxField } from '../effects/starfield';
import { Renderer } from '../render/renderer';
import type { RendererView } from '../render/renderer';
import { aimedVelocity, fanVelocities, ringVelocities, spiralVelocities, PatternClock } from './patterns';
import type { Velocity } from './patterns';
import { buildWave } from './waves';
import type { WaveGroup } from './waves';
import { getWeaponDefinition } from './weapons';
import { PLAY_FIELD_HEIGHT, PLAY_FIELD_WIDTH } from './types';
import type { Bullet, EnemyKind, EnemyShip, GameEvent, GameEventListener, PlayerShip, PowerUp, PowerUpKind } from './types';

export type GameState = 'ready' | 'playing' | 'paused' | 'over';

export interface GameInput {
  axisX: number;
  axisY: number;
  firing: boolean;
  bombPressed: boolean;
  pausedPressed: boolean;
}

export interface GameSnapshot {
  state: GameState;
  score: number;
  lives: number;
  bombs: number;
  wave: number;
  waveNumber: number;
  weaponName: string;
  weaponLevel: number;
  combo: number;
  multiplier: number;
  isBossWave: boolean;
}

export interface AudioLike {
  effects?: { shoot(): void; enemyShoot(): void; explosion(size: number): void; hit(): void; powerUp(): void; bomb(): void; playerDown(): void };
  soundEffects?: { shoot(): void; enemyShoot(): void; explosion(size: number): void; hit(): void; powerUp(): void; bomb(): void; playerDown(): void };
  startMusic?(): void;
  stopMusic?(): void;
  setIntensity?(value: number): void;
}

interface PendingGroup { group: WaveGroup; timerSeconds: number; spawned: boolean }

const POWER_UP_CYCLE: PowerUpKind[] = ['spread', 'missiles', 'rail', 'shield', 'bomb'];
const IDLE_INPUT: GameInput = { axisX: 0, axisY: 0, firing: false, bombPressed: false, pausedPressed: false };

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
function readInput(input: GameInput | undefined): GameInput {
  if (input === undefined) return IDLE_INPUT;
  try {
    return {
      axisX: clamp(Number(input.axisX) || 0, -1, 1),
      axisY: clamp(Number(input.axisY) || 0, -1, 1),
      firing: Boolean(input.firing),
      bombPressed: Boolean(input.bombPressed),
      pausedPressed: Boolean(input.pausedPressed),
    };
  } catch {
    return IDLE_INPUT;
  }
}

export class Game {
  public state: GameState = 'ready';
  public score = 0;
  public lives = 3;
  public bombs = 3;
  public waveNumber = 1;
  public weaponLevel = 1;
  public combo = 0;
  public player: PlayerShip;
  public enemies: EnemyShip[] = [];
  public playerBullets: Bullet[] = [];
  public enemyBullets: Bullet[] = [];
  public powerUps: PowerUp[] = [];
  public readonly particles = new ParticlePool(360);
  public readonly floatingTexts = new FloatingTextPool(40);
  public readonly screenShake = new ScreenShake();
  public readonly parallax = new ParallaxField(PLAY_FIELD_WIDTH, PLAY_FIELD_HEIGHT);
  private readonly audioEngine: AudioLike | null;
  private readonly listeners: GameEventListener[] = [];
  private pendingGroups: PendingGroup[] = [];
  private readonly enemyPatternClocks = new Map<EnemyShip, PatternClock>();
  private elapsedSeconds = 0;
  private comboTimerSeconds = 0;
  private waveDelaySeconds = 0;
  private bannerText = '';
  private bannerSeconds = 0;
  private hitFlashSeconds = 0;
  private spiralStep = 0;
  private powerUpIndex = 0;
  private isBossWave = false;
  private rendererInstance: Renderer | null = null;

  public constructor(audioEngine?: AudioLike | null) {
    this.audioEngine = audioEngine ?? null;
    this.player = this.createPlayer();
  }

  private createPlayer(): PlayerShip {
    return { x: PLAY_FIELD_WIDTH / 2, y: PLAY_FIELD_HEIGHT - 90, velocityX: 0, velocityY: 0, radius: 13, health: 1, maximumHealth: 1, faction: 'allies', alive: true, speed: 340, fireCooldownSeconds: 0, weapon: 'standard', shieldActive: false, shieldTimeRemainingSeconds: 0, invulnerabilitySeconds: 0, bombs: this.bombs, lives: this.lives };
  }

  public onEvent(listener: GameEventListener): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index >= 0) this.listeners.splice(index, 1);
    };
  }
  public addEventListener(listener: GameEventListener): () => void { return this.onEvent(listener); }

  private emit(event: GameEvent): void {
    for (const listener of [...this.listeners]) {
      try { listener(event); } catch { /* listener errors must not break the game */ }
    }
  }
  private audio(call: (effects: NonNullable<AudioLike['effects']>) => void): void {
    const effects = this.audioEngine?.effects ?? this.audioEngine?.soundEffects;
    if (effects === undefined || this.audioEngine === null) return;
    try { call(effects); } catch { /* audio is optional */ }
  }
  private musicIntensity(): void {
    try { this.audioEngine?.setIntensity?.(clamp(0.25 + this.waveNumber * 0.06, 0, 1)); } catch { /* optional */ }
  }

  public start(): void { this.resetRun(); }
  public restart(): void { this.resetRun(); }

  private resetRun(): void {
    this.score = 0; this.lives = 3; this.bombs = 3; this.waveNumber = 1; this.weaponLevel = 1;
    this.combo = 0; this.comboTimerSeconds = 0; this.elapsedSeconds = 0; this.spiralStep = 0;
    this.enemies = []; this.playerBullets = []; this.enemyBullets = []; this.powerUps = [];
    this.particles.clear(); this.floatingTexts.clear(); this.screenShake.clear();
    this.player = this.createPlayer();
    this.state = 'playing';
    this.beginWave(1);
    try { this.audioEngine?.startMusic?.(); } catch { /* optional */ }
  }

  public pause(): void {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.emit({ type: 'game-paused' });
  }
  public resume(): void {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.emit({ type: 'game-resumed' });
  }
  public togglePause(): void {
    if (this.state === 'playing') this.pause();
    else if (this.state === 'paused') this.resume();
  }

  private beginWave(waveNumber: number): void {
    const wave = buildWave(waveNumber);
    this.waveNumber = waveNumber;
    this.isBossWave = wave.isBossWave;
    this.pendingGroups = wave.groups.map((group) => ({ group, timerSeconds: group.entryDelaySeconds, spawned: false }));
    this.bannerText = wave.isBossWave ? `Wave ${waveNumber} - Boss` : `Wave ${waveNumber}`;
    this.bannerSeconds = 2.2;
    this.waveDelaySeconds = 0;
    this.emit({ type: 'wave-started', waveNumber });
    this.musicIntensity();
  }

  public getSnapshot(): GameSnapshot {
    const definition = getWeaponDefinition(this.weaponLevel);
    return { state: this.state, score: this.score, lives: this.lives, bombs: this.bombs, wave: this.waveNumber, waveNumber: this.waveNumber, weaponName: definition.name, weaponLevel: this.weaponLevel, combo: this.combo, multiplier: this.multiplier, isBossWave: this.isBossWave };
  }
  public get snapshot(): GameSnapshot { return this.getSnapshot(); }
  private get multiplier(): number { return 1 + Math.min(4, Math.floor(this.combo / 10)); }

  public update(deltaSeconds: number, input?: GameInput): void {
    const delta = clamp(Number.isFinite(deltaSeconds) ? deltaSeconds : 0, 0, 0.05);
    if (delta <= 0) return;
    const resolved = readInput(input);
    if (resolved.pausedPressed) {
      if (this.state === 'playing' || this.state === 'paused') this.togglePause();
    }
    this.parallax.update(delta, this.state === 'playing' ? 62 : 18);
    this.particles.update(delta);
    this.floatingTexts.update(delta);
    this.screenShake.update(delta);
    this.hitFlashSeconds = Math.max(0, this.hitFlashSeconds - delta * 2.4);
    this.bannerSeconds = Math.max(0, this.bannerSeconds - delta);
    if (this.state !== 'playing') return;
    this.elapsedSeconds += delta;
    if (resolved.bombPressed) this.useBomb();
    this.updatePlayer(delta, resolved);
    this.updateSpawning(delta);
    this.updateEnemies(delta);
    this.updateBullets(delta);
    this.updatePowerUps(delta);
    this.handleCollisions();
    this.comboTimerSeconds -= delta;
    if (this.comboTimerSeconds <= 0) this.combo = 0;
    if (this.waveDelaySeconds > 0) {
      this.waveDelaySeconds -= delta;
      if (this.waveDelaySeconds <= 0) this.beginWave(this.waveNumber + 1);
    } else if (this.pendingGroups.every((entry) => entry.spawned) && this.enemies.length === 0) {
      this.emit({ type: 'wave-cleared', waveNumber: this.waveNumber });
      this.floatingTexts.spawn(PLAY_FIELD_WIDTH / 2, 300, 'Wave Clear', '#bbf7d0');
      this.waveDelaySeconds = 2;
    }
  }

  private updatePlayer(delta: number, input: GameInput): void {
    const player = this.player;
    if (!player.alive) return;
    player.velocityX = input.axisX * player.speed;
    player.velocityY = input.axisY * player.speed;
    player.x = clamp(player.x + player.velocityX * delta, 22, PLAY_FIELD_WIDTH - 22);
    player.y = clamp(player.y + player.velocityY * delta, 90, PLAY_FIELD_HEIGHT - 24);
    player.invulnerabilitySeconds = Math.max(0, (player.invulnerabilitySeconds ?? 0) - delta);
    if ((player.shieldTimeRemainingSeconds ?? 0) > 0) {
      player.shieldTimeRemainingSeconds = Math.max(0, (player.shieldTimeRemainingSeconds ?? 0) - delta);
      player.shieldActive = (player.shieldTimeRemainingSeconds ?? 0) > 0;
    }
    player.fireCooldownSeconds = Math.max(0, (player.fireCooldownSeconds ?? 0) - delta);
    if (input.firing && player.fireCooldownSeconds <= 0) {
      this.firePlayerWeapons();
      player.fireCooldownSeconds = getWeaponDefinition(this.weaponLevel).fireIntervalSeconds;
    }
  }

  private firePlayerWeapons(): void {
    const definition = getWeaponDefinition(this.weaponLevel);
    const count = definition.spreadCount;
    for (let index = 0; index < count; index += 1) {
      const offset = count === 1 ? 0 : (index - (count - 1) / 2) * 11;
      const tilt = count === 1 ? 0 : (index - (count - 1) / 2) * 34;
      this.playerBullets.push({ x: this.player.x + offset, y: this.player.y - 20, velocityX: tilt, velocityY: -definition.bulletSpeed, radius: 4, damage: definition.damage, faction: 'allies', alive: true });
    }
    this.emit({ type: 'player-fired', x: this.player.x, y: this.player.y - 20 });
    this.audio((effects) => effects.shoot());
  }

  private mapKind(kind: WaveGroup['kind']): EnemyKind {
    if (kind === 'boss') return 'boss';
    if (kind === 'tank') return 'tank';
    if (kind === 'flak-site') return 'flak-site';
    if (kind === 'bomber') return 'flak-barge';
    if (kind === 'interceptor') return 'ace';
    if (kind === 'weaver') return 'dive-bomber';
    return 'fighter';
  }

  private spawnGroup(pending: PendingGroup): void {
    const { group } = pending;
    const kind = this.mapKind(group.kind);
    for (let index = 0; index < group.count; index += 1) {
      let x = PLAY_FIELD_WIDTH / 2;
      let y = -30 - index * 8;
      if (group.formation === 'line') x = 70 + (index * (PLAY_FIELD_WIDTH - 140)) / Math.max(1, group.count - 1 || 1);
      else if (group.formation === 'vee') { x = PLAY_FIELD_WIDTH / 2 + (index - (group.count - 1) / 2) * 42; y = -30 - Math.abs(index - (group.count - 1) / 2) * 18; }
      else if (group.formation === 'pincer') x = index % 2 === 0 ? 55 + Math.floor(index / 2) * 36 : PLAY_FIELD_WIDTH - 55 - Math.floor(index / 2) * 36;
      else if (group.formation === 'ring') { const angle = (index / Math.max(1, group.count)) * Math.PI * 2; x = PLAY_FIELD_WIDTH / 2 + Math.cos(angle) * 105; y = 70 + Math.sin(angle) * 34; }
      else x = 60 + ((index * 83) % (PLAY_FIELD_WIDTH - 120));
      const stats = this.enemyStats(kind);
      const isGround = kind === 'tank' || kind === 'flak-site';
      const enemy: EnemyShip = { kind, altitude: isGround ? 'ground' : 'air', x, y: kind === 'boss' ? 105 : y, velocityX: 0, velocityY: stats.speed, radius: stats.radius, health: stats.health, maximumHealth: stats.health, faction: 'axis', alive: true, fireCooldownSeconds: 1 + index * 0.18, elapsedSeconds: -index * 0.12, scoreValue: stats.score, phase: 0 };
      this.enemies.push(enemy);
      const patternIntervalSeconds = kind === 'boss' ? 0.9 : kind === 'tank' ? 2.6 : kind === 'flak-site' ? 2.2 : clamp(2 - this.waveNumber * 0.09, 0.95, 2);
      this.enemyPatternClocks.set(enemy, new PatternClock(patternIntervalSeconds));
      if (kind === 'boss') {
        this.emit({ type: 'boss-spawned', x: enemy.x, y: enemy.y, health: enemy.health });
        try { this.audioEngine?.setIntensity?.(clamp(0.7 + this.waveNumber * 0.04, 0, 1)); } catch { /* audio is optional */ }
      }
    }
  }

  private enemyStats(kind: EnemyKind): { health: number; radius: number; speed: number; score: number } {
    const waveScale = 1 + (this.waveNumber - 1) * 0.12;
    const groundScale = 1 + (this.waveNumber - 1) * 0.06;
    if (kind === 'boss') return { health: Math.round((72 + this.waveNumber * 10) * (1 + (this.waveNumber - 1) * 0.06)), radius: 46, speed: 34, score: 5000 };
    if (kind === 'tank') return { health: Math.round(6 * groundScale), radius: 16, speed: 42, score: 150 };
    if (kind === 'flak-site') return { health: Math.round(9 * groundScale), radius: 18, speed: 42, score: 250 };
    if (kind === 'flak-barge') return { health: Math.round(10 * waveScale), radius: 28, speed: 34, score: 400 };
    if (kind === 'ace') return { health: Math.round(5 * waveScale), radius: 15, speed: 105, score: 250 };
    if (kind === 'dive-bomber') return { health: Math.round(4 * waveScale), radius: 15, speed: 92, score: 180 };
    return { health: Math.round(3 * waveScale), radius: 14, speed: 82, score: 100 };
  }

  private updateSpawning(delta: number): void {
    for (const pending of this.pendingGroups) {
      if (pending.spawned) continue;
      pending.timerSeconds -= delta;
      if (pending.timerSeconds <= 0) { pending.spawned = true; this.spawnGroup(pending); }
    }
  }

  private updateEnemies(delta: number): void {
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      enemy.elapsedSeconds = (enemy.elapsedSeconds ?? 0) + delta;
      const elapsed = enemy.elapsedSeconds;
      const isGroundEnemy = enemy.altitude === 'ground' || enemy.kind === 'tank' || enemy.kind === 'flak-site';
      if (isGroundEnemy) {
        enemy.y += 42 * delta;
        enemy.x += Math.sin(elapsed * 0.5) * 2 * delta;
      } else if (enemy.kind === 'boss') {
        enemy.x = PLAY_FIELD_WIDTH / 2 + Math.sin(elapsed * 0.65) * 120;
        enemy.y = 105 + Math.sin(elapsed * 1.1) * 12;
      } else if (enemy.kind === 'flak-barge') {
        enemy.y += Math.min(enemy.velocityY, Math.max(0, 150 - enemy.y)) * delta;
        enemy.x += Math.sin(elapsed * 0.7 + enemy.y * 0.02) * 12 * delta;
      } else if (enemy.kind === 'dive-bomber' && elapsed > 2.2) {
        const velocity = aimedVelocity(enemy, this.player, 175);
        enemy.x += velocity.x * delta; enemy.y += velocity.y * delta;
      } else {
        enemy.y += enemy.velocityY * delta;
        enemy.x += Math.sin(elapsed * 2.1 + enemy.y * 0.015) * (enemy.kind === 'dive-bomber' ? 62 : 34) * delta;
      }
      enemy.x = clamp(enemy.x, 24, PLAY_FIELD_WIDTH - 24);
      let patternClock = this.enemyPatternClocks.get(enemy);
      if (patternClock === undefined) {
        patternClock = new PatternClock(enemy.kind === 'boss' ? 0.9 : enemy.kind === 'tank' ? 2.6 : enemy.kind === 'flak-site' ? 2.2 : 1.8);
        this.enemyPatternClocks.set(enemy, patternClock);
      }
      const initialDelayElapsed = (enemy.fireCooldownSeconds ?? 0) <= 0 || ((enemy.fireCooldownSeconds = (enemy.fireCooldownSeconds ?? 1) - delta) <= 0);
      const maximumFiringY = isGroundEnemy ? 660 : 560;
      if (initialDelayElapsed && patternClock.update(delta) && enemy.y > 10 && enemy.y < maximumFiringY && this.player.alive) {
        this.fireEnemy(enemy);
      }
      if (enemy.y > PLAY_FIELD_HEIGHT + 60) enemy.alive = false;
    }
    this.enemies = this.enemies.filter((enemy) => enemy.alive);
  }

  private spawnEnemyBullet(enemy: EnemyShip, velocity: Velocity, speedScale = 1): void {
    this.enemyBullets.push({ x: enemy.x, y: enemy.y + enemy.radius * 0.6, velocityX: velocity.x * speedScale, velocityY: velocity.y * speedScale, radius: 5, damage: 1, faction: 'axis', alive: true });
  }

  private fireEnemy(enemy: EnemyShip): void {
    const bulletSpeed = clamp(165 + this.waveNumber * 9, 165, 260);
    const aimed = aimedVelocity(enemy, this.player, bulletSpeed);
    const downwardAngle = Math.atan2(aimed.y, aimed.x);
    if (enemy.kind === 'boss') {
      const fraction = enemy.health / enemy.maximumHealth;
      enemy.phase = fraction > 0.66 ? 0 : fraction > 0.33 ? 1 : 2;
      if (enemy.phase === 0) for (const velocity of fanVelocities(downwardAngle, 0.65, 5, bulletSpeed)) this.spawnEnemyBullet(enemy, velocity);
      else if (enemy.phase === 1) { this.spiralStep += 1; for (const velocity of spiralVelocities(this.spiralStep, 3, bulletSpeed, 0.42)) this.spawnEnemyBullet(enemy, velocity); this.spawnEnemyBullet(enemy, aimed); }
      else { for (const velocity of ringVelocities(10, bulletSpeed * 0.82, this.spiralStep * 0.2)) this.spawnEnemyBullet(enemy, velocity); for (const velocity of fanVelocities(downwardAngle, 0.5, 3, bulletSpeed)) this.spawnEnemyBullet(enemy, velocity); this.spiralStep += 1; }
    } else if (enemy.kind === 'tank') {
      this.spawnEnemyBullet(enemy, aimed);
    } else if (enemy.kind === 'flak-site') {
      for (const velocity of fanVelocities(downwardAngle, 0.55, 3, bulletSpeed)) this.spawnEnemyBullet(enemy, velocity);
    } else if (enemy.kind === 'flak-barge' || (enemy.kind === 'ace' && this.waveNumber >= 3)) {
      for (const velocity of fanVelocities(downwardAngle, 0.55, 3, bulletSpeed)) this.spawnEnemyBullet(enemy, velocity);
    } else if (this.waveNumber >= 2 && enemy.kind === 'dive-bomber') {
      for (const velocity of fanVelocities(downwardAngle, 0.4, 3, bulletSpeed)) this.spawnEnemyBullet(enemy, velocity);
    } else {
      this.spawnEnemyBullet(enemy, aimed);
    }
    this.emit({ type: 'enemy-fired', x: enemy.x, y: enemy.y, kind: enemy.kind });
    this.audio((effects) => effects.enemyShoot());
  }

  private updateBullets(delta: number): void {
    for (const bullet of [...this.playerBullets, ...this.enemyBullets]) {
      bullet.x += bullet.velocityX * delta;
      bullet.y += bullet.velocityY * delta;
      if (bullet.x < -20 || bullet.x > PLAY_FIELD_WIDTH + 20 || bullet.y < -30 || bullet.y > PLAY_FIELD_HEIGHT + 30) bullet.alive = false;
    }
    this.playerBullets = this.playerBullets.filter((bullet) => bullet.alive);
    this.enemyBullets = this.enemyBullets.filter((bullet) => bullet.alive);
  }

  private updatePowerUps(delta: number): void {
    for (const powerUp of this.powerUps) {
      powerUp.y += powerUp.velocityY * delta;
      powerUp.x += Math.sin((powerUp.elapsedSeconds = (powerUp.elapsedSeconds ?? 0) + delta) * 3) * 18 * delta;
      if (powerUp.y > PLAY_FIELD_HEIGHT + 24) powerUp.alive = false;
    }
    this.powerUps = this.powerUps.filter((powerUp) => powerUp.alive);
  }

  private handleCollisions(): void {
    for (const bullet of this.playerBullets) {
      if (!bullet.alive) continue;
      for (const enemy of this.enemies) {
        if (!enemy.alive) continue;
        if (!circlesOverlap(bullet.x, bullet.y, bullet.radius, enemy.x, enemy.y, enemy.radius)) continue;
        bullet.alive = false;
        enemy.health -= bullet.damage;
        this.emit({ type: 'bullet-hit', x: bullet.x, y: bullet.y, faction: 'allies' });
        this.audio((effects) => effects.hit());
        if (enemy.health <= 0) this.destroyEnemy(enemy);
        else this.emit({ type: 'enemy-damaged', x: enemy.x, y: enemy.y, kind: enemy.kind, health: enemy.health });
        break;
      }
    }
    this.playerBullets = this.playerBullets.filter((bullet) => bullet.alive);
    if (!this.player.alive) return;
    for (const bullet of this.enemyBullets) {
      if (bullet.alive && circlesOverlap(bullet.x, bullet.y, bullet.radius, this.player.x, this.player.y, 9)) {
        bullet.alive = false;
        this.damagePlayer();
        if (!this.player.alive && this.state === 'over') { this.enemyBullets = this.enemyBullets.filter((entry) => entry.alive); return; }
      }
    }
    this.enemyBullets = this.enemyBullets.filter((bullet) => bullet.alive);
    for (const enemy of this.enemies) {
      if (enemy.alive && enemy.altitude !== 'ground' && enemy.kind !== 'tank' && enemy.kind !== 'flak-site' && circlesOverlap(enemy.x, enemy.y, enemy.radius * 0.8, this.player.x, this.player.y, 11)) {
        const wasBoss = enemy.kind === 'boss';
        enemy.health = 0;
        if (!wasBoss) this.destroyEnemy(enemy);
        this.damagePlayer();
        if (this.state === 'over') return;
      }
    }
    for (const powerUp of this.powerUps) {
      if (powerUp.alive && circlesOverlap(powerUp.x, powerUp.y, powerUp.radius + 8, this.player.x, this.player.y, this.player.radius + 8)) {
        powerUp.alive = false;
        this.collectPowerUp(powerUp);
      }
    }
    this.powerUps = this.powerUps.filter((powerUp) => powerUp.alive);
  }

  private destroyEnemy(enemy: EnemyShip): void {
    enemy.alive = false;
    const gained = (enemy.scoreValue ?? 100) * this.multiplier;
    this.score += gained;
    this.combo += 1;
    this.comboTimerSeconds = 3;
    const isBoss = enemy.kind === 'boss';
    this.particles.burst(enemy.x, enemy.y, { count: isBoss ? 46 : 16, speed: isBoss ? 230 : 150, lifeSeconds: 0.7, size: isBoss ? 4 : 3, color: isBoss ? '#fca5a5' : '#fbbf24' });
    this.floatingTexts.spawn(enemy.x, enemy.y, `+${gained}`, isBoss ? '#fecaca' : '#fde68a');
    this.screenShake.addTrauma(isBoss ? 0.75 : 0.22);
    this.emit({ type: 'enemy-destroyed', x: enemy.x, y: enemy.y, kind: enemy.kind, scoreValue: gained });
    this.emit({ type: 'explosion', x: enemy.x, y: enemy.y, size: isBoss ? 3 : 1 });
    if (isBoss) this.emit({ type: 'boss-defeated', x: enemy.x, y: enemy.y, scoreValue: gained });
    this.audio((effects) => effects.explosion(isBoss ? 2.4 : 0.9));
    const dropChance = isBoss ? 1 : enemy.kind === 'flak-barge' ? 0.55 : 0.2;
    if (((this.score + enemy.x) % 100) / 100 < dropChance || isBoss) this.dropPowerUp(enemy.x, enemy.y);
    this.enemies = this.enemies.filter((entry) => entry.alive);
  }

  private dropPowerUp(x: number, y: number): void {
    const kind = POWER_UP_CYCLE[this.powerUpIndex % POWER_UP_CYCLE.length];
    this.powerUpIndex += 1;
    this.powerUps.push({ kind, x, y, velocityX: 0, velocityY: 88, radius: 11, alive: true, elapsedSeconds: 0 });
    this.emit({ type: 'powerup-spawned', x, y, kind });
  }

  private collectPowerUp(powerUp: PowerUp): void {
    if (powerUp.kind === 'bomb') { this.bombs += 1; this.floatingTexts.spawn(powerUp.x, powerUp.y, '+Bomb', '#fca5a5'); }
    else if (powerUp.kind === 'shield') { this.player.shieldActive = true; this.player.shieldTimeRemainingSeconds = 9; this.floatingTexts.spawn(powerUp.x, powerUp.y, 'Shield', '#a5f3fc'); }
    else { this.weaponLevel = clamp(this.weaponLevel + 1, 1, 4); this.floatingTexts.spawn(powerUp.x, powerUp.y, getWeaponDefinition(this.weaponLevel).name, '#bbf7d0'); }
    this.score += 50;
    this.emit({ type: 'powerup-collected', x: powerUp.x, y: powerUp.y, kind: powerUp.kind });
    this.audio((effects) => effects.powerUp());
  }

  private damagePlayer(): void {
    if ((this.player.invulnerabilitySeconds ?? 0) > 0 || this.state !== 'playing') return;
    if (this.player.shieldActive === true) {
      this.player.shieldActive = false; this.player.shieldTimeRemainingSeconds = 0; this.player.invulnerabilitySeconds = 1;
      this.emit({ type: 'shield-absorbed', x: this.player.x, y: this.player.y });
      return;
    }
    this.lives -= 1;
    this.combo = 0;
    this.hitFlashSeconds = 1;
    this.screenShake.addTrauma(0.65);
    this.particles.burst(this.player.x, this.player.y, { count: 28, speed: 190, lifeSeconds: 0.8, size: 3.5, color: '#93c5fd' });
    this.emit({ type: 'player-hit', x: this.player.x, y: this.player.y, health: this.lives });
    if (this.lives <= 0) {
      this.player.alive = false;
      this.state = 'over';
      this.emit({ type: 'player-destroyed', x: this.player.x, y: this.player.y });
      this.emit({ type: 'game-over', score: this.score });
      this.audio((effects) => effects.playerDown());
      try { this.audioEngine?.stopMusic?.(); } catch { /* optional */ }
    } else {
      this.player.x = PLAY_FIELD_WIDTH / 2; this.player.y = PLAY_FIELD_HEIGHT - 90;
      this.player.invulnerabilitySeconds = 2.2;
      this.weaponLevel = Math.max(1, this.weaponLevel - 1);
      this.audio((effects) => effects.explosion(1.4));
    }
  }

  public useBomb(): void {
    if (this.state !== 'playing' || this.bombs <= 0 || !this.player.alive) return;
    this.bombs -= 1;
    this.score += this.enemyBullets.length * 5;
    this.enemyBullets = [];
    for (const enemy of [...this.enemies]) {
      enemy.health -= enemy.kind === 'boss' ? 18 : 10;
      if (enemy.health <= 0) this.destroyEnemy(enemy);
    }
    this.particles.burst(this.player.x, this.player.y, { count: 60, speed: 320, lifeSeconds: 0.9, size: 4, color: '#fca5a5' });
    this.screenShake.addTrauma(0.85);
    this.hitFlashSeconds = 0.6;
    this.floatingTexts.spawn(this.player.x, this.player.y - 34, 'BOMB', '#fecaca');
    this.emit({ type: 'bomb-used', x: this.player.x, y: this.player.y });
    this.audio((effects) => effects.bomb());
  }

  public getRenderView(): RendererView {
    const boss = this.enemies.find((enemy) => enemy.kind === 'boss');
    return { player: this.player, enemies: this.enemies, playerBullets: this.playerBullets, enemyBullets: this.enemyBullets, powerUps: this.powerUps, particles: this.particles, floatingTexts: this.floatingTexts, screenShake: this.screenShake, parallax: this.parallax, elapsedSeconds: this.elapsedSeconds, state: this.state, bannerText: this.bannerSeconds > 0 ? this.bannerText : '', bannerAlpha: clamp(this.bannerSeconds, 0, 1), hitFlashAlpha: this.hitFlashSeconds * 0.4, bossHealthFraction: boss === undefined ? -1 : boss.health / boss.maximumHealth };
  }

  public render(context: CanvasRenderingContext2D | Renderer): void {
    if (context instanceof Renderer) { context.render(this.getRenderView()); return; }
    const maybeRenderer = context as unknown as { render?: unknown; drawGame?: unknown };
    if (typeof maybeRenderer.render === 'function' && typeof (context as CanvasRenderingContext2D).save !== 'function') {
      (maybeRenderer.render as (view: RendererView) => void).call(context, this.getRenderView());
      return;
    }
    if (this.rendererInstance === null || (this.rendererInstance as unknown as { context?: unknown }) === null) {
      this.rendererInstance = new Renderer(context as CanvasRenderingContext2D);
    }
    // Recreate if a different canvas context is supplied.
    this.rendererInstance = new Renderer(context as CanvasRenderingContext2D);
    this.rendererInstance.render(this.getRenderView());
  }
}

export function createGame(audioEngine?: AudioLike | null): Game { return new Game(audioEngine); }
export default Game;
