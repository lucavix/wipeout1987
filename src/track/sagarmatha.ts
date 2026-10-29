import type { TrackData } from './track';

/**
 * Sagarmatha — linea centrale ricavata dal bitmap ref/sagarmatha.png (367x840 px).
 * Coordinate mondo = pixel immagine x 10. Y cresce verso il basso (come il canvas).
 * Il loop principale parte dal traguardo (meta' del rettilineo sinistro) e gira in senso
 * antiorario sullo schermo: sud lungo il rettilineo sinistro, tornante in basso, nord lungo
 * il rettilineo destro (con il salto), poi il giro largo in alto. La deviazione curva in basso a sinistra e' la corsia box (solo scenografica).
 */
export const SAGARMATHA: TrackData = {
  id: 'sagarmatha',
  name: 'Sagarmatha',
  theme: { ground: 'background', ref: { src: 'ref/sagarmatha.png', sx: 10, sy: 10 } },
  main: [
  { x: 890, y: 5220 }, { x: 900, y: 5820 }, { x: 890, y: 6960 }, { x: 890, y: 7060 },
  { x: 890, y: 7340 }, { x: 910, y: 7520 }, { x: 1000, y: 7730 }, { x: 1080, y: 7850 },
  { x: 1260, y: 7990 }, { x: 1450, y: 8070 }, { x: 1670, y: 8100 }, { x: 1850, y: 8070 },
  { x: 2020, y: 8000 }, { x: 2180, y: 7890 }, { x: 2340, y: 7660 }, { x: 2400, y: 7470 },
  { x: 2410, y: 6560 }, { x: 2410, y: 6220 }, { x: 2410, y: 5880 }, { x: 2430, y: 4580 },
  { x: 2500, y: 4460 }, { x: 2590, y: 4380 }, { x: 3120, y: 4040 }, { x: 3250, y: 3880 },
  { x: 3270, y: 3810 }, { x: 3270, y: 3580 }, { x: 3200, y: 3190 }, { x: 3200, y: 2920 },
  { x: 3280, y: 2470 }, { x: 3260, y: 2300 }, { x: 3180, y: 2180 }, { x: 2790, y: 1830 },
  { x: 2360, y: 1640 }, { x: 2210, y: 1530 }, { x: 2110, y: 1390 }, { x: 1960, y: 1090 },
  { x: 1330, y: 510 }, { x: 1070, y: 300 }, { x: 980, y: 270 }, { x: 830, y: 290 },
  { x: 750, y: 390 }, { x: 710, y: 610 }, { x: 720, y: 1270 }, { x: 680, y: 1680 },
  { x: 600, y: 1790 }, { x: 320, y: 2060 }, { x: 280, y: 2140 }, { x: 260, y: 2350 },
  { x: 280, y: 4040 }, { x: 330, y: 4140 }, { x: 430, y: 4240 }, { x: 770, y: 4420 },
  { x: 870, y: 4520 }, { x: 890, y: 4630 },
  ],
  jump: { from: 16, to: 18 },
  pit: {
    from: 1,
    to: 2,
    points: [
      { x: 1110, y: 5910 }, { x: 1160, y: 5970 }, { x: 1190, y: 6120 }, { x: 1190, y: 6630 },
      { x: 1150, y: 6830 }, { x: 1080, y: 6930 },
    ],
  },
  speedPads: [
    { t: 0.08, lane: 1 }, { t: 0.30, lane: 0 }, { t: 0.52, lane: 2 }, { t: 0.80, lane: 1 },
  ],
  weaponPads: [
    { t: 0.16, lane: 0 }, { t: 0.16, lane: 2 }, { t: 0.44, lane: 1 }, { t: 0.70, lane: 0 }, { t: 0.70, lane: 2 },
  ],
};
