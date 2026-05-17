export type NormalAttackEventKind =
  | "spawn_bullet"
  | "spawn_bullet_spread"
  | "spawn_aimed_spread"
  | "spawn_radial"
  | "spawn_enemy_origin"
  | "fire_from_moving_origin"
  | "spawn_curved_laser"
  | "transform_bullet"
  | "radialBurst"
  | "aimedSpread"
  | "bossMirroredFan"
  | "polynomialProjectile"
  | "curvedLaserRing"
  | "warningZone"
  | "movingBlock"
  | "beatPulseRing"
  | "closingWalls"
  | "safeLaneShift"
  | "wallSweep"
  | "laserBeam"
  | "rotatingShape";

export type BuiltInAttackPackageKind =
  | "package_random_barrage"
  | "package_repeating_lasers"
  | "package_bomb_burst"
  | "package_random_circle"
  | "package_grid_square"
  | "package_lag_radial"
  | "package_split_lag_radial"
  | "package_random_lasers"
  | "package_center_lasers"
  | "package_area_parallel"
  | "package_snake_chain"
  | "package_enter_exit_bar"
  | "package_rotating_lasers"
  | "package_sequential_lasers";

export type CustomAttackPackageKind = `custom_${string}`;

export type AttackPackageKind = BuiltInAttackPackageKind | CustomAttackPackageKind;

export type AttackEventKind = NormalAttackEventKind | AttackPackageKind;

export type ZoneShape = "rectangle" | "circle" | "line" | "polygon";
export type BlockShape = "rectangle" | "triangle" | "circle" | "polygon";
export type PulseShape = "circle" | "square";
export type ClosingWallMode = "horizontal" | "vertical" | "all";
export type LaneOrientation = "vertical" | "horizontal";
export type BulletVisualPreset = "bullet" | "square" | "diamond" | "wall" | "laser";

export interface StageSize {
  width: number;
  height: number;
}

export interface BaseAttackEvent {
  id: string;
  kind: AttackEventKind;
  name: string;
  startTime: number;
  duration: number;
  color: number;
  visible?: boolean;
  timelineLane?: number;
  packageId?: string;
  packageLocked?: boolean;
}

export interface AttackPackageEvent extends BaseAttackEvent {
  [field: string]: unknown;
  kind: AttackPackageKind;
  packageType: AttackPackageKind;
  seed: number;
  generatedEventIds: string[];
  packageCount: number;
  packageAngleWidth: number;
  packageStartAngle: number;
  packageInterval: number;
  packageThickness: number;
  packageOrientation: LaneOrientation;
  packageX: number;
  packageY: number;
  packageAimAtPlayer: number;
  packageSplitAimAtPlayer: number;
  packageStartX: number;
  packageStartY: number;
  packageWidth: number;
  packageHeight: number;
  packageSize: number;
  packageBombSize: number;
  packageDuration: number;
  packageSplitDuration: number;
  packageFuseTime: number;
  packageBulletCount: number;
  packageSpeed: number;
  packageSplitSpeed: number;
  packageSplitStartAngle: number;
  packageDirectionDeg: number;
  packageDistance: number;
  packageRotationSpeed: number;
  packageWarningTime: number;
  packageWarningAlpha: number;
  packageSpacing: number;
  packageInitialPosition: number;
  packageLength: number;
  packagePolynomialA: number;
  packagePolynomialB: number;
  packagePolynomialC: number;
  packagePolynomialD: number;
}

export interface BulletMotionFields {
  originX: number;
  originY: number;
  originVx: number;
  originVy: number;
  polynomialA: number;
  polynomialB: number;
  polynomialC: number;
  polynomialD: number;
  pathStartX: number;
  pathSpeed: number;
  polarRadius: number;
  polarRadiusVelocity: number;
  polarTheta: number;
  polarThetaVelocity: number;
  gravity: number;
  angleSpeed: number;
  typeId: number;
  visualSize: number;
  visualPreset: BulletVisualPreset;
  visualWidth: number;
  visualHeight: number;
  visualAngle: number;
}

export interface FireClipFields {
  clipCount: number;
  clipInterval: number;
  clipRepeat: number;
  angleStepDeg: number;
  baseAngleDeg: number;
  aimAtPlayer: number;
}

