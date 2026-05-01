import "./styles.css";
import { createAttackEvent } from "./core/eventFactory";
import { applyAttackTemplate } from "./core/eventTemplates";
import { createStarterPattern } from "./core/samplePattern";
import { buildAttackFrame, clearAimCache } from "./core/simulation";
import { PlaybackClock } from "./core/playback";
import type { AttackEvent, AttackEventKind, BulletPattern, TimelineSettings } from "./core/types";
import { PreviewStage } from "./preview/PreviewStage";

let pattern = createStarterPattern();
const clock = new PlaybackClock();
let selectedEventId: string | null = pattern.events[0]?.id ?? null;
let timelineDragging = false;
let markerDraggingId: string | null = null;
let markerDragMoved = false;
let markerDragStartX = 0;
let markerDragOriginalTime = 0;
let musicObjectUrl: string | null = null;
let musicPeaks: number[] = [];
let musicChannelData: Float32Array | null = null;
let musicPeakResolution = 0;
let copiedEvent: AttackEvent | null = null;
let timelineZoom = 1;
let markerDragHistoryRecorded = false;
let snapToMeasures = false;
let propertyTimeMode: "seconds" | "beats" = "seconds";
let editingEventId: string | null = null;
let activeInspectorTab: "events" | "properties" | "music" = "events";

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
  { label: "polynomial", fields: ["polynomialA", "polynomialB", "polynomialC", "polynomialD"] },
];

const propertyGroups: PropertyGroupConfig[] = [
  { title: "Timing", numberFields: ["startTime", "duration"] },
  { title: "Fire", checkboxFields: ["aimAtPlayer"], numberFields: ["clipCount", "clipRepeat", "clipInterval", "angleStepDeg", "baseAngleDeg"] },
  { title: "Origin", numberFields: ["originX", "originY", "originVx", "originVy"] },
  { title: "Trajectory", numberFields: ["pathStartX", "pathSpeed", "polynomialA", "polynomialB", "polynomialC", "polynomialD", "gravity"] },
  { title: "Polar", numberFields: ["polarRadius", "polarRadiusVelocity", "polarTheta", "polarThetaVelocity"] },
  { title: "Visual", selectFields: ["typeId"], numberFields: ["visualSize", "visualWidth", "visualHeight", "visualAngle", "angleSpeed"], includeColor: true },
];

