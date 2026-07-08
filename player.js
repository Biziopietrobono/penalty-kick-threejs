import * as THREE from "three";
import { makeToonGradient } from "./scene.js";

/**
 * Player — a clean cartoon "mascot" footballer, built as a HIERARCHICAL model.
 *
 * Design goal: SIMPLE but solid. Few, well-proportioned parts, legs always
 * clearly visible. The model is built from the GROUND UP so the feet sit on
 * y=0 by construction (no fragile height math).
 *
 * Hierarchy (each child follows its parent's rotation — this is what the
 * kick animation exploits):
 *   root (feet on the ground)
 *    └ hipL / hipR  ─ (thigh+shin as one simple leg) ─ foot
 *    └ body
 *         ├ head
 *         ├ armL (shoulder ─ arm)
 *         └ armR (shoulder ─ arm)
 *
 * Lazio kit: sky-blue body, white shorts area, black shoes.
 */
export class Player {
  constructor(scene, opts = {}) {
    this.root = new THREE.Group();
    this.joints = {};
    const grad = makeToonGradient(4);
    const toon = (c) => new THREE.MeshToonMaterial({ color: c, gradientMap: grad });

    this.matShirt = toon(opts.shirt ?? 0x9fd4ff);
    this.matShorts = toon(0xffffff);
    this.matSkin = toon(0xf0c9a0);
    this.matShoe = toon(0x161616);
    this.matHair = toon(0x3a2a1a);

    // proportions (in world units)
    this.legLen = 0.8;   // from hip down to the foot
    this.hipY = 0.8;     // hip height above ground = leg length

    this._build();
    scene.add(this.root);
  }

  _grp(name, x, y, z, parent) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.name = name;
    parent.add(g);
    this.joints[name] = g;
    return g;
  }

  _add(geo, mat, parent, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }

  // a simple rounded leg: a capsule from the hip joint down to the foot
  _leg(side, dir) {
    // hip joint sits at hipY; the leg hangs DOWN from it (length legLen)
    const hip = this._grp("hip" + side, dir * 0.16, this.hipY, 0, this.root);
    const legGeo = THREE.CapsuleGeometry
      ? new THREE.CapsuleGeometry(0.11, this.legLen - 0.22, 6, 12)
      : new THREE.CylinderGeometry(0.11, 0.11, this.legLen, 12);
    this._add(legGeo, this.matShorts, hip, 0, -this.legLen / 2, 0);
    // foot at the bottom of the leg
    const foot = this._grp("foot" + side, 0, -this.legLen, 0, hip);
    this._add(new THREE.BoxGeometry(0.16, 0.12, 0.32), this.matShoe, foot, 0, 0, 0.08);
  }

  _build() {
    // LEGS first (children of root, standing on the ground)
    this._leg("L", -1);
    this._leg("R", 1);

    // BODY sits on top of the hips
    const body = this._grp("body", 0, this.hipY, 0, this.root);
    const torso = THREE.CapsuleGeometry
      ? new THREE.CapsuleGeometry(0.28, 0.4, 8, 16)
      : new THREE.CylinderGeometry(0.28, 0.26, 0.7, 16);
    this._add(torso, this.matShirt, body, 0, 0.35, 0).scale.set(1, 1, 0.8);

    // HEAD
    const head = this._grp("head", 0, 0.78, 0, body);
    this._add(new THREE.SphereGeometry(0.26, 24, 18), this.matSkin, head);
    const hair = this._add(new THREE.SphereGeometry(0.265, 24, 18), this.matHair, head, 0, 0.06, 0);
    hair.scale.set(1, 0.65, 1);
    this._add(new THREE.SphereGeometry(0.05, 8, 6), this.matSkin, head, 0, -0.03, 0.25); // nose

    // ARMS (children of body)
    this._arm("L", -1, body);
    this._arm("R", 1, body);

    this.setPose("idle");
  }

  _arm(side, dir, body) {
    const shoulder = this._grp("shoulder" + side, dir * 0.34, 0.5, 0, body);
    const armGeo = THREE.CapsuleGeometry
      ? new THREE.CapsuleGeometry(0.08, 0.42, 6, 12)
      : new THREE.CylinderGeometry(0.08, 0.08, 0.55, 12);
    this._add(armGeo, this.matShirt, shoulder, 0, -0.3, 0);
    this._add(new THREE.SphereGeometry(0.085, 10, 8), this.matSkin, shoulder, 0, -0.58, 0); // hand
  }

  setPose(name) {
    const d2r = (d) => (d * Math.PI) / 180;
    const J = this.joints;
    if (name === "idle") {
      J.shoulderL.rotation.z = d2r(12);
      J.shoulderR.rotation.z = d2r(-12);
      J.hipL.rotation.x = d2r(-2);
      J.hipR.rotation.x = d2r(2);
    }
  }

  setPosition(x, y, z) { this.root.position.set(x, y, z); }
  faceGoal() { this.root.rotation.y = Math.PI; }

  // change the shirt color at runtime (used to swap Lazio/Roma kits in match)
  setKit(shirtColor) { this.matShirt.color.set(shirtColor); }
}