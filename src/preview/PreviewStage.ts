import { Application, Assets, Container, Graphics, Sprite, type Texture } from "pixi.js";
import type { AttackEvent, AttackFrame, BulletRender, CurvedLaserRender, HazardRender, LaserRender, ShapeRender, StageSize } from "../core/types";

interface PreviewRenderState {
  frame: AttackFrame;
  currentTime: number;
  duration: number;
  events: AttackEvent[];
  selectedEventId?: string | null;
  editEventId?: string | null;
  trajectories?: TrajectoryRender[];
  playerAlpha?: number;
  packageHandles?: PackageHandleRender[];
  activePackageHandleId?: string | null;
  lightweight?: boolean;
}

interface TrajectoryRender {
  points: Array<{ x: number; y: number }>;
  color: number;
  alpha: number;
}

export interface PackageHandleRender {
  id: string;
  x: number;
  y: number;
  color: number;
  secondary?: boolean;
}

type PackageHandleDragPhase = "start" | "move" | "end";

export class PreviewStage {
  private readonly app = new Application();
  private readonly backgroundLayer = new Graphics();
  private readonly eventLayer = new Graphics();
  private readonly trajectoryLayer = new Graphics();
  private readonly attackLayer = new Graphics();
  private readonly bulletTextureLayer = new Container();
  private readonly hitEffectLayer = new Graphics();
  private readonly playerLayer = new Graphics();
  private playerPosition: { x: number; y: number };
  private pointerControlEnabled = true;
  private shakeUntil = 0;
  private hitEffectUntil = 0;
  private hitEffectPosition: { x: number; y: number };
  private packageHandles: PackageHandleRender[] = [];
  private activePackageHandleId: string | null = null;
  private draggingPackageHandleId: string | null = null;
  private eventLayerHasContent = false;
  private trajectoryLayerHasContent = false;
  private bulletTexture: Texture | null = null;
  private readonly bulletTextureSprites: Sprite[] = [];
  private packageHandleDragCallback?: (handleId: string, point: { x: number; y: number }, phase: PackageHandleDragPhase) => void;

  constructor(private readonly stageSize: StageSize) {
    this.playerPosition = {
      x: stageSize.width / 2,
      y: stageSize.height * 0.72,
    };
    this.hitEffectPosition = { ...this.playerPosition };
  }

  async mount(parent: HTMLElement): Promise<void> {
    await this.app.init({
      width: this.stageSize.width,
      height: this.stageSize.height,
      backgroundColor: 0x050505,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
    });

    this.app.canvas.className = "preview-canvas";
    this.app.canvas.style.touchAction = "none";
    parent.appendChild(this.app.canvas);

    this.app.stage.addChild(this.backgroundLayer);
    this.app.stage.addChild(this.trajectoryLayer);
    this.app.stage.addChild(this.attackLayer);
    this.app.stage.addChild(this.bulletTextureLayer);
    this.app.stage.addChild(this.eventLayer);
    this.app.stage.addChild(this.hitEffectLayer);
    this.app.stage.addChild(this.playerLayer);

    this.drawBackground();
    this.app.canvas.addEventListener("pointerdown", (event) => {
      const point = this.getCanvasStagePoint(event);
      const handle = this.findPackageHandleAt(point);

      if (!handle) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      this.draggingPackageHandleId = handle.id;
      this.activePackageHandleId = handle.id;
      this.app.canvas.setPointerCapture(event.pointerId);
      this.packageHandleDragCallback?.(handle.id, point, "start");
    });

    this.app.canvas.addEventListener("pointermove", (event) => {
      const point = this.getCanvasStagePoint(event);

      if (this.draggingPackageHandleId) {
        event.preventDefault();
        event.stopPropagation();
        this.packageHandleDragCallback?.(this.draggingPackageHandleId, point, "move");
        return;
      }

      if (!this.pointerControlEnabled) {
        return;
      }

      this.playerPosition = {
        x: clamp(point.x, 0, this.stageSize.width),
        y: clamp(point.y, 0, this.stageSize.height),
      };
    });

    const stopHandleDrag = (event: PointerEvent) => {
      if (!this.draggingPackageHandleId) {
        return;
      }

      const handleId = this.draggingPackageHandleId;
      const point = this.getCanvasStagePoint(event);

      event.preventDefault();
      event.stopPropagation();
      this.packageHandleDragCallback?.(handleId, point, "end");
      this.draggingPackageHandleId = null;

      if (this.app.canvas.hasPointerCapture(event.pointerId)) {
        this.app.canvas.releasePointerCapture(event.pointerId);
      }
    };

    this.app.canvas.addEventListener("pointerup", stopHandleDrag);
    this.app.canvas.addEventListener("pointercancel", stopHandleDrag);
  }

