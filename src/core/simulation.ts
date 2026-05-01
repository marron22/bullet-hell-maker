import type {
  AttackEvent,
  AttackFrame,
  AimedSpreadEvent,
  BeatPulseRingEvent,
  BulletMotionFields,
  ClosingWallsEvent,
  BulletRender,
  BossMirroredFanEvent,
  CurvedLaserRender,
  CurvedLaserRingEvent,
  FireClipFields,
  FireFromMovingOriginEvent,
  HazardRender,
  LaserBeamEvent,
  MovingBlockEvent,
  PolynomialProjectileEvent,
  RadialBurstEvent,
  RotatingShapeEvent,
  SafeLaneShiftEvent,
  SpawnAimedSpreadEvent,
  SpawnBulletEvent,
  SpawnBulletSpreadEvent,
  SpawnCurvedLaserEvent,
  SpawnEnemyOriginEvent,
  SpawnRadialEvent,
  StageSize,
  TransformBulletEvent,
  WarningZoneEvent,
  WallRender,
  WallSweepEvent,
} from "./types";

const lockedAimAngles = new Map<string, number>();

export function clearAimCache(): void {
  lockedAimAngles.clear();
}

export function buildAttackFrame(events: AttackEvent[], time: number, stage: StageSize, playerPosition?: { x: number; y: number }): AttackFrame {
  const frame: AttackFrame = {
    bullets: [],
    walls: [],
    lasers: [],
    curvedLasers: [],
    hazards: [],
    warnings: [],
    shapes: [],
  };

  for (const event of events) {
    switch (event.kind) {
      case "spawn_bullet":
        frame.bullets.push(...buildSpawnBullet(event, time));
        break;
      case "spawn_bullet_spread":
        frame.bullets.push(...buildSpawnBulletSpread(event, time, playerPosition));
        break;
      case "spawn_aimed_spread":
        frame.bullets.push(...buildSpawnAimedSpread(event, time, playerPosition));
        break;
      case "spawn_radial":
        frame.bullets.push(...buildSpawnRadial(event, time));
        break;
      case "spawn_enemy_origin":
        pushIfDefined(frame.shapes, buildSpawnEnemyOrigin(event, time));
        break;
      case "fire_from_moving_origin":
        frame.bullets.push(...buildFireFromMovingOrigin(event, time, playerPosition));
        pushIfDefined(frame.shapes, buildMovingOriginCue(event, time));
        break;
      case "spawn_curved_laser":
        frame.curvedLasers.push(...buildSpawnCurvedLaser(event, time));
        break;
      case "transform_bullet":
        frame.warnings.push(...buildTransformBulletCue(event, time, stage));
        break;
      case "radialBurst":
        frame.bullets.push(...buildRadialBurst(event, time));
        break;
      case "aimedSpread":
        frame.bullets.push(...buildAimedSpread(event, time, playerPosition));
        break;
      case "bossMirroredFan":
        frame.bullets.push(...buildBossMirroredFan(event, time, playerPosition));
        break;
      case "polynomialProjectile":
        frame.bullets.push(...buildPolynomialProjectile(event, time));
        break;
      case "curvedLaserRing":
        frame.curvedLasers.push(...buildCurvedLaserRing(event, time));
        break;
      case "warningZone":
        frame.warnings.push(...buildWarningZone(event, time));
        break;
      case "movingBlock":
        frame.warnings.push(...buildMovingBlockWarning(event, time));
        pushIfDefined(frame.hazards, buildMovingBlock(event, time));
        break;
      case "beatPulseRing":
        frame.warnings.push(...buildBeatPulseWarnings(event, time));
        frame.hazards.push(...buildBeatPulseRing(event, time));
        break;
      case "closingWalls":
        frame.warnings.push(...buildClosingWallsWarning(event, time, stage));
        frame.walls.push(...buildClosingWalls(event, time, stage));
        break;
      case "safeLaneShift":
        frame.warnings.push(...buildSafeLaneWarning(event, time, stage));
        frame.walls.push(...buildSafeLaneShift(event, time, stage));
        break;
      case "wallSweep":
        frame.warnings.push(...buildWallSweepWarning(event, time, stage));
        frame.walls.push(...buildWallSweep(event, time, stage));
        break;
      case "laserBeam":
        pushIfDefined(frame.lasers, buildLaserBeam(event, time));
        break;
      case "rotatingShape":
        pushIfDefined(frame.shapes, buildRotatingShape(event, time));
        break;
    }
  }

  return frame;
}

function buildSpawnBullet(event: SpawnBulletEvent, time: number): BulletRender[] {
  const age = time - event.startTime;

  if (!isActiveAge(age, event.duration)) {
    return [];
  }

  return [buildMotionBullet(event, age, event.polarTheta, event.id, event.color, `${event.id}:single`)];
}

function buildSpawnBulletSpread(event: SpawnBulletSpreadEvent, time: number, playerPosition?: { x: number; y: number }): BulletRender[] {
  return buildFireClipBullets(event, time, event.baseAngleDeg, playerPosition);
}

