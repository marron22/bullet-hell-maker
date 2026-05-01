import { createAttackEvent } from "./eventFactory";
import type {
  AttackEvent,
  AttackPackageEvent,
  AttackPackageKind,
  BeatPulseRingEvent,
  BulletMotionFields,
  MovingBlockEvent,
  SpawnBulletSpreadEvent,
  SpawnRadialEvent,
  StageSize,
  WarningZoneEvent,
} from "./types";

export interface PackageFieldConfig {
  name: keyof AttackPackageEvent & string;
  label: string;
  min?: number;
  max?: number;
  step?: number;
  integer?: boolean;
  type?: "number" | "select";
  options?: Array<{ value: string; label: string }>;
  packages: AttackPackageKind[];
}

export const packageKinds: AttackPackageKind[] = [
  "package_random_barrage",
  "package_repeating_lasers",
  "package_bomb_burst",
  "package_random_circle",
  "package_grid_square",
  "package_lag_radial",
  "package_random_lasers",
  "package_center_lasers",
  "package_area_parallel",
  "package_snake_chain",
  "package_enter_exit_bar",
  "package_rotating_lasers",
  "package_sequential_lasers",
];

const allPackages = packageKinds;
const field = (
  name: keyof AttackPackageEvent & string,
  label: string,
  packages: AttackPackageKind[],
  min = 0,
  max = 9999,
  step = 1,
  integer = false,
): PackageFieldConfig => ({ name, label, packages, min, max, step, integer, type: "number" });

export const packageFieldConfigs: PackageFieldConfig[] = [
  field("startTime", "startTime", allPackages, 0, 999, 0.1),
  field("packageDuration", "duration", allPackages, 0.05, 30, 0.1),
  field("packageWarningTime", "warningTime", [
    "package_repeating_lasers",
    "package_random_circle",
    "package_grid_square",
    "package_random_lasers",
    "package_center_lasers",
    "package_enter_exit_bar",
    "package_rotating_lasers",
    "package_sequential_lasers",
  ], 0, 5, 0.1),
  field("packageWarningAlpha", "warningAlpha", [
    "package_repeating_lasers",
    "package_random_circle",
    "package_grid_square",
    "package_random_lasers",
    "package_center_lasers",
    "package_enter_exit_bar",
    "package_rotating_lasers",
    "package_sequential_lasers",
  ], 0.02, 1, 0.05),
  field("packageCount", "count", [
    "package_random_barrage",
    "package_repeating_lasers",
    "package_random_circle",
    "package_grid_square",
    "package_lag_radial",
    "package_random_lasers",
    "package_center_lasers",
    "package_area_parallel",
    "package_snake_chain",
    "package_rotating_lasers",
  ], 1, 128, 1, true),
  field("packageBulletCount", "bulletCount", [
    "package_bomb_burst",
    "package_lag_radial",
  ], 1, 160, 1, true),
  field("packageFuseTime", "fuseTime", [
    "package_bomb_burst",
  ], 0.1, 20, 0.1),
  field("packageAngleWidth", "angleWidth", [
    "package_random_barrage",
    "package_bomb_burst",
    "package_lag_radial",
  ], 0, 360, 1),
  field("packageInterval", "interval", [
    "package_random_barrage",
    "package_repeating_lasers",
    "package_random_circle",
    "package_grid_square",
    "package_lag_radial",
    "package_area_parallel",
    "package_snake_chain",
    "package_sequential_lasers",
  ], 0, 5, 0.05),
  field("packageThickness", "thickness", [
    "package_repeating_lasers",
    "package_random_lasers",
    "package_center_lasers",
    "package_enter_exit_bar",
    "package_rotating_lasers",
    "package_sequential_lasers",
  ], 1, 220, 1),
  {
    name: "packageOrientation",
    label: "orientation",
    type: "select",
    packages: [
      "package_repeating_lasers",
      "package_area_parallel",
      "package_enter_exit_bar",
      "package_sequential_lasers",
    ],
    options: [
      { value: "horizontal", label: "Horizontal" },
      { value: "vertical", label: "Vertical" },
    ],
  },
  field("packageX", "x", [
    "package_random_barrage",
    "package_bomb_burst",
    "package_area_parallel",
    "package_enter_exit_bar",
  ], -1000, 2000, 1),
  field("packageY", "y", [
    "package_random_barrage",
    "package_bomb_burst",
    "package_area_parallel",
    "package_enter_exit_bar",
  ], -1000, 2000, 1),
  field("packageStartX", "startX", [
    "package_bomb_burst",
  ], -1600, 2400, 1),
  field("packageStartY", "startY", [
    "package_bomb_burst",
  ], -1200, 1800, 1),
  field("packageWidth", "width", [
    "package_area_parallel",
    "package_grid_square",
  ], 8, 1600, 1),
  field("packageHeight", "height", [
    "package_area_parallel",
    "package_grid_square",
  ], 8, 1200, 1),
  field("packageSize", "size", [
    "package_random_circle",
    "package_grid_square",
    "package_snake_chain",
  ], 4, 800, 1),
  field("packageSpeed", "speed", [
    "package_random_barrage",
    "package_bomb_burst",
    "package_area_parallel",
    "package_snake_chain",
    "package_enter_exit_bar",
  ], 0, 1600, 5),
  field("packageDistance", "distance", [
    "package_sequential_lasers",
  ], 1, 800, 1),
  field("packageSpacing", "spacing", [
    "package_snake_chain",
  ], 0, 2, 0.02),
  field("packageInitialPosition", "initialPosition", [
    "package_sequential_lasers",
  ], -1200, 2000, 1),
  field("packageLength", "length", [
    "package_enter_exit_bar",
    "package_rotating_lasers",
    "package_sequential_lasers",
  ], 20, 2000, 1),
  field("packageRotationSpeed", "rotationSpeed", [
    "package_rotating_lasers",
  ], -720, 720, 5),
  field("packagePolynomialA", "polynomial x", [
    "package_snake_chain",
  ], -8, 8, 0.05),
  field("packagePolynomialB", "polynomial x^2", [
    "package_snake_chain",
  ], -8, 8, 0.05),
  field("packagePolynomialC", "polynomial x^3", [
    "package_snake_chain",
  ], -8, 8, 0.05),
  field("packagePolynomialD", "polynomial x^4", [
    "package_snake_chain",
  ], -8, 8, 0.05),
  field("seed", "seed", allPackages, 1, 999999, 1, true),
];

