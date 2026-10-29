import type { TrackData } from './track';

/**
 * Terramax — linea centrale tracciata con tools/trace_track.py da ref/vgcartography/terramax.png
 * (61 punti, giro di circa 36587 unita'). Coordinate mondo = pixel immagine x 10
 * (y x 14 per compensare l'inclinazione della vista). Rigenera con:
 *   python3 -I tools/trace_track.py tools/terramax.json
 * I tratti in galleria sono invisibili nella mappa e tracciati a mano.
 */
export const TERRAMAX: TrackData = {
  id: 'terramax',
  name: 'Terramax',
  country: 'Germany',
  theme: { ground: 'ground_terramax', ref: { src: 'ref/terramax.png', sx: 10, sy: 14 } },
  main: [
  { x: 4290, y: 8400 }, { x: 4740, y: 8930 }, { x: 5240, y: 9320 }, { x: 5800, y: 9450 },
  { x: 6360, y: 9520 }, { x: 6920, y: 9560 }, { x: 7640, y: 9450 }, { x: 8030, y: 9810 },
  { x: 8590, y: 9870 }, { x: 9150, y: 9960 }, { x: 9700, y: 10120 }, { x: 10320, y: 10010 },
  { x: 10820, y: 10500 }, { x: 11380, y: 10770 }, { x: 11930, y: 10900 }, { x: 12490, y: 10650 },
  { x: 13080, y: 10350 }, { x: 13610, y: 9870 }, { x: 14160, y: 9370 }, { x: 14670, y: 8820 },
  { x: 15110, y: 8200 }, { x: 15450, y: 7570 }, { x: 15560, y: 7030 }, { x: 15280, y: 6680 },
  { x: 14720, y: 6590 }, { x: 14160, y: 6750 }, { x: 13610, y: 6920 }, { x: 13050, y: 7030 },
  { x: 12490, y: 6980 }, { x: 11990, y: 6790 }, { x: 11660, y: 6430 }, { x: 11210, y: 6060 },
  { x: 10710, y: 5750 }, { x: 10210, y: 5500 }, { x: 9760, y: 5340 }, { x: 9370, y: 5780 },
  { x: 8920, y: 6320 }, { x: 8500, y: 6210 }, { x: 8110, y: 5810 }, { x: 7660, y: 5390 },
  { x: 7160, y: 5070 }, { x: 6600, y: 4970 }, { x: 6050, y: 4970 }, { x: 5470, y: 5030 },
  { x: 5190, y: 4760 }, { x: 4960, y: 4290 }, { x: 4850, y: 3750 }, { x: 4800, y: 3200 },
  { x: 4630, y: 2730 }, { x: 4290, y: 2420 }, { x: 3850, y: 2230 }, { x: 3460, y: 2260 },
  { x: 3100, y: 2420 }, { x: 2790, y: 2780 }, { x: 2630, y: 3280 }, { x: 2540, y: 4060 },
  { x: 2570, y: 4920 }, { x: 2730, y: 5700 }, { x: 2970, y: 6400 }, { x: 3320, y: 7100 },
  { x: 3740, y: 7810 },
  ],
  pit: {
    from: 3,
    to: 8,
    points: [
      { x: 6390, y: 9190 }, { x: 6900, y: 9230 }, { x: 7710, y: 9130 }, { x: 8160, y: 9510 },
    ],
  },
  jump: null,
  tunnels: [{ from: 35, to: 42 }],
  bridges: [],
  speedPads: [
    { t: 0.05, lane: 1 }, { t: 0.18, lane: 0 }, { t: 0.3, lane: 2 }, { t: 0.45, lane: 1 }, { t: 0.58, lane: 0 }, { t: 0.7, lane: 2 }, { t: 0.85, lane: 1 },
  ],
  weaponPads: [
    { t: 0.1, lane: 0 }, { t: 0.1, lane: 2 }, { t: 0.37, lane: 1 }, { t: 0.52, lane: 0 }, { t: 0.52, lane: 2 }, { t: 0.78, lane: 1 },
  ],
};
