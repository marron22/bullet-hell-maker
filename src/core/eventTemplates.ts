import type {
  AttackEvent,
  BulletMotionFields,
  FireClipFields,
  StageSize,
} from "./types";

export type AttackTemplateId =
  | "single-bullet"
  | "aimed-3way"
  | "fan-burst"
  | "radial-burst"
  | "horizontal-laser"
  | "left-wall"
  | "boss-fan"
  | "polynomial-radial"
  | "curved-laser-ring"
  | "orbiting-diamond";

export function applyAttackTemplate(event: AttackEvent, template: string | undefined, stage: StageSize): void {
  if (!template || !hasBulletMotionFields(event)) {
    return;
  }

  resetMotion(event, stage);

  switch (template as AttackTemplateId) {
    case "single-bullet":
      applySingleBullet(event, stage);
      return;
    case "aimed-3way":
      if (hasFireClipFields(event)) {
        applyAimed3Way(event, stage);
      }
      return;
    case "fan-burst":
      if (hasFireClipFields(event)) {
        applyFanBurst(event, stage);
      }
      return;
    case "radial-burst":
      if (hasFireClipFields(event)) {
        applyRadialBurst(event, stage);
      }
      return;
    case "horizontal-laser":
      applyHorizontalLaser(event, stage);
      return;
    case "left-wall":
      applyLeftWall(event, stage);
      return;
    case "boss-fan":
      if (hasFireClipFields(event)) {
        applyBossFan(event, stage);
      }
      return;
    case "polynomial-radial":
      if (hasFireClipFields(event)) {
        applyPolynomialRadial(event, stage);
      }
      return;
    case "curved-laser-ring":
      if (hasFireClipFields(event)) {
        applyCurvedLaserRing(event, stage);
      }
      return;
    case "orbiting-diamond":
      applyOrbitingDiamond(event, stage);
      return;
  }
}

function resetMotion(event: AttackEvent & BulletMotionFields, stage: StageSize): void {
  event.originX = stage.width / 2;
  event.originY = stage.height / 2;
  event.originVx = 0;
  event.originVy = 0;
  event.pathStartX = 0;
  event.pathSpeed = 220;
  event.polynomialA = 0;
  event.polynomialB = 0;
  event.polynomialC = 0;
  event.polynomialD = 0;
  event.polarRadius = 1;
  event.polarRadiusVelocity = 0;
  event.polarTheta = -90;
  event.polarThetaVelocity = 0;
  event.gravity = 0;
  event.angleSpeed = 0;
  event.typeId = 0;
  event.visualPreset = "bullet";
  event.visualSize = 8;
  event.visualWidth = 18;
  event.visualHeight = 18;
  event.visualAngle = 0;
}

function applySingleBullet(event: AttackEvent & BulletMotionFields, stage: StageSize): void {
  event.name = "単発弾";
  event.duration = 4;
  event.color = 0xff2f4f;
  event.originX = stage.width / 2;
  event.originY = stage.height * 0.28;
  event.pathSpeed = 260;
  event.polarTheta = 90;

  if (hasFireClipFields(event)) {
    event.aimAtPlayer = 0;
    event.clipCount = 1;
    event.clipRepeat = 1;
    event.clipInterval = 0;
    event.angleStepDeg = 0;
    event.baseAngleDeg = 0;
  }
}

function applyAimed3Way(event: AttackEvent & BulletMotionFields & FireClipFields, stage: StageSize): void {
  event.name = "自機狙い3Way";
  event.duration = 3.4;
  event.color = 0xff2f4f;
  event.originX = stage.width / 2;
  event.originY = 90;
  event.pathSpeed = 250;
  event.polarTheta = 0;
  event.clipCount = 3;
  event.clipInterval = 0.3;
  event.clipRepeat = 8;
  event.angleStepDeg = 30;
  event.baseAngleDeg = 0;
  event.aimAtPlayer = 1;
}

function applyFanBurst(event: AttackEvent & BulletMotionFields & FireClipFields, stage: StageSize): void {
  event.name = "扇状連射";
  event.duration = 3.8;
  event.color = 0xff2f93;
  event.originX = stage.width / 2;
  event.originY = stage.height * 0.3;
  event.pathSpeed = 230;
  event.polarTheta = 90;
  event.clipCount = 7;
  event.clipInterval = 0.28;
  event.clipRepeat = 9;
  event.angleStepDeg = 12;
  event.baseAngleDeg = 0;
  event.aimAtPlayer = 0;
}

function applyRadialBurst(event: AttackEvent & BulletMotionFields & FireClipFields, stage: StageSize): void {
  event.name = "円形バースト";
  event.duration = 3.6;
  event.color = 0xff2f4f;
  event.originX = stage.width / 2;
  event.originY = stage.height / 2;
  event.pathSpeed = 190;
  event.polarTheta = 0;
  event.aimAtPlayer = 0;
  event.clipCount = 18;
  event.clipRepeat = 3;
  event.clipInterval = 0.6;
  event.angleStepDeg = 360 / 18;
  event.baseAngleDeg = 0;
  event.visualSize = 7;
  event.visualWidth = 16;
  event.visualHeight = 16;
}