function buildSpawnAimedSpread(event: SpawnAimedSpreadEvent, time: number, playerPosition?: { x: number; y: number }): BulletRender[] {
  const bullets: BulletRender[] = [];
  const repeat = Math.max(1, Math.round(event.clipRepeat));
  const interval = Math.max(0, event.clipInterval);
  const count = Math.max(1, Math.round(event.clipCount));

  for (let repeatIndex = 0; repeatIndex < repeat; repeatIndex += 1) {
    const occurrenceTime = event.startTime + interval * repeatIndex;
    const age = time - occurrenceTime;

    if (!isActiveAge(age, event.duration)) {
      continue;
    }

    const baseAngle = getFireClipBaseAngle(event, occurrenceTime, event.baseAngleDeg, playerPosition);

    for (let index = 0; index < count; index += 1) {
      const angleOffset = (index - (count - 1) / 2) * event.angleStepDeg;
      bullets.push(
        buildMotionBullet(event, age, event.polarTheta + baseAngle + angleOffset, event.id, event.color, `${event.id}:clip:${repeatIndex}:${index}`),
      );
    }
  }

  return bullets;
}

function buildFireFromMovingOrigin(event: FireFromMovingOriginEvent, time: number, playerPosition?: { x: number; y: number }): BulletRender[] {
  return buildFireClipBullets(event, time, event.baseAngleDeg, playerPosition);
}

function buildFireClipBullets(
  event: (SpawnBulletSpreadEvent | SpawnAimedSpreadEvent | FireFromMovingOriginEvent) & FireClipFields,
  time: number,
  baseAngle: number,
  playerPosition?: { x: number; y: number },
): BulletRender[] {
  const bullets: BulletRender[] = [];
  const repeat = Math.max(1, Math.round(event.clipRepeat));
  const interval = Math.max(0, event.clipInterval);
  const count = Math.max(1, Math.round(event.clipCount));

  for (let repeatIndex = 0; repeatIndex < repeat; repeatIndex += 1) {
    const occurrenceTime = event.startTime + interval * repeatIndex;
    const age = time - occurrenceTime;

    if (!isActiveAge(age, event.duration)) {
      continue;
    }

    const resolvedBaseAngle = getFireClipBaseAngle(event, occurrenceTime, baseAngle, playerPosition);

    for (let index = 0; index < count; index += 1) {
      const angleOffset = (index - (count - 1) / 2) * event.angleStepDeg;
      bullets.push(
        buildMotionBullet(event, age, event.polarTheta + resolvedBaseAngle + angleOffset, event.id, event.color, `${event.id}:clip:${repeatIndex}:${index}`),
      );
    }
  }

  return bullets;
}

function buildSpawnRadial(event: SpawnRadialEvent, time: number): BulletRender[] {
  const bullets: BulletRender[] = [];
  const repeat = Math.max(1, Math.round(event.radialRepeat));
  const interval = Math.max(0, event.radialInterval);
  const count = Math.max(1, Math.round(event.radialCount));

  for (let repeatIndex = 0; repeatIndex < repeat; repeatIndex += 1) {
    const age = time - (event.startTime + interval * repeatIndex);

    if (!isActiveAge(age, event.duration)) {
      continue;
    }

    for (let index = 0; index < count; index += 1) {
      bullets.push(
        buildMotionBullet(
          event,
          age,
          event.polarTheta + event.radialStartAngle + (360 / count) * index,
          event.id,
          event.color,
          `${event.id}:radial:${repeatIndex}:${index}`,
        ),
      );
    }
  }

  return bullets;
}

function buildSpawnCurvedLaser(event: SpawnCurvedLaserEvent, time: number): CurvedLaserRender[] {
  const age = time - event.startTime;

  if (!isActiveAge(age, event.duration)) {
    return [];
  }

  const lasers: CurvedLaserRender[] = [];
  const count = Math.max(1, Math.round(event.laserCount));
  const visibleLength = Math.min(event.laserLength, Math.max(0, event.growSpeed * age));

  for (let index = 0; index < count; index += 1) {
    lasers.push({
      eventId: event.id,
      points: buildMotionPathPoints(event, visibleLength, event.polarTheta + event.laserAngleStepDeg * index, age),
      width: event.laserWidth,
      color: event.color,
      alpha: Math.min(1, 0.3 + age / Math.max(0.1, event.duration)),
    });
  }

  return lasers;
}

function buildSpawnEnemyOrigin(event: SpawnEnemyOriginEvent, time: number) {
  const age = time - event.startTime;

  if (!isActiveAge(age, event.duration)) {
    return undefined;
  }

  const point = evaluateMotionPosition(event, age, event.polarTheta);

  return {
    eventId: event.id,
    x: point.x,
    y: point.y,
    radius: event.originSize,
    rotation: degreesToRadians(event.polarTheta + event.polarThetaVelocity * age),
    sides: 4,
    color: event.color,
    alpha: 0.95,
  };
}

function buildMovingOriginCue(event: FireFromMovingOriginEvent, time: number) {
  const age = time - event.startTime;

  if (!isActiveAge(age, event.duration)) {
    return undefined;
  }

  const origin = getMovingOrigin(event, age);

  return {
    eventId: event.id,
    x: origin.x,
    y: origin.y,
    radius: event.visualSize * 1.7,
    rotation: degreesToRadians(event.baseAngleDeg),
    sides: 3,
    color: 0xffffff,
    alpha: 0.6,
  };
}

