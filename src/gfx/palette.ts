/** Global 8-bit style palette (hex). Keep every drawn colour in here so the look stays coherent. */
export const PAL = {
  black: '#06070d',
  night: '#0d1020',
  navy: '#141a33',
  slate: '#232a45',
  steel: '#3a4463',
  grey: '#6b7390',
  silver: '#a9b0c6',
  white: '#eef0f8',
  snow: '#d9dce8',
  ice: '#9fc5e8',
  cyan: '#4fd1ff',
  blue: '#1c3fb8',
  skyblue: '#3b8cff',
  green: '#2fd45a',
  darkgreen: '#126b2e',
  yellow: '#f2d23c',
  orange: '#ff8a1f',
  red: '#e8303a',
  darkred: '#7a1420',
  magenta: '#e24fd1',
  purple: '#6a2fb8',
  brown: '#6b4a2a',
  tan: '#c49a5a',
} as const;

export type PalName = keyof typeof PAL;