const numberFieldConfigs: NumberFieldConfig[] = [
  { name: "startTime", label: "開始時刻", min: 0, max: pattern.duration, step: 0.1, kinds: allKinds() },
  { name: "duration", label: "継続時間", min: 0.1, max: 30, step: 0.1, kinds: allKinds() },
  { name: "originX", label: "発生X", min: -1000, max: 2000, step: 1, kinds: unityMotionKinds() },
  { name: "originY", label: "発生Y", min: -1000, max: 2000, step: 1, kinds: unityMotionKinds() },
  { name: "originVx", label: "発生元速度X", min: -1000, max: 1000, step: 5, kinds: unityMotionKinds() },
  { name: "originVy", label: "発生元速度Y", min: -1000, max: 1000, step: 5, kinds: unityMotionKinds() },
  { name: "polynomialA", label: "カーブt", min: -1000, max: 1000, step: 5, kinds: unityMotionKinds() },
  { name: "polynomialB", label: "カーブt^2", min: -600, max: 600, step: 2, kinds: unityMotionKinds() },
  { name: "polynomialC", label: "カーブt^3", min: -200, max: 200, step: 0.5, kinds: unityMotionKinds() },
  { name: "polynomialD", label: "カーブt^4", min: -60, max: 60, step: 0.1, kinds: unityMotionKinds() },
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
  startTime: "Event start time on the timeline.",
  duration: "How long the spawned attack remains active after it fires.",
  clipCount: "Number of bullets or shapes created at the same firing moment.",
  clipRepeat: "How many times this event fires after the first shot.",
  clipInterval: "Time between repeated fires.",
  angleStepDeg: "Angle difference between bullets in the same spread.",
  baseAngleDeg: "Base firing angle before spread and aiming offsets are applied.",
  aimAtPlayer: "When enabled, each shot aims at the player's position at fire time.",
  originX: "Spawn origin X position in preview coordinates.",
  originY: "Spawn origin Y position in preview coordinates.",
  originVx: "Horizontal velocity applied to the spawn origin.",
  originVy: "Vertical velocity applied to the spawn origin.",
  pathStartX: "Initial local path distance before velocity and curve terms are applied.",
  pathSpeed: "Travel speed along the local trajectory curve.",
  polynomialA: "Coefficient for the local trajectory term t.",
  polynomialB: "Coefficient for the local trajectory term t^2.",
  polynomialC: "Coefficient for the local trajectory term t^3.",
  polynomialD: "Coefficient for the local trajectory term t^4.",
  gravity: "Downward acceleration added while the attack is alive.",
  polarRadius: "Final radius scale applied after the local trajectory is calculated.",
  polarRadiusVelocity: "How much the final radius scale changes over time.",
  polarTheta: "Final polar rotation applied after the local trajectory is calculated.",
  polarThetaVelocity: "How quickly the final polar rotation changes over time.",
  typeId: "Visual preset used to draw this attack.",
  visualSize: "Base size for round or single-size visual presets.",
  visualWidth: "Width used by rectangular, wall, and laser visual presets.",
  visualHeight: "Height used by rectangular, wall, and laser visual presets.",
  visualAngle: "Extra visual rotation in degrees.",
  angleSpeed: "Visual rotation speed in degrees per second.",
  color: "Attack color shown in the preview and timeline.",
  musicOffset: "Time offset where the music grid starts. Use this to align beat lines to the song.",
  bpm: "Beats per minute. Changing this also updates one-measure time.",
  measureSeconds: "Duration of one measure in seconds. Changing this also updates BPM.",
  beatsPerMeasure: "Number of beats contained in one measure.",
  volume: "Music playback volume.",
};

const appRoot = document.querySelector<HTMLDivElement>("#app");

if (!appRoot) {
  throw new Error("#app was not found.");
}

