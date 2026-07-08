/**
 * input.js — keyboard handling for the shooter.
 *
 * We keep input separate from game logic: this module only LISTENS to the
 * keyboard and records "which shot did the player request?". The main loop
 * reads that request and acts on it. Separating input from logic keeps each
 * file with a single clear job (good practice to mention at the exam).
 *
 * Controls:
 *   ArrowLeft  -> shot aimed to the left side of the goal
 *   ArrowRight -> shot aimed to the right side of the goal
 *   ArrowUp    -> lob / chip (high ball under the crossbar)
 *   Space      -> straight central shot
 */
export class ShooterInput {
  constructor() {
    this.requestedShot = null; // becomes 'left' | 'right' | 'lob' | 'center'

    window.addEventListener("keydown", (e) => {
      switch (e.code) {
        case "ArrowLeft":  this.requestedShot = "left";   e.preventDefault(); break;
        case "ArrowRight": this.requestedShot = "right";  e.preventDefault(); break;
        case "ArrowUp":    this.requestedShot = "lob";    e.preventDefault(); break;
        case "Space":      this.requestedShot = "center"; e.preventDefault(); break;
      }
    });
  }

  // main loop calls this; it returns the pending shot once, then clears it
  consumeShot() {
    const s = this.requestedShot;
    this.requestedShot = null;
    return s;
  }
}

/**
 * shotTarget(kind, goal) — translates a shot kind into an actual aim point
 * (x, y, z) inside the goal mouth, plus a flight time. main.js feeds this to
 * ball.kickToTarget so the parabola lands where the player intended.
 */
export function shotTarget(kind, goal) {
  const halfW = goal.GOAL_W / 2;
  const z = goal.GOAL_Z;
  switch (kind) {
    case "left":   return { point: { x: -halfW + 0.8, y: 0.9, z }, time: 0.6 };
    case "right":  return { point: { x:  halfW - 0.8, y: 0.9, z }, time: 0.6 };
    case "lob":    return { point: { x: 0,            y: goal.GOAL_H - 0.3, z }, time: 0.8 };
    case "center": return { point: { x: 0,            y: 0.8, z }, time: 0.55 };
    default:       return null;
  }
}