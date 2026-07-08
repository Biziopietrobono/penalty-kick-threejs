import * as THREE from "three";

/**
 * Ball — a soccer ball with simple physics.
 *
 * Physics model (deliberately simple, written by hand, not a library):
 *   - the ball has a velocity vector (vx, vy, vz)
 *   - every frame gravity pulls vy down
 *   - the position advances by velocity * dt
 *   - when it hits the ground it bounces with damping
 * This is the classic projectile/parabola: horizontal speed stays roughly
 * constant while vertical speed is bent by gravity, tracing an arc.
 */
export class Ball {
  constructor(scene) {
    // The ball uses a StandardMaterial so it can carry a SPECULAR-type map.
    // In modern PBR the "specular" concept is a roughnessMap: it controls how
    // shiny each area is. Here the white panels are smooth/glossy (low
    // roughness -> catch the stadium light) while the dark pentagons are matte
    // (high roughness). This gives a moving highlight as the ball rolls.
    const colorTex = makeBallTexture();
    const roughTex = makeBallRoughness();
    this.mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 24, 18),
      new THREE.MeshStandardMaterial({
        map: colorTex,
        roughnessMap: roughTex,  // <-- the specular-type map
        roughness: 0.55,         // modulated per-pixel by the map
        metalness: 0.0,
      })
    );
    this.mesh.castShadow = true;
    scene.add(this.mesh);

    // physics state
    this.vel = new THREE.Vector3();
    this.gravity = -18;       // units/s^2 (tuned for the scene scale)
    this.radius = 0.22;
    this.moving = false;
    this.restitution = 0.45;  // energy kept after a bounce (0..1)
    this.friction = 0.98;     // horizontal slowdown per frame on ground

    this.startPos = new THREE.Vector3(0, this.radius, -5); // penalty spot
    this.reset();
  }

  // place the ball back on the penalty spot, stopped
  reset() {
    this.mesh.position.copy(this.startPos);
    this.vel.set(0, 0, 0);
    this.moving = false;
    this.airTime = 0;
    this.mesh.rotation.set(0, 0, 0);
  }

  // launch the ball with an initial velocity vector
  kick(velocity) {
    this.vel.copy(velocity);
    this.moving = true;
  }

  /**
   * kickToTarget(target, flightTime) — physics-based aiming.
   * Given where we want the ball to arrive (target) and how long the flight
   * should take, we SOLVE for the launch velocity that lands it there:
   *   horizontal: v = (target - start) / time   (constant speed)
   *   vertical:   we invert y = y0 + vy*t - ½·g·t²  to get vy
   * This is the projectile-motion math done explicitly, not guessed.
   */
  kickToTarget(target, flightTime) {
    const g = -this.gravity; // positive magnitude
    const p0 = this.mesh.position;
    const vx = (target.x - p0.x) / flightTime;
    const vz = (target.z - p0.z) / flightTime;
    const vy = (target.y - p0.y + 0.5 * g * flightTime * flightTime) / flightTime;
    this.kick(new THREE.Vector3(vx, vy, vz));
  }

  // advance the physics by dt seconds
  update(dt) {
    if (!this.moving) return;

    // safety timer: no shot should last forever
    this.airTime = (this.airTime || 0) + dt;

    // gravity affects vertical velocity
    this.vel.y += this.gravity * dt;

    // advance position
    this.mesh.position.addScaledVector(this.vel, dt);

    // roll: spin the ball around the axis perpendicular to travel
    const speed = this.vel.length();
    if (speed > 0.01) {
      const axis = new THREE.Vector3(this.vel.z, 0, -this.vel.x).normalize();
      this.mesh.rotateOnWorldAxis(axis, (speed * dt) / this.radius);
    }

    // ground bounce
    if (this.mesh.position.y < this.radius) {
      this.mesh.position.y = this.radius;
      this.vel.y = -this.vel.y * this.restitution;
      this.vel.x *= this.friction;
      this.vel.z *= this.friction;
    }

    // --- STOP CONDITIONS (robust) ---
    // 1) the ball is slow and near the ground -> it has settled
    const settled =
      this.mesh.position.y <= this.radius + 0.05 && this.vel.length() < 1.0;
    // 2) it travelled too far away (into the net / off pitch)
    const tooFar =
      this.mesh.position.z < -12 || Math.abs(this.mesh.position.x) > 14;
    // 3) safety: a shot never lasts more than 3.5 seconds
    const timedOut = this.airTime > 3.5;

    if (settled || tooFar || timedOut) {
      this.moving = false;
      this.vel.set(0, 0, 0);
      this.airTime = 0;
    }
  }
}

/**
 * makeBallTexture — a simple canvas with the classic pentagon-ish spots,
 * faked as dark patches on white. Good enough for a cartoon ball.
 */
function makeBallTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = "#1a1a1a";
  // scatter a few dark pentagonal-ish blobs
  const spots = [[128, 60], [60, 150], [200, 150], [128, 210], [40, 50], [215, 60]];
  for (const [x, y] of spots) {
    ctx.beginPath();
    const r = 26;
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 - Math.PI / 2;
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r;
      k === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }
  return new THREE.CanvasTexture(c);
}

/**
 * makeBallRoughness — the SPECULAR-type map for the ball (a roughness map).
 * Same layout as the color texture: the pentagon panels are painted DARK
 * (low roughness = glossy, they catch a highlight) and the rest is light
 * (high roughness = matte). Because it's a separate map from the color, the
 * ball shows a shiny highlight that moves as it rolls — a real specular cue.
 */
function makeBallRoughness() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d");
  // base: smooth-ish glossy white leather
  ctx.fillStyle = "#888888"; // medium roughness -> the white panels catch light
  ctx.fillRect(0, 0, 256, 256);
  // pentagon panels: a bit glossier (low roughness -> dark in the map)
  ctx.fillStyle = "#444444";
  const spots = [[128, 60], [60, 150], [200, 150], [128, 210], [40, 50], [215, 60]];
  for (const [x, y] of spots) {
    ctx.beginPath();
    const r = 26;
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 - Math.PI / 2;
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r;
      k === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }
  return new THREE.CanvasTexture(c);
}