appRoot.innerHTML = `
  <div class="app-shell">
    <header class="toolbar">
      <div class="brand">
        <div class="brand-title">弾幕メーカー v0.4</div>
      </div>
      <nav class="menu-bar" aria-label="メインメニュー">
        <div class="menu">
          <button class="menu-button" type="button" data-menu-button="file">ファイル</button>
          <div class="menu-popover" data-menu="file">
            <button id="export-button" class="menu-item" type="button">${iconSvg("download")}<span>書き出し</span></button>
            <button id="import-button" class="menu-item" type="button">${iconSvg("upload")}<span>読み込み</span></button>
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
        </div>
      </nav>
      <div class="hidden-inputs">
        <input id="import-input" type="file" accept="application/json,.json" hidden />
        <input id="music-input" type="file" accept="audio/*" hidden />
      </div>
      <div class="toolbar-spacer"></div>
      <div id="time-display" class="time-display">0.00s / ${pattern.duration.toFixed(2)}s</div>
    </header>

    <main class="workspace">
      <section class="preview-panel">
        <div id="preview-host"></div>
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
        </div>
        <div class="timeline-playback-tools" aria-label="再生操作">
          <button id="reset-button" class="icon-button" type="button" title="リセット" aria-label="リセット">${iconSvg("rewind")}</button>
          <button id="play-button" class="icon-button" type="button" title="再生" aria-label="再生">${iconSvg("play")}</button>
        </div>
        <span id="timeline-zoom-display" class="timeline-zoom-display">100%</span>
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

const previewHost = requireElement<HTMLDivElement>("#preview-host");
const previewPanel = requireElement<HTMLElement>(".preview-panel");
const playButton = requireElement<HTMLButtonElement>("#play-button");
const resetButton = requireElement<HTMLButtonElement>("#reset-button");
const exportButton = requireElement<HTMLButtonElement>("#export-button");
const importButton = requireElement<HTMLButtonElement>("#import-button");
const musicButton = requireElement<HTMLButtonElement>("#music-button");
const undoButton = requireElement<HTMLButtonElement>("#undo-button");
const redoButton = requireElement<HTMLButtonElement>("#redo-button");
const importInput = requireElement<HTMLInputElement>("#import-input");
const musicInput = requireElement<HTMLInputElement>("#music-input");
const timeDisplay = requireElement<HTMLDivElement>("#time-display");
const musicDisplay = requireElement<HTMLDivElement>("#music-display");
const eventList = requireElement<HTMLDivElement>("#event-list");
const propertyForm = requireElement<HTMLFormElement>("#property-form");
const timelineViewport = requireElement<HTMLDivElement>("#timeline-viewport");
const timelineContent = requireElement<HTMLDivElement>("#timeline-content");
const timelineTrack = requireElement<HTMLDivElement>("#timeline-track");
const timelinePlayhead = requireElement<HTMLDivElement>("#timeline-playhead");
const snapToggleButton = requireElement<HTMLButtonElement>("#snap-toggle-button");
const waveformCanvas = requireElement<HTMLCanvasElement>("#waveform-canvas");
const musicOffsetInput = requireElement<HTMLInputElement>("#music-offset-input");
const bpmInput = requireElement<HTMLInputElement>("#bpm-input");
const measureIntervalInput = requireElement<HTMLInputElement>("#measure-interval-input");
const beatsPerMeasureInput = requireElement<HTMLInputElement>("#beats-per-measure-input");
const musicVolumeInput = requireElement<HTMLInputElement>("#music-volume-input");
const timelineZoomDisplay = requireElement<HTMLSpanElement>("#timeline-zoom-display");
const menuButtons = [...document.querySelectorAll<HTMLButtonElement>("[data-menu-button]")];
const menuPopovers = [...document.querySelectorAll<HTMLDivElement>("[data-menu]")];
const inspectorTabButtons = [...document.querySelectorAll<HTMLButtonElement>("[data-inspector-tab]")];
const inspectorPanels = [...document.querySelectorAll<HTMLElement>("[data-inspector-panel]")];

const preview = new PreviewStage(pattern.stage);
await preview.mount(previewHost);

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

    if (nextTab === "events" || nextTab === "properties" || nextTab === "music") {
      activeInspectorTab = nextTab;
      renderInspectorTabs();
    }
  });
});

document.addEventListener("click", (event) => {
  if (event.target instanceof Element && event.target.closest(".menu")) {
    return;
  }

  closeMenus();
});

playButton.addEventListener("click", () => {
  togglePlayback();
});

resetButton.addEventListener("click", () => {
  resetPlayback();
  renderEverything();
});

exportButton.addEventListener("click", () => {
  closeMenus();
  exportPattern();
});

importButton.addEventListener("click", () => {
  closeMenus();
  importInput.click();
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

importInput.addEventListener("change", () => {
  const file = importInput.files?.[0];

  if (!file) {
    return;
  }

  void importPattern(file);
  importInput.value = "";
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

document.querySelectorAll<HTMLButtonElement>("[data-add-kind]").forEach((button) => {
  button.addEventListener("click", () => {
    const kind = button.dataset.addKind as AttackEventKind;
    const event = createAttackEvent(kind, clock.time, pattern.stage);

    applyAttackTemplate(event, button.dataset.addTemplate, pattern.stage);
    pushHistory();
    pattern.events.push(event);
    sortEvents();
    selectedEventId = event.id;
    closeMenus();
    renderEverything();
  });
});

document.addEventListener("keydown", (event) => {
  const usesCommandKey = event.ctrlKey || event.metaKey;

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

  if (target.id === "edit-mode-button") {
    const selectedEvent = getSelectedEvent();

    editingEventId = editingEventId === selectedEvent?.id ? null : selectedEvent?.id ?? null;
    renderEverything();
    return;
  }

  if (target.id !== "delete-event-button") {
    return;
  }

  deleteSelectedEvent();
});

propertyForm.addEventListener("input", handlePropertyUpdate);
propertyForm.addEventListener("change", handlePropertyUpdate);

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

preview.onTick((deltaSeconds) => {
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
  attackEvent.startTime = Number(getSnappedEventTime(rawTime).toFixed(2));
  clearAimCache();

  updateStartTimeInput(attackEvent.startTime);
  renderEventList();
  renderPreview();
}

function exportPattern(): void {
  const data = JSON.stringify(pattern, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = `${pattern.title.replace(/[^\w-]+/g, "_") || "danmaku_pattern"}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function importPattern(file: File): Promise<void> {
  try {
    const text = await file.text();
    const parsed = JSON.parse(text) as Partial<BulletPattern>;

    if (parsed.version !== 1 || !Array.isArray(parsed.events) || !parsed.stage) {
      throw new Error("Invalid pattern file.");
    }

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
      events: parsed.events.map((event) => normalizeImportedEvent(event, parsed.stage!)),
    };
    if (hasMusic()) {
      pattern.duration = Math.max(pattern.duration, audio.duration);
    }
    selectedEventId = pattern.events[0]?.id ?? null;
    editingEventId = null;
    resetPlayback();
    renderEverything();
  } catch (error) {
    console.error(error);
    window.alert("JSONを読み込めませんでした。弾幕データの形式を確認してください。");
  }
}