function buildTransformBulletCue(event: TransformBulletEvent, time: number, stage: StageSize): HazardRender[] {
  const age = time - event.startTime;

  if (!isActiveAge(age, event.duration)) {
    return [];
  }

  const pulse = 0.45 + Math.abs(Math.sin(age * Math.PI * 8)) * 0.35;

  return [
    createHazard({
      eventId: event.id,
      shape: "line",
      x: stage.width / 2,
      y: stage.height / 2,
      width: stage.width * 0.5,
      height: 8,
      radius: 0,
      rotation: event.nextAngleDeg,
      sides: 4,
      strokeWidth: 8,
      filled: false,
      isWarning: true,
      color: event.color,
      alpha: pulse,
    }),
  ];
}

function buildMotionBullet(event: BulletMotionFields, age: number, angleDegrees: number, eventId: string, color: number, trackId: string): BulletRender {
  const motion = evaluateMotion(event, age, angleDegrees);

  return {
    eventId,
    trackId,
    x: motion.position.x,
    y: motion.position.y,
    radius: event.visualSize,
    angle: motion.angle + degreesToRadians(event.visualAngle + event.angleSpeed * age),
    typeId: event.typeId,
    visualPreset: event.visualPreset,
    width: event.visualWidth,
    height: event.visualHeight,
    color,
    alpha: 1,
  };
}

function evaluateMotionPosition(event: BulletMotionFields, age: number, angleDegrees: number): { x: number; y: number } {
  return evaluateMotionPositionAt(event, age, angleDegrees);
}

function evaluateMotion(event: BulletMotionFields, age: number, angleDegrees: number): { position: { x: number; y: number }; angle: number } {
  const position = evaluateMotionPositionAt(event, age, angleDegrees);
  const angle = evaluateMotionVectorAngle(event, age, angleDegrees);

  return { position, angle };
}

function evaluateMotionPositionAt(event: BulletMotionFields, age: number, angleDegrees: number): { x: number; y: number } {
  const local = evaluatePolynomialPath(event, age);
  const origin = getMovingOrigin(event, age);
  const radius = event.polarRadius + event.polarRadiusVelocity * age;
  const theta = degreesToRadians(angleDegrees + event.polarThetaVelocity * age);
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  const x = origin.x + radius * (local.x * cos - local.y * sin);
  const y = origin.y + radius * (local.x * sin + local.y * cos) - (event.gravity * age * age) / 2;

  return { x, y };
}

function evaluateMotionVectorAngle(event: BulletMotionFields, age: number, angleDegrees: number): number {
  const sample = 1 / 120;
  const beforeAge = Math.max(0, age - sample);
  const afterAge = age + sample;
  const before = evaluateMotionPositionAt(event, beforeAge, angleDegrees);
  const after = evaluateMotionPositionAt(event, afterAge, angleDegrees);
  const vx = after.x - before.x;
  const vy = after.y - before.y;

  if (Math.hypot(vx, vy) > 0.001) {
    return Math.atan2(vy, vx);
  }

  const local = evaluatePolynomialPath(event, age);

  return degreesToRadians(angleDegrees + event.polarThetaVelocity * age) + Math.atan(local.slope);
}

function evaluatePolynomialPath(event: BulletMotionFields, age: number): { x: number; y: number; slope: number } {
  const speed = Math.max(0, event.pathSpeed);
  const curveAge = speed <= 0 ? 0 : solveCurveAgeForTravel(event, age);
  const x = event.pathStartX + speed * curveAge;
  const dyDt = polynomialDerivative(event, curveAge);
  const slope = speed <= 0 ? 0 : dyDt / speed;

  return {
    x,
    y: polynomialValue(event, curveAge),
    slope,
  };
}

function solveCurveAgeForTravel(event: BulletMotionFields, age: number): number {
  const targetLength = Math.max(0, event.pathSpeed * age);

  if (targetLength <= 0) {
    return 0;
  }

  let low = 0;
  let high = Math.max(0.001, age);

  while (approximateCurveLength(event, high) < targetLength && high < Math.max(1, age) * 8) {
    high *= 2;
  }

  for (let index = 0; index < 10; index += 1) {
    const middle = (low + high) / 2;
    const length = approximateCurveLength(event, middle);

    if (length < targetLength) {
      low = middle;
    } else {
      high = middle;
    }
  }

  return (low + high) / 2;
}

function approximateCurveLength(event: BulletMotionFields, curveAge: number): number {
  const speed = Math.max(0, event.pathSpeed);
  const segments = Math.max(4, Math.min(36, Math.ceil(Math.max(0.1, curveAge) * 12)));
  let length = 0;
  let previousX = event.pathStartX;
  let previousY = polynomialValue(event, 0);

  for (let index = 1; index <= segments; index += 1) {
    const t = (curveAge * index) / segments;
    const x = event.pathStartX + speed * t;
    const y = polynomialValue(event, t);

    length += Math.hypot(x - previousX, y - previousY);
    previousX = x;
    previousY = y;
  }

  return length;
}

