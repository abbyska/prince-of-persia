// Level 1: the dungeon. The world is a grid of tiles; every 10x3 block is one
// screen ("room"), and the camera cuts between rooms like the original.
//
//   ' ' empty (open air)     '_' floor        '#' stone block
//   '|' pillar               't' floor+torch  ',' rubble
//   '^' spikes               '~' loose floor  '/' sword
//   'h' healing potion       'H' life potion (+1 max health)
//   'A'-'D' gate, opened by the matching pressure plate 'a'-'d'
//   '*' plate that opens the exit door     '[' ']' exit door (two tiles)
//
// Each row below is written room by room (4 rooms across, 2 rooms down).
// The hall under the lower corridor is scenery, as in many of the original's rooms.
export const LEVEL1 = {
  name: 'LEVEL 1',
  map: [
    '##########' + '__________' + '__________' + '##########',
    '#         ' + '       _/#' + '          ' + '         #',
    '#__t__~___' + '_t_  __|__' + '__^__t_h__' + '___ _t[]_#',
    '#___t_____' + '_____H_###' + '#a*_t_^_A_' + '_a__######',
    '#         ' + '       ###' + '#         ' + '    ######',
    '#_|__t__|_' + '_t__|__###' + '#__|_t__|_' + '_t__######',
  ],
  start: { col: 2, row: 2, dir: 1 },
  guards: [{ col: 26, row: 2, dir: -1, hp: 3, skill: 0.35 }],
};
