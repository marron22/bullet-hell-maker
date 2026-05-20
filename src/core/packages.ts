import { createAttackEvent } from "./eventFactory";
import type {
  AttackEvent,
  AttackPackageEvent,
  AttackPackageKind,
  BeatPulseRingEvent,
  BuiltInAttackPackageKind,
  BulletMotionFields,
  CustomAttackPackageKind,
  MovingBlockEvent,
  NormalAttackEventKind,
  SpawnBulletSpreadEvent,
  SpawnRadialEvent,
  StageSize,
  WarningZoneEvent,
} from "./types";

export interface PackageFieldConfig {
  name: string;
  label: string;
  description?: string;
  min?: number;
  max?: number;
  step?: number;
  integer?: boolean;
  type?: "number" | "select" | "checkbox";
  options?: Array<{ value: string; label: string }>;
  packages: AttackPackageKind[];
}

export interface CustomPackageDefinition {
  kind: CustomAttackPackageKind;
  label: string;
  description?: string;
  color: number;
  icon?: string;
  fields: PackageFieldConfig[];
  defaults?: (context: CustomPackageDefaultsContext) => Record<string, unknown>;
  build: (context: CustomPackageBuildContext) => AttackEvent[];
  getDuration?: (context: CustomPackageDurationContext) => number;
}

export interface CustomPackageDefaultsContext {
  stage: StageSize;
  helpers: CustomPackageStaticHelpers;
}

export interface CustomPackageBuildContext {
  pkg: AttackPackageEvent;
  stage: StageSize;
  helpers: CustomPackageBuildHelpers;
}

export interface CustomPackageDurationContext {
  pkg: AttackPackageEvent;
  generatedEvents: AttackEvent[];
}

export interface CustomPackageStaticHelpers {
  clamp: (value: number, min: number, max: number) => number;
  random01: (seed: number) => number;
  randomRange: (seed: number, min: number, max: number) => number;
  degreesToRadians: (degrees: number) => number;
}

export interface CustomPackageBuildHelpers extends CustomPackageStaticHelpers {
  createAttackEvent: (kind: NormalAttackEventKind, startTime: number) => AttackEvent;
  setBulletVisual: (event: BulletMotionFields, typeId: number, size: number) => void;
  setLaserVisual: (event: BulletMotionFields, length: number, thickness: number, visualAngle: number) => void;
}

export const packageKinds: BuiltInAttackPackageKind[] = [
  "package_random_barrage",
  "package_repeating_lasers",
  "package_bomb_burst",
  "package_random_circle",
  "package_grid_square",
  "package_lag_radial",
  "package_split_lag_radial",
  "package_random_lasers",
  "package_center_lasers",
  "package_area_parallel",
  "package_snake_chain",
  "package_enter_exit_bar",
  "package_rotating_lasers",
  "package_sequential_lasers",
];

const customPackageDefinitions = new Map<CustomAttackPackageKind, CustomPackageDefinition>();
const customPackageKindPattern = /^custom_[a-z0-9_]+$/;
const allPackages: AttackPackageKind[] = packageKinds;
const packagesExcept = (...excluded: AttackPackageKind[]): AttackPackageKind[] => packageKinds.filter((kind) => !excluded.includes(kind));
const field = (
  name: string,
  label: string,
  packages: AttackPackageKind[],
  min = 0,
  max = 9999,
  step = 1,
  integer = false,
): PackageFieldConfig => ({ name, label, packages, min, max, step, integer, type: "number" });

const checkboxField = (
  name: string,
  label: string,
  packages: AttackPackageKind[],
): PackageFieldConfig => ({ name, label, packages, type: "checkbox" });