  onTick(callback: (deltaSeconds: number) => void): void {
    let previousTime = performance.now();

    const tick = (time: number) => {
      callback(Math.min((time - previousTime) / 1000, 0.1));
      previousTime = time;
      window.requestAnimationFrame(tick);
    };

    window.requestAnimationFrame(tick);
  }

  getPlayerPosition(): { x: number; y: number } {
    return { ...this.playerPosition };
  }

  setPointerControlEnabled(enabled: boolean): void {
    this.pointerControlEnabled = enabled;
  }

  setPackageHandleDragCallback(callback: (handleId: string, point: { x: number; y: number }, phase: PackageHandleDragPhase) => void): void {
    this.packageHandleDragCallback = callback;
  }

  setPlayerPosition(x: number, y: number): void {
    this.playerPosition = {
      x: clamp(x, 0, this.stageSize.width),
      y: clamp(y, 0, this.stageSize.height),
    };
  }

  movePlayer(dx: number, dy: number): void {
    this.setPlayerPosition(this.playerPosition.x + dx, this.playerPosition.y + dy);
  }

  resetPlayerPosition(): void {
    this.setPlayerPosition(this.stageSize.width / 2, this.stageSize.height * 0.72);
  }

  resize(cssWidth: number, cssHeight: number): void {
    this.app.canvas.style.width = `${Math.max(1, Math.floor(cssWidth))}px`;
    this.app.canvas.style.height = `${Math.max(1, Math.floor(cssHeight))}px`;
  }

  triggerHitShake(): void {
    this.shakeUntil = Math.max(this.shakeUntil, performance.now() + 180);
    this.hitEffectUntil = Math.max(this.hitEffectUntil, performance.now() + 360);
    this.hitEffectPosition = { ...this.playerPosition };
  }

  async setBulletTexture(dataUrl: string | null): Promise<void> {
    if (!dataUrl) {
      this.bulletTexture = null;
      this.hideBulletTextureSprites(0);
      return;
    }

    this.bulletTexture = await Assets.load<Texture>(dataUrl);

    for (const sprite of this.bulletTextureSprites) {
      sprite.texture = this.bulletTexture;
    }
  }

  render(state: PreviewRenderState): void {
    this.applyShake();
    this.packageHandles = state.packageHandles ?? [];
    this.activePackageHandleId = this.draggingPackageHandleId ?? state.activePackageHandleId ?? null;
    const trajectories = state.trajectories ?? [];

    if (!state.lightweight || this.packageHandles.length > 0 || this.eventLayerHasContent) {
      this.drawEvents(state.events, state.currentTime, state.selectedEventId ?? null, state.editEventId ?? null);
      this.eventLayerHasContent = this.packageHandles.length > 0;
    }

    if (!state.lightweight || trajectories.length > 0 || this.trajectoryLayerHasContent) {
      this.drawTrajectories(trajectories);
      this.trajectoryLayerHasContent = trajectories.length > 0;
    }

    this.drawAttackFrame(state.frame);
    this.drawHitEffect();
    this.drawPlayer(state.playerAlpha ?? 1);
  }

