/**
 * game.js — the "referee": the game logic that ties shooter, ball and keeper
 * together. It decides GOAL vs SAVE, keeps the score, and triggers the
 * on-screen messages.
 *
 * This is the GAME LOGIC layer (not graphics): it knows the rules, not how
 * things are drawn. Keeping it in its own module is good structure to explain
 * at the exam — rendering, input, physics and rules each live in one place.
 */
export class Game {
  constructor() {
    this.goals = 0;
    this.shots = 0;
    this.pendingShot = null;   // direction the player shot: 'left'|'right'|'center'
    this.keeperPick = null;    // direction the keeper (CPU) dived
    this.resolved = false;     // has the current shot already been judged?

    this.elGoals = document.getElementById("goals");
    this.elShots = document.getElementById("shots");
    this.elFlash = document.getElementById("flash");
  }

  /**
   * startShot(playerDir, ballX) — called when the player kicks.
   * playerDir is 'left'|'right'|'center' (the player's intent);
   * ballX is the actual X coordinate where the ball will arrive in the goal.
   * The CPU keeper picks a dive direction; we store the X it will reach so we
   * can compare POSITIONS (not left/right labels, which are mirrored between
   * the facing player and keeper).
   */
  startShot(playerDir, ballX, keeperReach) {
    this.pendingShot = playerDir;
    this.ballX = ballX;
    this.resolved = false;
    this.shots++;
    this.elShots.textContent = this.shots;

    // CPU picks a side; 45% of the time it goes for the ball's actual side.
    const sides = ["left", "right", "center"];
    let pick;
    if (Math.random() < 0.45) {
      pick = playerDir;
    } else {
      pick = sides[(Math.random() * sides.length) | 0];
    }
    this.keeperPick = pick;

    // where the keeper will physically end up in X (mirrors the player view):
    //   keeper 'left'  -> +reach ; 'right' -> -reach ; 'center' -> 0
    if (pick === "left") this.keeperX = keeperReach;
    else if (pick === "right") this.keeperX = -keeperReach;
    else this.keeperX = 0;

    return pick;
  }

  /**
   * resolve() — called when the ball reaches the goal line. SAVE if the keeper
   * ends up close (in X) to where the ball arrives; otherwise GOAL.
   */
  resolve() {
    if (this.resolved || this.pendingShot === null) return null;
    this.resolved = true;

    // compare real positions, not labels: save if keeper is near the ball
    const saved = Math.abs(this.keeperX - this.ballX) < 1.6;
    if (saved) {
      this.flash("SAVE!", "#ffd23f");
    } else {
      this.goals++;
      this.elGoals.textContent = this.goals;
      this.flash("GOAL!", "#2ecc71");
    }
    const outcome = saved ? "save" : "goal";
    this.pendingShot = null;
    return outcome;
  }

  // show a big message in the center for a moment
  flash(text, color) {
    this.elFlash.textContent = text;
    this.elFlash.style.color = color;
    this.elFlash.classList.add("show");
    clearTimeout(this._flashTimer);
    this._flashTimer = setTimeout(() => {
      this.elFlash.classList.remove("show");
    }, 1200);
  }

  // ---- KEEPER MODE: you are the goalkeeper, the CPU shoots ----

  /**
   * startShotKeeperMode(ballX) — the CPU has shot toward ballX. We just record
   * it; the outcome depends on where YOU choose to dive (decided later).
   */
  startShotKeeperMode(ballX) {
    this.ballX = ballX;
    this.resolved = false;
    this.shots++;
    this.elShots.textContent = this.shots;
  }

  /**
   * resolveKeeperMode(keeperX, ballX) — keeperX is where YOU dived, ballX where
   * the ball arrives. Save if you're close. Here a SAVE is the good outcome for
   * the player, so we count saves in the "GOAL" counter relabelled as saves.
   */
  resolveKeeperMode(keeperX, ballX) {
    if (this.resolved) return null;
    this.resolved = true;
    const saved = Math.abs(keeperX - ballX) < 1.6;
    if (saved) {
      this.goals++;                       // here "goals" = your saves
      this.elGoals.textContent = this.goals;
      this.flash("SAVE!", "#2ecc71");
    } else {
      this.flash("GOAL!", "#e74c3c");     // you conceded
    }
    return saved ? "save" : "goal";
  }
}