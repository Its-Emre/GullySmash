// Gully Cricket Smash — pure game logic (no DOM, no React).
// One input: WHEN you swing. Everything else is derived from timing.

export const TOTAL_BALLS = 12;
export const TOTAL_WICKETS = 3;
export const STUMPS_HALF_WIDTH = 26; // px of lateral ball offset that still hits the stumps

/** Roll a chase target: 25–45 runs. */
export function rollTarget(rng = Math.random) {
  return 25 + Math.floor(rng() * 21); // 25..45
}

/**
 * Describe the next delivery.
 * ballIndex is 0-based. Pace quickens as the chase goes on;
 * from ball 5 (index 4) a slower-ball deception can appear.
 * swing: lateral offset of the ball when it reaches the crease, in px
 * (negative = leg side, positive = off side).
 */
export function makeDelivery(ballIndex, rng = Math.random) {
  const ramp = Math.min(ballIndex, 10) * 22; // up to 220ms quicker by the end
  let durationMs = 880 - ramp + Math.round(rng() * 70 - 35);
  let kind = 'pace';
  if (ballIndex >= 4 && rng() < 0.22) {
    kind = 'slower';
    durationMs = 1180 + Math.round(rng() * 80 - 40);
  }
  const swing = Math.round((rng() * 2 - 1) * (34 + ballIndex * 2.4));
  return { durationMs, swing, kind };
}

/**
 * Judge a swing.
 * dtMs = swing moment − the moment the ball reaches the crease.
 * Negative = early (pull/leg side), positive = late (off side).
 * Pass dtMs = null when the player never swung.
 */
export function judgeSwing(delivery, dtMs) {
  const hitsStumps = Math.abs(delivery.swing) <= STUMPS_HALF_WIDTH;

  if (dtMs === null) {
    return hitsStumps
      ? { runs: 0, wicket: true, type: 'bowled', label: 'BOWLED! No shot offered', symbol: 'W' }
      : { runs: 0, wicket: false, type: 'left', label: 'Left alone — safe', symbol: '0' };
  }

  const adt = Math.abs(dtMs);
  if (adt <= 45) {
    return { runs: 6, wicket: false, type: 'six', label: 'PERFECT! Launched for SIX', symbol: '6' };
  }
  if (adt <= 100) {
    return { runs: 4, wicket: false, type: 'four', label: 'Cracked away for FOUR', symbol: '4' };
  }
  if (adt <= 170) {
    const runs = Math.abs(delivery.swing) > 35 ? 3 : 2;
    return { runs, wicket: false, type: 'runs', label: `Worked away — ${runs} runs`, symbol: String(runs) };
  }
  if (adt <= 250) {
    return { runs: 1, wicket: false, type: 'runs', label: 'Just a single', symbol: '1' };
  }
  // A wild miss.
  return hitsStumps
    ? { runs: 0, wicket: true, type: 'bowled', label: 'BOWLED! Swing and a miss', symbol: 'W' }
    : { runs: 0, wicket: false, type: 'miss', label: 'Swing and a miss — too wide', symbol: '0' };
}

/** Fresh chase state. */
export function createChase(target) {
  return {
    target,
    runs: 0,
    wickets: 0,
    ballsBowled: 0,
    log: [], // judgeSwing outcomes, in order
    over: false,
    won: false,
    resultText: '',
  };
}

/** Apply one ball's outcome; returns a new state. */
export function applyOutcome(state, outcome) {
  const runs = state.runs + outcome.runs;
  const wickets = state.wickets + (outcome.wicket ? 1 : 0);
  const ballsBowled = state.ballsBowled + 1;
  const log = [...state.log, outcome];

  let over = false;
  let won = false;
  let resultText = '';
  if (runs >= state.target) {
    over = true;
    won = true;
    const wk = TOTAL_WICKETS - wickets;
    const bl = TOTAL_BALLS - ballsBowled;
    resultText = `Chased it down! Won by ${wk} wicket${wk === 1 ? '' : 's'} with ${bl} ball${bl === 1 ? '' : 's'} to spare`;
  } else if (wickets >= TOTAL_WICKETS || ballsBowled >= TOTAL_BALLS) {
    over = true;
    const short = state.target - runs;
    resultText =
      short === 1 && wickets < TOTAL_WICKETS
        ? 'So close — fell short by 1 run'
        : `Fell short by ${short} run${short === 1 ? '' : 's'}`;
  }
  return { ...state, runs, wickets, ballsBowled, log, over, won, resultText };
}

/** Runs still needed / balls left, for the HUD. */
export function chaseMath(state) {
  return {
    need: Math.max(state.target - state.runs, 0),
    ballsLeft: TOTAL_BALLS - state.ballsBowled,
    wicketsLeft: TOTAL_WICKETS - state.wickets,
  };
}