  private applyShake(): void {
    const remaining = this.shakeUntil - performance.now();

    if (remaining <= 0) {
      this.app.stage.position.set(0, 0);
      return;
    }

    const power = Math.max(0, Math.min(1, remaining / 180)) * 5;
    this.app.stage.position.set((Math.random() - 0.5) * power, (Math.random() - 0.5) * power);
  }

  private drawBackground(): void {
    const { width, height } = this.stageSize;

    this.backgroundLayer.clear();
    this.backgroundLayer.rect(0, 0, width, height).fill(0x070707);

    this.backgroundLayer
      .rect(18, 18, width - 36, height - 36)
      .stroke({ width: 2, color: 0xffffff, alpha: 0.12 });
  }

  private drawEvents(events: AttackEvent[], currentTime: number, selectedEventId: string | null, editEventId: string | null): void {
    void events;
    void currentTime;
    void selectedEventId;
    void editEventId;
    this.eventLayer.clear();

    for (const handle of this.packageHandles) {
      this.drawPackageHandle(handle);
    }
  }

  private drawPackageHandle(handle: PackageHandleRender): void {
    const active = handle.id === this.activePackageHandleId;
    const radius = active ? 14 : 12;
    const lineAlpha = active ? 0.96 : 0.72;
    const fillAlpha = handle.secondary ? 0.72 : 0.92;

    this.eventLayer.circle(handle.x, handle.y, radius + 5).stroke({ width: 2, color: 0xffffff, alpha: active ? 0.34 : 0.18 });
    this.eventLayer.circle(handle.x, handle.y, radius).fill({ color: handle.color, alpha: fillAlpha });
    this.eventLayer.circle(handle.x, handle.y, radius).stroke({ width: 2, color: 0xffffff, alpha: lineAlpha });
    this.eventLayer.moveTo(handle.x - radius - 8, handle.y);
    this.eventLayer.lineTo(handle.x - 4, handle.y);
    this.eventLayer.moveTo(handle.x + 4, handle.y);
    this.eventLayer.lineTo(handle.x + radius + 8, handle.y);
    this.eventLayer.moveTo(handle.x, handle.y - radius - 8);
    this.eventLayer.lineTo(handle.x, handle.y - 4);
    this.eventLayer.moveTo(handle.x, handle.y + 4);
    this.eventLayer.lineTo(handle.x, handle.y + radius + 8);
    this.eventLayer.stroke({ width: active ? 2 : 1.5, color: 0xffffff, alpha: lineAlpha });
  }

  private drawTrajectories(trajectories: TrajectoryRender[]): void {
    this.trajectoryLayer.clear();

    for (const trajectory of trajectories) {
      if (trajectory.points.length < 2) {
        continue;
      }

      const [firstPoint, ...restPoints] = trajectory.points;

      this.trajectoryLayer.moveTo(firstPoint.x, firstPoint.y);

      for (const point of restPoints) {
        this.trajectoryLayer.lineTo(point.x, point.y);
      }

      this.trajectoryLayer.stroke({ width: 2, color: trajectory.color, alpha: trajectory.alpha });

      for (let index = 0; index < trajectory.points.length; index += 8) {
        const point = trajectory.points[index];

        this.trajectoryLayer.circle(point.x, point.y, 2).fill({ color: trajectory.color, alpha: Math.min(1, trajectory.alpha + 0.2) });
      }
    }
  }

