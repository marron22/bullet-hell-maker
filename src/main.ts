import "./styles.css";
import { defaultAttackColor } from "./core/colors";
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
import type { AttackEvent, AttackEventKind, AttackFrame, AttackPackageEvent, AttackPackageKind, BulletPattern, CurvedLaserRender, DifficultyId, EventDifficultySettings, HazardRender, LaserRender, PreviewImageAsset, ShapeRender, SpawnEnemyOriginEvent, TimelineSettings, WallRender } from "./core/types";
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

interface ProjectPreviewSettings {
  bulletTexture?: PreviewImageAsset | null;
}

interface BulletTextureTypeNameEntry {
  key: string;
  asset: PreviewImageAsset;
  typeName: string;
  packageEvents: AttackPackageEvent[];
}

interface ZipTextFile {
  name: string;
  data: string;
}

type ProjectPatternFile = Partial<BulletPattern> & {
  music?: ProjectMusicAsset | null;
  customPackages?: ProjectCustomPackageAsset[];
  preview?: ProjectPreviewSettings | null;
};

type AiBeatmapDraftFile = {
  format?: string;
  version?: number;
  title?: string;
  duration?: number;
  timeline?: unknown;
  events?: unknown[];
};

type PreviewEventWindow = {
  event: AttackEvent;
  activeStartTime: number;
  activeEndTime: number;
};

const appVersion = "v0.28";
const previewTextureScaleMin = 0.1;
const previewTextureScaleMax = 50;
const defaultUnityBulletTypeName = "normal";
let pattern = createStarterPattern();
let activeDifficultyId: DifficultyId = pattern.activeDifficulty ?? "normal";
const clock = new PlaybackClock();
let selectedEventId: string | null = pattern.events[0]?.id ?? null;
let selectedEventIds = new Set<string>(selectedEventId ? [selectedEventId] : []);
let bulkEditPackageId: string | null = null;
let timelineDragging = false;
let markerDraggingId: string | null = null;
let markerDragMoved = false;
let markerDragStartX = 0;
let markerDragOriginalTime = 0;
let markerDragOriginalTimes = new Map<string, number>();
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
let projectTitleEditHistoryRecorded = false;
let snapToMeasures = false;
let propertyTimeMode: "seconds" | "beats" = "seconds";
let editingEventId: string | null = null;
let activeInspectorTab: "events" | "package" | "properties" | "textures" | "music" = "events";
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
let packageTextureTargetId: string | null = null;
let enemyTextureTargetId: string | null = null;
let previewEventWindows: PreviewEventWindow[] | null = null;
let difficultyAdjustedPreviewEvents: AttackEvent[] | null = null;
let lastPreviewWaveformRenderTime = 0;
let previewLightweightEnabled = true;
let previewTimelineVisible = true;

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
const previewEventTimePadding = 0.04;
const previewWaveformRenderIntervalMs = 1000 / 12;
const playerHitSize = 12;
const previewMoveSpeed = 375;
const previewDashSpeed = 1120;
const previewDashDuration = 0.13;
const previewDashCooldown = 0.34;
const previewDashAcceleration = 34;
const previewMoveAcceleration = 28;
const previewStopDamping = 22;
const minimumTimelineLaneCount = 1;
const maximumTimelineLaneCount = 12;
const difficultyIds = ["easy", "normal", "lunatic"] as const;
const difficultyLabels: Record<DifficultyId, string> = {
  easy: "Easy",
  normal: "Normal",
  lunatic: "Lunatic",
};
const countDifficultyFields = [
  "clipCount",
  "radialCount",
  "laserCount",
  "bulletCount",
  "wayCount",
  "angleCount",
  "speedLayers",
  "packageCount",
  "packageBulletCount",
] as const;
const warningDifficultyFields = ["warningTime", "enemyWarningTime", "packageWarningTime"] as const;
const nonNegativeSpeedDifficultyFields = [
  "pathSpeed",
  "bulletSpeed",
  "minSpeed",
  "speedStep",
  "nextSpeed",
  "growSpeed",
  "extendSpeed",
  "packageSpeed",
  "packageSplitSpeed",
] as const;
const signedSpeedDifficultyFields = [
  "polarRadiusVelocity",
  "polarThetaVelocity",
  "angleSpeed",
  "thetaVelocity",
  "rotationSpeed",
  "packageRotationSpeed",
] as const;
const previewPlayerVelocity = { x: 0, y: 0 };
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
  "enemyWarningTime",
  "enemyEnterTime",
  "enemyExitTime",
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
  { label: "enemyStart", fields: ["enemyStartX", "enemyStartY"] },
  { label: "enemyEnterEnd", fields: ["enemyEnterEndX", "enemyEnterEndY"] },
  { label: "enemyEnd", fields: ["enemyEndX", "enemyEndY"] },
  { label: "polynomial", fields: ["polynomialD", "polynomialC", "polynomialB", "polynomialA"] },
];

const propertyGroups: PropertyGroupConfig[] = [
  { title: "Timing", numberFields: ["startTime", "duration", "warningTime", "warningAlpha"] },
  { title: "Fire", checkboxFields: ["aimAtPlayer"], numberFields: ["clipCount", "clipRepeat", "clipInterval", "angleStepDeg", "baseAngleDeg"] },
  { title: "Origin", numberFields: ["originX", "originY", "originVx", "originVy"] },
  { title: "Trajectory", numberFields: ["pathStartX", "pathSpeed", "polynomialA", "polynomialB", "polynomialC", "polynomialD", "gravity"] },
  { title: "Polar", numberFields: ["polarRadius", "polarRadiusVelocity", "polarTheta", "polarThetaVelocity"] },
  { title: "Enemy Preview", numberFields: ["enemyStartX", "enemyStartY", "enemyEnterEndX", "enemyEnterEndY", "enemyEndX", "enemyEndY", "enemyAngle", "enemyWarningTime", "enemyEnterTime", "enemyExitTime", "originSize", "previewEnemyTextureScale"], includeColor: true },
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
  { name: "originSize", label: "敵サイズ", min: 4, max: 240, step: 1, kinds: ["spawn_enemy_origin"] },
  { name: "enemyWarningTime", label: "敵予告時間", min: 0, max: 5, step: 0.05, kinds: ["spawn_enemy_origin"] },
  { name: "enemyStartX", label: "出現開始X", min: -1000, max: 2000, step: 1, kinds: ["spawn_enemy_origin"] },
  { name: "enemyStartY", label: "出現開始Y", min: -1000, max: 2000, step: 1, kinds: ["spawn_enemy_origin"] },
  { name: "enemyEnterEndX", label: "出現完了X", min: -1000, max: 2000, step: 1, kinds: ["spawn_enemy_origin"] },
  { name: "enemyEnterEndY", label: "出現完了Y", min: -1000, max: 2000, step: 1, kinds: ["spawn_enemy_origin"] },
  { name: "enemyEndX", label: "消滅X", min: -1000, max: 2000, step: 1, kinds: ["spawn_enemy_origin"] },
  { name: "enemyEndY", label: "消滅Y", min: -1000, max: 2000, step: 1, kinds: ["spawn_enemy_origin"] },
  { name: "enemyAngle", label: "敵表示角度", min: -720, max: 720, step: 5, kinds: ["spawn_enemy_origin"] },
  { name: "enemyEnterTime", label: "出現時間", min: 0.01, max: 5, step: 0.05, kinds: ["spawn_enemy_origin"] },
  { name: "enemyExitTime", label: "消える時間", min: 0.01, max: 5, step: 0.05, kinds: ["spawn_enemy_origin"] },
  { name: "previewEnemyTextureScale", label: "敵テクスチャ倍率", min: previewTextureScaleMin, max: previewTextureScaleMax, step: 0.05, kinds: ["spawn_enemy_origin"] },
  { name: "previewEnemyTextureAngle", label: "敵テクスチャ角度", min: -720, max: 720, step: 5, kinds: ["spawn_enemy_origin"] },
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
  enemyStartX: "敵が出現し始めるX位置です。",
  enemyStartY: "敵が出現し始めるY位置です。",
  enemyEnterEndX: "敵の出現アニメーションが止まるX位置です。",
  enemyEnterEndY: "敵の出現アニメーションが止まるY位置です。",
  enemyEndX: "敵が消えるときに向かうX位置です。",
  enemyEndY: "敵が消えるときに向かうY位置です。",
  enemyAngle: "敵プレビューの見た目の角度です。",
  enemyWarningTime: "敵が出現する前に開始位置へ表示する予告時間です。",
  enemyEnterTime: "敵がびよんと大きくなって出てくる時間です。",
  enemyExitTime: "敵がひゅんと小さくなって消える時間です。",
  originSize: "敵プレビューの基準サイズです。",
  previewEnemyTextureScale: "敵テクスチャをプレビューで表示するときの倍率です。",
  previewEnemyTextureAngle: "敵テクスチャだけに加える表示角度です。",
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
        <input id="project-title-input" class="project-title-input" type="text" value="${escapeHtml(pattern.title)}" aria-label="プロジェクトタイトル" spellcheck="false" />
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
              <button class="menu-item" type="button" data-add-kind="spawn_enemy_origin">${iconSvg("enemy")}<span>敵プレビュー</span></button>
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
      <div class="difficulty-toggle" role="group" aria-label="難易度">
        ${difficultyIds.map((difficulty) => `<button class="difficulty-toggle-button ${difficulty === activeDifficultyId ? "is-active" : ""}" type="button" data-difficulty-id="${difficulty}">${difficultyLabels[difficulty]}</button>`).join("")}
      </div>
      <div class="preview-options" aria-label="プレビュー設定">
        <button id="preview-lightweight-toggle-button" class="preview-option-button is-active" type="button" aria-pressed="true" title="プレビューの軽量化">${iconSvg("pulse")}<span>軽量</span></button>
        <button id="preview-timeline-toggle-button" class="preview-option-button is-active" type="button" aria-pressed="true" title="タイムライン表示">${iconSvg("eye")}<span>タイムライン</span></button>
      </div>
      <div class="hidden-inputs">
        <input id="import-input" type="file" accept="application/json,.json" hidden />
        <input id="ai-beatmap-input" type="file" accept="application/json,.json" hidden />
        <input id="package-code-input" type="file" accept=".mjs,text/javascript,application/javascript" hidden />
        <input id="package-bullet-texture-input" type="file" accept="image/*" hidden />
        <input id="enemy-preview-texture-input" type="file" accept="image/*" hidden />
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
document.querySelector<HTMLElement>("#export-unity-button")?.insertAdjacentHTML(
  "afterend",
  `<button id="export-unity-all-button" class="menu-item" type="button">${iconSvg("archive")}<span>全難易度Unity ZIP</span></button>`,
);
document.querySelector<HTMLElement>(".inspector-panel")?.insertAdjacentHTML("afterbegin", '<div id="inspector-resize-handle" class="inspector-resize-handle" aria-hidden="true"></div>');
document.querySelector<HTMLElement>(".inspector-tabs")?.children[0]?.insertAdjacentHTML(
  "afterend",
  `<button class="inspector-tab-button" type="button" data-inspector-tab="package" role="tab" aria-selected="false">${iconSvg("box")}<span>パッケージ</span></button>`,
);
document.querySelector<HTMLElement>("[data-inspector-tab='package']")?.insertAdjacentHTML(
  "afterend",
  `<button class="inspector-tab-button" type="button" data-inspector-tab="textures" role="tab" aria-selected="false">${iconSvg("image")}<span>テクスチャ</span></button>`,
);
document.querySelector<HTMLElement>("#events-tab-panel")?.insertAdjacentHTML(
  "afterend",
  '<section id="package-tab-panel" class="inspector-tab-panel" data-inspector-panel="package" role="tabpanel" hidden><div id="package-panel" class="package-panel"></div></section>',
);
document.querySelector<HTMLElement>("#package-tab-panel")?.insertAdjacentHTML(
  "afterend",
  '<section id="textures-tab-panel" class="inspector-tab-panel texture-type-panel" data-inspector-panel="textures" role="tabpanel" hidden><div id="texture-type-name-panel" class="texture-type-name-panel"></div></section>',
);
document.querySelector<HTMLElement>(".timeline-panel")?.insertAdjacentHTML("afterbegin", '<div id="timeline-resize-handle" class="timeline-resize-handle" aria-hidden="true"></div>');

const previewHost = requireElement<HTMLDivElement>("#preview-host");
const previewPanel = requireElement<HTMLElement>(".preview-panel");
const trajectoryModeNotice = requireElement<HTMLDivElement>("#trajectory-mode-notice");
const appShell = requireElement<HTMLDivElement>(".app-shell");
const projectTitleInput = requireElement<HTMLInputElement>("#project-title-input");
const playButton = requireElement<HTMLButtonElement>("#play-button");
const resetButton = requireElement<HTMLButtonElement>("#reset-button");
const previewLightweightToggleButton = requireElement<HTMLButtonElement>("#preview-lightweight-toggle-button");
const previewTimelineToggleButton = requireElement<HTMLButtonElement>("#preview-timeline-toggle-button");
const exportButton = requireElement<HTMLButtonElement>("#export-button");
const exportUnityButton = requireElement<HTMLButtonElement>("#export-unity-button");
const exportUnityAllButton = requireElement<HTMLButtonElement>("#export-unity-all-button");
const importButton = requireElement<HTMLButtonElement>("#import-button");
const importAiBeatmapButton = requireElement<HTMLButtonElement>("#import-ai-beatmap-button");
const importPackageButton = requireElement<HTMLButtonElement>("#import-package-button");
const musicButton = requireElement<HTMLButtonElement>("#music-button");
const undoButton = requireElement<HTMLButtonElement>("#undo-button");
const redoButton = requireElement<HTMLButtonElement>("#redo-button");
const importInput = requireElement<HTMLInputElement>("#import-input");
const aiBeatmapInput = requireElement<HTMLInputElement>("#ai-beatmap-input");
const packageCodeInput = requireElement<HTMLInputElement>("#package-code-input");
const packageBulletTextureInput = requireElement<HTMLInputElement>("#package-bullet-texture-input");
const enemyPreviewTextureInput = requireElement<HTMLInputElement>("#enemy-preview-texture-input");
const musicInput = requireElement<HTMLInputElement>("#music-input");
const timeDisplay = requireElement<HTMLDivElement>("#time-display");
const musicDisplay = requireElement<HTMLDivElement>("#music-display");
const eventList = requireElement<HTMLDivElement>("#event-list");
const packagePanel = requireElement<HTMLDivElement>("#package-panel");
const textureTypeNamePanel = requireElement<HTMLDivElement>("#texture-type-name-panel");
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
const difficultyButtons = [...document.querySelectorAll<HTMLButtonElement>("[data-difficulty-id]")];

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

    if (nextTab === "events" || nextTab === "package" || nextTab === "properties" || nextTab === "textures" || nextTab === "music") {
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

difficultyButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const difficultyId = button.dataset.difficultyId;

    if (!isDifficultyId(difficultyId) || difficultyId === activeDifficultyId) {
      return;
    }

    activeDifficultyId = difficultyId;
    pattern.activeDifficulty = difficultyId;
    invalidatePreviewRenderCache();
    clearAimCache();
    renderEverything();
  });
});

