import "./styles.css";
import { createAttackEvent } from "./core/eventFactory";
import { applyAttackTemplate } from "./core/eventTemplates";
import {
  canGeneratePackageEvents,
  createAttackPackageEvent,
  createGeneratedEventsForPackage,
  getAvailablePackageKinds,
  getCustomPackageKinds,
  getPackageIcon,
  getPackageFieldConfigs,
  getPackageKindLabel,
  isAttackPackageEvent,
  isAttackPackageKind,
  isCustomAttackPackageKindName,
  isMissingCustomPackageDefinition,
  registerCustomPackageDefinition,
  unregisterCustomPackageDefinition,
  type PackageFieldConfig,
} from "./core/packages";
import { createStarterPattern } from "./core/samplePattern";
import { buildAttackFrame, clearAimCache } from "./core/simulation";
import { PlaybackClock } from "./core/playback";
import type { AttackEvent, AttackEventKind, AttackFrame, AttackPackageEvent, AttackPackageKind, BulletPattern, CurvedLaserRender, HazardRender, LaserRender, ShapeRender, TimelineSettings, WallRender } from "./core/types";
import { buildUnitySeparatedExport } from "./core/unityExport";
import { PreviewStage, type PackageHandleRender } from "./preview/PreviewStage";

interface ProjectMusicAsset {
  name: string;
  type: string;
  dataUrl: string;
  volume: number;
}

interface ProjectCustomPackageAsset {
  kind: string;
  name: string;
  code: string;
}

type ProjectPatternFile = Partial<BulletPattern> & {
  music?: ProjectMusicAsset | null;
  customPackages?: ProjectCustomPackageAsset[];
};

type AiBeatmapDraftFile = {
  format?: string;
  version?: number;
  title?: string;
  duration?: number;
  timeline?: unknown;
  events?: unknown[];
};

const appVersion = "v0.7";
let pattern = createStarterPattern();
const clock = new PlaybackClock();
let selectedEventId: string | null = pattern.events[0]?.id ?? null;
let selectedEventIds = new Set<string>(selectedEventId ? [selectedEventId] : []);
let timelineDragging = false;
let markerDraggingId: string | null = null;
let markerDragMoved = false;
let markerDragStartX = 0;
let markerDragOriginalTime = 0;
let musicObjectUrl: string | null = null;
let musicPeaks: number[] = [];
let musicChannelData: Float32Array | null = null;
let musicPeakResolution = 0;
let copiedEvents: AttackEvent[] = [];
let copiedEventsAnchorTime = 0;
let copyStatusText = "";
let projectMusicAsset: ProjectMusicAsset | null = null;
const projectCustomPackageAssets = new Map<string, ProjectCustomPackageAsset>();
let timelineZoom = 1;
let markerDragHistoryRecorded = false;
let snapToMeasures = false;
let propertyTimeMode: "seconds" | "beats" = "seconds";
let editingEventId: string | null = null;
let activeInspectorTab: "events" | "package" | "properties" | "music" = "events";
type EditorMode = "global" | "trajectory" | "preview";
let editorMode: EditorMode = "global";
let dashRequested = false;
let dashTimeRemaining = 0;
let dashCooldownRemaining = 0;
let playerWasHit = false;
const pressedPreviewKeys = new Set<string>();
const lastPreviewDirection = { x: 0, y: -1 };
let timelinePanelHeight = 220;
let inspectorPanelWidth = 380;
let activeResizeTarget: "timeline" | "inspector" | null = null;
let suppressNextPlayClick = false;
let suppressNextResetClick = false;
let activePackageHandleId: string | null = null;

const defaultMusicVolume = 0.8;
const audio = new Audio();
audio.volume = defaultMusicVolume;
const markerDragThreshold = 4;
const minSnapThresholdPixels = 5;
const maxSnapThresholdPixels = 14;
const snapThresholdGridRatio = 0.32;
const minWaveformResolution = 600;
const maxWaveformResolution = 32000;
const minTimelineZoom = 1;
const maxTimelineZoom = 48;
const maxTimelineContentWidth = 32000;
const minMeasureInterval = 0.05;
const maxMeasureInterval = 120;
const maxHistoryEntries = 100;
const playerHitSize = 12;
const previewMoveSpeed = 375;
const previewDashSpeed = 1120;
const previewDashDuration = 0.13;
const previewDashCooldown = 0.34;
const minimumTimelineLaneCount = 1;
const maximumTimelineLaneCount = 12;
const undoStack: BulletPattern[] = [];
const redoStack: BulletPattern[] = [];
const defaultTimelineSettings: TimelineSettings = {
  musicOffset: 0,
  bpm: 120,
  beatsPerMeasure: 4,
};
const timeFieldNames = new Set([
  "startTime",
  "duration",
  "clipInterval",
  "radialInterval",
  "triggerTime",
  "repeatInterval",
  "fireInterval",
  "warningTime",
  "moveTime",
  "holdTime",
  "returnTime",
  "switchInterval",
]);

interface NumberFieldConfig {
  name: string;
  label: string;
  min: number;
  max: number;
  step: number;
  integer?: boolean;
  kinds: AttackEventKind[];
}

interface SelectFieldConfig {
  name: string;
  label: string;
  kinds: AttackEventKind[];
  options: Array<{ value: string; label: string }>;
}

interface CheckboxFieldConfig {
  name: string;
  label: string;
  kinds: AttackEventKind[];
}

interface TrajectoryRender {
  points: Array<{ x: number; y: number }>;
  color: number;
  alpha: number;
}

interface CompactFieldGroup {
  label: string;
  fields: string[];
}

interface PropertyGroupConfig {
  title: string;
  numberFields?: string[];
  selectFields?: string[];
  checkboxFields?: string[];
  includeColor?: boolean;
}

const compactFieldGroups: CompactFieldGroup[] = [
  { label: "origin", fields: ["originX", "originY"] },
  { label: "originVelocity", fields: ["originVx", "originVy"] },
  { label: "position", fields: ["x", "y"] },
  { label: "target", fields: ["targetX", "targetY"] },
  { label: "start", fields: ["startX", "startY"] },
  { label: "end", fields: ["endX", "endY"] },
  { label: "polynomial", fields: ["polynomialD", "polynomialC", "polynomialB", "polynomialA"] },
];

const propertyGroups: PropertyGroupConfig[] = [
  { title: "Timing", numberFields: ["startTime", "duration", "warningTime", "warningAlpha"] },
  { title: "Fire", checkboxFields: ["aimAtPlayer"], numberFields: ["clipCount", "clipRepeat", "clipInterval", "angleStepDeg", "baseAngleDeg"] },
  { title: "Origin", numberFields: ["originX", "originY", "originVx", "originVy"] },
  { title: "Trajectory", numberFields: ["pathStartX", "pathSpeed", "polynomialA", "polynomialB", "polynomialC", "polynomialD", "gravity"] },
  { title: "Polar", numberFields: ["polarRadius", "polarRadiusVelocity", "polarTheta", "polarThetaVelocity"] },
  { title: "Visual", selectFields: ["typeId"], numberFields: ["visualSize", "visualWidth", "visualHeight", "visualAngle", "angleSpeed"], includeColor: true },
];

const numberFieldConfigs: NumberFieldConfig[] = [
  { name: "warningAlpha", label: "warning alpha", min: 0.02, max: 1, step: 0.05, kinds: ["movingBlock", "wallSweep", "beatPulseRing", "closingWalls", "safeLaneShift"] },
  { name: "startTime", label: "開始時刻", min: 0, max: pattern.duration, step: 0.1, kinds: allKinds() },
  { name: "duration", label: "継続時間", min: 0.1, max: 30, step: 0.1, kinds: allKinds() },
  { name: "originX", label: "発生X", min: -1000, max: 2000, step: 1, kinds: unityMotionKinds() },
  { name: "originY", label: "発生Y", min: -1000, max: 2000, step: 1, kinds: unityMotionKinds() },
  { name: "originVx", label: "発生元速度X", min: -1000, max: 1000, step: 5, kinds: unityMotionKinds() },
{ name: "originVy", label: "発生元速度Y", min: -1000, max: 1000, step: 5, kinds: unityMotionKinds() },
{ name: "polynomialA", label: "polynomial x", min: -8, max: 8, step: 0.05, kinds: unityMotionKinds() },
{ name: "polynomialB", label: "polynomial x^2", min: -8, max: 8, step: 0.05, kinds: unityMotionKinds() },
{ name: "polynomialC", label: "polynomial x^3", min: -8, max: 8, step: 0.05, kinds: unityMotionKinds() },
{ name: "polynomialD", label: "polynomial x^4", min: -8, max: 8, step: 0.05, kinds: unityMotionKinds() },
  { name: "pathStartX", label: "開始距離", min: -1000, max: 1000, step: 1, kinds: unityMotionKinds() },
  { name: "pathSpeed", label: "移動速度", min: 0, max: 1600, step: 10, kinds: unityMotionKinds() },
  { name: "polarRadius", label: "距離倍率", min: -10, max: 10, step: 0.05, kinds: unityMotionKinds() },
  { name: "polarRadiusVelocity", label: "距離倍率速度", min: -10, max: 10, step: 0.05, kinds: unityMotionKinds() },
  { name: "polarTheta", label: "移動角度", min: -720, max: 720, step: 5, kinds: unityMotionKinds() },
  { name: "polarThetaVelocity", label: "移動角速度", min: -720, max: 720, step: 5, kinds: unityMotionKinds() },
  { name: "gravity", label: "重力", min: -1000, max: 1000, step: 10, kinds: unityMotionKinds() },
  { name: "angleSpeed", label: "見た目回転速度", min: -1440, max: 1440, step: 10, kinds: unityMotionKinds() },
  { name: "typeId", label: "typeId", min: 0, max: 4, step: 1, integer: true, kinds: unityMotionKinds() },
  { name: "visualSize", label: "基本サイズ", min: 1, max: 120, step: 1, kinds: unityMotionKinds() },
  { name: "visualWidth", label: "見た目幅", min: 1, max: 2000, step: 1, kinds: unityMotionKinds() },
  { name: "visualHeight", label: "見た目高さ", min: 1, max: 2000, step: 1, kinds: unityMotionKinds() },
  { name: "visualAngle", label: "見た目角度", min: -720, max: 720, step: 5, kinds: unityMotionKinds() },
  { name: "clipCount", label: "同時発射数", min: 1, max: 256, step: 1, integer: true, kinds: ["spawn_bullet_spread", "spawn_aimed_spread", "fire_from_moving_origin"] },
  { name: "clipInterval", label: "連射間隔", min: 0, max: 10, step: 0.05, kinds: ["spawn_bullet_spread", "spawn_aimed_spread", "fire_from_moving_origin"] },
  { name: "clipRepeat", label: "連射回数", min: 1, max: 256, step: 1, integer: true, kinds: ["spawn_bullet_spread", "spawn_aimed_spread", "fire_from_moving_origin"] },
  { name: "angleStepDeg", label: "角度間隔", min: -360, max: 360, step: 1, kinds: ["spawn_bullet_spread", "spawn_aimed_spread", "fire_from_moving_origin"] },
  { name: "baseAngleDeg", label: "基準角度", min: -720, max: 720, step: 5, kinds: ["spawn_bullet_spread", "spawn_aimed_spread", "fire_from_moving_origin"] },
  { name: "radialCount", label: "円形弾数", min: 1, max: 256, step: 1, integer: true, kinds: ["spawn_radial"] },
  { name: "radialRepeat", label: "円形回数", min: 1, max: 256, step: 1, integer: true, kinds: ["spawn_radial"] },
  { name: "radialInterval", label: "円形間隔", min: 0, max: 10, step: 0.05, kinds: ["spawn_radial"] },
  { name: "radialStartAngle", label: "開始角度", min: -720, max: 720, step: 5, kinds: ["spawn_radial"] },
  { name: "originSize", label: "発生源サイズ", min: 4, max: 160, step: 1, kinds: ["spawn_enemy_origin"] },
  { name: "laserCount", label: "レーザー本数", min: 1, max: 64, step: 1, integer: true, kinds: ["spawn_curved_laser"] },
  { name: "laserAngleStepDeg", label: "レーザー角度間隔", min: -360, max: 360, step: 1, kinds: ["spawn_curved_laser"] },
  { name: "laserWidth", label: "レーザー幅", min: 1, max: 200, step: 1, kinds: ["spawn_curved_laser"] },
  { name: "laserLength", label: "レーザー長さ", min: 1, max: 2000, step: 10, kinds: ["spawn_curved_laser"] },
  { name: "growSpeed", label: "伸長速度", min: 0, max: 2000, step: 10, kinds: ["spawn_curved_laser"] },
  { name: "triggerTime", label: "trigger time", min: 0, max: 30, step: 0.1, kinds: ["transform_bullet"] },
  { name: "targetTypeId", label: "target typeId", min: 0, max: 32, step: 1, integer: true, kinds: ["transform_bullet"] },
  { name: "nextTypeId", label: "next typeId", min: 0, max: 32, step: 1, integer: true, kinds: ["transform_bullet"] },
  { name: "nextSpeed", label: "next speed", min: 0, max: 1600, step: 10, kinds: ["transform_bullet"] },
  { name: "nextAngleDeg", label: "next angle", min: -720, max: 720, step: 5, kinds: ["transform_bullet"] },
  { name: "x", label: "X位置", min: 0, max: pattern.stage.width, step: 1, kinds: ["radialBurst", "aimedSpread", "bossMirroredFan", "polynomialProjectile", "curvedLaserRing", "laserBeam", "rotatingShape"] },
  { name: "y", label: "Y位置", min: 0, max: pattern.stage.height, step: 1, kinds: ["radialBurst", "aimedSpread", "bossMirroredFan", "polynomialProjectile", "curvedLaserRing", "laserBeam", "rotatingShape"] },
  { name: "targetX", label: "狙いX", min: 0, max: pattern.stage.width, step: 1, kinds: ["aimedSpread", "bossMirroredFan"] },
  { name: "targetY", label: "狙いY", min: 0, max: pattern.stage.height, step: 1, kinds: ["aimedSpread", "bossMirroredFan"] },
  { name: "bulletCount", label: "弾数", min: 1, max: 128, step: 1, integer: true, kinds: ["radialBurst", "polynomialProjectile"] },
  { name: "wayCount", label: "Way数", min: 1, max: 64, step: 1, integer: true, kinds: ["aimedSpread"] },
  { name: "angleCount", label: "角度数", min: 1, max: 64, step: 1, integer: true, kinds: ["bossMirroredFan"] },
  { name: "speedLayers", label: "速度層", min: 1, max: 12, step: 1, integer: true, kinds: ["bossMirroredFan"] },
  { name: "laserCount", label: "本数", min: 1, max: 32, step: 1, integer: true, kinds: ["curvedLaserRing"] },
  { name: "bulletSpeed", label: "速度", min: 0, max: 1200, step: 10, kinds: ["radialBurst", "aimedSpread", "polynomialProjectile"] },
  { name: "bulletRadius", label: "弾サイズ", min: 1, max: 80, step: 1, kinds: ["radialBurst", "aimedSpread", "bossMirroredFan", "polynomialProjectile"] },
  { name: "minSpeed", label: "最低速度", min: 0, max: 1200, step: 10, kinds: ["bossMirroredFan"] },
  { name: "speedStep", label: "速度差", min: 0, max: 600, step: 5, kinds: ["bossMirroredFan"] },
  { name: "startAngle", label: "開始角度", min: -720, max: 720, step: 5, kinds: ["radialBurst", "polynomialProjectile", "curvedLaserRing", "rotatingShape"] },
  { name: "arcDegrees", label: "発射角度幅", min: -360, max: 360, step: 5, kinds: ["radialBurst"] },
  { name: "spreadDegrees", label: "扇角", min: -360, max: 360, step: 5, kinds: ["aimedSpread", "polynomialProjectile"] },
  { name: "angleStepDegrees", label: "角度刻み", min: -90, max: 90, step: 1, kinds: ["bossMirroredFan"] },
  { name: "angleOffsetDegrees", label: "角度オフセット", min: -180, max: 180, step: 1, kinds: ["bossMirroredFan"] },
  { name: "aimOffsetDegrees", label: "狙い補正角", min: -180, max: 180, step: 1, kinds: ["aimedSpread"] },
  { name: "repeatCount", label: "繰り返し回数", min: 1, max: 16, step: 1, integer: true, kinds: ["radialBurst"] },
  { name: "repeatInterval", label: "繰り返し間隔", min: 0, max: 10, step: 0.1, kinds: ["radialBurst"] },
  { name: "fireCount", label: "発射回数", min: 1, max: 128, step: 1, integer: true, kinds: ["aimedSpread", "bossMirroredFan", "polynomialProjectile"] },
  { name: "fireInterval", label: "発射間隔", min: 0, max: 10, step: 0.1, kinds: ["aimedSpread", "bossMirroredFan", "polynomialProjectile"] },
  { name: "originVx", label: "発射元速度X", min: -600, max: 600, step: 5, kinds: ["polynomialProjectile"] },
  { name: "originVy", label: "発射元速度Y", min: -600, max: 600, step: 5, kinds: ["polynomialProjectile"] },
  { name: "curveA", label: "曲線A", min: -500, max: 500, step: 1, kinds: ["polynomialProjectile", "curvedLaserRing"] },
  { name: "curveB", label: "曲線B", min: -500, max: 500, step: 1, kinds: ["polynomialProjectile", "curvedLaserRing"] },
  { name: "thetaVelocity", label: "回転角速度", min: -720, max: 720, step: 5, kinds: ["polynomialProjectile"] },
  { name: "gravity", label: "重力", min: -1000, max: 1000, step: 10, kinds: ["polynomialProjectile"] },
  { name: "extendSpeed", label: "伸長速度", min: 0, max: 1200, step: 10, kinds: ["curvedLaserRing"] },
  { name: "rotationSpeed", label: "回転速度", min: -720, max: 720, step: 5, kinds: ["curvedLaserRing", "rotatingShape"] },
  { name: "warningTime", label: "予告時間", min: 0, max: 10, step: 0.1, kinds: ["movingBlock", "wallSweep", "beatPulseRing", "closingWalls", "safeLaneShift"] },
  { name: "width", label: "幅", min: 4, max: 1400, step: 1, kinds: ["warningZone", "movingBlock"] },
  { name: "height", label: "高さ", min: 4, max: 1400, step: 1, kinds: ["warningZone", "movingBlock"] },
  { name: "radius", label: "半径", min: 1, max: 700, step: 1, kinds: ["warningZone", "movingBlock"] },
  { name: "angle", label: "角度", min: -720, max: 720, step: 5, kinds: ["warningZone"] },
  { name: "sides", label: "頂点数", min: 3, max: 12, step: 1, integer: true, kinds: ["warningZone", "movingBlock"] },
  { name: "blinkRate", label: "点滅速度", min: 0, max: 20, step: 0.5, kinds: ["warningZone"] },
  { name: "zoneAlpha", label: "透明度", min: 0.05, max: 1, step: 0.05, kinds: ["warningZone"] },
  { name: "startX", label: "始点X", min: 0, max: pattern.stage.width, step: 1, kinds: ["movingBlock"] },
  { name: "startY", label: "始点Y", min: 0, max: pattern.stage.height, step: 1, kinds: ["movingBlock"] },
  { name: "endX", label: "終点X", min: 0, max: pattern.stage.width, step: 1, kinds: ["movingBlock"] },
  { name: "endY", label: "終点Y", min: 0, max: pattern.stage.height, step: 1, kinds: ["movingBlock"] },
  { name: "rotationStart", label: "初期回転", min: -720, max: 720, step: 5, kinds: ["movingBlock"] },
  { name: "thickness", label: "壁の厚み", min: 8, max: 360, step: 1, kinds: ["wallSweep"] },
  { name: "length", label: "壁の長さ", min: 40, max: Math.max(pattern.stage.width, pattern.stage.height), step: 1, kinds: ["wallSweep"] },
  { name: "offset", label: "壁の中心位置", min: 0, max: Math.max(pattern.stage.width, pattern.stage.height), step: 1, kinds: ["wallSweep"] },
  { name: "safeGapSize", label: "安全な隙間", min: 0, max: Math.max(pattern.stage.width, pattern.stage.height), step: 1, kinds: ["wallSweep"] },
  { name: "safeGapCenter", label: "隙間位置", min: 0, max: Math.max(pattern.stage.width, pattern.stage.height), step: 1, kinds: ["wallSweep"] },
  { name: "length", label: "レーザー長", min: 40, max: 1400, step: 10, kinds: ["laserBeam", "curvedLaserRing"] },
  { name: "width", label: "レーザー幅", min: 4, max: 180, step: 1, kinds: ["laserBeam", "curvedLaserRing"] },
  { name: "startSize", label: "開始サイズ", min: 1, max: 1200, step: 1, kinds: ["beatPulseRing"] },
  { name: "endSize", label: "終了サイズ", min: 1, max: 1600, step: 1, kinds: ["beatPulseRing"] },
  { name: "thickness", label: "リング太さ", min: 1, max: 140, step: 1, kinds: ["beatPulseRing"] },
  { name: "repeatCount", label: "繰り返し回数", min: 1, max: 64, step: 1, integer: true, kinds: ["beatPulseRing"] },
  { name: "repeatInterval", label: "繰り返し間隔", min: 0, max: 10, step: 0.1, kinds: ["beatPulseRing"] },
  { name: "distance", label: "迫る距離", min: 0, max: 600, step: 1, kinds: ["closingWalls"] },
  { name: "thickness", label: "壁の厚み", min: 8, max: 360, step: 1, kinds: ["closingWalls"] },
  { name: "moveTime", label: "移動時間", min: 0.05, max: 10, step: 0.1, kinds: ["closingWalls"] },
  { name: "holdTime", label: "停止時間", min: 0, max: 10, step: 0.1, kinds: ["closingWalls"] },
  { name: "returnTime", label: "戻る時間", min: 0.05, max: 10, step: 0.1, kinds: ["closingWalls"] },
  { name: "laneWidth", label: "安全レーン幅", min: 20, max: 900, step: 1, kinds: ["safeLaneShift"] },
  { name: "firstLaneCenter", label: "レーン位置A", min: 0, max: Math.max(pattern.stage.width, pattern.stage.height), step: 1, kinds: ["safeLaneShift"] },
  { name: "secondLaneCenter", label: "レーン位置B", min: 0, max: Math.max(pattern.stage.width, pattern.stage.height), step: 1, kinds: ["safeLaneShift"] },
  { name: "switchInterval", label: "切替間隔", min: 0.05, max: 10, step: 0.1, kinds: ["safeLaneShift"] },
  { name: "switchCount", label: "切替回数", min: 1, max: 64, step: 1, integer: true, kinds: ["safeLaneShift"] },
  { name: "angle", label: "角度", min: -720, max: 720, step: 5, kinds: ["laserBeam"] },
  { name: "orbitRadius", label: "回転半径", min: 0, max: 420, step: 5, kinds: ["rotatingShape"] },
  { name: "size", label: "図形サイズ", min: 4, max: 160, step: 1, kinds: ["rotatingShape"] },
  { name: "sides", label: "角数", min: 3, max: 12, step: 1, integer: true, kinds: ["rotatingShape"] },
];

