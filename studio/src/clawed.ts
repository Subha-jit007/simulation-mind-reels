// The real Clawed pixel-crab sprite + palette (from E:\Projects\clawed\pet.py),
// so the channel mascot matches the Clawed bot exactly.
export const CLAW = {
  body: "#DA7756", // Claude terracotta
  dark: "#262624", // eyes / outline
  light: "#F0EEE6", // ivory highlight / window bg
  gold: "#F8D24A", // crown
  ivory: "#FAF9F5",
};

export const COLORS: Record<string, string> = {
  o: CLAW.body,
  d: CLAW.dark,
  l: CLAW.light,
  g: CLAW.gold,
};

export const CROWN = [
  "....g..g..g..g....",
  "....gggggggggg....",
];

export const WALK1 = [
  "....o........o....",
  "....o........o....",
  "..oooooooooooooo..",
  "..oloooooooooolo..",
  "..oooddooooddooo..",
  "..oooddooooddooo..",
  "oooooooooooooooooo",
  "..oooooooooooooo..",
  "..oooooooooooooo..",
  "...o...o..o...o...",
  "...o...o..o...o...",
  "..o...o......o...o",
];

export const WALK2 = [
  ...WALK1.slice(0, 9),
  "..o...o....o...o..",
  "..o...o....o...o..",
  "...o...o..o...o...",
];

export const WAVE1 = [
  "....o........o....",
  "o...o........o...o",
  "o.oooooooooooooo.o",
  "o.oloooooooooolo.o",
  "oooooddooooddooooo",
  "..oooddooooddooo..",
  "..oooooooooooooo..",
  "..oooooooooooooo..",
  "..oooooooooooooo..",
  "...o...o..o...o...",
  "...o...o..o...o...",
  "...o...o..o...o...",
];