previewLightweightToggleButton.addEventListener("click", () => {
  previewLightweightEnabled = !previewLightweightEnabled;
  invalidatePreviewRenderCache();
  syncUi();
  renderPreview();
  renderWaveformForTick();
});

previewTimelineToggleButton.addEventListener("click", () => {
  previewTimelineVisible = !previewTimelineVisible;
  syncUi();
  resizePreviewHost();
  renderPreview();

  if (previewTimelineVisible) {
    resizeTimelineToViewport();
    renderWaveform();
  }
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

exportUnityAllButton.addEventListener("click", () => {
  closeMenus();
  exportAllDifficultiesUnityZip();
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

projectTitleInput.addEventListener("focus", () => {
  projectTitleEditHistoryRecorded = false;
});

projectTitleInput.addEventListener("input", () => {
  if (projectTitleInput.value === pattern.title) {
    return;
  }

  if (!projectTitleEditHistoryRecorded) {
    pushHistory();
    projectTitleEditHistoryRecorded = true;
  }

  pattern.title = projectTitleInput.value;
  syncUi();
});

projectTitleInput.addEventListener("blur", () => {
  const nextTitle = projectTitleInput.value.trim() || "Untitled Pattern";

  if (nextTitle !== pattern.title) {
    if (!projectTitleEditHistoryRecorded) {
      pushHistory();
    }

    pattern.title = nextTitle;
  }

  projectTitleEditHistoryRecorded = false;
  projectTitleInput.value = pattern.title;
  syncUi();
});

projectTitleInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    projectTitleInput.blur();
  }
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

packageBulletTextureInput.addEventListener("change", () => {
  const file = packageBulletTextureInput.files?.[0];
  const packageEvent = getPackageEventById(packageTextureTargetId) ?? getSelectedPackageEvent();

  if (!file || !packageEvent) {
    packageBulletTextureInput.value = "";
    packageTextureTargetId = null;
    return;
  }

  void loadPackageBulletTexture(packageEvent, file);
  packageBulletTextureInput.value = "";
  packageTextureTargetId = null;
});

enemyPreviewTextureInput.addEventListener("change", () => {
  const file = enemyPreviewTextureInput.files?.[0];
  const enemyEvent = getEnemyEventById(enemyTextureTargetId) ?? getSelectedEnemyEvent();

  if (!file || !enemyEvent) {
    enemyPreviewTextureInput.value = "";
    enemyTextureTargetId = null;
    return;
  }

  void loadEnemyPreviewTexture(enemyEvent, file);
  enemyPreviewTextureInput.value = "";
  enemyTextureTargetId = null;
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
window.addEventListener("beforeunload", (event) => {
  event.preventDefault();
  event.returnValue = "";
});

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
  activeInspectorTab = "properties";
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

    if (isPreviewControlCode(event.code) || isPreviewDashKey(event)) {
      event.preventDefault();
      pressedPreviewKeys.add(event.code);

      if (isPreviewDashKey(event) && !event.repeat) {
        dashRequested = true;
      }

      return;
    }

    if (event.code === "Space") {
      event.preventDefault();
      if (!event.repeat) {
        togglePlayback();
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
  if (!isPreviewControlCode(event.code) && !isPreviewDashKey(event)) {
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

  const enemyTextureAction = target.dataset.enemyTextureAction;

  if (enemyTextureAction) {
    const enemyEvent = getSelectedEnemyEvent();

    if (!enemyEvent) {
      return;
    }

    if (enemyTextureAction === "load") {
      enemyTextureTargetId = enemyEvent.id;
      enemyPreviewTextureInput.click();
    } else if (enemyTextureAction === "clear") {
      clearEnemyPreviewTexture(enemyEvent);
    }
    return;
  }

  if (target.dataset.bulkEditClose) {
    bulkEditPackageId = null;
    activeInspectorTab = "package";
    renderEverything();
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
packagePanel.addEventListener("input", handlePackagePanelLiveInput);
packagePanel.addEventListener("change", handlePackagePanelInput);
packagePanel.addEventListener("click", handlePackagePanelClick);
packagePanel.addEventListener("dblclick", handlePackagePanelDoubleClick);
textureTypeNamePanel.addEventListener("change", handleTextureTypeNamePanelInput);
timelineResizeHandle.addEventListener("pointerdown", (event) => startLayoutResize("timeline", event));
inspectorResizeHandle.addEventListener("pointerdown", (event) => startLayoutResize("inspector", event));
document.addEventListener("pointermove", handleLayoutResizeMove);
document.addEventListener("pointerup", stopLayoutResize);
document.addEventListener("pointercancel", stopLayoutResize);

function handlePropertyUpdate(event: Event): void {
  const input = event.target;

  if (!(input instanceof HTMLInputElement || input instanceof HTMLSelectElement)) {
    return;
  }

  const bulkPackage = getBulkEditPackageEvent();

  if (bulkPackage && input.dataset.bulkEditField) {
    handleBulkPackagePropertyUpdate(bulkPackage, input);
    return;
  }

  const selectedEvent = getSelectedEvent();

  if (!selectedEvent) {
    return;
  }

  if (event.type === "change" && input instanceof HTMLInputElement) {
    return;
  }

  if (input.dataset.difficultyControl) {
    handleDifficultyControlInput(selectedEvent, input);
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
  invalidatePreviewRenderCache();
  renderPreview();
  syncUi();
}

function handleBulkPackagePropertyUpdate(packageEvent: AttackPackageEvent, input: HTMLInputElement | HTMLSelectElement): void {
  const childEvents = getPackageChildren(packageEvent);

  if (childEvents.length === 0) {
    return;
  }

  const bulkFieldType = input.dataset.bulkEditField;

  if (bulkFieldType === "color" && input instanceof HTMLInputElement) {
    const nextColor = parseColorInput(input.value, childEvents[0].color);

    if (childEvents.every((event) => event.color === nextColor)) {
      return;
    }

    pushHistory();
    for (const child of childEvents) {
      child.color = nextColor;
      child.packageLocked = false;
    }
  } else if (bulkFieldType === "select" && input instanceof HTMLSelectElement) {
    const configs = getCommonSelectFieldConfigs(childEvents);
    const firstConfig = configs.find((field) => field.name === input.name);

    if (!firstConfig || !input.value) {
      return;
    }

    if (childEvents.every((child) => {
      const config = getSelectConfigsFor(child).find((field) => field.name === input.name);
      return config && getSelectFieldValue(child, config) === input.value;
    })) {
      return;
    }

    pushHistory();
    for (const child of childEvents) {
      const config = getSelectConfigsFor(child).find((field) => field.name === input.name);

      if (config) {
        setSelectFieldValue(child, config, input.value);
        child.packageLocked = false;
      }
    }
  } else if (bulkFieldType === "checkbox" && input instanceof HTMLInputElement) {
    const configs = getCommonCheckboxFieldConfigs(childEvents);
    const config = configs.find((field) => field.name === input.name);

    if (!config) {
      return;
    }

    const nextValue = input.checked ? 1 : 0;

    if (childEvents.every((child) => getNumberField(child, config.name) === nextValue)) {
      return;
    }

    pushHistory();
    for (const child of childEvents) {
      setNumberField(child, config.name, nextValue);
      child.packageLocked = false;
    }
  } else if (bulkFieldType === "number" && input instanceof HTMLInputElement) {
    const configs = getCommonNumberFieldConfigs(childEvents);
    const config = configs.find((field) => field.name === input.name);
    const parsedValue = Number(input.value);

    if (!config || !Number.isFinite(parsedValue)) {
      return;
    }

    const nextValue = getStoredNumberFieldValue(config, parsedValue);
    const clampedValue = clamp(nextValue, config.min, getFieldMax(config));

    if (childEvents.every((child) => getNumberField(child, config.name) === clampedValue)) {
      return;
    }

    pushHistory();
    for (const child of childEvents) {
      setNumberField(child, config.name, clampedValue);
      child.packageLocked = false;
    }
  } else {
    return;
  }

  clearAimCache();
  sortEvents();
  renderEventList();
  renderTimelineMarkers();
  renderPackagePanel();
  renderPropertyForm();
  invalidatePreviewRenderCache();
  renderPreview();
  syncUi();
}

function handlePackagePanelLiveInput(event: Event): void {
  const packageEvent = getSelectedPackageEvent();
  const input = event.target;

  if (!packageEvent || !(input instanceof HTMLInputElement)) {
    return;
  }

  handlePackageTextureDisplayInput(packageEvent, input);
}

function handlePackageTextureDisplayInput(packageEvent: AttackPackageEvent, input: HTMLInputElement): boolean {
  if (input.name === "previewBulletTextureScale") {
    const nextScale = clamp(Number(input.value), previewTextureScaleMin, previewTextureScaleMax);

    if (!Number.isFinite(nextScale) || nextScale === getPackageBulletTextureScale(packageEvent)) {
      return true;
    }

    pushHistory();
    packageEvent.previewBulletTextureScale = nextScale;
    renderPreview();
    syncUi();
    return true;
  }

  if (input.name === "previewBulletTextureAngle") {
    const nextAngle = clamp(Number(input.value), -720, 720);

    if (!Number.isFinite(nextAngle) || nextAngle === getPackageBulletTextureAngle(packageEvent)) {
      return true;
    }

    pushHistory();
    packageEvent.previewBulletTextureAngle = nextAngle;
    renderPreview();
    syncUi();
    return true;
  }

  return false;
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

  if (input.dataset.difficultyControl) {
    handleDifficultyControlInput(packageEvent, input);
    return;
  }

  if (input instanceof HTMLInputElement && handlePackageTextureDisplayInput(packageEvent, input)) {
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

function handleTextureTypeNamePanelInput(event: Event): void {
  const input = event.target;

  if (!(input instanceof HTMLInputElement) || !input.dataset.textureTypeNameKey) {
    return;
  }

  const entry = getBulletTextureTypeNameEntries().find((candidate) => candidate.key === input.dataset.textureTypeNameKey);

  if (!entry) {
    return;
  }

  const nextTypeName = sanitizeUnityTypeName(input.value, getDefaultUnityTypeNameForTexture(entry.asset));

  if (nextTypeName === entry.typeName) {
    input.value = nextTypeName;
    return;
  }

  pushHistory();
  for (const packageEvent of entry.packageEvents) {
    if (!packageEvent.previewBulletTexture?.dataUrl) {
      continue;
    }

    packageEvent.previewBulletTexture = {
      ...packageEvent.previewBulletTexture,
      unityTypeName: nextTypeName,
    };
  }

  renderPackagePanel();
  renderTextureTypeNamePanel();
  syncUi();
}

function handlePackagePanelClick(event: MouseEvent): void {
  const target = event.target;

  if (!(target instanceof Element)) {
    return;
  }

  const bulkEditButton = target.closest<HTMLButtonElement>("[data-package-bulk-edit]");

  if (bulkEditButton?.dataset.packageBulkEdit) {
    const packageEvent = getPackageEventById(bulkEditButton.dataset.packageBulkEdit);

    if (packageEvent) {
      bulkEditPackageId = packageEvent.id;
      selectSingleEvent(packageEvent.id);
      bulkEditPackageId = packageEvent.id;
      activeInspectorTab = "properties";
      renderEverything();
    }
    return;
  }

  const textureButton = target.closest<HTMLButtonElement>("[data-package-texture-action]");

  if (textureButton) {
    const packageEvent = getSelectedPackageEvent();

    if (!packageEvent) {
      return;
    }

    if (textureButton.dataset.packageTextureAction === "load") {
      packageTextureTargetId = packageEvent.id;
      packageBulletTextureInput.click();
    } else if (textureButton.dataset.packageTextureAction === "clear") {
      clearPackageBulletTexture(packageEvent);
    }
    return;
  }

  const visibilityButton = target.closest<HTMLButtonElement>("[data-package-child-visibility]");

  if (visibilityButton) {
    const child = pattern.events.find((patternEvent) => patternEvent.id === visibilityButton.dataset.packageChildVisibility);

    if (child) {
      pushHistory();
      setDifficultyVisible(child, !isEventVisibleInActiveDifficulty(child));
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
  renderWaveformForTick();
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
  const originalDraggedTime = markerDragOriginalTimes.get(eventId) ?? attackEvent.startTime;
  const dragEvents = getTimelineDragEvents(eventId);
  const rawDelta = getSnappedEventTime(rawTime) - originalDraggedTime;
  const delta = getClampedTimelineDragDelta(dragEvents, rawDelta);

  for (const draggedEvent of dragEvents) {
    setEventTimelineDragTime(draggedEvent, delta);
  }

  for (const draggedEvent of dragEvents) {
    if (!draggedEvent.packageId) {
      syncTimelineMarkerElement(draggedEvent);
    }
  }

  clearAimCache();

  updateStartTimeInput(attackEvent.startTime);
  renderEventList();
  renderPreview();
}

function captureTimelineDragOriginalTimes(draggedEventId: string): Map<string, number> {
  const originals = new Map<string, number>();

  for (const event of getTimelineDragEvents(draggedEventId)) {
    originals.set(event.id, event.startTime);

    if (isAttackPackageEvent(event)) {
      for (const child of getPackageChildren(event)) {
        originals.set(child.id, child.startTime);
      }
    }
  }

  return originals;
}

function getTimelineDragEvents(draggedEventId: string): AttackEvent[] {
  const draggedEvent = pattern.events.find((event) => event.id === draggedEventId);

  if (!draggedEvent) {
    return [];
  }

  if (!selectedEventIds.has(draggedEventId) || selectedEventIds.size <= 1) {
    return [draggedEvent];
  }

  const selectedEvents = getSelectedEvents();
  const selectedIds = new Set(selectedEvents.map((event) => event.id));

  return selectedEvents.filter((event) => !(event.packageId && selectedIds.has(event.packageId)));
}

function getClampedTimelineDragDelta(events: AttackEvent[], rawDelta: number): number {
  if (events.length === 0) {
    return rawDelta;
  }

  const minDelta = Math.max(...events.map((event) => -(markerDragOriginalTimes.get(event.id) ?? event.startTime)));
  const maxDelta = Math.min(...events.map((event) => pattern.duration - (markerDragOriginalTimes.get(event.id) ?? event.startTime)));

  return Number(clamp(rawDelta, minDelta, maxDelta).toFixed(2));
}

function setEventTimelineDragTime(event: AttackEvent, delta: number): void {
  const originalTime = markerDragOriginalTimes.get(event.id) ?? event.startTime;

  event.startTime = Number(clamp(originalTime + delta, 0, pattern.duration).toFixed(2));

  if (!isAttackPackageEvent(event)) {
    return;
  }

  for (const child of getPackageChildren(event)) {
    const originalChildTime = markerDragOriginalTimes.get(child.id) ?? child.startTime;
    child.startTime = Number(clamp(originalChildTime + delta, 0, pattern.duration).toFixed(2));
  }
}

function syncTimelineMarkerElement(event: AttackEvent): void {
  const startRatio = clamp(event.startTime / pattern.duration, 0, 1);
  const endTime = getEventEndTime(event);
  const endRatio = clamp(endTime / pattern.duration, startRatio, 1);
  const minimumRangeRatio = Math.min(0.01, 8 / Math.max(timelineTrack.clientWidth, 1));
  const rangeWidthRatio = Math.max(endRatio - startRatio, minimumRangeRatio);
  const marker = timelineTrack.querySelector<HTMLElement>(`.timeline-marker[data-timeline-event-id="${cssEscape(event.id)}"]`);
  const range = timelineTrack.querySelector<HTMLElement>(`.timeline-event-range[data-timeline-event-id="${cssEscape(event.id)}"]`);

  if (marker) {
    marker.style.left = `${startRatio * 100}%`;
    marker.title = `${event.name} (${event.startTime.toFixed(2)}s - ${endTime.toFixed(2)}s)`;
  }

  if (range) {
    range.title = `${event.name} ${event.startTime.toFixed(2)}s - ${endTime.toFixed(2)}s`;
    range.style.left = `${startRatio * 100}%`;
    range.style.width = `${Math.min(rangeWidthRatio, 1 - startRatio) * 100}%`;
  }
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

  downloadJson(projectPattern, `${getProjectFileBaseName("danmaku_project")}.project.json`);
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
  const unityExport = buildUnitySeparatedExport(getDifficultyAdjustedPattern());
  const baseName = getProjectFileBaseName("danmaku_pattern");

  downloadJson(unityExport.stageData, `${baseName}.stagedata.json`);
  downloadJson(unityExport.bulletBufferCollection, `${baseName}.bulletbuffers.json`);

  if (unityExport.skippedEvents.length > 0) {
    console.warn("Some events could not be represented in the Unity StageData/BulletBuffer export.", unityExport.skippedEvents);
  }
}

function exportAllDifficultiesUnityZip(): void {
  const baseName = getProjectFileBaseName("danmaku_pattern");
  const files: ZipTextFile[] = [];

  for (const difficultyId of difficultyIds) {
    const unityExport = buildUnitySeparatedExportForDifficulty(difficultyId);
    const difficultyLabel = difficultyLabels[difficultyId];
    const filePrefix = `${difficultyLabel}/${baseName}_${difficultyLabel}`;

    files.push(
      {
        name: `${filePrefix}.stagedata.json`,
        data: stringifyJson(unityExport.stageData),
      },
      {
        name: `${filePrefix}.bulletbuffers.json`,
        data: stringifyJson(unityExport.bulletBufferCollection),
      },
    );

    if (unityExport.skippedEvents.length > 0) {
      console.warn(`${difficultyLabel}: Some events could not be represented in the Unity StageData/BulletBuffer export.`, unityExport.skippedEvents);
    }
  }

  downloadBlob(createZipBlob(files), `${baseName}_unity_all_difficulties.zip`);
}

function getProjectFileBaseName(fallback: string): string {
  const normalized = pattern.title
    .trim()
    .normalize("NFKC")
    .replace(/[<>:"/\\|?*\x00-\x1f]+/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[._]+|[._]+$/g, "");

  return normalized || fallback;
}

function buildUnitySeparatedExportForDifficulty(difficultyId: DifficultyId): ReturnType<typeof buildUnitySeparatedExport> {
  const previousDifficultyId = activeDifficultyId;

  activeDifficultyId = difficultyId;

  try {
    return buildUnitySeparatedExport(getDifficultyAdjustedPattern());
  } finally {
    activeDifficultyId = previousDifficultyId;
  }
}

function downloadJson(value: unknown, fileName: string): void {
  downloadBlob(new Blob([stringifyJson(value)], { type: "application/json" }), fileName);
}

function stringifyJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function createZipBlob(files: ZipTextFile[]): Blob {
  const encoder = new TextEncoder();
  const entries = files.map((file) => {
    const nameBytes = encoder.encode(file.name);
    const dataBytes = encoder.encode(file.data);

    return {
      nameBytes,
      dataBytes,
      crc32: calculateCrc32(dataBytes),
    };
  });
  const { date, time } = getZipDateTime(new Date());
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const localHeader = createZipLocalHeader(entry.nameBytes, entry.dataBytes, entry.crc32, date, time);

    localParts.push(localHeader, entry.dataBytes);
    centralParts.push(createZipCentralDirectoryHeader(entry.nameBytes, entry.dataBytes, entry.crc32, date, time, offset));
    offset += localHeader.length + entry.dataBytes.length;
  }

  const centralDirectoryOffset = offset;
  const centralDirectorySize = centralParts.reduce((size, part) => size + part.length, 0);
  const endRecord = createZipEndRecord(entries.length, centralDirectorySize, centralDirectoryOffset);
  const totalSize = centralDirectoryOffset + centralDirectorySize + endRecord.length;
  const archive = new Uint8Array(totalSize);
  let cursor = 0;

  for (const part of [...localParts, ...centralParts, endRecord]) {
    archive.set(part, cursor);
    cursor += part.length;
  }

  return new Blob([archive], { type: "application/zip" });
}

function createZipLocalHeader(nameBytes: Uint8Array, dataBytes: Uint8Array, crc32: number, date: number, time: number): Uint8Array {
  const header = new Uint8Array(30 + nameBytes.length);
  const view = new DataView(header.buffer);

  view.setUint32(0, 0x04034b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 0x0800, true);
  view.setUint16(8, 0, true);
  view.setUint16(10, time, true);
  view.setUint16(12, date, true);
  view.setUint32(14, crc32, true);
  view.setUint32(18, dataBytes.length, true);
  view.setUint32(22, dataBytes.length, true);
  view.setUint16(26, nameBytes.length, true);
  view.setUint16(28, 0, true);
  header.set(nameBytes, 30);
  return header;
}

function createZipCentralDirectoryHeader(
  nameBytes: Uint8Array,
  dataBytes: Uint8Array,
  crc32: number,
  date: number,
  time: number,
  localHeaderOffset: number,
): Uint8Array {
  const header = new Uint8Array(46 + nameBytes.length);
  const view = new DataView(header.buffer);

  view.setUint32(0, 0x02014b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 20, true);
  view.setUint16(8, 0x0800, true);
  view.setUint16(10, 0, true);
  view.setUint16(12, time, true);
  view.setUint16(14, date, true);
  view.setUint32(16, crc32, true);
  view.setUint32(20, dataBytes.length, true);
  view.setUint32(24, dataBytes.length, true);
  view.setUint16(28, nameBytes.length, true);
  view.setUint16(30, 0, true);
  view.setUint16(32, 0, true);
  view.setUint16(34, 0, true);
  view.setUint16(36, 0, true);
  view.setUint32(38, 0, true);
  view.setUint32(42, localHeaderOffset, true);
  header.set(nameBytes, 46);
  return header;
}

function createZipEndRecord(entryCount: number, centralDirectorySize: number, centralDirectoryOffset: number): Uint8Array {
  const record = new Uint8Array(22);
  const view = new DataView(record.buffer);

  view.setUint32(0, 0x06054b50, true);
  view.setUint16(4, 0, true);
  view.setUint16(6, 0, true);
  view.setUint16(8, entryCount, true);
  view.setUint16(10, entryCount, true);
  view.setUint32(12, centralDirectorySize, true);
  view.setUint32(16, centralDirectoryOffset, true);
  view.setUint16(20, 0, true);
  return record;
}

function getZipDateTime(dateValue: Date): { date: number; time: number } {
  const year = Math.max(1980, dateValue.getFullYear());
  const month = dateValue.getMonth() + 1;
  const day = dateValue.getDate();
  const hours = dateValue.getHours();
  const minutes = dateValue.getMinutes();
  const seconds = Math.floor(dateValue.getSeconds() / 2);

  return {
    date: ((year - 1980) << 9) | (month << 5) | day,
    time: (hours << 11) | (minutes << 5) | seconds,
  };
}

let crc32Table: Uint32Array | null = null;

function calculateCrc32(data: Uint8Array): number {
  const table = getCrc32Table();
  let crc = 0xffffffff;

  for (const byte of data) {
    crc = (crc >>> 8) ^ table[(crc ^ byte) & 0xff];
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function getCrc32Table(): Uint32Array {
  if (crc32Table) {
    return crc32Table;
  }

  const table = new Uint32Array(256);

  for (let index = 0; index < table.length; index += 1) {
    let crc = index;

    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }

    table[index] = crc >>> 0;
  }

  crc32Table = table;
  return table;
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
      activeDifficulty: isDifficultyId(parsed.activeDifficulty) ? parsed.activeDifficulty : "normal",
      events: parsed.events.map((event) => normalizeImportedEvent(event, parsed.stage!)),
    };
    activeDifficultyId = pattern.activeDifficulty ?? "normal";
    if (parsed.music?.dataUrl) {
      await loadMusicFromProjectAsset(parsed.music);
      pattern.duration = Math.max(pattern.duration, audio.duration || 0);
    } else {
      clearMusic();
    }
    migrateLegacyPreviewBulletTexture(parsed.preview?.bulletTexture ?? null);
    await preloadPackageBulletTextures();

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

    applyAiBeatmapTimeline(parsed.timeline);

    const requestedDuration = Number(parsed.duration);

    if (Number.isFinite(requestedDuration) && requestedDuration > 0) {
      pattern.duration = requestedDuration;
    }

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
  const startTime = parseAiBeatmapEventStartTime(rawEvent, index);

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

function parseAiBeatmapEventStartTime(rawEvent: Record<string, unknown>, index: number): number {
  const startTime = parseOptionalNumber(rawEvent.time);

  if (startTime !== undefined) {
    return startTime;
  }

  const startBeat = parseOptionalNumber(rawEvent.beat)
    ?? parseOptionalNumber(rawEvent.beats)
    ?? parseOptionalNumber(rawEvent.startBeat);

  if (startBeat !== undefined) {
    return Number(beatToSeconds(startBeat).toFixed(4));
  }

  throw new Error(`AI beatmap event ${index + 1} has no time or beat.`);
}

function applyAiBeatmapPackageParams(packageEvent: AttackPackageEvent, rawParams: unknown): void {
  if (!isRecord(rawParams)) {
    return;
  }

  const packageRecord = packageEvent as unknown as Record<string, number | string>;

  for (const config of getPackageFieldConfigs(packageEvent)) {
    const input = getAiBeatmapPackageParamInput(config, rawParams);

    if (config.name === "startTime" || !input.found) {
      continue;
    }

    const value = input.value;

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

function getAiBeatmapPackageParamInput(
  config: PackageFieldConfig,
  rawParams: Record<string, unknown>,
): { found: boolean; value: unknown } {
  if (config.name in rawParams) {
    return { found: true, value: rawParams[config.name] };
  }

  if (config.type === "number" && isBeatDurationPackageField(config.name)) {
    const beatsValue = parseOptionalNumber(rawParams[`${config.name}Beats`])
      ?? parseOptionalNumber(rawParams[`${config.name}Beat`]);

    if (beatsValue !== undefined) {
      return { found: true, value: beatDurationToSeconds(beatsValue) };
    }
  }

  return { found: false, value: undefined };
}

function isBeatDurationPackageField(fieldName: string): boolean {
  return /(?:Time|Duration|Interval|Spacing)$/u.test(fieldName);
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

function parseOptionalNumber(value: unknown): number | undefined {
  if (typeof value !== "number" && (typeof value !== "string" || value.trim() === "")) {
    return undefined;
  }

  const parsedValue = Number(value);

  return Number.isFinite(parsedValue) ? parsedValue : undefined;
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

async function loadPackageBulletTexture(packageEvent: AttackPackageEvent, file: File): Promise<void> {
  if (!file.type.startsWith("image/")) {
    window.alert("画像ファイルを選択してください。");
    return;
  }

  try {
    const asset = await buildProjectImageAsset(file);

    await setPackageBulletTextureAsset(packageEvent, asset);
  } catch (error) {
    console.error(error);
    window.alert("弾テクスチャを読み込めませんでした。別の画像を試してください。");
  }
}

async function setPackageBulletTextureAsset(packageEvent: AttackPackageEvent, asset: PreviewImageAsset | null): Promise<void> {
  const normalizedAsset = normalizePreviewImageAsset(asset);

  pushHistory();
  packageEvent.previewBulletTexture = normalizedAsset;
  packageEvent.previewBulletTextureScale = getPackageBulletTextureScale(packageEvent);
  invalidatePreviewRenderCache();

  if (normalizedAsset?.dataUrl) {
    void preview.loadBulletTexture(normalizedAsset.dataUrl)
      .then(() => renderPreview())
      .catch((error) => {
        console.warn("Package bullet texture could not be loaded for preview.", error);
      });
  }

  renderPackagePanel();
  renderTextureTypeNamePanel();
  renderPreview();
  syncUi();
}

function clearPackageBulletTexture(packageEvent: AttackPackageEvent): void {
  pushHistory();
  packageEvent.previewBulletTexture = null;
  invalidatePreviewRenderCache();
  renderPackagePanel();
  renderTextureTypeNamePanel();
  renderPreview();
  syncUi();
}

async function loadEnemyPreviewTexture(enemyEvent: SpawnEnemyOriginEvent, file: File): Promise<void> {
  if (!file.type.startsWith("image/")) {
    window.alert("画像ファイルを選択してください。");
    return;
  }

  try {
    const asset = await buildProjectImageAsset(file);

    await setEnemyPreviewTextureAsset(enemyEvent, asset);
  } catch (error) {
    console.error(error);
    window.alert("敵テクスチャを読み込めませんでした。別の画像を試してください。");
  }
}

async function setEnemyPreviewTextureAsset(enemyEvent: SpawnEnemyOriginEvent, asset: PreviewImageAsset | null): Promise<void> {
  pushHistory();
  enemyEvent.previewEnemyTexture = asset;
  enemyEvent.previewEnemyTextureScale = getEnemyTextureScale(enemyEvent);
  invalidatePreviewRenderCache();

  if (asset?.dataUrl) {
    void preview.loadEnemyTexture(asset.dataUrl)
      .then(() => renderPreview())
      .catch((error) => {
        console.warn("Enemy texture could not be loaded for preview.", error);
      });
  }

  renderPropertyForm();
  renderPreview();
  syncUi();
}

function clearEnemyPreviewTexture(enemyEvent: SpawnEnemyOriginEvent): void {
  pushHistory();
  enemyEvent.previewEnemyTexture = null;
  invalidatePreviewRenderCache();
  renderPropertyForm();
  renderPreview();
  syncUi();
}

async function preloadPackageBulletTextures(): Promise<void> {
  const dataUrls = new Set<string>();

  for (const event of pattern.events) {
    if (isAttackPackageEvent(event) && event.previewBulletTexture?.dataUrl) {
      dataUrls.add(event.previewBulletTexture.dataUrl);
    }
    if (event.kind === "spawn_enemy_origin" && event.previewEnemyTexture?.dataUrl) {
      dataUrls.add(event.previewEnemyTexture.dataUrl);
    }
  }

  await Promise.all([...dataUrls].map(async (dataUrl) => {
    try {
      await preview.loadBulletTexture(dataUrl);
    } catch (error) {
      console.warn("Package bullet texture could not be restored.", error);
    }
  }));
}

function migrateLegacyPreviewBulletTexture(asset: PreviewImageAsset | null): void {
  if (!asset?.dataUrl) {
    return;
  }

  const packageEvents = pattern.events.filter(isAttackPackageEvent);
  const hasPackageTexture = packageEvents.some((event) => event.previewBulletTexture?.dataUrl);

  if (hasPackageTexture) {
    return;
  }

  for (const packageEvent of packageEvents) {
    packageEvent.previewBulletTexture = normalizePreviewImageAsset(asset);
  }
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

function buildProjectImageAsset(file: File): Promise<PreviewImageAsset> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.addEventListener("load", () => {
      resolve({
        name: file.name,
        type: file.type,
        dataUrl: String(reader.result ?? ""),
        unityTypeName: getDefaultUnityTypeNameForTextureName(file.name),
      });
    });
    reader.addEventListener("error", () => reject(reader.error ?? new Error("Image file could not be read.")));
    reader.readAsDataURL(file);
  });
}

function normalizePreviewImageAsset(value: unknown): PreviewImageAsset | null {
  if (!isRecord(value) || typeof value.dataUrl !== "string" || !value.dataUrl) {
    return null;
  }

  const name = typeof value.name === "string" && value.name.trim() ? value.name : "texture";
  const type = typeof value.type === "string" ? value.type : "";
  const fallbackTypeName = getDefaultUnityTypeNameForTextureName(name);

  return {
    name,
    type,
    dataUrl: value.dataUrl,
    unityTypeName: sanitizeUnityTypeName(value.unityTypeName, fallbackTypeName),
  };
}

function getPreviewImageUnityTypeName(asset: PreviewImageAsset): string {
  return sanitizeUnityTypeName(asset.unityTypeName, getDefaultUnityTypeNameForTexture(asset));
}

function getDefaultUnityTypeNameForTexture(asset: PreviewImageAsset): string {
  return getDefaultUnityTypeNameForTextureName(asset.name);
}

function getDefaultUnityTypeNameForTextureName(name: string | undefined): string {
  const baseName = (name ?? "").replace(/\.[^.\\/]+$/u, "");

  return sanitizeUnityTypeName(baseName.toLowerCase(), defaultUnityBulletTypeName);
}

function sanitizeUnityTypeName(value: unknown, fallback = defaultUnityBulletTypeName): string {
  if (typeof value !== "string") {
    return fallback;
  }

  return value.trim().replace(/[^A-Za-z0-9_-]+/gu, "_").replace(/^[-_]+|[-_]+$/gu, "") || fallback;
}

function getPreviewTextureKey(asset: PreviewImageAsset): string {
  return `texture_${hashString(asset.dataUrl)}`;
}

function hashString(value: string): string {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36);
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
  invalidatePreviewRenderCache();
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
  renderTextureTypeNamePanel();
  renderPropertyForm();
  renderTimelineMarkers();
  syncTimelineInputs();
  renderWaveform();
  renderPreview();
  syncUi();
}

function invalidatePreviewRenderCache(): void {
  previewEventWindows = null;
  difficultyAdjustedPreviewEvents = null;
  lastPreviewWaveformRenderTime = 0;
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
    previewPlayerVelocity.x = 0;
    previewPlayerVelocity.y = 0;
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
    previewPlayerVelocity.x = 0;
    previewPlayerVelocity.y = 0;
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
  const texturePreview = applyBulletTextureVisualSizeScale(getPreviewEvents(clock.time));
  const previewEvents = texturePreview.events;
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
    bulletTexturesByEventId: buildPreviewBulletTextureMap(previewEvents, texturePreview.visualSizeScaledEventIds),
    enemyTexturesByEventId: buildPreviewEnemyTextureMap(previewEvents),
    selectedEventId,
    editEventId: editingEventId,
    trajectories: buildVisibleTrajectories(),
    playerAlpha: dashTimeRemaining > 0 ? 0.45 : 1,
    packageHandles,
    activePackageHandleId: packageHandles.some((handle) => handle.id === activePackageHandleId) ? activePackageHandleId : null,
    lightweight: editorMode === "preview" && previewLightweightEnabled,
  });
}

function applyBulletTextureVisualSizeScale(events: AttackEvent[]): { events: AttackEvent[]; visualSizeScaledEventIds: Set<string> } {
  const visualSizeScaledEventIds = new Set<string>();
  let scaledEvents: AttackEvent[] | null = null;

  events.forEach((event, index) => {
    if (!isTextureVisualSizeScalableEvent(event)) {
      return;
    }

    const parentPackage = getParentPackage(event);

    if (!parentPackage?.previewBulletTexture?.dataUrl) {
      return;
    }

    const scale = getPackageBulletTextureScale(parentPackage);

    if (scale === 1) {
      return;
    }

    if (!scaledEvents) {
      scaledEvents = [...events];
    }

    const scaledEvent = structuredClone(event) as AttackEvent & { visualSize: number };
    scaledEvent.visualSize = Math.max(1, scaledEvent.visualSize * scale);
    scaledEvents[index] = scaledEvent;
    visualSizeScaledEventIds.add(event.id);
  });

  return { events: scaledEvents ?? events, visualSizeScaledEventIds };
}

function isTextureVisualSizeScalableEvent(event: AttackEvent): event is AttackEvent & { typeId: number; visualSize: number } {
  return "typeId" in event
    && "visualSize" in event
    && Math.round(Number(event.typeId) || 0) === 0
    && Number.isFinite(Number(event.visualSize));
}

function buildPreviewBulletTextureMap(events: AttackEvent[], visualSizeScaledEventIds = new Set<string>()): Map<string, { dataUrl: string; scale: number; angleDeg: number }> {
  const texturesByEventId = new Map<string, { dataUrl: string; scale: number; angleDeg: number }>();

  for (const event of events) {
    const parentPackage = getParentPackage(event);
    const dataUrl = parentPackage?.previewBulletTexture?.dataUrl;

    if (dataUrl) {
      texturesByEventId.set(event.id, {
        dataUrl,
        scale: visualSizeScaledEventIds.has(event.id) ? 1 : getPackageBulletTextureScale(parentPackage),
        angleDeg: getPackageBulletTextureAngle(parentPackage),
      });
    }
  }

  return texturesByEventId;
}

function buildPreviewEnemyTextureMap(events: AttackEvent[]): Map<string, { dataUrl: string; scale: number; angleDeg: number }> {
  const texturesByEventId = new Map<string, { dataUrl: string; scale: number; angleDeg: number }>();

  for (const event of events) {
    if (event.kind === "spawn_enemy_origin" && event.previewEnemyTexture?.dataUrl) {
      texturesByEventId.set(event.id, {
        dataUrl: event.previewEnemyTexture.dataUrl,
        scale: getEnemyTextureScale(event),
        angleDeg: getEnemyTextureAngle(event),
      });
    }
  }

  return texturesByEventId;
}

function getPackageBulletTextureScale(packageEvent: AttackPackageEvent): number {
  return clamp(Number(packageEvent.previewBulletTextureScale) || 1, previewTextureScaleMin, previewTextureScaleMax);
}

function getPackageBulletTextureAngle(packageEvent: AttackPackageEvent): number {
  const angle = Number(packageEvent.previewBulletTextureAngle);

  return Number.isFinite(angle) ? clamp(angle, -720, 720) : 0;
}

function getEnemyTextureScale(enemyEvent: SpawnEnemyOriginEvent): number {
  return clamp(Number(enemyEvent.previewEnemyTextureScale) || 1, previewTextureScaleMin, previewTextureScaleMax);
}

function getEnemyTextureAngle(enemyEvent: SpawnEnemyOriginEvent): number {
  const angle = Number(enemyEvent.previewEnemyTextureAngle);

  return Number.isFinite(angle) ? clamp(angle, -720, 720) : 0;
}

function getPreviewEvents(currentTime = clock.time): AttackEvent[] {
  const editingEvent = getEditingEvent();

  if (editorMode === "trajectory") {
    return editingEvent && isPreviewRenderableEvent(editingEvent) ? [getDifficultyAdjustedEvent(editingEvent)] : [];
  }

  if (editorMode !== "preview" || !previewLightweightEnabled) {
    return getDifficultyAdjustedPreviewEvents().filter(isAdjustedPreviewRenderableEvent);
  }

  const activeEvents: AttackEvent[] = [];

  for (const entry of getPreviewEventWindows()) {
    if (entry.activeStartTime > currentTime + previewEventTimePadding) {
      break;
    }

    if (entry.activeEndTime >= currentTime - previewEventTimePadding) {
      activeEvents.push(entry.event);
    }
  }

  return activeEvents;
}

function getPreviewEventWindows(): PreviewEventWindow[] {
  if (previewEventWindows) {
    return previewEventWindows;
  }

  previewEventWindows = getDifficultyAdjustedPreviewEvents()
    .filter(isAdjustedPreviewRenderableEvent)
    .map((event) => {
      return {
        event,
        activeStartTime: getPreviewEventActiveStartTime(event),
        activeEndTime: getEventEndTime(event),
      };
    })
    .sort((a, b) => a.activeStartTime - b.activeStartTime);

  return previewEventWindows;
}

function isPreviewRenderableEvent(event: AttackEvent): boolean {
  return !isAttackPackageEvent(event) && isEventVisibleInActiveDifficulty(event) && isParentPackageVisibleInActiveDifficulty(event);
}

function isAdjustedPreviewRenderableEvent(event: AttackEvent): boolean {
  return !isAttackPackageEvent(event) && event.visible !== false;
}

function getDifficultyAdjustedPreviewEvents(): AttackEvent[] {
  difficultyAdjustedPreviewEvents ??= getDifficultyAdjustedPatternEvents();
  return difficultyAdjustedPreviewEvents;
}

function getPreviewEventActiveStartTime(event: AttackEvent): number {
  return Math.max(0, event.startTime - getEventWarningLeadTime(event));
}

function getEventWarningLeadTime(event: AttackEvent): number {
  if (event.kind === "spawn_enemy_origin") {
    return Math.max(0, event.enemyWarningTime);
  }

  if ("warningTime" in event && typeof event.warningTime === "number" && Number.isFinite(event.warningTime)) {
    return Math.max(0, event.warningTime);
  }

  return 0;
}

type PackageHandleRole = "source" | "target" | "start" | "area" | "center" | "position" | "enemyStart" | "enemyEnterEnd" | "enemyEnd";

function buildPackagePreviewHandles(): PackageHandleRender[] {
  if (editorMode === "preview") {
    return [];
  }

  const handles: PackageHandleRender[] = [];
  const selectedEnemy = getSelectedEnemyEvent();

  if (selectedEnemy && activeInspectorTab === "properties") {
    handles.push(
      {
        id: getPackageHandleId(selectedEnemy, "enemyStart"),
        x: clamp(selectedEnemy.enemyStartX, 0, pattern.stage.width),
        y: clamp(selectedEnemy.enemyStartY, 0, pattern.stage.height),
        color: 0xffd166,
        secondary: true,
      },
      {
        id: getPackageHandleId(selectedEnemy, "enemyEnterEnd"),
        x: clamp(selectedEnemy.enemyEnterEndX, 0, pattern.stage.width),
        y: clamp(selectedEnemy.enemyEnterEndY, 0, pattern.stage.height),
        color: selectedEnemy.color,
      },
      {
        id: getPackageHandleId(selectedEnemy, "enemyEnd"),
        x: clamp(selectedEnemy.enemyEndX, 0, pattern.stage.width),
        y: clamp(selectedEnemy.enemyEndY, 0, pattern.stage.height),
        color: 0x27dfff,
        secondary: true,
      },
    );
  }

  if (activeInspectorTab !== "package") {
    return handles;
  }

  const packageEvent = getSelectedPackageEvent();

  if (!packageEvent) {
    return handles;
  }

  const sourceColor = packageEvent.color;
  const secondaryColor = 0xffd166;
  const areaColor = 0x27dfff;
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

function getPackageHandleId(event: { id: string }, role: PackageHandleRole): string {
  return `${event.id}:${role}`;
}

function parsePackageHandleId(handleId: string): { packageId: string; role: PackageHandleRole } | undefined {
  const separatorIndex = handleId.lastIndexOf(":");

  if (separatorIndex < 0) {
    return undefined;
  }

  const packageId = handleId.slice(0, separatorIndex);
  const role = handleId.slice(separatorIndex + 1) as PackageHandleRole;

  if (!["source", "target", "start", "area", "center", "position", "enemyStart", "enemyEnterEnd", "enemyEnd"].includes(role)) {
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

  if (handle.role === "enemyStart" || handle.role === "enemyEnterEnd" || handle.role === "enemyEnd") {
    const enemyEvent = getEnemyEventById(handle.packageId);

    if (!enemyEvent || editorMode === "preview") {
      return;
    }

    activePackageHandleId = handleId;

    if (phase === "start") {
      pushHistory();
      selectSingleEvent(enemyEvent.id);
      activeInspectorTab = "properties";
    }

    applyEnemyHandlePoint(enemyEvent, handle.role, point);
    clearAimCache();
    if (phase === "move") {
      renderPropertyForm();
      renderPreview();
      syncUi();
    } else {
      renderEverything();
    }
    return;
  }

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

function applyEnemyHandlePoint(enemyEvent: SpawnEnemyOriginEvent, role: PackageHandleRole, point: { x: number; y: number }): void {
  const x = clamp(point.x, 0, pattern.stage.width);
  const y = clamp(point.y, 0, pattern.stage.height);

  if (role === "enemyStart") {
    enemyEvent.enemyStartX = x;
    enemyEvent.enemyStartY = y;
  } else if (role === "enemyEnterEnd") {
    enemyEvent.enemyEnterEndX = x;
    enemyEvent.enemyEnterEndY = y;
  } else if (role === "enemyEnd") {
    enemyEvent.enemyEndX = x;
    enemyEvent.enemyEndY = y;
  }
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
    if (!hasDirection) {
      direction.x = lastPreviewDirection.x;
      direction.y = lastPreviewDirection.y;
    }
  }

  dashRequested = false;

  const dashActive = dashTimeRemaining > 0;
  const moveDirection = hasDirection ? direction : dashActive ? lastPreviewDirection : { x: 0, y: 0 };
  const targetSpeed = dashActive ? previewDashSpeed : previewMoveSpeed;
  const targetVelocity = {
    x: moveDirection.x * targetSpeed,
    y: moveDirection.y * targetSpeed,
  };
  const acceleration = dashActive ? previewDashAcceleration : hasDirection ? previewMoveAcceleration : previewStopDamping;
  const blend = 1 - Math.exp(-acceleration * deltaSeconds);

  previewPlayerVelocity.x += (targetVelocity.x - previewPlayerVelocity.x) * blend;
  previewPlayerVelocity.y += (targetVelocity.y - previewPlayerVelocity.y) * blend;

  if (!hasDirection && !dashActive && Math.hypot(previewPlayerVelocity.x, previewPlayerVelocity.y) < 1) {
    previewPlayerVelocity.x = 0;
    previewPlayerVelocity.y = 0;
  }

  preview.movePlayer(previewPlayerVelocity.x * deltaSeconds, previewPlayerVelocity.y * deltaSeconds);
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
    code === "ShiftLeft" ||
    code === "ShiftRight"
  );
}

function isPreviewDashKey(event: KeyboardEvent): boolean {
  return event.code === "ShiftLeft" || event.code === "ShiftRight" || event.key === "Shift";
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
  const isPreviewMode = editorMode === "preview";
  appShell.classList.toggle("is-preview-mode", isPreviewMode);
  appShell.classList.toggle("is-preview-timeline-hidden", isPreviewMode && !previewTimelineVisible);
  if (document.activeElement !== projectTitleInput && projectTitleInput.value !== pattern.title) {
    projectTitleInput.value = pattern.title;
  }

  for (const button of editorModeButtons) {
    const isActive = button.dataset.editorMode === editorMode;

    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  }

  for (const button of difficultyButtons) {
    const isActive = button.dataset.difficultyId === activeDifficultyId;

    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  }

  syncPreviewOptionButtons(isPreviewMode);
  timeDisplay.textContent = `${clock.time.toFixed(2)}s / ${pattern.duration.toFixed(2)}s`;
  timelinePlayhead.style.left = `${(clock.time / pattern.duration) * 100}%`;
  syncPlaybackButton();
  syncHistoryButtons();
  syncSnapButton();
  addTimelineLaneButton.disabled = getTimelineLaneCount() >= maximumTimelineLaneCount;
  musicDisplay.classList.toggle("has-music", hasMusic());
}

function syncPreviewOptionButtons(isPreviewMode: boolean): void {
  previewLightweightToggleButton.disabled = !isPreviewMode;
  previewTimelineToggleButton.disabled = !isPreviewMode;
  previewLightweightToggleButton.classList.toggle("is-active", previewLightweightEnabled);
  previewTimelineToggleButton.classList.toggle("is-active", previewTimelineVisible);
  previewLightweightToggleButton.setAttribute("aria-pressed", String(previewLightweightEnabled));
  previewTimelineToggleButton.setAttribute("aria-pressed", String(previewTimelineVisible));
  previewLightweightToggleButton.title = previewLightweightEnabled ? "軽量化オン" : "軽量化オフ";
  previewTimelineToggleButton.title = previewTimelineVisible ? "タイムライン表示オン" : "タイムライン表示オフ";
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
  if (eventId !== bulkEditPackageId) {
    bulkEditPackageId = null;
  }
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
  bulkEditPackageId = null;
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
    const isVisible = isEventVisibleInActiveDifficulty(event);

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
      setDifficultyVisible(event, !isEventVisibleInActiveDifficulty(event));
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
  const bulkPackage = getBulkEditPackageEvent();

  if (bulkPackage) {
    propertyForm.innerHTML = renderBulkPackagePropertyForm(bulkPackage);
    return;
  }

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
  const enemyTextureCard = selectedEvent.kind === "spawn_enemy_origin" ? renderEnemyTextureCard(selectedEvent) : "";

  propertyForm.innerHTML = `
    <div class="property-event-name">
      <input class="event-name-input" name="name" type="text" value="${escapeHtml(selectedEvent.name)}" aria-label="event name" />
    </div>
    <div class="property-time-mode" aria-label="時間入力モード">
      <span>timeInput</span>
      <button class="time-mode-button ${propertyTimeMode === "seconds" ? "is-active" : ""}" type="button" data-time-mode="seconds">seconds</button>
      <button class="time-mode-button ${propertyTimeMode === "beats" ? "is-active" : ""}" type="button" data-time-mode="beats">beats</button>
    </div>
    ${renderDifficultyControls(selectedEvent)}
    ${propertyGroupsHtml}
    ${enemyTextureCard}
    <button id="delete-event-button" class="danger-button" type="button">Delete selected event</button>
  `;
}

function getBulkEditPackageEvent(): AttackPackageEvent | undefined {
  if (!bulkEditPackageId) {
    return undefined;
  }

  const packageEvent = getPackageEventById(bulkEditPackageId);

  if (!packageEvent) {
    bulkEditPackageId = null;
    return undefined;
  }

  return packageEvent;
}

function renderBulkPackagePropertyForm(packageEvent: AttackPackageEvent): string {
  const childEvents = getPackageChildren(packageEvent);
  const content = childEvents.length > 0
    ? renderBulkPackagePropertyGroups(childEvents)
    : `<p class="empty-state">このパッケージには一括編集できるAttackがありません。</p>`;

  return `
    <div class="property-event-name bulk-edit-heading">
      <div>
        <span class="bulk-edit-kicker">一括編集中</span>
        <strong>${escapeHtml(packageEvent.name)} Attacks</strong>
      </div>
      <button class="inline-action-button" type="button" data-bulk-edit-close="true">${iconSvg("package")}<span>パッケージへ戻る</span></button>
    </div>
    <div class="property-time-mode" aria-label="時間入力モード">
      <span>timeInput</span>
      <button class="time-mode-button ${propertyTimeMode === "seconds" ? "is-active" : ""}" type="button" data-time-mode="seconds">seconds</button>
      <button class="time-mode-button ${propertyTimeMode === "beats" ? "is-active" : ""}" type="button" data-time-mode="beats">beats</button>
    </div>
    ${content}
  `;
}

function renderBulkPackagePropertyGroups(events: AttackEvent[]): string {
  const commonNumberFields = getCommonNumberFieldConfigs(events);
  const commonSelectFields = getCommonSelectFieldConfigs(events);
  const commonCheckboxFields = getCommonCheckboxFieldConfigs(events);
  const numberFieldMap = new Map(commonNumberFields.map((field) => [field.name, field]));
  const selectFieldMap = new Map(commonSelectFields.map((field) => [field.name, field]));
  const checkboxFieldMap = new Map(commonCheckboxFields.map((field) => [field.name, field]));
  let colorRendered = false;

  return propertyGroups
    .map((group) => {
      const selectFields = (group.selectFields ?? [])
        .map((name) => selectFieldMap.get(name))
        .filter((field): field is SelectFieldConfig => Boolean(field))
        .map((field) => renderBulkSelectField(events, field))
        .join("");
      const checkboxFields = (group.checkboxFields ?? [])
        .map((name) => checkboxFieldMap.get(name))
        .filter((field): field is CheckboxFieldConfig => Boolean(field))
        .map((field) => renderBulkCheckboxField(events, field))
        .join("");
      const numberFields = renderBulkNumberFields(
        events,
        (group.numberFields ?? [])
          .map((name) => numberFieldMap.get(name))
          .filter((field): field is NumberFieldConfig => Boolean(field)),
      );
      const shouldRenderColor = !colorRendered && group.includeColor && (group.title === "Visual" || numberFields.trim());
      const colorField = shouldRenderColor
        ? renderBulkColorField(events)
        : "";
      const content = `${selectFields}${checkboxFields}${numberFields}${colorField}`;

      if (!content.trim()) {
        return "";
      }

      colorRendered = colorRendered || Boolean(colorField);

      return `
        <section class="property-group">
          <h3>${group.title}</h3>
          <div class="property-group-fields">${content}</div>
        </section>
      `;
    })
    .join("") || `<p class="empty-state">すべてのAttackに共通するパラメータがありません。</p>`;
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
    ${renderDifficultyControls(packageEvent)}
    <div class="property-group">
      <h3>Package</h3>
      <div class="property-group-fields">
        ${fields.map((field) => renderPackageField(packageEvent, field)).join("")}
      </div>
    </div>
    ${renderPackageTextureCard(packageEvent)}
    <div class="property-group">
      <div class="property-group-header">
        <h3>Generated Attacks</h3>
        <button class="inline-action-button" type="button" data-package-bulk-edit="${packageEvent.id}" ${childEvents.length > 0 ? "" : "disabled"}>${iconSvg("sliders")}<span>一括で編集</span></button>
      </div>
      <div class="package-child-list">
        ${childEvents.map((child) => renderPackageChildCard(child)).join("")}
      </div>
    </div>
  `;
}

function renderTextureTypeNamePanel(): void {
  const entries = getBulletTextureTypeNameEntries();

  if (entries.length === 0) {
    textureTypeNamePanel.innerHTML = '<div class="empty-state">弾テクスチャなし</div>';
    return;
  }

  textureTypeNamePanel.innerHTML = `
    <div class="texture-type-list">
      ${entries.map(renderTextureTypeNameCard).join("")}
    </div>
  `;
}

function renderTextureTypeNameCard(entry: BulletTextureTypeNameEntry): string {
  const packageNames = entry.packageEvents.map((event) => event.name).join(", ");

  return `
    <article class="texture-type-card">
      <div class="texture-type-card-main">
        <strong>${escapeHtml(entry.asset.name || "Texture")}</strong>
        <span>${escapeHtml(packageNames)}</span>
      </div>
      <label class="property-field texture-type-name-field">
        <span title="Unity 書き出し時に、このテクスチャ弾へ設定する typeName です。">typeName</span>
        <input data-texture-type-name-key="${escapeHtml(entry.key)}" type="text" value="${escapeHtml(entry.typeName)}" spellcheck="false" />
      </label>
    </article>
  `;
}

function getBulletTextureTypeNameEntries(): BulletTextureTypeNameEntry[] {
  const entries = new Map<string, BulletTextureTypeNameEntry>();

  for (const packageEvent of pattern.events) {
    if (!isAttackPackageEvent(packageEvent) || !packageEvent.previewBulletTexture?.dataUrl) {
      continue;
    }

    const asset = packageEvent.previewBulletTexture;
    const key = getPreviewTextureKey(asset);
    let entry = entries.get(key);

    if (!entry) {
      entry = {
        key,
        asset,
        typeName: getPreviewImageUnityTypeName(asset),
        packageEvents: [],
      };
      entries.set(key, entry);
    }

    entry.packageEvents.push(packageEvent);
  }

  return [...entries.values()].sort((a, b) => a.asset.name.localeCompare(b.asset.name, "ja"));
}

function renderPackageTextureCard(packageEvent: AttackPackageEvent): string {
  const asset = packageEvent.previewBulletTexture;
  const hasTexture = Boolean(asset?.dataUrl);
  const textureScale = getPackageBulletTextureScale(packageEvent);
  const textureAngle = getPackageBulletTextureAngle(packageEvent);
  const textureTypeName = asset?.dataUrl ? getPreviewImageUnityTypeName(asset) : defaultUnityBulletTypeName;

  return `
    <div class="preview-texture-card package-texture-card">
      <div>
        <h3>弾テクスチャ</h3>
        <p class="preview-texture-display ${hasTexture ? "has-texture" : ""}">${escapeHtml(asset?.name ?? "No texture")}</p>
      </div>
      <label class="property-field">
        <span title="Unity 書き出し時に、このテクスチャ弾へ設定する typeName です。">typeName</span>
        <input type="text" value="${escapeHtml(textureTypeName)}" readonly />
      </label>
      <label class="property-field">
        <span title="このパッケージのテクスチャ弾だけ、各弾の基本サイズに倍率を掛けてプレビューします。">表示倍率</span>
        <input name="previewBulletTextureScale" type="number" min="${previewTextureScaleMin}" max="${previewTextureScaleMax}" step="0.05" value="${formatPropertyNumber(textureScale)}" />
      </label>
      <label class="property-field">
        <span title="このパッケージのテクスチャ弾だけに追加する表示角度です。">テクスチャ角度</span>
        <input name="previewBulletTextureAngle" type="number" min="-720" max="720" step="5" value="${formatPropertyNumber(textureAngle)}" />
      </label>
      <div class="preview-texture-actions">
        <button class="music-load-button" type="button" data-package-texture-action="load">${iconSvg("image")}<span>画像を読み込む</span></button>
        <button class="danger-button" type="button" data-package-texture-action="clear" ${hasTexture ? "" : "disabled"}>${iconSvg("trash")}<span>解除</span></button>
      </div>
    </div>
  `;
}

function renderEnemyTextureCard(enemyEvent: SpawnEnemyOriginEvent): string {
  const asset = enemyEvent.previewEnemyTexture;
  const hasTexture = Boolean(asset?.dataUrl);
  const textureAngle = getEnemyTextureAngle(enemyEvent);

  return `
    <div class="preview-texture-card">
      <div>
        <h3>敵テクスチャ</h3>
        <p class="preview-texture-display ${hasTexture ? "has-texture" : ""}">${escapeHtml(asset?.name ?? "No texture")}</p>
      </div>
      <label class="property-field">
        <span title="敵テクスチャだけに追加する表示角度です。敵表示角度とは別に調整できます。">テクスチャ角度</span>
        <input name="previewEnemyTextureAngle" type="number" min="-720" max="720" step="5" value="${formatPropertyNumber(textureAngle)}" />
      </label>
      <div class="preview-texture-actions">
        <button class="music-load-button" type="button" data-enemy-texture-action="load">${iconSvg("image")}<span>画像を読み込む</span></button>
        <button class="danger-button" type="button" data-enemy-texture-action="clear" ${hasTexture ? "" : "disabled"}>${iconSvg("trash")}<span>解除</span></button>
      </div>
    </div>
  `;
}

function renderDifficultyControls(event: AttackEvent): string {
  const settings = getDifficultySettings(event, activeDifficultyId);
  const visible = settings.visible !== false;
  const countScale = settings.countScale ?? 1;
  const warningTimeScale = settings.warningTimeScale ?? 1;
  const speedScale = settings.speedScale ?? 1;

  return `
    <section class="property-group difficulty-property-group">
      <h3>${difficultyLabels[activeDifficultyId]}</h3>
      <div class="property-group-fields">
        <label class="property-field property-checkbox-field">
          <span title="現在選択中の難易度だけで、この攻撃を表示するかを切り替えます。">この難易度で表示</span>
          <input data-difficulty-control="visible" type="checkbox" ${visible ? "checked" : ""} />
        </label>
        <label class="property-field">
          <span title="現在選択中の難易度だけで、弾数や本数を倍率で増減します。">弾数倍率</span>
          <input data-difficulty-control="countScale" type="number" min="0" max="5" step="0.05" value="${formatPropertyNumber(countScale)}" />
        </label>
        <label class="property-field">
          <span title="現在選択中の難易度だけで、弾やレーザーの移動速度を倍率で増減します。">速度倍率</span>
          <input data-difficulty-control="speedScale" type="number" min="0" max="5" step="0.05" value="${formatPropertyNumber(speedScale)}" />
        </label>
        <label class="property-field">
          <span title="現在選択中の難易度だけで、予告時間を倍率で増減します。">予告時間倍率</span>
          <input data-difficulty-control="warningTimeScale" type="number" min="0" max="5" step="0.05" value="${formatPropertyNumber(warningTimeScale)}" />
        </label>
      </div>
    </section>
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
  const isVisible = isEventVisibleInActiveDifficulty(event);
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

function renderBulkSelectField(events: AttackEvent[], field: SelectFieldConfig): string {
  const value = getBulkSelectValue(events, field);

  return `
    <label class="property-field">
      <span title="${getPropertyTooltip(field.name)}">${field.label}</span>
      <select name="${field.name}" data-bulk-edit-field="select">
        ${value.mixed ? '<option value="" selected disabled>mixed</option>' : ""}
        ${field.options
          .map((option) => `<option value="${option.value}" ${!value.mixed && option.value === value.value ? "selected" : ""}>${option.label}</option>`)
          .join("")}
      </select>
    </label>
  `;
}

function renderBulkCheckboxField(events: AttackEvent[], field: CheckboxFieldConfig): string {
  const value = getBulkCheckboxValue(events, field.name);
  const title = value.mixed ? `${getPropertyDescription(field.name)}\n現在は値が混在しています。` : getPropertyDescription(field.name);

  return `
    <label class="property-field property-checkbox-field ${value.mixed ? "is-mixed" : ""}">
      <span title="${escapeHtml(title)}">${field.label}</span>
      <input name="${field.name}" data-bulk-edit-field="checkbox" type="checkbox" ${value.value ? "checked" : ""} />
    </label>
  `;
}

function renderBulkColorField(events: AttackEvent[]): string {
  const value = getBulkColorValue(events);

  return `
    <label class="property-field ${value.mixed ? "is-mixed" : ""}">
      <span title="${getPropertyTooltip("color")}">color</span>
      <input name="color" data-bulk-edit-field="color" type="color" value="${formatColor(value.value)}" />
    </label>
  `;
}

function renderBulkNumberFields(events: AttackEvent[], fields: NumberFieldConfig[]): string {
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

    fragments.push(`
      <label class="property-field property-compact-field">
        <span title="${getCompactFieldTooltip(group.fields)}">${group.label}</span>
        <div class="compact-inputs" style="--input-count: ${group.fields.length}">
          ${groupFields.map((field) => renderBulkNumberInput(events, field!, getDisplayFieldLabel(field!))).join("")}
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
        ${renderBulkNumberInput(events, field)}
      </label>
    `);
  }

  return fragments.join("");
}

function renderBulkNumberInput(events: AttackEvent[], field: NumberFieldConfig, ariaLabel = field.name): string {
  const value = getBulkNumberValue(events, field);

  return `
    <input
      name="${field.name}"
      data-bulk-edit-field="number"
      type="number"
      min="${getDisplayFieldMin(field)}"
      max="${getDisplayFieldMax(field)}"
      step="${getDisplayFieldStep(field)}"
      value="${value.mixed ? "" : value.value}"
      placeholder="${value.mixed ? "mixed" : ""}"
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
    const isVisible = isEventVisibleInActiveDifficulty(event);
    const laneIndex = getEventTimelineLane(event);
    const startRatio = clamp(event.startTime / pattern.duration, 0, 1);
    const endTime = getEventEndTime(event);
    const endRatio = clamp(endTime / pattern.duration, startRatio, 1);
    const minimumRangeRatio = Math.min(0.01, 8 / Math.max(timelineTrack.clientWidth, 1));
    const rangeWidthRatio = Math.max(endRatio - startRatio, minimumRangeRatio);
    const range = document.createElement("div");

    range.className = `timeline-event-range ${isSelectedEvent(event) ? "is-selected" : ""} ${isMutedByEditMode ? "is-muted" : ""} ${!isVisible ? "is-hidden" : ""}`;
    range.dataset.timelineEventId = event.id;
    range.title = `${event.name} ${event.startTime.toFixed(2)}s - ${endTime.toFixed(2)}s`;
    range.style.left = `${startRatio * 100}%`;
    range.style.width = `${Math.min(rangeWidthRatio, 1 - startRatio) * 100}%`;
    range.style.setProperty("--marker-color", formatColor(event.color));
    range.style.setProperty("--timeline-lane-index", String(laneIndex));
    timelineTrack.appendChild(range);

    marker.type = "button";
    marker.className = `timeline-marker ${isSelectedEvent(event) ? "is-selected" : ""} ${isMutedByEditMode ? "is-muted" : ""} ${!isVisible ? "is-hidden" : ""}`;
    marker.dataset.timelineEventId = event.id;
    marker.title = `${event.name} (${event.startTime.toFixed(2)}s - ${endTime.toFixed(2)}s)`;
    marker.style.left = `${startRatio * 100}%`;
    marker.style.setProperty("--marker-color", formatColor(event.color));
    marker.style.setProperty("--timeline-lane-index", String(laneIndex));
    marker.addEventListener("pointerdown", (pointerEvent) => {
      pointerEvent.stopPropagation();
      const keepMultiSelection = !pointerEvent.ctrlKey && !pointerEvent.metaKey && selectedEventIds.size > 1 && selectedEventIds.has(event.id);

      if (!keepMultiSelection) {
        selectEventFromPointer(event.id, pointerEvent);
      } else {
        selectedEventId = event.id;
        bulkEditPackageId = null;
      }

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
      markerDragOriginalTimes = captureTimelineDragOriginalTimes(event.id);
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
    });
    marker.addEventListener("pointerup", (pointerEvent) => {
      if (markerDraggingId !== event.id) {
        return;
      }

      markerDraggingId = null;
      markerDragHistoryRecorded = false;
      markerDragOriginalTimes.clear();

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
      markerDragOriginalTimes.clear();

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

function getCommonNumberFieldConfigs(events: AttackEvent[]): NumberFieldConfig[] {
  return getCommonFieldConfigs(events, getFieldConfigsFor);
}

function getCommonSelectFieldConfigs(events: AttackEvent[]): SelectFieldConfig[] {
  return getCommonFieldConfigs(events, getSelectConfigsFor);
}

function getCommonCheckboxFieldConfigs(events: AttackEvent[]): CheckboxFieldConfig[] {
  return getCommonFieldConfigs(events, getCheckboxConfigsFor);
}

function getCommonFieldConfigs<TField extends { name: string }>(
  events: AttackEvent[],
  getConfigs: (event: AttackEvent) => TField[],
): TField[] {
  if (events.length === 0) {
    return [];
  }

  const commonNames = new Set(getConfigs(events[0]).map((field) => field.name));

  for (const event of events.slice(1)) {
    const eventFieldNames = new Set(getConfigs(event).map((field) => field.name));

    for (const name of [...commonNames]) {
      if (!eventFieldNames.has(name)) {
        commonNames.delete(name);
      }
    }
  }

  const renderedNames = new Set<string>();

  return getConfigs(events[0]).filter((field) => {
    if (!commonNames.has(field.name) || renderedNames.has(field.name)) {
      return false;
    }

    renderedNames.add(field.name);
    return true;
  });
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

function getBulkNumberValue(events: AttackEvent[], field: NumberFieldConfig): { mixed: boolean; value: string } {
  const firstValue = getNumberField(events[0], field.name);
  const mixed = events.some((event) => getNumberField(event, field.name) !== firstValue);
  const displayValue = mixed ? "" : getDisplayNumberValue(firstValue, field);

  return { mixed, value: displayValue };
}

function getDisplayNumberValue(value: number, field: NumberFieldConfig): string {
  if (propertyTimeMode !== "beats" || !isTimeField(field.name)) {
    return formatPropertyNumber(value);
  }

  if (field.name === "startTime") {
    return formatPropertyNumber(secondsToBeat(value));
  }

  return formatPropertyNumber(secondsToBeatDuration(value));
}

function getBulkSelectValue(events: AttackEvent[], field: SelectFieldConfig): { mixed: boolean; value: string } {
  const firstValue = getSelectFieldValue(events[0], field);
  const mixed = events.some((event) => getSelectFieldValue(event, field) !== firstValue);

  return { mixed, value: firstValue };
}

function getBulkCheckboxValue(events: AttackEvent[], fieldName: string): { mixed: boolean; value: boolean } {
  const firstValue = getNumberField(events[0], fieldName) > 0;
  const mixed = events.some((event) => (getNumberField(event, fieldName) > 0) !== firstValue);

  return { mixed, value: firstValue };
}

function getBulkColorValue(events: AttackEvent[]): { mixed: boolean; value: number } {
  const firstValue = events[0]?.color ?? defaultAttackColor;
  const mixed = events.some((event) => event.color !== firstValue);

  return { mixed, value: firstValue };
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
  pattern.activeDifficulty = isDifficultyId(pattern.activeDifficulty) ? pattern.activeDifficulty : activeDifficultyId;
  activeDifficultyId = pattern.activeDifficulty;

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
  event.difficulty = normalizeDifficultySettings(event.difficulty);

  if (["movingBlock", "wallSweep", "beatPulseRing", "closingWalls", "safeLaneShift"].includes(event.kind)) {
    const warningEvent = event as AttackEvent & { warningAlpha?: number };
    warningEvent.warningAlpha = Number.isFinite(warningEvent.warningAlpha) ? warningEvent.warningAlpha : 0.72;
  }

  if (isAttackPackageEvent(event)) {
    event.previewBulletTexture = normalizePreviewImageAsset(event.previewBulletTexture);
    event.previewBulletTextureScale = clamp(Number(event.previewBulletTextureScale) || 1, previewTextureScaleMin, previewTextureScaleMax);
    event.previewBulletTextureAngle = getPackageBulletTextureAngle(event);
  }

  if (event.kind === "spawn_enemy_origin") {
    event.enemyWarningTime = Number.isFinite(event.enemyWarningTime) ? Math.max(0, event.enemyWarningTime) : 0.55;
    event.enemyEnterEndX = Number.isFinite(event.enemyEnterEndX) ? event.enemyEnterEndX : event.enemyEndX;
    event.enemyEnterEndY = Number.isFinite(event.enemyEnterEndY) ? event.enemyEnterEndY : event.enemyEndY;
    event.previewEnemyTextureScale = clamp(Number(event.previewEnemyTextureScale) || 1, previewTextureScaleMin, previewTextureScaleMax);
    event.previewEnemyTextureAngle = getEnemyTextureAngle(event);
    event.previewEnemyTexture = normalizePreviewImageAsset(event.previewEnemyTexture);
    event.enemyAngle = Number.isFinite(event.enemyAngle) ? event.enemyAngle : 0;
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

function isEventVisibleInActiveDifficulty(event: AttackEvent): boolean {
  return isEventVisible(event) && getDifficultySettings(event, activeDifficultyId).visible !== false;
}

function isParentPackageVisibleInActiveDifficulty(event: AttackEvent): boolean {
  const parent = getParentPackage(event);

  return parent ? isEventVisibleInActiveDifficulty(parent) : true;
}

function isDifficultyId(value: unknown): value is DifficultyId {
  return typeof value === "string" && difficultyIds.includes(value as DifficultyId);
}

function normalizeDifficultySettings(value: unknown): Partial<Record<DifficultyId, EventDifficultySettings>> {
  if (!isRecord(value)) {
    return {};
  }

  const normalized: Partial<Record<DifficultyId, EventDifficultySettings>> = {};

  for (const difficultyId of difficultyIds) {
    const settings = value[difficultyId];

    if (!isRecord(settings)) {
      continue;
    }

    normalized[difficultyId] = {
      visible: typeof settings.visible === "boolean" ? settings.visible : undefined,
      countScale: normalizeScale(settings.countScale, 1),
      warningTimeScale: normalizeScale(settings.warningTimeScale, 1),
      speedScale: normalizeScale(settings.speedScale, 1),
    };
  }

  return normalized;
}

function normalizeScale(value: unknown, fallback: number): number {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? clamp(parsed, 0, 5) : fallback;
}

function getDifficultySettings(event: AttackEvent, difficultyId: DifficultyId): EventDifficultySettings {
  return event.difficulty?.[difficultyId] ?? {};
}

function getSelfDifficultySettings(event: AttackEvent, difficultyId: DifficultyId): Required<EventDifficultySettings> {
  const settings = getDifficultySettings(event, difficultyId);

  return {
    visible: settings.visible !== false,
    countScale: clamp(settings.countScale ?? 1, 0, 5),
    warningTimeScale: clamp(settings.warningTimeScale ?? 1, 0, 5),
    speedScale: clamp(settings.speedScale ?? 1, 0, 5),
  };
}

function getCombinedDifficultySettings(event: AttackEvent, difficultyId: DifficultyId): Required<EventDifficultySettings> {
  const parent = getParentPackage(event);
  const parentSettings = parent ? getSelfDifficultySettings(parent, difficultyId) : undefined;
  const eventSettings = getSelfDifficultySettings(event, difficultyId);

  return {
    visible: (parentSettings?.visible ?? true) && eventSettings.visible,
    countScale: clamp((parentSettings?.countScale ?? 1) * eventSettings.countScale, 0, 5),
    warningTimeScale: clamp((parentSettings?.warningTimeScale ?? 1) * eventSettings.warningTimeScale, 0, 5),
    speedScale: clamp((parentSettings?.speedScale ?? 1) * eventSettings.speedScale, 0, 5),
  };
}

function updateDifficultySettings(event: AttackEvent, difficultyId: DifficultyId, nextSettings: EventDifficultySettings): void {
  event.difficulty = {
    ...(event.difficulty ?? {}),
    [difficultyId]: {
      ...getDifficultySettings(event, difficultyId),
      ...nextSettings,
    },
  };
}

function setDifficultyVisible(event: AttackEvent, visible: boolean): void {
  event.visible = true;
  updateDifficultySettings(event, activeDifficultyId, { visible });
}

function getDifficultyAdjustedEvent(event: AttackEvent, difficultyMode: "combined" | "self" = "combined"): AttackEvent {
  const adjusted = structuredClone(event) as AttackEvent;
  const settings = difficultyMode === "self"
    ? getSelfDifficultySettings(event, activeDifficultyId)
    : getCombinedDifficultySettings(event, activeDifficultyId);

  if (!settings.visible) {
    adjusted.visible = false;
  }

  applyDifficultyScale(adjusted, settings.countScale, countDifficultyFields, true);
  preservePackageCadence(adjusted, event);
  applyDifficultyScale(adjusted, settings.warningTimeScale, warningDifficultyFields, false);
  applyDifficultyScale(adjusted, settings.speedScale, nonNegativeSpeedDifficultyFields, false);
  applyDifficultyScale(adjusted, settings.speedScale, signedSpeedDifficultyFields, false, Number.NEGATIVE_INFINITY);
  if (adjusted.kind === "warningZone" && settings.warningTimeScale !== 1) {
    const warningEndTime = adjusted.startTime + adjusted.duration;
    adjusted.duration = Math.max(0.01, adjusted.duration * settings.warningTimeScale);
    adjusted.startTime = Math.max(0, warningEndTime - adjusted.duration);
  }
  return adjusted;
}

function applyDifficultyScale(event: AttackEvent, scale: number, fields: readonly string[], integer: boolean, minimum = 0): void {
  if (scale === 1) {
    return;
  }

  const record = event as unknown as Record<string, number>;

  for (const field of fields) {
    const value = record[field];

    if (!Number.isFinite(value)) {
      continue;
    }

    const scaled = value * scale;
    record[field] = integer ? Math.max(minimum || 1, Math.round(scaled)) : Math.max(minimum, scaled);
  }
}

function preservePackageCadence(adjusted: AttackEvent, source: AttackEvent): void {
  if (!isAttackPackageEvent(adjusted) || !isAttackPackageEvent(source)) {
    return;
  }

  const originalCount = Math.max(1, Math.round(source.packageCount));
  const adjustedCount = Math.max(1, Math.round(adjusted.packageCount));

  if (originalCount === adjustedCount) {
    return;
  }

  if (usesPackageIntervalCadence(adjusted)) {
    adjusted.packageInterval = getPreservedCadenceValue(source.packageInterval, originalCount, adjustedCount);
  }

  if (adjusted.kind === "package_snake_chain") {
    adjusted.packageSpacing = getPreservedCadenceValue(source.packageSpacing, originalCount, adjustedCount);
  }
}

function usesPackageIntervalCadence(event: AttackPackageEvent): boolean {
  return [
    "package_random_barrage",
    "package_repeating_lasers",
    "package_random_circle",
    "package_grid_square",
    "package_lag_radial",
    "package_area_parallel",
    "package_sequential_lasers",
  ].includes(event.kind);
}

function getPreservedCadenceValue(value: number, originalCount: number, adjustedCount: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return value;
  }

  return (originalCount * value) / adjustedCount;
}

function getDifficultyAdjustedPatternEvents(): AttackEvent[] {
  const adjustedEvents: AttackEvent[] = [];

  for (const event of pattern.events) {
    if (event.packageId) {
      continue;
    }

    if (isAttackPackageEvent(event)) {
      adjustedEvents.push(...getDifficultyAdjustedPackageEvents(event));
    } else {
      adjustedEvents.push(getDifficultyAdjustedEvent(event));
    }
  }

  for (const event of pattern.events) {
    if (event.packageId && !getParentPackage(event)) {
      adjustedEvents.push(getDifficultyAdjustedEvent(event));
    }
  }

  return adjustedEvents;
}

function getDifficultyAdjustedPackageEvents(packageEvent: AttackPackageEvent): AttackEvent[] {
  const adjustedPackage = getDifficultyAdjustedEvent(packageEvent, "self") as AttackPackageEvent;
  const originalChildren = getPackageChildren(packageEvent);

  if (!canGeneratePackageEvents(packageEvent) || !hasPackageGenerationCountChanged(packageEvent, adjustedPackage)) {
    return [adjustedPackage, ...originalChildren.map((child) => getDifficultyAdjustedEvent(child))];
  }

  let generatedChildren: AttackEvent[];
  const generatorPackage = structuredClone(adjustedPackage) as AttackPackageEvent;

  try {
    generatedChildren = createGeneratedEventsForPackage(generatorPackage, pattern.stage);
  } catch (error) {
    console.error(error);
    return [adjustedPackage, ...originalChildren.map((child) => getDifficultyAdjustedEvent(child))];
  }

  const originalChildLookup = createGeneratedChildStateLookup(originalChildren);
  const generatedRoleCounts = new Map<string, number>();
  const adjustedChildren = generatedChildren.map((child, index) => {
    const role = getGeneratedChildRole(child);
    const roleIndex = generatedRoleCounts.get(role) ?? 0;

    generatedRoleCounts.set(role, roleIndex + 1);
    applyGeneratedChildEditorState(child, originalChildLookup.get(`${role}:${roleIndex}`), packageEvent.id, index);
    return getDifficultyAdjustedEvent(child, "self");
  });

  adjustedPackage.generatedEventIds = adjustedChildren.map((child) => child.id);
  adjustedPackage.duration = generatorPackage.duration;
  return [adjustedPackage, ...adjustedChildren];
}

function hasPackageGenerationCountChanged(source: AttackPackageEvent, adjusted: AttackPackageEvent): boolean {
  return readRoundedPackageCount(source.packageCount) !== readRoundedPackageCount(adjusted.packageCount)
    || readRoundedPackageCount(source.packageBulletCount) !== readRoundedPackageCount(adjusted.packageBulletCount);
}

function readRoundedPackageCount(value: number): number {
  return Math.max(0, Math.round(Number(value) || 0));
}

function createGeneratedChildStateLookup(children: AttackEvent[]): Map<string, AttackEvent> {
  const roleCounts = new Map<string, number>();
  const lookup = new Map<string, AttackEvent>();

  for (const child of children) {
    const role = getGeneratedChildRole(child);
    const roleIndex = roleCounts.get(role) ?? 0;

    roleCounts.set(role, roleIndex + 1);
    lookup.set(`${role}:${roleIndex}`, child);
  }

  return lookup;
}

function getGeneratedChildRole(child: AttackEvent): string {
  return child.kind;
}

function applyGeneratedChildEditorState(child: AttackEvent, originalChild: AttackEvent | undefined, packageId: string, index: number): void {
  child.id = originalChild?.id ?? `${packageId}_difficulty_${activeDifficultyId}_${index}_${child.kind}`;

  if (!originalChild) {
    return;
  }

  child.name = originalChild.name;
  child.visible = originalChild.visible !== false && child.visible !== false;
  child.timelineLane = originalChild.timelineLane ?? child.timelineLane;

  if (originalChild.difficulty) {
    child.difficulty = structuredClone(originalChild.difficulty);
  }
}

function getDifficultyAdjustedPattern(): BulletPattern {
  return {
    ...pattern,
    activeDifficulty: activeDifficultyId,
    events: getDifficultyAdjustedPatternEvents(),
  };
}

function handleDifficultyControlInput(event: AttackEvent, input: HTMLInputElement | HTMLSelectElement): void {
  const control = input.dataset.difficultyControl;
  const settings = getDifficultySettings(event, activeDifficultyId);
  let nextSettings: EventDifficultySettings | null = null;

  if (control === "visible" && input instanceof HTMLInputElement) {
    nextSettings = { visible: input.checked };
  } else if (control === "countScale") {
    const value = clamp(Number(input.value), 0, 5);

    if (Number.isFinite(value)) {
      nextSettings = { countScale: value };
    }
  } else if (control === "speedScale") {
    const value = clamp(Number(input.value), 0, 5);

    if (Number.isFinite(value)) {
      nextSettings = { speedScale: value };
    }
  } else if (control === "warningTimeScale") {
    const value = clamp(Number(input.value), 0, 5);

    if (Number.isFinite(value)) {
      nextSettings = { warningTimeScale: value };
    }
  }

  if (!nextSettings) {
    return;
  }

  if ("visible" in nextSettings && nextSettings.visible === settings.visible) {
    return;
  }

  if ("countScale" in nextSettings && nextSettings.countScale === settings.countScale) {
    return;
  }

  if ("speedScale" in nextSettings && nextSettings.speedScale === settings.speedScale) {
    return;
  }

  if ("warningTimeScale" in nextSettings && nextSettings.warningTimeScale === settings.warningTimeScale) {
    return;
  }

  pushHistory();
  if (nextSettings.visible === true) {
    event.visible = true;
  }
  updateDifficultySettings(event, activeDifficultyId, nextSettings);
  invalidatePreviewRenderCache();
  clearAimCache();
  renderEverything();
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

function renderWaveformForTick(): void {
  if (editorMode === "preview" && !previewTimelineVisible) {
    return;
  }

  if (editorMode !== "preview" || !previewLightweightEnabled) {
    renderWaveform();
    return;
  }

  const now = performance.now();

  if (now - lastPreviewWaveformRenderTime < previewWaveformRenderIntervalMs) {
    return;
  }

  lastPreviewWaveformRenderTime = now;
  renderWaveform();
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

function getPackageEventById(eventId: string | null): AttackPackageEvent | undefined {
  return pattern.events.find((event): event is AttackPackageEvent => event.id === eventId && isAttackPackageEvent(event));
}

function getSelectedEnemyEvent(): SpawnEnemyOriginEvent | undefined {
  const selectedEvent = getSelectedEvent();

  return selectedEvent?.kind === "spawn_enemy_origin" ? selectedEvent : undefined;
}

function getEnemyEventById(eventId: string | null): SpawnEnemyOriginEvent | undefined {
  return pattern.events.find((event): event is SpawnEnemyOriginEvent => event.id === eventId && event.kind === "spawn_enemy_origin");
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
      return "敵プレビュー";
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

function cssEscape(value: string): string {
  return typeof CSS !== "undefined" && typeof CSS.escape === "function" ? CSS.escape(value) : value.replace(/["\\]/g, "\\$&");
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
    archive: '<path d="M4 7h16"></path><path d="M5 7v13h14V7"></path><path d="M7 3h10l3 4H4l3-4z"></path><path d="M10 11h4"></path>',
    upload: '<path d="M12 21V9"></path><path d="m7 14 5-5 5 5"></path><path d="M5 3h14"></path>',
    image: '<rect x="3" y="5" width="18" height="14" rx="2"></rect><circle cx="8" cy="10" r="2"></circle><path d="m3 17 5-5 4 4 3-3 6 6"></path>',
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
    enemy: '<path d="M12 3 5 7v7c0 4 3 7 7 7s7-3 7-7V7l-7-4z"></path><circle cx="9" cy="12" r="1"></circle><circle cx="15" cy="12" r="1"></circle><path d="M9 16h6"></path>',
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
