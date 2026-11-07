import { useCallback, useEffect, useRef, useState } from 'react';
import GameCanvas from './components/GameCanvas.jsx';
import {
  TOTAL_BALLS,
  TOTAL_WICKETS,
  rollTarget,
  makeDelivery,
  judgeSwing,
  createChase,
  applyOutcome,
  chaseMath,
} from './game/engine.js';

const READY_MS = 620; // bowler wind-up before release
const SHOT_MS = 820; // time the shot result stays on screen

export default function App() {
  const [screen, setScreen] = useState('home'); // home | play | result
  const [target, setTarget] = useState(() => rollTarget());
  const [chase, setChase] = useState(null);
  const [phase, setPhase] = useState('idle'); // ready | flight | shot
  const [delivery, setDelivery] = useState(null);
  const [flightStart, setFlightStart] = useState(0);
  const [shot, setShot] = useState(null);
  const [best, setBest] = useState(() => Number(localStorage.getItem('gullysmash-best') || 0));

  const timersRef = useRef([]);
  const chaseRef = useRef(null);
  const deliveryRef = useRef(null);
  const flightStartRef = useRef(0);
  const phaseRef = useRef('idle');

  const setPhaseBoth = (p) => {
    phaseRef.current = p;
    setPhase(p);
  };

  const later = (fn, ms) => {
    const id = setTimeout(fn, ms);
    timersRef.current.push(id);
  };

  useEffect(() => () => timersRef.current.forEach(clearTimeout), []);

  const beginBall = useCallback((state) => {
    const d = makeDelivery(state.ballsBowled);
    deliveryRef.current = d;
    setDelivery(d);
    setShot(null);
    setPhaseBoth('ready');
    later(() => {
      const start = performance.now();
      flightStartRef.current = start;
      setFlightStart(start);
      setPhaseBoth('flight');
    }, READY_MS);
  }, []);

  const finishBall = useCallback(
    (outcome, dtMs) => {
      const d = deliveryRef.current;
      setShot({ outcome, dtMs, delivery: d, startedAt: performance.now() });
      setPhaseBoth('shot');
      later(() => {
        const next = applyOutcome(chaseRef.current, outcome);
        chaseRef.current = next;
        setChase(next);
        if (next.over) {
          setBest((b) => {
            const nb = Math.max(b, next.runs);
            localStorage.setItem('gullysmash-best', String(nb));
            return nb;
          });
          setScreen('result');
        } else {
          beginBall(next);
        }
      }, SHOT_MS);
    },
    [beginBall]
  );

  const swing = useCallback(() => {
    if (screen !== 'play' || phaseRef.current !== 'flight') return;
    const dt = performance.now() - flightStartRef.current - deliveryRef.current.durationMs;
    finishBall(judgeSwing(deliveryRef.current, dt), dt);
  }, [screen, finishBall]);

  const handleNoSwing = useCallback(() => {
    if (phaseRef.current !== 'flight') return;
    finishBall(judgeSwing(deliveryRef.current, null), null);
  }, [finishBall]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        swing();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [swing]);

  const startGame = (t = target) => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    const s = createChase(t);
    chaseRef.current = s;
    setChase(s);
    setScreen('play');
    beginBall(s);
  };

  const newTargetAndHome = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    setTarget(rollTarget());
    setScreen('home');
  };

  // ---------------- HOME ----------------
  if (screen === 'home') {
    return (
      <Shell>
        <div className="px-2 pt-10 text-center">
          <div className="font-display text-[13px] font-600 tracking-[0.3em] text-[#f5b921]">
            THE GAME BEGINS WHEN THE LIGHTS COME ON
          </div>
          <h1 className="font-display mt-3 text-5xl font-black leading-[0.95]">
            GULLY CRICKET
            <br />
            <span className="text-[#f5b921]">SMASH</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xs text-sm text-gray-400">
            One button. Twelve balls. Pure timing. Tap the moment the ball reaches the ring —
            perfect timing flies for six, a wild swing can bowl you.
          </p>
        </div>

        <div className="mx-2 mt-8 rounded-2xl border border-white/10 bg-[#14171f] p-5 text-center">
          <div className="text-xs tracking-widest text-gray-400">
            YOUR CHASE — {TOTAL_BALLS} BALLS · {TOTAL_WICKETS} WICKETS
          </div>
          <div className="font-display mt-1 text-6xl font-black text-[#f5b921]">{target}</div>
          <button
            onClick={() => setTarget(rollTarget())}
            className="mt-2 text-xs font-semibold text-gray-400 underline underline-offset-4"
          >
            Re-roll target
          </button>
        </div>

        <button
          onClick={startGame}
          className="font-display mx-2 mt-6 w-[calc(100%-1rem)] rounded-2xl bg-[#f5b921] py-4 text-xl font-black text-black shadow-[0_10px_30px_rgba(245,185,33,0.35)] active:scale-[0.98]"
        >
          START CHASE 🏏
        </button>

        <div className="mx-2 mt-6 space-y-1.5 text-[13px] text-gray-400">
          <p>⏱️ <b className="text-gray-200">Perfect</b> timing = 6 · good = 4 · late/early = scraps</p>
          <p>🎯 Balls get quicker. Watch for the slow one — it is a trap.</p>
          <p>🖱️ Tap anywhere, or press <b className="text-gray-200">SPACE</b> on a laptop.</p>
        </div>

        {best > 0 && (
          <div className="mt-6 text-center text-sm text-gray-400">
            Your best chase score: <span className="font-bold text-[#f5b921]">{best}</span>
          </div>
        )}
      </Shell>
    );
  }

  // ---------------- RESULT ----------------
  if (screen === 'result' && chase) {
    return (
      <Shell>
        <div className="px-2 pt-10 text-center">
          <div className="text-5xl">{chase.won ? '🏆' : '💔'}</div>
          <h2 className="font-display mt-3 text-3xl font-black leading-tight">
            {chase.won ? 'CHASE COMPLETE!' : 'SO CLOSE!'}
          </h2>
          <p className="mt-2 text-sm text-gray-300">{chase.resultText}</p>
        </div>

        <div className="mx-2 mt-6 grid grid-cols-3 gap-2 text-center">
          <Stat label="You scored" value={chase.runs} />
          <Stat label="Target" value={chase.target} />
          <Stat label="Best ever" value={best} />
        </div>

        <div className="mx-2 mt-6 rounded-2xl border border-white/10 bg-[#14171f] p-4">
          <div className="mb-2 text-xs tracking-widest text-gray-400">BALL BY BALL</div>
          <div className="flex flex-wrap gap-1.5">
            {chase.log.map((o, i) => (
              <BallChip key={i} outcome={o} />
            ))}
          </div>
          <div className="mt-3 space-y-1 text-[13px] text-gray-400">
            {chase.log.map((o, i) => (
              <div key={i}>
                <span className="text-gray-500">Ball {i + 1}:</span> {o.label}
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={() => {
            const t = rollTarget();
            setTarget(t);
            startGame(t);
          }}
          className="font-display mx-2 mt-6 w-[calc(100%-1rem)] rounded-2xl bg-[#f5b921] py-4 text-xl font-black text-black active:scale-[0.98]"
        >
          PLAY AGAIN
        </button>
        <button
          onClick={newTargetAndHome}
          className="mx-2 mt-3 w-[calc(100%-1rem)] rounded-2xl border border-white/15 py-3 text-sm font-semibold text-gray-300"
        >
          Back to home
        </button>
      </Shell>
    );
  }

  // ---------------- PLAY ----------------
  const m = chase ? chaseMath(chase) : { need: target, ballsLeft: TOTAL_BALLS, wicketsLeft: TOTAL_WICKETS };
  return (
    <Shell>
      <div className="px-2 pt-4">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-[11px] tracking-widest text-gray-400">CHASING {chase?.target}</div>
            <div className="font-display text-4xl font-black leading-none">
              {chase?.runs}
              <span className="text-xl text-gray-400">/{chase?.wickets}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[11px] tracking-widest text-gray-400">NEED</div>
            <div className="font-display text-2xl font-800 leading-none text-[#f5b921]">
              {m.need} <span className="text-sm text-gray-400">off {m.ballsLeft}</span>
            </div>
            <div className="mt-1 text-[11px] text-gray-500">
              {'❤️'.repeat(m.wicketsLeft)}
              {'🖤'.repeat(TOTAL_WICKETS - m.wicketsLeft)} wickets
            </div>
          </div>
        </div>

        <div className="mt-2 flex gap-1">
          {Array.from({ length: TOTAL_BALLS }).map((_, i) => {
            const o = chase?.log[i];
            return (
              <div
                key={i}
                className={`flex h-6 flex-1 items-center justify-center rounded text-[11px] font-bold ${
                  o
                    ? o.wicket
                      ? 'bg-red-500/80 text-white'
                      : o.runs >= 4
                        ? 'bg-[#f5b921] text-black'
                        : 'bg-white/15 text-gray-200'
                    : 'bg-white/5 text-gray-600'
                }`}
              >
                {o ? o.symbol : '·'}
              </div>
            );
          })}
        </div>
      </div>

      <div
        className="relative mx-2 mt-3 cursor-pointer overflow-hidden rounded-2xl border border-white/10"
        onPointerDown={swing}
      >
        <GameCanvas
          phase={phase}
          delivery={delivery}
          flightStart={flightStart}
          shot={shot}
          onNoSwing={handleNoSwing}
        />
        {phase === 'shot' && shot && (
          <div className="pointer-events-none absolute inset-x-0 top-16 text-center">
            <div
              className={`font-display inline-block rounded-xl px-4 py-2 text-2xl font-black ${
                shot.outcome.wicket
                  ? 'bg-red-500/90 text-white'
                  : shot.outcome.runs >= 4
                    ? 'bg-[#f5b921] text-black'
                    : 'bg-black/70 text-white'
              }`}
            >
              {shot.outcome.symbol === 'W' ? 'WICKET!' : shot.outcome.runs > 0 ? `+${shot.outcome.runs}` : 'DOT'}
            </div>
            <div className="mt-2 text-sm font-semibold text-white drop-shadow">{shot.outcome.label}</div>
          </div>
        )}
        {phase === 'ready' && (
          <div className="pointer-events-none absolute inset-x-0 bottom-5 text-center text-xs font-semibold tracking-widest text-white/80">
            BALL {chase.ballsBowled + 1} — GET READY…
          </div>
        )}
      </div>

      <button
        onPointerDown={swing}
        className="font-display mx-2 mt-3 w-[calc(100%-1rem)] rounded-2xl bg-[#f5b921] py-5 text-2xl font-black text-black active:scale-[0.98]"
      >
        SWING 🏏
      </button>
      <p className="mt-2 text-center text-[11px] text-gray-500">Tap the pitch, the button, or press SPACE</p>
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div className="mx-auto min-h-dvh w-full max-w-md pb-10" style={{ fontFamily: 'Inter, sans-serif' }}>
      {children}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#14171f] p-3">
      <div className="font-display text-3xl font-black">{value}</div>
      <div className="mt-0.5 text-[11px] tracking-widest text-gray-400">{label.toUpperCase()}</div>
    </div>
  );
}

function BallChip({ outcome }) {
  return (
    <span
      className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
        outcome.wicket
          ? 'bg-red-500 text-white'
          : outcome.runs >= 4
            ? 'bg-[#f5b921] text-black'
            : 'bg-white/10 text-gray-200'
      }`}
    >
      {outcome.symbol}
    </span>
  );
}