let packageSerial = 5000;

export function isAttackPackageKind(kind: string): kind is AttackPackageKind {
  return (packageKinds as string[]).includes(kind);
}

export function isAttackPackageEvent(event: AttackEvent | undefined): event is AttackPackageEvent {
  return Boolean(event && isAttackPackageKind(event.kind));
}

export function createAttackPackageEvent(kind: AttackPackageKind, startTime: number, stage: StageSize): AttackPackageEvent {
  const base: AttackPackageEvent = {
    id: `package_${kind}_${packageSerial++}`,
    kind,
    packageType: kind,
    name: getPackageKindLabel(kind),
    startTime: Number(startTime.toFixed(2)),
    duration: 4,
    color: getPackageColor(kind),
    visible: true,
    timelineLane: 0,
    seed: Math.floor(1000 + Math.random() * 900000),
    generatedEventIds: [],
    packageCount: 6,
    packageAngleWidth: 120,
    packageInterval: 0.25,
    packageThickness: 18,
    packageOrientation: "horizontal",
    packageX: stage.width / 2,
    packageY: stage.height / 2,
    packageStartX: -80,
    packageStartY: stage.height / 2,
    packageWidth: stage.width * 0.6,
    packageHeight: stage.height * 0.5,
    packageSize: 120,
    packageDuration: 2.2,
    packageFuseTime: 1.2,
    packageBulletCount: 18,
    packageSpeed: 260,
    packageDistance: 64,
    packageRotationSpeed: 60,
    packageWarningTime: 0.65,
    packageWarningAlpha: 0.2,
    packageSpacing: 0.08,
    packageInitialPosition: -120,
    packageLength: stage.width * 0.9,
    packagePolynomialA: 0,
    packagePolynomialB: 0.3,
    packagePolynomialC: 0,
    packagePolynomialD: 0,
  };

  applyPackageDefaults(base, stage);
  base.duration = getPackageDuration(base);
  return base;
}

export function getPackageFieldConfigs(event: AttackPackageEvent): PackageFieldConfig[] {
  return packageFieldConfigs.filter((config) => config.packages.includes(event.kind));
}

export function getPackageKindLabel(kind: AttackPackageKind): string {
  switch (kind) {
    case "package_random_barrage":
      return "定点ランダム弾幕";
    case "package_repeating_lasers":
      return "縦横レーザー連射";
    case "package_bomb_burst":
      return "ボム破裂弾";
    case "package_random_circle":
      return "ランダム円攻撃";
    case "package_grid_square":
      return "グリッド四角攻撃";
    case "package_lag_radial":
      return "ラグ円形連射";
    case "package_random_lasers":
      return "ランダムレーザー";
    case "package_center_lasers":
      return "中心全方向レーザー";
    case "package_area_parallel":
      return "エリア平行弾";
    case "package_snake_chain":
      return "スネーク正方形";
    case "package_enter_exit_bar":
      return "入退場バー";
    case "package_rotating_lasers":
      return "中央回転レーザー";
    case "package_sequential_lasers":
      return "時間差平行レーザー";
  }
}

