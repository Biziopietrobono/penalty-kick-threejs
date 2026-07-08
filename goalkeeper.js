import * as THREE from "three";
import * as TWEEN from "@tweenjs/tween.js";
import { makeToonGradient } from "./scene.js";

/**
 * Goalkeeper — a second cartoon "mascot", same simple build as the player but
 * in the Roma kit (deep red body, yellow trim). It stands on the goal line and
 * can DIVE left/right or stay central with arms up.
 *
 * Like the player it's a HIERARCHICAL model; the dive animation rotates the
 * whole root plus the arms, and (being hierarchical) every body part follows.
 */
export class Goalkeeper {
  constructor(scene, goal) {
    this.goal = goal;
    this.root = new THREE.Group();
    this.joints = {};
    const grad = makeToonGradient(4);
    const toon = (c) => new THREE.MeshToonMaterial({ color: c, gradientMap: grad });

    this.matShirt = toon(0x8e1b1b);  // Roma deep red
    this.matTrim = toon(0xf2c14e);   // Roma yellow
    this.matShorts = toon(0xffffff);
    this.matSkin = toon(0xf0c9a0);
    this.matShoe = toon(0x161616);
    this.matHair = toon(0x222018);

    this.legLen = 0.8;
    this.hipY = 0.8;
    this.diving = false;

    this._build();
    // stand on the goal line, facing the shooter (+Z)
    this.root.position.set(0, 0, goal.GOAL_Z + 0.3);
    scene.add(this.root);
  }

  _grp(name, x, y, z, parent) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.name = name; parent.add(g); this.joints[name] = g;
    return g;
  }
  _add(geo, mat, parent, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true; m.position.set(x, y, z); parent.add(m);
    return m;
  }
  _leg(side, dir) {
    const hip = this._grp("hip" + side, dir * 0.16, this.hipY, 0, this.root);
    const legGeo = THREE.CapsuleGeometry
      ? new THREE.CapsuleGeometry(0.11, this.legLen - 0.22, 6, 12)
      : new THREE.CylinderGeometry(0.11, 0.11, this.legLen, 12);
    this._add(legGeo, this.matShorts, hip, 0, -this.legLen / 2, 0);
    const foot = this._grp("foot" + side, 0, -this.legLen, 0, hip);
    this._add(new THREE.BoxGeometry(0.16, 0.12, 0.32), this.matShoe, foot, 0, 0, 0.08);
  }
  _arm(side, dir, body) {
    const shoulder = this._grp("shoulder" + side, dir * 0.34, 0.5, 0, body);
    const armGeo = THREE.CapsuleGeometry
      ? new THREE.CapsuleGeometry(0.08, 0.42, 6, 12)
      : new THREE.CylinderGeometry(0.08, 0.08, 0.55, 12);
    this._add(armGeo, this.matShirt, shoulder, 0, -0.3, 0);
    // big yellow goalkeeper glove at the end of the arm
    this._add(new THREE.SphereGeometry(0.14, 12, 10), this.matTrim, shoulder, 0, -0.62, 0);
  }
  _build() {
    this._leg("L", -1);
    this._leg("R", 1);
    const body = this._grp("body", 0, this.hipY, 0, this.root);
    const torso = THREE.CapsuleGeometry
      ? new THREE.CapsuleGeometry(0.28, 0.4, 8, 16)
      : new THREE.CylinderGeometry(0.28, 0.26, 0.7, 16);
    this._add(torso, this.matShirt, body, 0, 0.35, 0).scale.set(1, 1, 0.8);
    const head = this._grp("head", 0, 0.78, 0, body);
    this._add(new THREE.SphereGeometry(0.26, 24, 18), this.matSkin, head);
    const hair = this._add(new THREE.SphereGeometry(0.265, 24, 18), this.matHair, head, 0, 0.06, 0);
    hair.scale.set(1, 0.65, 1);
    this._add(new THREE.SphereGeometry(0.05, 8, 6), this.matSkin, head, 0, -0.03, 0.25);
    this._arm("L", -1, body);
    this._arm("R", 1, body);
    this.setReady();
  }

  // ready stance: slight crouch, arms forward and spread, gloves visible
  setReady() {
    const d2r = (d) => (d * Math.PI) / 180;
    const J = this.joints;
    // arms forward (rotation.x) and a bit spread (rotation.z) so gloves show
    J.shoulderL.rotation.x = d2r(40);
    J.shoulderR.rotation.x = d2r(40);
    J.shoulderL.rotation.z = d2r(30);
    J.shoulderR.rotation.z = d2r(-30);
    J.hipL.rotation.z = d2r(7);
    J.hipR.rotation.z = d2r(-7);
    this.root.rotation.set(0, 0, 0);
    this.root.position.set(0, 0, this.goal.GOAL_Z + 0.3);
  }

  /**
   * dive(dir) — 'left', 'right' or 'center'.
   * Compact, natural dive: the arms are locked straight overhead and the WHOLE
   * body leans toward the post as one rigid "arrow", so head, torso, arms and
   * gloves all point the same way. This uses the hierarchy: we tilt the root
   * and every child follows together (no limbs flailing independently).
   */
  dive(dir, speed = 1) {
    if (this.diving) return;
    const d2r = (d) => (d * Math.PI) / 180;
    const dur = (ms) => ms / speed;
    const J = this.joints;
    // how far sideways the keeper slides. Kept well inside the posts so that
    // even with the lean the arms don't cross the goalpost.
    const reach = this.goal.GOAL_W * 0.27;  // ~1.98 for a 7.32 goal

    // Lock both arms straight up over the head, parallel — they become the
    // tip of the "arrow". They stay fixed; the lean does the work.
    J.shoulderL.rotation.x = 0;
    J.shoulderR.rotation.x = 0;
    J.shoulderL.rotation.z = d2r(165);
    J.shoulderR.rotation.z = d2r(-165);

    const s = { x: 0, y: 0, tilt: 0 };
    const apply = () => {
      this.root.position.x = s.x;
      this.root.position.y = s.y;
      this.root.rotation.z = d2r(s.tilt); // whole body leans as one unit
    };

    let target;
    if (dir === "left") {
      // keeper's own left = +X. Lean so HEAD/ARMS go toward +X (post) and
      // FEET stay toward the center (-X): that needs a NEGATIVE tilt.
      target = { x: reach, y: 0.55, tilt: -60 };
    } else if (dir === "right") {
      // toward -X: head/arms to -X, feet toward center (+X): POSITIVE tilt.
      target = { x: -reach, y: 0.55, tilt: 60 };
    } else {
      // center: jump straight up, no lean (arms already overhead)
      target = { x: 0, y: 0.7, tilt: 0 };
    }

    this.diving = true;
    const go = new TWEEN.Tween(s).to(target, dur(320))
      .easing(TWEEN.Easing.Quadratic.Out).onUpdate(apply);
    const hold = new TWEEN.Tween(s).to({}, dur(500));
    const back = new TWEEN.Tween(s)
      .to({ x: 0, y: 0, tilt: 0 }, dur(450))
      .easing(TWEEN.Easing.Quadratic.InOut).onUpdate(apply)
      .onComplete(() => { this.diving = false; this.setReady(); });
    go.chain(hold); hold.chain(back); go.start();
  }

  // change the shirt color at runtime (used to swap Lazio/Roma kits in match)
  setKit(shirtColor) { this.matShirt.color.set(shirtColor); }
}