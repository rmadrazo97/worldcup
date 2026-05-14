// Tactical formations — pitch coordinates on a 100x100 grid.
// Client-side constants. The API returns formation NAMES; we look up
// coordinates here. Unknown formations fall back to "4-3-3".
//
// x: 0 = left sideline, 100 = right sideline.
// y: 0 = team's own goal, 100 = opposing goal.

export const FORMATIONS = {
  '4-3-3': [
    { x: 50, y: 6 },
    { x: 82, y: 28 }, { x: 62, y: 30 }, { x: 38, y: 30 }, { x: 18, y: 28 },
    { x: 70, y: 55 }, { x: 50, y: 52 }, { x: 30, y: 55 },
    { x: 80, y: 80 }, { x: 50, y: 85 }, { x: 20, y: 80 },
  ],
  '4-2-3-1': [
    { x: 50, y: 6 },
    { x: 82, y: 28 }, { x: 62, y: 30 }, { x: 38, y: 30 }, { x: 18, y: 28 },
    { x: 62, y: 48 }, { x: 38, y: 48 },
    { x: 78, y: 68 }, { x: 50, y: 65 }, { x: 22, y: 68 },
    { x: 50, y: 86 },
  ],
  '4-4-2': [
    { x: 50, y: 6 },
    { x: 82, y: 28 }, { x: 62, y: 30 }, { x: 38, y: 30 }, { x: 18, y: 28 },
    { x: 82, y: 55 }, { x: 60, y: 56 }, { x: 40, y: 56 }, { x: 18, y: 55 },
    { x: 60, y: 84 }, { x: 40, y: 84 },
  ],
  '3-5-2': [
    { x: 50, y: 6 },
    { x: 75, y: 28 }, { x: 50, y: 28 }, { x: 25, y: 28 },
    { x: 88, y: 55 }, { x: 65, y: 55 }, { x: 50, y: 50 }, { x: 35, y: 55 }, { x: 12, y: 55 },
    { x: 60, y: 84 }, { x: 40, y: 84 },
  ],
  '5-3-2': [
    { x: 50, y: 6 },
    { x: 88, y: 28 }, { x: 68, y: 30 }, { x: 50, y: 30 }, { x: 32, y: 30 }, { x: 12, y: 28 },
    { x: 68, y: 56 }, { x: 50, y: 56 }, { x: 32, y: 56 },
    { x: 60, y: 84 }, { x: 40, y: 84 },
  ],
  '4-3-2-1': [
    { x: 50, y: 6 },
    { x: 82, y: 28 }, { x: 62, y: 30 }, { x: 38, y: 30 }, { x: 18, y: 28 },
    { x: 70, y: 55 }, { x: 50, y: 52 }, { x: 30, y: 55 },
    { x: 62, y: 72 }, { x: 38, y: 72 },
    { x: 50, y: 86 },
  ],
}

export function getFormation(name) {
  return FORMATIONS[name] || FORMATIONS['4-3-3']
}
