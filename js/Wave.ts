export class Wave {
  amplitude: number;
  frequency: number;
  phase: number;
  yOffset: number;
  direction: number;

  constructor(
    amplitude: number,
    frequency: number,
    phase: number,
    yOffset: number,
    direction: number
  ) {
    this.amplitude = amplitude;
    this.frequency = frequency;
    this.phase = phase;
    this.yOffset = yOffset;
    this.direction = direction;
  }
}
