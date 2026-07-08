import * as THREE from "three";
import * as TWEEN from "@tweenjs/tween.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { buildStadium, buildLights } from "./scene.js";
import { Ball } from "./ball.js";
import { ShooterInput, shotTarget } from "./input.js";
import { Player } from "./player.js";
import { kickAnimation } from "./animation.js";
import { Goalkeeper } from "./goalkeeper.js";
import { Game } from "./game.js";
import { Match } from "./match.js";
import { Sound } from "./audio.js";

// ---------------------------------------------------------------------------
// RENDERER
// ---------------------------------------------------------------------------
const canvas = document.getElementById("scene");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// ---------------------------------------------------------------------------
// SCENE
// ---------------------------------------------------------------------------
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x9fd4f0, 55, 110);

// ---- SKY: a big sphere with a vertical gradient, seen from the inside ----
const skyGeo = new THREE.SphereGeometry(100, 32, 16);
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  uniforms: {
    top: { value: new THREE.Color(0x2b7fd4) },
    bottom: { value: new THREE.Color(0xbfe8ff) },
  },
  vertexShader: `
    varying vec3 vPos;
    void main() {
      vPos = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    varying vec3 vPos;
    uniform vec3 top;
    uniform vec3 bottom;
    void main() {
      float h = normalize(vPos).y * 0.5 + 0.5;
      gl_FragColor = vec4(mix(bottom, top, h), 1.0);
    }
  `,
});
scene.add(new THREE.Mesh(skyGeo, skyMat));

// ---------------------------------------------------------------------------
// CAMERA — placed BEHIND the penalty spot, looking toward the goal (FIFA-like)
// ---------------------------------------------------------------------------
const camera = new THREE.PerspectiveCamera(
  55,
  window.innerWidth / window.innerHeight,
  0.1,
  200
);
camera.position.set(0, 3, 2);   // behind and above the shooting spot
camera.lookAt(0, 1.5, -11);       // look at the goal

// OrbitControls just for development / inspection (we can disable later)
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1.2, -8);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI / 2 - 0.03;

// ---------------------------------------------------------------------------
// BUILD THE WORLD
// ---------------------------------------------------------------------------
const goal = buildStadium(scene);  // returns goal dimensions for later use
buildLights(scene);

// ---------------------------------------------------------------------------
// BALL
// ---------------------------------------------------------------------------
const ball = new Ball(scene);
const input = new ShooterInput();

// ---------------------------------------------------------------------------
// PLAYER (the shooter) — Lazio kit, standing just behind the ball
// ---------------------------------------------------------------------------
const player = new Player(scene, { shirt: 0x87cefa });
player.setPosition(0.5, 0, -3.8);  // just behind the ball, near the box
player.faceGoal();

// ---------------------------------------------------------------------------
// GOALKEEPER (Roma kit) — stands on the goal line, dives to save
// ---------------------------------------------------------------------------
const keeper = new Goalkeeper(scene, goal);
const game = new Game();

// ---------------------------------------------------------------------------
// MATCH (Lazio vs Roma shootout) — state machine + its UI hooks
// ---------------------------------------------------------------------------
const matchUI = {
  setScore: (lz, rm) => {
    document.getElementById("mp-lazio").textContent = lz;
    document.getElementById("mp-roma").textContent = rm;
  },
  setBanner: (text) => { document.getElementById("mp-banner").textContent = text; },
  setRound: (text) => { document.getElementById("mp-round").textContent = text; },
  showResult: (win, lz, rm) => {
    document.getElementById("result-title").textContent = win ? "YOU WIN!" : "YOU LOSE";
    document.getElementById("result-score").textContent = `LAZIO ${lz} - ${rm} ROMA`;
    document.getElementById("result").style.display = "flex";
  },
};
const match = new Match(matchUI);
const sound = new Sound();
document.getElementById("result-again").addEventListener("click", () => {
  location.reload(); // simplest clean restart back to the menu
});

// ---------------------------------------------------------------------------
// START MENU — the game waits on the menu until the player picks a role
// ---------------------------------------------------------------------------
let started = false;        // becomes true once a game starts
let role = "player";        // 'player' or 'keeper' (current role)
let mode = "training";      // 'training' or 'match'

const elMenu = document.getElementById("menu");
const elScreenMode = document.getElementById("screen-mode");
const elScreenRole = document.getElementById("screen-role");