  private drawAttackFrame(frame: AttackFrame): void {
    this.attackLayer.clear();
    let texturedBulletCount = 0;

    for (const warning of frame.warnings) {
      this.drawHazard(warning);
    }

    for (const hazard of frame.hazards) {
      this.drawHazard(hazard);
    }

    for (const wall of frame.walls) {
      if (this.isRectOutsideStage(wall.x, wall.y, wall.width, wall.height)) {
        continue;
      }

      this.attackLayer.rect(wall.x, wall.y, wall.width, wall.height).fill({
        color: wall.color,
        alpha: wall.alpha,
      });
    }

    for (const laser of frame.lasers) {
      this.drawLaser(laser);
    }

    for (const laser of frame.curvedLasers) {
      this.drawCurvedLaser(laser);
    }

    for (const shape of frame.shapes) {
      this.drawShape(shape);
    }

    for (const bullet of frame.bullets) {
      if (this.bulletTexture && getVisualPresetFromTypeId(bullet.typeId) === "bullet") {
        texturedBulletCount = this.drawTexturedBullet(bullet, texturedBulletCount);
        continue;
      }

      this.drawBullet(bullet);
    }

    this.hideBulletTextureSprites(texturedBulletCount);
  }

  private drawPlayer(alpha: number): void {
    const { x, y } = this.playerPosition;
    const size = 12;

    this.playerLayer.clear();
    this.playerLayer.rect(x - size / 2, y - size / 2, size, size).fill({ color: 0x27dfff, alpha });
  }

  private drawHitEffect(): void {
    const remaining = this.hitEffectUntil - performance.now();

    this.hitEffectLayer.clear();

    if (remaining <= 0) {
      return;
    }

    const duration = 360;
    const progress = 1 - clamp(remaining / duration, 0, 1);
    const fade = 1 - progress;
    const radius = 20 + progress * 90;
    const { x, y } = this.hitEffectPosition;

    this.hitEffectLayer.rect(0, 0, this.stageSize.width, this.stageSize.height).fill({ color: 0xff2f4f, alpha: 0.16 * fade });
    this.hitEffectLayer.circle(x, y, radius).stroke({ width: Math.max(2, 7 * fade), color: 0xffffff, alpha: 0.8 * fade });
    this.hitEffectLayer.circle(x, y, radius * 0.55).stroke({ width: Math.max(1, 4 * fade), color: 0xff2f4f, alpha: 0.9 * fade });
  }

  private drawBullet(bullet: BulletRender): void {
    const preset = getVisualPresetFromTypeId(bullet.typeId);
    const angleDegrees = ((bullet.angle ?? 0) * 180) / Math.PI;

    if (preset === "wall" || preset === "laser") {
      const width = Math.max(1, bullet.width ?? bullet.radius * (preset === "laser" ? 18 : 6));
      const height = Math.max(1, bullet.height ?? bullet.radius * (preset === "laser" ? 2 : 12));

      if (this.isRotatedRectOutsideStage(bullet.x, bullet.y, width, height)) {
        return;
      }

      const points = buildRotatedRectPoints(bullet.x, bullet.y, width, height, angleDegrees);

      this.attackLayer.poly(points).fill({ color: bullet.color, alpha: bullet.alpha });
      return;
    }

    if (preset === "square") {
      const size = Math.max(1, bullet.width ?? bullet.radius * 2);
      const height = Math.max(1, bullet.height ?? size);

      if (this.isRotatedRectOutsideStage(bullet.x, bullet.y, size, height)) {
        return;
      }

      const points = buildRotatedRectPoints(bullet.x, bullet.y, size, height, angleDegrees);

      this.attackLayer.poly(points).fill({ color: bullet.color, alpha: bullet.alpha });
      return;
    }

    if (preset === "diamond") {
      const radiusX = Math.max(1, (bullet.width ?? bullet.radius * 2) / 2);
      const radiusY = Math.max(1, (bullet.height ?? bullet.radius * 2) / 2);

      if (this.isCircleOutsideStage(bullet.x, bullet.y, Math.hypot(radiusX, radiusY))) {
        return;
      }

      const points = buildDiamondPoints(
        bullet.x,
        bullet.y,
        radiusX,
        radiusY,
        angleDegrees,
      );

      this.attackLayer.poly(points).fill({ color: bullet.color, alpha: bullet.alpha });
      return;
    }

    if (this.isCircleOutsideStage(bullet.x, bullet.y, bullet.radius)) {
      return;
    }

    this.attackLayer.circle(bullet.x, bullet.y, bullet.radius).fill({
      color: bullet.color,
      alpha: bullet.alpha,
    });
  }