export function createGeneratedEventsForPackage(pkg: AttackPackageEvent, stage: StageSize): AttackEvent[] {
  const events = buildPackageEvents(pkg, stage);

  for (const event of events) {
    event.packageId = pkg.id;
    event.packageLocked = true;
    event.visible = pkg.visible !== false;
    event.timelineLane = pkg.timelineLane;
  }

  pkg.generatedEventIds = events.map((event) => event.id);
  pkg.duration = Math.max(getPackageDuration(pkg), getGeneratedDuration(pkg, events));
  return events;
}

function applyPackageDefaults(pkg: AttackPackageEvent, stage: StageSize): void {
  switch (pkg.kind) {
    case "package_random_barrage":
      pkg.packageCount = 12;
      pkg.packageAngleWidth = 180;
      pkg.packageInterval = 0.18;
      pkg.packageSpeed = 290;
      pkg.packageDuration = 3.2;
      break;
    case "package_repeating_lasers":
      pkg.packageCount = 5;
      pkg.packageInterval = 0.48;
      pkg.packageThickness = 22;
      pkg.packageDuration = 0.72;
      pkg.packageOrientation = "horizontal";
      break;
    case "package_bomb_burst":
      pkg.packageBulletCount = 20;
      pkg.packageAngleWidth = 360;
      pkg.packageDuration = 3;
      pkg.packageFuseTime = 1.15;
      pkg.packageSpeed = 280;
      pkg.packageStartX = -80;
      pkg.packageStartY = stage.height * 0.5;
      break;
    case "package_random_circle":
      pkg.packageCount = 3;
      pkg.packageInterval = 0.55;
      pkg.packageSize = 140;
      pkg.packageDuration = 1.2;
      pkg.packageWarningTime = 0.8;
      pkg.packageWarningAlpha = 0.14;
      break;
    case "package_grid_square":
      pkg.packageCount = 4;
      pkg.packageInterval = 0.45;
      pkg.packageSize = 96;
      pkg.packageWidth = stage.width;
      pkg.packageHeight = stage.height;
      pkg.packageDuration = 1.35;
      pkg.packageWarningTime = 0.65;
      pkg.packageWarningAlpha = 0.18;
      break;
    case "package_lag_radial":
      pkg.packageCount = 7;
      pkg.packageBulletCount = 14;
      pkg.packageAngleWidth = 18;
      pkg.packageInterval = 0.16;
      pkg.packageDuration = 2.6;
      pkg.packageSpeed = 250;
      break;
    case "package_random_lasers":
      pkg.packageCount = 5;
      pkg.packageThickness = 18;
      pkg.packageDuration = 1;
      pkg.packageWarningTime = 0.55;
      pkg.packageWarningAlpha = 0.2;
      break;
    case "package_center_lasers":
      pkg.packageCount = 10;
      pkg.packageThickness = 16;
      pkg.packageDuration = 1.2;
      pkg.packageWarningTime = 0.5;
      pkg.packageWarningAlpha = 0.2;
      break;
    case "package_area_parallel":
      pkg.packageCount = 8;
      pkg.packageInterval = 0.12;
      pkg.packageWidth = 420;
      pkg.packageHeight = 220;
      pkg.packageSpeed = 270;
      break;
    case "package_snake_chain":
      pkg.packageCount = 18;
      pkg.packageSize = 24;
      pkg.packageSpacing = 0.07;
      pkg.packageDuration = 3.4;
      pkg.packagePolynomialB = 0.3;
      break;
    case "package_enter_exit_bar":
      pkg.packageLength = stage.width * 0.75;
      pkg.packageThickness = 28;
      pkg.packageSpeed = 310;
      pkg.packageDuration = 3.2;
      pkg.packageWarningTime = 0.65;
      pkg.packageWarningAlpha = 0.2;
      break;
    case "package_rotating_lasers":
      pkg.packageCount = 8;
      pkg.packageLength = Math.hypot(stage.width, stage.height) * 1.35;
      pkg.packageThickness = 15;
      pkg.packageRotationSpeed = 70;
      pkg.packageDuration = 4;
      pkg.packageWarningTime = 0.65;
      pkg.packageWarningAlpha = 0.2;
      break;
    case "package_sequential_lasers":
      pkg.packageCount = 7;
      pkg.packageInterval = 0.22;
      pkg.packageDistance = 58;
      pkg.packageLength = stage.width;
      pkg.packageThickness = 18;
      pkg.packageDuration = 0.9;
      pkg.packageWarningTime = 0.45;
      pkg.packageWarningAlpha = 0.2;
      pkg.packageInitialPosition = stage.height * 0.2;
      break;
  }
}

