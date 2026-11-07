// Engine tests — run with `npm test` (plain node, no framework).
import assert from 'node:assert';
import {
  TOTAL_BALLS,
  TOTAL_WICKETS,
  rollTarget,
  makeDelivery,
  judgeSwing,
  createChase,
  applyOutcome,
  chaseMath,
} from './engine.js';

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
}

// Deterministic rng helpers
const rngMid = () => 0.5;
const seq = (vals) => {
  let i = 0;
  return () => vals[i++ % vals.length];
};

check('target always within 25..45', () => {
  for (let i = 0; i < 500; i++) {
    const t = rollTarget(Math.random);
    assert.ok(t >= 25 && t <= 45, `target ${t}`);
  }
  assert.equal(rollTarget(() => 0), 25);
  assert.equal(rollTarget(() => 0.999), 45);
});

check('deliveries get quicker as the chase goes on', () => {
  const early = makeDelivery(0, rngMid);
  const late = makeDelivery(10, rngMid);
  assert.ok(late.durationMs < early.durationMs, `${late.durationMs} !< ${early.durationMs}`);
});

check('slower ball only from ball 5, and it is slower', () => {
  const noSlow = makeDelivery(2, seq([0.5, 0.0, 0.5])); // would trigger if allowed
  assert.equal(noSlow.kind, 'pace');
  const slow = makeDelivery(6, seq([0.5, 0.1, 0.5])); // rng 0.1 < 0.22 triggers
  assert.equal(slow.kind, 'slower');
  assert.ok(slow.durationMs > 1050, `slower ball ${slow.durationMs}ms`);
});

check('perfect timing = six, no wicket', () => {
  const d = { durationMs: 800, swing: 0, kind: 'pace' };
  const o = judgeSwing(d, 0);
  assert.equal(o.runs, 6);
  assert.equal(o.wicket, false);
  assert.equal(judgeSwing(d, -45).runs, 6);
  assert.equal(judgeSwing(d, 46).runs, 4);
});

check('timing bands: four, runs, single', () => {
  const d = { durationMs: 800, swing: 0, kind: 'pace' };
  assert.equal(judgeSwing(d, 100).runs, 4);
  assert.equal(judgeSwing(d, 170).runs, 2);
  assert.equal(judgeSwing(d, 250).runs, 1);
});

check('wild miss on a straight ball = bowled', () => {
  const straight = { durationMs: 800, swing: 5, kind: 'pace' };
  const o = judgeSwing(straight, 400);
  assert.equal(o.wicket, true);
  const wide = { durationMs: 800, swing: 55, kind: 'pace' };
  assert.equal(judgeSwing(wide, 400).wicket, false);
});

check('no swing: bowled if straight, safe leave if wide', () => {
  assert.equal(judgeSwing({ swing: 0 }, null).wicket, true);
  assert.equal(judgeSwing({ swing: 60 }, null).wicket, false);
});

check('chase math and win detection', () => {
  let s = createChase(10);
  s = applyOutcome(s, { runs: 6, wicket: false });
  let m = chaseMath(s);
  assert.equal(m.need, 4);
  assert.equal(m.ballsLeft, TOTAL_BALLS - 1);
  s = applyOutcome(s, { runs: 4, wicket: false });
  assert.equal(s.over, true);
  assert.equal(s.won, true);
  assert.match(s.resultText, /Won by 3 wickets/);
});

check('all out ends the chase as a loss', () => {
  let s = createChase(40);
  for (let i = 0; i < TOTAL_WICKETS; i++) s = applyOutcome(s, { runs: 0, wicket: true });
  assert.equal(s.over, true);
  assert.equal(s.won, false);
  assert.match(s.resultText, /Fell short by 40/);
});

check('balls exhausted ends the chase; 1-run heartbreak text', () => {
  let s = createChase(2);
  s = applyOutcome(s, { runs: 1, wicket: false });
  for (let i = 1; i < TOTAL_BALLS; i++) s = applyOutcome(s, { runs: 0, wicket: false });
  assert.equal(s.over, true);
  assert.match(s.resultText, /fell short by 1 run/);
});

check('a full scripted game: log, totals stay consistent', () => {
  let s = createChase(30);
  const d = { durationMs: 800, swing: 0, kind: 'pace' };
  const dts = [0, 80, null, 150, 30, 400, 60, 200, -20, 120, 90, 10];
  for (const dt of dts) {
    if (s.over) break;
    s = applyOutcome(s, judgeSwing(d, dt));
  }
  const sum = s.log.reduce((a, o) => a + o.runs, 0);
  assert.equal(sum, s.runs);
  assert.equal(s.log.length, s.ballsBowled);
});

console.log(`\n${passed} checks passed`);