  private getCanvasStagePoint(event: PointerEvent): { x: number; y: number } {
    const bounds = this.app.canvas.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / Math.max(1, bounds.width)) * this.stageSize.width;
    const y = ((event.clientY - bounds.top) / Math.max(1, bounds.height)) * this.stageSize.height;

    return {
      x: clamp(x, 0, this.stageSize.width),
      y: clamp(y, 0, this.stageSize.height),
    };
  }

  private findPackageHandleAt(point: { x: number; y: number }): PackageHandleRender | undefined {
    const hitRadius = 24;
    let nearestHandle: PackageHandleRender | undefined;
    let nearestDistanceSq = hitRadius * hitRadius;

    for (const handle of this.packageHandles) {
      const dx = handle.x - point.x;
      const dy = handle.y - point.y;
      const distanceSq = dx * dx + dy * dy;

      if (distanceSq <= nearestDistanceSq) {
        nearestDistanceSq = distanceSq;
        nearestHandle = handle;
      }
    }

    return nearestHandle;
  }

  private drawHazard(hazard: HazardRender): void {
    const alpha = hazard.alpha;
    const strokeAlpha = Math.min(1, hazard.alpha + 0.18);

    if (hazard.shape === "circle") {
      if (this.isCircleOutsideStage(hazard.x, hazard.y, hazard.radius + hazard.strokeWidth)) {
        return;
      }

      if (hazard.filled) {
        this.attackLayer.circle(hazard.x, hazard.y, hazard.radius).fill({ color: hazard.color, alpha });
      }

      if (hazard.isWarning || !hazard.filled) {
        this.attackLayer.circle(hazard.x, hazard.y, hazard.radius).stroke({
          width: hazard.strokeWidth,
          color: hazard.color,
          alpha: strokeAlpha,
        });
      }
      return;
    }

    if (hazard.shape === "line") {
      if (this.isRotatedRectOutsideStage(hazard.x, hazard.y, hazard.width, hazard.strokeWidth)) {
        return;
      }

      const linePoints = buildRotatedRectPoints(hazard.x, hazard.y, hazard.width, hazard.strokeWidth, hazard.rotation);

      this.attackLayer.poly(linePoints).fill({ color: hazard.color, alpha: strokeAlpha });
      return;
    }

    if (
      hazard.shape === "rectangle" || hazard.shape === "square"
        ? this.isRotatedRectOutsideStage(hazard.x, hazard.y, hazard.width, hazard.height)
        : this.isCircleOutsideStage(hazard.x, hazard.y, hazard.radius + hazard.strokeWidth)
    ) {
      return;
    }

    const points =
      hazard.shape === "rectangle" || hazard.shape === "square"
          ? buildRotatedRectPoints(hazard.x, hazard.y, hazard.width, hazard.height, hazard.rotation)
          : buildRegularPolygonPoints(hazard.x, hazard.y, hazard.radius, hazard.sides, hazard.rotation, hazard.shape === "triangle" ? 3 : undefined);

    if (hazard.filled) {
      this.attackLayer.poly(points).fill({ color: hazard.color, alpha });
    }

    if (hazard.isWarning || !hazard.filled) {
      this.attackLayer.poly(points).stroke({
        width: hazard.strokeWidth,
        color: hazard.color,
        alpha: strokeAlpha,
      });
    }
  }

  private drawLaser(laser: LaserRender): void {
    if (this.isRotatedRectOutsideStage(laser.x, laser.y, laser.length, laser.width)) {
      return;
    }

    const points = buildRotatedRectPoints(laser.x, laser.y, laser.length, laser.width, laser.angle);

    this.attackLayer.poly(points).fill({
      color: laser.color,
      alpha: laser.alpha,
    });
  }

  private drawCurvedLaser(laser: CurvedLaserRender): void {
    if (laser.points.length < 2) {
      return;
    }

    if (this.arePointsOutsideStage(laser.points, laser.width)) {
      return;
    }

    const [firstPoint, ...restPoints] = laser.points;

    this.attackLayer.moveTo(firstPoint.x, firstPoint.y);

    for (const point of restPoints) {
      this.attackLayer.lineTo(point.x, point.y);
    }

    this.attackLayer.stroke({ width: laser.width, color: laser.color, alpha: laser.alpha });

    const lastPoint = laser.points[laser.points.length - 1];

    this.attackLayer.circle(firstPoint.x, firstPoint.y, laser.width / 2).fill({ color: laser.color, alpha: laser.alpha });
    this.attackLayer.circle(lastPoint.x, lastPoint.y, laser.width / 2).fill({ color: laser.color, alpha: laser.alpha });
  }

  private drawShape(shape: ShapeRender): void {
    if (this.isCircleOutsideStage(shape.x, shape.y, shape.radius)) {
      return;
    }

    const points: number[] = [];

    for (let index = 0; index < shape.sides; index += 1) {
      const angle = shape.rotation + (Math.PI * 2 * index) / shape.sides - Math.PI / 2;
      points.push(shape.x + Math.cos(angle) * shape.radius, shape.y + Math.sin(angle) * shape.radius);
    }

    this.attackLayer.poly(points).fill({
      color: shape.color,
      alpha: shape.alpha,
    });
  }

  private drawTexturedBullet(bullet: BulletRender, index: number): number {
    if (!this.bulletTexture || this.isCircleOutsideStage(bullet.x, bullet.y, bullet.radius)) {
      return index;
    }

    const sprite = this.getBulletTextureSprite(index);
    const size = Math.max(1, bullet.radius * 2);

    sprite.texture = this.bulletTexture;
    sprite.visible = true;
    sprite.alpha = bullet.alpha;
    sprite.rotation = bullet.angle ?? 0;
    sprite.position.set(bullet.x, bullet.y);
    sprite.setSize(size, size);

    return index + 1;
  }

  private getBulletTextureSprite(index: number): Sprite {
    const existing = this.bulletTextureSprites[index];

    if (existing) {
      return existing;
    }

    const sprite = new Sprite(this.bulletTexture ?? undefined);

    sprite.anchor.set(0.5);
    this.bulletTextureLayer.addChild(sprite);
    this.bulletTextureSprites.push(sprite);
    return sprite;
  }

  private hideBulletTextureSprites(activeCount: number): void {
    for (let index = activeCount; index < this.bulletTextureSprites.length; index += 1) {
      this.bulletTextureSprites[index].visible = false;
    }
  }

  private isCircleOutsideStage(x: number, y: number, radius: number): boolean {
    return x + radius < 0 || x - radius > this.stageSize.width || y + radius < 0 || y - radius > this.stageSize.height;
  }

  private isRectOutsideStage(x: number, y: number, width: number, height: number): boolean {
    return x + width < 0 || x > this.stageSize.width || y + height < 0 || y > this.stageSize.height;
  }

  private isRotatedRectOutsideStage(x: number, y: number, width: number, height: number): boolean {
    return this.isCircleOutsideStage(x, y, Math.hypot(width, height) / 2);
  }

  private arePointsOutsideStage(points: Array<{ x: number; y: number }>, padding: number): boolean {
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    for (const point of points) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }

    return maxX + padding < 0 || minX - padding > this.stageSize.width || maxY + padding < 0 || minY - padding > this.stageSize.height;
  }
}