export interface SpawnBulletEvent extends BaseAttackEvent, BulletMotionFields {
  kind: "spawn_bullet";
}

export interface SpawnBulletSpreadEvent extends BaseAttackEvent, BulletMotionFields, FireClipFields {
  kind: "spawn_bullet_spread";
}

export interface SpawnAimedSpreadEvent extends BaseAttackEvent, BulletMotionFields, FireClipFields {
  kind: "spawn_aimed_spread";
}

export interface SpawnRadialEvent extends BaseAttackEvent, BulletMotionFields {
  kind: "spawn_radial";
  aimAtPlayer: number;
  radialCount: number;
  radialRepeat: number;
  radialInterval: number;
  radialStartAngle: number;
}

export interface SpawnEnemyOriginEvent extends BaseAttackEvent, BulletMotionFields {
  kind: "spawn_enemy_origin";
  originSize: number;
}

export interface FireFromMovingOriginEvent extends BaseAttackEvent, BulletMotionFields, FireClipFields {
  kind: "fire_from_moving_origin";
}

export interface SpawnCurvedLaserEvent extends BaseAttackEvent, BulletMotionFields {
  kind: "spawn_curved_laser";
  laserCount: number;
  laserAngleStepDeg: number;
  laserWidth: number;
  laserLength: number;
  growSpeed: number;
}

export interface TransformBulletEvent extends BaseAttackEvent {
  kind: "transform_bullet";
  triggerTime: number;
  targetTypeId: number;
  nextTypeId: number;
  nextSpeed: number;
  nextAngleDeg: number;
}

export interface RadialBurstEvent extends BaseAttackEvent {
  kind: "radialBurst";
  x: number;
  y: number;
  bulletCount: number;
  bulletSpeed: number;
  bulletRadius: number;
  startAngle: number;
  arcDegrees: number;
  repeatCount: number;
  repeatInterval: number;
}

export interface AimedSpreadEvent extends BaseAttackEvent {
  kind: "aimedSpread";
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  wayCount: number;
  spreadDegrees: number;
  bulletSpeed: number;
  bulletRadius: number;
  fireCount: number;
  fireInterval: number;
  aimOffsetDegrees: number;
}

export interface BossMirroredFanEvent extends BaseAttackEvent {
  kind: "bossMirroredFan";
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  angleCount: number;
  speedLayers: number;
  angleStepDegrees: number;
  angleOffsetDegrees: number;
  minSpeed: number;
  speedStep: number;
  bulletRadius: number;
  fireCount: number;
  fireInterval: number;
}

export interface PolynomialProjectileEvent extends BaseAttackEvent {
  kind: "polynomialProjectile";
  x: number;
  y: number;
  originVx: number;
  originVy: number;
  bulletCount: number;
  spreadDegrees: number;
  startAngle: number;
  bulletSpeed: number;
  bulletRadius: number;
  curveA: number;
  curveB: number;
  thetaVelocity: number;
  gravity: number;
  fireCount: number;
  fireInterval: number;
}

export interface CurvedLaserRingEvent extends BaseAttackEvent {
  kind: "curvedLaserRing";
  x: number;
  y: number;
  laserCount: number;
  startAngle: number;
  width: number;
  length: number;
  extendSpeed: number;
  rotationSpeed: number;
  curveA: number;
  curveB: number;
}

export interface WarningZoneEvent extends BaseAttackEvent {
  kind: "warningZone";
  shape: ZoneShape;
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
  angle: number;
  sides: number;
  blinkRate: number;
  zoneAlpha: number;
}

export interface MovingBlockEvent extends BaseAttackEvent {
  kind: "movingBlock";
  shape: BlockShape;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  width: number;
  height: number;
  radius: number;
  sides: number;
  rotationStart: number;
  rotationSpeed: number;
  warningTime: number;
  warningAlpha: number;
}

export interface BeatPulseRingEvent extends BaseAttackEvent {
  kind: "beatPulseRing";
  shape: PulseShape;
  x: number;
  y: number;
  startSize: number;
  endSize: number;
  thickness: number;
  repeatCount: number;
  repeatInterval: number;
  warningTime: number;
  warningAlpha: number;
}