export const packageFieldConfigs: PackageFieldConfig[] = [
  field("startTime", "startTime", allPackages, 0, 999, 0.1),
  field("packageDuration", "duration", packagesExcept("package_split_lag_radial"), 0.05, 30, 0.1),
  field("packageDuration", "firstDuration", [
    "package_split_lag_radial",
  ], 0.05, 30, 0.1),
  field("packageSplitDuration", "splitDuration", [
    "package_split_lag_radial",
  ], 0.05, 30, 0.1),
  checkboxField("packageAimAtPlayer", "aimAtPlayer", [
    "package_lag_radial",
  ]),
  checkboxField("packageAimAtPlayer", "firstAimAtPlayer", [
    "package_split_lag_radial",
  ]),
  checkboxField("packageSplitAimAtPlayer", "splitAimAtPlayer", [
    "package_split_lag_radial",
  ]),
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
    "package_sequential_lasers",
  ], 1, 128, 1, true),
  field("packageCount", "firstCount", [
    "package_split_lag_radial",
  ], 1, 128, 1, true),
  field("packageBulletCount", "bulletCount", [
    "package_bomb_burst",
  ], 0, 160, 1, true),
  field("packageBulletCount", "bulletCount", [
    "package_lag_radial",
  ], 1, 160, 1, true),
  field("packageBulletCount", "splitCount", [
    "package_split_lag_radial",
  ], 1, 160, 1, true),
  field("packageFuseTime", "fuseTime", [
    "package_bomb_burst",
  ], 0.1, 20, 0.1),
  field("packageAngleWidth", "angleWidth", [
    "package_random_barrage",
    "package_bomb_burst",
  ], 0, 360, 1),
  field("packageAngleWidth", "angleStep", [
    "package_lag_radial",
  ], -360, 360, 1),
  field("packageStartAngle", "startAngle", [
    "package_lag_radial",
    "package_split_lag_radial",
    "package_center_lasers",
    "package_rotating_lasers",
  ], -720, 720, 1),
  field("packageSplitStartAngle", "splitStartAngle", [
    "package_split_lag_radial",
  ], -720, 720, 1),
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
    "package_random_circle",
    "package_grid_square",
    "package_lag_radial",
    "package_split_lag_radial",
    "package_random_lasers",
    "package_center_lasers",
    "package_area_parallel",
    "package_rotating_lasers",
    "package_enter_exit_bar",
    "package_snake_chain",
  ], -1000, 2000, 1),
  field("packageY", "y", [
    "package_random_barrage",
    "package_bomb_burst",
    "package_random_circle",
    "package_grid_square",
    "package_lag_radial",
    "package_split_lag_radial",
    "package_random_lasers",
    "package_center_lasers",
    "package_area_parallel",
    "package_rotating_lasers",
    "package_enter_exit_bar",
    "package_snake_chain",
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
    "package_random_circle",
    "package_random_lasers",
  ], 8, 1600, 1),
  field("packageHeight", "height", [
    "package_area_parallel",
    "package_grid_square",
    "package_random_circle",
    "package_random_lasers",
  ], 8, 1200, 1),
  field("packageSize", "size", [
    "package_random_circle",
    "package_grid_square",
    "package_snake_chain",
  ], 4, 800, 1),
  field("packageBombSize", "bombSize", [
    "package_bomb_burst",
  ], 4, 400, 1),
  field("packageSpeed", "speed", [
    "package_random_barrage",
    "package_bomb_burst",
    "package_lag_radial",
    "package_area_parallel",
    "package_snake_chain",
    "package_enter_exit_bar",
  ], 0, 1600, 5),
  field("packageSpeed", "firstSpeed", [
    "package_split_lag_radial",
  ], 0, 1600, 5),
  field("packageSplitSpeed", "splitSpeed", [
    "package_split_lag_radial",
  ], 0, 1600, 5),
  field("packageDirectionDeg", "direction", [
    "package_area_parallel",
  ], -720, 720, 5),
  field("packageDistance", "distance", [
    "package_sequential_lasers",
  ], 1, 800, 1),
  field("packageSpacing", "spacing", [
    "package_snake_chain",
  ], 0, 2, 0.02),
  field("packageInitialPosition", "initialPosition", [
    "package_repeating_lasers",
    "package_sequential_lasers",
  ], -1200, 2000, 1),
  field("packageLength", "length", [
    "package_repeating_lasers",
    "package_random_lasers",
    "package_center_lasers",
    "package_enter_exit_bar",
    "package_rotating_lasers",
    "package_sequential_lasers",
  ], 20, 4000, 1),
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

export function registerCustomPackageDefinition(rawDefinition: unknown): CustomPackageDefinition {
  const definition = normalizeCustomPackageDefinition(rawDefinition);

  customPackageDefinitions.set(definition.kind, definition);
  return definition;
}

export function getAvailablePackageKinds(): AttackPackageKind[] {
  return [...packageKinds, ...customPackageDefinitions.keys()];
}

export function getCustomPackageKinds(): CustomAttackPackageKind[] {
  return [...customPackageDefinitions.keys()];
}

export function getCustomPackageDefinition(kind: string): CustomPackageDefinition | undefined {
  return customPackageDefinitions.get(kind as CustomAttackPackageKind);
}

export function unregisterCustomPackageDefinition(kind: string): boolean {
  if (!isCustomAttackPackageKindName(kind)) {
    return false;
  }

  return customPackageDefinitions.delete(kind);
}