const selectFieldConfigs: SelectFieldConfig[] = [
  {
    name: "typeId",
    label: "visual",
    kinds: unityMotionKinds(),
    options: [
      { value: "0", label: "Bullet" },
      { value: "1", label: "Square" },
      { value: "2", label: "Diamond" },
      { value: "3", label: "Wall" },
      { value: "4", label: "Laser" },
    ],
  },
  {
    name: "shape",
    label: "形状",
    kinds: ["warningZone"],
    options: [
      { value: "rectangle", label: "Rectangle" },
      { value: "circle", label: "Circle" },
      { value: "line", label: "Line" },
      { value: "polygon", label: "Polygon" },
    ],
  },
  {
    name: "shape",
    label: "形状",
    kinds: ["movingBlock"],
    options: [
      { value: "rectangle", label: "Rectangle" },
      { value: "triangle", label: "Triangle" },
      { value: "circle", label: "Circle" },
      { value: "polygon", label: "Polygon" },
    ],
  },
  {
    name: "shape",
    label: "リング形状",
    kinds: ["beatPulseRing"],
    options: [
      { value: "circle", label: "Circle" },
      { value: "square", label: "Square" },
    ],
  },
  {
    name: "edge",
    label: "出現方向",
    kinds: ["wallSweep"],
    options: [
      { value: "left", label: "Left" },
      { value: "right", label: "Right" },
      { value: "top", label: "Top" },
      { value: "bottom", label: "Bottom" },
    ],
  },
  {
    name: "mode",
    label: "迫る方向",
    kinds: ["closingWalls"],
    options: [
      { value: "horizontal", label: "Horizontal" },
      { value: "vertical", label: "Vertical" },
      { value: "all", label: "All" },
    ],
  },
  {
    name: "orientation",
    label: "レーン方向",
    kinds: ["safeLaneShift"],
    options: [
      { value: "vertical", label: "Vertical" },
      { value: "horizontal", label: "Horizontal" },
    ],
  },
];

const checkboxFieldConfigs: CheckboxFieldConfig[] = [
  { name: "aimAtPlayer", label: "aimAtPlayer", kinds: unityMotionKinds() },
];

const propertyDescriptions: Record<string, string> = {
  startTime: "タイムライン上で、このイベントが始まる時刻です。",
  duration: "発射された攻撃が有効な状態で残る時間です。",
  warningTime: "本体攻撃が始まる前にWarningを表示する時間です。",
  warningAlpha: "自動で表示されるWarningの透明度です。0に近いほど薄く、1に近いほど濃く表示されます。",
  clipCount: "同じタイミングで生成する弾や図形の数です。",
  clipRepeat: "最初の発射後に、このイベントを何回繰り返すかです。",
  clipInterval: "繰り返し発射するときの間隔です。",
  angleStepDeg: "同時に発射される弾同士の角度差です。",
  baseAngleDeg: "扇状配置や自機狙い補正をかける前の基準角度です。",
  aimAtPlayer: "オンにすると、発射時点のプレイヤー位置を狙います。",
  originX: "プレビュー座標での発生位置Xです。",
  originY: "プレビュー座標での発生位置Yです。",
  originVx: "発生元そのものに加える横方向の速度です。",
  originVy: "発生元そのものに加える縦方向の速度です。",
  pathStartX: "軌道計算を始めるローカル距離です。",
  pathSpeed: "ローカル軌道上を進む速度です。",
  polynomialA: "ローカル軌道 y = ax^4 + bx^3 + cx^2 + dx の x 項に掛ける係数です。x と y は100px単位です。",
  polynomialB: "ローカル軌道 y = ax^4 + bx^3 + cx^2 + dx の x^2 項に掛ける係数です。x と y は100px単位です。",
  polynomialC: "ローカル軌道 y = ax^4 + bx^3 + cx^2 + dx の x^3 項に掛ける係数です。x と y は100px単位です。",
  polynomialD: "ローカル軌道 y = ax^4 + bx^3 + cx^2 + dx の x^4 項に掛ける係数です。x と y は100px単位です。",
  gravity: "攻撃が存在する間に加わる下向きの加速度です。",
  polarRadius: "軌道計算後に掛ける距離倍率です。",
  polarRadiusVelocity: "距離倍率を時間で変化させる速度です。",
  polarTheta: "軌道計算後に掛ける回転角度です。",
  polarThetaVelocity: "回転角度を時間で変化させる速度です。",
  typeId: "この攻撃の見た目を決めるプリセットです。",
  visualSize: "円形など、単一サイズで描く見た目の基本サイズです。",
  visualWidth: "四角形、ひし形、壁、レーザーなどの見た目の幅です。ひし形では外接する幅になります。",
  visualHeight: "四角形、ひし形、壁、レーザーなどの見た目の高さです。ひし形では外接する高さになります。",
  visualAngle: "見た目だけに加える回転角度です。",
  angleSpeed: "見た目を毎秒どれだけ回転させるかです。",
  color: "プレビューとタイムラインで使う攻撃色です。",
  musicOffset: "音楽グリッドの開始位置です。曲の拍と線を合わせるために使います。",
  bpm: "1分あたりの拍数です。変更すると1小節の時間も更新されます。",
  measureSeconds: "1小節の長さです。変更するとBPMも更新されます。",
  beatsPerMeasure: "1小節に含まれる拍数です。",
  volume: "音楽再生の音量です。",
};

const appRoot = document.querySelector<HTMLDivElement>("#app");

if (!appRoot) {
  throw new Error("#app was not found.");
}

appRoot.innerHTML = `
  <div class="app-shell">
    <header class="toolbar">
      <div class="brand">
        <div class="brand-title">弾幕メーカー ${appVersion}</div>
      </div>
      <nav class="menu-bar" aria-label="メインメニュー">
        <div class="menu">
          <button class="menu-button" type="button" data-menu-button="file">ファイル</button>
          <div class="menu-popover" data-menu="file">
            <button id="export-button" class="menu-item" type="button">${iconSvg("download")}<span>書き出し</span></button>
            <button id="import-button" class="menu-item" type="button">${iconSvg("upload")}<span>読み込み</span></button>
            <button id="import-ai-beatmap-button" class="menu-item" type="button">${iconSvg("sparkles")}<span>AI譜面読み込み</span></button>
          </div>
        </div>
        <div class="menu">
          <button class="menu-button" type="button" data-menu-button="edit">編集</button>
          <div class="menu-popover" data-menu="edit">
            <button id="undo-button" class="menu-item" type="button">${iconSvg("undo")}<span>取り消し</span></button>
            <button id="redo-button" class="menu-item" type="button">${iconSvg("redo")}<span>やり直し</span></button>
          </div>
        </div>
        <div class="menu">
          <button class="menu-button" type="button" data-menu-button="add">追加</button>
          <div class="menu-popover" data-menu="add">
            <div class="menu-section-label">単発弾</div>
            <div class="menu-section">
              <button class="menu-item" type="button" data-add-kind="spawn_bullet_spread" data-add-template="single-bullet">${iconSvg("dot")}<span>単発弾</span></button>
              <button class="menu-item" type="button" data-add-kind="spawn_bullet_spread" data-add-template="aimed-3way">${iconSvg("target")}<span>自機狙い3Way</span></button>
              <button class="menu-item" type="button" data-add-kind="spawn_bullet_spread" data-add-template="fan-burst">${iconSvg("fan")}<span>扇状連射</span></button>
              <button class="menu-item" type="button" data-add-kind="spawn_bullet_spread" data-add-template="radial-burst">${iconSvg("circle")}<span>円形バースト</span></button>
              <button class="menu-item" type="button" data-add-kind="spawn_bullet_spread" data-add-template="horizontal-laser">${iconSvg("laser")}<span>水平レーザー</span></button>
              <button class="menu-item" type="button" data-add-kind="spawn_bullet_spread" data-add-template="left-wall">${iconSvg("wall")}<span>左壁スイープ</span></button>
              <button class="menu-item" type="button" data-add-kind="spawn_bullet_spread" data-add-template="orbiting-diamond">${iconSvg("rotate")}<span>回転ダイヤ</span></button>
              <button class="menu-item" type="button" data-add-kind="spawn_bullet_spread" data-add-template="boss-fan">${iconSvg("fan")}<span>ボス扇弾</span></button>
              <button class="menu-item" type="button" data-add-kind="spawn_bullet_spread" data-add-template="polynomial-radial">${iconSvg("curve")}<span>カーブ回転弾</span></button>
              <button class="menu-item" type="button" data-add-kind="spawn_bullet_spread" data-add-template="curved-laser-ring">${iconSvg("burst")}<span>8方向カーブレーザー</span></button>
            </div>
            <div class="menu-divider" role="separator"></div>
            <div id="package-menu-items" class="package-menu-items"></div>
            <div class="menu-divider" role="separator"></div>
            <button id="import-package-button" class="menu-item" type="button">${iconSvg("upload")}<span>コードからパッケージを追加</span></button>
          </div>
        </div>
      </nav>
      <div class="mode-toggle" role="group" aria-label="編集モード">
        <button class="mode-toggle-button is-active" type="button" data-editor-mode="global">全体編集</button>
        <button class="mode-toggle-button" type="button" data-editor-mode="trajectory">軌跡編集</button>
        <button class="mode-toggle-button" type="button" data-editor-mode="preview">プレビュー</button>
      </div>
      <div class="hidden-inputs">
        <input id="import-input" type="file" accept="application/json,.json" hidden />
        <input id="ai-beatmap-input" type="file" accept="application/json,.json" hidden />
        <input id="package-code-input" type="file" accept=".mjs,text/javascript,application/javascript" hidden />
        <input id="music-input" type="file" accept="audio/*" hidden />
      </div>
      <div class="toolbar-spacer"></div>
    </header>

    <main class="workspace">
      <section class="preview-panel">
        <div id="preview-host"></div>
        <div id="trajectory-mode-notice" class="trajectory-mode-notice" hidden></div>
      </section>
      <aside class="inspector-panel">
        <div class="inspector-tabs" role="tablist" aria-label="Inspector tabs">
          <button class="inspector-tab-button is-active" type="button" data-inspector-tab="events" role="tab" aria-selected="true">${iconSvg("list")}<span>イベント</span></button>
          <button class="inspector-tab-button" type="button" data-inspector-tab="properties" role="tab" aria-selected="false">${iconSvg("sliders")}<span>プロパティ</span></button>
          <button class="inspector-tab-button" type="button" data-inspector-tab="music" role="tab" aria-selected="false">${iconSvg("music")}<span>音楽</span></button>
        </div>
        <section id="events-tab-panel" class="inspector-tab-panel" data-inspector-panel="events" role="tabpanel">
          <div id="event-list" class="event-list"></div>
        </section>
        <section id="properties-tab-panel" class="inspector-tab-panel" data-inspector-panel="properties" role="tabpanel" hidden>
          <form id="property-form" class="property-form"></form>
        </section>
        <section id="music-tab-panel" class="inspector-tab-panel music-panel" data-inspector-panel="music" role="tabpanel" hidden>
          <div id="music-display" class="music-display">No music</div>
          <button id="music-button" class="music-load-button" type="button">${iconSvg("music")}<span>音楽を読み込む</span></button>
          <label class="music-control">
            <span title="${getPropertyTooltip("volume")}">volume</span>
            <input id="music-volume-input" type="range" min="0" max="100" step="1" value="${Math.round(defaultMusicVolume * 100)}" aria-label="音量" />
          </label>
          <div class="music-settings-grid">
            <label><span title="${getPropertyTooltip("musicOffset")}">musicOffset</span><input id="music-offset-input" type="number" min="-60" max="600" step="0.01" /></label>
            <label><span title="${getPropertyTooltip("bpm")}">BPM</span><input id="bpm-input" type="number" min="1" max="400" step="0.1" /></label>
            <label><span title="${getPropertyTooltip("measureSeconds")}">measureSeconds</span><input id="measure-interval-input" type="number" min="0.05" max="120" step="0.01" /></label>
            <label><span title="${getPropertyTooltip("beatsPerMeasure")}">beatsPerMeasure</span><input id="beats-per-measure-input" type="number" min="1" max="16" step="1" /></label>
          </div>
        </section>
      </aside>
    </main>

    <section class="timeline-panel">
      <div class="timeline-header">
        <div class="timeline-title-row">
          <span>タイムライン</span>
          <button id="snap-toggle-button" class="snap-toggle-button" type="button" aria-pressed="false">${iconSvg("magnet")}<span>スナップ</span></button>
          <button id="add-timeline-lane-button" class="snap-toggle-button" type="button" title="タイムライン行を追加">${iconSvg("rows")}<span>行追加</span></button>
        </div>
        <div class="timeline-playback-tools" aria-label="再生操作">
          <button id="reset-button" class="icon-button" type="button" title="リセット" aria-label="リセット">${iconSvg("rewind")}</button>
          <button id="play-button" class="icon-button" type="button" title="再生" aria-label="再生">${iconSvg("play")}</button>
        </div>
        <div class="timeline-status">
          <div id="time-display" class="time-display">0.00s / ${pattern.duration.toFixed(2)}s</div>
          <span id="timeline-zoom-display" class="timeline-zoom-display">100%</span>
        </div>
      </div>
      <div id="timeline-viewport" class="timeline-viewport">
        <div id="timeline-content" class="timeline-content">
          <div id="timeline-track" class="timeline-track">
            <div id="timeline-playhead" class="timeline-playhead"></div>
          </div>
          <canvas id="waveform-canvas" class="waveform-canvas" width="1200" height="48"></canvas>
        </div>
      </div>
    </section>
  </div>
`;

document.querySelector<HTMLElement>("#package-menu-items")?.insertAdjacentHTML("beforeend", renderPackageMenuItems());
document.querySelector<HTMLElement>("#export-button")?.insertAdjacentHTML(
  "afterend",
  `<button id="export-unity-button" class="menu-item" type="button">${iconSvg("download")}<span>Unity向け書き出し</span></button>`,
);
document.querySelector<HTMLElement>(".inspector-panel")?.insertAdjacentHTML("afterbegin", '<div id="inspector-resize-handle" class="inspector-resize-handle" aria-hidden="true"></div>');
document.querySelector<HTMLElement>(".inspector-tabs")?.children[0]?.insertAdjacentHTML(
  "afterend",
  `<button class="inspector-tab-button" type="button" data-inspector-tab="package" role="tab" aria-selected="false">${iconSvg("box")}<span>パッケージ</span></button>`,
);
document.querySelector<HTMLElement>("#events-tab-panel")?.insertAdjacentHTML(
  "afterend",
  '<section id="package-tab-panel" class="inspector-tab-panel" data-inspector-panel="package" role="tabpanel" hidden><div id="package-panel" class="package-panel"></div></section>',
);
document.querySelector<HTMLElement>(".timeline-panel")?.insertAdjacentHTML("afterbegin", '<div id="timeline-resize-handle" class="timeline-resize-handle" aria-hidden="true"></div>');

const previewHost = requireElement<HTMLDivElement>("#preview-host");
const previewPanel = requireElement<HTMLElement>(".preview-panel");
const trajectoryModeNotice = requireElement<HTMLDivElement>("#trajectory-mode-notice");
const appShell = requireElement<HTMLDivElement>(".app-shell");
const playButton = requireElement<HTMLButtonElement>("#play-button");
const resetButton = requireElement<HTMLButtonElement>("#reset-button");
const exportButton = requireElement<HTMLButtonElement>("#export-button");
const exportUnityButton = requireElement<HTMLButtonElement>("#export-unity-button");
const importButton = requireElement<HTMLButtonElement>("#import-button");
const importAiBeatmapButton = requireElement<HTMLButtonElement>("#import-ai-beatmap-button");
const importPackageButton = requireElement<HTMLButtonElement>("#import-package-button");
const musicButton = requireElement<HTMLButtonElement>("#music-button");
const undoButton = requireElement<HTMLButtonElement>("#undo-button");
const redoButton = requireElement<HTMLButtonElement>("#redo-button");
const importInput = requireElement<HTMLInputElement>("#import-input");
const aiBeatmapInput = requireElement<HTMLInputElement>("#ai-beatmap-input");
const packageCodeInput = requireElement<HTMLInputElement>("#package-code-input");
const musicInput = requireElement<HTMLInputElement>("#music-input");
const timeDisplay = requireElement<HTMLDivElement>("#time-display");
const musicDisplay = requireElement<HTMLDivElement>("#music-display");
const eventList = requireElement<HTMLDivElement>("#event-list");
const packagePanel = requireElement<HTMLDivElement>("#package-panel");
const propertyForm = requireElement<HTMLFormElement>("#property-form");
const timelineViewport = requireElement<HTMLDivElement>("#timeline-viewport");
const timelineContent = requireElement<HTMLDivElement>("#timeline-content");
const timelineTrack = requireElement<HTMLDivElement>("#timeline-track");
const timelinePlayhead = requireElement<HTMLDivElement>("#timeline-playhead");
const snapToggleButton = requireElement<HTMLButtonElement>("#snap-toggle-button");
const addTimelineLaneButton = requireElement<HTMLButtonElement>("#add-timeline-lane-button");
const waveformCanvas = requireElement<HTMLCanvasElement>("#waveform-canvas");
const musicOffsetInput = requireElement<HTMLInputElement>("#music-offset-input");
const bpmInput = requireElement<HTMLInputElement>("#bpm-input");
const measureIntervalInput = requireElement<HTMLInputElement>("#measure-interval-input");
const beatsPerMeasureInput = requireElement<HTMLInputElement>("#beats-per-measure-input");
const musicVolumeInput = requireElement<HTMLInputElement>("#music-volume-input");
const timelineZoomDisplay = requireElement<HTMLSpanElement>("#timeline-zoom-display");
const timelineResizeHandle = requireElement<HTMLDivElement>("#timeline-resize-handle");
const inspectorResizeHandle = requireElement<HTMLDivElement>("#inspector-resize-handle");
const addMenu = requireElement<HTMLDivElement>('[data-menu="add"]');
const packageMenuItems = requireElement<HTMLDivElement>("#package-menu-items");
const menuButtons = [...document.querySelectorAll<HTMLButtonElement>("[data-menu-button]")];
const menuPopovers = [...document.querySelectorAll<HTMLDivElement>("[data-menu]")];
const inspectorTabButtons = [...document.querySelectorAll<HTMLButtonElement>("[data-inspector-tab]")];
const inspectorPanels = [...document.querySelectorAll<HTMLElement>("[data-inspector-panel]")];
const editorModeButtons = [...document.querySelectorAll<HTMLButtonElement>("[data-editor-mode]")];

const preview = new PreviewStage(pattern.stage);
await preview.mount(previewHost);
preview.setPackageHandleDragCallback(handlePackageHandleDrag);
syncLayoutSizeVariables();
exportButton.querySelector("span")!.textContent = "プロジェクト書き出し";

audio.addEventListener("loadedmetadata", () => {
  if (Number.isFinite(audio.duration)) {
    pattern.duration = Math.max(pattern.duration, audio.duration);
  }

  renderEverything();
});