function buildPackageEvents(pkg: AttackPackageEvent, stage: StageSize): AttackEvent[] {
  switch (pkg.kind) {
    case "package_random_barrage":
      return buildRandomBarrage(pkg, stage);
    case "package_repeating_lasers":
      return buildRepeatingLasers(pkg, stage);
    case "package_bomb_burst":
      return buildBombBurst(pkg, stage);
    case "package_random_circle":
      return buildRandomCircle(pkg, stage);
    case "package_grid_square":
      return buildGridSquare(pkg, stage);
    case "package_lag_radial":
      return buildLagRadial(pkg, stage);
    case "package_random_lasers":
      return buildRandomLasers(pkg, stage);
    case "package_center_lasers":
      return buildCenterLasers(pkg, stage);
    case "package_area_parallel":
      return buildAreaParallel(pkg, stage);
    case "package_snake_chain":
      return buildSnakeChain(pkg, stage);
    case "package_enter_exit_bar":
      return buildEnterExitBar(pkg, stage);
    case "package_rotating_lasers":
      return buildRotatingLasers(pkg, stage);
    case "package_sequential_lasers":
      return buildSequentialLasers(pkg, stage);
  }
}

function buildRandomBarrage(pkg: AttackPackageEvent, stage: StageSize): AttackEvent[] {
  const events: AttackEvent[] = [];
  const count = Math.max(1, Math.round(pkg.packageCount));
  const centerAngle = -90;

  for (let index = 0; index < count; index += 1) {
    const event = makeSpread(pkg, stage, index, pkg.startTime + index * pkg.packageInterval, `${pkg.name} ${index + 1}`);
    const offset = randomRange(pkg.seed + index * 19, -pkg.packageAngleWidth / 2, pkg.packageAngleWidth / 2);

    event.originX = pkg.packageX;
    event.originY = pkg.packageY;
    event.clipCount = 1;
    event.clipRepeat = 1;
    event.baseAngleDeg = centerAngle + offset;
    event.polarTheta = 0;
    event.pathSpeed = pkg.packageSpeed;
    event.duration = pkg.packageDuration;
    setBulletVisual(event, 0, 8);
    events.push(event);
  }

  return events;
}

function buildRepeatingLasers(pkg: AttackPackageEvent, stage: StageSize): AttackEvent[] {
  const events: AttackEvent[] = [];
  const count = Math.max(1, Math.round(pkg.packageCount));
  const length = getStraightLaserLength(stage, pkg.packageOrientation);

  for (let index = 0; index < count; index += 1) {
    const position = pkg.packageOrientation === "horizontal"
      ? randomRange(pkg.seed + index * 37, stage.height * 0.12, stage.height * 0.88)
      : randomRange(pkg.seed + index * 37, stage.width * 0.12, stage.width * 0.88);
    const start = pkg.startTime + index * pkg.packageInterval;

    events.push(makeLaserWarning(pkg, stage, index, start - pkg.packageWarningTime, position, pkg.packageOrientation, length));
    events.push(makeLaserBullet(pkg, stage, index, start, position, pkg.packageOrientation, 0, length));
  }

  return events;
}

function buildBombBurst(pkg: AttackPackageEvent, stage: StageSize): AttackEvent[] {
  const bomb = createAttackEvent("movingBlock", pkg.startTime, stage) as MovingBlockEvent;

  bomb.name = `${pkg.name} Bomb`;
  bomb.duration = Math.max(0.05, pkg.packageFuseTime);
  bomb.color = pkg.color;
  bomb.shape = "circle";
  bomb.startX = pkg.packageStartX;
  bomb.startY = pkg.packageStartY;
  bomb.endX = pkg.packageX;
  bomb.endY = pkg.packageY;
  bomb.width = 42;
  bomb.height = 42;
  bomb.radius = 24;
  bomb.sides = 12;
  bomb.rotationSpeed = 360;
  bomb.warningTime = 0;

  const burst = createAttackEvent("spawn_radial", pkg.startTime + pkg.packageFuseTime, stage) as SpawnRadialEvent;
  burst.name = `${pkg.name} Burst`;
  burst.duration = Math.max(0.2, pkg.packageDuration);
  burst.color = pkg.color;
  burst.originX = pkg.packageX;
  burst.originY = pkg.packageY;
  burst.radialCount = Math.max(1, Math.round(pkg.packageBulletCount));
  burst.radialRepeat = 1;
  burst.radialInterval = 0;
  burst.radialStartAngle = randomRange(pkg.seed + 17, -180, 180);
  burst.pathSpeed = pkg.packageSpeed;
  setBulletVisual(burst, 0, 8);

  return [bomb, burst];
}

