import json, sys
d=json.load(open(sys.argv[1])); segs=d['segs']
big=[s for s in segs if s['from']==1 and s['to']==2][0]['pts']
straight=[s for s in segs if s['from']==1 and s['to']==4 and len(s['pts'])==2][0]['pts']   # straight = real track
curve=[s for s in segs if s['from']==1 and s['to']==4 and len(s['pts'])>2][0]['pts']       # curved deviation = pit lane
bottom=[s for s in segs if s['from']==3 and s['to']==4][0]['pts']
gap_mid=[241,622]
main=[gap_mid]+list(reversed(big))+straight[1:]+list(reversed(bottom))[1:]
def dedupe(P,eps=3):
    out=[P[0]]
    for p in P[1:]:
        if abs(p[0]-out[-1][0])+abs(p[1]-out[-1][1])>eps: out.append(p)
    return out
main=dedupe(main)
# finish line: middle of the long left straight (between (890,4630) and (900,5820)); rotate so it is index 0
def nearest(P,q): return min(range(len(P)),key=lambda i:(P[i][0]-q[0])**2+(P[i][1]-q[1])**2)
a=nearest(main,[89,463]); b=nearest(main,[90,582]); assert b==a+1, (a,b)
finish=[(main[a][0]+main[b][0])//2,(main[a][1]+main[b][1])//2]
main=main[:b]+[finish]+main[b:]
main=main[b:]+main[:b]
jump_from=nearest(main,[241,656]); jump_to=nearest(main,[241,588])
def _unused(P,q): return min(range(len(P)),key=lambda i:(P[i][0]-q[0])**2+(P[i][1]-q[1])**2)
j1=nearest(main,d['nodes']['1']); j4=nearest(main,d['nodes']['4'])
SC=10
fmt=lambda P,ind='  ': ',\n'.join(ind+', '.join('{ x: %d, y: %d }'%(p[0]*SC,p[1]*SC) for p in P[i:i+4]) for i in range(0,len(P),4))
ts=f"""import type {{ Vec2 }} from '@/engine/math';

/**
 * Sagarmatha — linea centrale ricavata dal bitmap ref/sagarmatha.png (367x840 px).
 * Coordinate mondo = pixel immagine x {SC}. Y cresce verso il basso (come il canvas).
 * Il loop principale parte dal traguardo (meta' del rettilineo sinistro) e gira in senso
 * antiorario sullo schermo: sud lungo il rettilineo sinistro, tornante in basso, nord lungo
 * il rettilineo destro (con il salto), poi il giro largo in alto. La deviazione curva in basso a sinistra e' la corsia box (solo scenografica).
 */
export interface TrackData {{
  name: string;
  /** Linea centrale del loop principale, chiusa (l'ultimo punto si ricongiunge al primo). */
  main: Vec2[];
  /** Larghezza della pista principale, unita' mondo. */
  width: number;
  /** Corsia box: si stacca da main[from] e rientra in main[to]; i punti sono quelli intermedi. */
  pit: {{ from: number; to: number; points: Vec2[]; width: number }};
  /** Salto: la pista manca tra main[from] (stacco) e main[to] (atterraggio). */
  jump: {{ from: number; to: number }};
  /** Speed pad e weapon pad: posizione come frazione t in [0,1) lungo main e offset laterale in [-1,1]. */
  speedPads: {{ t: number; side: number }}[];
  weaponPads: {{ t: number; side: number }}[];
}}

export const SAGARMATHA: TrackData = {{
  name: 'Sagarmatha',
  width: 200,
  main: [
{fmt(main)},
  ],
  jump: {{ from: {jump_from}, to: {jump_to} }},
  pit: {{
    from: {j1},
    to: {j4},
    width: 110,
    points: [
{fmt(curve[1:-1], '      ')},
    ],
  }},
  speedPads: [
    {{ t: 0.08, side: 0 }}, {{ t: 0.30, side: -0.4 }}, {{ t: 0.52, side: 0.4 }}, {{ t: 0.80, side: 0 }},
  ],
  weaponPads: [
    {{ t: 0.16, side: 0.4 }}, {{ t: 0.16, side: -0.4 }}, {{ t: 0.44, side: 0 }}, {{ t: 0.70, side: 0.4 }}, {{ t: 0.70, side: -0.4 }},
  ],
}};
"""
open(sys.argv[2],'w').write(ts)
print('main pts',len(main),'pit from/to',j1,j4,'pit pts',len(curve)-2,'jump',jump_from,jump_to)