audio.addEventListener("ended", () => {
  clock.stop();
  syncUi();
});

renderEverything();
resizePreviewHost();

menuButtons.forEach((button) => {
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleMenu(button.dataset.menuButton ?? "");
  });
});

inspectorTabButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const nextTab = button.dataset.inspectorTab;

    if (nextTab === "events" || nextTab === "package" || nextTab === "properties" || nextTab === "music") {
      activeInspectorTab = nextTab;
      renderInspectorTabs();
    }
  });
});

editorModeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const mode = button.dataset.editorMode;

    if (mode === "global" || mode === "trajectory" || mode === "preview") {
      setEditorMode(mode);
    }
  });
});

document.addEventListener("click", (event) => {
  if (event.target instanceof Element && event.target.closest(".menu")) {
    return;
  }

  closeMenus();
});

for (const button of [playButton, resetButton]) {
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
}

playButton.addEventListener("pointerup", (event) => {
  if (event.button !== 0) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  suppressNextPlayClick = true;
  togglePlayback();
});

playButton.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  if (suppressNextPlayClick) {
    suppressNextPlayClick = false;
    return;
  }

  togglePlayback();
});

resetButton.addEventListener("pointerup", (event) => {
  if (event.button !== 0) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  suppressNextResetClick = true;
  resetPlayback();
  renderEverything();
});

resetButton.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  if (suppressNextResetClick) {
    suppressNextResetClick = false;
    return;
  }

  resetPlayback();
  renderEverything();
});

exportButton.addEventListener("click", () => {
  closeMenus();
  exportProjectPattern();
});

exportUnityButton.addEventListener("click", () => {
  closeMenus();
  exportUnityPattern();
});

importButton.addEventListener("click", () => {
  closeMenus();
  importInput.click();
});

importAiBeatmapButton.addEventListener("click", () => {
  closeMenus();
  aiBeatmapInput.click();
});

importPackageButton.addEventListener("click", () => {
  closeMenus();
  packageCodeInput.click();
});

musicButton.addEventListener("click", () => {
  closeMenus();
  musicInput.click();
});

undoButton.addEventListener("click", () => {
  closeMenus();
  undoPatternChange();
});

redoButton.addEventListener("click", () => {
  closeMenus();
  redoPatternChange();
});

snapToggleButton.addEventListener("click", () => {
  snapToMeasures = !snapToMeasures;
  syncUi();
});

addTimelineLaneButton.addEventListener("click", () => {
  const currentLaneCount = getTimelineLaneCount();

  if (currentLaneCount >= maximumTimelineLaneCount) {
    return;
  }

  pushHistory();
  pattern.timelineLaneCount = currentLaneCount + 1;
  renderEverything();
});

importInput.addEventListener("change", () => {
  const file = importInput.files?.[0];

  if (!file) {
    return;
  }

  void importPattern(file);
  importInput.value = "";
});

aiBeatmapInput.addEventListener("change", () => {
  const file = aiBeatmapInput.files?.[0];

  if (!file) {
    return;
  }

  void importAiBeatmap(file);
  aiBeatmapInput.value = "";
});

packageCodeInput.addEventListener("change", () => {
  const file = packageCodeInput.files?.[0];

  if (!file) {
    return;
  }

  void importPackageCodeFile(file);
  packageCodeInput.value = "";
});

musicInput.addEventListener("change", () => {
  const file = musicInput.files?.[0];

  if (!file) {
    return;
  }

  void loadMusic(file);
  musicInput.value = "";
});

musicOffsetInput.addEventListener("input", handleMusicOffsetInput);
bpmInput.addEventListener("input", handleBpmInput);
measureIntervalInput.addEventListener("input", handleMeasureIntervalInput);
beatsPerMeasureInput.addEventListener("input", handleBeatsPerMeasureInput);
musicVolumeInput.addEventListener("input", () => {
  const nextVolume = Number(musicVolumeInput.value) / 100;

  if (Number.isFinite(nextVolume)) {
    audio.volume = clamp(nextVolume, 0, 1);
  }
});
timelineViewport.addEventListener("wheel", handleTimelineWheel, { passive: false });
const timelineResizeObserver = new ResizeObserver(() => {
  resizeTimelineToViewport();
});
timelineResizeObserver.observe(timelineViewport);
const previewResizeObserver = new ResizeObserver(() => {
  resizePreviewHost();
});
previewResizeObserver.observe(previewPanel);
window.addEventListener("resize", resizeTimelineToViewport);
window.addEventListener("resize", resizePreviewHost);

addMenu.addEventListener("click", handleAddMenuClick);

function handleAddMenuClick(event: MouseEvent): void {
  const target = event.target;

  if (!(target instanceof Element)) {
    return;
  }

  const deleteButton = target.closest<HTMLButtonElement>("[data-delete-package-kind]");

  if (deleteButton && addMenu.contains(deleteButton)) {
    event.stopPropagation();
    deleteCustomPackage(deleteButton.dataset.deletePackageKind ?? "");
    return;
  }

  const button = target.closest<HTMLButtonElement>("[data-add-kind]");

  if (!button || !addMenu.contains(button)) {
    return;
  }

  const kind = button.dataset.addKind;

  if (!kind || !isAttackEventKind(kind)) {
    return;
  }

  if (isAttackPackageKind(kind)) {
    try {
      const packageEvent = createAttackPackageEvent(kind, clock.time, pattern.stage);
      const generatedEvents = createGeneratedEventsForPackage(packageEvent, pattern.stage);

      pushHistory();
      pattern.events.push(packageEvent, ...generatedEvents);
      selectSingleEvent(packageEvent.id);
      activeInspectorTab = "package";
      closeMenus();
      renderEverything();
    } catch (error) {
      console.error(error);
      window.alert("パッケージを生成できませんでした。読み込んだコードを確認してください。");
    }
    return;
  }

  const attackEvent = createAttackEvent(kind, clock.time, pattern.stage);

  applyAttackTemplate(attackEvent, button.dataset.addTemplate, pattern.stage);
  ensureEventEditorFields(attackEvent);
  pushHistory();
  pattern.events.push(attackEvent);
  sortEvents();
  selectSingleEvent(attackEvent.id);
  closeMenus();
  renderEverything();
}

document.addEventListener("keydown", (event) => {
  const usesCommandKey = event.ctrlKey || event.metaKey;

  if (editorMode === "preview" && !usesCommandKey && !isEditingTarget(event.target)) {
    if (event.code === "Escape") {
      event.preventDefault();
      setEditorMode("global");
      return;
    }

    if (isPreviewControlCode(event.code)) {
      event.preventDefault();
      pressedPreviewKeys.add(event.code);

      if (event.code === "Space" && !event.repeat) {
        dashRequested = true;
      }

      return;
    }
  }

  if (!usesCommandKey && !isEditingTarget(event.target) && (event.code === "ArrowUp" || event.code === "ArrowDown")) {
    event.preventDefault();
    moveSelectedEventLane(event.code === "ArrowUp" ? -1 : 1);
    return;
  }

  if (usesCommandKey && !event.altKey && event.code === "KeyZ") {
    event.preventDefault();

    if (event.shiftKey) {
      redoPatternChange();
    } else {
      undoPatternChange();
    }

    return;
  }

  if (usesCommandKey && !event.altKey && event.code === "KeyY") {
    event.preventDefault();
    redoPatternChange();
    return;
  }

  if (event.ctrlKey && event.code === "KeyC" && !isEditingTarget(event.target)) {
    event.preventDefault();
    copySelectedEvent();
    return;
  }

  if (event.ctrlKey && event.code === "KeyV" && !isEditingTarget(event.target)) {
    event.preventDefault();
    pasteCopiedEvent();
    return;
  }

  if (event.code === "Backspace" && !isEditingTarget(event.target)) {
    event.preventDefault();
    deleteSelectedEvent();
    return;
  }

  if (event.code !== "Space" || isEditingTarget(event.target)) {
    return;
  }

  event.preventDefault();
  togglePlayback();
});

document.addEventListener("keyup", (event) => {
  if (!isPreviewControlCode(event.code)) {
    return;
  }

  pressedPreviewKeys.delete(event.code);
});

timelineTrack.addEventListener("pointerdown", (event) => {
  timelineDragging = true;
  timelineTrack.setPointerCapture(event.pointerId);
  seekFromTimelinePointer(event);
});

timelineTrack.addEventListener("pointermove", (event) => {
  if (!timelineDragging) {
    return;
  }

  seekFromTimelinePointer(event);
});

timelineTrack.addEventListener("pointerup", (event) => {
  timelineDragging = false;

  if (timelineTrack.hasPointerCapture(event.pointerId)) {
    timelineTrack.releasePointerCapture(event.pointerId);
  }
});

timelineTrack.addEventListener("pointercancel", (event) => {
  timelineDragging = false;

  if (timelineTrack.hasPointerCapture(event.pointerId)) {
    timelineTrack.releasePointerCapture(event.pointerId);
  }
});

propertyForm.addEventListener("submit", (event) => {
  event.preventDefault();
});

propertyForm.addEventListener("click", (event) => {
  const target = event.target;

  if (!(target instanceof HTMLButtonElement)) {
    return;
  }

  const timeMode = target.dataset.timeMode;

  if (timeMode === "seconds" || timeMode === "beats") {
    propertyTimeMode = timeMode;
    renderPropertyForm();
    return;
  }

  if (target.id !== "delete-event-button") {
    return;
  }

  deleteSelectedEvent();
});

propertyForm.addEventListener("input", handlePropertyUpdate);
propertyForm.addEventListener("change", handlePropertyUpdate);
packagePanel.addEventListener("change", handlePackagePanelInput);
packagePanel.addEventListener("click", handlePackagePanelClick);
packagePanel.addEventListener("dblclick", handlePackagePanelDoubleClick);
timelineResizeHandle.addEventListener("pointerdown", (event) => startLayoutResize("timeline", event));
inspectorResizeHandle.addEventListener("pointerdown", (event) => startLayoutResize("inspector", event));
document.addEventListener("pointermove", handleLayoutResizeMove);
document.addEventListener("pointerup", stopLayoutResize);
document.addEventListener("pointercancel", stopLayoutResize);

function handlePropertyUpdate(event: Event): void {
  const selectedEvent = getSelectedEvent();
  const input = event.target;

  if (!selectedEvent || !(input instanceof HTMLInputElement || input instanceof HTMLSelectElement)) {
    return;
  }

  if (event.type === "change" && input instanceof HTMLInputElement) {
    return;
  }

  if (input instanceof HTMLSelectElement) {
    const config = getSelectConfigsFor(selectedEvent).find((field) => field.name === input.name);

    if (!config) {
      return;
    }

    if (input.value === getSelectFieldValue(selectedEvent, config)) {
      return;
    }

    pushHistory();
    setSelectFieldValue(selectedEvent, config, input.value);
  } else if (input.name === "name") {
    if (input.value === selectedEvent.name) {
      return;
    }

    pushHistory();
    selectedEvent.name = input.value;
  } else if (input.name === "color") {
    const nextColor = parseColorInput(input.value, selectedEvent.color);

    if (nextColor === selectedEvent.color) {
      return;
    }

    pushHistory();
    selectedEvent.color = nextColor;
  } else if (input.type === "checkbox") {
    const config = getCheckboxConfigsFor(selectedEvent).find((field) => field.name === input.name);

    if (!config) {
      return;
    }

    const nextValue = input.checked ? 1 : 0;

    if (nextValue === getNumberField(selectedEvent, config.name)) {
      return;
    }

    pushHistory();
    setNumberField(selectedEvent, config.name, nextValue);
  } else {
    const config = getFieldConfigsFor(selectedEvent).find((field) => field.name === input.name);

    if (!config) {
      return;
    }

    const parsedValue = Number(input.value);

    if (!Number.isFinite(parsedValue)) {
      return;
    }

    const nextValue = getStoredNumberFieldValue(config, parsedValue);
    const clampedValue = clamp(nextValue, config.min, getFieldMax(config));

    if (clampedValue === getNumberField(selectedEvent, config.name)) {
      return;
    }

    pushHistory();
    setNumberField(selectedEvent, config.name, clampedValue);
  }

  if (selectedEvent.packageId && !isAttackPackageEvent(selectedEvent)) {
    selectedEvent.packageLocked = false;
  }

  clearAimCache();
  sortEvents();
  renderEventList();
  renderTimelineMarkers();
  if (input.name === "typeId") {
    renderPropertyForm();
  }
  renderPreview();
  syncUi();
}

function handlePackagePanelInput(event: Event): void {
  const packageEvent = getSelectedPackageEvent();
  const input = event.target;

  if (!packageEvent || !(input instanceof HTMLInputElement || input instanceof HTMLSelectElement)) {
    return;
  }

  if (input.name === "name") {
    if (input.value === packageEvent.name) {
      return;
    }

    pushHistory();
    packageEvent.name = input.value;
    refreshPackageGeneratedEvents(packageEvent);
    selectSingleEvent(packageEvent.id);
    renderEverything();
    return;
  }

  const config = getPackageFieldConfigs(packageEvent).find((field) => field.name === input.name);

  if (!config) {
    return;
  }

  pushHistory();
  if (config.type === "checkbox" && input instanceof HTMLInputElement) {
    (packageEvent as unknown as Record<string, number>)[config.name] = input.checked ? 1 : 0;
  } else if (config.type === "select") {
    (packageEvent as unknown as Record<string, string>)[config.name] = input.value;
  } else {
    const parsedValue = Number(input.value);

    if (!Number.isFinite(parsedValue)) {
      return;
    }

    (packageEvent as unknown as Record<string, number>)[config.name] = config.integer ? Math.round(parsedValue) : parsedValue;
  }

  refreshPackageGeneratedEvents(packageEvent);
  selectSingleEvent(packageEvent.id);
  clearAimCache();
  renderEverything();
}

function handlePackagePanelClick(event: MouseEvent): void {
  const target = event.target;

  if (!(target instanceof Element)) {
    return;
  }

  const visibilityButton = target.closest<HTMLButtonElement>("[data-package-child-visibility]");

  if (visibilityButton) {
    const child = pattern.events.find((patternEvent) => patternEvent.id === visibilityButton.dataset.packageChildVisibility);

    if (child) {
      pushHistory();
      child.visible = !isEventVisible(child);
      renderEverything();
    }
    return;
  }

  const selectButton = target.closest<HTMLButtonElement>("[data-package-child-select]");

  if (selectButton?.dataset.packageChildSelect) {
    selectPackageChild(selectButton.dataset.packageChildSelect, event.detail >= 2);
  }
}

function handlePackagePanelDoubleClick(event: MouseEvent): void {
  const target = event.target;

  if (!(target instanceof Element)) {
    return;
  }

  const selectButton = target.closest<HTMLElement>("[data-package-child-select]");

  if (selectButton?.dataset.packageChildSelect) {
    selectPackageChild(selectButton.dataset.packageChildSelect, true);
  }
}

function selectPackageChild(eventId: string, openProperties: boolean): void {
  const child = pattern.events.find((event) => event.id === eventId);

  if (!child || isAttackPackageEvent(child)) {
    return;
  }

  selectSingleEvent(child.id);

  if (editorMode === "trajectory") {
    editingEventId = child.id;
    clock.seek(child.startTime, pattern.duration);
    clearAimCache();
  }

  if (openProperties) {
    activeInspectorTab = "properties";
  }

  renderEverything();
}

preview.onTick((deltaSeconds) => {
  if (editorMode === "preview") {
    updatePreviewPlayer(deltaSeconds);
  }

  if (clock.isPlaying && hasMusic()) {
    clock.seek(audio.currentTime, pattern.duration);

    if (audio.ended) {
      clock.stop();
    }
  } else {
    clock.update(deltaSeconds, pattern.duration);
  }

  renderPreview();
  renderWaveform();
  syncUi();
});

function togglePlayback(): void {
  if (clock.isPlaying) {
    stopPlayback();
  } else {
    startPlayback();
  }
}

function startPlayback(): void {
  if (clock.time >= pattern.duration) {
    clock.seek(0, pattern.duration);
    clearAimCache();
  }

  if (hasMusic()) {
    audio.currentTime = Math.min(clock.time, audio.duration);
    void audio.play();
  }

  clock.play();
  syncUi();
}

function stopPlayback(): void {
  clock.stop();

  if (hasMusic()) {
    audio.pause();
  }

  syncUi();
}

function resetPlayback(): void {
  clock.reset();
  clearAimCache();

  if (hasMusic()) {
    audio.pause();
    audio.currentTime = 0;
  }
}

function syncAudioToClock(): void {
  if (!hasMusic()) {
    return;
  }

  audio.currentTime = Math.min(clock.time, audio.duration);
}

function handleMusicOffsetInput(): void {
  const nextMusicOffset = parseTimelineNumber(musicOffsetInput.value, pattern.timeline.musicOffset);

  if (nextMusicOffset === pattern.timeline.musicOffset) {
    return;
  }

  pushHistory();
  pattern.timeline.musicOffset = nextMusicOffset;
  renderTimelineRhythm();
}

function handleBpmInput(): void {
  const nextBpm = clamp(parseTimelineNumber(bpmInput.value, pattern.timeline.bpm), 1, 400);

  if (nextBpm === pattern.timeline.bpm) {
    return;
  }

  pushHistory();
  pattern.timeline.bpm = nextBpm;
  syncTimelineInputs();
  renderTimelineRhythm();
}

function handleMeasureIntervalInput(): void {
  const measureInterval = clamp(parseTimelineNumber(measureIntervalInput.value, getMeasureInterval()), minMeasureInterval, maxMeasureInterval);
  const nextBpm = clamp((60 * pattern.timeline.beatsPerMeasure) / measureInterval, 1, 400);

  if (nextBpm === pattern.timeline.bpm) {
    return;
  }

  pushHistory();
  pattern.timeline.bpm = nextBpm;
  syncTimelineInputs();
  renderTimelineRhythm();
}

function handleBeatsPerMeasureInput(): void {
  const nextBeatsPerMeasure = Math.round(clamp(parseTimelineNumber(beatsPerMeasureInput.value, pattern.timeline.beatsPerMeasure), 1, 16));

  if (nextBeatsPerMeasure === pattern.timeline.beatsPerMeasure) {
    return;
  }

  pushHistory();
  pattern.timeline.beatsPerMeasure = nextBeatsPerMeasure;
  syncTimelineInputs();
  renderTimelineRhythm();
}

function renderTimelineRhythm(): void {
  renderTimelineMarkers();
  renderWaveform();
}

function seekFromTimelinePointer(event: PointerEvent): void {
  const bounds = timelineTrack.getBoundingClientRect();
  const ratio = clamp((event.clientX - bounds.left) / bounds.width, 0, 1);
  const nextTime = ratio * pattern.duration;

  if (nextTime < clock.time) {
    clearAimCache();
  }

  clock.seek(nextTime, pattern.duration);
  syncAudioToClock();
  renderPreview();
  renderWaveform();
  syncUi();
}

function updateMarkerTimeFromPointer(eventId: string, event: PointerEvent): void {
  const attackEvent = pattern.events.find((patternEvent) => patternEvent.id === eventId);

  if (!attackEvent) {
    return;
  }

  const bounds = timelineTrack.getBoundingClientRect();
  const ratio = clamp((event.clientX - bounds.left) / bounds.width, 0, 1);
  const rawTime = ratio * pattern.duration;
  const previousStartTime = attackEvent.startTime;
  attackEvent.startTime = Number(getSnappedEventTime(rawTime).toFixed(2));
  if (isAttackPackageEvent(attackEvent)) {
    const delta = attackEvent.startTime - previousStartTime;

    for (const child of getPackageChildren(attackEvent)) {
      child.startTime = Number((child.startTime + delta).toFixed(2));
    }
  }
  clearAimCache();

  updateStartTimeInput(attackEvent.startTime);
  renderEventList();
  renderPreview();
}

function exportProjectPattern(): void {
  const projectPattern: ProjectPatternFile = {
    ...pattern,
    music: projectMusicAsset
      ? {
          ...projectMusicAsset,
          volume: audio.volume,
        }
      : null,
    customPackages: getProjectCustomPackageAssets(),
  };

  downloadJson(projectPattern, `${pattern.title.replace(/[^\w-]+/g, "_") || "danmaku_project"}.project.json`);
}

function getProjectCustomPackageAssets(): ProjectCustomPackageAsset[] {
  const usedKinds = new Set<string>(
    pattern.events
      .filter((event): event is AttackPackageEvent => isAttackPackageEvent(event) && isCustomAttackPackageKindName(event.kind))
      .map((event) => event.kind),
  );

  return [...projectCustomPackageAssets.values()].filter((asset) => usedKinds.has(asset.kind));
}

function exportUnityPattern(): void {
  const unityExport = buildUnitySeparatedExport(pattern);
  const baseName = pattern.title.replace(/[^\w-]+/g, "_") || "danmaku_pattern";

  downloadJson(unityExport.stageData, `${baseName}.stagedata.json`);
  downloadJson(unityExport.bulletBufferCollection, `${baseName}.bulletbuffers.json`);

  if (unityExport.skippedEvents.length > 0) {
    console.warn("Some events could not be represented in the Unity StageData/BulletBuffer export.", unityExport.skippedEvents);
  }
}