export interface ClosingWallsEvent extends BaseAttackEvent {
  kind: "closingWalls";
  mode: ClosingWallMode;
  distance: number;
  thickness: number;
  moveTime: number;
  holdTime: number;
  returnTime: number;
  warningTime: number;
  warningAlpha: number;
}

export interface SafeLaneShiftEvent extends BaseAttackEvent {
  kind: "safeLaneShift";
  orientation: LaneOrientation;
  laneWidth: number;
  firstLaneCenter: number;
  secondLaneCenter: number;
  switchInterval: number;
  switchCount: number;
  warningTime: number;
  warningAlpha: number;
}

export type WallEdge = "left" | "right" | "top" | "bottom";

export interface WallSweepEvent extends BaseAttackEvent {
  kind: "wallSweep";
  edge: WallEdge;
  thickness: number;
  length: number;
  offset: number;
  safeGapSize: number;
  safeGapCenter: number;
  warningTime: number;
  warningAlpha: number;
}

export interface LaserBeamEvent extends BaseAttackEvent {
  kind: "laserBeam";
  x: number;
  y: number;
  length: number;
  width: number;
  angle: number;
}

export interface RotatingShapeEvent extends BaseAttackEvent {
  kind: "rotatingShape";
  x: number;
  y: number;
  orbitRadius: number;
  size: number;
  sides: number;
  startAngle: number;
  rotationSpeed: number;
}

export type AttackEvent =
  | AttackPackageEvent
  | SpawnBulletEvent
  | SpawnBulletSpreadEvent
  | SpawnAimedSpreadEvent
  | SpawnRadialEvent
  | SpawnEnemyOriginEvent
  | FireFromMovingOriginEvent
  | SpawnCurvedLaserEvent
  | TransformBulletEvent
  | RadialBurstEvent
  | AimedSpreadEvent
  | BossMirroredFanEvent
  | PolynomialProjectileEvent
  | CurvedLaserRingEvent
  | WarningZoneEvent
  | MovingBlockEvent
  | BeatPulseRingEvent
  | ClosingWallsEvent
  | SafeLaneShiftEvent
  | WallSweepEvent
  | LaserBeamEvent
  | RotatingShapeEvent;

export interface BulletRuntime {
  id: string;
  eventId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: number;
  age: number;
  lifeTime: number;
}

export interface BulletPattern {
  version: 1;
  title: string;
  duration: number;
  stage: StageSize;
  timeline: TimelineSettings;
  timelineLaneCount?: number;
  events: AttackEvent[];
}

export interface TimelineSettings {
  musicOffset: number;
  bpm: number;
  beatsPerMeasure: number;
}

export interface AttackOccurrence {
  event: RadialBurstEvent;
  occurrenceTime: number;
  index: number;
}

export interface AttackFrame {
  bullets: BulletRender[];
  walls: WallRender[];
  lasers: LaserRender[];
  curvedLasers: CurvedLaserRender[];
  hazards: HazardRender[];
  warnings: HazardRender[];
  shapes: ShapeRender[];
}

export interface AttackRenderPrimitive {
  eventId: string;
  color: number;
  alpha: number;
}

export interface BulletRender extends AttackRenderPrimitive {
  trackId?: string;
  x: number;
  y: number;
  radius: number;
  angle?: number;
  typeId?: number;
  visualPreset?: BulletVisualPreset;
  width?: number;
  height?: number;
}

export interface WallRender extends AttackRenderPrimitive {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LaserRender extends AttackRenderPrimitive {
  x: number;
  y: number;
  length: number;
  width: number;
  angle: number;
}

export interface CurvedLaserRender extends AttackRenderPrimitive {
  points: Array<{ x: number; y: number }>;
  width: number;
}

export interface HazardRender extends AttackRenderPrimitive {
  shape: ZoneShape | BlockShape | PulseShape;
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
  rotation: number;
  sides: number;
  strokeWidth: number;
  filled: boolean;
  isWarning: boolean;
}

export interface ShapeRender extends AttackRenderPrimitive {
  x: number;
  y: number;
  radius: number;
  rotation: number;
  sides: number;
}