function getVisualPresetFromTypeId(typeId: number | undefined): "bullet" | "square" | "diamond" | "wall" | "laser" {
  switch (Math.round(typeId ?? 0)) {
    case 1:
      return "square";
    case 2:
      return "diamond";
    case 3:
      return "wall";
    case 4:
      return "laser";
    default:
      return "bullet";
  }
}

function getEventAnchor(event: AttackEvent, stage: StageSize): { x: number; y: number } {
  switch (event.kind) {
    case "spawn_bullet":
    case "spawn_bullet_spread":
    case "spawn_aimed_spread":
    case "spawn_radial":
    case "spawn_enemy_origin":
    case "fire_from_moving_origin":
    case "spawn_curved_laser":
      return { x: event.originX, y: event.originY };
    case "transform_bullet":
      return { x: stage.width / 2, y: stage.height / 2 };
    case "radialBurst":
    case "aimedSpread":
    case "bossMirroredFan":
    case "polynomialProjectile":
    case "curvedLaserRing":
    case "warningZone":
    case "laserBeam":
    case "rotatingShape":
      return { x: event.x, y: event.y };
    case "movingBlock":
      return { x: event.startX, y: event.startY };
    case "beatPulseRing":
      return { x: event.x, y: event.y };
    case "closingWalls":
      return { x: stage.width / 2, y: stage.height / 2 };
    case "safeLaneShift":
      return event.orientation === "vertical"
        ? { x: event.firstLaneCenter, y: stage.height / 2 }
        : { x: stage.width / 2, y: event.firstLaneCenter };
    case "wallSweep":
      return event.edge === "left" || event.edge === "right"
        ? { x: event.edge === "left" ? 24 : stage.width - 24, y: event.offset }
        : { x: event.offset, y: event.edge === "top" ? 24 : stage.height - 24 };
  }

  return "packageX" in event ? { x: event.packageX, y: event.packageY } : { x: stage.width / 2, y: stage.height / 2 };
}