async function loadMusic(file: File): Promise<void> {
  if (musicObjectUrl) {
    URL.revokeObjectURL(musicObjectUrl);
  }

  stopPlayback();
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

function normalizeImportedEvent(rawEvent: unknown, stage: BulletPattern["stage"]): AttackEvent {
  const event = rawEvent as Partial<AttackEvent>;
  const kind = typeof event.kind === "string" && isAttackEventKind(event.kind) ? event.kind : "radialBurst";
  const startTime = typeof event.startTime === "number" ? event.startTime : 0;
  const defaults = createAttackEvent(kind, startTime, stage);

  return {
    ...defaults,
    ...event,
    kind,
  } as AttackEvent;
}

function isAttackEventKind(kind: string): kind is AttackEventKind {
  return allKinds().includes(kind as AttackEventKind);
}

function renderEverything(): void {
  ensureTimelineSettings();
  ensureEditModeState();
  renderTimelineScale();
  resizePreviewHost();
  renderInspectorTabs();
  renderEventList();
  renderPropertyForm();
  renderTimelineMarkers();
  syncTimelineInputs();
  renderWaveform();
  renderPreview();
  syncUi();
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
  const availableWidth = Math.max(1, panelBounds.width - 20);
  const availableHeight = Math.max(1, panelBounds.height - 20);
  const stageRatio = pattern.stage.width / pattern.stage.height;
  let width = availableWidth;
  let height = width / stageRatio;

  if (height > availableHeight) {
    height = availableHeight;
    width = height * stageRatio;
  }

  previewHost.style.width = `${Math.floor(width)}px`;
  previewHost.style.height = `${Math.floor(height)}px`;
}

function ensureEditModeState(): void {
  if (editingEventId && !pattern.events.some((event) => event.id === editingEventId)) {
    editingEventId = null;
  }
}

function renderPreview(): void {
  const previewEvents = getPreviewEvents();
  const editingEvent = getEditingEvent();

  preview.render({
    frame: buildAttackFrame(previewEvents, clock.time, pattern.stage, preview.getPlayerPosition()),
    currentTime: clock.time,
    duration: pattern.duration,
    events: previewEvents,
    selectedEventId,
    editEventId: editingEventId,
    trajectories: editingEvent ? buildEditTrajectories(editingEvent) : [],
  });
}

function getPreviewEvents(): AttackEvent[] {
  const editingEvent = getEditingEvent();

  return editingEvent ? [editingEvent] : pattern.events;
}

function getEditingEvent(): AttackEvent | undefined {
  if (!editingEventId) {
    return undefined;
  }

  return pattern.events.find((event) => event.id === editingEventId);
}

function buildEditTrajectories(event: AttackEvent): TrajectoryRender[] {
  const startTime = Math.max(0, event.startTime);
  const endTime = Math.min(pattern.duration, getEventEndTime(event));
  const duration = Math.max(0.1, endTime - startTime);
  const sampleCount = Math.max(96, Math.min(360, Math.ceil(duration * 60)));
  const tracks = new Map<string, TrajectoryRender>();
  const playerPosition = preview.getPlayerPosition();

  for (let sampleIndex = 0; sampleIndex <= sampleCount; sampleIndex += 1) {
    const time = startTime + (duration * sampleIndex) / sampleCount;
    const frame = buildAttackFrame([event], time, pattern.stage, playerPosition);

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

function syncUi(): void {
  timeDisplay.textContent = `${clock.time.toFixed(2)}s / ${pattern.duration.toFixed(2)}s`;
  timelinePlayhead.style.left = `${(clock.time / pattern.duration) * 100}%`;
  syncPlaybackButton();
  syncHistoryButtons();
  syncSnapButton();
  musicDisplay.classList.toggle("has-music", hasMusic());
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
  clearAimCache();

  if (hasMusic()) {
    pattern.duration = Math.max(pattern.duration, audio.duration);
  }

  if (clock.time > pattern.duration) {
    clock.seek(pattern.duration, pattern.duration);
    syncAudioToClock();
  }

    if (!pattern.events.some((event) => event.id === selectedEventId)) {
      selectedEventId = pattern.events[0]?.id ?? null;
    }

    if (!pattern.events.some((event) => event.id === editingEventId)) {
      editingEventId = null;
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

function renderEventList(): void {
  eventList.innerHTML = "";

  for (const event of pattern.events) {
    const card = document.createElement("button");
    const endTime = getEventEndTime(event);
    const isLockedByEditMode = editingEventId !== null && event.id !== editingEventId;

    card.className = `event-card ${event.id === selectedEventId ? "is-selected" : ""} ${isLockedByEditMode ? "is-disabled" : ""}`;
    card.type = "button";
    card.disabled = isLockedByEditMode;
    card.innerHTML = `
      <div class="event-card-main">
        <div class="event-card-title">
          <span class="event-swatch" style="background: ${formatColor(event.color)}"></span>
          <span>${escapeHtml(event.name)}</span>
        </div>
        <span class="event-time">${event.startTime.toFixed(2)}s - ${endTime.toFixed(2)}s</span>
      </div>
    `;
    card.addEventListener("click", () => {
      if (editingEventId && event.id !== editingEventId) {
        return;
      }

      selectedEventId = event.id;
      renderEverything();
    });
    card.addEventListener("dblclick", () => {
      if (editingEventId && event.id !== editingEventId) {
        return;
      }

      selectedEventId = event.id;
      activeInspectorTab = "properties";
      renderEverything();
    });
    eventList.appendChild(card);
  }
}

function getEventEndTime(event: AttackEvent): number {
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
    <button id="edit-mode-button" class="edit-mode-button ${editingEventId === selectedEvent.id ? "is-active" : ""}" type="button">
      ${editingEventId === selectedEvent.id ? "Exit edit mode" : "Edit trajectory"}
    </button>
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

function getPropertyDescription(name: string): string {
  return propertyDescriptions[name] ?? "Parameter for the selected attack preset.";
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
  timelineTrack.querySelectorAll(".timeline-marker, .timeline-event-range, .beat-grid-line").forEach((marker) => marker.remove());
  renderGridLines(timelineTrack, "track");

  for (const event of pattern.events) {
    const marker = document.createElement("button");
    const isLockedByEditMode = editingEventId !== null && event.id !== editingEventId;
    const startRatio = clamp(event.startTime / pattern.duration, 0, 1);
    const endTime = getEventEndTime(event);
    const endRatio = clamp(endTime / pattern.duration, startRatio, 1);
    const minimumRangeRatio = Math.min(0.01, 8 / Math.max(timelineTrack.clientWidth, 1));
    const rangeWidthRatio = Math.max(endRatio - startRatio, minimumRangeRatio);
    const range = document.createElement("div");

    range.className = `timeline-event-range ${event.id === selectedEventId ? "is-selected" : ""} ${isLockedByEditMode ? "is-disabled" : ""}`;
    range.title = `${event.name} ${event.startTime.toFixed(2)}s - ${endTime.toFixed(2)}s`;
    range.style.left = `${startRatio * 100}%`;
    range.style.width = `${Math.min(rangeWidthRatio, 1 - startRatio) * 100}%`;
    range.style.setProperty("--marker-color", formatColor(event.color));
    timelineTrack.appendChild(range);

    marker.type = "button";
    marker.className = `timeline-marker ${event.id === selectedEventId ? "is-selected" : ""} ${isLockedByEditMode ? "is-disabled" : ""}`;
    marker.title = `${event.name} (${event.startTime.toFixed(2)}s - ${endTime.toFixed(2)}s)`;
    marker.disabled = isLockedByEditMode;
    marker.style.left = `${startRatio * 100}%`;
    marker.style.setProperty("--marker-color", formatColor(event.color));
    marker.addEventListener("pointerdown", (pointerEvent) => {
      if (editingEventId && event.id !== editingEventId) {
        return;
      }

      pointerEvent.stopPropagation();
      selectedEventId = event.id;
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
    marker.addEventListener("click", () => {
      if (editingEventId && event.id !== editingEventId) {
        return;
      }

      if (markerDragMoved) {
        markerDragMoved = false;
        return;
      }

      selectedEventId = event.id;
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
    return "polynomial t";
  }

  if (field.name === "polynomialB") {
    return "polynomial t^2";
  }

  if (field.name === "polynomialC") {
    return "polynomial t^3";
  }

  if (field.name === "polynomialD") {
    return "polynomial t^4";
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
  const selectedEvent = getSelectedEvent();

  if (!selectedEvent) {
    return;
  }

  const deletedIndex = pattern.events.findIndex((event) => event.id === selectedEvent.id);

  pushHistory();
  pattern.events = pattern.events.filter((event) => event.id !== selectedEvent.id);

  if (editingEventId === selectedEvent.id) {
    editingEventId = null;
  }

  selectedEventId = pattern.events[Math.min(deletedIndex, pattern.events.length - 1)]?.id ?? null;
  renderEverything();
}

function copySelectedEvent(): void {
  const selectedEvent = getSelectedEvent();

  if (!selectedEvent) {
    return;
  }

  copiedEvent = structuredClone(selectedEvent);
}

function pasteCopiedEvent(): void {
  if (!copiedEvent) {
    return;
  }

  const event = structuredClone(copiedEvent);
  event.id = `${event.id}_copy_${Date.now().toString(36)}`;
  event.name = `${event.name} Copy`;
  event.startTime = Number(clamp(clock.time, 0, pattern.duration).toFixed(2));
  pushHistory();
  pattern.events.push(event);
  selectedEventId = event.id;
  sortEvents();
  renderEverything();
}

function sortEvents(): void {
  pattern.events.sort((a, b) => a.startTime - b.startTime);
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
    music: '<path d="M9 18V5l11-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="17" cy="16" r="3"></circle>',
    volume: '<path d="M4 10v4h4l5 4V6l-5 4H4z"></path><path d="M16 9c1 .8 1.5 1.8 1.5 3s-.5 2.2-1.5 3"></path><path d="M18.5 6.5A8 8 0 0 1 21 12a8 8 0 0 1-2.5 5.5"></path>',
    circle: '<circle cx="12" cy="12" r="7"></circle><path d="M12 2v3"></path><path d="M12 19v3"></path><path d="M2 12h3"></path><path d="M19 12h3"></path>',
    wall: '<path d="M4 5h16v14H4z"></path><path d="M4 10h16"></path><path d="M9 5v5"></path><path d="M15 10v9"></path>',
    laser: '<path d="M4 12h16"></path><path d="m16 8 4 4-4 4"></path><path d="M4 8v8"></path>',
    rotate: '<path d="M21 12a9 9 0 1 1-3-6.7"></path><path d="M21 4v6h-6"></path>',
  };

  return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${paths[name] ?? ""}</svg>`;
}
