import * as TWEEN from "@tweenjs/tween.js";

/**
 * kickAnimation(player, onImpact, speed) — a clean, readable kick built by
 * hand with tweens. It exploits the HIERARCHY: rotating the right hip swings
 * the whole right leg (and its foot) as one unit, because the foot is a child
 * of the hip. The body leans to sell the effort.
 *
 * Phases:
 *   1. wind-up   : body leans in, kicking leg pulls back at the hip
 *   2. strike    : hip snaps forward fast -> ball is launched at impact
 *   3. follow    : leg continues through, body straightens
 *   4. settle    : everything eases back to the idle pose
 *
 * Angles are in degrees, converted to radians, so it is fully scripted in JS.
 */
export function kickAnimation(player, onImpact, speed = 1) {
  const J = player.joints;
  const d2r = (d) => (d * Math.PI) / 180;
  const dur = (ms) => ms / speed;

  const a = { bodyX: 0, bodyY: 0, hipR: 2, footR: 0, armL: 0, armR: 0 };

  const apply = () => {
    J.body.rotation.x = d2r(a.bodyX);
    J.body.rotation.y = d2r(a.bodyY);
    J.hipR.rotation.x = d2r(a.hipR);
    J.footR.rotation.x = d2r(a.footR);
    J.shoulderL.rotation.x = d2r(a.armL);
    J.shoulderR.rotation.x = d2r(a.armR);
  };

  const step = (target, ms, easing, onStart, onComplete) => {
    const t = new TWEEN.Tween(a).to(target, dur(ms)).easing(easing).onUpdate(apply);
    if (onStart) t.onStart(onStart);
    if (onComplete) t.onComplete(onComplete);
    return t;
  };

  // 1. wind-up: lean in, swing arms for balance, pull kicking leg back
  const windup = step(
    { bodyX: 14, hipR: -50, footR: 30, armL: -30, armR: 35 },
    340, TWEEN.Easing.Quadratic.Out
  );
  // 2. strike: hip snaps forward; fire the ball right when it reaches vertical
  const strike = step(
    { bodyX: 4, hipR: 48, footR: -10, armL: 25, armR: -15 },
    150, TWEEN.Easing.Quadratic.In,
    () => { setTimeout(() => onImpact && onImpact(), dur(80)); }
  );
  // 3. follow-through
  const follow = step(
    { bodyX: 8, hipR: 28, footR: 0 },
    240, TWEEN.Easing.Quadratic.Out
  );
  // 4. settle back to idle
  const settle = step(
    { bodyX: 0, bodyY: 0, hipR: 2, footR: 0, armL: 0, armR: 0 },
    420, TWEEN.Easing.Quadratic.InOut
  );

  windup.chain(strike);
  strike.chain(follow);
  follow.chain(settle);
  windup.start();
}