function buildRandomCircle(pkg: AttackPackageEvent, stage: StageSize): AttackEvent[] {
  const events: AttackEvent[] = [];
  const count = Math.max(1, Math.round(pkg.packageCount));

  for (let index = 0; index < count; index += 1) {
    const start = pkg.startTime + index * pkg.packageInterval;
    const x = randomRange(pkg.seed + 5 + index * 17, pkg.packageSize * 0.55, stage.width - pkg.packageSize * 0.55);
    const y = randomRange(pkg.seed + 9 + index * 23, pkg.packageSize * 0.55, stage.height - pkg.packageSize * 0.55);
    const warning = createAttackEvent("warningZone", Math.max(0, start - pkg.packageWarningTime), stage) as WarningZoneEvent;
    const block = createAttackEvent("movingBlock", start, stage) as MovingBlockEvent;

    warning.name = `${pkg.name} Warning ${index + 1}`;
    warning.duration = pkg.packageWarningTime;
    warning.color = pkg.color;
    warning.shape = "circle";
    warning.x = x;
    warning.y = y;
    warning.radius = pkg.packageSize / 2;
    warning.width = pkg.packageSize;
    warning.height = pkg.packageSize;
    warning.zoneAlpha = pkg.packageWarningAlpha;
    warning.blinkRate = 5;

    block.name = `${pkg.name} Hit ${index + 1}`;
    block.duration = pkg.packageDuration;
    block.color = pkg.color;
    block.shape = "circle";
    block.startX = x;
    block.startY = y;
    block.endX = x;
    block.endY = y;
    block.width = pkg.packageSize;
    block.height = pkg.packageSize;
    block.radius = pkg.packageSize / 2;
    block.sides = 12;
    block.rotationSpeed = 0;
    block.warningTime = 0;
    events.push(warning, block);
  }

  return events;
}

function buildGridSquare(pkg: AttackPackageEvent, stage: StageSize): AttackEvent[] {
  const events: AttackEvent[] = [];
  const size = Math.max(8, pkg.packageSize);
  const columns = Math.max(1, Math.floor(stage.width / size));
  const rows = Math.max(1, Math.floor(stage.height / size));
  const count = Math.max(1, Math.round(pkg.packageCount));

  for (let index = 0; index < count; index += 1) {
    const start = pkg.startTime + index * pkg.packageInterval;
    const cell = Math.floor(randomRange(pkg.seed + 23 + index * 31, 0, columns * rows - 0.001));
    const col = cell % columns;
    const row = Math.floor(cell / columns);
    const x = col * size + size / 2;
    const y = row * size + size / 2;
    const warning = createAttackEvent("warningZone", Math.max(0, start - pkg.packageWarningTime), stage) as WarningZoneEvent;
    const block = createAttackEvent("movingBlock", start, stage) as MovingBlockEvent;

    warning.name = `${pkg.name} Warning ${index + 1}`;
    warning.duration = pkg.packageWarningTime;
    warning.color = pkg.color;
    warning.shape = "rectangle";
    warning.x = x;
    warning.y = y;
    warning.width = size;
    warning.height = size;
    warning.zoneAlpha = pkg.packageWarningAlpha;
    warning.blinkRate = 4;

    block.name = `${pkg.name} Hit ${index + 1}`;
    block.duration = pkg.packageDuration;
    block.color = pkg.color;
    block.shape = "rectangle";
    block.startX = x;
    block.startY = y;
    block.endX = x;
    block.endY = y;
    block.width = size;
    block.height = size;
    block.radius = size / 2;
    block.sides = 4;
    block.rotationSpeed = 0;
    block.warningTime = 0;
    events.push(warning, block);
  }

  return events;
}

