import type { AttackOccurrence, BulletRuntime, RadialBurstEvent } from "./types";

let bulletSerial = 0;

export function spawnBulletsForOccurrence(occurrence: AttackOccurrence): BulletRuntime[] {
  if (occurrence.event.kind === "radialBurst") {
    return spawnRadialBurst(occurrence.event);
  }

  return [];
}

export function updateBullets(bullets: BulletRuntime[], deltaSeconds: number): BulletRuntime[] {
  return bullets
    .map((bullet) => ({
      ...bullet,
      x: bullet.x + bullet.vx * deltaSeconds,
      y: bullet.y + bullet.vy * deltaSeconds,
      age: bullet.age + deltaSeconds,
    }))
    .filter((bullet) => bullet.age <= bullet.lifeTime);
}

function spawnRadialBurst(event: RadialBurstEvent): BulletRuntime[] {
  const bullets: BulletRuntime[] = [];
  const count = Math.max(1, event.bulletCount);
  const fullCircle = Math.abs(event.arcDegrees) >= 360;
  const angleStep = fullCircle || count === 1 ? event.arcDegrees / count : event.arcDegrees / (count - 1);

  for (let index = 0; index < count; index += 1) {
    const angleDegrees = event.startAngle + angleStep * index;
    const angleRadians = (angleDegrees * Math.PI) / 180;

    bullets.push({
      id: `bullet_${bulletSerial++}`,
      eventId: event.id,
      x: event.x,
      y: event.y,
      vx: Math.cos(angleRadians) * event.bulletSpeed,
      vy: Math.sin(angleRadians) * event.bulletSpeed,
      radius: event.bulletRadius,
      color: event.color,
      age: 0,
      lifeTime: event.duration,
    });
  }

  return bullets;
}
