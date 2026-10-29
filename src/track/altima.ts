import type { TrackData } from './track';

/**
 * Altima VII — linea centrale tracciata con tools/trace_track.py da ref/vgcartography/altima.png
 * (86 punti, giro di circa 55748 unita'). Coordinate mondo = pixel immagine x 10
 * (y x 14 per compensare l'inclinazione della vista). Rigenera con:
 *   python3 -I tools/trace_track.py tools/altima.json
 * I tratti in galleria sono invisibili nella mappa e tracciati a mano.
 */
export const ALTIMA_VII: TrackData = {
  id: 'altima',
  name: 'Altima VII',
  theme: { ground: 'ground_altima', ref: { src: 'ref/altima.png', sx: 10, sy: 14 } },
  main: [
  { x: 7920, y: 10740 }, { x: 8650, y: 10930 }, { x: 9530, y: 11130 }, { x: 10480, y: 11020 },
  { x: 11420, y: 10990 }, { x: 12310, y: 10670 }, { x: 12800, y: 10570 }, { x: 13550, y: 10500 },
  { x: 14260, y: 10220 }, { x: 14780, y: 9930 }, { x: 15100, y: 9590 }, { x: 15530, y: 8950 },
  { x: 15740, y: 8400 }, { x: 15840, y: 7980 }, { x: 16010, y: 7270 }, { x: 15950, y: 6620 },
  { x: 15740, y: 6160 }, { x: 15440, y: 5680 }, { x: 15370, y: 5000 }, { x: 15400, y: 4330 },
  { x: 15390, y: 3830 }, { x: 15030, y: 3460 }, { x: 14700, y: 2830 }, { x: 14480, y: 2080 },
  { x: 13980, y: 1640 }, { x: 13270, y: 1540 }, { x: 12350, y: 1370 }, { x: 11950, y: 1500 },
  { x: 11690, y: 1860 }, { x: 11430, y: 2500 }, { x: 11150, y: 3360 }, { x: 10870, y: 4140 },
  { x: 10600, y: 4920 }, { x: 10320, y: 5700 }, { x: 10040, y: 6400 }, { x: 9710, y: 7010 },
  { x: 9410, y: 7790 }, { x: 8920, y: 8280 }, { x: 8400, y: 8650 }, { x: 8030, y: 8980 },
  { x: 7640, y: 9290 }, { x: 7250, y: 9600 }, { x: 6870, y: 10020 }, { x: 6500, y: 10120 },
  { x: 6110, y: 10700 }, { x: 5740, y: 11090 }, { x: 5220, y: 11230 }, { x: 4810, y: 11520 },
  { x: 4010, y: 11440 }, { x: 3170, y: 10990 }, { x: 2080, y: 10780 }, { x: 1010, y: 10320 },
  { x: 400, y: 10060 }, { x: 200, y: 9620 }, { x: 300, y: 9280 }, { x: 760, y: 9130 },
  { x: 1530, y: 8970 }, { x: 1640, y: 8850 }, { x: 1790, y: 8180 }, { x: 1840, y: 7500 },
  { x: 2240, y: 7070 }, { x: 2790, y: 6570 }, { x: 2960, y: 5840 }, { x: 3030, y: 5050 },
  { x: 3300, y: 4270 }, { x: 3570, y: 3840 }, { x: 3830, y: 3530 }, { x: 4470, y: 3320 },
  { x: 4960, y: 3190 }, { x: 5420, y: 3160 }, { x: 6160, y: 3430 }, { x: 6410, y: 3650 },
  { x: 6670, y: 4130 }, { x: 6650, y: 4620 }, { x: 6670, y: 4820 }, { x: 7150, y: 5360 },
  { x: 7670, y: 5700 }, { x: 7940, y: 6010 }, { x: 7860, y: 6790 }, { x: 7640, y: 7340 },
  { x: 7380, y: 7890 }, { x: 7140, y: 8430 }, { x: 6860, y: 9060 }, { x: 6670, y: 9680 },
  { x: 6690, y: 10150 }, { x: 7140, y: 10490 },
  ],
  pit: {
    from: 1,
    to: 5,
    points: [
      { x: 9550, y: 10800 }, { x: 10460, y: 10690 }, { x: 11360, y: 10670 },
    ],
  },
  jump: null,
  tunnels: [{ from: 29, to: 35 }, { from: 77, to: 85 }],
  speedPads: [
    { t: 0.05, lane: 1 }, { t: 0.16, lane: 0 }, { t: 0.27, lane: 2 }, { t: 0.42, lane: 1 }, { t: 0.52, lane: 0 }, { t: 0.62, lane: 2 }, { t: 0.72, lane: 1 }, { t: 0.8, lane: 0 },
  ],
  weaponPads: [
    { t: 0.1, lane: 0 }, { t: 0.1, lane: 2 }, { t: 0.35, lane: 1 }, { t: 0.57, lane: 0 }, { t: 0.57, lane: 2 }, { t: 0.76, lane: 1 },
  ],
};