function buildLagRadial(pkg: AttackPackageEvent, stage: StageSize): AttackEvent[] {
  const events: AttackEvent[] = [];
  const count = Math.max(1, Math.round(pkg.packageCount));

  for (let index = 0; index < count; index += 1) {
    const event = createAttackEvent("spawn_radial", pkg.startTime + index * pkg.packageInterval, stage) as SpawnRadialEvent;

    event.name = `${pkg.name} ${index + 1}`;
    event.duration = pkg.packageDuration;
    event.color = pkg.color;
    event.originX = pkg.packageX;
    event.originY = pkg.packageY;
    event.radialCount = Math.max(1, Math.round(pkg.packageBulletCount));
    event.radialRepeat = 1;
    event.radialInterval = 0;
    event.radialStartAngle = pkg.packageAngleWidth * index;
    event.pathSpeed = pkg.packageSpeed;
    setBulletVisual(event, 0, 7);
    events.push(event);
  }

  return events;
}

function buildRandomLasers(pkg: AttackPackageEvent, stage: StageSize): AttackEvent[] {
  const events: AttackEvent[] = [];
  const count = Math.max(1, Math.round(pkg.packageCount));

  for (let index = 0; index < count; index += 1) {
    const angle = randomRange(pkg.seed + index * 29, -180, 180);
    const x = randomRange(pkg.seed + index * 31, stage.width * 0.15, stage.width * 0.85);
    const y = randomRange(pkg.seed + index * 43, stage.height * 0.15, stage.height * 0.85);

    events.push(makeAngledLaserWarning(pkg, stage, index, pkg.startTime - pkg.packageWarningTime, x, y, angle));
    events.push(makeAngledLaserBullet(pkg, stage, index, pkg.startTime, x, y, angle, 0));
  }

  return events;
}

function buildCenterLasers(pkg: AttackPackageEvent, stage: StageSize): AttackEvent[] {
  const events: AttackEvent[] = [];
  const count = Math.max(1, Math.round(pkg.packageCount));

  for (let index = 0; index < count; index += 1) {
    const angle = (360 / count) * index;

    events.push(makeAngledLaserWarning(pkg, stage, index, pkg.startTime - pkg.packageWarningTime, stage.width / 2, stage.height / 2, angle));
    events.push(makeAngledLaserBullet(pkg, stage, index, pkg.startTime, stage.width / 2, stage.height / 2, angle, 0));
  }

  return events;
}

function buildAreaParallel(pkg: AttackPackageEvent, stage: StageSize): AttackEvent[] {
  const events: AttackEvent[] = [];
  const count = Math.max(1, Math.round(pkg.packageCount));
  const angle = pkg.packageOrientation === "horizontal" ? 0 : 90;

  for (let index = 0; index < count; index += 1) {
    const event = makeSpread(pkg, stage, index, pkg.startTime + index * pkg.packageInterval, `${pkg.name} ${index + 1}`);

    event.originX = randomRange(pkg.seed + index * 13, pkg.packageX - pkg.packageWidth / 2, pkg.packageX + pkg.packageWidth / 2);
    event.originY = randomRange(pkg.seed + index * 17, pkg.packageY - pkg.packageHeight / 2, pkg.packageY + pkg.packageHeight / 2);
    event.clipCount = 1;
    event.clipRepeat = 1;
    event.baseAngleDeg = angle;
    event.pathSpeed = pkg.packageSpeed;
    event.duration = pkg.packageDuration;
    setBulletVisual(event, 0, 8);
    events.push(event);
  }

  return events;
}

function buildSnakeChain(pkg: AttackPackageEvent, stage: StageSize): AttackEvent[] {
  const events: AttackEvent[] = [];
  const count = Math.max(1, Math.round(pkg.packageCount));

  for (let index = 0; index < count; index += 1) {
    const event = makeSpread(pkg, stage, index, pkg.startTime + index * pkg.packageSpacing, `${pkg.name} ${index + 1}`);

    event.originX = pkg.packageX;
    event.originY = pkg.packageY;
    event.clipCount = 1;
    event.clipRepeat = 1;
    event.baseAngleDeg = 0;
    event.pathSpeed = pkg.packageSpeed;
    event.duration = pkg.packageDuration;
    event.polynomialA = pkg.packagePolynomialA;
    event.polynomialB = pkg.packagePolynomialB;
    event.polynomialC = pkg.packagePolynomialC;
    event.polynomialD = pkg.packagePolynomialD;
    setBulletVisual(event, 1, index === 0 ? pkg.packageSize * 1.35 : pkg.packageSize);
    events.push(event);
  }

  return events;
}