function downloadJson(value: unknown, fileName: string): void {
  const data = JSON.stringify(value, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function importPattern(file: File): Promise<void> {
  try {
    const text = await file.text();
    const parsed = JSON.parse(text) as ProjectPatternFile;

    if (parsed.version !== 1 || !Array.isArray(parsed.events) || !parsed.stage) {
      throw new Error("Invalid pattern file.");
    }

    await importEmbeddedCustomPackages(parsed.customPackages);
    pushHistory();
    pattern = {
      version: 1,
      title: parsed.title ?? "Imported Pattern",
      duration: Number(parsed.duration) || 10,
      stage: parsed.stage,
      timeline: {
        ...defaultTimelineSettings,
        ...parsed.timeline,
      },
      timelineLaneCount: Number(parsed.timelineLaneCount) || minimumTimelineLaneCount,
      events: parsed.events.map((event) => normalizeImportedEvent(event, parsed.stage!)),
    };
    if (parsed.music?.dataUrl) {
      await loadMusicFromProjectAsset(parsed.music);
      pattern.duration = Math.max(pattern.duration, audio.duration || 0);
    } else {
      clearMusic();
    }

    selectSingleEvent(pattern.events[0]?.id ?? null);
    editingEventId = null;
    resetPlayback();
    renderEverything();
  } catch (error) {
    console.error(error);
    window.alert("JSONを読み込めませんでした。弾幕データの形式を確認してください。");
  }
}

async function importAiBeatmap(file: File): Promise<void> {
  try {
    const parsed = parseJsonWithOptionalFence(await file.text()) as AiBeatmapDraftFile;

    if (!isRecord(parsed) || parsed.format !== "school-fes-ai-beatmap" || parsed.version !== 1 || !Array.isArray(parsed.events)) {
      throw new Error("Invalid AI beatmap draft.");
    }

    if (parsed.events.length === 0) {
      throw new Error("AI beatmap draft has no events.");
    }

    if (!window.confirm("AI譜面を読み込み、現在のイベントを置き換えます。よろしいですか？")) {
      return;
    }

    pushHistory();

    if (typeof parsed.title === "string" && parsed.title.trim()) {
      pattern.title = parsed.title.trim();
    }

    const requestedDuration = Number(parsed.duration);

    if (Number.isFinite(requestedDuration) && requestedDuration > 0) {
      pattern.duration = requestedDuration;
    }

    applyAiBeatmapTimeline(parsed.timeline);
    pattern.events = buildAiBeatmapEvents(parsed.events);
    pattern.duration = Math.max(
      1,
      pattern.duration,
      audio.duration || 0,
      ...pattern.events.map((event) => getEventEndTime(event)),
    );
    sortEvents();
    ensurePatternEditorFields();
    selectSingleEvent(pattern.events[0]?.id ?? null);
    activeInspectorTab = "events";
    editingEventId = null;
    resetPlayback();
    renderEverything();
  } catch (error) {
    console.error(error);
    window.alert("AI譜面JSONを読み込めませんでした。docs/gemini-beatmap-prompt.md の形式に合っているか確認してください。");
  }
}

function buildAiBeatmapEvents(rawEvents: unknown[]): AttackEvent[] {
  const events: AttackEvent[] = [];

  rawEvents.forEach((rawEvent, index) => {
    const packageEvent = createAiBeatmapPackageEvent(rawEvent, index);

    events.push(packageEvent, ...createGeneratedEventsForPackage(packageEvent, pattern.stage));
  });

  return events;
}

function createAiBeatmapPackageEvent(rawEvent: unknown, index: number): AttackPackageEvent {
  if (!isRecord(rawEvent)) {
    throw new Error(`AI beatmap event ${index + 1} is not an object.`);
  }

  const kind = parseAiBeatmapPackageKind(rawEvent.kind, index);
  const startTime = Number(rawEvent.time);

  if (!Number.isFinite(startTime) || startTime < 0) {
    throw new Error(`AI beatmap event ${index + 1} has an invalid time.`);
  }

  const packageEvent = createAttackPackageEvent(kind, startTime, pattern.stage);
  const name = typeof rawEvent.name === "string" ? rawEvent.name.trim() : "";
  const lane = Number(rawEvent.lane);

  packageEvent.name = name || `${getPackageKindLabel(kind)} ${index + 1}`;
  packageEvent.timelineLane = Number.isFinite(lane)
    ? Math.round(clamp(lane, 0, maximumTimelineLaneCount - 1))
    : Math.min(index % Math.max(1, getTimelineLaneCount()), maximumTimelineLaneCount - 1);
  applyAiBeatmapPackageParams(packageEvent, rawEvent.params);
  applyAiBeatmapPackageColor(packageEvent, rawEvent.color);

  return packageEvent;
}

function parseAiBeatmapPackageKind(value: unknown, index: number): AttackPackageKind {
  const availableKinds = getAvailablePackageKinds();

  if (typeof value === "string" && isAttackPackageKind(value) && availableKinds.includes(value as AttackPackageKind)) {
    return value as AttackPackageKind;
  }

  throw new Error(`AI beatmap event ${index + 1} has an unsupported package kind.`);
}

function applyAiBeatmapPackageParams(packageEvent: AttackPackageEvent, rawParams: unknown): void {
  if (!isRecord(rawParams)) {
    return;
  }

  const packageRecord = packageEvent as unknown as Record<string, number | string>;

  for (const config of getPackageFieldConfigs(packageEvent)) {
    if (config.name === "startTime" || !(config.name in rawParams)) {
      continue;
    }

    const value = rawParams[config.name];

    if (config.type === "select") {
      if (typeof value === "string" && config.options?.some((option) => option.value === value)) {
        packageRecord[config.name] = value;
      }
      continue;
    }

    if (config.type === "checkbox") {
      packageRecord[config.name] = value === true || Number(value) > 0 ? 1 : 0;
      continue;
    }

    const parsedValue = Number(value);

    if (!Number.isFinite(parsedValue)) {
      continue;
    }

    const min = config.min ?? Number.NEGATIVE_INFINITY;
    const max = config.max ?? Number.POSITIVE_INFINITY;
    const nextValue = clamp(parsedValue, min, max);
    packageRecord[config.name] = config.integer ? Math.round(nextValue) : nextValue;
  }
}

function applyAiBeatmapPackageColor(packageEvent: AttackPackageEvent, value: unknown): void {
  if (typeof value === "string" && value.trim()) {
    packageEvent.color = parseColorInput(value, packageEvent.color);
    return;
  }

  const parsedValue = Number(value);

  if (Number.isFinite(parsedValue)) {
    packageEvent.color = Math.round(clamp(parsedValue, 0, 0xffffff));
  }
}

function applyAiBeatmapTimeline(rawTimeline: unknown): void {
  if (!isRecord(rawTimeline)) {
    return;
  }

  const bpm = Number(rawTimeline.bpm);
  const beatsPerMeasure = Number(rawTimeline.beatsPerMeasure);
  const musicOffset = Number(rawTimeline.musicOffset);

  if (Number.isFinite(bpm)) {
    pattern.timeline.bpm = clamp(bpm, 1, 400);
  }

  if (Number.isFinite(beatsPerMeasure)) {
    pattern.timeline.beatsPerMeasure = Math.round(clamp(beatsPerMeasure, 1, 16));
  }

  if (Number.isFinite(musicOffset)) {
    pattern.timeline.musicOffset = clamp(musicOffset, -60, Math.max(600, pattern.duration));
  }
}

function parseJsonWithOptionalFence(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch (error) {
    const fencedJson = text.match(/```(?:json)?\s*([\s\S]*?)```/iu)?.[1];

    if (fencedJson) {
      return JSON.parse(fencedJson);
    }

    throw error;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function importPackageCodeFile(file: File): Promise<void> {
  if (!file.name.endsWith(".mjs")) {
    window.alert(".mjs ファイルを選択してください。");
    return;
  }

  if (!window.confirm("選択した .mjs のコードをこのページで実行します。信頼できるファイルだけ読み込んでください。")) {
    return;
  }

  try {
    const code = await file.text();
    const kind = await importCustomPackageCode(file.name, code);

    window.alert(`${getPackageKindLabel(kind)} を追加しました。追加メニューから使えます。`);
  } catch (error) {
    console.error(error);
    window.alert(".mjs パッケージを読み込めませんでした。コードの形式を確認してください。");
  }
}

async function importEmbeddedCustomPackages(assets: ProjectPatternFile["customPackages"]): Promise<void> {
  if (!Array.isArray(assets) || assets.length === 0) {
    return;
  }

  if (!window.confirm("このプロジェクトには custom パッケージコードが含まれています。読み込むにはコードを実行する必要があります。")) {
    return;
  }

  for (const asset of assets) {
    if (!asset || typeof asset.code !== "string") {
      continue;
    }

    try {
      await importCustomPackageCode(asset.name || `${asset.kind || "custom_package"}.mjs`, asset.code, asset.kind);
    } catch (error) {
      console.error(error);
      window.alert(`${asset.kind || asset.name || "custom package"} を読み込めませんでした。既存の生成済み攻撃は保持されます。`);
    }
  }
}

async function importCustomPackageCode(fileName: string, code: string, expectedKind?: string): Promise<AttackPackageKind> {
  const blob = new Blob([code], { type: "text/javascript" });
  const url = URL.createObjectURL(blob);

  try {
    const module = await import(/* @vite-ignore */ url) as { default?: unknown; packageDefinition?: unknown };
    const definition = registerCustomPackageDefinition(module.default ?? module.packageDefinition);

    if (expectedKind && definition.kind !== expectedKind) {
      throw new Error(`Embedded package kind mismatch: expected ${expectedKind}, got ${definition.kind}.`);
    }

    projectCustomPackageAssets.set(definition.kind, {
      kind: definition.kind,
      name: fileName,
      code,
    });
    renderPackageMenu();
    return definition.kind;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function deleteCustomPackage(kind: string): void {
  if (!isCustomAttackPackageKindName(kind)) {
    return;
  }

  const label = getPackageKindLabel(kind);
  const usedCount = pattern.events.filter((event) => isAttackPackageEvent(event) && event.kind === kind).length;
  const message = usedCount > 0
    ? `${label} を追加メニューから削除します。既存の ${usedCount} 個のパッケージ配置と生成済み攻撃は残りますが、再生成には元の .mjs が必要になります。`
    : `${label} を追加メニューから削除します。`;

  if (!window.confirm(message)) {
    return;
  }

  unregisterCustomPackageDefinition(kind);
  projectCustomPackageAssets.delete(kind);
  renderPackageMenu();
  renderEverything();
}

function renderPackageMenu(): void {
  packageMenuItems.innerHTML = renderPackageMenuItems();
}

async function loadMusic(file: File): Promise<void> {
  if (musicObjectUrl) {
    URL.revokeObjectURL(musicObjectUrl);
  }

  stopPlayback();
  projectMusicAsset = await buildProjectMusicAsset(file);
  musicObjectUrl = URL.createObjectURL(file);
  audio.src = musicObjectUrl;
  audio.load();
  musicDisplay.textContent = file.name;

  try {
    musicChannelData = await buildWaveformChannelData(file);
    musicPeakResolution = 0;
    rebuildWaveformPeaksForCanvas();
    renderWaveform();
  } catch (error) {
    console.error(error);
    musicChannelData = null;
    musicPeakResolution = 0;
    musicPeaks = [];
    renderWaveform();
  }
}

async function loadMusicFromProjectAsset(asset: ProjectMusicAsset): Promise<void> {
  const response = await fetch(asset.dataUrl);
  const blob = await response.blob();
  const file = new File([blob], asset.name || "project-music", { type: asset.type || blob.type || "audio/*" });

  await loadMusic(file);
  audio.volume = clamp(Number(asset.volume), 0, 1);
  musicVolumeInput.value = String(Math.round(audio.volume * 100));
}

function clearMusic(): void {
  stopPlayback();
  projectMusicAsset = null;
  musicChannelData = null;
  musicPeakResolution = 0;
  musicPeaks = [];
  musicDisplay.textContent = "No music";

  if (musicObjectUrl) {
    URL.revokeObjectURL(musicObjectUrl);
    musicObjectUrl = null;
  }

  audio.removeAttribute("src");
  audio.load();
  renderWaveform();
}

function buildProjectMusicAsset(file: File): Promise<ProjectMusicAsset> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.addEventListener("load", () => {
      resolve({
        name: file.name,
        type: file.type,
        dataUrl: String(reader.result ?? ""),
        volume: audio.volume,
      });
    });
    reader.addEventListener("error", () => reject(reader.error ?? new Error("Music file could not be read.")));
    reader.readAsDataURL(file);
  });
}

function normalizeImportedEvent(rawEvent: unknown, stage: BulletPattern["stage"]): AttackEvent {
  const event = rawEvent as Partial<AttackEvent>;
  const kind = typeof event.kind === "string" && isAttackEventKind(event.kind) ? event.kind : "radialBurst";
  const startTime = typeof event.startTime === "number" ? event.startTime : 0;
  const defaults = isAttackPackageKind(kind) ? createAttackPackageEvent(kind, startTime, stage) : createAttackEvent(kind, startTime, stage);
  const normalizedEvent = {
    ...defaults,
    ...event,
    kind,
  } as AttackEvent;

  if (isAttackPackageEvent(normalizedEvent)) {
    normalizedEvent.packageType = normalizedEvent.kind;
    normalizedEvent.generatedEventIds = Array.isArray(normalizedEvent.generatedEventIds) ? normalizedEvent.generatedEventIds : [];
  }

  ensureEventEditorFields(normalizedEvent);
  return normalizedEvent;
}

function isAttackEventKind(kind: string): kind is AttackEventKind {
  return allKinds().includes(kind as AttackEventKind) || isCustomAttackPackageKindName(kind);
}

function renderEverything(): void {
  ensureTimelineSettings();
  ensurePatternEditorFields();
  ensurePackageChildren();
  ensureEditModeState();
  syncLayoutSizeVariables();
  renderTimelineScale();
  resizePreviewHost();
  renderInspectorTabs();
  renderEventList();
  renderPackagePanel();
  renderPropertyForm();
  renderTimelineMarkers();
  syncTimelineInputs();
  renderWaveform();
  renderPreview();
  syncUi();
}

function setEditorMode(mode: EditorMode): void {
  const wasPreviewMode = editorMode === "preview";

  closeMenus();
  editorMode = mode;

  if (editorMode === "trajectory") {
    editingEventId = getTrajectoryEditableEvent(getSelectedEvent())?.id ?? null;
  } else {
    editingEventId = null;
  }

  if (editorMode === "preview") {
    pressedPreviewKeys.clear();
    dashRequested = false;
    dashTimeRemaining = 0;
    dashCooldownRemaining = 0;
    playerWasHit = false;
    preview.setPointerControlEnabled(false);
    preview.resetPlayerPosition();
    clock.seek(0, pattern.duration);
    clock.play();

    if (hasMusic()) {
      audio.currentTime = 0;
      void audio.play().catch((error: unknown) => {
        console.warn("Music playback could not start automatically.", error);
      });
    }
  } else {
    pressedPreviewKeys.clear();
    preview.setPointerControlEnabled(editorMode === "global");

    if (editorMode === "trajectory") {
      preview.resetPlayerPosition();
    }

    if (wasPreviewMode) {
      stopPlayback();
    }
  }

  renderEverything();
}

function renderInspectorTabs(): void {
  for (const button of inspectorTabButtons) {
    const isActive = button.dataset.inspectorTab === activeInspectorTab;

    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  }

  for (const panel of inspectorPanels) {
    panel.hidden = panel.dataset.inspectorPanel !== activeInspectorTab;
  }
}

function resizePreviewHost(): void {
  const panelBounds = previewPanel.getBoundingClientRect();
  const panelStyle = window.getComputedStyle(previewPanel);
  const horizontalPadding = Number.parseFloat(panelStyle.paddingLeft) + Number.parseFloat(panelStyle.paddingRight);
  const verticalPadding = Number.parseFloat(panelStyle.paddingTop) + Number.parseFloat(panelStyle.paddingBottom);
  const availableWidth = Math.max(1, panelBounds.width - horizontalPadding);
  const availableHeight = Math.max(1, panelBounds.height - verticalPadding);
  const stageRatio = pattern.stage.width / pattern.stage.height;
  let width = availableWidth;
  let height = width / stageRatio;

  if (height > availableHeight) {
    height = availableHeight;
    width = height * stageRatio;
  }

  previewHost.style.width = `${Math.floor(width)}px`;
  previewHost.style.height = `${Math.floor(height)}px`;
  preview.resize(width, height);
}

function ensureEditModeState(): void {
  if (editorMode === "trajectory") {
    editingEventId = getTrajectoryEditableEvent(getSelectedEvent())?.id ?? null;
    preview.setPointerControlEnabled(false);
    preview.resetPlayerPosition();
  } else {
    editingEventId = null;
  }

  if (editingEventId && !pattern.events.some((event) => event.id === editingEventId)) {
    editingEventId = null;
  }
}

function renderPreview(): void {
  syncTrajectoryModeNotice();
  const previewEvents = getPreviewEvents();
  const playerPosition = preview.getPlayerPosition();
  const frame = buildAttackFrame(previewEvents, clock.time, pattern.stage, playerPosition);
  const packageHandles = buildPackagePreviewHandles();

  if (editorMode === "preview") {
    updatePreviewHitState(frame, playerPosition);
  } else {
    playerWasHit = false;
  }

  preview.render({
    frame,
    currentTime: clock.time,
    duration: pattern.duration,
    events: previewEvents,
    selectedEventId,
    editEventId: editingEventId,
    trajectories: buildVisibleTrajectories(),
    playerAlpha: dashTimeRemaining > 0 ? 0.45 : 1,
    packageHandles,
    activePackageHandleId: packageHandles.some((handle) => handle.id === activePackageHandleId) ? activePackageHandleId : null,
  });
}

function getPreviewEvents(): AttackEvent[] {
  const editingEvent = getEditingEvent();
  const events = editorMode === "trajectory" ? (editingEvent ? [editingEvent] : []) : pattern.events;

  return events.filter((event) => !isAttackPackageEvent(event) && isEventVisible(event) && isParentPackageVisible(event));
}

type PackageHandleRole = "source" | "target" | "start" | "area" | "center" | "position";

function buildPackagePreviewHandles(): PackageHandleRender[] {
  if (editorMode === "preview" || activeInspectorTab !== "package") {
    return [];
  }

  const packageEvent = getSelectedPackageEvent();

  if (!packageEvent) {
    return [];
  }

  const sourceColor = packageEvent.color;
  const secondaryColor = 0xffd166;
  const areaColor = 0x27dfff;
  const handles: PackageHandleRender[] = [];
  const addHandle = (role: PackageHandleRole, x: number, y: number, color = sourceColor, secondary = false) => {
    handles.push({
      id: getPackageHandleId(packageEvent, role),
      x: clamp(x, 0, pattern.stage.width),
      y: clamp(y, 0, pattern.stage.height),
      color,
      secondary,
    });
  };

  switch (packageEvent.kind) {
    case "package_random_barrage":
    case "package_lag_radial":
    case "package_split_lag_radial":
    case "package_snake_chain":
      addHandle("source", packageEvent.packageX, packageEvent.packageY);
      break;
    case "package_bomb_burst":
      addHandle("start", packageEvent.packageStartX, packageEvent.packageStartY, secondaryColor, true);
      addHandle("target", packageEvent.packageX, packageEvent.packageY);
      break;
    case "package_random_circle":
    case "package_grid_square":
    case "package_random_lasers":
    case "package_area_parallel":
      addHandle("area", packageEvent.packageX, packageEvent.packageY, areaColor);
      break;
    case "package_center_lasers":
    case "package_rotating_lasers":
      addHandle("center", packageEvent.packageX, packageEvent.packageY, areaColor);
      break;
    case "package_repeating_lasers":
    case "package_sequential_lasers":
      addHandle(
        "position",
        packageEvent.packageOrientation === "horizontal" ? pattern.stage.width / 2 : packageEvent.packageInitialPosition,
        packageEvent.packageOrientation === "horizontal" ? packageEvent.packageInitialPosition : pattern.stage.height / 2,
        areaColor,
      );
      break;
    case "package_enter_exit_bar":
      addHandle("source", packageEvent.packageX, packageEvent.packageY);
      break;
  }

  return handles;
}

function getPackageHandleId(packageEvent: AttackPackageEvent, role: PackageHandleRole): string {
  return `${packageEvent.id}:${role}`;
}

function parsePackageHandleId(handleId: string): { packageId: string; role: PackageHandleRole } | undefined {
  const separatorIndex = handleId.lastIndexOf(":");

  if (separatorIndex < 0) {
    return undefined;
  }

  const packageId = handleId.slice(0, separatorIndex);
  const role = handleId.slice(separatorIndex + 1) as PackageHandleRole;

  if (!["source", "target", "start", "area", "center", "position"].includes(role)) {
    return undefined;
  }

  return { packageId, role };
}

function handlePackageHandleDrag(handleId: string, point: { x: number; y: number }, phase: "start" | "move" | "end"): void {
  const handle = parsePackageHandleId(handleId);

  if (!handle) {
    return;
  }

  const packageEvent = pattern.events.find((event): event is AttackPackageEvent => event.id === handle.packageId && isAttackPackageEvent(event));

  if (!packageEvent || editorMode === "preview") {
    return;
  }

  activePackageHandleId = handleId;

  if (phase === "start") {
    pushHistory();
    selectSingleEvent(packageEvent.id);
    activeInspectorTab = "package";
  }

  applyPackageHandlePoint(packageEvent, handle.role, point);
  refreshPackageGeneratedEvents(packageEvent);
  clearAimCache();
  renderEverything();
}

function applyPackageHandlePoint(packageEvent: AttackPackageEvent, role: PackageHandleRole, point: { x: number; y: number }): void {
  const x = clamp(point.x, 0, pattern.stage.width);
  const y = clamp(point.y, 0, pattern.stage.height);

  if (role === "start") {
    packageEvent.packageStartX = x;
    packageEvent.packageStartY = y;
    return;
  }

  if (role === "position") {
    packageEvent.packageInitialPosition = packageEvent.packageOrientation === "horizontal" ? y : x;
    return;
  }

  packageEvent.packageX = x;
  packageEvent.packageY = y;
}

function syncTrajectoryModeNotice(): void {
  const message = getTrajectoryModeNotice();

  trajectoryModeNotice.hidden = message === null;
  trajectoryModeNotice.textContent = message ?? "";
}

function getTrajectoryModeNotice(): string | null {
  if (editorMode !== "trajectory" || editingEventId) {
    return null;
  }

  const selectedEvent = getSelectedEvent();

  if (!selectedEvent) {
    return "軌跡編集: 表示するAttackを選択してください。";
  }

  if (isAttackPackageEvent(selectedEvent)) {
    return "軌跡編集: パッケージタブのGenerated AttacksからAttackを選択してください。";
  }

  return "軌跡編集: このAttackは軌跡表示に対応していません。";
}

function getTrajectoryEditableEvent(event: AttackEvent | undefined): AttackEvent | undefined {
  return event && !isAttackPackageEvent(event) ? event : undefined;
}

function getEditingEvent(): AttackEvent | undefined {
  if (!editingEventId) {
    return undefined;
  }

  return pattern.events.find((event) => event.id === editingEventId);
}

function buildVisibleTrajectories(): TrajectoryRender[] {
  if (editorMode !== "trajectory") {
    return [];
  }

  const editingEvent = getEditingEvent();

  return editingEvent ? buildEditTrajectories(editingEvent) : [];
}

function buildEditTrajectories(event: AttackEvent): TrajectoryRender[] {
  const trajectoryEvent = createTrajectorySampleEvent(event);
  const startTime = Math.max(0, trajectoryEvent.startTime);
  const endTime = Math.min(pattern.duration, getEventEndTime(trajectoryEvent));
  const duration = Math.max(0.1, endTime - startTime);
  const sampleCount = Math.max(72, Math.min(180, Math.ceil(duration * 36)));
  const tracks = new Map<string, TrajectoryRender>();
  const playerPosition = getFixedPreviewPlayerPosition();

  for (let sampleIndex = 0; sampleIndex <= sampleCount; sampleIndex += 1) {
    const time = startTime + (duration * sampleIndex) / sampleCount;
    const frame = buildAttackFrame([trajectoryEvent], time, pattern.stage, playerPosition);

    frame.bullets.forEach((bullet, bulletIndex) => {
      const trackId = bullet.trackId ?? `${bullet.eventId}:${bulletIndex}`;
      const track = tracks.get(trackId);

      if (track) {
        track.points.push({ x: bullet.x, y: bullet.y });
      } else {
        tracks.set(trackId, { points: [{ x: bullet.x, y: bullet.y }], color: bullet.color, alpha: 0.5 });
      }
    });

    if (sampleIndex === sampleCount) {
      for (const laser of frame.curvedLasers) {
        tracks.set(`${laser.eventId}:curved-laser:${tracks.size}`, { points: laser.points, color: laser.color, alpha: 0.56 });
      }

      for (const laser of frame.lasers) {
        const angle = (laser.angle * Math.PI) / 180;
        const halfLength = laser.length / 2;

        tracks.set(`${laser.eventId}:laser:${tracks.size}`, {
          points: [
            { x: laser.x - Math.cos(angle) * halfLength, y: laser.y - Math.sin(angle) * halfLength },
            { x: laser.x + Math.cos(angle) * halfLength, y: laser.y + Math.sin(angle) * halfLength },
          ],
          color: laser.color,
          alpha: 0.56,
        });
      }
    }
  }

  return Array.from(tracks.values()).filter((trajectory) => trajectory.points.length > 1);
}

function createTrajectorySampleEvent(event: AttackEvent): AttackEvent {
  const sampleEvent = structuredClone(event) as AttackEvent & Record<string, number>;

  for (const repeatField of ["clipRepeat", "radialRepeat", "repeatCount", "fireCount", "switchCount"]) {
    if (repeatField in sampleEvent) {
      sampleEvent[repeatField] = 1;
    }
  }

  return sampleEvent as AttackEvent;
}

function getFixedPreviewPlayerPosition(): { x: number; y: number } {
  return {
    x: pattern.stage.width / 2,
    y: pattern.stage.height * 0.72,
  };
}

function updatePreviewPlayer(deltaSeconds: number): void {
  const direction = getPreviewMoveDirection();
  const hasDirection = Math.hypot(direction.x, direction.y) > 0.001;

  if (hasDirection) {
    lastPreviewDirection.x = direction.x;
    lastPreviewDirection.y = direction.y;
  }

  dashCooldownRemaining = Math.max(0, dashCooldownRemaining - deltaSeconds);
  dashTimeRemaining = Math.max(0, dashTimeRemaining - deltaSeconds);

  if (dashRequested && dashCooldownRemaining <= 0) {
    dashTimeRemaining = previewDashDuration;
    dashCooldownRemaining = previewDashCooldown;
  }

  dashRequested = false;

  const dashActive = dashTimeRemaining > 0;
  const moveDirection = hasDirection ? direction : dashActive ? lastPreviewDirection : { x: 0, y: 0 };
  const speed = dashActive ? previewDashSpeed : previewMoveSpeed;

  preview.movePlayer(moveDirection.x * speed * deltaSeconds, moveDirection.y * speed * deltaSeconds);
}

function getPreviewMoveDirection(): { x: number; y: number } {
  let x = 0;
  let y = 0;

  if (pressedPreviewKeys.has("ArrowLeft") || pressedPreviewKeys.has("KeyA")) {
    x -= 1;
  }

  if (pressedPreviewKeys.has("ArrowRight") || pressedPreviewKeys.has("KeyD")) {
    x += 1;
  }

  if (pressedPreviewKeys.has("ArrowUp") || pressedPreviewKeys.has("KeyW")) {
    y -= 1;
  }

  if (pressedPreviewKeys.has("ArrowDown") || pressedPreviewKeys.has("KeyS")) {
    y += 1;
  }

  const length = Math.hypot(x, y);

  return length > 0 ? { x: x / length, y: y / length } : { x: 0, y: 0 };
}

function isPreviewControlCode(code: string): boolean {
  return (
    code === "ArrowLeft" ||
    code === "ArrowRight" ||
    code === "ArrowUp" ||
    code === "ArrowDown" ||
    code === "KeyA" ||
    code === "KeyD" ||
    code === "KeyW" ||
    code === "KeyS" ||
    code === "Space"
  );
}

function updatePreviewHitState(frame: AttackFrame, playerPosition: { x: number; y: number }): void {
  if (dashTimeRemaining > 0) {
    playerWasHit = false;
    return;
  }

  const isHit = isPlayerCollidingWithFrame(frame, playerPosition);

  if (isHit && !playerWasHit) {
    preview.triggerHitShake();
  }

  playerWasHit = isHit;
}

function isPlayerCollidingWithFrame(frame: AttackFrame, playerPosition: { x: number; y: number }): boolean {
  return (
    frame.bullets.some((bullet) => isPointNearBullet(playerPosition, bullet)) ||
    frame.walls.some((wall) => isPointInWall(playerPosition, wall)) ||
    frame.lasers.some((laser) => isPointInLaser(playerPosition, laser)) ||
    frame.curvedLasers.some((laser) => isPointInCurvedLaser(playerPosition, laser)) ||
    frame.hazards.some((hazard) => isPointInHazard(playerPosition, hazard)) ||
    frame.shapes.some((shape) => isPointInShape(playerPosition, shape))
  );
}

function isPointNearBullet(point: { x: number; y: number }, bullet: AttackFrame["bullets"][number]): boolean {
  const padding = playerHitSize / 2;

  if (bullet.width !== undefined || bullet.height !== undefined) {
    const width = Math.max(1, bullet.width ?? bullet.radius * 2) + padding * 2;
    const height = Math.max(1, bullet.height ?? bullet.radius * 2) + padding * 2;

    return isPointInRotatedRect(point, bullet.x, bullet.y, width, height, bullet.angle ?? 0);
  }

  return Math.hypot(point.x - bullet.x, point.y - bullet.y) <= bullet.radius + padding;
}

function isPointInWall(point: { x: number; y: number }, wall: WallRender): boolean {
  const padding = playerHitSize / 2;

  return point.x >= wall.x - padding && point.x <= wall.x + wall.width + padding && point.y >= wall.y - padding && point.y <= wall.y + wall.height + padding;
}

function isPointInLaser(point: { x: number; y: number }, laser: LaserRender): boolean {
  return isPointInRotatedRect(point, laser.x, laser.y, laser.length + playerHitSize, laser.width + playerHitSize, degreesToRadians(laser.angle));
}

function isPointInCurvedLaser(point: { x: number; y: number }, laser: CurvedLaserRender): boolean {
  const threshold = laser.width / 2 + playerHitSize / 2;

  for (let index = 1; index < laser.points.length; index += 1) {
    const start = laser.points[index - 1];
    const end = laser.points[index];

    if (distanceToSegment(point, start, end) <= threshold) {
      return true;
    }
  }

  return false;
}

function isPointInHazard(point: { x: number; y: number }, hazard: HazardRender): boolean {
  const padding = playerHitSize / 2;

  if (hazard.shape === "circle") {
    return Math.hypot(point.x - hazard.x, point.y - hazard.y) <= hazard.radius + padding;
  }

  if (hazard.shape === "rectangle" || hazard.shape === "square" || hazard.shape === "line") {
    return isPointInRotatedRect(point, hazard.x, hazard.y, hazard.width + padding * 2, hazard.height + padding * 2, degreesToRadians(hazard.rotation));
  }

  return Math.hypot(point.x - hazard.x, point.y - hazard.y) <= hazard.radius + padding;
}

function isPointInShape(point: { x: number; y: number }, shape: ShapeRender): boolean {
  return Math.hypot(point.x - shape.x, point.y - shape.y) <= shape.radius + playerHitSize / 2;
}

function isPointInRotatedRect(point: { x: number; y: number }, centerX: number, centerY: number, width: number, height: number, angleRadians: number): boolean {
  const cos = Math.cos(-angleRadians);
  const sin = Math.sin(-angleRadians);
  const dx = point.x - centerX;
  const dy = point.y - centerY;
  const localX = dx * cos - dy * sin;
  const localY = dx * sin + dy * cos;

  return Math.abs(localX) <= width / 2 && Math.abs(localY) <= height / 2;
}

function distanceToSegment(point: { x: number; y: number }, start: { x: number; y: number }, end: { x: number; y: number }): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared <= 0) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }

  const t = clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared, 0, 1);
  const closestX = start.x + dx * t;
  const closestY = start.y + dy * t;

  return Math.hypot(point.x - closestX, point.y - closestY);
}

