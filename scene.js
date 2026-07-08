import * as THREE from "three";

/**
 * makeToonGradient() — builds the small gradient texture that turns a
 * MeshToonMaterial into a real "cartoon" look: instead of light fading
 * smoothly across a surface, it snaps into a few flat bands. NearestFilter
 * keeps the steps hard (no blending between bands).
 */
export function makeToonGradient(steps = 4) {
  const c = document.createElement("canvas");
  c.width = steps; c.height = 1;
  const ctx = c.getContext("2d");
  for (let i = 0; i < steps; i++) {
    const v = Math.round((i / (steps - 1)) * 255);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(i, 0, 1, 1);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  return tex;
}

/**
 * makeGrassNormalMap() — a procedurally generated NORMAL MAP for the pitch.
 *
 * A normal map stores, per pixel, the direction the surface "pretends" to
 * face. The flat base color rgb(128,128,255) means "pointing straight up";
 * we paint thousands of tiny tilted streaks (grass blades) so that, under the
 * stadium light, the pitch shows fine relief WITHOUT any extra geometry.
 * This is the third KIND of texture the assignment asks for (color + normal).
 */
export function makeGrassNormalMap() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d");
  // flat base = surface facing up
  ctx.fillStyle = "rgb(128,128,255)";
  ctx.fillRect(0, 0, 256, 256);
  // many short blades, each perturbing the normal slightly left/right
  for (let i = 0; i < 6000; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const len = 3 + Math.random() * 6;
    // random left/right tilt encoded in the red channel
    const tilt = 90 + Math.floor(Math.random() * 80);
    ctx.strokeStyle = `rgb(${tilt},150,255)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (Math.random() - 0.5) * 2, y - len);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(24, 36); // tile it densely across the big pitch
  return tex;
}

/**
 * buildStadium(scene) — creates the playing field, the goal, and the
 * surrounding environment in a clean cartoon style.
 *
 * Everything is built from Three.js primitives (boxes, planes, cylinders),
 * no imported models. The goal is made of a frame (posts + crossbar) plus
 * a net drawn as a grid of thin lines.
 *
 * Coordinate convention used across the whole game:
 *   - the player shoots along -Z (from +Z toward the goal at -Z)
 *   - X is left/right, Y is up
 *   - the goal stands on the ground around z = -11
 */
export function buildStadium(scene) {
  const group = new THREE.Group();
  const toonGrad = makeToonGradient(4);
  const toon = (color) =>
    new THREE.MeshToonMaterial({ color, gradientMap: toonGrad });

  // ---- GRASS PITCH ----
  // Standard material (not toon) so it can react to the NORMAL MAP, giving
  // the grass fine relief under the stadium light. The pitch is long (the
  // penalty spot is near your goal, the opponent goal is far away).
  const grassNormal = makeGrassNormalMap();
  const pitchMat = new THREE.MeshStandardMaterial({
    color: 0x4caf50,
    roughness: 0.9,
    metalness: 0.0,
    normalMap: grassNormal,
  });
  pitchMat.normalScale.set(1.2, 1.2); // strength of the fake relief
  const pitch = new THREE.Mesh(new THREE.PlaneGeometry(40, 70), pitchMat);
  pitch.rotation.x = -Math.PI / 2;
  pitch.position.z = 11.5;  // center the long pitch on the midfield
  pitch.receiveShadow = true;
  group.add(pitch);

  // mowing stripes: alternating darker bands for a stadium look
  const stripeMat = toon(0x43a047);
  for (let i = -6; i < 6; i += 2) {
    const stripe = new THREE.Mesh(new THREE.PlaneGeometry(40, 5), stripeMat);
    stripe.rotation.x = -Math.PI / 2;
    stripe.position.set(0, 0.01, i * 5);
    stripe.receiveShadow = true;
    group.add(stripe);
  }

  // ---- PENALTY BOX LINES (white) ----
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const addLine = (w, d, x, z) => {
    const line = new THREE.Mesh(new THREE.PlaneGeometry(w, d), lineMat);
    line.rotation.x = -Math.PI / 2;
    line.position.set(x, 0.02, z);
    group.add(line);
  };
  addLine(18, 0.15, 0, -3);
  addLine(0.15, 8, -9, -7);
  addLine(0.15, 8, 9, -7);
  const spot = new THREE.Mesh(new THREE.CircleGeometry(0.25, 20), lineMat);
  spot.rotation.x = -Math.PI / 2;
  spot.position.set(0, 0.02, -5);  // penalty spot, close to the goal
  group.add(spot);

  // ---- FIELD PERIMETER + HALFWAY LINE + CENTER CIRCLE ----
  // The pitch is long: your goal at z=-11, opponent goal at z=+34.
  const Z_NEAR = -13;   // goal line behind your goal
  const Z_FAR = 36;     // goal line behind the opponent goal
  const FIELD_HALF_X = 14;
  const midZ = (Z_NEAR + Z_FAR) / 2;   // halfway line
  const lenZ = Z_FAR - Z_NEAR;
  // touchlines (long sides) running the full length
  addLine(0.2, lenZ, -FIELD_HALF_X, midZ);
  addLine(0.2, lenZ, FIELD_HALF_X, midZ);
  // goal lines behind each goal
  addLine(FIELD_HALF_X * 2, 0.2, 0, Z_NEAR);
  addLine(FIELD_HALF_X * 2, 0.2, 0, Z_FAR);
  // halfway line + center circle
  addLine(FIELD_HALF_X * 2, 0.2, 0, midZ);
  const circle = new THREE.Mesh(new THREE.RingGeometry(2.4, 2.55, 40), lineMat);
  circle.rotation.x = -Math.PI / 2;
  circle.position.set(0, 0.02, midZ);
  group.add(circle);
  // opponent penalty box (near the far goal at z=34)
  addLine(18, 0.15, 0, 26);
  addLine(0.15, 8, -9, 30);
  addLine(0.15, 8, 9, 30);

  // ---- GOALS (two of them, one at each end) ----
  const GOAL_W = 7.32, GOAL_H = 2.44, GOAL_Z = -11;
  const postMat = toon(0xffffff);
  const postR = 0.09;

  // build a full goal (frame + net on back, sides and top) at distance z.
  // dir = -1 for the far goal (net extends toward -Z), +1 for the near one.
  function makeGoal(z, dir) {
    const netDepth = 1.6 * dir; // net extends BEHIND the goal (away from center)
    const makePost = (x) => {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(postR, postR, GOAL_H, 16), postMat);
      p.position.set(x, GOAL_H / 2, z);
      p.castShadow = true;
      group.add(p);
    };
    makePost(-GOAL_W / 2);
    makePost(GOAL_W / 2);
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(postR, postR, GOAL_W, 16), postMat);
    bar.rotation.z = Math.PI / 2;
    bar.position.set(0, GOAL_H, z);
    bar.castShadow = true;
    group.add(bar);

    // net: back plane + both side triangles + top plane
    const netMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 });
    const netGeo = new THREE.BufferGeometry();
    const pts = [];
    const stepX = GOAL_W / 10, stepY = GOAL_H / 5;
    const backZ = z + netDepth;
    // back plane
    for (let i = 0; i <= 10; i++) {
      const x = -GOAL_W / 2 + i * stepX;
      pts.push(x, 0, backZ, x, GOAL_H, backZ);
    }
    for (let j = 0; j <= 5; j++) {
      const y = j * stepY;
      pts.push(-GOAL_W / 2, y, backZ, GOAL_W / 2, y, backZ);
    }
    // top plane (from crossbar back to the top of the back net)
    for (let i = 0; i <= 10; i++) {
      const x = -GOAL_W / 2 + i * stepX;
      pts.push(x, GOAL_H, z, x, GOAL_H, backZ);
    }
    // LEFT and RIGHT side triangles (this is what was missing)
    for (const sx of [-GOAL_W / 2, GOAL_W / 2]) {
      // vertical lines fanning down the slope + the diagonal edge
      for (let j = 0; j <= 5; j++) {
        const y = j * stepY;
        pts.push(sx, y, z, sx, y, backZ);           // horizontal depth lines
      }
      pts.push(sx, GOAL_H, z, sx, 0, backZ);         // diagonal slope edge
      pts.push(sx, 0, z, sx, 0, backZ);              // ground edge
    }
    netGeo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    group.add(new THREE.LineSegments(netGeo, netMat));
  }

  makeGoal(GOAL_Z, -1);        // your goal at z=-11, net toward -Z
  makeGoal(34, 1);             // opponent goal far away at z=+34, net toward +Z

  // ---- DECORATIVE PLAYERS scattered on the far half (just for looks) ----
  buildDecoPlayers(group, toon);

  // ---- STANDS (tribune) around the pitch with a crowd texture ----
  buildStands(group, toon);

  scene.add(group);
  return { GOAL_W, GOAL_H, GOAL_Z };
}

/**
 * buildDecoPlayers — a handful of simple static "mascot" figures scattered on
 * the far half of the pitch, purely decorative (they don't move or interact).
 * They reuse the same cartoon look as the real players for visual consistency.
 */
function buildDecoPlayers(group, toon) {
  const kits = [0x9fd4ff, 0x8e1b1b, 0x9fd4ff, 0x8e1b1b, 0xffffff];
  // players spread along the long pitch (z from 8 to 28), within the width
  const spots = [
    [-8, 10], [6, 14], [-4, 20], [9, 12], [2, 24], [-10, 18],
  ];
  spots.forEach(([x, z], i) => {
    const kit = kits[i % kits.length];
    const p = makeDecoFigure(toon, kit);
    p.position.set(x, 0, z);
    p.rotation.y = Math.random() * Math.PI * 2;
    group.add(p);
  });

  // opponent GOALKEEPER standing in front of the far goal (z=34)
  const gk = makeDecoFigure(toon, 0x2ecc71); // green keeper kit
  gk.position.set(0, 0, 32.5);
  gk.rotation.y = Math.PI;  // face down the pitch toward the action
  group.add(gk);
}

// one simple standing mascot: legs, body, head. Built ground-up (feet at y=0).
function makeDecoFigure(toon, shirt) {
  const g = new THREE.Group();
  const skin = toon(0xf0c9a0), shorts = toon(0xffffff), shoe = toon(0x161616);
  const legLen = 0.8, hipY = 0.8;
  const leg = (dir) => {
    const hip = new THREE.Group();
    hip.position.set(dir * 0.16, hipY, 0);
    const geo = THREE.CapsuleGeometry
      ? new THREE.CapsuleGeometry(0.11, legLen - 0.22, 6, 10)
      : new THREE.CylinderGeometry(0.11, 0.11, legLen, 10);
    const m = new THREE.Mesh(geo, shorts); m.position.y = -legLen / 2; m.castShadow = true;
    hip.add(m);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.32), shoe);
    foot.position.set(0, -legLen, 0.08); hip.add(foot);
    g.add(hip);
  };
  leg(-1); leg(1);
  const body = new THREE.Group(); body.position.y = hipY; g.add(body);
  const torsoGeo = THREE.CapsuleGeometry
    ? new THREE.CapsuleGeometry(0.28, 0.4, 8, 14)
    : new THREE.CylinderGeometry(0.28, 0.26, 0.7, 14);
  const torso = new THREE.Mesh(torsoGeo, toon(shirt)); torso.position.y = 0.35;
  torso.scale.set(1, 1, 0.8); torso.castShadow = true; body.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 20, 14), skin);
  head.position.y = 0.78; head.castShadow = true; body.add(head);
  // arms
  for (const dir of [-1, 1]) {
    const armGeo = THREE.CapsuleGeometry
      ? new THREE.CapsuleGeometry(0.08, 0.42, 6, 10)
      : new THREE.CylinderGeometry(0.08, 0.08, 0.55, 10);
    const arm = new THREE.Mesh(armGeo, toon(shirt));
    arm.position.set(dir * 0.34, 0.5, 0); arm.rotation.z = dir * 0.25;
    body.add(arm);
  }
  return g;
}

/**
 * makeChoreographyReader(width, height) — draws a stylized Lazio EAGLE on a
 * small offscreen canvas, then returns a function colorAt(u, v) that gives the
 * color of that drawing at normalized coords (u,v in 0..1). The crowd reads
 * this like a tifo: each spectator shows the color of the cell above them, so
 * together the stand forms the eagle. (No photo is used — it's drawn in code.)
 */
function makeChoreographyReader(cols = 48, rows = 16) {
  // Draw on a canvas whose proportions MATCH the crowd grid (cols x rows),
  // so the eagle isn't stretched when mapped onto the spectators.
  const W = cols, H = rows;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d");

  // deep blue background for strong contrast with a white eagle
  ctx.fillStyle = "#0a3a6b";
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "#ffffff";
  const cx = W / 2;
  const cy = H * 0.52;
  const sx = W / 48;   // horizontal scale factor
  const sy = H / 16;   // vertical scale factor

  // body
  ctx.beginPath();
  ctx.ellipse(cx, cy, 2.2 * sx, 5 * sy, 0, 0, Math.PI * 2);
  ctx.fill();
  // head
  ctx.beginPath();
  ctx.ellipse(cx, cy - 5.5 * sy, 1.8 * sx, 1.8 * sy, 0, 0, Math.PI * 2);
  ctx.fill();
  // beak
  ctx.beginPath();
  ctx.moveTo(cx + 1.5 * sx, cy - 6 * sy);
  ctx.lineTo(cx + 4 * sx, cy - 5 * sy);
  ctx.lineTo(cx + 1.5 * sx, cy - 4.5 * sy);
  ctx.closePath();
  ctx.fill();
  // wings: big triangles sweeping up and out to the sides
  ctx.beginPath();
  ctx.moveTo(cx - 1.5 * sx, cy - 2 * sy);
  ctx.lineTo(cx - 22 * sx, cy - 6 * sy);
  ctx.lineTo(cx - 20 * sx, cy - 1 * sy);
  ctx.lineTo(cx - 1.5 * sx, cy + 2 * sy);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx + 1.5 * sx, cy - 2 * sy);
  ctx.lineTo(cx + 22 * sx, cy - 6 * sy);
  ctx.lineTo(cx + 20 * sx, cy - 1 * sy);
  ctx.lineTo(cx + 1.5 * sx, cy + 2 * sy);
  ctx.closePath();
  ctx.fill();
  // tail
  ctx.beginPath();
  ctx.moveTo(cx - 1.6 * sx, cy + 4 * sy);
  ctx.lineTo(cx + 1.6 * sx, cy + 4 * sy);
  ctx.lineTo(cx, cy + 7 * sy);
  ctx.closePath();
  ctx.fill();

  const data = ctx.getImageData(0, 0, W, H).data;
  return function colorAt(u, v) {
    const px = Math.min(W - 1, Math.max(0, Math.floor(u * W)));
    const py = Math.min(H - 1, Math.max(0, Math.floor((1 - v) * H)));
    const idx = (py * W + px) * 4;
    return (data[idx] << 16) | (data[idx + 1] << 8) | data[idx + 2];
  };
}

/**
 * buildStands — proper raked grandstands (stepped tiers) around the pitch,
 * filled with a crowd of small instanced figures. The stand behind the goal
 * is the "Curva Nord": sky-blue and white (Lazio colors) with a banner.
 *
 * Performance note: a stadium crowd would be thousands of meshes. Instead we
 * use THREE.InstancedMesh — ONE figure geometry drawn hundreds of times in
 * different positions/colors in a single draw call. This is the standard way
 * to render crowds efficiently.
 */
function buildStands(group, toon) {
  // ---- one reusable "spectator" geometry: head + body merged-ish ----
  // We keep it as two instanced meshes (body, head) sharing the same layout.
  const TIERS = 8;          // default number of steps (side/back stands)
  const stepDepth = 0.9;
  const stepHeight = 0.6;

  // Build one stand as stepped concrete + a crowd of instances facing the pitch
  // tiersOverride lets the Curva Nord be taller (more vertical resolution for
  // the choreography).
  function makeStand(width, perRow, centerX, centerZ, rotY, palette, banner, choreo, tiersOverride) {
    const stand = new THREE.Group();
    const concrete = toon(0x9aa0a8);
    const tiers = tiersOverride || TIERS;

    // stepped tiers (the actual grandstand structure)
    for (let t = 0; t < tiers; t++) {
      const step = new THREE.Mesh(
        new THREE.BoxGeometry(width, stepHeight, stepDepth),
        concrete
      );
      step.position.set(0, t * stepHeight + stepHeight / 2, -t * stepDepth);
      step.receiveShadow = true;
      stand.add(step);
    }

    // crowd: instanced bodies + heads on every tier
    const totalRows = tiers;
    const count = totalRows * perRow;
    const bodyGeo = new THREE.CylinderGeometry(0.16, 0.2, 0.5, 6);
    const headGeo = new THREE.SphereGeometry(0.13, 6, 5);
    const bodyMat = new THREE.MeshToonMaterial({ vertexColors: true });
    const headMat = new THREE.MeshToonMaterial({ color: 0xf0c9a0 });

    const bodies = new THREE.InstancedMesh(bodyGeo, bodyMat, count);
    const heads = new THREE.InstancedMesh(headGeo, headMat, count);
    const m = new THREE.Matrix4();
    const color = new THREE.Color();

    let i = 0;
    for (let t = 0; t < totalRows; t++) {
      for (let r = 0; r < perRow; r++) {
        const x = -width / 2 + 0.4 + (r / (perRow - 1)) * (width - 0.8);
        const y = t * stepHeight + stepHeight + 0.25;
        const z = -t * stepDepth + 0.1;
        m.makeTranslation(x, y, z);
        bodies.setMatrixAt(i, m);
        m.makeTranslation(x, y + 0.38, z);
        heads.setMatrixAt(i, m);
        // color: from the choreography image if present, else random palette
        let c;
        if (choreo) {
          const u = r / (perRow - 1);
          const v = t / (totalRows - 1);
          c = choreo(u, v);
        } else {
          c = palette[(Math.random() * palette.length) | 0];
        }
        color.set(c);
        bodies.setColorAt(i, color);
        // heads in the choreography also take the tifo color (held-up card)
        if (choreo) heads.setColorAt(i, color);
        i++;
      }
    }
    bodies.instanceMatrix.needsUpdate = true;
    if (bodies.instanceColor) bodies.instanceColor.needsUpdate = true;
    heads.instanceMatrix.needsUpdate = true;
    if (choreo && heads.instanceColor) heads.instanceColor.needsUpdate = true;
    stand.add(bodies, heads);

    if (banner) {
      const bannerMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(width * 0.75, 1.1),
        new THREE.MeshBasicMaterial({ map: makeBannerTexture(banner) })
      );
      bannerMesh.position.set(0, 1.0, 0.55);
      stand.add(bannerMesh);
    }

    stand.position.set(centerX, 0, centerZ);
    stand.rotation.y = rotY;
    group.add(stand);
  }

  // Lazio palette (sky blue + white) — home stadium
  const lazio = [0x87cefa, 0xffffff, 0x4aa3df, 0xffffff, 0x9fd4ff, 0x6fc0f0];
  // Roma palette (deep red + orange) — only the away end behind the far goal
  const roma = [0x8e1b1b, 0xb33030, 0xf2c14e, 0x8e1b1b, 0xa02020];

  makeStand(44, 60, 0, -16, 0, lazio, "CURVA NORD", null);       // behind your goal (Lazio)
  makeStand(90, 110, -22, 11.5, Math.PI / 2, lazio, null, null);  // left (Lazio)
  makeStand(90, 110, 22, 11.5, -Math.PI / 2, lazio, null, null);  // right (Lazio)
  makeStand(44, 60, 0, 39, Math.PI, roma, null, null);            // behind far goal (Roma)

  // small ultras banners scattered on the side stands
  addSmallBanner(group, "ENJOY LAZIO", -21.4, 2.2, 2, Math.PI / 2);
  addSmallBanner(group, "HATE ROMA", -21.4, 2.2, 20, Math.PI / 2);

  // banner on the Curva Nord (behind your goal), above CURVA NORD
  const ssLazio = new THREE.Mesh(
    new THREE.PlaneGeometry(7, 0.9),
    new THREE.MeshBasicMaterial({ map: makeBannerTexture("S.S. LAZIO") })
  );
  ssLazio.position.set(0, 3.7, -14.4); // above the crowd on the curva
  group.add(ssLazio);
}

/**
 * addSmallBanner — a small ultras banner (sky-blue cloth, white text) hung on
 * the front of a stand. Reuses the same banner texture look as CURVA NORD.
 */
function addSmallBanner(group, text, x, y, z, rotY) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(6, 0.9),
    new THREE.MeshBasicMaterial({ map: makeBannerTexture(text) })
  );
  mesh.position.set(x, y, z);
  mesh.rotation.y = rotY;
  group.add(mesh);
}

/**
 * makeBannerTexture(text) — a striscione: white text on a sky-blue cloth,
 * the classic ultras banner look.
 */
function makeBannerTexture(text) {
  const c = document.createElement("canvas");
  c.width = 1024; c.height = 160;
  const ctx = c.getContext("2d");
  // sky-blue cloth
  ctx.fillStyle = "#1e6fc4";
  ctx.fillRect(0, 0, c.width, c.height);
  // border
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 10;
  ctx.strokeRect(8, 8, c.width - 16, c.height - 16);
  // text
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 96px Arial Black, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, c.width / 2, c.height / 2 + 6);
  return new THREE.CanvasTexture(c);
}

/**
 * buildLights(scene) — stadium lighting.
 * Ambient + a "sun" directional light with shadows + a soft sky fill.
 */
export function buildLights(scene) {
  const ambient = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(0xfff6e0, 2.0);
  sun.position.set(8, 16, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 80;
  sun.shadow.camera.left = -25;
  sun.shadow.camera.right = 25;
  sun.shadow.camera.top = 25;
  sun.shadow.camera.bottom = -25;
  scene.add(sun);

  // hemisphere = sky color from above, grass bounce from below
  const hemi = new THREE.HemisphereLight(0x87ceeb, 0x3a7d34, 0.6);
  scene.add(hemi);

  return { ambient, sun, hemi };
}