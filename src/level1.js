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
// Each row is written room by room (5 rooms across, 2 rooms down). The route
// follows the shape of the original's first level:
//   cell  -> step on the plate to open the cell gate
//   hall  -> run over two loose floors, running jump over a two-tile gap
//   climb -> jump up to the ledge: potion, spikes (step carefully), the sword
//   drop  -> down to the guard's corridor and fight
//   exit  -> fall through the hole by the exit door, open the gate and press
//            the exit plate in the passage below, climb back up and leave
// Falling through the loose floors or the gap lands in a lower hall with a
// life potion, and you can climb back out through the holes.
export const LEVEL1 = {
  name: 'LEVEL 1',
  map: [
    '###  #####' + '##########' + '##########' + '##########' + '##########',
    '#     #   ' + '          ' + '  _h_^__/ ' + '          ' + '    ######',
    '#_t_a_A___' + '_t~~__  __' + '__####_t__' + '__t___t___' + '_ _t_[]__#',
    '##########' + '#___H__t_#' + '##########' + '######*bBt' + 'b_########',
    '##########' + '###   ####' + '####  ####' + '##########' + '##########',
    '##########' + '###_|_####' + '####_|####' + '##########' + '##########',
  ],
  start: { col: 3, row: 2, dir: 1 },
  guards: [{ col: 35, row: 2, dir: -1, hp: 3, skill: 0.35 }],
};