function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function syncUi(): void {
  appShell.classList.toggle("is-preview-mode", editorMode === "preview");
  for (const button of editorModeButtons) {
    const isActive = button.dataset.editorMode === editorMode;

    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  }

  timeDisplay.textContent = `${clock.time.toFixed(2)}s / ${pattern.duration.toFixed(2)}s`;
  timelinePlayhead.style.left = `${(clock.time / pattern.duration) * 100}%`;
  syncPlaybackButton();
  syncHistoryButtons();
  syncSnapButton();
  addTimelineLaneButton.disabled = getTimelineLaneCount() >= maximumTimelineLaneCount;
  musicDisplay.classList.toggle("has-music", hasMusic());
}

function syncLayoutSizeVariables(): void {
  appShell.style.setProperty("--timeline-height", `${timelinePanelHeight}px`);
  appShell.style.setProperty("--inspector-width", `${inspectorPanelWidth}px`);
}

function startLayoutResize(target: "timeline" | "inspector", event: PointerEvent): void {
  activeResizeTarget = target;
  event.preventDefault();
  document.body.classList.add("is-resizing-layout");
}

function handleLayoutResizeMove(event: PointerEvent): void {
  if (!activeResizeTarget) {
    return;
  }

  if (activeResizeTarget === "timeline") {
    timelinePanelHeight = clamp(window.innerHeight - event.clientY, 160, Math.min(460, window.innerHeight * 0.56));
  } else {
    inspectorPanelWidth = clamp(window.innerWidth - event.clientX, 300, Math.min(680, window.innerWidth * 0.5));
  }

  syncLayoutSizeVariables();
  resizePreviewHost();
  resizeTimelineToViewport();
}

function stopLayoutResize(): void {
  if (!activeResizeTarget) {
    return;
  }

  activeResizeTarget = null;
  document.body.classList.remove("is-resizing-layout");
}

function syncPlaybackButton(): void {
  if (clock.isPlaying) {
    playButton.innerHTML = iconSvg("stop");
    playButton.title = "停止";
    playButton.setAttribute("aria-label", "停止");
    playButton.classList.add("is-playing");
  } else {
    playButton.innerHTML = iconSvg("play");
    playButton.title = "再生";
    playButton.setAttribute("aria-label", "再生");
    playButton.classList.remove("is-playing");
  }
}

function syncHistoryButtons(): void {
  undoButton.disabled = undoStack.length === 0;
  redoButton.disabled = redoStack.length === 0;
}

function syncSnapButton(): void {
  snapToggleButton.classList.toggle("is-active", snapToMeasures);
  snapToggleButton.setAttribute("aria-pressed", String(snapToMeasures));
  timelineTrack.classList.toggle("is-snap-enabled", snapToMeasures);
}

function pushHistory(): void {
  undoStack.push(clonePattern(pattern));

  if (undoStack.length > maxHistoryEntries) {
    undoStack.shift();
  }

  redoStack.length = 0;
  syncHistoryButtons();
}

function undoPatternChange(): void {
  const previousPattern = undoStack.pop();

  if (!previousPattern) {
    return;
  }

  redoStack.push(clonePattern(pattern));
  restorePattern(previousPattern);
}

function redoPatternChange(): void {
  const nextPattern = redoStack.pop();

  if (!nextPattern) {
    return;
  }

  undoStack.push(clonePattern(pattern));
  restorePattern(nextPattern);
}

function clonePattern(source: BulletPattern): BulletPattern {
  return structuredClone(source);
}

function restorePattern(snapshot: BulletPattern): void {
  pattern = clonePattern(snapshot);
  ensureTimelineSettings();
  ensurePatternEditorFields();
  clearAimCache();

  if (hasMusic()) {
    pattern.duration = Math.max(pattern.duration, audio.duration);
  }

  if (clock.time > pattern.duration) {
    clock.seek(pattern.duration, pattern.duration);
    syncAudioToClock();
  }

  if (!pattern.events.some((event) => event.id === selectedEventId)) {
    selectSingleEvent(pattern.events[0]?.id ?? null);
  } else {
    selectedEventIds = new Set([...selectedEventIds].filter((eventId) => pattern.events.some((event) => event.id === eventId)));
    if (selectedEventId) {
      selectedEventIds.add(selectedEventId);
    }
  }

  if (!pattern.events.some((event) => event.id === editingEventId)) {
    editingEventId = editorMode === "trajectory" ? getTrajectoryEditableEvent(getSelectedEvent())?.id ?? null : null;
  }

  renderEverything();
}

function toggleMenu(menuName: string): void {
  const willOpen = !menuPopovers.some((popover) => popover.dataset.menu === menuName && popover.classList.contains("is-open"));

  closeMenus();

  if (!willOpen) {
    return;
  }

  document.querySelector<HTMLButtonElement>(`[data-menu-button="${menuName}"]`)?.classList.add("is-active");
  document.querySelector<HTMLDivElement>(`[data-menu="${menuName}"]`)?.classList.add("is-open");
}

function closeMenus(): void {
  menuButtons.forEach((button) => button.classList.remove("is-active"));
  menuPopovers.forEach((popover) => popover.classList.remove("is-open"));
}

function selectSingleEvent(eventId: string | null): void {
  selectedEventId = eventId;
  selectedEventIds = eventId ? new Set([eventId]) : new Set();
}

function toggleSelectedEvent(eventId: string): void {
  const nextSelection = new Set(selectedEventIds);

  if (nextSelection.has(eventId)) {
    nextSelection.delete(eventId);
  } else {
    nextSelection.add(eventId);
  }

  if (nextSelection.size === 0) {
    nextSelection.add(eventId);
  }

  selectedEventIds = nextSelection;
  selectedEventId = nextSelection.has(eventId) ? eventId : [...nextSelection][nextSelection.size - 1] ?? eventId;
}

function selectEventFromPointer(eventId: string, pointerEvent: MouseEvent | PointerEvent): void {
  if (pointerEvent.ctrlKey || pointerEvent.metaKey) {
    toggleSelectedEvent(eventId);
  } else {
    selectSingleEvent(eventId);
  }
}

function isSelectedEvent(event: AttackEvent): boolean {
  return selectedEventIds.has(event.id);
}

function getSelectedEvents(): AttackEvent[] {
  const selectedEvents = pattern.events.filter((event) => selectedEventIds.has(event.id));

  if (selectedEvents.length > 0) {
    return selectedEvents;
  }

  const selectedEvent = getSelectedEvent();

  return selectedEvent ? [selectedEvent] : [];
}

function renderEventList(): void {
  eventList.innerHTML = "";

  if (copyStatusText) {
    const status = document.createElement("div");

    status.className = "copy-status";
    status.textContent = copyStatusText;
    eventList.appendChild(status);
  }

  for (const event of pattern.events.filter((patternEvent) => !patternEvent.packageId)) {
    const card = document.createElement("div");
    const endTime = getEventEndTime(event);
    const isMutedByEditMode = editorMode === "trajectory" && editingEventId !== null && event.id !== editingEventId;
    const isVisible = isEventVisible(event);

    card.className = `event-card ${isSelectedEvent(event) ? "is-selected" : ""} ${isMutedByEditMode ? "is-muted" : ""} ${!isVisible ? "is-hidden" : ""}`;
    card.innerHTML = `
      <button class="event-card-main" type="button">
        <div class="event-card-title">
          <span class="event-swatch" style="background: ${formatColor(event.color)}"></span>
          <span>${escapeHtml(event.name)}</span>
        </div>
        <span class="event-time">${event.startTime.toFixed(2)}s - ${endTime.toFixed(2)}s</span>
        <span class="event-lane">L${getEventTimelineLane(event) + 1}</span>
      </button>
      <div class="event-card-actions">
        <button class="event-action-button ${isVisible ? "is-active" : ""}" type="button" title="${isVisible ? "非表示にする" : "表示する"}" aria-label="${isVisible ? "非表示にする" : "表示する"}" data-event-action="visibility">
          ${iconSvg(isVisible ? "eye" : "eyeOff")}
        </button>
      </div>
    `;
    const mainButton = card.querySelector<HTMLButtonElement>(".event-card-main");
    const visibilityButton = card.querySelector<HTMLButtonElement>('[data-event-action="visibility"]');

    mainButton?.addEventListener("click", (clickEvent) => {
      selectEventFromPointer(event.id, clickEvent);
      if (editorMode === "trajectory") {
        editingEventId = getTrajectoryEditableEvent(event)?.id ?? null;
      }
      if (clickEvent.detail >= 2) {
        activeInspectorTab = isAttackPackageEvent(event) ? "package" : "properties";
      }
      renderEverything();
    });
    mainButton?.addEventListener("dblclick", () => {
      selectSingleEvent(event.id);
      if (editorMode === "trajectory") {
        editingEventId = getTrajectoryEditableEvent(event)?.id ?? null;
      }
      activeInspectorTab = isAttackPackageEvent(event) ? "package" : "properties";
      renderEverything();
    });
    visibilityButton?.addEventListener("click", () => {
      pushHistory();
      event.visible = !isEventVisible(event);
      renderEverything();
    });
    eventList.appendChild(card);
  }
}