function applyHorizontalLaser(event: AttackEvent & BulletMotionFields, stage: StageSize): void {
  event.name = "水平レーザー";
  event.duration = 1.5;
  event.color = 0xff2f4f;
  event.originX = stage.width / 2;
  event.originY = stage.height / 2;
  event.pathSpeed = 0;
  event.polarTheta = 0;
  event.visualSize = 12;
  event.typeId = 4;
  event.visualPreset = "laser";
  event.visualWidth = stage.width * 0.92;
  event.visualHeight = 26;
  event.visualAngle = 0;

  if (hasFireClipFields(event)) {
    event.aimAtPlayer = 0;
    event.clipCount = 1;
    event.clipRepeat = 1;
    event.clipInterval = 0;
    event.angleStepDeg = 0;
    event.baseAngleDeg = 0;
  }
}

function applyLeftWall(event: AttackEvent & BulletMotionFields, stage: StageSize): void {
  event.name = "左壁スイープ";
  event.duration = 5;
  event.color = 0xff2f4f;
  event.originX = -50;
  event.originY = stage.height / 2;
  event.pathSpeed = 260;
  event.polarTheta = 0;
  event.visualSize = 18;
  event.typeId = 3;
  event.visualPreset = "wall";
  event.visualWidth = 100;
  event.visualHeight = stage.height;
  event.visualAngle = 0;

  if (hasFireClipFields(event)) {
    event.aimAtPlayer = 0;
    event.clipCount = 1;
    event.clipRepeat = 1;
    event.clipInterval = 0;
    event.angleStepDeg = 0;
    event.baseAngleDeg = 0;
  }
}

function applyBossFan(event: AttackEvent & BulletMotionFields & FireClipFields, stage: StageSize): void {
  event.name = "ボス扇弾";
  event.duration = 4.8;
  event.color = 0x2776ff;
  event.originX = stage.width / 2;
  event.originY = 96;
  event.pathSpeed = 210;
  event.polarTheta = 0;
  event.visualSize = 5;
  event.visualWidth = 12;
  event.visualHeight = 12;
  event.clipCount = 13;
  event.clipInterval = 0.45;
  event.clipRepeat = 8;
  event.angleStepDeg = 8;
  event.baseAngleDeg = 0;
  event.aimAtPlayer = 1;
}

function applyPolynomialRadial(event: AttackEvent & BulletMotionFields & FireClipFields, stage: StageSize): void {
  event.name = "カーブ回転弾";
  event.duration = 4;
  event.color = 0xff365f;
  event.originX = stage.width / 2;
  event.originY = stage.height / 2;
  event.pathSpeed = 180;
  event.polynomialA = -30;
  event.polynomialB = 80;
  event.polynomialC = -18;
  event.polynomialD = 1.2;
  event.polarTheta = -90;
  event.polarThetaVelocity = 110;
  event.aimAtPlayer = 0;
  event.clipCount = 8;
  event.clipRepeat = 2;
  event.clipInterval = 0.65;
  event.angleStepDeg = 360 / 8;
  event.baseAngleDeg = 0;
  event.visualSize = 7;
  event.visualWidth = 16;
  event.visualHeight = 16;
}

function applyCurvedLaserRing(event: AttackEvent & BulletMotionFields & FireClipFields, stage: StageSize): void {
  event.name = "8方向カーブレーザー";
  event.duration = 4;
  event.color = 0xff2f4f;
  event.originX = stage.width / 2;
  event.originY = stage.height / 2;
  event.pathSpeed = 260;
  event.polynomialA = -18;
  event.polynomialB = 58;
  event.polynomialC = -8;
  event.polynomialD = 0.35;
  event.polarTheta = 0;
  event.polarThetaVelocity = 28;
  event.typeId = 4;
  event.visualPreset = "laser";
  event.visualSize = 8;
  event.visualWidth = 420;
  event.visualHeight = 16;
  event.visualAngle = 0;
  event.aimAtPlayer = 0;
  event.clipCount = 8;
  event.clipRepeat = 1;
  event.clipInterval = 0;
  event.angleStepDeg = 45;
  event.baseAngleDeg = 0;
}

function applyOrbitingDiamond(event: AttackEvent & BulletMotionFields, stage: StageSize): void {
  event.name = "回転ダイヤ";
  event.duration = 4;
  event.color = 0xffd166;
  event.originX = stage.width / 2;
  event.originY = stage.height / 2;
  event.pathStartX = 1;
  event.pathSpeed = 0;
  event.polarRadius = 110;
  event.polarTheta = 0;
  event.polarThetaVelocity = 150;
  event.angleSpeed = 150;
  event.typeId = 2;
  event.visualPreset = "diamond";
  event.visualSize = 22;
  event.visualWidth = 34;
  event.visualHeight = 44;

  if (hasFireClipFields(event)) {
    event.aimAtPlayer = 0;
    event.clipCount = 1;
    event.clipRepeat = 1;
    event.clipInterval = 0;
    event.angleStepDeg = 0;
    event.baseAngleDeg = 0;
  }
}

function hasBulletMotionFields(event: AttackEvent): event is AttackEvent & BulletMotionFields {
  return "visualPreset" in event && "pathSpeed" in event;
}

function hasFireClipFields(event: AttackEvent): event is AttackEvent & BulletMotionFields & FireClipFields {
  return hasBulletMotionFields(event) && "clipCount" in event;
}