// Screen A -> B: training opens the role picker
document.getElementById("pickTraining").addEventListener("click", () => {
  elScreenMode.style.display = "none";
  elScreenRole.style.display = "block";
});
document.getElementById("backToMode").addEventListener("click", () => {
  elScreenRole.style.display = "none";
  elScreenMode.style.display = "block";
});
// Match mode (wired fully in the next step)
document.getElementById("pickMatch").addEventListener("click", () => {
  mode = "match";
  startMatch();
});
// Training role choices
document.getElementById("pickPlayer").addEventListener("click", () => {
  mode = "training"; startGame("player");
});
document.getElementById("pickKeeper").addEventListener("click", () => {
  mode = "training"; startGame("keeper");
});

function startGame(chosenRole) {
  role = chosenRole;
  started = true;
  elMenu.classList.add("hidden");
  applyCameraForRole();
  document.getElementById("back-menu").style.display = "block";
}

// return to the main menu from training without reloading the page
function backToMenu() {
  started = false;
  mode = "training";
  sound.stop();
  document.getElementById("back-menu").style.display = "none";
  document.getElementById("match-panel").style.display = "none";
  // reset the menu screens to the first one
  elScreenRole.style.display = "none";
  elScreenMode.style.display = "block";
  elMenu.classList.remove("hidden");
  // reset the playfield
  ball.reset();
  keeper.setReady();
  playerDive = null;
  shotResolved = true;
  cpuShotPending = false;
  matchAwaitingNext = false;
}
document.getElementById("back-menu").addEventListener("click", backToMenu);

// start the Lazio vs Roma shootout
function startMatch() {
  mode = "match";
  started = true;
  elMenu.classList.add("hidden");
  document.getElementById("match-panel").style.display = "flex";
  document.getElementById("back-menu").style.display = "block";
  match.reset();
  sound.start();
  beginNextKick();
}

// set up the next penalty: pick the role for this kick and refresh the panel
function beginNextKick() {
  if (match.over) return;
  role = match.currentRole();   // 'player' on Lazio kicks, 'keeper' on Roma kicks
  match.refreshUI();
  applyCameraForRole();

  // Kits: YOU are always Lazio (sky blue); the CPU is always Roma (red).
  // On Lazio's kick you shoot -> shooter is blue, keeper (CPU) is red.
  // On Roma's kick you keep   -> keeper (you) is blue, shooter (CPU) is red.
  const LAZIO = 0x9fd4ff, ROMA = 0x8e1b1b;
  if (role === "player") {
    player.setKit(LAZIO);   // you shooting
    keeper.setKit(ROMA);    // CPU keeper
  } else {
    keeper.setKit(LAZIO);   // you keeping
    player.setKit(ROMA);    // CPU shooting
  }

  // reset per-kick state
  ball.reset();
  keeper.setReady();
  playerDive = null;
  shotResolved = true;
  cpuShotPending = false;
  matchAwaitingNext = false;
}

function applyCameraForRole() {
  if (role === "keeper") {
    camera.position.set(0, 3.2, goal.GOAL_Z - 4);
    controls.target.set(0, 1.2, 3);
    setHint("Choose where to dive: ← left · → right · ↑/Space center");
  } else {
    camera.position.set(0, 3, 2);
    controls.target.set(0, 1.2, -8);
    setHint("← left · → right · ↑ lob · Space center");
  }
}
function setHint(text) {
  const h = document.getElementById("controls-hint");
  if (h) h.textContent = text;
}

// Reads keyboard, shoots when the player presses a key (only if the ball is
// resting on the spot). After the ball comes to rest, send it back to the
// spot so the player can shoot again.
let resetTimer = 0;
let kicking = false;       // true while the kick animation plays
let shotResolved = true;   // has the in-flight shot been judged yet?
let cpuShotPending = false; // (keeper mode) is the CPU about to shoot?
let cpuTimer = 0;          // (keeper mode) delay before the CPU shoots
let playerDive = null;     // (keeper mode) the side YOU chose to dive
let matchAwaitingNext = false; // (match) waiting to advance to the next kick
let matchNextTimer = 0;        // (match) delay before the next kick

function handleShooting(dt) {
  if (!started || match.over) return;
  if (role === "player") updatePlayerMode(dt);
  else updateKeeperMode(dt);

  if (mode === "training") {
    // training: when the ball stops, just reset and keep playing
    if (!ball.moving && ball.mesh.position.distanceTo(ball.startPos) > 0.5) {
      resetTimer += dt;
      if (resetTimer > 1.0) {
        resetTimer = 0;
        ball.reset();
        keeper.setReady();
        if (role === "keeper") {
          playerDive = null;
          setHint("Choose where to dive: ← left · → right · ↑/Space center");
        }
      }
    }
  } else {
    // match: after a kick resolves, wait a moment then advance to next kick
    if (matchAwaitingNext) {
      matchNextTimer -= dt;
      if (matchNextTimer <= 0) {
        matchAwaitingNext = false;
        const finished = match.over;
        if (!finished) beginNextKick();
      }
    }
  }
}