function buildMotionPathPoints(event: BulletMotionFields, length: number, angleDegrees: number, age: number): Array<{ x: number; y: number }> {
  void age;
  const points: Array<{ x: number; y: number }> = [];
  const segments = Math.max(20, Math.min(96, Math.ceil(length / 10)));

  for (let index = 0; index <= segments; index += 1) {
    const sampleAge = event.pathSpeed <= 0 ? 0 : (length * (index / segments)) / event.pathSpeed;
    points.push(evaluateMotionPosition(event, sampleAge, angleDegrees));
  }

  return points;
}

function getMovingOrigin(event: BulletMotionFields, age: number): { x: number; y: number } {
  return {
    x: event.originX + event.originVx * age,
    y: event.originY + event.originVy * age,
  };
}

function polynomialValue(event: BulletMotionFields, t: number): number {
  return event.polynomialA * t + event.polynomialB * t * t + event.polynomialC * t * t * t + event.polynomialD * t * t * t * t;
}

function polynomialDerivative(event: BulletMotionFields, t: number): number {
  return event.polynomialA + 2 * event.polynomialB * t + 3 * event.polynomialC * t * t + 4 * event.polynomialD * t * t * t;
}

function isActiveAge(age: number, duration: number): boolean {
  return age >= 0 && age <= duration;
}

function buildWarningZone(event: WarningZoneEvent, time: number): HazardRender[] {
  const age = time - event.startTime;

  if (age < 0 || age > event.duration) {
    return [];
  }

  const blink = event.blinkRate <= 0 ? 1 : 0.45 + Math.abs(Math.sin(age * Math.PI * event.blinkRate)) * 0.55;

  return [
    createHazard({
      eventId: event.id,
      shape: event.shape,
      x: event.x,
      y: event.y,
      width: event.width,
      height: event.height,
      radius: event.radius,
      rotation: event.angle,
      sides: event.sides,
      strokeWidth: event.shape === "line" ? Math.max(4, event.height) : 3,
      filled: event.shape !== "line",
      isWarning: true,
      color: event.color,
      alpha: clamp(event.zoneAlpha * blink, 0.05, 0.8),
    }),
  ];
}

function buildMovingBlockWarning(event: MovingBlockEvent, time: number): HazardRender[] {
  const alpha = getWarningAlpha(event.startTime, event.warningTime, time);

  if (alpha <= 0) {
    return [];
  }

  return [
    createBlockHazard(event, event.startX, event.startY, event.rotationStart, alpha * 0.75, true),
    createBlockHazard(event, event.endX, event.endY, event.rotationStart + event.rotationSpeed * event.duration, alpha, true),
  ];
}

function buildMovingBlock(event: MovingBlockEvent, time: number): HazardRender | undefined {
  const age = time - event.startTime;

  if (age < 0 || age > event.duration) {
    return undefined;
  }

  const progress = easeInOut(clamp(age / event.duration, 0, 1));
  const x = lerp(event.startX, event.endX, progress);
  const y = lerp(event.startY, event.endY, progress);

  return createBlockHazard(event, x, y, event.rotationStart + event.rotationSpeed * age, 1, false);
}

function createBlockHazard(event: MovingBlockEvent, x: number, y: number, rotation: number, alpha: number, isWarning: boolean): HazardRender {
  return createHazard({
    eventId: event.id,
    shape: event.shape,
    x,
    y,
    width: event.width,
    height: event.height,
    radius: event.radius,
    rotation,
    sides: event.sides,
    strokeWidth: isWarning ? 4 : 2,
    filled: !isWarning,
    isWarning,
    color: event.color,
    alpha,
  });
}

function buildBeatPulseWarnings(event: BeatPulseRingEvent, time: number): HazardRender[] {
  const alpha = getWarningAlpha(event.startTime, event.warningTime, time);

  if (alpha <= 0) {
    return [];
  }

  return [createPulseHazard(event, event.startSize, alpha, true)];
}

function buildBeatPulseRing(event: BeatPulseRingEvent, time: number): HazardRender[] {
  const hazards: HazardRender[] = [];
  const repeatCount = Math.max(1, Math.round(event.repeatCount));
  const repeatInterval = Math.max(0, event.repeatInterval);

  for (let index = 0; index < repeatCount; index += 1) {
    const age = time - (event.startTime + repeatInterval * index);

    if (age < 0 || age > event.duration) {
      continue;
    }

    const progress = clamp(age / event.duration, 0, 1);
    const size = lerp(event.startSize, event.endSize, easeOut(progress));
    hazards.push(createPulseHazard(event, size, Math.max(0.2, 1 - progress * 0.7), false));
  }

  return hazards;
}

function createPulseHazard(event: BeatPulseRingEvent, size: number, alpha: number, isWarning: boolean): HazardRender {
  return createHazard({
    eventId: event.id,
    shape: event.shape,
    x: event.x,
    y: event.y,
    width: size,
    height: size,
    radius: size / 2,
    rotation: 0,
    sides: 4,
    strokeWidth: event.thickness,
    filled: false,
    isWarning,
    color: event.color,
    alpha,
  });
}

