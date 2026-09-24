# Prince of Persia — 1989 tribute

A browser remake of the first level of Jordan Mechner's 1989 *Prince of Persia*.
It aims for the look and feel of the DOS original and plays on phones as well as
desktops.

## Look and feel

- **Smooth graphics at full resolution.** The game keeps the original's 320×200
  layout, 10×3-tile rooms and 4:3 screen shape, but draws everything with
  smooth shapes at your screen's real resolution rather than chunky pixels.
- **Depth like the original.** Open space is black with only faint outlines of
  masonry; platforms and walls are slate-blue dressed stone. Floors have a thick
  top surface whose left end slants back, and blocks, slabs and pillars show a
  dark, checkered side face on the right, as in the 1989 game.
- **Layers.** The Prince passes behind pillars, and when he hangs from a ledge,
  its front edge covers his hands. The front row of spikes is in front of him.
- **One room per screen.** The camera cuts from room to room, as in the original.
- **Frame-by-frame animation at 12 frames a second**, like the original: a
  run cycle, a split-leg running leap, skids and turns, careful steps, a staged
  climb (pull up, chin over the edge, knee up), flailing falls and a collapse
  when killed. Movement comes from the animation, not free physics.
- **Weight and precision.** A running jump needs a run-up and a take-off near
  the edge. Ledges are only caught if you hold UP (JUMP) or ACTION, whether
  you come up short on a jump or fall past one.
- **Falls hurt:** one floor is safe, two floors cost a life point, three kill.
- **Traps and objects:** spikes, loose floors, gates opened by pressure plates,
  healing and life potions, the sword, and an exit door.
- **Sword fighting:** advance, retreat, strike and parry against a palace guard.
- **Status bar** with health flasks, the guard's health, and a 60-minute timer.
- **PC-speaker style sound effects.**
- **All art is drawn in code.** No original art or sprites are used.

## Controls

| Action | Keyboard | Phone |
| --- | --- | --- |
| Run / turn | ← → | Pad left / right |
| Jump up (grab a ledge) | ↑ | **JUMP** or pad up |
| Jump ahead (standing or running) | ↑ + → | Slide the pad to up-right, or hold → and press **JUMP** |
| Crouch / lower yourself over an edge | ↓ | Pad down |
| Catch a ledge (short jump or falling) | hold ↑ or Shift | hold **JUMP** or **ACTION** |
| Climb up / let go when hanging | ↑ / ↓ | **JUMP** / pad down |
| Careful step (safe over spikes) | Shift + → | **ACTION** + pad |
| Drink a potion / take the sword | Shift | **ACTION** |
| Sword: strike / parry | Shift / ↑ | **ACTION** / **JUMP** |
| Pause / mute | P / M | ❚❚ / ♪ buttons |

On phones, landscape is best. The page asks for full screen and landscape where
the browser allows it. On iPhone, use *Share → Add to Home Screen* to get a
full-screen app.

## Level 1

The level follows the shape of the original's first level: the Prince drops
into a cell and steps on a plate to open its gate; runs over loose floors and
leaps a gap; climbs to a ledge with a potion, spikes and the sword; fights the
guard; then drops through a hole by the exit to open it from the passage below,
and climbs back up to leave. Falling through the floor lands in a lower hall
with a life potion and a way back up.

## Development

```bash
npm install
npm run dev      # local dev server
npm test         # headless tests, including a scripted run through the whole level
npm run build    # production build in dist/
```

With `npm run dev` running, `/tools/pose-sheet.html` shows every animation
frame of the Prince, one row per move.

### Code layout

| File | Purpose |
| --- | --- |
| `src/level1.js` | The level map as text, with a legend |
| `src/level.js` | Tiles and traps: gates, plates, spikes, loose floors, the exit |
| `src/prince.js` | The Prince's state machine (each move runs frame by frame) |
| `src/guard.js` | Guard behaviour |
| `src/game.js` | Rules, timer and fight resolution; no DOM, so tests can run it |
| `src/figure.js` | Skeleton poses and blending between them |
| `src/character.js` | Draws a posed skeleton as a shaded figure (Prince and guard) |
| `src/render.js` | Draws rooms, depth, lighting and screens at full resolution |
| `src/input.js` | Keyboard and multi-touch controls |
| `src/audio.js` | PC-speaker style sound effects |

The game logic runs at a fixed 12 ticks per second, so it plays at the same
speed on 60Hz and 120Hz screens.

## Deployment

Each push to `main` is built and published to GitHub Pages by
`.github/workflows/deploy.yml`. Asset paths are relative, so the site works at
`https://<user>.github.io/prince-of-persia/`.

## Credits

A fan tribute to *Prince of Persia* (1989) by Jordan Mechner. It is not
affiliated with or endorsed by the rights holders.
