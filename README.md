# Penalty Kick — Lazio vs Roma

An interactive 3D penalty shootout game built with **Three.js** and **WebGL**, developed for the *Interactive Graphics* course (Prof. Marco Schaerf, Sapienza University of Rome).

The player always plays as **Lazio** and can either shoot at the opposing goalkeeper or defend the goal against the CPU-controlled opponent.

## 🎮 Live Demo

**Play here:** https://sapienzainteractivegraphicscourse.github.io/final-project-shootoutsquad/

## Team — ShootoutSquad

- *[Nome Cognome — Matricola]*
- *[Nome Cognome — Matricola]*

## Game modes

- **Training** — choose to be the shooter (shoot and try to score against the CPU goalkeeper) or the goalkeeper (save the CPU shooter's kicks), with no limit on attempts.
- **Match** — a full Lazio vs Roma penalty shootout: five alternating kicks per team, score tracking and sudden death in case of a tie, following the real rules of football.

## Controls

| Key | As shooter | As goalkeeper |
|-----|-----------|---------------|
| ← Left arrow | Shoot left | Dive left |
| → Right arrow | Shoot right | Dive right |
| ↑ Up arrow | Lob | Central save |
| Space bar | Central shot | Central save |

The mouse can rotate and zoom the camera (OrbitControls).

## Technical highlights

- **Two hierarchical models** (shooter and goalkeeper) built from Three.js primitives, animated by hand exploiting the joint hierarchy.
- **Lighting**: ambient + directional (with shadow mapping) + hemisphere light.
- **Three texture types**: color, normal (grass relief) and specular (ball glossiness via roughness map).
- **Hand-written ball physics**: parabolic projectile motion solved analytically, no external physics engine.
- **Finite state machine** for the match mode (alternating kicks, early-stop rule, sudden death).
- **Instanced crowd** (`InstancedMesh`) to render hundreds of spectators efficiently.

## Libraries used (not developed by the team)

- [Three.js](https://threejs.org/) v0.160 — 3D graphics engine (included in `libs/`)
- [Tween.js](https://github.com/tweenjs/tween.js) v21 — animation interpolation (included in `libs/`)
- `crowd.mp3` — background stadium ambience, royalty-free (Pixabay)

## How to run locally

Because the game uses ES modules, it must be served over HTTP (opening `index.html` directly will not work). The simplest way:

- With **VS Code**: install the *Live Server* extension, right-click `index.html` → *Open with Live Server*.
- Or with **Python**: run `python -m http.server` in the project folder and open `http://localhost:8000`.

## Project structure

```
index.html        Page structure, UI (menu, HUD, panels)
style.css         Interface styling
main.js           Renderer, camera, render loop, mode logic
scene.js          Stadium: pitch, goals, stands, lights, textures
ball.js           Ball and hand-written physics
player.js         Shooter hierarchical model
goalkeeper.js     Goalkeeper hierarchical model and dives
animation.js      Hand-written kick animation
input.js          Keyboard handling
game.js           Referee: goal/save logic and score
match.js          Match state machine (penalties, sudden death)
audio.js          Stadium ambience audio
libs/             Bundled libraries (Three.js, Tween.js)
```