function buildClosingWallsWarning(event: ClosingWallsEvent, time: number, stage: StageSize): HazardRender[] {
  const alpha = getWarningAlpha(event.startTime, event.warningTime, time);

  if (alpha <= 0) {
    return [];
  }

  return closingWallRects(event, stage, event.distance).map((wall) => wallToWarning(event.id, wall, event.color, alpha));
}

function buildClosingWalls(event: ClosingWallsEvent, time: number, stage: StageSize): WallRender[] {
  const age = time - event.startTime;
  const totalDuration = event.moveTime + event.holdTime + event.returnTime;

  if (age < 0 || age > totalDuration) {
    return [];
  }

  const distance = getClosingWallDistance(event, age);

  return closingWallRects(event, stage, distance).map((wall) => ({
    ...wall,
    eventId: event.id,
    color: event.color,
    alpha: 1,
  }));
}

function closingWallRects(event: ClosingWallsEvent, stage: StageSize, distance: number): Array<Omit<WallRender, "eventId" | "color" | "alpha">> {
  const walls: Array<Omit<WallRender, "eventId" | "color" | "alpha">> = [];

  if (event.mode === "horizontal" || event.mode === "all") {
    walls.push(
      { x: -event.thickness + distance, y: 0, width: event.thickness, height: stage.height },
      { x: stage.width - distance, y: 0, width: event.thickness, height: stage.height },
    );
  }

  if (event.mode === "vertical" || event.mode === "all") {
    walls.push(
      { x: 0, y: -event.thickness + distance, width: stage.width, height: event.thickness },
      { x: 0, y: stage.height - distance, width: stage.width, height: event.thickness },
    );
  }

  return walls;
}

function getClosingWallDistance(event: ClosingWallsEvent, age: number): number {
  if (age <= event.moveTime) {
    return event.distance * easeInOut(clamp(age / Math.max(0.01, event.moveTime), 0, 1));
  }

  if (age <= event.moveTime + event.holdTime) {
    return event.distance;
  }

  const returnAge = age - event.moveTime - event.holdTime;

  return event.distance * (1 - easeInOut(clamp(returnAge / Math.max(0.01, event.returnTime), 0, 1)));
}

function buildSafeLaneWarning(event: SafeLaneShiftEvent, time: number, stage: StageSize): HazardRender[] {
  const alpha = getWarningAlpha(event.startTime, event.warningTime, time);

  if (alpha <= 0) {
    return [];
  }

  return safeLaneRects(event, stage, event.firstLaneCenter).map((wall) => wallToWarning(event.id, wall, event.color, alpha));
}

function buildSafeLaneShift(event: SafeLaneShiftEvent, time: number, stage: StageSize): WallRender[] {
  const age = time - event.startTime;
  const totalDuration = Math.max(event.duration, event.switchInterval * Math.max(1, event.switchCount));

  if (age < 0 || age > totalDuration) {
    return [];
  }

  const switchIndex = Math.floor(age / Math.max(0.01, event.switchInterval));
  const laneCenter = switchIndex % 2 === 0 ? event.firstLaneCenter : event.secondLaneCenter;

  return safeLaneRects(event, stage, laneCenter).map((wall) => ({
    ...wall,
    eventId: event.id,
    color: event.color,
    alpha: 0.88,
  }));
}

function safeLaneRects(event: SafeLaneShiftEvent, stage: StageSize, laneCenter: number): Array<Omit<WallRender, "eventId" | "color" | "alpha">> {
  const halfLane = event.laneWidth / 2;

  if (event.orientation === "vertical") {
    const leftWidth = clamp(laneCenter - halfLane, 0, stage.width);
    const rightX = clamp(laneCenter + halfLane, 0, stage.width);

    return [
      { x: 0, y: 0, width: leftWidth, height: stage.height },
      { x: rightX, y: 0, width: Math.max(0, stage.width - rightX), height: stage.height },
    ].filter((wall) => wall.width > 0);
  }

  const topHeight = clamp(laneCenter - halfLane, 0, stage.height);
  const bottomY = clamp(laneCenter + halfLane, 0, stage.height);

  return [
    { x: 0, y: 0, width: stage.width, height: topHeight },
    { x: 0, y: bottomY, width: stage.width, height: Math.max(0, stage.height - bottomY) },
  ].filter((wall) => wall.height > 0);
}

function buildRadialBurst(event: RadialBurstEvent, time: number): BulletRender[] {
  const bullets: BulletRender[] = [];
  const repeatCount = Math.max(1, event.repeatCount);
  const repeatInterval = Math.max(0, event.repeatInterval);

  for (let repeatIndex = 0; repeatIndex < repeatCount; repeatIndex += 1) {
    const occurrenceTime = event.startTime + repeatInterval * repeatIndex;
    const age = time - occurrenceTime;

    if (age < 0 || age > event.duration) {
      continue;
    }

    bullets.push(...buildRadialBurstOccurrence(event, age, repeatIndex));
  }

  return bullets;
}

