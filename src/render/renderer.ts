import { PLAY_FIELD_HEIGHT, PLAY_FIELD_WIDTH } from '../game/types';
import type { Bullet, EnemyShip, PlayerShip, PowerUp } from '../game/types';
import type { ParticlePool } from '../effects/particles';
import type { FloatingTextPool } from '../effects/floating-text';
import type { ScreenShake } from '../effects/screen-shake';
import type { ParallaxField } from '../effects/starfield';
import { getBossSprite, getSprite } from './sprites';
import type { SpriteKind } from './sprites';
export interface RendererView {
  player: PlayerShip | null;
  enemies: readonly EnemyShip[];
  playerBullets: readonly Bullet[];
  enemyBullets: readonly Bullet[];
  powerUps: readonly PowerUp[];
  particles: ParticlePool | null;
  floatingTexts: FloatingTextPool | null;
  screenShake: ScreenShake | null;
  parallax: ParallaxField | null;
  elapsedSeconds: number;
  state: string;
  bannerText: string;
  bannerAlpha: number;
  hitFlashAlpha: number;
  bossHealthFraction: number;
}
function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
function isGroundEnemy(enemy: EnemyShip): boolean {
  return enemy.altitude === 'ground' || enemy.kind === 'tank' || enemy.kind === 'flak-site';
}
function seededValue(segmentIndex: number, salt: number): number {
  let hash = Math.imul(segmentIndex + 1013, 374761393) + Math.imul(salt + 77, 668265263);
  hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
  return ((hash ^ (hash >>> 16)) >>> 0) / 4294967295;
}
function smoothStep(value: number): number { return value * value * (3 - 2 * value); }
function interpolatedSeed(worldY: number, cellSize: number, salt: number): number {
  const cellIndex = Math.floor(worldY / cellSize);
  const fraction = smoothStep((worldY - cellIndex * cellSize) / cellSize);
  const firstValue = seededValue(cellIndex, salt);
  const secondValue = seededValue(cellIndex + 1, salt);
  return firstValue + (secondValue - firstValue) * fraction;
}
function channelCenterAt(worldY: number): number {
  const seededCenter = 150 + interpolatedSeed(worldY, 260, 501) * 180;
  const winding = Math.sin(worldY * 0.0042) * 34 + Math.sin(worldY * 0.0113 + 1.7) * 13;
  return clamp(seededCenter + winding, 96, PLAY_FIELD_WIDTH - 96);
}
function channelHalfWidthAt(worldY: number): number {
  return 58 + interpolatedSeed(worldY, 320, 502) * 26 + Math.sin(worldY * 0.0031 + 0.5) * 8;
}
export class Renderer {
  private readonly context: CanvasRenderingContext2D;
  public constructor(context: CanvasRenderingContext2D) { this.context = context; }
  public render(view: RendererView): void { this.drawGame(view); }
  public renderGame(view: RendererView): void { this.drawGame(view); }
  public draw(view: RendererView): void { this.drawGame(view); }
  public drawGame(view: RendererView): void {
    const context = this.context;
    context.save();
    context.clearRect(0, 0, PLAY_FIELD_WIDTH, PLAY_FIELD_HEIGHT);
    context.translate(view.screenShake?.offsetX ?? 0, view.screenShake?.offsetY ?? 0);
    this.drawBackground(view);
    this.drawPowerUps(view.powerUps, view.elapsedSeconds);
    for (const enemy of view.enemies) if (enemy.alive && isGroundEnemy(enemy)) this.drawEnemy(enemy, view.elapsedSeconds);
    for (const enemy of view.enemies) if (enemy.alive && !isGroundEnemy(enemy)) this.drawEnemy(enemy, view.elapsedSeconds);
    if (view.player !== null && view.player.alive) this.drawPlayer(view.player, view.elapsedSeconds);
    this.drawBullets(view.playerBullets, '#67e8f9');
    this.drawBullets(view.enemyBullets, '#f0f');
    this.drawParticles(view);
    this.drawFloatingTexts(view);
    context.restore();
    this.drawBossBar(view); this.drawBanner(view); this.drawHitFlash(view); this.drawVignette();
  }
  private ellipse(x: number, y: number, radiusX: number, radiusY: number, fill: string, rotation = 0): void {
    const context = this.context; context.fillStyle = fill; context.beginPath();
    context.ellipse(x, y, radiusX, radiusY, rotation, 0, Math.PI * 2); context.fill();
  }
  private circle(x: number, y: number, radius: number, fill: string): void { this.ellipse(x, y, radius, radius, fill); }
  private rect(x: number, y: number, width: number, height: number, fill: string): void {
    this.context.fillStyle = fill; this.context.fillRect(x, y, width, height);
  }
  private poly(points: readonly number[], fill: string, stroke?: string, lineWidth = 1.3): void {
    const context = this.context; context.fillStyle = fill; context.beginPath();
    context.moveTo(points[0], points[1]);
    for (let index = 2; index < points.length; index += 2) context.lineTo(points[index], points[index + 1]);
    context.closePath(); context.fill();
    if (stroke !== undefined) { context.strokeStyle = stroke; context.lineWidth = lineWidth; context.stroke(); }
  }
  private line(x1: number, y1: number, x2: number, y2: number, stroke: string, width = 1): void {
    const context = this.context; context.strokeStyle = stroke; context.lineWidth = width;
    context.beginPath(); context.moveTo(x1, y1); context.lineTo(x2, y2); context.stroke();
  }
  private backgroundImageCache = new Map<string, HTMLImageElement>();
  private backgroundPattern(name: string, scroll: number): CanvasPattern | null {
    let image = this.backgroundImageCache.get(name);
    if (image === undefined) {
      image = new Image();
      image.src = `backgrounds/${name}.jpg`;
      this.backgroundImageCache.set(name, image);
    }
    if (!image.complete || image.naturalWidth === 0) return null;
    const pattern = this.context.createPattern(image, 'repeat');
    if (pattern === null) return null;
    pattern.setTransform(new DOMMatrix().translate(0, scroll % 512));
    return pattern;
  }
  private diffusionImageCache = new Map<string, HTMLImageElement>();
  private blitDiffusion(name: string, displayWidth: number, flipped: boolean): boolean {
    let image = this.diffusionImageCache.get(name);
    if (image === undefined) {
      image = new Image();
      image.src = `sprites/${name}.png`;
      this.diffusionImageCache.set(name, image);
    }
    if (!image.complete || image.naturalWidth === 0) return false;
    const displayHeight = displayWidth * (image.naturalHeight / image.naturalWidth);
    const context = this.context;
    context.save();
    if (flipped) context.rotate(Math.PI);
    context.drawImage(image, -displayWidth / 2, -displayHeight / 2, displayWidth, displayHeight);
    context.restore();
    return true;
  }
  private blit(kind: SpriteKind, damageHealthFraction = 1): void {
    const sprite = kind === 'boss' ? getBossSprite(damageHealthFraction) : getSprite(kind);
    // Sprite canvases are painted at twice display resolution for finer shading.
    const displayWidth = sprite.width / 2;
    const displayHeight = sprite.height / 2;
    this.context.drawImage(sprite.canvas, -displayWidth / 2, -displayHeight / 2, displayWidth, displayHeight);
  }
  private drawBackground(view: RendererView): void {
    const context = this.context;
    const scroll = view.elapsedSeconds * 42;
    // Land is the continuous base on both sides of the channel.
    const landGradient = context.createLinearGradient(0, 0, PLAY_FIELD_WIDTH, 0);
    landGradient.addColorStop(0, '#5d703c'); landGradient.addColorStop(0.5, '#66743e'); landGradient.addColorStop(1, '#55683a');
    context.fillStyle = this.backgroundPattern('fields', scroll) ?? landGradient; context.fillRect(-20, -20, PLAY_FIELD_WIDTH + 40, PLAY_FIELD_HEIGHT + 40);
    this.drawWorldLockedLandTexture(scroll);
    const coastStep = 20;
    // Beach rim: channel widened toward the water, sampled from worldY.
    context.fillStyle = '#d8bd82'; context.beginPath();
    for (let screenY = -coastStep; screenY <= PLAY_FIELD_HEIGHT + coastStep; screenY += coastStep) {
      const worldY = screenY - scroll;
      const edgeX = channelCenterAt(worldY) - channelHalfWidthAt(worldY) - 9;
      if (screenY === -coastStep) context.moveTo(edgeX, screenY); else context.lineTo(edgeX, screenY);
    }
    for (let screenY = PLAY_FIELD_HEIGHT + coastStep; screenY >= -coastStep; screenY -= coastStep) {
      const worldY = screenY - scroll;
      context.lineTo(channelCenterAt(worldY) + channelHalfWidthAt(worldY) + 9, screenY);
    }
    context.closePath(); context.fill();
    // Water channel only, following the same continuous coast.
    const waterGradient = context.createLinearGradient(0, 0, 0, PLAY_FIELD_HEIGHT);
    waterGradient.addColorStop(0, '#155e75'); waterGradient.addColorStop(0.45, '#0b4f6e'); waterGradient.addColorStop(1, '#082f49');
    context.fillStyle = this.backgroundPattern('water', scroll) ?? waterGradient; context.beginPath();
    for (let screenY = -coastStep; screenY <= PLAY_FIELD_HEIGHT + coastStep; screenY += coastStep) {
      const worldY = screenY - scroll;
      const edgeX = channelCenterAt(worldY) - channelHalfWidthAt(worldY);
      if (screenY === -coastStep) context.moveTo(edgeX, screenY); else context.lineTo(edgeX, screenY);
    }
    for (let screenY = PLAY_FIELD_HEIGHT + coastStep; screenY >= -coastStep; screenY -= coastStep) {
      const worldY = screenY - scroll;
      context.lineTo(channelCenterAt(worldY) + channelHalfWidthAt(worldY), screenY);
    }
    context.closePath(); context.fill();
    this.drawWorldLockedRoad(scroll);
    // Foam flecks hugging both coasts, seeded in world space.
    for (let screenY = 0; screenY <= PLAY_FIELD_HEIGHT; screenY += 24) {
      const worldY = screenY - scroll;
      const centerX = channelCenterAt(worldY); const halfWidth = channelHalfWidthAt(worldY);
      const foamSeed = Math.floor(worldY / 24);
      this.ellipse(centerX - halfWidth + 3, screenY + seededValue(foamSeed, 701) * 8, 5 + seededValue(foamSeed, 702) * 7, 2, 'rgba(240, 249, 255, 0.45)', 0.15);
      this.ellipse(centerX + halfWidth - 3, screenY + seededValue(foamSeed, 703) * 8, 5 + seededValue(foamSeed, 704) * 7, 2, 'rgba(240, 249, 255, 0.4)', -0.15);
    }
    // Sparkles and waves stay inside the channel and move down at water speed.
    context.fillStyle = 'rgba(196, 232, 248, 0.5)';
    for (let index = 0; index < 36; index += 1) {
      const sparkleY = ((seededValue(index, 202) * PLAY_FIELD_HEIGHT + scroll) % (PLAY_FIELD_HEIGHT + 12)) - 6;
      const worldY = sparkleY - scroll;
      const sparkleX = channelCenterAt(worldY) + (seededValue(index, 201) - 0.5) * Math.max(10, (channelHalfWidthAt(worldY) - 10) * 2);
      context.globalAlpha = 0.25 + seededValue(index, 205) * 0.45;
      context.fillRect(sparkleX, sparkleY, 2 + seededValue(index, 204) * 5, 1.2);
    }
    context.globalAlpha = 1;
    context.strokeStyle = 'rgba(186, 230, 253, 0.14)'; context.lineWidth = 1;
    for (let index = 0; index < 7; index += 1) {
      const waveY = ((index * 118 + scroll) % (PLAY_FIELD_HEIGHT + 90)) - 45;
      const worldY = waveY - scroll;
      const waveCenter = channelCenterAt(worldY); const waveHalf = Math.max(12, channelHalfWidthAt(worldY) - 8);
      context.beginPath(); context.moveTo(waveCenter - waveHalf, waveY);
      context.bezierCurveTo(waveCenter - waveHalf * 0.3, waveY + 8, waveCenter + waveHalf * 0.3, waveY - 8, waveCenter + waveHalf, waveY + 3); context.stroke();
    }
    for (let index = 0; index < 3; index += 1) {
      const cloudX = seededValue(index, 91) * PLAY_FIELD_WIDTH + Math.sin(view.elapsedSeconds * 0.07 + index * 2.1) * 22;
      const cloudY = ((seededValue(index, 92) * 500 + view.elapsedSeconds * 49 + index * 260) % (PLAY_FIELD_HEIGHT + 220)) - 110;
      this.ellipse(cloudX, cloudY, 92 + index * 18, 30 + index * 6, 'rgba(2, 32, 54, 0.18)', 0.25);
      this.ellipse(cloudX + 34, cloudY + 10, 58 + index * 10, 20, 'rgba(2, 32, 54, 0.12)', 0.2);
    }
    if (view.parallax !== null) {
      context.fillStyle = 'rgba(255,255,255,0.75)';
      view.parallax.forEachItem((item) => { context.globalAlpha = item.alpha * 0.55; context.fillRect(item.x, item.y, item.size, item.size * 2.4); });
      context.globalAlpha = 1;
    }
  }
  private drawWorldLockedLandTexture(scroll: number): void {
    const cellSize = 48;
    const firstWorldRow = Math.floor((0 - scroll) / cellSize) - 1;
    for (let rowOffset = 0; rowOffset <= Math.ceil(PLAY_FIELD_HEIGHT / cellSize) + 2; rowOffset += 1) {
      const worldRow = firstWorldRow + rowOffset;
      const cellWorldY = worldRow * cellSize;
      const screenY = cellWorldY + scroll;
      const coastWorldY = cellWorldY + cellSize / 2;
      const leftCoast = channelCenterAt(coastWorldY) - channelHalfWidthAt(coastWorldY) - 9;
      const rightCoast = channelCenterAt(coastWorldY) + channelHalfWidthAt(coastWorldY) + 9;
      for (let worldColumn = 0; worldColumn < Math.ceil(PLAY_FIELD_WIDTH / cellSize) + 1; worldColumn += 1) {
        const screenX = worldColumn * cellSize;
        const cellCenterX = screenX + cellSize / 2;
        if (cellCenterX > leftCoast && cellCenterX < rightCoast) continue;
        const cellSeed = worldColumn + worldRow * 137;
        const textureKind = seededValue(cellSeed, 601);
        const jitterX = seededValue(cellSeed, 602) * 18 - 9;
        const jitterY = seededValue(cellSeed, 603) * 18 - 9;
        if (textureKind < 0.42) {
          const junglePattern = this.backgroundPattern('jungle', scroll); if (junglePattern !== null) { this.context.save(); this.context.globalAlpha = 0.88; this.context.fillStyle = junglePattern; this.context.fillRect(screenX, screenY, cellSize, cellSize); this.context.restore(); } this.circle(screenX + 16 + jitterX, screenY + 16 + jitterY, 8 + seededValue(cellSeed, 604) * 6, 'rgba(30, 74, 28, 0.8)');
          this.circle(screenX + 27 + jitterX, screenY + 22 + jitterY, 6 + seededValue(cellSeed, 605) * 5, 'rgba(52, 110, 38, 0.8)');
          this.circle(screenX + 11 + jitterX, screenY + 27 + jitterY, 5, 'rgba(96, 150, 58, 0.75)');
        } else if (textureKind < 0.78) {
          const fieldFill = seededValue(cellSeed, 606) < 0.5 ? 'rgba(178, 156, 92, 0.7)' : 'rgba(112, 128, 62, 0.7)';
          if (this.backgroundPattern('fields', scroll) === null) this.rect(screenX + 3, screenY + 3, cellSize - 6, cellSize - 6, fieldFill);
          this.line(screenX + 6, screenY + 16, screenX + cellSize - 6, screenY + 16, 'rgba(52, 58, 30, 0.3)', 0.8);
          this.line(screenX + 6, screenY + 30, screenX + cellSize - 6, screenY + 30, 'rgba(52, 58, 30, 0.3)', 0.8);
        }
        for (let speckle = 0; speckle < 3; speckle += 1) {
          this.circle(screenX + 6 + seededValue(cellSeed, 610 + speckle) * 36, screenY + 6 + seededValue(cellSeed, 620 + speckle) * 36, 1.6 + seededValue(cellSeed, 630 + speckle) * 1.8, 'rgba(34, 84, 32, 0.7)');
        }
      }
    }
  }
  private drawWorldLockedRoad(scroll: number): void {
    const context = this.context;
    const roadSpacing = 360;
    const firstRoadCell = Math.floor(-scroll / roadSpacing) - 1;
    for (let cellOffset = 0; cellOffset < 5; cellOffset += 1) {
      const roadCell = firstRoadCell + cellOffset;
      const roadWorldY = roadCell * roadSpacing + 70 + seededValue(roadCell, 801) * 200;
      const roadScreenBase = roadWorldY + scroll;
      if (roadScreenBase < -60 || roadScreenBase > PLAY_FIELD_HEIGHT + 60) continue;
      const slope = (seededValue(roadCell, 802) - 0.5) * 0.22;
      const roadYAt = (screenX: number): number => roadScreenBase + (screenX - PLAY_FIELD_WIDTH / 2) * slope;
      context.strokeStyle = 'rgba(74, 70, 66, 0.9)'; context.lineWidth = 9; context.beginPath();
      context.moveTo(-20, roadYAt(-20));
      for (let screenX = 0; screenX <= PLAY_FIELD_WIDTH; screenX += 48) context.lineTo(screenX, roadYAt(screenX));
      context.lineTo(PLAY_FIELD_WIDTH + 20, roadYAt(PLAY_FIELD_WIDTH + 20)); context.stroke();
      // Bridge band where the road crosses the channel at this world Y.
      const centerX = channelCenterAt(roadWorldY); const halfWidth = channelHalfWidthAt(roadWorldY) + 12;
      context.strokeStyle = '#8a7f72'; context.lineWidth = 13; context.beginPath();
      context.moveTo(centerX - halfWidth, roadYAt(centerX - halfWidth)); context.lineTo(centerX + halfWidth, roadYAt(centerX + halfWidth)); context.stroke();
      context.strokeStyle = 'rgba(254, 243, 199, 0.8)'; context.lineWidth = 1.4; context.beginPath();
      context.moveTo(centerX - halfWidth, roadYAt(centerX - halfWidth) - 5); context.lineTo(centerX + halfWidth, roadYAt(centerX + halfWidth) - 5); context.stroke();
      context.beginPath(); context.moveTo(centerX - halfWidth, roadYAt(centerX - halfWidth) + 5); context.lineTo(centerX + halfWidth, roadYAt(centerX + halfWidth) + 5); context.stroke();
      context.strokeStyle = 'rgba(254, 243, 199, 0.75)'; context.lineWidth = 1.1; context.setLineDash([8, 8]); context.beginPath();
      context.moveTo(-20, roadYAt(-20)); context.lineTo(PLAY_FIELD_WIDTH + 20, roadYAt(PLAY_FIELD_WIDTH + 20)); context.stroke(); context.setLineDash([]);
    }
  }
  private drawPlayer(player: PlayerShip, elapsedSeconds: number): void {
    const context = this.context;
    if ((player.invulnerabilitySeconds ?? 0) > 0 && Math.floor(elapsedSeconds * 14) % 2 === 0) context.globalAlpha = 0.45;
    context.save(); context.translate(player.x, player.y);
    this.ellipse(11, 15, 21, 9, 'rgba(2, 20, 36, 0.30)', 0.25);
    this.ellipse(12, 16, 14, 6, 'rgba(2, 20, 36, 0.22)', 0.25);
    context.rotate(clamp(player.velocityX / 340, -1, 1) * 0.22);
    const flicker = 4 + Math.sin(elapsedSeconds * 43) * 2.4 + Math.sin(elapsedSeconds * 71) * 1.4;
    this.poly([-6, 27, 0, 44 + flicker, 6, 27], 'rgba(37, 99, 235, 0.55)');
    this.poly([-4.5, 27, 0, 39 + flicker, 4.5, 27], 'rgba(249, 115, 22, 0.92)');
    this.poly([-2.2, 27, 0, 33 + flicker * 0.6, 2.2, 27], 'rgba(253, 224, 71, 0.97)');
    if (!this.blitDiffusion('player', 74, false)) this.blit('player');
    context.restore();
    if (player.shieldActive === true) { context.strokeStyle = 'rgba(103,232,249,0.9)'; context.lineWidth = 2; context.beginPath(); context.arc(player.x, player.y, 27, 0, Math.PI * 2); context.stroke(); }
    context.globalAlpha = 1;
  }
  private drawEnemy(enemy: EnemyShip, elapsedSeconds: number): void {
    const context = this.context;
    context.save(); context.translate(enemy.x, enemy.y);
    if (isGroundEnemy(enemy)) {
      this.ellipse(3, 6, enemy.radius * 1.18, enemy.radius * 0.72, 'rgba(12, 14, 6, 0.55)'); this.ellipse(2, 4, enemy.radius * 0.95, enemy.radius * 0.55, 'rgba(20, 26, 12, 0.45)'); context.strokeStyle = 'rgba(255, 238, 190, 0.38)'; context.lineWidth = 1.6; context.beginPath(); context.ellipse(0, 2, enemy.radius * 1.12, enemy.radius * 0.68, 0, Math.PI * 1.05, Math.PI * 1.95); context.stroke();
      this.ellipse(1, 3, enemy.radius * 0.7, enemy.radius * 0.38, 'rgba(20, 26, 12, 0.30)');
      const groundDrawn = enemy.kind === 'tank' ? this.blitDiffusion('tank', 56, true) : this.blitDiffusion('flak-site', 66, false);
      if (!groundDrawn) this.blit(enemy.kind === 'tank' ? 'tank' : 'flak-site');
      if (enemy.kind === 'flak-site' && Math.floor(elapsedSeconds * 3) % 2 === 0) this.circle(17, -15, 2.4, '#ef4444');
      if (enemy.kind === 'flak-site' && Math.floor(elapsedSeconds * 3) % 2 === 0) this.circle(17, -15, 4.2, 'rgba(239, 68, 68, 0.30)');
    } else {
      this.ellipse(11, 15, enemy.radius * 0.95, enemy.radius * 0.42, 'rgba(2, 20, 36, 0.30)', 0.25);
      context.rotate(clamp(enemy.velocityX / 500, -0.4, 0.4) * 0.35);
      const healthFraction = enemy.maximumHealth > 0 ? clamp(enemy.health / enemy.maximumHealth, 0, 1) : 1;
      if (enemy.kind === 'ace') {
        const flame = 4 + Math.sin(elapsedSeconds * 39) * 2;
        this.poly([-3, -29, 0, -38 - flame, 3, -29], 'rgba(249, 115, 22, 0.88)');
      }
      const diffusionByKind: Record<string, { name: string; width: number }> = {
        fighter: { name: 'fighter', width: 72 },
        'dive-bomber': { name: 'dive-bomber', width: 74 },
        ace: { name: 'ace', width: 68 },
        'flak-barge': { name: 'bomber', width: 148 },
        boss: { name: 'boss', width: 238 },
      };
      const diffusionSprite = diffusionByKind[enemy.kind];
      const airDrawn = diffusionSprite !== undefined && this.blitDiffusion(diffusionSprite.name, diffusionSprite.width, true);
      if (!airDrawn) this.blit(enemy.kind as SpriteKind, healthFraction);
      if (enemy.kind === 'fighter' || enemy.kind === 'dive-bomber') this.drawPropellerSpin(enemy.kind === 'fighter' ? 26 : 28, elapsedSeconds);
      if (enemy.kind === 'flak-barge') this.drawLiveTurret(0, 12, elapsedSeconds);
      if (enemy.kind === 'boss') this.drawBossDamageEffects(healthFraction, elapsedSeconds);
      context.rotate(-clamp(enemy.velocityX / 500, -0.4, 0.4) * 0.35);
    }
    context.restore();
    if (enemy.kind !== 'boss' && enemy.health < enemy.maximumHealth) {
      const fraction = clamp(enemy.health / enemy.maximumHealth, 0, 1);
      this.rect(enemy.x - 16, enemy.y - enemy.radius - 10, 32, 4, 'rgba(0,0,0,0.5)');
      this.rect(enemy.x - 16, enemy.y - enemy.radius - 10, 32 * fraction, 4, '#f87171');
    }
  }
  private drawPropellerSpin(noseOffsetY: number, elapsedSeconds: number): void {
    const context = this.context;
    context.save(); context.translate(0, noseOffsetY); context.rotate(elapsedSeconds * 38);
    context.globalAlpha = 0.5;
    this.rect(-13, -1.2, 26, 2.4, '#e5e7eb');
    this.rect(-1.2, -6, 2.4, 12, 'rgba(229, 231, 235, 0.7)');
    context.globalAlpha = 1;
    context.restore();
    this.circle(0, noseOffsetY, 2.2, '#111827');
  }
  private drawLiveTurret(x: number, y: number, elapsedSeconds: number): void {
    const context = this.context;
    context.save(); context.translate(x, y); context.rotate(Math.sin(elapsedSeconds * 0.8) * 0.45);
    this.rect(-1.6, 2, 3.2, 12, '#17130f');
    context.restore();
    this.circle(x, y, 3.2, '#8c2f26');
  }
  private drawBossDamageEffects(healthFraction: number, elapsedSeconds: number): void {
    if (healthFraction >= 0.68) return;
    const drift = Math.sin(elapsedSeconds * 2.2) * 3;
    const smokeFill = `rgba(82, 82, 91, ${((0.68 - healthFraction) * 0.75).toFixed(3)})`;
    for (let puff = 0; puff < 4; puff += 1) this.circle(-24 + puff * 15 + drift, -34 - puff * 5, 8 + puff * 2.4, smokeFill);
    if (healthFraction < 0.35) this.circle(12 + drift, -20, 5 + Math.sin(elapsedSeconds * 17) * 1.4, 'rgba(249, 115, 22, 0.55)');
  }
  private drawBullets(bullets: readonly Bullet[], playerColor: string): void {
    const context = this.context;
    for (const bullet of bullets) {
      if (!bullet.alive) continue;
      if (bullet.faction === 'allies') {
        context.strokeStyle = playerColor; context.lineWidth = 3; context.beginPath(); context.moveTo(bullet.x, bullet.y + 9); context.lineTo(bullet.x, bullet.y - 9); context.stroke();
        this.circle(bullet.x, bullet.y - 6, 2, '#ecfeff');
      } else {
        const orbRadius = bullet.radius + 1.5;
        this.circle(bullet.x, bullet.y, orbRadius + 4.5, 'rgba(217, 70, 239, 0.18)');
        this.circle(bullet.x, bullet.y, orbRadius + 2, 'rgba(217, 70, 239, 0.28)');
        const orbGradient = context.createRadialGradient(bullet.x - orbRadius * 0.35, bullet.y - orbRadius * 0.35, 0.5, bullet.x, bullet.y, orbRadius);
        orbGradient.addColorStop(0, '#ffffff');
        orbGradient.addColorStop(0.35, '#f5d0fe');
        orbGradient.addColorStop(0.7, '#e879f9');
        orbGradient.addColorStop(1, '#a21caf');
        context.fillStyle = orbGradient;
        context.beginPath(); context.arc(bullet.x, bullet.y, orbRadius, 0, Math.PI * 2); context.fill();
        this.circle(bullet.x - orbRadius * 0.32, bullet.y - orbRadius * 0.38, Math.max(1.2, orbRadius * 0.22), 'rgba(255, 255, 255, 0.95)');
      }
    }
  }
  private drawPowerUps(powerUps: readonly PowerUp[], elapsedSeconds: number): void {
    const context = this.context;
    const labels: Record<string, string> = { spread: 'S', missiles: 'M', rail: 'R', shield: 'O', bomb: 'B' };
    const colors: Record<string, string> = { spread: '#22c55e', missiles: '#f59e0b', rail: '#38bdf8', shield: '#67e8f9', bomb: '#ef4444' };
    for (const powerUp of powerUps) {
      if (!powerUp.alive) continue;
      context.save(); context.translate(powerUp.x, powerUp.y);
      const pulse = 1 + Math.sin(elapsedSeconds * 6 + powerUp.x) * 0.08; context.scale(pulse, pulse);
      this.circle(0, 0, 11, colors[powerUp.kind] ?? '#facc15');
      context.strokeStyle = '#ffffff'; context.beginPath(); context.arc(0, 0, 11, 0, Math.PI * 2); context.stroke();
      context.fillStyle = '#111827'; context.font = 'bold 11px system-ui, sans-serif'; context.textAlign = 'center'; context.textBaseline = 'middle';
      context.fillText(labels[powerUp.kind] ?? '?', 0, 0); context.restore();
    }
  }
  private drawParticles(view: RendererView): void {
    const context = this.context; if (view.particles === null) return;
    view.particles.forEachAlive((particle) => { context.globalAlpha = particle.alpha; this.circle(particle.x, particle.y, particle.size, particle.color); });
    context.globalAlpha = 1;
  }
  private drawFloatingTexts(view: RendererView): void {
    const context = this.context; if (view.floatingTexts === null) return;
    context.font = 'bold 14px system-ui, sans-serif'; context.textAlign = 'center';
    view.floatingTexts.forEachAlive((entry) => { context.globalAlpha = entry.alpha; context.fillStyle = entry.color; context.fillText(entry.text, entry.x, entry.y); });
    context.globalAlpha = 1;
  }
  private drawBossBar(view: RendererView): void {
    if (view.bossHealthFraction < 0) return;
    this.rect(54, 12, PLAY_FIELD_WIDTH - 108, 10, 'rgba(0,0,0,0.55)');
    this.rect(56, 14, (PLAY_FIELD_WIDTH - 112) * clamp(view.bossHealthFraction, 0, 1), 6, '#dc2626');
    this.context.strokeStyle = 'rgba(255,255,255,0.7)'; this.context.strokeRect(54, 12, PLAY_FIELD_WIDTH - 108, 10);
  }
  private drawBanner(view: RendererView): void {
    if (view.bannerText.length === 0 || view.bannerAlpha <= 0) return;
    const context = this.context; context.globalAlpha = clamp(view.bannerAlpha, 0, 1);
    context.fillStyle = '#f8fafc'; context.font = '800 30px system-ui, sans-serif'; context.textAlign = 'center';
    context.shadowColor = 'rgba(0,0,0,0.7)'; context.shadowBlur = 8;
    context.fillText(view.bannerText, PLAY_FIELD_WIDTH / 2, 150); context.shadowBlur = 0; context.globalAlpha = 1;
  }
  private drawHitFlash(view: RendererView): void {
    if (view.hitFlashAlpha <= 0) return;
    this.rect(0, 0, PLAY_FIELD_WIDTH, PLAY_FIELD_HEIGHT, `rgba(239, 68, 68, ${clamp(view.hitFlashAlpha, 0, 0.45)})`);
  }
  private drawVignette(): void {
    const context = this.context;
    const gradient = context.createRadialGradient(240, 360, 210, 240, 360, 470);
    gradient.addColorStop(0, 'rgba(0,0,0,0)'); gradient.addColorStop(1, 'rgba(0,0,0,0.42)');
    context.fillStyle = gradient; context.fillRect(0, 0, PLAY_FIELD_WIDTH, PLAY_FIELD_HEIGHT);
  }
}
export function createRenderer(context: CanvasRenderingContext2D): Renderer { return new Renderer(context); }

