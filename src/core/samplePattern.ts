import { createAttackPackageEvent, createGeneratedEventsForPackage } from "./packages";
import type { AttackEvent, AttackPackageEvent, AttackPackageKind, BulletPattern, StageSize } from "./types";

const starterStage: StageSize = {
  width: 960,
  height: 540,
};

export function createStarterPattern(): BulletPattern {
  const events: AttackEvent[] = [];

  addPackage(events, "package_random_barrage", 0.5, "ランダム扇弾", 0, {
    packageX: starterStage.width / 2,
    packageY: 92,
    packageCount: 12,
    packageAngleWidth: 150,
    packageInterval: 0.16,
    packageSpeed: 310,
    packageDuration: 3.2,
  });
  addPackage(events, "package_bomb_burst", 2.3, "ボム破裂弾", 1, {
    packageStartX: -90,
    packageStartY: starterStage.height * 0.32,
    packageX: starterStage.width * 0.48,
    packageY: starterStage.height * 0.48,
    packageFuseTime: 1,
    packageBulletCount: 20,
    packageSpeed: 285,
    packageDuration: 2.8,
  });
  addPackage(events, "package_repeating_lasers", 4.2, "横レーザー連射", 2, {
    packageCount: 4,
    packageInterval: 0.45,
    packageThickness: 20,
    packageDuration: 0.6,
    packageWarningTime: 0.55,
    packageOrientation: "horizontal",
  });
  addPackage(events, "package_random_circle", 6.1, "ランダム円攻撃", 0, {
    packageCount: 3,
    packageInterval: 0.5,
    packageSize: 130,
    packageDuration: 1.05,
    packageWarningTime: 0.65,
  });
  addPackage(events, "package_grid_square", 7.7, "グリッド四角攻撃", 1, {
    packageCount: 4,
    packageInterval: 0.38,
    packageSize: 96,
    packageDuration: 1,
    packageWarningTime: 0.55,
  });
  addPackage(events, "package_lag_radial", 9.2, "ラグ円形連射", 2, {
    packageX: starterStage.width / 2,
    packageY: starterStage.height / 2,
    packageCount: 6,
    packageBulletCount: 14,
    packageStartAngle: 0,
    packageAngleWidth: 16,
    packageInterval: 0.18,
    packageSpeed: 260,
    packageDuration: 2.6,
  });
  addPackage(events, "package_random_lasers", 10.7, "ランダムレーザー", 0, {
    packageCount: 5,
    packageThickness: 16,
    packageDuration: 0.85,
    packageWarningTime: 0.5,
  });
  addPackage(events, "package_center_lasers", 12.1, "中心全方向レーザー", 1, {
    packageCount: 8,
    packageStartAngle: 0,
    packageThickness: 14,
    packageDuration: 0.9,
    packageWarningTime: 0.5,
  });
  addPackage(events, "package_area_parallel", 13.6, "エリア平行弾", 2, {
    packageX: starterStage.width / 2,
    packageY: starterStage.height * 0.48,
    packageWidth: 520,
    packageHeight: 220,
    packageCount: 9,
    packageInterval: 0.1,
    packageSpeed: 300,
    packageDuration: 2.1,
    packageOrientation: "horizontal",
  });
  addPackage(events, "package_snake_chain", 15.1, "スネーク正方形", 3, {
    packageX: 90,
    packageY: starterStage.height * 0.56,
    packageCount: 16,
    packageSpacing: 0.06,
    packageSize: 22,
    packageSpeed: 255,
    packageDuration: 3.1,
    packagePolynomialA: 0.2,
    packagePolynomialB: 0.28,
    packagePolynomialC: -0.03,
  });
  addPackage(events, "package_enter_exit_bar", 16.9, "入退場バー", 1, {
    packageX: starterStage.width / 2,
    packageY: starterStage.height * 0.72,
    packageLength: 960,
    packageThickness: 26,
    packageSpeed: 330,
    packageDuration: 2.5,
    packageWarningTime: 0.65,
    packageOrientation: "horizontal",
  });
  addPackage(events, "package_rotating_lasers", 19.2, "中央回転レーザー", 2, {
    packageCount: 8,
    packageStartAngle: 0,
    packageLength: Math.hypot(starterStage.width, starterStage.height) * 1.25,
    packageThickness: 13,
    packageRotationSpeed: 76,
    packageDuration: 3.2,
    packageWarningTime: 0.6,
  });
  addPackage(events, "package_sequential_lasers", 22.0, "時間差平行レーザー", 3, {
    packageCount: 6,
    packageInterval: 0.22,
    packageDistance: 58,
    packageInitialPosition: starterStage.height * 0.2,
    packageLength: starterStage.width,
    packageThickness: 18,
    packageDuration: 0.8,
    packageWarningTime: 0.4,
    packageOrientation: "horizontal",
  });
  addPackage(events, "package_split_lag_radial", 24.4, "分裂ラグ円形弾", 0, {
    packageX: starterStage.width / 2,
    packageY: starterStage.height / 2,
    packageCount: 8,
    packageBulletCount: 7,
    packageStartAngle: 0,
    packageSplitStartAngle: 28,
    packageSpeed: 245,
    packageSplitSpeed: 235,
    packageDuration: 1.05,
    packageSplitDuration: 1.1,
  });

  return {
    version: 1,
    title: "Starter Pattern",
    duration: 29,
    stage: starterStage,
    timelineLaneCount: 4,
    activeDifficulty: "normal",
    timeline: {
      musicOffset: 0,
      bpm: 120,
      beatsPerMeasure: 4,
    },
    events,
  };
}

function addPackage(
  events: AttackEvent[],
  kind: AttackPackageKind,
  startTime: number,
  name: string,
  lane: number,
  overrides: Partial<AttackPackageEvent>,
): void {
  const packageEvent = createAttackPackageEvent(kind, startTime, starterStage);

  Object.assign(packageEvent, overrides, {
    name,
    timelineLane: lane,
  });

  events.push(packageEvent, ...createGeneratedEventsForPackage(packageEvent, starterStage));
}
