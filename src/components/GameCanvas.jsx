import { useEffect, useRef } from 'react';

// Logical field size (portrait). The canvas scales to fit its container.
export const FIELD_W = 400;
export const FIELD_H = 640;

const CREASE_Y = 520; // where the ball must be met
const BOWLER_Y = 96;
const CENTRE_X = FIELD_W / 2;
const NO_SWING_GRACE_MS = 200; // after passing the crease, an unplayed ball is resolved

/**
 * Draws the whole game and owns the animation loop.
 * Props:
 *  - phase: 'ready' | 'flight' | 'shot' | 'idle'
 *  - delivery: {durationMs, swing, kind} for the live ball
 *  - flightStart: timestamp (performance.now) when the ball was released
 *  - shot: {outcome, dtMs, delivery, startedAt} while the shot animation plays
 *  - onNoSwing: called once if the player never swings at the live ball
 */
export default function GameCanvas({ phase, delivery, flightStart, shot, onNoSwing }) {
  const canvasRef = useRef(null);
  const stateRef = useRef({});
  stateRef.current = { phase, delivery, flightStart, shot };
  const noSwingFiredRef = useRef(false);
  const onNoSwingRef = useRef(onNoSwing);
  onNoSwingRef.current = onNoSwing;

  useEffect(() => {
    if (phase === 'flight') noSwingFiredRef.current = false;
  }, [phase, flightStart]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = FIELD_W * dpr;
    canvas.height = FIELD_H * dpr;
    ctx.scale(dpr, dpr);

    let raf;
    const loop = (now) => {
      draw(ctx, now, stateRef.current, () => {
        if (!noSwingFiredRef.current) {
          noSwingFiredRef.current = true;
          onNoSwingRef.current?.();
        }
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="game-canvas block h-auto w-full"
      style={{ aspectRatio: `${FIELD_W} / ${FIELD_H}` }}
      width={FIELD_W}
      height={FIELD_H}
    />
  );
}

function ballPos(delivery, elapsed) {
  const p = Math.min(elapsed / delivery.durationMs, 1.18);
  const y = BOWLER_Y + (CREASE_Y - BOWLER_Y) * Math.pow(Math.min(p, 1), 1.12);
  const x = CENTRE_X + delivery.swing * Math.pow(Math.min(p, 1), 1.6);
  const r = 4 + 8 * Math.min(p, 1);
  return { x, y, r, p };
}

function draw(ctx, now, s, fireNoSwing) {
  // --- ground: night stadium ---
  const bg = ctx.createLinearGradient(0, 0, 0, FIELD_H);
  bg.addColorStop(0, '#101820');
  bg.addColorStop(0.55, '#14231a');
  bg.addColorStop(1, '#0c0e12');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, FIELD_W, FIELD_H);

  // floodlight glows
  for (const fx of [52, FIELD_W - 52]) {
    const glow = ctx.createRadialGradient(fx, 26, 4, fx, 26, 130);
    glow.addColorStop(0, 'rgba(245,185,33,0.30)');
    glow.addColorStop(1, 'rgba(245,185,33,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, FIELD_W, 190);
    ctx.fillStyle = '#f8d47c';
    ctx.beginPath();
    ctx.arc(fx, 26, 7, 0, Math.PI * 2);
    ctx.fill();
  }

  // outfield mowing stripes
  ctx.save();
  ctx.globalAlpha = 0.05;
  for (let i = 0; i < 6; i++) {
    if (i % 2) continue;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 150 + i * 82, FIELD_W, 82);
  }
  ctx.restore();

  // --- pitch ---
  const pitchGrad = ctx.createLinearGradient(0, 70, 0, 590);
  pitchGrad.addColorStop(0, '#8a6f4d');
  pitchGrad.addColorStop(1, '#a5855c');
  ctx.fillStyle = pitchGrad;
  ctx.fillRect(CENTRE_X - 44, 70, 88, 520);
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(CENTRE_X - 34, CREASE_Y + 26);
  ctx.lineTo(CENTRE_X + 34, CREASE_Y + 26);
  ctx.moveTo(CENTRE_X - 34, BOWLER_Y - 8);
  ctx.lineTo(CENTRE_X + 34, BOWLER_Y - 8);
  ctx.stroke();

  // hitting-zone ring (pulses while the ball is live)
  if (s.phase === 'flight') {
    const pulse = 0.55 + 0.35 * Math.sin(now / 110);
    ctx.strokeStyle = `rgba(245,185,33,${pulse})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(CENTRE_X, CREASE_Y, 27, 0, Math.PI * 2);
    ctx.stroke();
  }

  drawBowler(ctx, s, now);
  drawBatsman(ctx, s, now);

  // --- ball / shot ---
  if (s.phase === 'flight' && s.delivery) {
    const elapsed = now - s.flightStart;
    const { x, y, r } = ballPos(s.delivery, elapsed);
    drawBall(ctx, x, y, r);
    if (elapsed > s.delivery.durationMs + NO_SWING_GRACE_MS) fireNoSwing();
  }

  if (s.phase === 'shot' && s.shot) {
    const t = (now - s.shot.startedAt) / 620; // shot animation length
    if (t < 1) drawShotBall(ctx, s.shot, t);
    if (s.shot.outcome.wicket) drawBrokenStumps(ctx, Math.min(t * 1.6, 1));
  }
}

function drawBall(ctx, x, y, r) {
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(x, y + r + 5, r * 0.9, r * 0.32, 0, 0, Math.PI * 2);
  ctx.fill();
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.2, x, y, r);
  g.addColorStop(0, '#ff8a7a');
  g.addColorStop(1, '#c62f1d');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function drawShotBall(ctx, shot, t) {
  const { outcome, dtMs, delivery } = shot;
  const startX = CENTRE_X + delivery.swing;
  const startY = CREASE_Y;
  if (outcome.runs === 0) {
    // dot / left / bowled: ball dribbles or thuds past
    drawBall(ctx, startX, startY + t * 66, 12);
    return;
  }
  // direction: early swing pulls leg-side (left), late goes off-side (right)
  const side = dtMs <= -30 ? -1 : dtMs >= 30 ? 1 : 0;
  const dist = outcome.runs >= 6 ? 560 : outcome.runs >= 4 ? 470 : 150 + outcome.runs * 55;
  const x = startX + side * dist * 0.62 * t;
  const y = startY - Math.sin(Math.min(t * 1.15, 1) * Math.PI) * (outcome.runs >= 4 ? 190 : 60) - t * dist * 0.34;
  const r = Math.max(12 - t * 7, 3.5);
  // trail
  ctx.strokeStyle = 'rgba(245,185,33,0.5)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(x, y);
  ctx.stroke();
  drawBall(ctx, x, y, r);
}

function drawBowler(ctx, s, now) {
  const x = CENTRE_X;
  const y = BOWLER_Y - 26;
  let arm = -0.5;
  if (s.phase === 'ready') arm = -0.5 + Math.sin(now / 160) * 0.14; // wind-up sway
  if (s.phase === 'flight' && s.delivery) {
    const p = Math.min((now - s.flightStart) / s.delivery.durationMs, 1);
    arm = -0.5 + p * 1.9; // arm whips over
  }
  figure(ctx, x, y, '#3b82f6', arm, 0.8);
}

function drawBatsman(ctx, s, now) {
  const x = CENTRE_X + 6;
  const y = CREASE_Y + 34;
  // stumps behind the batsman
  ctx.fillStyle = '#f5b921';
  for (const dx of [-11, 0, 11]) ctx.fillRect(x - 16 + dx - 2, CREASE_Y + 4, 4, 26);
  ctx.fillRect(x - 29, CREASE_Y + 2, 30, 4);

  let batAngle = 0.5; // resting, bat grounded
  if (s.shot && s.phase === 'shot') {
    const t = Math.min((now - s.shot.startedAt) / 200, 1);
    batAngle = 0.5 - Math.sin(t * Math.PI) * 1.9; // big swing arc
  }
  figure(ctx, x, y, '#f5b921', -0.3, 1.05, batAngle);
}

function drawBrokenStumps(ctx, t) {
  const x = CENTRE_X - 10;
  ctx.save();
  ctx.translate(x, CREASE_Y + 6);
  ctx.rotate(t * 0.9);
  ctx.fillStyle = '#f5b921';
  ctx.fillRect(-2, -24, 4, 26);
  ctx.restore();
}

/** Simple stylised player: head, torso, legs, one arm (+ optional bat). */
function figure(ctx, x, y, kit, armAngle, scale = 1, batAngle = null) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.strokeStyle = kit;
  ctx.fillStyle = kit;
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  // head
  ctx.beginPath();
  ctx.arc(0, -26, 7, 0, Math.PI * 2);
  ctx.fill();
  // torso
  ctx.beginPath();
  ctx.moveTo(0, -19);
  ctx.lineTo(0, 2);
  ctx.stroke();
  // legs
  ctx.beginPath();
  ctx.moveTo(0, 2);
  ctx.lineTo(-8, 18);
  ctx.moveTo(0, 2);
  ctx.lineTo(8, 18);
  ctx.stroke();
  // bowling / back arm
  ctx.beginPath();
  ctx.moveTo(0, -15);
  ctx.lineTo(Math.sin(armAngle) * 15, -15 + Math.cos(armAngle) * 15);
  ctx.stroke();
  // front arm (+ bat for the batsman)
  ctx.beginPath();
  ctx.moveTo(0, -15);
  ctx.lineTo(11, -4);
  ctx.stroke();
  if (batAngle !== null) {
    ctx.save();
    ctx.translate(11, -4);
    ctx.rotate(batAngle);
    ctx.fillStyle = '#d9b380';
    ctx.fillRect(-2.5, 0, 5, 30);
    ctx.restore();
  }
  ctx.restore();
}
