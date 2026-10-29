import type { TrackData } from './track';

/**
 * Karbonis V — linea centrale tracciata con tools/trace_track.py da ref/vgcartography/karbonis.png
 * (60 punti, giro di circa 37172 unita'). Coordinate mondo = pixel immagine x 10
 * (y x 14 per compensare l'inclinazione della vista). Rigenera con:
 *   python3 -I tools/trace_track.py tools/karbonis.json
 * I tratti in galleria sono invisibili nella mappa e tracciati a mano.
 */
export const KARBONIS_V: TrackData = {
  id: 'karbonis',
  name: 'Karbonis V',
  country: 'Japan',
  theme: { ground: 'ground_karbonis', ref: { src: 'ref/karbonis.png', sx: 10, sy: 14 } },
  main: [
  { x: 9140, y: 8970 }, { x: 9770, y: 9150 }, { x: 10260, y: 9590 }, { x: 11170, y: 9760 },
  { x: 11550, y: 9720 }, { x: 12420, y: 10120 }, { x: 12790, y: 10580 }, { x: 13580, y: 10660 },
  { x: 14340, y: 10950 }, { x: 14960, y: 10640 }, { x: 15460, y: 10190 }, { x: 15680, y: 9800 },
  { x: 16120, y: 8970 }, { x: 16350, y: 8170 }, { x: 16350, y: 7370 }, { x: 16180, y: 6580 },
  { x: 15970, y: 5860 }, { x: 15800, y: 5330 }, { x: 15420, y: 5150 }, { x: 14980, y: 5330 },
  { x: 14470, y: 5690 }, { x: 13960, y: 5950 }, { x: 13300, y: 6300 }, { x: 12920, y: 5920 },
  { x: 12630, y: 5750 }, { x: 12240, y: 5670 }, { x: 11880, y: 5740 }, { x: 11390, y: 5890 },
  { x: 10760, y: 5740 }, { x: 10340, y: 5380 }, { x: 9920, y: 5110 }, { x: 9330, y: 5050 },
  { x: 8930, y: 5070 }, { x: 8310, y: 4860 }, { x: 7820, y: 4540 }, { x: 7300, y: 4140 },
  { x: 6890, y: 3840 }, { x: 6290, y: 3370 }, { x: 5850, y: 3040 }, { x: 5440, y: 2690 },
  { x: 5140, y: 2170 }, { x: 4630, y: 2160 }, { x: 4320, y: 2230 }, { x: 3910, y: 2550 },
  { x: 3470, y: 3140 }, { x: 3430, y: 3640 }, { x: 3320, y: 4210 }, { x: 3050, y: 4890 },
  { x: 2790, y: 5510 }, { x: 3050, y: 5950 }, { x: 3530, y: 6100 }, { x: 4010, y: 6500 },
  { x: 4550, y: 6860 }, { x: 4670, y: 7100 }, { x: 5240, y: 7740 }, { x: 5960, y: 7950 },
  { x: 6170, y: 8390 }, { x: 6850, y: 8830 }, { x: 7470, y: 8760 }, { x: 8110, y: 8720 },
  ],
  pit: {
    from: 1,
    to: 5,
    points: [
      { x: 10390, y: 9290 }, { x: 11200, y: 9430 }, { x: 11640, y: 9400 },
    ],
  },
  jump: null,
  tunnels: [{ from: 12, to: 17 }],
  bridges: [],
  speedPads: [
    { t: 0.06, lane: 1 }, { t: 0.2, lane: 2 }, { t: 0.33, lane: 0 }, { t: 0.47, lane: 1 }, { t: 0.6, lane: 2 }, { t: 0.72, lane: 0 }, { t: 0.86, lane: 1 },
  ],
  weaponPads: [
    { t: 0.12, lane: 0 }, { t: 0.12, lane: 2 }, { t: 0.4, lane: 1 }, { t: 0.55, lane: 0 }, { t: 0.55, lane: 2 }, { t: 0.8, lane: 1 },
  ],
};