function buildRadialBurstOccurrence(event: RadialBurstEvent, age: number, repeatIndex: number): BulletRender[] {
  const bullets: BulletRender[] = [];
  const count = Math.max(1, event.bulletCount);
  const fullCircle = Math.abs(event.arcDegrees) >= 360;
  const angleStep = fullCircle || count === 1 ? event.arcDegrees / count : event.arcDegrees / (count - 1);
  const alpha = Math.max(0.2, 1 - age / event.duration);

  for (let index = 0; index < count; index += 1) {
    const angleDegrees = event.startAngle + angleStep * index;
    const angleRadians = degreesToRadians(angleDegrees);

    bullets.push({
      eventId: event.id,
      trackId: `${event.id}:legacy-radial:${repeatIndex}:${index}`,
      x: event.x + Math.cos(angleRadians) * event.bulletSpeed * age,
      y: event.y + Math.sin(angleRadians) * event.bulletSpeed * age,
      radius: event.bulletRadius,
      angle: angleRadians,
      color: event.color,
      alpha,
    });
  }

  return bullets;
}

function buildAimedSpread(event: AimedSpreadEvent, time: number, playerPosition?: { x: number; y: number }): BulletRender[] {
  const bullets: BulletRender[] = [];
  const fireCount = Math.max(1, event.fireCount);
  const fireInterval = Math.max(0, event.fireInterval);

  for (let fireIndex = 0; fireIndex < fireCount; fireIndex += 1) {
    const occurrenceTime = event.startTime + fireInterval * fireIndex;
    const age = time - occurrenceTime;

    if (age < 0 || age > event.duration) {
      continue;
    }

    const baseAngle =
      getLockedAimAngle(
        `legacy-aim:${event.id}:${occurrenceTime.toFixed(3)}:${event.x}:${event.y}`,
        event.x,
        event.y,
        { x: event.targetX, y: event.targetY },
        playerPosition,
      ) + event.aimOffsetDegrees;

    bullets.push(...buildLinearSpread(event, age, baseAngle, event.wayCount, event.spreadDegrees, event.bulletSpeed, `legacy-aim:${event.id}:${fireIndex}`));
  }

  return bullets;
}

function buildBossMirroredFan(event: BossMirroredFanEvent, time: number, playerPosition?: { x: number; y: number }): BulletRender[] {
  const bullets: BulletRender[] = [];
  const fireCount = Math.max(1, event.fireCount);
  const fireInterval = Math.max(0, event.fireInterval);
  const angleCount = Math.max(1, Math.round(event.angleCount));
  const speedLayers = Math.max(1, Math.round(event.speedLayers));

  for (let fireIndex = 0; fireIndex < fireCount; fireIndex += 1) {
    const occurrenceTime = event.startTime + fireInterval * fireIndex;
    const age = time - occurrenceTime;

    if (age < 0 || age > event.duration) {
      continue;
    }

    const baseAngle = getLockedAimAngle(
      `legacy-boss:${event.id}:${occurrenceTime.toFixed(3)}:${event.x}:${event.y}`,
      event.x,
      event.y,
      { x: event.targetX, y: event.targetY },
      playerPosition,
    );
    const mirror = fireIndex % 2 === 1 ? -1 : 1;

    for (let angleIndex = 0; angleIndex < angleCount; angleIndex += 1) {
      const angleOffset = mirror * (event.angleStepDegrees * angleIndex - event.angleOffsetDegrees);

      for (let speedIndex = 0; speedIndex < speedLayers; speedIndex += 1) {
        const speed = event.minSpeed + event.speedStep * speedIndex;
        bullets.push(
          ...buildLinearSpread(event, age, baseAngle + angleOffset, 1, 0, speed, `legacy-boss:${event.id}:${fireIndex}:${angleIndex}:${speedIndex}`),
        );
      }
    }
  }

  return bullets;
}

function buildPolynomialProjectile(event: PolynomialProjectileEvent, time: number): BulletRender[] {
  const bullets: BulletRender[] = [];
  const fireCount = Math.max(1, event.fireCount);
  const fireInterval = Math.max(0, event.fireInterval);

  for (let fireIndex = 0; fireIndex < fireCount; fireIndex += 1) {
    const occurrenceTime = event.startTime + fireInterval * fireIndex;
    const age = time - occurrenceTime;

    if (age < 0 || age > event.duration) {
      continue;
    }

    const count = Math.max(1, Math.round(event.bulletCount));
    const fullCircle = Math.abs(event.spreadDegrees) >= 360;
    const angleStep = fullCircle || count === 1 ? event.spreadDegrees / count : event.spreadDegrees / (count - 1);
    const originX = event.x + event.originVx * age;
    const originY = event.y + event.originVy * age;
    const alpha = Math.max(0.22, 1 - age / event.duration);

    for (let index = 0; index < count; index += 1) {
      const angle = degreesToRadians(event.startAngle + angleStep * index + event.thetaVelocity * age);
      const forward = event.bulletSpeed * age;
      const side = event.curveA * age * age + event.curveB * age * age * age;
      const gravity = 0.5 * event.gravity * age * age;
      const sideVelocity = 2 * event.curveA * age + 3 * event.curveB * age * age;
      const velocityX = event.originVx + Math.cos(angle) * event.bulletSpeed - Math.sin(angle) * sideVelocity;
      const velocityY = event.originVy + Math.sin(angle) * event.bulletSpeed + Math.cos(angle) * sideVelocity + event.gravity * age;

      bullets.push({
        eventId: event.id,
        trackId: `${event.id}:poly:${fireIndex}:${index}`,
        x: originX + Math.cos(angle) * forward - Math.sin(angle) * side,
        y: originY + Math.sin(angle) * forward + Math.cos(angle) * side + gravity,
        radius: event.bulletRadius,
        angle: Math.atan2(velocityY, velocityX),
        color: event.color,
        alpha,
      });
    }
  }

  return bullets;
}

