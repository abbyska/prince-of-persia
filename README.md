# Prince of Persia — 1989 tribute

A browser remake of the first level of Jordan Mechner's 1989 *Prince of Persia*.
It aims for the look and feel of the DOS original and plays on phones as well as
desktops.

## What makes it feel like 1989

- **320×200 screen** in a VGA-style blue dungeon palette. It is scaled up with
  sharp pixels and shown at 4:3, the shape of a 1989 monitor.
- **One room per screen.** The camera cuts from room to room instead of
  scrolling. Each room is 10 tiles wide and 3 tall, as in the original.
- **Movement comes from animation, not free physics.** The Prince builds up to
  a run, skids to a stop, skids when he turns around, and can take careful
  steps. He has standing and running jumps, jumps up to grab a ledge, hangs,
  climbs, and lowers himself over edges.
- **Falls hurt:** one floor is safe, two floors cost a life point, three kill.
- **Traps and objects:** spikes, loose floors, gates opened by pressure plates,
  healing and life potions, the sword, and an exit door.
- **Sword fighting:** advance, retreat, strike and parry against a palace guard.
- **Classic status bar:** red health triangles, the guard's blue triangles, and
  a 60-minute time limit.
- **PC-speaker style sound effects.**
- **Movement is drawn from a posed skeleton.** Poses blend smoothly for a
  rotoscope-like look. No original art or sprites are used.

## Controls

| Action | Keyboard | Phone |
| --- | --- | --- |
| Run / turn | ← → | Pad left / right |
| Jump up (grab a ledge) | ↑ | **JUMP** or pad up |
| Jump ahead (standing or running) | ↑ + → | Slide the pad to up-right, or hold → and press **JUMP** |
| Crouch / lower yourself over an edge | ↓ | Pad down |
| Climb up / let go when hanging | ↑ / ↓ | **JUMP** / pad down |
| Careful step (safe over spikes) | Shift + → | **ACTION** + pad |
| Drink a potion / take the sword | Shift | **ACTION** |
| Sword: strike / parry | Shift / ↑ | **ACTION** / **JUMP** |
| Pause / mute | P / M | ❚❚ / ♪ buttons |

On phones, landscape is best. The page asks for full screen and landscape where
the browser allows it. On iPhone, use *Share → Add to Home Screen* to get a
full-screen app.

## Development

```bash
npm install
npm run dev      # local dev server
npm test         # headless tests, including a scripted run through the whole level
npm run build    # production build in dist/
```

### Code layout

| File | Purpose |
| --- | --- |
| `src/level1.js` | The level map as text, with a legend |
| `src/level.js` | Tiles and traps: gates, plates, spikes, loose floors, the exit |
| `src/prince.js` | The Prince's state machine (each move runs frame by frame) |
| `src/guard.js` | Guard behaviour |
| `src/game.js` | Rules, timer and fight resolution; no DOM, so tests can run it |
| `src/figure.js` | Skeleton poses and blending between them |
| `src/render.js` | Pixel renderer for the 320×200 screen |
| `src/input.js` | Keyboard and multi-touch controls |
| `src/audio.js` | PC-speaker style sound effects |

The game logic runs at a fixed 15 ticks per second, so it plays at the same
speed on 60Hz and 120Hz screens.

## Deployment

Each push to `main` is built and published to GitHub Pages by
`.github/workflows/deploy.yml`. Asset paths are relative, so the site works at
`https://<user>.github.io/prince-of-persia/`.

## Credits

A fan tribute to *Prince of Persia* (1989) by Jordan Mechner. It is not
affiliated with or endorsed by the rights holders.
