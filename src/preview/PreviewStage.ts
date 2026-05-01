import { Application, Graphics } from "pixi.js";
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
}

interface TrajectoryRender {
  points: Array<{ x: number; y: number }>;
  color: number;
  alpha: number;
}

export class PreviewStage {
  private readonly app = new Application();
  private readonly backgroundLayer = new Graphics();
  private readonly eventLayer = new Graphics();
  private readonly trajectoryLayer = new Graphics();
  private readonly attackLayer = new Graphics();
  private readonly hitEffectLayer = new Graphics();
  private readonly playerLayer = new Graphics();
  private playerPosition: { x: number; y: number };
  private pointerControlEnabled = true;
  private shakeUntil = 0;
  private hitEffectUntil = 0;
  private hitEffectPosition: { x: number; y: number };

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
    parent.appendChild(this.app.canvas);

    this.app.stage.addChild(this.backgroundLayer);
    this.app.stage.addChild(this.eventLayer);
    this.app.stage.addChild(this.trajectoryLayer);
    this.app.stage.addChild(this.attackLayer);
    this.app.stage.addChild(this.hitEffectLayer);
    this.app.stage.addChild(this.playerLayer);

    this.drawBackground();
    this.app.canvas.addEventListener("pointermove", (event) => {
      if (!this.pointerControlEnabled) {
        return;
      }

      const bounds = this.app.canvas.getBoundingClientRect();
      const x = ((event.clientX - bounds.left) / bounds.width) * this.stageSize.width;
      const y = ((event.clientY - bounds.top) / bounds.height) * this.stageSize.height;

      this.playerPosition = {
        x: clamp(x, 0, this.stageSize.width),
        y: clamp(y, 0, this.stageSize.height),
      };
    });

  }

  onTick(callback: (deltaSeconds: number) => void): void {
    let previousTime = performance.now();

    window.setInterval(() => {
      const time = performance.now();
      callback((time - previousTime) / 1000);
      previousTime = time;
    }, 1000 / 60);
  }

  getPlayerPosition(): { x: number; y: number } {
    return { ...this.playerPosition };
  }

  setPointerControlEnabled(enabled: boolean): void {
    this.pointerControlEnabled = enabled;
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

  render(state: PreviewRenderState): void {
    this.applyShake();
    this.drawEvents(state.events, state.currentTime, state.selectedEventId ?? null, state.editEventId ?? null);
    this.drawTrajectories(state.trajectories ?? []);
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

    for (const warning of frame.warnings) {
      this.drawHazard(warning);
    }

    for (const hazard of frame.hazards) {
      this.drawHazard(hazard);
    }

    for (const wall of frame.walls) {
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
      this.drawBullet(bullet);
    }
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
      const points = buildRotatedRectPoints(bullet.x, bullet.y, width, height, angleDegrees);

      this.attackLayer.poly(points).fill({ color: bullet.color, alpha: bullet.alpha });
      return;
    }

    if (preset === "square") {
      const size = Math.max(1, bullet.width ?? bullet.radius * 2);
      const points = buildRotatedRectPoints(bullet.x, bullet.y, size, Math.max(1, bullet.height ?? size), angleDegrees);

      this.attackLayer.poly(points).fill({ color: bullet.color, alpha: bullet.alpha });
      return;
    }

    if (preset === "diamond") {
      const points = buildDiamondPoints(
        bullet.x,
        bullet.y,
        Math.max(1, (bullet.width ?? bullet.radius * 2) / 2),
        Math.max(1, (bullet.height ?? bullet.radius * 2) / 2),
        angleDegrees,
      );

      this.attackLayer.poly(points).fill({ color: bullet.color, alpha: bullet.alpha });
      return;
    }

    this.attackLayer.circle(bullet.x, bullet.y, bullet.radius).fill({
      color: bullet.color,
      alpha: bullet.alpha,
    });
  }

  private drawHazard(hazard: HazardRender): void {
    const alpha = hazard.alpha;
    const strokeAlpha = Math.min(1, hazard.alpha + 0.18);

    if (hazard.shape === "circle") {
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
      const linePoints = buildRotatedRectPoints(hazard.x, hazard.y, hazard.width, hazard.strokeWidth, hazard.rotation);

      this.attackLayer.poly(linePoints).fill({ color: hazard.color, alpha: strokeAlpha });
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
  const corners = [
    { x: -halfLength, y: -halfWidth },
    { x: halfLength, y: -halfWidth },
    { x: halfLength, y: halfWidth },
    { x: -halfLength, y: halfWidth },
  ];

  return corners.flatMap((corner) => [x + corner.x * cos - corner.y * sin, y + corner.x * sin + corner.y * cos]);
}

function buildDiamondPoints(x: number, y: number, radiusX: number, radiusY: number, angleDegrees: number): number[] {
  const angle = (angleDegrees * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const points = [
    { x: 0, y: -radiusY },
    { x: radiusX, y: 0 },
    { x: 0, y: radiusY },
    { x: -radiusX, y: 0 },
  ];

  return points.flatMap((point) => [x + point.x * cos - point.y * sin, y + point.x * sin + point.y * cos]);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