function buildCurvedLaserRing(event: CurvedLaserRingEvent, time: number): CurvedLaserRender[] {
  const age = time - event.startTime;

  if (age < 0 || age > event.duration) {
    return [];
  }

  const lasers: CurvedLaserRender[] = [];
  const count = Math.max(1, Math.round(event.laserCount));
  const visibleLength = Math.min(event.length, Math.max(0, event.extendSpeed * age));
  const segments = 18;
  const alpha = Math.min(1, 0.35 + age / Math.max(0.1, event.duration) * 0.9);

  if (visibleLength <= 0) {
    return lasers;
  }

  for (let index = 0; index < count; index += 1) {
    const angle = degreesToRadians(event.startAngle + (360 / count) * index + event.rotationSpeed * age);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const points: Array<{ x: number; y: number }> = [];

    for (let segment = 0; segment <= segments; segment += 1) {
      const progress = segment / segments;
      const localX = visibleLength * progress;
      const normalized = localX / Math.max(1, event.length);
      const localY = event.curveA * normalized * normalized + event.curveB * normalized * normalized * normalized;

      points.push({
        x: event.x + localX * cos - localY * sin,
        y: event.y + localX * sin + localY * cos,
      });
    }

    lasers.push({
      eventId: event.id,
      points,
      width: event.width,
      color: event.color,
      alpha,
    });
  }

  return lasers;
}

function buildLinearSpread(
  event: AimedSpreadEvent | BossMirroredFanEvent,
  age: number,
  baseAngle: number,
  count: number,
  spreadDegrees: number,
  speed: number,
  trackPrefix: string,
): BulletRender[] {
  const bullets: BulletRender[] = [];
  const safeCount = Math.max(1, Math.round(count));
  const angleStep = safeCount === 1 ? 0 : spreadDegrees / (safeCount - 1);
  const startAngle = baseAngle - spreadDegrees / 2;
  const alpha = Math.max(0.22, 1 - age / event.duration);

  for (let index = 0; index < safeCount; index += 1) {
    const angle = degreesToRadians(startAngle + angleStep * index);

    bullets.push({
      eventId: event.id,
      trackId: `${trackPrefix}:${index}`,
      x: event.x + Math.cos(angle) * speed * age,
      y: event.y + Math.sin(angle) * speed * age,
      radius: event.bulletRadius,
      angle,
      color: event.color,
      alpha,
    });
  }

  return bullets;
}

function buildWallSweepWarning(event: WallSweepEvent, time: number, stage: StageSize): HazardRender[] {
  const alpha = getWarningAlpha(event.startTime, event.warningTime, time);

  if (alpha <= 0) {
    return [];
  }

  return wallSweepRects(event, stage, getWallSweepWarningProgress(event, stage)).map((wall) => wallToWarning(event.id, wall, event.color, alpha));
}

function buildWallSweep(event: WallSweepEvent, time: number, stage: StageSize): WallRender[] {
  const age = time - event.startTime;

  if (age < 0 || age > event.duration) {
    return [];
  }

  const progress = event.duration <= 0 ? 1 : age / event.duration;
  const alpha = Math.min(1, 0.35 + progress * 0.75);

  return wallSweepRects(event, stage, progress).map((wall) => ({
    ...wall,
    eventId: event.id,
    color: event.color,
    alpha,
  }));
}

function wallSweepRects(event: WallSweepEvent, stage: StageSize, progress: number): Array<Omit<WallRender, "eventId" | "color" | "alpha">> {
  if (event.edge === "left" || event.edge === "right") {
    const travel = stage.width + event.thickness * 2;
    const x =
      event.edge === "left"
        ? -event.thickness + travel * progress
        : stage.width + event.thickness - travel * progress;
    const yStart = event.offset - event.length / 2;
    const yEnd = event.offset + event.length / 2;
    const gapStart = event.safeGapSize > 0 ? event.safeGapCenter - event.safeGapSize / 2 : Number.POSITIVE_INFINITY;
    const gapEnd = event.safeGapSize > 0 ? event.safeGapCenter + event.safeGapSize / 2 : Number.NEGATIVE_INFINITY;
    const segments = [
      { start: yStart, end: Math.min(yEnd, gapStart) },
      { start: Math.max(yStart, gapEnd), end: yEnd },
    ].filter((segment) => segment.end > segment.start);

    return segments.map((segment) => ({
      x,
      y: segment.start,
      width: event.thickness,
      height: segment.end - segment.start,
    }));
  }

  const travel = stage.height + event.thickness * 2;
  const y =
    event.edge === "top"
      ? -event.thickness + travel * progress
      : stage.height + event.thickness - travel * progress;
  const xStart = event.offset - event.length / 2;
  const xEnd = event.offset + event.length / 2;
  const gapStart = event.safeGapSize > 0 ? event.safeGapCenter - event.safeGapSize / 2 : Number.POSITIVE_INFINITY;
  const gapEnd = event.safeGapSize > 0 ? event.safeGapCenter + event.safeGapSize / 2 : Number.NEGATIVE_INFINITY;
  const segments = [
    { start: xStart, end: Math.min(xEnd, gapStart) },
    { start: Math.max(xStart, gapEnd), end: xEnd },
  ].filter((segment) => segment.end > segment.start);

  return segments.map((segment) => ({
    x: segment.start,
    y,
    width: segment.end - segment.start,
    height: event.thickness,
  }));
}