function buildEnterExitBar(pkg: AttackPackageEvent, stage: StageSize): AttackEvent[] {
  const event = makeSpread(pkg, stage, 0, pkg.startTime, pkg.name);
  const warningPosition = pkg.packageOrientation === "horizontal" ? pkg.packageY : pkg.packageX;
  const warning = makeLaserWarning(pkg, stage, 0, pkg.startTime - pkg.packageWarningTime, warningPosition, pkg.packageOrientation, pkg.packageLength);

  event.clipCount = 1;
  event.clipRepeat = 1;
  event.baseAngleDeg = pkg.packageOrientation === "horizontal" ? 90 : 0;
  event.originX = pkg.packageX;
  event.originY = pkg.packageY;
  event.pathSpeed = pkg.packageSpeed;
  event.duration = pkg.packageDuration;
  setLaserVisual(event, pkg.packageLength, pkg.packageThickness, pkg.packageOrientation === "horizontal" ? -90 : 90);

  if (pkg.packageWarningTime <= 0) {
    return [event];
  }

  return [warning, event];
}

function buildRotatingLasers(pkg: AttackPackageEvent, stage: StageSize): AttackEvent[] {
  const events: AttackEvent[] = [];
  const count = Math.max(1, Math.round(pkg.packageCount));
  const event = makeSpread(pkg, stage, 0, pkg.startTime, pkg.name);

  for (let index = 0; index < count; index += 1) {
    events.push(makeAngledLaserWarning(pkg, stage, index, pkg.startTime - pkg.packageWarningTime, stage.width / 2, stage.height / 2, (360 / count) * index, pkg.packageLength));
  }

  event.originX = stage.width / 2;
  event.originY = stage.height / 2;
  event.clipCount = count;
  event.clipRepeat = 1;
  event.angleStepDeg = 360 / event.clipCount;
  event.baseAngleDeg = ((count - 1) / 2) * event.angleStepDeg;
  event.pathSpeed = 0;
  event.polarThetaVelocity = pkg.packageRotationSpeed;
  event.duration = pkg.packageDuration;
  setLaserVisual(event, pkg.packageLength, pkg.packageThickness, 0);
  events.push(event);
  return events;
}

function buildSequentialLasers(pkg: AttackPackageEvent, stage: StageSize): AttackEvent[] {
  const events: AttackEvent[] = [];
  const count = Math.max(1, Math.round(pkg.packageCount));
  const length = pkg.packageLength;

  for (let index = 0; index < count; index += 1) {
    const start = pkg.startTime + index * pkg.packageInterval;
    const position = pkg.packageInitialPosition + index * pkg.packageDistance;

    events.push(makeLaserWarning(pkg, stage, index, start - pkg.packageWarningTime, position, pkg.packageOrientation, length));
    events.push(makeLaserBullet(pkg, stage, index, start, position, pkg.packageOrientation, 0, length));
  }

  return events;
}

function makeSpread(pkg: AttackPackageEvent, stage: StageSize, index: number, startTime: number, name: string): SpawnBulletSpreadEvent {
  const event = createAttackEvent("spawn_bullet_spread", Math.max(0, startTime), stage) as SpawnBulletSpreadEvent;

  event.name = name;
  event.color = pkg.color;
  event.startTime = Math.max(0, Number(startTime.toFixed(2)));
  event.duration = pkg.packageDuration;
  event.clipCount = 1;
  event.clipRepeat = 1;
  event.clipInterval = 0;
  event.angleStepDeg = 0;
  event.aimAtPlayer = 0;
  event.polarTheta = 0;
  event.id = `${pkg.id}_child_${index}_${event.id}`;
  return event;
}

function makeLaserWarning(
  pkg: AttackPackageEvent,
  stage: StageSize,
  index: number,
  startTime: number,
  position: number,
  orientation: "horizontal" | "vertical",
  length = getStraightLaserLength(stage, orientation),
): WarningZoneEvent {
  const event = createAttackEvent("warningZone", Math.max(0, startTime), stage) as WarningZoneEvent;

  event.id = `${pkg.id}_warning_${index}_${event.id}`;
  event.name = `${pkg.name} Warning ${index + 1}`;
  event.color = pkg.color;
  event.duration = Math.max(0.05, pkg.packageWarningTime);
  event.shape = "line";
  event.x = orientation === "horizontal" ? stage.width / 2 : position;
  event.y = orientation === "horizontal" ? position : stage.height / 2;
  event.width = length;
  event.height = pkg.packageThickness;
  event.angle = orientation === "horizontal" ? 0 : 90;
  event.zoneAlpha = pkg.packageWarningAlpha;
  event.blinkRate = 5;
  return event;
}