// ---- MODE 1: you are the SHOOTER ----
function updatePlayerMode(dt) {
  const shot = input.consumeShot();
  if (shot && !ball.moving && !kicking) {
    const aim = shotTarget(shot, goal);
    if (aim) {
      kicking = true;
      const keeperReach = goal.GOAL_W * 0.27;
      const keeperPick = game.startShot(shot, aim.point.x, keeperReach);
      shotResolved = false;
      kickAnimation(player, () => {
        const target = new THREE.Vector3(aim.point.x, aim.point.y, aim.point.z);
        ball.kickToTarget(target, aim.time);
        kicking = false;
        keeper.dive(keeperPick);
      });
    }
  }
  judgeWhenBallArrives();
}

// ---- MODE 2: you are the GOALKEEPER ----
// Order: YOU choose your dive FIRST (we just REMEMBER it). Then the CPU runs
// up and shoots, and the keeper dives AT THE MOMENT OF IMPACT, in sync with
// the ball — so the save and the kick happen together.
function updateKeeperMode(dt) {
  // Step 1: wait for YOUR dive choice (remember it, don't dive yet)
  if (playerDive === null && !ball.moving && shotResolved && !cpuShotPending) {
    const dir = input.consumeShot();
    if (dir) {
      const valid = dir === "left" || dir === "right" || dir === "center" || dir === "lob";
      if (valid) {
        playerDive = dir === "lob" ? "center" : dir;
        setHint("You chose: " + playerDive.toUpperCase() + " — CPU is shooting…");
        cpuShotPending = true;
        cpuTimer = 0.5;
      }
    } else {
      setHint("Choose where to dive: ← left · → right · ↑/Space center");
    }
  }

  // Step 2: CPU runs up and shoots; keeper dives AT IMPACT (in fireCpuShot)
  if (cpuShotPending) {
    cpuTimer -= dt;
    if (cpuTimer <= 0) {
      cpuShotPending = false;
      fireCpuShot();
    }
  }

  judgeWhenBallArrives();
}

function scheduleCpuShot() {
  cpuShotPending = true;
  cpuTimer = 0.9 + Math.random() * 0.8; // suspense before the kick
}

function fireCpuShot() {
  // CPU picks a random target side
  const sides = ["left", "right", "center"];
  const cpuPick = sides[(Math.random() * sides.length) | 0];
  const aim = shotTarget(cpuPick, goal);
  // record the shot; in keeper mode the "keeper pick" is YOUR dive, decided later
  game.startShotKeeperMode(aim.point.x);
  shotResolved = false;
  // animate the shooter (CPU) then, AT IMPACT, launch the ball AND dive together
  kicking = true;
  kickAnimation(player, () => {
    const target = new THREE.Vector3(aim.point.x, aim.point.y, aim.point.z);
    ball.kickToTarget(target, aim.time);
    kicking = false;
    // keeper dives now, in sync with the ball leaving the foot
    if (playerDive) keeper.dive(playerDive);
  });
}

// shared judgement when the ball reaches the goal line
function judgeWhenBallArrives() {
  if (!shotResolved && ball.moving && ball.mesh.position.z <= goal.GOAL_Z + 0.5) {
    let outcome;
    if (role === "keeper") {
      // your dive position vs the ball position
      const reach = goal.GOAL_W * 0.27;
      const keeperX = playerDive === "left" ? reach : playerDive === "right" ? -reach : playerDive === "center" ? 0 : 999;
      outcome = game.resolveKeeperMode(keeperX, ball.mesh.position.x);
    } else {
      outcome = game.resolve();
    }
    shotResolved = true;
    if (outcome === "save") {
      ball.vel.z = Math.abs(ball.vel.z) * 0.5;
      ball.vel.x *= -0.3;
      ball.vel.y = Math.max(ball.vel.y, 2);
    }

    // MATCH: record whether the KICKING team scored, then queue the next kick
    if (mode === "match") {
      // 'goal' outcome means the ball went in => the kicking team scored.
      const scored = outcome === "goal";
      match.recordOutcome(scored);
      matchAwaitingNext = true;
      matchNextTimer = 1.8; // let the GOAL/PARATA flash play before advancing
    }
  }
}

// ---------------------------------------------------------------------------
// RESIZE + RENDER LOOP
// ---------------------------------------------------------------------------
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
renderer.setSize(window.innerWidth, window.innerHeight);

const clock = new THREE.Clock();
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05); // seconds since last frame (capped)

  TWEEN.update();        // advance the kick animation tweens
  handleShooting(dt);
  ball.update(dt);

  controls.update();
  renderer.render(scene, camera);
}
requestAnimationFrame(loop);