// Screen and world geometry, modelled on the 1989 DOS original:
// a 320x200 screen, rooms of 10x3 tiles, and a thin status bar at the bottom.
export const SCREEN_W = 320;
export const SCREEN_H = 200;

export const TILE_W = 32;
export const TILE_H = 63;
export const ROOM_COLS = 10;
export const ROOM_ROWS = 3;
export const ROOM_W = TILE_W * ROOM_COLS; // 320
export const ROOM_H = TILE_H * ROOM_ROWS; // 189

// Feet rest this far below the top of their tile row.
export const FLOOR_OFF = 55;

// The original animated at about 12 frames per second, one pose per frame,
// which gives its deliberate rhythm. Logic is fixed-step, so a 120Hz phone
// plays at the same speed as a 60Hz monitor.
export const TICK_HZ = 12;
export const TICK_MS = 1000 / TICK_HZ;

export const GAME_MINUTES = 60;
export const START_HP = 3;

export const floorY = (row) => row * TILE_H + FLOOR_OFF;
export const colOf = (x) => Math.floor(x / TILE_W);
export const rowOf = (y) => Math.floor(y / TILE_H);