function getEventEndTime(event: AttackEvent): number {
  if (isAttackPackageEvent(event)) {
    return event.startTime + event.duration;
  }

  switch (event.kind) {
    case "spawn_bullet_spread":
    case "spawn_aimed_spread":
    case "fire_from_moving_origin":
      return event.startTime + event.duration + Math.max(0, event.clipRepeat - 1) * Math.max(0, event.clipInterval);
    case "spawn_radial":
      return event.startTime + event.duration + Math.max(0, event.radialRepeat - 1) * Math.max(0, event.radialInterval);
    case "spawn_bullet":
    case "spawn_enemy_origin":
    case "spawn_curved_laser":
    case "transform_bullet":
      return event.startTime + event.duration;
    case "radialBurst":
      return event.startTime + event.duration + Math.max(0, event.repeatCount - 1) * Math.max(0, event.repeatInterval);
    case "aimedSpread":
    case "bossMirroredFan":
    case "polynomialProjectile":
      return event.startTime + event.duration + Math.max(0, event.fireCount - 1) * Math.max(0, event.fireInterval);
    case "beatPulseRing":
      return event.startTime + event.duration + Math.max(0, event.repeatCount - 1) * Math.max(0, event.repeatInterval);
    case "closingWalls":
      return event.startTime + event.moveTime + event.holdTime + event.returnTime;
    case "safeLaneShift":
      return event.startTime + Math.max(event.duration, event.switchInterval * Math.max(1, event.switchCount));
    case "warningZone":
    case "movingBlock":
    case "curvedLaserRing":
    case "wallSweep":
    case "laserBeam":
    case "rotatingShape":
      return event.startTime + event.duration;
  }
}

function renderPropertyForm(): void {
  const selectedEvent = getSelectedEvent();

  if (!selectedEvent) {
    propertyForm.innerHTML = `<p class="empty-state">イベントを追加または選択してください。</p>`;
    return;
  }

  if (isAttackPackageEvent(selectedEvent)) {
    propertyForm.innerHTML = `<p class="empty-state">パッケージタブで、このパッケージの設定と生成される弾幕を編集できます。</p>`;
    return;
  }

  const propertyGroupsHtml = renderPropertyGroups(selectedEvent);

  propertyForm.innerHTML = `
    <div class="property-event-name">
      <input class="event-name-input" name="name" type="text" value="${escapeHtml(selectedEvent.name)}" aria-label="event name" />
    </div>
    <div class="property-time-mode" aria-label="時間入力モード">
      <span>timeInput</span>
      <button class="time-mode-button ${propertyTimeMode === "seconds" ? "is-active" : ""}" type="button" data-time-mode="seconds">seconds</button>
      <button class="time-mode-button ${propertyTimeMode === "beats" ? "is-active" : ""}" type="button" data-time-mode="beats">beats</button>
    </div>
    ${propertyGroupsHtml}
    <button id="delete-event-button" class="danger-button" type="button">Delete selected event</button>
  `;
}

function renderPropertyGroups(event: AttackEvent): string {
  const numberFieldMap = new Map(getFieldConfigsFor(event).map((field) => [field.name, field]));
  const selectFieldMap = new Map(getSelectConfigsFor(event).map((field) => [field.name, field]));
  const checkboxFieldMap = new Map(getCheckboxConfigsFor(event).map((field) => [field.name, field]));

  return propertyGroups
    .map((group) => {
      const selectFields = (group.selectFields ?? [])
        .map((name) => selectFieldMap.get(name))
        .filter((field): field is SelectFieldConfig => Boolean(field))
        .map((field) => renderSelectField(event, field))
        .join("");
      const checkboxFields = (group.checkboxFields ?? [])
        .map((name) => checkboxFieldMap.get(name))
        .filter((field): field is CheckboxFieldConfig => Boolean(field))
        .map((field) => renderCheckboxField(event, field))
        .join("");
      const numberFields = renderNumberFields(
        event,
        (group.numberFields ?? [])
          .map((name) => numberFieldMap.get(name))
          .filter((field): field is NumberFieldConfig => Boolean(field)),
      );
      const colorField = group.includeColor ? renderColorField(event) : "";
      const content = `${selectFields}${checkboxFields}${numberFields}${colorField}`;

      if (!content.trim()) {
        return "";
      }

      return `
        <section class="property-group">
          <h3>${group.title}</h3>
          <div class="property-group-fields">${content}</div>
        </section>
      `;
    })
    .join("");
}

function renderPackagePanel(): void {
  const selectedEvent = getSelectedEvent();
  const packageEvent = isAttackPackageEvent(selectedEvent) ? selectedEvent : getParentPackage(selectedEvent);

  if (!packageEvent) {
    packagePanel.innerHTML = `<p class="empty-state">パッケージを選択すると、生成される弾幕一覧とパッケージ設定を編集できます。</p>`;
    return;
  }

  const childEvents = getPackageChildren(packageEvent);
  const fields = getPackageFieldConfigs(packageEvent);
  const missingDefinitionNotice = isMissingCustomPackageDefinition(packageEvent)
    ? `<p class="package-warning">この custom パッケージの .mjs はまだ読み込まれていません。生成済み攻撃は保持されますが、再生成には元の .mjs が必要です。</p>`
    : "";

  packagePanel.innerHTML = `
    <div class="property-event-name">
      <input class="event-name-input" name="name" type="text" value="${escapeHtml(packageEvent.name)}" aria-label="package name" />
    </div>
    ${missingDefinitionNotice}
    <div class="property-group">
      <h3>Package</h3>
      <div class="property-group-fields">
        ${fields.map((field) => renderPackageField(packageEvent, field)).join("")}
      </div>
    </div>
    <div class="property-group">
      <h3>Generated Attacks</h3>
      <div class="package-child-list">
        ${childEvents.map((child) => renderPackageChildCard(child)).join("")}
      </div>
    </div>
  `;
}

function renderPackageMenuItems(): string {
  const customKinds = new Set<string>(getCustomPackageKinds());
  const builtInPackageItems = getAvailablePackageKinds()
    .filter((kind) => !customKinds.has(kind))
    .map((kind) => renderBuiltInPackageMenuItem(kind))
    .join("");
  const customPackageItems = [...customKinds]
    .map((kind) => renderCustomPackageMenuItem(kind as AttackPackageKind))
    .join("");

  return `
    <div class="menu-section-label">その他</div>
    <div class="menu-section">
      ${builtInPackageItems}
    </div>
    ${customPackageItems ? `
      <div class="menu-divider" role="separator"></div>
      <div class="menu-section-label">追加したパッケージ</div>
      <div class="menu-section">
        ${customPackageItems}
      </div>
    ` : ""}
  `;
}

function renderBuiltInPackageMenuItem(kind: AttackPackageKind): string {
  return `<button class="menu-item package-menu-item" type="button" data-add-kind="${kind}">${iconSvg(getPackageMenuIcon(kind))}<span>${escapeHtml(getPackageKindLabel(kind))}</span></button>`;
}

function renderCustomPackageMenuItem(kind: AttackPackageKind): string {
  const label = getPackageKindLabel(kind);

  return `
    <div class="package-menu-row">
      <button class="menu-item package-menu-item" type="button" data-add-kind="${kind}">${iconSvg(getPackageMenuIcon(kind))}<span>${escapeHtml(label)}</span></button>
      <button class="menu-action-button" type="button" data-delete-package-kind="${kind}" title="${escapeHtml(label)}を削除" aria-label="${escapeHtml(label)}を削除">${iconSvg("trash")}</button>
    </div>
  `;
}

function getPackageMenuIcon(kind: AttackPackageKind): string {
  const customIcon = getPackageIcon(kind);

  if (customIcon) {
    return customIcon;
  }

  switch (kind) {
    case "package_random_barrage":
      return "scatter";
    case "package_repeating_lasers":
      return "laserRows";
    case "package_bomb_burst":
      return "bomb";
    case "package_random_circle":
      return "circleArea";
    case "package_grid_square":
      return "grid";
    case "package_lag_radial":
      return "burst";
    case "package_split_lag_radial":
      return "splitBurst";
    case "package_random_lasers":
      return "laserScatter";
    case "package_center_lasers":
      return "radialLaser";
    case "package_area_parallel":
      return "areaParallel";
    case "package_snake_chain":
      return "snake";
    case "package_enter_exit_bar":
      return "enterExit";
    case "package_rotating_lasers":
      return "rotatingLaser";
    case "package_sequential_lasers":
      return "sequentialLaser";
    default:
      return "package";
  }
}

function renderPackageField(event: AttackPackageEvent, field: PackageFieldConfig): string {
  const value = (event as unknown as Record<string, string | number>)[field.name];
  const title = field.description ? escapeHtml(field.description) : getPropertyTooltip(field.name);

  if (field.type === "checkbox") {
    return `
      <label class="property-field property-checkbox-field">
        <span title="${title}">${field.label}</span>
        <input name="${field.name}" type="checkbox" ${Number(value ?? 0) > 0 ? "checked" : ""} />
      </label>
    `;
  }

  if (field.type === "select") {
    return `
      <label class="property-field">
        <span title="${title}">${field.label}</span>
        <select name="${field.name}">
          ${(field.options ?? []).map((option) => `<option value="${option.value}" ${String(value) === option.value ? "selected" : ""}>${option.label}</option>`).join("")}
        </select>
      </label>
    `;
  }

  return `
    <label class="property-field">
      <span title="${title}">${field.label}</span>
      <input name="${field.name}" type="number" step="${field.step ?? 0.01}" value="${formatPropertyNumber(Number(value ?? 0))}" />
    </label>
  `;
}

function renderPackageChildCard(event: AttackEvent): string {
  const isVisible = isEventVisible(event);
  const isSelected = isSelectedEvent(event);

  return `
    <div class="event-card package-child-card ${isSelected ? "is-selected" : ""} ${!isVisible ? "is-hidden" : ""}" data-package-child-id="${event.id}">
      <button class="event-card-main" type="button" data-package-child-select="${event.id}">
        <div class="event-card-title">
          <span class="event-swatch" style="background: ${formatColor(event.color)}"></span>
          <span>${escapeHtml(event.name)}</span>
        </div>
        <span class="event-time">${event.startTime.toFixed(2)}s - ${getEventEndTime(event).toFixed(2)}s</span>
        <span class="event-lane">${event.packageLocked === false ? "Free" : "Auto"}</span>
      </button>
      <div class="event-card-actions">
        <button class="event-action-button ${isVisible ? "is-active" : ""}" type="button" data-package-child-visibility="${event.id}" title="${isVisible ? "非表示" : "表示"}">
          ${iconSvg(isVisible ? "eye" : "eyeOff")}
        </button>
      </div>
    </div>
  `;
}

function getPropertyDescription(name: string): string {
  if (name.startsWith("package")) {
    const packageDescriptions: Record<string, string> = {
      packageCount: "パッケージ内で生成する攻撃や弾の数です。分裂ラグ円形弾では最初に放つ弾数です。",
      packageStartX: "ボムなどが最初に出現するX座標です。",
      packageStartY: "ボムなどが最初に出現するY座標です。",
      packageAngleWidth: "ランダム発射やボム破裂では角度の広がりです。ラグ円形連射では各連射ごとに開始角度をずらす量です。",
      packageStartAngle: "最初の発射角度です。0で右向き、90で下向きです。",
      packageSplitStartAngle: "分裂後の発射角度です。分裂ラグ円形弾では親弾の進行方向にこの角度を加えます。",
      packageAimAtPlayer: "オンにすると、最初の発射角度を発射時点のプレイヤー位置へ向けます。",
      packageSplitAimAtPlayer: "オンにすると、分裂後の発射角度を発射時点のプレイヤー位置へ向けます。",
      packageInterval: "繰り返し生成する間隔です。",
      packageThickness: "レーザーやバーの太さです。",
      packageOrientation: "水平または垂直の向きです。",
      packageX: "生成エリアや発射点のX座標です。",
      packageY: "生成エリアや発射点のY座標です。",
      packageWidth: "ランダム生成エリアの幅です。",
      packageHeight: "ランダム生成エリアの高さです。",
      packageSize: "円、四角、正方形弾などの基本サイズです。",
      packageDuration: "生成される攻撃ひとつ分の継続時間です。分裂ラグ円形弾では分裂前の弾が消えて次の発射が起きるまでの時間です。",
      packageSplitDuration: "分裂後に発射された弾が消えるまでの時間です。",
      packageFuseTime: "ボムが出現してから破裂するまでの時間です。",
      packageBulletCount: "一度に放つ弾の数です。分裂ラグ円形弾では各消滅位置から再発射する弾数です。",
      packageBulletSize: "ボム破裂弾で破裂後に飛ぶ弾の大きさです。",
      packageBombSize: "ボム本体として飛んでくる円の大きさです。",
      packageSpeed: "生成される弾やバーの移動速度です。",
      packageSplitSpeed: "分裂後に発射された弾の移動速度です。",
      packageDirectionDeg: "エリア平行弾の発射方向です。0で右向き、90で下向きです。",
      packageMoveDirectionDeg: "入退場バーの移動方向です。0で右向き、90で下向きです。",
      packageDistance: "連続レーザー同士の距離です。",
      packageRotationSpeed: "回転レーザーの回転速度です。",
      packageWarningTime: "本体攻撃の前に表示する予告時間です。",
      packageWarningAlpha: "パッケージから自動生成されるWarning表示の透明度です。",
      packageSpacing: "スネーク状の弾同士の時間差です。",
      packageInitialPosition: "入退場バーや時間差レーザーの最初の位置です。",
      packageLength: "レーザーやバーの長さです。",
      packagePolynomialA: "スネーク正方形の軌道 y = ax^4 + bx^3 + cx^2 + dx の x 項です。x と y は100px単位です。",
      packagePolynomialB: "スネーク正方形の軌道 y = ax^4 + bx^3 + cx^2 + dx の x^2 項です。x と y は100px単位です。",
      packagePolynomialC: "スネーク正方形の軌道 y = ax^4 + bx^3 + cx^2 + dx の x^3 項です。x と y は100px単位です。",
      packagePolynomialD: "スネーク正方形の軌道 y = ax^4 + bx^3 + cx^2 + dx の x^4 項です。x と y は100px単位です。",
    };

    return packageDescriptions[name] ?? "パッケージ内の攻撃を自動生成するための設定です。";
  }

  return propertyDescriptions[name] ?? "選択中の攻撃プリセットで使用するパラメータです。";
}

function getPropertyTooltip(name: string): string {
  return escapeHtml(getPropertyDescription(name));
}

function getCompactFieldTooltip(names: string[]): string {
  return escapeHtml(names.map((name) => `${getPropertyLabel(name)}: ${getPropertyDescription(name)}`).join("\n"));
}

function getPropertyLabel(name: string): string {
  const numberField = numberFieldConfigs.find((field) => field.name === name);

  if (numberField) {
    return getDisplayFieldLabel(numberField);
  }

  const selectField = selectFieldConfigs.find((field) => field.name === name);

  if (selectField) {
    return selectField.label;
  }

  const checkboxField = checkboxFieldConfigs.find((field) => field.name === name);

  if (checkboxField) {
    return checkboxField.label;
  }

  return name;
}

function renderSelectField(event: AttackEvent, field: SelectFieldConfig): string {
  return `
    <label class="property-field">
      <span title="${getPropertyTooltip(field.name)}">${field.label}</span>
      <select name="${field.name}">
        ${field.options
          .map((option) => `<option value="${option.value}" ${option.value === getSelectFieldValue(event, field) ? "selected" : ""}>${option.label}</option>`)
          .join("")}
      </select>
    </label>
  `;
}

function renderCheckboxField(event: AttackEvent, field: CheckboxFieldConfig): string {
  return `
    <label class="property-field property-checkbox-field">
      <span title="${getPropertyTooltip(field.name)}">${field.label}</span>
      <input name="${field.name}" type="checkbox" ${getNumberField(event, field.name) > 0 ? "checked" : ""} />
    </label>
  `;
}

function renderColorField(event: AttackEvent): string {
  return `
    <label class="property-field">
      <span title="${getPropertyTooltip("color")}">color</span>
      <input name="color" type="color" value="${formatColor(event.color)}" />
    </label>
  `;
}

function renderNumberFields(event: AttackEvent, fields: NumberFieldConfig[]): string {
  const renderedFields = new Set<string>();
  const fieldByName = new Map(fields.map((field) => [field.name, field]));
  const fragments: string[] = [];

  for (const group of compactFieldGroups) {
    const groupFields = group.fields.map((name) => fieldByName.get(name));

    if (groupFields.some((field) => !field)) {
      continue;
    }

    for (const fieldName of group.fields) {
      renderedFields.add(fieldName);
    }

    if (group.label === "polynomial") {
      fragments.push(renderPolynomialFormulaField(event, groupFields as NumberFieldConfig[]));
      continue;
    }

    fragments.push(`
      <label class="property-field property-compact-field">
        <span title="${getCompactFieldTooltip(group.fields)}">${group.label}</span>
        <div class="compact-inputs" style="--input-count: ${group.fields.length}">
          ${groupFields.map((field) => renderNumberInput(event, field!, getDisplayFieldLabel(field!))).join("")}
        </div>
      </label>
    `);
  }

  for (const field of fields) {
    if (renderedFields.has(field.name)) {
      continue;
    }

    fragments.push(`
      <label class="property-field">
        <span title="${getPropertyTooltip(field.name)}">${getDisplayFieldLabel(field)}</span>
        ${renderNumberInput(event, field)}
      </label>
    `);
  }

  return fragments.join("");
}

function renderPolynomialFormulaField(event: AttackEvent, fields: NumberFieldConfig[]): string {
  const termLabels: Record<string, string> = {
    polynomialD: "x^4",
    polynomialC: "x^3",
    polynomialB: "x^2",
    polynomialA: "x",
  };

  return `
    <div class="property-field property-polynomial-field">
      <span title="${getCompactFieldTooltip(fields.map((field) => field.name))}">polynomial</span>
      <div class="polynomial-editor" aria-label="polynomial curve">
        <div class="polynomial-expression" title="${escapeHtml("x と y は100px単位です。例: y = 1x なら45度の直線になります。")}">
          <span>y =</span>
          ${fields
            .map(
              (field, index) => `
                <span class="polynomial-term">
                  ${renderNumberInput(event, field, getDisplayFieldLabel(field))}
                  <span>${termLabels[field.name] ?? field.name}</span>
                </span>
                ${index < fields.length - 1 ? '<span class="polynomial-plus">+</span>' : ""}
              `,
            )
            .join("")}
        </div>
      </div>
    </div>
  `;
}

function renderNumberInput(event: AttackEvent, field: NumberFieldConfig, ariaLabel = field.name): string {
  return `
    <input
      name="${field.name}"
      type="number"
      min="${getDisplayFieldMin(field)}"
      max="${getDisplayFieldMax(field)}"
      step="${getDisplayFieldStep(field)}"
      value="${getDisplayFieldValue(event, field)}"
      aria-label="${ariaLabel}"
      title="${getPropertyTooltip(field.name)}"
    />
  `;
}

