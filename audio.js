/**
 * audio.js — background stadium ambience ONLY.
 *
 * A single royalty-free file (crowd.mp3) is looped quietly in the background
 * to give the stadium atmosphere. It is NOT tied to any event: it does not
 * react to goals or saves, so it never interferes with the GOAL/PARATA logic
 * or messages. Pure ambience.
 *
 * Browsers block audio until the user interacts with the page; the first menu
 * click unlocks it, so we start the loop there.
 *
 * The file must sit next to index.html. If it's missing the game keeps working
 * silently (no crash).
 */
export class Sound {
  constructor() {
    this.ambience = new Audio("crowd.mp3");
    this.ambience.loop = true;
    this.ambience.volume = 0.22; // low, just background
    this.started = false;
    this.ambience.addEventListener("error", () => console.warn("crowd.mp3 not found"));
  }

  // start the looping murmur (call after the first user interaction)
  start() {
    if (this.started) return;
    this.started = true;
    this.ambience.play().catch(() => {});
  }

  // stop the murmur and rewind (call when leaving to the menu)
  stop() {
    this.started = false;
    this.ambience.pause();
    this.ambience.currentTime = 0;
  }
}