function makeLaserBullet(
  pkg: AttackPackageEvent,
  stage: StageSize,
  index: number,
  startTime: number,
  position: number,
  orientation: "horizontal" | "vertical",
  visualAngle: number,
  length = getStraightLaserLength(stage, orientation),
): SpawnBulletSpreadEvent {
  const event = makeSpread(pkg, stage, index, startTime, `${pkg.name} ${index + 1}`);

  event.originX = orientation === "horizontal" ? stage.width / 2 : position;
  event.originY = orientation === "horizontal" ? position : stage.height / 2;
  event.baseAngleDeg = orientation === "horizontal" ? 0 : 90;
  event.pathSpeed = 0;
  event.duration = pkg.packageDuration;
  setLaserVisual(event, length, pkg.packageThickness, visualAngle);
  return event;
}

function makeAngledLaserWarning(
  pkg: AttackPackageEvent,
  stage: StageSize,
  index: number,
  startTime: number,
  x: number,
  y: number,
  angle: number,
  length = Math.hypot(stage.width, stage.height) * 2.25,
): WarningZoneEvent {
  const event = createAttackEvent("warningZone", Math.max(0, startTime), stage) as WarningZoneEvent;

  event.id = `${pkg.id}_angle_warning_${index}_${event.id}`;
  event.name = `${pkg.name} Warning ${index + 1}`;
  event.color = pkg.color;
  event.duration = Math.max(0.05, pkg.packageWarningTime);
  event.shape = "line";
  event.x = x;
  event.y = y;
  event.width = length;
  event.height = pkg.packageThickness;
  event.angle = angle;
  event.zoneAlpha = pkg.packageWarningAlpha;
  event.blinkRate = 5;
  return event;
}

function makeAngledLaserBullet(pkg: AttackPackageEvent, stage: StageSize, index: number, startTime: number, x: number, y: number, angle: number, visualAngle: number): SpawnBulletSpreadEvent {
  const event = makeSpread(pkg, stage, index, startTime, `${pkg.name} ${index + 1}`);

  event.originX = x;
  event.originY = y;
  event.baseAngleDeg = angle;
  event.pathSpeed = 0;
  event.duration = pkg.packageDuration;
  setLaserVisual(event, Math.hypot(stage.width, stage.height) * 2.25, pkg.packageThickness, visualAngle);
  return event;
}

function setBulletVisual(event: BulletMotionFields, typeId: number, size: number): void {
  event.typeId = typeId;
  event.visualSize = Math.max(1, size);
  event.visualWidth = Math.max(1, size);
  event.visualHeight = Math.max(1, size);
  event.visualAngle = 0;
}

function setLaserVisual(event: BulletMotionFields, length: number, thickness: number, visualAngle: number): void {
  event.typeId = 4;
  event.visualSize = Math.max(1, thickness / 2);
  event.visualWidth = Math.max(1, length);
  event.visualHeight = Math.max(1, thickness);
  event.visualAngle = visualAngle;
}

function getStraightLaserLength(stage: StageSize, orientation: "horizontal" | "vertical"): number {
  return orientation === "horizontal" ? stage.width : stage.height;
}

function getPackageDuration(pkg: AttackPackageEvent): number {
  const repeatLikeDuration = pkg.packageDuration + Math.max(0, Math.max(pkg.packageCount, pkg.packageBulletCount) - 1) * Math.max(0, pkg.packageInterval);

  switch (pkg.kind) {
    case "package_bomb_burst":
      return pkg.packageFuseTime + pkg.packageDuration;
    case "package_random_barrage":
    case "package_repeating_lasers":
    case "package_random_circle":
    case "package_grid_square":
    case "package_lag_radial":
    case "package_area_parallel":
    case "package_sequential_lasers":
      return repeatLikeDuration;
    default:
      return pkg.packageDuration;
  }
}

function getGeneratedDuration(pkg: AttackPackageEvent, events: AttackEvent[]): number {
  return events.reduce((maxEnd, event) => Math.max(maxEnd, event.startTime + event.duration - pkg.startTime), 0);
}

function getPackageColor(kind: AttackPackageKind): number {
  const palette: Record<AttackPackageKind, number> = {
    package_random_barrage: 0xff2f4f,
    package_repeating_lasers: 0x36f5ff,
    package_bomb_burst: 0xffd166,
    package_random_circle: 0xff2f93,
    package_grid_square: 0xff4f8f,
    package_lag_radial: 0xff2f4f,
    package_random_lasers: 0x36f5ff,
    package_center_lasers: 0x36f5ff,
    package_area_parallel: 0xff2f4f,
    package_snake_chain: 0xffd166,
    package_enter_exit_bar: 0xff2f4f,
    package_rotating_lasers: 0x36f5ff,
    package_sequential_lasers: 0x36f5ff,
  };

  return palette[kind];
}

function random01(seed: number): number {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function randomRange(seed: number, min: number, max: number): number {
  return min + random01(seed) * (max - min);
}