function renderTimelineMarkers(): void {
  const laneCount = getTimelineLaneCount();

  timelineTrack.style.setProperty("--timeline-lane-count", String(laneCount));
  timelineTrack.querySelectorAll(".timeline-marker, .timeline-event-range, .beat-grid-line, .timeline-lane-row").forEach((marker) => marker.remove());

  for (let lane = 0; lane < laneCount; lane += 1) {
    const row = document.createElement("div");

    row.className = "timeline-lane-row";
    row.style.setProperty("--timeline-lane-index", String(lane));
    timelineTrack.appendChild(row);
  }

  renderGridLines(timelineTrack, "track");

  for (const event of pattern.events.filter((patternEvent) => !patternEvent.packageId)) {
    const marker = document.createElement("button");
    const isMutedByEditMode = editorMode === "trajectory" && editingEventId !== null && event.id !== editingEventId;
    const isVisible = isEventVisible(event);
    const laneIndex = getEventTimelineLane(event);
    const startRatio = clamp(event.startTime / pattern.duration, 0, 1);
    const endTime = getEventEndTime(event);
    const endRatio = clamp(endTime / pattern.duration, startRatio, 1);
    const minimumRangeRatio = Math.min(0.01, 8 / Math.max(timelineTrack.clientWidth, 1));
    const rangeWidthRatio = Math.max(endRatio - startRatio, minimumRangeRatio);
    const range = document.createElement("div");

    range.className = `timeline-event-range ${isSelectedEvent(event) ? "is-selected" : ""} ${isMutedByEditMode ? "is-muted" : ""} ${!isVisible ? "is-hidden" : ""}`;
    range.title = `${event.name} ${event.startTime.toFixed(2)}s - ${endTime.toFixed(2)}s`;
    range.style.left = `${startRatio * 100}%`;
    range.style.width = `${Math.min(rangeWidthRatio, 1 - startRatio) * 100}%`;
    range.style.setProperty("--marker-color", formatColor(event.color));
    range.style.setProperty("--timeline-lane-index", String(laneIndex));
    timelineTrack.appendChild(range);

    marker.type = "button";
    marker.className = `timeline-marker ${isSelectedEvent(event) ? "is-selected" : ""} ${isMutedByEditMode ? "is-muted" : ""} ${!isVisible ? "is-hidden" : ""}`;
    marker.title = `${event.name} (${event.startTime.toFixed(2)}s - ${endTime.toFixed(2)}s)`;
    marker.style.left = `${startRatio * 100}%`;
    marker.style.setProperty("--marker-color", formatColor(event.color));
    marker.style.setProperty("--timeline-lane-index", String(laneIndex));
    marker.addEventListener("pointerdown", (pointerEvent) => {
      pointerEvent.stopPropagation();
      selectEventFromPointer(event.id, pointerEvent);
      if (editorMode === "trajectory") {
        editingEventId = getTrajectoryEditableEvent(event)?.id ?? null;
      }

      if (pointerEvent.ctrlKey || pointerEvent.metaKey) {
        renderEverything();
        return;
      }

      markerDraggingId = event.id;
      markerDragMoved = false;
      markerDragHistoryRecorded = false;
      markerDragStartX = pointerEvent.clientX;
      markerDragOriginalTime = event.startTime;
      marker.setPointerCapture(pointerEvent.pointerId);
      renderEventList();
      renderPropertyForm();
      renderPreview();
    });
    marker.addEventListener("pointermove", (pointerEvent) => {
      if (markerDraggingId !== event.id) {
        return;
      }

      if (!markerDragMoved && Math.abs(pointerEvent.clientX - markerDragStartX) < markerDragThreshold) {
        return;
      }

      if (!markerDragHistoryRecorded) {
        pushHistory();
        markerDragHistoryRecorded = true;
      }

      markerDragMoved = true;
      updateMarkerTimeFromPointer(event.id, pointerEvent);
      {
        const nextStartRatio = clamp(event.startTime / pattern.duration, 0, 1);
        const nextEndTime = getEventEndTime(event);
        const nextEndRatio = clamp(nextEndTime / pattern.duration, nextStartRatio, 1);
        const nextMinimumRangeRatio = Math.min(0.01, 8 / Math.max(timelineTrack.clientWidth, 1));
        const nextRangeWidthRatio = Math.max(nextEndRatio - nextStartRatio, nextMinimumRangeRatio);

        marker.style.left = `${nextStartRatio * 100}%`;
        marker.title = `${event.name} (${event.startTime.toFixed(2)}s - ${nextEndTime.toFixed(2)}s)`;
        range.title = `${event.name} ${event.startTime.toFixed(2)}s - ${nextEndTime.toFixed(2)}s`;
        range.style.left = `${nextStartRatio * 100}%`;
        range.style.width = `${Math.min(nextRangeWidthRatio, 1 - nextStartRatio) * 100}%`;
      }
    });
    marker.addEventListener("pointerup", (pointerEvent) => {
      if (markerDraggingId !== event.id) {
        return;
      }

      markerDraggingId = null;
      markerDragHistoryRecorded = false;

      if (!markerDragMoved) {
        event.startTime = markerDragOriginalTime;
      }

      if (marker.hasPointerCapture(pointerEvent.pointerId)) {
        marker.releasePointerCapture(pointerEvent.pointerId);
      }

      sortEvents();
      renderEverything();
    });
    marker.addEventListener("pointercancel", (pointerEvent) => {
      markerDraggingId = null;
      markerDragHistoryRecorded = false;

      if (marker.hasPointerCapture(pointerEvent.pointerId)) {
        marker.releasePointerCapture(pointerEvent.pointerId);
      }

      renderEverything();
    });
    marker.addEventListener("click", (clickEvent) => {
      if (clickEvent.ctrlKey || clickEvent.metaKey) {
        return;
      }

      if (markerDragMoved) {
        markerDragMoved = false;
        return;
      }

      selectSingleEvent(event.id);
      if (editorMode === "trajectory") {
        editingEventId = getTrajectoryEditableEvent(event)?.id ?? null;
      }
      renderEverything();
    });
    timelineTrack.appendChild(marker);
  }
}

function getSelectedEvent(): AttackEvent | undefined {
  return pattern.events.find((event) => event.id === selectedEventId);
}

function getFieldConfigsFor(event: AttackEvent): NumberFieldConfig[] {
  return numberFieldConfigs.filter((field) => field.kinds.includes(event.kind) && isNumberFieldVisibleForEvent(event, field.name));
}

function getSelectConfigsFor(event: AttackEvent): SelectFieldConfig[] {
  return selectFieldConfigs.filter((field) => field.kinds.includes(event.kind));
}

function getCheckboxConfigsFor(event: AttackEvent): CheckboxFieldConfig[] {
  return checkboxFieldConfigs.filter((field) => field.kinds.includes(event.kind));
}

function getSelectFieldValue(event: AttackEvent, field: SelectFieldConfig): string {
  if (field.name === "typeId") {
    return String(Math.round(getNumberField(event, field.name)));
  }

  return getStringField(event, field.name);
}

function setSelectFieldValue(event: AttackEvent, field: SelectFieldConfig, value: string): void {
  if (field.name === "typeId") {
    setNumberField(event, field.name, Number(value));
    return;
  }

  setStringField(event, field.name, value);
}

function isNumberFieldVisibleForEvent(event: AttackEvent, fieldName: string): boolean {
  if (!hasUnityMotionFields(event)) {
    return true;
  }

  if (fieldName === "typeId") {
    return false;
  }

  const typeId = Math.round(event.typeId ?? 0);

  if (fieldName === "visualSize") {
    return typeId === 0;
  }

  if (fieldName === "visualWidth" || fieldName === "visualHeight") {
    return typeId !== 0;
  }

  if (fieldName === "visualAngle" || fieldName === "angleSpeed") {
    return typeId !== 0;
  }

  return true;
}

function hasUnityMotionFields(event: AttackEvent): event is AttackEvent & { typeId: number } {
  return "typeId" in event && "pathSpeed" in event;
}

function getFieldMax(field: NumberFieldConfig): number {
  if (field.name === "startTime") {
    return pattern.duration;
  }

  return field.max;
}

function getFieldMin(field: NumberFieldConfig): number {
  return field.min;
}

function getDisplayFieldLabel(field: NumberFieldConfig): string {
  if (field.name === "polynomialA") {
    return "polynomial x";
  }

  if (field.name === "polynomialB") {
    return "polynomial x^2";
  }

  if (field.name === "polynomialC") {
    return "polynomial x^3";
  }

  if (field.name === "polynomialD") {
    return "polynomial x^4";
  }

  if (propertyTimeMode !== "beats" || !isTimeField(field.name)) {
    return field.name;
  }

  if (field.name === "startTime") {
    return "startBeat";
  }

  return `${field.name}Beats`;
}

function getDisplayFieldValue(event: AttackEvent, field: NumberFieldConfig): string {
  const value = getNumberField(event, field.name);

  if (propertyTimeMode !== "beats" || !isTimeField(field.name)) {
    return formatPropertyNumber(value);
  }

  if (field.name === "startTime") {
    return formatPropertyNumber(secondsToBeat(value));
  }

  return formatPropertyNumber(secondsToBeatDuration(value));
}

function getDisplayFieldMin(field: NumberFieldConfig): number {
  if (propertyTimeMode !== "beats" || !isTimeField(field.name)) {
    return getFieldMin(field);
  }

  if (field.name === "startTime") {
    return secondsToBeat(getFieldMin(field));
  }

  return secondsToBeatDuration(getFieldMin(field));
}

function getDisplayFieldMax(field: NumberFieldConfig): number {
  if (propertyTimeMode !== "beats" || !isTimeField(field.name)) {
    return getFieldMax(field);
  }

  if (field.name === "startTime") {
    return secondsToBeat(getFieldMax(field));
  }

  return secondsToBeatDuration(getFieldMax(field));
}

function getDisplayFieldStep(field: NumberFieldConfig): number {
  if (propertyTimeMode === "beats" && isTimeField(field.name)) {
    return 0.25;
  }

  return field.step;
}

function getStoredNumberFieldValue(field: NumberFieldConfig, displayedValue: number): number {
  if (propertyTimeMode === "beats" && isTimeField(field.name)) {
    const secondsValue = field.name === "startTime" ? beatToSeconds(displayedValue) : beatDurationToSeconds(displayedValue);

    return Number(secondsValue.toFixed(4));
  }

  return field.integer ? Math.round(displayedValue) : displayedValue;
}

function isTimeField(fieldName: string): boolean {
  return timeFieldNames.has(fieldName);
}

function getBeatInterval(): number {
  return 60 / Math.max(1, pattern.timeline.bpm);
}

function secondsToBeat(time: number): number {
  return (time - pattern.timeline.musicOffset) / getBeatInterval();
}

function beatToSeconds(beat: number): number {
  return pattern.timeline.musicOffset + beat * getBeatInterval();
}

function secondsToBeatDuration(seconds: number): number {
  return seconds / getBeatInterval();
}

function beatDurationToSeconds(beats: number): number {
  return beats * getBeatInterval();
}

function formatPropertyNumber(value: number): string {
  return Number(value.toFixed(4)).toString();
}

function getNumberField(event: AttackEvent, field: string): number {
  return Number((event as unknown as Record<string, number>)[field] ?? 0);
}

function setNumberField(event: AttackEvent, field: string, value: number): void {
  (event as unknown as Record<string, number>)[field] = value;
}

function getStringField(event: AttackEvent, field: string): string {
  return String((event as unknown as Record<string, string>)[field] ?? "");
}

function setStringField(event: AttackEvent, field: string, value: string): void {
  (event as unknown as Record<string, string>)[field] = value;
}

function updateStartTimeInput(value: number): void {
  const startTimeInput = propertyForm.querySelector<HTMLInputElement>('input[name="startTime"]');

  if (startTimeInput) {
    startTimeInput.value = propertyTimeMode === "beats" ? formatPropertyNumber(secondsToBeat(value)) : formatPropertyNumber(value);
  }
}

function syncTimelineInputs(): void {
  musicOffsetInput.value = String(pattern.timeline.musicOffset);
  bpmInput.value = formatTimelineNumber(pattern.timeline.bpm);
  measureIntervalInput.value = formatTimelineNumber(getMeasureInterval());
  beatsPerMeasureInput.value = String(pattern.timeline.beatsPerMeasure);
}

function ensureTimelineSettings(): void {
  pattern.timeline = {
    ...defaultTimelineSettings,
    ...pattern.timeline,
  };
  pattern.timeline.musicOffset = clamp(pattern.timeline.musicOffset, -60, Math.max(600, pattern.duration));
  pattern.timeline.bpm = clamp(pattern.timeline.bpm, 1, 400);
  pattern.timeline.beatsPerMeasure = Math.round(clamp(pattern.timeline.beatsPerMeasure, 1, 16));
}

function ensurePatternEditorFields(): void {
  for (const event of pattern.events) {
    ensureEventEditorFields(event);
  }

  pattern.timelineLaneCount = getTimelineLaneCount();

  for (const event of pattern.events) {
    event.timelineLane = getEventTimelineLane(event);
  }
}

function ensureEventEditorFields(event: AttackEvent): void {
  event.visible = event.visible !== false;
  delete (event as AttackEvent & { showTrajectory?: boolean }).showTrajectory;
  event.timelineLane = Math.max(0, Math.round(Number(event.timelineLane) || 0));

  if (["movingBlock", "wallSweep", "beatPulseRing", "closingWalls", "safeLaneShift"].includes(event.kind)) {
    const warningEvent = event as AttackEvent & { warningAlpha?: number };
    warningEvent.warningAlpha = Number.isFinite(warningEvent.warningAlpha) ? warningEvent.warningAlpha : 0.72;
  }
}

function getTimelineLaneCount(): number {
  const configuredLaneCount = Number(pattern.timelineLaneCount);
  const maxEventLane = pattern.events.reduce((maxLane, event) => Math.max(maxLane, readEventTimelineLane(event)), 0);
  const requestedLaneCount = Number.isFinite(configuredLaneCount) ? configuredLaneCount : minimumTimelineLaneCount;

  return Math.round(clamp(Math.max(requestedLaneCount, maxEventLane + 1), minimumTimelineLaneCount, maximumTimelineLaneCount));
}

function readEventTimelineLane(event: AttackEvent): number {
  const lane = Number(event.timelineLane);

  return Number.isFinite(lane) ? Math.max(0, Math.round(lane)) : 0;
}

function getEventTimelineLane(event: AttackEvent): number {
  return Math.round(clamp(readEventTimelineLane(event), 0, getTimelineLaneCount() - 1));
}

function isEventVisible(event: AttackEvent): boolean {
  return event.visible !== false;
}

function moveSelectedEventLane(delta: number): void {
  const selectedEvent = getSelectedEvent();

  if (!selectedEvent || (editingEventId && selectedEvent.id !== editingEventId)) {
    return;
  }

  const currentLane = getEventTimelineLane(selectedEvent);
  const nextLane = Math.round(clamp(currentLane + delta, 0, getTimelineLaneCount() - 1));

  if (nextLane === currentLane) {
    return;
  }

  pushHistory();
  selectedEvent.timelineLane = nextLane;
  if (isAttackPackageEvent(selectedEvent)) {
    for (const child of getPackageChildren(selectedEvent)) {
      child.timelineLane = nextLane;
    }
  }
  renderEverything();
}

function parseTimelineNumber(value: string, fallback: number): number {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatTimelineNumber(value: number): string {
  return Number(value.toFixed(3)).toString();
}

function getMeasureInterval(): number {
  return (60 * pattern.timeline.beatsPerMeasure) / Math.max(1, pattern.timeline.bpm);
}

function renderTimelineScale(): void {
  const width = Math.ceil(getTimelineContentWidth());

  timelineContent.style.width = `${width}px`;
  timelineZoomDisplay.textContent = `${Math.round(timelineZoom * 100)}%`;

  if (waveformCanvas.width !== width) {
    waveformCanvas.width = width;
  }

  if (waveformCanvas.height !== 48) {
    waveformCanvas.height = 48;
  }
}

function getTimelineContentWidth(): number {
  const viewportWidth = getTimelineViewportWidth();
  const desiredWidth = viewportWidth * timelineZoom;

  return Math.min(maxTimelineContentWidth, Math.max(viewportWidth, desiredWidth));
}

function getTimelineViewportWidth(): number {
  const rectWidth = timelineViewport.getBoundingClientRect().width;

  return Math.max(1, timelineViewport.clientWidth, Number.isFinite(rectWidth) ? rectWidth : 0);
}

function getMaxTimelineZoom(): number {
  return Math.max(minTimelineZoom, Math.min(maxTimelineZoom, maxTimelineContentWidth / getTimelineViewportWidth()));
}

function handleTimelineWheel(event: WheelEvent): void {
  if (event.ctrlKey) {
    event.preventDefault();
    zoomTimelineFromWheel(event);
    return;
  }

  if (event.shiftKey) {
    event.preventDefault();
    timelineViewport.scrollTop += event.deltaY;
    return;
  }

  if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) {
    return;
  }

  event.preventDefault();
  timelineViewport.scrollLeft += event.deltaY;
}

function zoomTimelineFromWheel(event: WheelEvent): void {
  const previousZoom = timelineZoom;
  const bounds = timelineViewport.getBoundingClientRect();
  const pointerX = clamp(event.clientX - bounds.left, 0, bounds.width);
  const anchorTime = contentXToTime(timelineViewport.scrollLeft + pointerX);
  const zoomFactor = Math.exp(-event.deltaY * 0.0015);

  timelineZoom = clamp(timelineZoom * zoomFactor, minTimelineZoom, getMaxTimelineZoom());

  if (timelineZoom === previousZoom) {
    return;
  }

  renderTimelineScale();
  renderTimelineMarkers();
  renderWaveform();
  timelineViewport.scrollLeft = timeToContentX(anchorTime) - pointerX;
  syncUi();
}

function resizeTimelineToViewport(): void {
  const anchorTime = getTimelineViewportAnchorTime();

  timelineZoom = clamp(timelineZoom, minTimelineZoom, getMaxTimelineZoom());
  renderTimelineScale();
  renderTimelineMarkers();
  renderWaveform();
  timelineViewport.scrollLeft = timeToContentX(anchorTime) - getTimelineViewportWidth() / 2;
  syncUi();
}

function getTimelineViewportAnchorTime(): number {
  const viewportCenter = timelineViewport.scrollLeft + getTimelineViewportWidth() / 2;

  if (timelineViewport.scrollWidth <= timelineViewport.clientWidth + 1) {
    return clock.time;
  }

  return contentXToTime(viewportCenter);
}

function contentXToTime(x: number): number {
  const width = Math.max(1, getTimelineContentWidth());

  return clamp((x / width) * pattern.duration, 0, pattern.duration);
}

function timeToContentX(time: number): number {
  return (clamp(time, 0, pattern.duration) / pattern.duration) * getTimelineContentWidth();
}

function getSnappedEventTime(rawTime: number): number {
  const clampedTime = clamp(rawTime, 0, pattern.duration);

  if (!snapToMeasures) {
    return clampedTime;
  }

  const gridLines = getGridLinePositions();
  const snapThresholdPixels = getSnapThresholdPixels(gridLines);
  let closestTime = clampedTime;
  let closestDistance = Number.POSITIVE_INFINITY;

  for (const line of gridLines) {
    const distance = Math.abs(timeToContentX(line.time) - timeToContentX(clampedTime));

    if (distance < closestDistance) {
      closestDistance = distance;
      closestTime = line.time;
    }
  }

  return closestDistance <= snapThresholdPixels ? closestTime : clampedTime;
}

function getSnapThresholdPixels(gridLines: Array<{ time: number; ratio: number; isMeasure: boolean }>): number {
  if (gridLines.length < 2) {
    return maxSnapThresholdPixels;
  }

  const spacings = gridLines
    .slice(1)
    .map((line, index) => Math.abs(timeToContentX(line.time) - timeToContentX(gridLines[index].time)))
    .filter((spacing) => Number.isFinite(spacing) && spacing > 0);

  if (spacings.length === 0) {
    return maxSnapThresholdPixels;
  }

  const smallestSpacing = Math.min(...spacings);

  return clamp(smallestSpacing * snapThresholdGridRatio, minSnapThresholdPixels, maxSnapThresholdPixels);
}

async function buildWaveformChannelData(file: File): Promise<Float32Array> {
  const arrayBuffer = await file.arrayBuffer();
  const audioContext = new AudioContext();

  try {
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
    const channelData = audioBuffer.getChannelData(0);

    return new Float32Array(channelData);
  } finally {
    void audioContext.close();
  }
}

function renderWaveform(): void {
  const context = waveformCanvas.getContext("2d");

  if (!context) {
    return;
  }

  rebuildWaveformPeaksForCanvas();

  const { width, height } = waveformCanvas;
  context.clearRect(0, 0, width, height);
  context.fillStyle = "#050505";
  context.fillRect(0, 0, width, height);
  context.strokeStyle = "#262626";
  context.strokeRect(0.5, 0.5, width - 1, height - 1);

  if (musicPeaks.length > 0) {
    context.strokeStyle = "#d8d8d8";
    context.lineWidth = 1;
    context.beginPath();

    musicPeaks.forEach((peak, index) => {
      const x = (index / Math.max(1, musicPeaks.length - 1)) * width;
      const halfHeight = Math.max(1, peak * (height * 0.42));

      context.moveTo(x, height / 2 - halfHeight);
      context.lineTo(x, height / 2 + halfHeight);
    });

    context.stroke();
  } else {
    context.fillStyle = "#777777";
    context.font = "12px system-ui, sans-serif";
    context.fillText("音楽を読み込むと波形が表示されます", 12, 31);
  }

  drawGridOnCanvas(context, width, height);
  drawPlayheadOnCanvas(context, width, height);
}

function rebuildWaveformPeaksForCanvas(): void {
  if (!musicChannelData) {
    return;
  }

  const targetResolution = getWaveformResolutionForCanvas();

  if (musicPeakResolution === targetResolution && musicPeaks.length === targetResolution) {
    return;
  }

  musicPeaks = buildPeaksFromChannelData(musicChannelData, targetResolution);
  musicPeakResolution = targetResolution;
}

function getWaveformResolutionForCanvas(): number {
  const deviceScale = Math.min(2, Math.max(1, window.devicePixelRatio || 1));

  return Math.round(clamp(waveformCanvas.width * deviceScale, minWaveformResolution, maxWaveformResolution));
}

function buildPeaksFromChannelData(channelData: Float32Array, resolution: number): number[] {
  const peaks: number[] = [];
  const safeResolution = Math.max(1, resolution);

  for (let bucket = 0; bucket < safeResolution; bucket += 1) {
    let peak = 0;
    const start = Math.floor((bucket / safeResolution) * channelData.length);
    const end = Math.max(start + 1, Math.floor(((bucket + 1) / safeResolution) * channelData.length));

    for (let index = start; index < end && index < channelData.length; index += 1) {
      peak = Math.max(peak, Math.abs(channelData[index] ?? 0));
    }

    peaks.push(peak);
  }

  return peaks;
}

function renderGridLines(parent: HTMLElement, mode: "track"): void {
  void mode;
  const gridLines = getGridLinePositions();

  for (const line of gridLines) {
    const element = document.createElement("div");
    element.className = `beat-grid-line ${line.isMeasure ? "is-measure" : ""}`;
    element.style.left = `${line.ratio * 100}%`;
    parent.appendChild(element);
  }
}