function getWallSweepWarningProgress(event: WallSweepEvent, stage: StageSize): number {
  if (event.edge === "left") {
    return event.thickness / (stage.width + event.thickness * 2);
  }

  if (event.edge === "right") {
    return (event.thickness * 2) / (stage.width + event.thickness * 2);
  }

  if (event.edge === "top") {
    return event.thickness / (stage.height + event.thickness * 2);
  }

  return (event.thickness * 2) / (stage.height + event.thickness * 2);
}

function buildLaserBeam(event: LaserBeamEvent, time: number) {
  const age = time - event.startTime;

  if (age < 0 || age > event.duration) {
    return undefined;
  }

  const pulse = 0.75 + Math.sin(age * 22) * 0.18;

  return {
    eventId: event.id,
    x: event.x,
    y: event.y,
    length: event.length,
    width: event.width,
    angle: event.angle,
    color: event.color,
    alpha: Math.min(1, pulse),
  };
}

function buildRotatingShape(event: RotatingShapeEvent, time: number) {
  const age = time - event.startTime;

  if (age < 0 || age > event.duration) {
    return undefined;
  }

  const orbitAngle = degreesToRadians(event.startAngle + event.rotationSpeed * age);
  const rotation = degreesToRadians(event.rotationSpeed * age * 1.8);

  return {
    eventId: event.id,
    x: event.x + Math.cos(orbitAngle) * event.orbitRadius,
    y: event.y + Math.sin(orbitAngle) * event.orbitRadius,
    radius: event.size,
    rotation,
    sides: Math.max(3, Math.round(event.sides)),
    color: event.color,
    alpha: 0.92,
  };
}

function wallToWarning(eventId: string, wall: Omit<WallRender, "eventId" | "color" | "alpha">, color: number, alpha: number): HazardRender {
  return createHazard({
    eventId,
    shape: "rectangle",
    x: wall.x + wall.width / 2,
    y: wall.y + wall.height / 2,
    width: wall.width,
    height: wall.height,
    radius: Math.min(wall.width, wall.height) / 2,
    rotation: 0,
    sides: 4,
    strokeWidth: 4,
    filled: false,
    isWarning: true,
    color,
    alpha,
  });
}

function createHazard(hazard: HazardRender): HazardRender {
  return hazard;
}

function getWarningAlpha(startTime: number, warningTime: number, time: number): number {
  if (warningTime <= 0 || time < startTime - warningTime || time >= startTime) {
    return 0;
  }

  const warningAge = time - (startTime - warningTime);
  const progress = clamp(warningAge / warningTime, 0, 1);
  const blink = 0.45 + Math.abs(Math.sin(warningAge * Math.PI * 7)) * 0.55;

  return Math.max(0.1, progress) * blink * 0.72;
}

function getFireClipBaseAngle(
  event: (SpawnBulletSpreadEvent | SpawnAimedSpreadEvent | FireFromMovingOriginEvent) & FireClipFields,
  occurrenceTime: number,
  fallbackBaseAngle: number,
  playerPosition?: { x: number; y: number },
): number {
  if ((event.aimAtPlayer ?? 0) <= 0) {
    return fallbackBaseAngle;
  }

  return (
    getLockedAimAngle(
      `clip-aim:${event.id}:${occurrenceTime.toFixed(3)}:${event.originX}:${event.originY}`,
      event.originX,
      event.originY,
      { x: event.originX, y: event.originY + 1 },
      playerPosition,
    ) + fallbackBaseAngle
  );
}

function getLockedAimAngle(
  key: string,
  originX: number,
  originY: number,
  fallbackTarget: { x: number; y: number },
  playerPosition?: { x: number; y: number },
): number {
  const cachedAngle = lockedAimAngles.get(key);

  if (cachedAngle !== undefined) {
    return cachedAngle;
  }

  const target = playerPosition ?? fallbackTarget;
  const angle = radiansToDegrees(Math.atan2(target.y - originY, target.x - originX));
  lockedAimAngles.set(key, angle);
  return angle;
}

function lerp(start: number, end: number, progress: number): number {
  return start + (end - start) * progress;
}

function easeInOut(progress: number): number {
  return progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
}

function easeOut(progress: number): number {
  return 1 - Math.pow(1 - progress, 3);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function pushIfDefined<T>(target: T[], value: T | undefined): void {
  if (value) {
    target.push(value);
  }
}

function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function radiansToDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}
