import type { AttackEvent, AttackEventKind, BulletMotionFields, StageSize } from "./types";

let eventSerial = 100;

export function createAttackEvent(kind: AttackEventKind, startTime: number, stage: StageSize): AttackEvent {
  const safeStartTime = Number(startTime.toFixed(2));
  const id = `event_${kind}_${eventSerial++}`;
  const baseMotion = createDefaultMotion(stage);

  switch (kind) {
    case "spawn_bullet":
      return {
        id,
        kind,
        name: "単発弾",
        startTime: safeStartTime,
        duration: 4,
        color: 0xff2f4f,
        ...baseMotion,
      };
    case "spawn_bullet_spread":
      return {
        id,
        kind,
        name: "扇状連射",
        startTime: safeStartTime,
        duration: 4,
        color: 0xff2f4f,
        ...baseMotion,
        clipCount: 5,
        clipInterval: 0.3,
        clipRepeat: 3,
        angleStepDeg: 14,
        baseAngleDeg: -90,
        aimAtPlayer: 0,
      };
    case "spawn_aimed_spread":
      return {
        id,
        kind,
        name: "自機狙い3Way",
        startTime: safeStartTime,
        duration: 4,
        color: 0xff2f4f,
        ...baseMotion,
        clipCount: 3,
        clipInterval: 0.3,
        clipRepeat: 8,
        angleStepDeg: 30,
        baseAngleDeg: 0,
        aimAtPlayer: 1,
      };
    case "spawn_radial":
      return {
        id,
        kind,
        name: "円形バースト",
        startTime: safeStartTime,
        duration: 4,
        color: 0xff2f93,
        ...baseMotion,
        aimAtPlayer: 0,
        radialCount: 16,
        radialRepeat: 2,
        radialInterval: 0.8,
        radialStartAngle: 0,
      };
    case "spawn_enemy_origin":
      return {
        id,
        kind,
        name: "敵プレビュー",
        startTime: safeStartTime,
        duration: 4,
        color: 0xffffff,
        ...baseMotion,
        originSize: 34,
        enemyStartX: stage.width / 2,
        enemyStartY: -60,
        enemyEndX: stage.width / 2,
        enemyEndY: stage.height * 0.28,
        enemyEnterTime: 0.42,
        enemyExitTime: 0.28,
      };
    case "fire_from_moving_origin":
      return {
        id,
        kind,
        name: "移動源連射",
        startTime: safeStartTime,
        duration: 4,
        color: 0xff2f4f,
        ...baseMotion,
        originVx: 55,
        clipCount: 4,
        clipInterval: 0.25,
        clipRepeat: 8,
        angleStepDeg: 18,
        baseAngleDeg: -90,
        aimAtPlayer: 0,
      };
    case "spawn_curved_laser":
      return {
        id,
        kind,
        name: "カーブレーザー",
        startTime: safeStartTime,
        duration: 4,
        color: 0xff2f4f,
        ...baseMotion,
        polynomialA: -0.18,
        polynomialB: 0.11,
        polynomialC: -0.01,
        polynomialD: 0,
        pathSpeed: 190,
        laserCount: 8,
        laserAngleStepDeg: 45,
        laserWidth: 10,
        laserLength: 280,
        growSpeed: 190,
      };
    case "transform_bullet":
      return {
        id,
        kind,
        name: "弾変化キュー",
        startTime: safeStartTime,
        duration: 0.8,
        color: 0xffd166,
        triggerTime: 0.4,
        targetTypeId: 0,
        nextTypeId: 1,
        nextSpeed: 240,
        nextAngleDeg: -90,
      };
    case "radialBurst":
      return {
        id,
        kind,
        name: "円形バースト",
        startTime: safeStartTime,
        duration: 2.4,
        color: 0xff2f93,
        x: stage.width / 2,
        y: stage.height / 2,
        bulletCount: 16,
        bulletSpeed: 210,
        bulletRadius: 8,
        startAngle: -90,
        arcDegrees: 360,
        repeatCount: 1,
        repeatInterval: 0,
      };
    case "aimedSpread":
      return {
        id,
        kind,
        name: "3way自機狙い",
        startTime: safeStartTime,
        duration: 2.8,
        color: 0xff2f4f,
        x: stage.width / 2,
        y: 96,
        targetX: stage.width / 2,
        targetY: stage.height * 0.72,
        wayCount: 3,
        spreadDegrees: 60,
        bulletSpeed: 250,
        bulletRadius: 7,
        fireCount: 8,
        fireInterval: 0.3,
        aimOffsetDegrees: 0,
      };
    case "bossMirroredFan":
      return {
        id,
        kind,
        name: "Bossミラーファン",
        startTime: safeStartTime,
        duration: 4,
        color: 0x2776ff,
        x: stage.width / 2,
        y: 96,
        targetX: stage.width / 2,
        targetY: stage.height * 0.72,
        angleCount: 16,
        speedLayers: 3,
        angleStepDegrees: 8,
        angleOffsetDegrees: 32,
        minSpeed: 140,
        speedStep: 70,
        bulletRadius: 5,
        fireCount: 6,
        fireInterval: 0.6,
      };
    case "polynomialProjectile":
      return {
        id,
        kind,
        name: "多項式軌道弾",
        startTime: safeStartTime,
        duration: 4,
        color: 0xff365f,
        x: stage.width / 2,
        y: stage.height / 2,
        originVx: 0,
        originVy: 0,
        bulletCount: 6,
        spreadDegrees: 360,
        startAngle: -90,
        bulletSpeed: 180,
        bulletRadius: 7,
        curveA: 34,
        curveB: -8,
        thetaVelocity: 120,
        gravity: 0,
        fireCount: 1,
        fireInterval: 0,
      };
    case "curvedLaserRing":
      return {
        id,
        kind,
        name: "8方向カーブレーザー",
        startTime: safeStartTime,
        duration: 4,
        color: 0xff2f4f,
        x: stage.width / 2,
        y: stage.height / 2,
        laserCount: 8,
        startAngle: 0,
        width: 10,
        length: 280,
        extendSpeed: 190,
        rotationSpeed: 18,
        curveA: -40,
        curveB: 22,
      };
    case "warningZone":
      return {
        id,
        kind,
        name: "予告ゾーン",
        startTime: safeStartTime,
        duration: 1.2,
        color: 0xff2f4f,
        shape: "rectangle",
        x: stage.width / 2,
        y: stage.height / 2,
        width: 260,
        height: 90,
        radius: 80,
        angle: 0,
        sides: 5,
        blinkRate: 6,
        zoneAlpha: 0.28,
      };
    case "movingBlock":
      return {
        id,
        kind,
        name: "移動ブロック",
        startTime: safeStartTime,
        duration: 2.4,
        color: 0xff2f4f,
        shape: "rectangle",
        startX: 120,
        startY: stage.height / 2,
        endX: stage.width - 120,
        endY: stage.height / 2,
        width: 120,
        height: 70,
        radius: 54,
        sides: 4,
        rotationStart: 0,
        rotationSpeed: 120,
        warningTime: 0.7,
        warningAlpha: 0.72,
      };
    case "beatPulseRing":
      return {
        id,
        kind,
        name: "拍動リング",
        startTime: safeStartTime,
        duration: 0.8,
        color: 0xff2f4f,
        shape: "circle",
        x: stage.width / 2,
        y: stage.height / 2,
        startSize: 60,
        endSize: 420,
        thickness: 18,
        repeatCount: 4,
        repeatInterval: 0.5,
        warningTime: 0.4,
        warningAlpha: 0.72,
      };
    case "closingWalls":
      return {
        id,
        kind,
        name: "迫る外壁",
        startTime: safeStartTime,
        duration: 3.2,
        color: 0xff2f4f,
        mode: "horizontal",
        distance: 210,
        thickness: 90,
        moveTime: 0.9,
        holdTime: 1.2,
        returnTime: 0.9,
        warningTime: 0.8,
        warningAlpha: 0.72,
      };
    case "safeLaneShift":
      return {
        id,
        kind,
        name: "安全レーン切替",
        startTime: safeStartTime,
        duration: 4,
        color: 0xff2f4f,
        orientation: "vertical",
        laneWidth: 180,
        firstLaneCenter: stage.width * 0.3,
        secondLaneCenter: stage.width * 0.7,
        switchInterval: 1,
        switchCount: 4,
        warningTime: 0.7,
        warningAlpha: 0.72,
      };
    case "wallSweep":
      return {
        id,
        kind,
        name: "迫る壁",
        startTime: safeStartTime,
        duration: 2.2,
        color: 0xff4fb8,
        edge: "left",
        thickness: 70,
        length: stage.height,
        offset: stage.height / 2,
        safeGapSize: 140,
        safeGapCenter: stage.height / 2,
        warningTime: 0.6,
        warningAlpha: 0.72,
      };
    case "laserBeam":
      return {
        id,
        kind,
        name: "レーザー",
        startTime: safeStartTime,
        duration: 1.4,
        color: 0x36f5ff,
        x: stage.width / 2,
        y: stage.height / 2,
        length: stage.width * 0.95,
        width: 28,
        angle: 0,
      };
    case "rotatingShape":
      return {
        id,
        kind,
        name: "回転図形",
        startTime: safeStartTime,
        duration: 4,
        color: 0xffd166,
        x: stage.width / 2,
        y: stage.height / 2,
        orbitRadius: 120,
        size: 36,
        sides: 4,
        startAngle: 0,
        rotationSpeed: 120,
      };
  }

  throw new Error(`Unsupported attack event kind: ${kind}`);
}

function createDefaultMotion(stage: StageSize): BulletMotionFields {
  return {
    originX: stage.width / 2,
    originY: stage.height * 0.35,
    originVx: 0,
    originVy: 0,
    polynomialA: 0,
    polynomialB: 0,
    polynomialC: 0,
    polynomialD: 0,
    pathStartX: 0,
    pathSpeed: 230,
    polarRadius: 1,
    polarRadiusVelocity: 0,
    polarTheta: 90,
    polarThetaVelocity: 0,
    gravity: 0,
    angleSpeed: 0,
    typeId: 0,
    visualSize: 8,
    visualPreset: "bullet",
    visualWidth: 18,
    visualHeight: 18,
    visualAngle: 0,
  };
}
