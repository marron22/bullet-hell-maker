import { createAttackEvent } from "./eventFactory";
import { applyAttackTemplate } from "./eventTemplates";
import type { AttackEvent, AttackEventKind, BulletPattern, StageSize } from "./types";

const starterStage: StageSize = {
  width: 960,
  height: 540,
};

export function createStarterPattern(): BulletPattern {
  return {
    version: 1,
    title: "Starter Pattern",
    duration: 24,
    stage: starterStage,
    timeline: {
      musicOffset: 0,
      bpm: 120,
      beatsPerMeasure: 4,
    },
    events: [
      makeEvent("spawn_bullet_spread", 0.5, "single-bullet"),
      makeEvent("spawn_bullet_spread", 1.4, "aimed-3way"),
      makeEvent("spawn_bullet_spread", 3.4, "fan-burst"),
      makeEvent("spawn_bullet_spread", 5.5, "radial-burst"),
      makeEvent("spawn_bullet_spread", 7.4, "boss-fan"),
      makeEvent("spawn_bullet_spread", 9.7, "polynomial-radial"),
      makeEvent("spawn_bullet_spread", 12.1, "left-wall"),
      makeEvent("spawn_bullet_spread", 13.1, "horizontal-laser"),
      makeEvent("spawn_bullet_spread", 14.4, "orbiting-diamond"),
      makeEvent("spawn_bullet_spread", 16.2, "curved-laser-ring"),
      makeEvent("spawn_bullet_spread", 19.0, "fan-burst"),
      makeEvent("spawn_bullet_spread", 21.0, "radial-burst"),
    ],
  };
}

function makeEvent(kind: AttackEventKind, startTime: number, template?: string): AttackEvent {
  const event = createAttackEvent(kind, startTime, starterStage);
  applyAttackTemplate(event, template, starterStage);

  return event;
}