export function isBuiltInPackageKind(kind: string): kind is BuiltInAttackPackageKind {
  return (packageKinds as string[]).includes(kind);
}

export function isCustomAttackPackageKindName(kind: string): kind is CustomAttackPackageKind {
  return customPackageKindPattern.test(kind);
}

export function canGeneratePackageEvents(pkg: AttackPackageEvent): boolean {
  return isBuiltInPackageKind(pkg.kind) || customPackageDefinitions.has(pkg.kind as CustomAttackPackageKind);
}

export function isMissingCustomPackageDefinition(pkg: AttackPackageEvent): boolean {
  return isCustomAttackPackageKindName(pkg.kind) && !customPackageDefinitions.has(pkg.kind as CustomAttackPackageKind);
}

export function getPackageIcon(kind: AttackPackageKind): string | undefined {
  return customPackageDefinitions.get(kind as CustomAttackPackageKind)?.icon;
}

export function isAttackPackageKind(kind: string): kind is AttackPackageKind {
  return isBuiltInPackageKind(kind) || isCustomAttackPackageKindName(kind);
}

export function isAttackPackageEvent(event: AttackEvent | undefined): event is AttackPackageEvent {
  return Boolean(event && isAttackPackageKind(event.kind));
}

function normalizeCustomPackageDefinition(rawDefinition: unknown): CustomPackageDefinition {
  const definition = requireRecord(rawDefinition, "Package definition");
  const kind = readRequiredString(definition, "kind");

  if (!isCustomAttackPackageKindName(kind)) {
    throw new Error("Custom package kind must start with custom_ and contain only lowercase letters, numbers, and underscores.");
  }

  const label = readRequiredString(definition, "label");
  const build = definition.build;

  if (typeof build !== "function") {
    throw new Error(`Custom package ${kind} must export a build(context) function.`);
  }

  const fields = Array.isArray(definition.fields)
    ? definition.fields.map((rawField) => normalizeCustomPackageField(rawField, kind))
    : [];

  return {
    kind,
    label,
    description: readOptionalString(definition, "description"),
    color: normalizeColor(definition.color, 0xff2f4f),
    icon: readOptionalString(definition, "icon"),
    fields,
    defaults: typeof definition.defaults === "function" ? definition.defaults as CustomPackageDefinition["defaults"] : undefined,
    build: build as CustomPackageDefinition["build"],
    getDuration: typeof definition.getDuration === "function" ? definition.getDuration as CustomPackageDefinition["getDuration"] : undefined,
  };
}

function normalizeCustomPackageField(rawField: unknown, kind: CustomAttackPackageKind): PackageFieldConfig {
  const fieldDefinition = requireRecord(rawField, "Package field");
  const name = readRequiredString(fieldDefinition, "name");

  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new Error(`Custom package field "${name}" must be a valid JavaScript identifier.`);
  }

  if (["id", "kind", "packageType", "generatedEventIds", "packageId", "packageLocked"].includes(name)) {
    throw new Error(`Custom package field "${name}" is reserved.`);
  }

  const type = fieldDefinition.type === "select" || fieldDefinition.type === "checkbox" ? fieldDefinition.type : "number";
  const config: PackageFieldConfig = {
    name,
    label: readOptionalString(fieldDefinition, "label") ?? name,
    description: readOptionalString(fieldDefinition, "description"),
    type,
    packages: [kind],
  };

  if (type === "select") {
    config.options = normalizeSelectOptions(fieldDefinition.options);
  } else if (type === "number") {
    config.min = normalizeFiniteNumber(fieldDefinition.min, 0);
    config.max = normalizeFiniteNumber(fieldDefinition.max, 9999);
    config.step = normalizePositiveNumber(fieldDefinition.step, 1);
    config.integer = Boolean(fieldDefinition.integer);
  }

  return config;
}

function normalizeSelectOptions(rawOptions: unknown): Array<{ value: string; label: string }> {
  if (!Array.isArray(rawOptions) || rawOptions.length === 0) {
    throw new Error("Select package fields require at least one option.");
  }

  return rawOptions.map((rawOption) => {
    const option = requireRecord(rawOption, "Select option");
    const value = readRequiredString(option, "value");

    return {
      value,
      label: readOptionalString(option, "label") ?? value,
    };
  });
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }

  return value as Record<string, unknown>;
}

