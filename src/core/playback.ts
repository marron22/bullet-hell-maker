import type { AttackEvent, AttackOccurrence } from "./types";

export class PlaybackClock {
  private currentTime = 0;
  private playing = false;

  get time(): number {
    return this.currentTime;
  }

  get isPlaying(): boolean {
    return this.playing;
  }

  play(): void {
    this.playing = true;
  }

  stop(): void {
    this.playing = false;
  }

  reset(): void {
    this.currentTime = 0;
    this.playing = false;
  }

  seek(time: number, maxTime: number): void {
    this.currentTime = Math.min(Math.max(time, 0), maxTime);
  }

  update(deltaSeconds: number, maxTime: number): { previousTime: number; currentTime: number } {
    const previousTime = this.currentTime;

    if (this.playing) {
      this.currentTime = Math.min(this.currentTime + deltaSeconds, maxTime);

      if (this.currentTime >= maxTime) {
        this.playing = false;
      }
    }

    return {
      previousTime,
      currentTime: this.currentTime,
    };
  }
}

export function collectAttackOccurrences(
  events: AttackEvent[],
  previousTime: number,
  currentTime: number,
): AttackOccurrence[] {
  const occurrences: AttackOccurrence[] = [];

  for (const event of events) {
    if (event.kind !== "radialBurst") {
      continue;
    }

    const repeatCount = Math.max(1, event.repeatCount);
    const repeatInterval = Math.max(0, event.repeatInterval);

    for (let index = 0; index < repeatCount; index += 1) {
      const occurrenceTime = event.startTime + repeatInterval * index;

      const crossedOccurrence = previousTime < occurrenceTime && currentTime >= occurrenceTime;
      const startsAtZero = previousTime === 0 && occurrenceTime === 0 && currentTime > previousTime;

      if (crossedOccurrence || startsAtZero) {
        occurrences.push({ event, occurrenceTime, index });
      }
    }
  }

  return occurrences.sort((a, b) => a.occurrenceTime - b.occurrenceTime);
}