function buildSegmentRectPoints(startX: number, startY: number, endX: number, endY: number, width: number): number[] {
  const dx = endX - startX;
  const dy = endY - startY;
  const length = Math.hypot(dx, dy) || 1;
  const nx = (-dy / length) * (width / 2);
  const ny = (dx / length) * (width / 2);

  return [startX + nx, startY + ny, endX + nx, endY + ny, endX - nx, endY - ny, startX - nx, startY - ny];
}

function buildRegularPolygonPoints(x: number, y: number, radius: number, sides: number, rotationDegrees: number, fixedSides?: number): number[] {
  const safeSides = Math.max(3, Math.round(fixedSides ?? sides));
  const rotation = (rotationDegrees * Math.PI) / 180;
  const points: number[] = [];

  for (let index = 0; index < safeSides; index += 1) {
    const angle = rotation + (Math.PI * 2 * index) / safeSides - Math.PI / 2;
    points.push(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius);
  }

  return points;
}

function buildRotatedRectPoints(x: number, y: number, length: number, width: number, angleDegrees: number): number[] {
  const halfLength = length / 2;
  const halfWidth = width / 2;
  const angle = (angleDegrees * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const x1 = -halfLength;
  const y1 = -halfWidth;
  const x2 = halfLength;
  const y2 = halfWidth;

  return [
    x + x1 * cos - y1 * sin,
    y + x1 * sin + y1 * cos,
    x + x2 * cos - y1 * sin,
    y + x2 * sin + y1 * cos,
    x + x2 * cos - y2 * sin,
    y + x2 * sin + y2 * cos,
    x + x1 * cos - y2 * sin,
    y + x1 * sin + y2 * cos,
  ];
}

function buildDiamondPoints(x: number, y: number, radiusX: number, radiusY: number, angleDegrees: number): number[] {
  const angle = (angleDegrees * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  return [
    x + radiusY * sin,
    y - radiusY * cos,
    x + radiusX * cos,
    y + radiusX * sin,
    x - radiusY * sin,
    y + radiusY * cos,
    x - radiusX * cos,
    y - radiusX * sin,
  ];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