function readRequiredString(source: Record<string, unknown>, name: string): string {
  const value = source[name];

  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${name} must be a non-empty string.`);
  }

  return value.trim();
}

function readOptionalString(source: Record<string, unknown>, name: string): string | undefined {
  const value = source[name];

  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

function normalizeFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizePositiveNumber(value: unknown, fallback: number): number {
  const normalized = normalizeFiniteNumber(value, fallback);

  return normalized > 0 ? normalized : fallback;
}

function normalizeColor(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.round(clamp(value, 0, 0xffffff));
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
    packageStartAngle: 0,
    packageInterval: 0.25,
    packageThickness: 18,
    packageOrientation: "horizontal",
    packageX: stage.width / 2,
    packageY: stage.height / 2,
    packageAimAtPlayer: 0,
    packageSplitAimAtPlayer: 0,
    packageStartX: -80,
    packageStartY: stage.height / 2,
    packageWidth: stage.width * 0.6,
    packageHeight: stage.height * 0.5,
    packageSize: 120,
    packageBombSize: 42,
    packageDuration: 2.2,
    packageSplitDuration: 2.2,
    packageFuseTime: 1.2,
    packageBulletCount: 18,
    packageSpeed: 260,
    packageSplitSpeed: 260,
    packageSplitStartAngle: 0,
    packageDirectionDeg: 0,
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

  if (isBuiltInPackageKind(kind)) {
    applyPackageDefaults(base, stage);
  } else {
    applyCustomPackageDefaults(base, stage);
  }

  base.duration = getPackageDuration(base);
  return base;
}

export function getPackageFieldConfigs(event: AttackPackageEvent): PackageFieldConfig[] {
  const customDefinition = customPackageDefinitions.get(event.kind as CustomAttackPackageKind);

  if (customDefinition) {
    const commonFields = [
      field("startTime", "startTime", [event.kind], 0, 999, 0.1),
      field("seed", "seed", [event.kind], 1, 999999, 1, true),
    ];
    const fields = [...commonFields.slice(0, 1), ...customDefinition.fields, commonFields[1]];
    const seen = new Set<string>();

    return fields.filter((config) => {
      if (seen.has(config.name)) {
        return false;
      }

      seen.add(config.name);
      return true;
    });
  }

  return packageFieldConfigs.filter((config) => config.packages.includes(event.kind));
}

export function getPackageKindLabel(kind: AttackPackageKind): string {
  const customDefinition = customPackageDefinitions.get(kind as CustomAttackPackageKind);

  if (customDefinition) {
    return customDefinition.label;
  }

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
    case "package_split_lag_radial":
      return "分裂ラグ円形弾";
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
    default:
      return kind;
  }
}

export function createGeneratedEventsForPackage(pkg: AttackPackageEvent, stage: StageSize): AttackEvent[] {
  const events = buildPackageEvents(pkg, stage).map((event, index) => normalizeGeneratedPackageEvent(pkg, event, index));

  for (const event of events) {
    event.packageId = pkg.id;
    event.packageLocked = true;
    event.visible = pkg.visible !== false;
    event.timelineLane = pkg.timelineLane;
  }

  pkg.generatedEventIds = events.map((event) => event.id);
  pkg.duration = Math.max(getPackageDuration(pkg, events), getGeneratedDuration(pkg, events));
  return events;
}

function normalizeGeneratedPackageEvent(pkg: AttackPackageEvent, event: AttackEvent, index: number): AttackEvent {
  if (!event || typeof event !== "object" || typeof event.kind !== "string") {
    throw new Error(`Package ${pkg.kind} returned an invalid generated event at index ${index}.`);
  }

  if (isAttackPackageKind(event.kind)) {
    throw new Error(`Package ${pkg.kind} cannot generate another package event.`);
  }

  event.id = typeof event.id === "string" && event.id ? event.id : `${pkg.id}_custom_${index}`;
  event.name = typeof event.name === "string" && event.name ? event.name : `${pkg.name} ${index + 1}`;
  event.startTime = Number.isFinite(event.startTime) ? Number(event.startTime.toFixed(2)) : pkg.startTime;
  event.duration = Number.isFinite(event.duration) && event.duration > 0 ? event.duration : Math.max(0.05, pkg.packageDuration);
  event.color = Number.isFinite(event.color) ? event.color : pkg.color;
  return event;
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
      pkg.packageOrientation = "horizontal";
      pkg.packageCount = 5;
      pkg.packageInterval = 0.48;
      pkg.packageThickness = 22;
      pkg.packageLength = getStraightLaserLength(stage, pkg.packageOrientation);
      pkg.packageDuration = 0.72;
      pkg.packageInitialPosition = stage.height / 2;
      break;
    case "package_bomb_burst":
      pkg.packageBulletCount = 20;
      pkg.packageAngleWidth = 360;
      pkg.packageDuration = 3;
      pkg.packageFuseTime = 1.15;
      pkg.packageSpeed = 280;
      pkg.packageBombSize = 42;
      pkg.packageStartX = -80;
      pkg.packageStartY = stage.height * 0.5;
      break;
    case "package_random_circle":
      pkg.packageCount = 3;
      pkg.packageInterval = 0.55;
      pkg.packageX = stage.width / 2;
      pkg.packageY = stage.height / 2;
      pkg.packageWidth = stage.width;
      pkg.packageHeight = stage.height;
      pkg.packageSize = 140;
      pkg.packageDuration = 1.2;
      pkg.packageWarningTime = 0.8;
      pkg.packageWarningAlpha = 0.14;
      break;
    case "package_grid_square":
      pkg.packageCount = 4;
      pkg.packageInterval = 0.45;
      pkg.packageX = stage.width / 2;
      pkg.packageY = stage.height / 2;
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
      pkg.packageStartAngle = 0;
      pkg.packageAngleWidth = 18;
      pkg.packageInterval = 0.16;
      pkg.packageDuration = 2.6;
      pkg.packageSpeed = 250;
      break;
    case "package_split_lag_radial":
      pkg.packageCount = 8;
      pkg.packageBulletCount = 8;
      pkg.packageStartAngle = 0;
      pkg.packageSplitStartAngle = 24;
      pkg.packageDuration = 1.05;
      pkg.packageSplitDuration = 1.05;
      pkg.packageSpeed = 245;
      pkg.packageSplitSpeed = 245;
      break;
    case "package_random_lasers":
      pkg.packageCount = 5;
      pkg.packageX = stage.width / 2;
      pkg.packageY = stage.height / 2;
      pkg.packageWidth = stage.width * 0.7;
      pkg.packageHeight = stage.height * 0.7;
      pkg.packageThickness = 18;
      pkg.packageLength = Math.hypot(stage.width, stage.height) * 2.25;
      pkg.packageDuration = 1;
      pkg.packageWarningTime = 0.55;
      pkg.packageWarningAlpha = 0.2;
      break;
    case "package_center_lasers":
      pkg.packageCount = 10;
      pkg.packageX = stage.width / 2;
      pkg.packageY = stage.height / 2;
      pkg.packageStartAngle = 0;
      pkg.packageThickness = 16;
      pkg.packageLength = Math.hypot(stage.width, stage.height) * 2.25;
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
      pkg.packageDirectionDeg = pkg.packageOrientation === "horizontal" ? 0 : 90;
      break;
    case "package_snake_chain":
      pkg.packageCount = 18;
      pkg.packageSize = 24;
      pkg.packageSpacing = 0.07;
      pkg.packageDuration = 3.4;
      pkg.packagePolynomialB = 0.3;
      break;
    case "package_enter_exit_bar":
      pkg.packageLength = 960;
      pkg.packageThickness = 28;
      pkg.packageSpeed = 310;
      pkg.packageDuration = 3.2;
      pkg.packageWarningTime = 0.65;
      pkg.packageWarningAlpha = 0.2;
      break;
    case "package_rotating_lasers":
      pkg.packageCount = 8;
      pkg.packageX = stage.width / 2;
      pkg.packageY = stage.height / 2;
      pkg.packageStartAngle = 0;
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

function applyCustomPackageDefaults(pkg: AttackPackageEvent, stage: StageSize): void {
  const definition = customPackageDefinitions.get(pkg.kind as CustomAttackPackageKind);

  if (!definition?.defaults) {
    return;
  }

  const defaults = definition.defaults({
    stage,
    helpers: createCustomPackageStaticHelpers(),
  });

  if (defaults && typeof defaults === "object" && !Array.isArray(defaults)) {
    Object.assign(pkg, defaults);
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
    case "package_split_lag_radial":
      return buildSplitLagRadial(pkg, stage);
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

  const customDefinition = customPackageDefinitions.get(pkg.kind as CustomAttackPackageKind);

  if (customDefinition) {
    return customDefinition.build({
      pkg,
      stage,
      helpers: createCustomPackageBuildHelpers(stage),
    });
  }

  return [];
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
  const length = Math.max(20, pkg.packageLength);
  const axisMax = pkg.packageOrientation === "horizontal" ? stage.height : stage.width;
  const defaultCenter = axisMax / 2;
  const center = pkg.packageInitialPosition >= 0 && pkg.packageInitialPosition <= axisMax ? pkg.packageInitialPosition : defaultCenter;
  const randomSpan = axisMax * 0.76;
  const minPosition = clamp(center - randomSpan / 2, 0, axisMax);
  const maxPosition = clamp(center + randomSpan / 2, minPosition + 1, axisMax);

  for (let index = 0; index < count; index += 1) {
    const position = randomRange(pkg.seed + index * 37, minPosition, maxPosition);
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
  bomb.width = pkg.packageBombSize;
  bomb.height = pkg.packageBombSize;
  bomb.radius = pkg.packageBombSize / 2;
  bomb.sides = 12;
  bomb.rotationSpeed = 360;
  bomb.warningTime = 0;

  if (Math.round(pkg.packageBulletCount) <= 0) {
    return [bomb];
  }

  const burst = createAttackEvent("spawn_radial", pkg.startTime + pkg.packageFuseTime, stage) as SpawnRadialEvent;
  burst.name = `${pkg.name} Burst`;
  burst.duration = Math.max(0.2, pkg.packageDuration);
  burst.color = pkg.color;
  burst.originX = pkg.packageX;
  burst.originY = pkg.packageY;
  burst.radialCount = Math.round(pkg.packageBulletCount);
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
  const area = getPackageAreaBounds(pkg, stage);

  for (let index = 0; index < count; index += 1) {
    const start = pkg.startTime + index * pkg.packageInterval;
    const x = randomRange(pkg.seed + 5 + index * 17, area.minX, area.maxX);
    const y = randomRange(pkg.seed + 9 + index * 23, area.minY, area.maxY);
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
  const area = getPackageAreaBounds(pkg, stage);
  const columns = Math.max(1, Math.ceil((area.maxX - area.minX) / size) + 1);
  const rows = Math.max(1, Math.ceil((area.maxY - area.minY) / size) + 1);
  const count = Math.max(1, Math.round(pkg.packageCount));

  for (let index = 0; index < count; index += 1) {
    const start = pkg.startTime + index * pkg.packageInterval;
    const cell = Math.floor(randomRange(pkg.seed + 23 + index * 31, 0, columns * rows - 0.001));
    const col = cell % columns;
    const row = Math.floor(cell / columns);
    const x = clamp(area.minX + col * size, 0, stage.width);
    const y = clamp(area.minY + row * size, 0, stage.height);
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
    event.aimAtPlayer = pkg.packageAimAtPlayer;
    event.radialCount = Math.max(1, Math.round(pkg.packageBulletCount));
    event.radialRepeat = 1;
    event.radialInterval = 0;
    event.radialStartAngle = pkg.packageStartAngle + pkg.packageAngleWidth * index;
    event.pathSpeed = pkg.packageSpeed;
    setBulletVisual(event, 0, 7);
    events.push(event);
  }

  return events;
}

function buildSplitLagRadial(pkg: AttackPackageEvent, stage: StageSize): AttackEvent[] {
  const events: AttackEvent[] = [];
  const primaryCount = Math.max(1, Math.round(pkg.packageCount));
  const splitCount = Math.max(1, Math.round(pkg.packageBulletCount));
  const primaryStartAngle = pkg.packageStartAngle;
  const splitStartTime = pkg.startTime + pkg.packageDuration;

  events.push(
    makeOneShotRadial(pkg, stage, 0, pkg.startTime, pkg.packageX, pkg.packageY, primaryCount, primaryStartAngle, `${pkg.name} Source`, {
      aimAtPlayer: pkg.packageAimAtPlayer,
      duration: pkg.packageDuration,
      speed: pkg.packageSpeed,
    }),
  );

  for (let index = 0; index < primaryCount; index += 1) {
    const angle = primaryStartAngle + (360 / primaryCount) * index;
    const endpoint = radialEndpoint(pkg.packageX, pkg.packageY, angle, pkg.packageSpeed, pkg.packageDuration);

    events.push(
      makeOneShotRadial(
        pkg,
        stage,
        index + 1,
        splitStartTime,
        endpoint.x,
        endpoint.y,
        splitCount,
        angle + pkg.packageSplitStartAngle,
        `${pkg.name} Split ${index + 1}`,
        {
          aimAtPlayer: pkg.packageSplitAimAtPlayer,
          duration: pkg.packageSplitDuration,
          speed: pkg.packageSplitSpeed,
        },
      ),
    );
  }

  return events;
}

function makeOneShotRadial(
  pkg: AttackPackageEvent,
  stage: StageSize,
  index: number,
  startTime: number,
  originX: number,
  originY: number,
  count: number,
  startAngle: number,
  name: string,
  overrides: { aimAtPlayer?: number; duration?: number; speed?: number } = {},
): SpawnRadialEvent {
  const event = createAttackEvent("spawn_radial", startTime, stage) as SpawnRadialEvent;

  event.id = `${pkg.id}_radial_${index}_${event.id}`;
  event.name = name;
  event.startTime = Number(startTime.toFixed(2));
  event.duration = overrides.duration ?? pkg.packageDuration;
  event.color = pkg.color;
  event.originX = originX;
  event.originY = originY;
  event.aimAtPlayer = overrides.aimAtPlayer ?? pkg.packageAimAtPlayer;
  event.polarTheta = 0;
  event.radialCount = count;
  event.radialRepeat = 1;
  event.radialInterval = 0;
  event.radialStartAngle = startAngle;
  event.pathSpeed = overrides.speed ?? pkg.packageSpeed;
  setBulletVisual(event, 0, 7);
  return event;
}

function buildRandomLasers(pkg: AttackPackageEvent, stage: StageSize): AttackEvent[] {
  const events: AttackEvent[] = [];
  const count = Math.max(1, Math.round(pkg.packageCount));
  const length = Math.max(20, pkg.packageLength);
  const area = getPackageAreaBounds(pkg, stage);

  for (let index = 0; index < count; index += 1) {
    const angle = randomRange(pkg.seed + index * 29, -180, 180);
    const x = randomRange(pkg.seed + index * 31, area.minX, area.maxX);
    const y = randomRange(pkg.seed + index * 43, area.minY, area.maxY);

    events.push(makeAngledLaserWarning(pkg, stage, index, pkg.startTime - pkg.packageWarningTime, x, y, angle, length));
    events.push(makeAngledLaserBullet(pkg, stage, index, pkg.startTime, x, y, angle, 0, length));
  }

  return events;
}

function buildCenterLasers(pkg: AttackPackageEvent, stage: StageSize): AttackEvent[] {
  const events: AttackEvent[] = [];
  const count = Math.max(1, Math.round(pkg.packageCount));
  const length = Math.max(20, pkg.packageLength);
  const x = pkg.packageX;
  const y = pkg.packageY;

  for (let index = 0; index < count; index += 1) {
    const angle = pkg.packageStartAngle + (360 / count) * index;

    events.push(makeAngledLaserWarning(pkg, stage, index, pkg.startTime - pkg.packageWarningTime, x, y, angle, length));
    events.push(makeAngledLaserBullet(pkg, stage, index, pkg.startTime, x, y, angle, 0, length));
  }

  return events;
}

function buildAreaParallel(pkg: AttackPackageEvent, stage: StageSize): AttackEvent[] {
  const events: AttackEvent[] = [];
  const count = Math.max(1, Math.round(pkg.packageCount));
  const angle = pkg.packageDirectionDeg;

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
  const x = pkg.packageX;
  const y = pkg.packageY;

  for (let index = 0; index < count; index += 1) {
    events.push(makeAngledLaserWarning(pkg, stage, index, pkg.startTime - pkg.packageWarningTime, x, y, pkg.packageStartAngle + (360 / count) * index, pkg.packageLength));
  }

  event.originX = x;
  event.originY = y;
  event.clipCount = count;
  event.clipRepeat = 1;
  event.angleStepDeg = 360 / event.clipCount;
  event.baseAngleDeg = pkg.packageStartAngle + ((count - 1) / 2) * event.angleStepDeg;
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

function makeAngledLaserBullet(
  pkg: AttackPackageEvent,
  stage: StageSize,
  index: number,
  startTime: number,
  x: number,
  y: number,
  angle: number,
  visualAngle: number,
  length = Math.hypot(stage.width, stage.height) * 2.25,
): SpawnBulletSpreadEvent {
  const event = makeSpread(pkg, stage, index, startTime, `${pkg.name} ${index + 1}`);

  event.originX = x;
  event.originY = y;
  event.baseAngleDeg = angle;
  event.pathSpeed = 0;
  event.duration = pkg.packageDuration;
  setLaserVisual(event, length, pkg.packageThickness, visualAngle);
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

function createCustomPackageStaticHelpers(): CustomPackageStaticHelpers {
  return {
    clamp,
    random01,
    randomRange,
    degreesToRadians,
  };
}

function createCustomPackageBuildHelpers(stage: StageSize): CustomPackageBuildHelpers {
  return {
    ...createCustomPackageStaticHelpers(),
    createAttackEvent: (kind, startTime) => createAttackEvent(kind, startTime, stage),
    setBulletVisual,
    setLaserVisual,
  };
}

function getStraightLaserLength(stage: StageSize, orientation: "horizontal" | "vertical"): number {
  return orientation === "horizontal" ? stage.width : stage.height;
}

function getPackageDuration(pkg: AttackPackageEvent, generatedEvents: AttackEvent[] = []): number {
  const customDefinition = customPackageDefinitions.get(pkg.kind as CustomAttackPackageKind);

  if (customDefinition?.getDuration) {
    const duration = customDefinition.getDuration({ pkg, generatedEvents });

    if (Number.isFinite(duration) && duration > 0) {
      return duration;
    }
  }

  if (customDefinition || isCustomAttackPackageKindName(pkg.kind)) {
    return Number.isFinite(pkg.duration) && pkg.duration > 0 ? pkg.duration : Math.max(0.05, pkg.packageDuration);
  }

  const countLikeDuration = pkg.packageDuration + Math.max(0, Math.round(pkg.packageCount) - 1) * Math.max(0, pkg.packageInterval);

  switch (pkg.kind) {
    case "package_bomb_burst":
      return Math.round(pkg.packageBulletCount) <= 0 ? pkg.packageFuseTime : pkg.packageFuseTime + pkg.packageDuration;
    case "package_split_lag_radial":
      return pkg.packageDuration + pkg.packageSplitDuration;
    case "package_random_barrage":
    case "package_repeating_lasers":
    case "package_random_circle":
    case "package_grid_square":
    case "package_lag_radial":
    case "package_area_parallel":
    case "package_sequential_lasers":
      return countLikeDuration;
    default:
      return pkg.packageDuration;
  }
}

function getGeneratedDuration(pkg: AttackPackageEvent, events: AttackEvent[]): number {
  return events.reduce((maxEnd, event) => Math.max(maxEnd, event.startTime + event.duration - pkg.startTime), 0);
}

function getPackageColor(kind: AttackPackageKind): number {
  const customDefinition = customPackageDefinitions.get(kind as CustomAttackPackageKind);

  if (customDefinition) {
    return customDefinition.color;
  }

  const palette: Record<BuiltInAttackPackageKind, number> = {
    package_random_barrage: 0xff2f4f,
    package_repeating_lasers: 0x36f5ff,
    package_bomb_burst: 0xffd166,
    package_random_circle: 0xff2f93,
    package_grid_square: 0xff4f8f,
    package_lag_radial: 0xff2f4f,
    package_split_lag_radial: 0xff2f93,
    package_random_lasers: 0x36f5ff,
    package_center_lasers: 0x36f5ff,
    package_area_parallel: 0xff2f4f,
    package_snake_chain: 0xffd166,
    package_enter_exit_bar: 0xff2f4f,
    package_rotating_lasers: 0x36f5ff,
    package_sequential_lasers: 0x36f5ff,
  };

  return isBuiltInPackageKind(kind) ? palette[kind] : 0xff2f4f;
}

function random01(seed: number): number {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function randomRange(seed: number, min: number, max: number): number {
  return min + random01(seed) * (max - min);
}

function getPackageAreaBounds(pkg: AttackPackageEvent, stage: StageSize): { minX: number; maxX: number; minY: number; maxY: number } {
  const width = Math.max(1, Math.abs(pkg.packageWidth || stage.width));
  const height = Math.max(1, Math.abs(pkg.packageHeight || stage.height));
  const minX = clamp(pkg.packageX - width / 2, 0, stage.width);
  const maxX = clamp(pkg.packageX + width / 2, 0, stage.width);
  const minY = clamp(pkg.packageY - height / 2, 0, stage.height);
  const maxY = clamp(pkg.packageY + height / 2, 0, stage.height);

  return {
    minX: Math.min(minX, maxX),
    maxX: Math.max(minX, maxX),
    minY: Math.min(minY, maxY),
    maxY: Math.max(minY, maxY),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function radialEndpoint(originX: number, originY: number, angleDegrees: number, speed: number, duration: number): { x: number; y: number } {
  const distance = Math.max(0, speed) * Math.max(0, duration);
  const angle = degreesToRadians(angleDegrees);

  return {
    x: originX + Math.cos(angle) * distance,
    y: originY + Math.sin(angle) * distance,
  };
}

function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}
