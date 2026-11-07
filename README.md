# Gully Cricket Smash

A one-button, timing-based gully cricket batting game for the browser.
Twelve balls, three wickets, one target to chase — tap (or press SPACE)
the moment the ball reaches the ring. Perfect timing flies for six;
a wild swing can get you bowled.

## How it plays

- **Perfect** timing = 6 · **good** = 4 · early/late = singles and scraps
- Balls get quicker as the chase goes on, and a slower-ball trap
  appears from the fifth ball
- Swinging deliveries that miss the stumps can be left alone safely —
  but a straight one with no shot offered is bowled
- Ball-by-ball scorecard and your best chase score are kept

## Tech

- React + Vite + Tailwind CSS; the game renders on HTML Canvas with a
  `requestAnimationFrame` loop
- All art is drawn in code and the game logic lives in a pure,
  unit-tested engine (`src/game/engine.js`) — no backend, no assets
- Mobile-first: one thumb, zero typing

## Run it

```bash
npm install
npm run dev     # play locally
npm test        # engine tests
npm run build   # production build
```

## Status

Sprint 1 (core game) complete. Sprint 2 will add difficulty polish,
sound, Hindi-English commentary lines and a share-your-score card.
