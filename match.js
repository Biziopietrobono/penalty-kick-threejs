/**
 * match.js — the MATCH mode: a penalty shootout between Lazio (you) and Roma
 * (CPU), modelled as a FINITE STATE MACHINE.
 *
 * Real shootout rules, reproduced:
 *   - teams alternate one kick each
 *   - 5 kicks per team in regulation
 *   - you are LAZIO; on Lazio kicks YOU shoot, on Roma kicks YOU keep
 *   - after 10 kicks, if level -> SUDDEN DEATH: keep alternating in pairs;
 *     first round where one scores and the other misses decides it
 *   - early stop: if a team can't be caught even using all remaining kicks,
 *     the shootout ends (as in real football)
 *
 * The class only tracks STATE and RULES; the rendering/animation lives in
 * main.js. This separation is the point to highlight at the exam.
 */
export class Match {
  constructor(ui) {
    this.ui = ui;                 // { setBanner, setScore, setRound, showResult }
    this.reset();
  }

  reset() {
    this.lazio = 0;
    this.roma = 0;
    this.kickIndex = 0;           // 0-based count of kicks taken so far
    this.regulation = 5;          // kicks per team in regulation
    this.suddenDeath = false;
    this.over = false;
    this.lazioKicksTaken = 0;
    this.romaKicksTaken = 0;
  }

  // Whose kick is it now? Lazio takes even kicks (0,2,4..), Roma odd (1,3,5..).
  currentTeam() {
    return this.kickIndex % 2 === 0 ? "lazio" : "roma";
  }

  // In which role does that put YOU? Lazio kick -> you shoot; Roma kick -> you keep.
  currentRole() {
    return this.currentTeam() === "lazio" ? "player" : "keeper";
  }

  // round number shown to the user (1..5, then "SD")
  roundLabel() {
    const team = this.currentTeam();
    const n = team === "lazio" ? this.lazioKicksTaken + 1 : this.romaKicksTaken + 1;
    if (this.suddenDeath) return "SUDDEN DEATH";
    return `Penalty ${n}/5`;
  }

  // called by main.js right before a kick, to refresh the on-screen panel
  refreshUI() {
    this.ui.setScore(this.lazio, this.roma);
    const team = this.currentTeam();
    this.ui.setBanner(team === "lazio" ? "YOU SHOOT (LAZIO)" : "YOU SAVE (ROMA SHOOTS)");
    this.ui.setRound(this.roundLabel());
  }

  /**
   * recordOutcome(scored) — call after each kick resolves.
   * scored = did the kicking team score? Updates the tally, advances the
   * state machine, and checks whether the shootout is decided.
   */
  recordOutcome(scored) {
    const team = this.currentTeam();
    if (team === "lazio") {
      this.lazioKicksTaken++;
      if (scored) this.lazio++;
    } else {
      this.romaKicksTaken++;
      if (scored) this.roma++;
    }
    this.kickIndex++;

    this._checkDecided();
    this.ui.setScore(this.lazio, this.roma);
    return this.over;
  }

  _checkDecided() {
    const lz = this.lazioKicksTaken;
    const rm = this.romaKicksTaken;

    if (!this.suddenDeath) {
      // regulation: can the result still change? (early-stop rule)
      const lazioLeft = this.regulation - lz;
      const romaLeft = this.regulation - rm;
      if (this.lazio > this.roma + romaLeft) return this._finish();
      if (this.roma > this.lazio + lazioLeft) return this._finish();
      // both teams done with 5 kicks?
      if (lz >= this.regulation && rm >= this.regulation) {
        if (this.lazio !== this.roma) return this._finish();
        this.suddenDeath = true;   // tie -> sudden death
      }
    } else {
      // sudden death: decide at the end of each completed pair
      if (lz === rm && lz > this.regulation && this.lazio !== this.roma) {
        return this._finish();
      }
    }
  }

  _finish() {
    this.over = true;
    const win = this.lazio > this.roma;
    this.ui.showResult(win, this.lazio, this.roma);
  }
}