function drawGridOnCanvas(context: CanvasRenderingContext2D, width: number, height: number): void {
  for (const line of getGridLinePositions()) {
    const x = line.ratio * width;
    context.strokeStyle = line.isMeasure ? "rgba(255, 255, 255, 0.38)" : "rgba(255, 255, 255, 0.14)";
    context.lineWidth = line.isMeasure ? 1.5 : 1;
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, height);
    context.stroke();
  }
}

function drawPlayheadOnCanvas(context: CanvasRenderingContext2D, width: number, height: number): void {
  const x = (clock.time / pattern.duration) * width;
  context.strokeStyle = "#ffffff";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(x, 0);
  context.lineTo(x, height);
  context.stroke();
}

function getGridLinePositions(): Array<{ time: number; ratio: number; isMeasure: boolean }> {
  const settings = pattern.timeline;
  const beatInterval = 60 / Math.max(1, settings.bpm);
  const lines: Array<{ time: number; ratio: number; isMeasure: boolean }> = [];

  if (!Number.isFinite(beatInterval) || beatInterval <= 0) {
    return lines;
  }

  let beatIndex = 0;
  let time = settings.musicOffset;

  while (time < 0) {
    beatIndex += 1;
    time = settings.musicOffset + beatInterval * beatIndex;
  }

  for (; time <= pattern.duration; beatIndex += 1, time = settings.musicOffset + beatInterval * beatIndex) {
    lines.push({
      time,
      ratio: clamp(time / pattern.duration, 0, 1),
      isMeasure: beatIndex % Math.max(1, settings.beatsPerMeasure) === 0,
    });
  }

  return lines;
}

function deleteSelectedEvent(): void {
  const selectedEvents = getSelectedEvents();

  if (selectedEvents.length === 0) {
    return;
  }

  const deletedIds = new Set<string>();
  const deletedIndex = Math.min(...selectedEvents.map((selectedEvent) => pattern.events.findIndex((event) => event.id === selectedEvent.id)).filter((index) => index >= 0));

  pushHistory();
  for (const selectedEvent of selectedEvents) {
    deletedIds.add(selectedEvent.id);

    if (isAttackPackageEvent(selectedEvent)) {
      for (const child of getPackageChildren(selectedEvent)) {
        deletedIds.add(child.id);
      }
    }
  }

  pattern.events = pattern.events.filter((event) => !deletedIds.has(event.id));

  if (editingEventId && deletedIds.has(editingEventId)) {
    editingEventId = null;
  }

  selectSingleEvent(pattern.events[Math.min(deletedIndex, pattern.events.length - 1)]?.id ?? null);
  renderEverything();
}

function copySelectedEvent(): void {
  const selectedEvents = getClipboardSourceEvents();

  if (selectedEvents.length === 0) {
    return;
  }

  copiedEvents = selectedEvents.map((event) => structuredClone(event));
  copiedEventsAnchorTime = Math.min(...copiedEvents.map((event) => event.startTime));
  copyStatusText = buildCopyStatusText(copiedEvents);

  if (navigator.clipboard) {
    void navigator.clipboard.writeText(copyStatusText).catch(() => {
      // Browser clipboard permission is optional; the internal editor clipboard still works.
    });
  }

  renderEventList();
}

function pasteCopiedEvent(): void {
  if (copiedEvents.length === 0) {
    return;
  }

  const pastedEvents: AttackEvent[] = [];
  const reservedNames = new Set(pattern.events.map((event) => event.name));
  const pasteBaseTime = clamp(clock.time, 0, pattern.duration);

  pushHistory();

  for (const copiedEvent of copiedEvents) {
    const event = structuredClone(copiedEvent);

    event.id = createCopiedEventId(event.id);
    event.name = getNextCopiedEventName(event.name, reservedNames);
    event.startTime = Number(clamp(pasteBaseTime + (copiedEvent.startTime - copiedEventsAnchorTime), 0, pattern.duration).toFixed(2));
    ensureEventEditorFields(event);
    pastedEvents.push(event);

    if (isAttackPackageEvent(event)) {
      event.packageId = undefined;
      event.packageLocked = undefined;
      event.seed = createCopiedPackageSeed(event.seed);
      event.generatedEventIds = [];
      pattern.events.push(event, ...createGeneratedEventsForPackage(event, pattern.stage));
    } else {
      event.packageId = undefined;
      event.packageLocked = undefined;
      pattern.events.push(event);
    }
  }

  selectedEventIds = new Set(pastedEvents.map((event) => event.id));
  selectedEventId = pastedEvents[pastedEvents.length - 1]?.id ?? null;
  activeInspectorTab = pastedEvents.length === 1 && isAttackPackageEvent(pastedEvents[0]) ? "package" : activeInspectorTab;
  sortEvents();
  renderEverything();
}

function getClipboardSourceEvents(): AttackEvent[] {
  return getSelectedEvents()
    .filter((event) => !(event.packageId && selectedEventIds.has(event.packageId)))
    .sort((a, b) => a.startTime - b.startTime);
}

function buildCopyStatusText(events: AttackEvent[]): string {
  const labels = events.map((event) => {
    const parentPackage = getParentPackage(event);
    const seed = isAttackPackageEvent(event) ? event.seed : parentPackage?.seed;

    return seed ? `${event.name} seed=${seed}` : event.name;
  });

  return `Copied ${events.length}: ${labels.join(", ")}`;
}

function createCopiedEventId(baseId: string): string {
  return `${baseId}_copy_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function createCopiedPackageSeed(previousSeed: number): number {
  const seed = Math.floor(1000 + Math.random() * 900000);

  return seed === previousSeed ? ((seed % 999999) + 1) : seed;
}

function getNextCopiedEventName(name: string, reservedNames: Set<string>): string {
  const baseName = name.replace(/\s+\(\d+\)$/u, "").replace(/\s+Copy$/u, "");
  let index = 1;
  let nextName = `${baseName} (${index})`;

  while (reservedNames.has(nextName)) {
    index += 1;
    nextName = `${baseName} (${index})`;
  }

  reservedNames.add(nextName);
  return nextName;
}

function sortEvents(): void {
  pattern.events.sort((a, b) => a.startTime - b.startTime);
}

function getSelectedPackageEvent(): AttackPackageEvent | undefined {
  const selectedEvent = getSelectedEvent();

  return isAttackPackageEvent(selectedEvent) ? selectedEvent : getParentPackage(selectedEvent);
}

function getParentPackage(event: AttackEvent | undefined): AttackPackageEvent | undefined {
  if (!event?.packageId) {
    return undefined;
  }

  return pattern.events.find((candidate): candidate is AttackPackageEvent => candidate.id === event.packageId && isAttackPackageEvent(candidate));
}

function getPackageChildren(packageEvent: AttackPackageEvent): AttackEvent[] {
  const order = new Map(packageEvent.generatedEventIds.map((id, index) => [id, index]));

  return pattern.events
    .filter((event) => event.packageId === packageEvent.id)
    .sort((a, b) => (order.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (order.get(b.id) ?? Number.MAX_SAFE_INTEGER));
}

function refreshPackageGeneratedEvents(packageEvent: AttackPackageEvent): void {
  if (!canGeneratePackageEvents(packageEvent)) {
    return;
  }

  let generatedEvents: AttackEvent[];

  try {
    generatedEvents = createGeneratedEventsForPackage(packageEvent, pattern.stage);
  } catch (error) {
    console.error(error);
    window.alert("パッケージを再生成できませんでした。設定または .mjs コードを確認してください。");
    return;
  }

  pattern.events = pattern.events.filter((event) => event.packageId !== packageEvent.id);
  pattern.events.push(...generatedEvents);
  sortEvents();
}

function ensurePackageChildren(): void {
  const generatedEvents: AttackEvent[] = [];

  for (const event of pattern.events) {
    if (!isAttackPackageEvent(event)) {
      continue;
    }

    if (!canGeneratePackageEvents(event)) {
      continue;
    }

    const childCount = pattern.events.filter((candidate) => candidate.packageId === event.id).length;

    if (childCount === 0) {
      try {
        generatedEvents.push(...createGeneratedEventsForPackage(event, pattern.stage));
      } catch (error) {
        console.error(error);
      }
    }
  }

  if (generatedEvents.length > 0) {
    pattern.events.push(...generatedEvents);
    sortEvents();
  }
}

function isParentPackageVisible(event: AttackEvent): boolean {
  const parent = getParentPackage(event);

  return parent ? isEventVisible(parent) : true;
}

function allKinds(): AttackEventKind[] {
  return [
    "spawn_bullet",
    "spawn_bullet_spread",
    "spawn_aimed_spread",
    "spawn_radial",
    "spawn_enemy_origin",
    "fire_from_moving_origin",
    "spawn_curved_laser",
    "transform_bullet",
    "radialBurst",
    "aimedSpread",
    "bossMirroredFan",
    "polynomialProjectile",
    "curvedLaserRing",
    "warningZone",
    "movingBlock",
    "beatPulseRing",
    "closingWalls",
    "safeLaneShift",
    "wallSweep",
    "laserBeam",
    "rotatingShape",
    ...getAvailablePackageKinds(),
  ];
}

function unityMotionKinds(): AttackEventKind[] {
  return [
    "spawn_bullet",
    "spawn_bullet_spread",
    "spawn_aimed_spread",
    "spawn_radial",
    "spawn_enemy_origin",
    "fire_from_moving_origin",
    "spawn_curved_laser",
  ];
}

function eventKindLabel(kind: AttackEventKind): string {
  if (isAttackPackageKind(kind)) {
    return getPackageKindLabel(kind);
  }

  switch (kind) {
    case "spawn_bullet":
      return "単発/図形弾";
    case "spawn_bullet_spread":
      return "扇状連射";
    case "spawn_aimed_spread":
      return "自機狙い";
    case "spawn_radial":
      return "円形バースト";
    case "spawn_enemy_origin":
      return "移動発生源";
    case "fire_from_moving_origin":
      return "移動源連射";
    case "spawn_curved_laser":
      return "カーブレーザー";
    case "transform_bullet":
      return "弾変化キュー";
    case "radialBurst":
      return "円形弾幕";
    case "aimedSpread":
      return "自機狙い扇弾";
    case "bossMirroredFan":
      return "ミラーファン";
    case "polynomialProjectile":
      return "多項式軌道弾";
    case "curvedLaserRing":
      return "カーブレーザー";
    case "warningZone":
      return "予告ゾーン";
    case "movingBlock":
      return "移動ブロック";
    case "beatPulseRing":
      return "拍動リング";
    case "closingWalls":
      return "迫る外壁";
    case "safeLaneShift":
      return "安全レーン";
    case "wallSweep":
      return "壁スイープ";
    case "laserBeam":
      return "レーザー";
    case "rotatingShape":
      return "回転図形";
  }
}

function formatColor(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function parseColorInput(value: string, fallback: number): number {
  const parsed = Number.parseInt(value.replace("#", ""), 16);

  return Number.isFinite(parsed) ? parsed : fallback;
}

function hasMusic(): boolean {
  return Boolean(audio.src) && Number.isFinite(audio.duration) && audio.duration > 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function isEditingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
}

function requireElement<TElement extends Element>(selector: string): TElement {
  const element = document.querySelector<TElement>(selector);

  if (!element) {
    throw new Error(`Required UI element was not found: ${selector}`);
  }

  return element;
}

function iconSvg(name: string): string {
  const paths: Record<string, string> = {
    play: '<polygon points="8 5 19 12 8 19 8 5"></polygon>',
    stop: '<rect x="7" y="7" width="10" height="10" rx="1"></rect>',
    dot: '<circle cx="12" cy="12" r="5"></circle>',
    reset: '<path d="M3 12a9 9 0 1 0 3-6.7"></path><path d="M3 4v6h6"></path>',
    rewind: '<polygon points="11 6 4 12 11 18 11 6"></polygon><polygon points="20 6 13 12 20 18 20 6"></polygon>',
    undo: '<path d="M9 7H4v5"></path><path d="M4 12a8 8 0 1 0 2.3-5.7L4 8.6"></path>',
    redo: '<path d="M15 7h5v5"></path><path d="M20 12a8 8 0 1 1-2.3-5.7L20 8.6"></path>',
    magnet: '<path d="M6 3v8a6 6 0 0 0 12 0V3"></path><path d="M10 3v8a2 2 0 0 0 4 0V3"></path><path d="M5 3h6"></path><path d="M13 3h6"></path><path d="M5 7h6"></path><path d="M13 7h6"></path>',
    list: '<path d="M8 6h12"></path><path d="M8 12h12"></path><path d="M8 18h12"></path><circle cx="4" cy="6" r="1"></circle><circle cx="4" cy="12" r="1"></circle><circle cx="4" cy="18" r="1"></circle>',
    sliders: '<path d="M4 6h8"></path><path d="M16 6h4"></path><circle cx="14" cy="6" r="2"></circle><path d="M4 12h3"></path><path d="M11 12h9"></path><circle cx="9" cy="12" r="2"></circle><path d="M4 18h11"></path><path d="M19 18h1"></path><circle cx="17" cy="18" r="2"></circle>',
    target: '<circle cx="12" cy="12" r="7"></circle><circle cx="12" cy="12" r="2"></circle><path d="M12 2v3"></path><path d="M12 19v3"></path><path d="M2 12h3"></path><path d="M19 12h3"></path>',
    fan: '<path d="M12 20V4"></path><path d="M5 17c2-5 4.3-8.3 7-10"></path><path d="M19 17c-2-5-4.3-8.3-7-10"></path><path d="M4 20h16"></path>',
    curve: '<path d="M4 17c4-12 8 12 16-2"></path><path d="M4 21h16"></path>',
    burst: '<path d="M12 3v5"></path><path d="M12 16v5"></path><path d="M3 12h5"></path><path d="M16 12h5"></path><path d="m5.6 5.6 3.5 3.5"></path><path d="m14.9 14.9 3.5 3.5"></path><path d="m18.4 5.6-3.5 3.5"></path><path d="m9.1 14.9-3.5 3.5"></path>',
    warning: '<path d="M12 3 2 21h20L12 3z"></path><path d="M12 9v5"></path><path d="M12 17h.01"></path>',
    block: '<rect x="5" y="6" width="14" height="12" rx="1"></rect><path d="M3 12h4"></path><path d="M17 12h4"></path>',
    pulse: '<circle cx="12" cy="12" r="3"></circle><circle cx="12" cy="12" r="8"></circle><path d="M12 1v3"></path><path d="M12 20v3"></path>',
    collapse: '<path d="M4 5v14"></path><path d="M20 5v14"></path><path d="m9 8 3 4-3 4"></path><path d="m15 8-3 4 3 4"></path>',
    lane: '<rect x="4" y="4" width="16" height="16" rx="1"></rect><path d="M9 4v16"></path><path d="M15 4v16"></path>',
    download: '<path d="M12 3v12"></path><path d="m7 10 5 5 5-5"></path><path d="M5 21h14"></path>',
    upload: '<path d="M12 21V9"></path><path d="m7 14 5-5 5 5"></path><path d="M5 3h14"></path>',
    sparkles: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z"></path><path d="M5 15l.8 2.2L8 18l-2.2.8L5 21l-.8-2.2L2 18l2.2-.8L5 15z"></path><path d="M19 3l.6 1.6L21 5l-1.4.4L19 7l-.6-1.6L17 5l1.4-.4L19 3z"></path>',
    trash: '<path d="M3 6h18"></path><path d="M8 6V4h8v2"></path><path d="M19 6l-1 15H6L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path>',
    music: '<path d="M9 18V5l11-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="17" cy="16" r="3"></circle>',
    box: '<path d="M21 8 12 3 3 8l9 5 9-5z"></path><path d="M3 8v8l9 5 9-5V8"></path><path d="M12 13v8"></path>',
    package: '<path d="M16 3h5v5"></path><path d="M8 3H3v5"></path><path d="M3 16v5h5"></path><path d="M21 16v5h-5"></path><rect x="8" y="8" width="8" height="8" rx="1"></rect>',
    volume: '<path d="M4 10v4h4l5 4V6l-5 4H4z"></path><path d="M16 9c1 .8 1.5 1.8 1.5 3s-.5 2.2-1.5 3"></path><path d="M18.5 6.5A8 8 0 0 1 21 12a8 8 0 0 1-2.5 5.5"></path>',
    eye: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"></path><circle cx="12" cy="12" r="3"></circle>',
    eyeOff: '<path d="M3 3l18 18"></path><path d="M10.6 10.6A2 2 0 0 0 12 14a2 2 0 0 0 1.4-.6"></path><path d="M9.8 5.4A10.7 10.7 0 0 1 12 5c6.5 0 10 7 10 7a18 18 0 0 1-3.3 4.2"></path><path d="M6.6 6.8C3.7 8.7 2 12 2 12s3.5 7 10 7c1.3 0 2.5-.3 3.6-.7"></path>',
    route: '<circle cx="5" cy="6" r="2"></circle><circle cx="19" cy="18" r="2"></circle><path d="M7 6h4a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h8"></path>',
    rows: '<path d="M4 6h16"></path><path d="M4 12h16"></path><path d="M4 18h16"></path><path d="M8 3v18"></path>',
    circle: '<circle cx="12" cy="12" r="7"></circle><path d="M12 2v3"></path><path d="M12 19v3"></path><path d="M2 12h3"></path><path d="M19 12h3"></path>',
    wall: '<path d="M4 5h16v14H4z"></path><path d="M4 10h16"></path><path d="M9 5v5"></path><path d="M15 10v9"></path>',
    laser: '<path d="M4 12h16"></path><path d="m16 8 4 4-4 4"></path><path d="M4 8v8"></path>',
    rotate: '<path d="M21 12a9 9 0 1 1-3-6.7"></path><path d="M21 4v6h-6"></path>',
    scatter: '<circle cx="6" cy="12" r="2"></circle><circle cx="14" cy="7" r="1.7"></circle><circle cx="17" cy="15" r="1.7"></circle><path d="M8 11 18 5"></path><path d="M8 13l12 6"></path>',
    laserRows: '<path d="M4 7h16"></path><path d="M4 12h16"></path><path d="M4 17h16"></path><path d="m17 4 3 3-3 3"></path><path d="m17 14 3 3-3 3"></path>',
    bomb: '<circle cx="11" cy="13" r="7"></circle><path d="M15.5 7.5 19 4"></path><path d="M18 4h3v3"></path><path d="M8 13h6"></path><path d="M11 10v6"></path>',
    circleArea: '<circle cx="12" cy="12" r="7"></circle><circle cx="12" cy="12" r="3"></circle><path d="M5 5 3 3"></path><path d="M19 5l2-2"></path><path d="M5 19l-2 2"></path><path d="M19 19l2 2"></path>',
    grid: '<rect x="4" y="4" width="16" height="16" rx="1"></rect><path d="M4 10h16"></path><path d="M4 16h16"></path><path d="M10 4v16"></path><path d="M16 4v16"></path>',
    splitBurst: '<circle cx="7" cy="12" r="2"></circle><path d="M9 12h4"></path><circle cx="17" cy="7" r="2"></circle><circle cx="17" cy="17" r="2"></circle><path d="M13 12 16 8.5"></path><path d="M13 12l3 3.5"></path>',
    laserScatter: '<path d="M4 19 20 5"></path><path d="M3 10h10"></path><path d="M11 21h10"></path><path d="M17 3h4v4"></path>',
    radialLaser: '<circle cx="12" cy="12" r="2"></circle><path d="M12 2v6"></path><path d="M12 16v6"></path><path d="M2 12h6"></path><path d="M16 12h6"></path><path d="m4.9 4.9 4.2 4.2"></path><path d="m14.9 14.9 4.2 4.2"></path><path d="m19.1 4.9-4.2 4.2"></path><path d="m9.1 14.9-4.2 4.2"></path>',
    areaParallel: '<rect x="4" y="6" width="16" height="12" rx="1"></rect><path d="M7 10h10"></path><path d="M7 14h10"></path><path d="m15 8 2 2-2 2"></path><path d="m15 12 2 2-2 2"></path>',
    snake: '<path d="M4 16c3-8 6 8 9 0s4-8 7-2"></path><rect x="3" y="14" width="4" height="4" rx="1"></rect><rect x="17" y="10" width="4" height="4" rx="1"></rect>',
    enterExit: '<path d="M4 6v12"></path><path d="M20 6v12"></path><path d="M7 12h10"></path><path d="m14 8 4 4-4 4"></path>',
    rotatingLaser: '<path d="M12 12h9"></path><path d="M12 12l-7 5"></path><path d="M12 12 6 5"></path><circle cx="12" cy="12" r="2"></circle><path d="M21 8a9 9 0 0 0-13-5"></path><path d="M7 2h4v4"></path>',
    sequentialLaser: '<path d="M5 6h14"></path><path d="M5 12h14"></path><path d="M5 18h14"></path><circle cx="5" cy="6" r="1.5"></circle><circle cx="9" cy="12" r="1.5"></circle><circle cx="13" cy="18" r="1.5"></circle>',
  };

  return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${paths[name] ?? ""}</svg>`;
}
