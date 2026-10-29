import sys, cv2, numpy as np, json
sk=(cv2.imread(sys.argv[1],cv2.IMREAD_GRAYSCALE)<128).astype(np.uint8); out=sys.argv[2]; H,W=sk.shape
def nbrs(y,x): return [(y+dy,x+dx) for dy in (-1,0,1) for dx in (-1,0,1) if (dy or dx) and 0<=y+dy<H and 0<=x+dx<W and sk[y+dy,x+dx]]
for _ in range(14):
    for y,x in [p for p in zip(*np.nonzero(sk)) if len(nbrs(*p))<=1]: sk[y,x]=0
def crossing(y,x):
    ring=[(-1,0),(-1,1),(0,1),(1,1),(1,0),(1,-1),(0,-1),(-1,-1)]
    v=[sk[y+dy,x+dx] if 0<=y+dy<H and 0<=x+dx<W else 0 for dy,dx in ring]
    return sum(1 for i in range(8) if v[i]==0 and v[(i+1)%8]==1)
pts=list(zip(*np.nonzero(sk)))
nodes=[p for p in pts if crossing(*p)!=2]
nm=np.zeros_like(sk)
for y,x in nodes: nm[y,x]=1
nm=cv2.dilate(nm,np.ones((3,3),np.uint8))
n,lab=cv2.connectedComponents(nm,8)
centers={i:(int(np.nonzero(lab==i)[1].mean()),int(np.nonzero(lab==i)[0].mean())) for i in range(1,n)}
print('nodes',centers)
rest=((sk==1)&(nm==0)).astype(np.uint8)
m,comp=cv2.connectedComponents(rest,8)
segs=[]
for i in range(1,m):
    ys,xs=np.nonzero(comp==i); P=[(int(x),int(y)) for x,y in zip(xs,ys)]
    if len(P)<5: continue
    # endpoints of this component: pixels with <=1 neighbours inside the component
    S=set(P); endsP=[p for p in P if sum((p[0]+dx,p[1]+dy) in S for dx in (-1,0,1) for dy in (-1,0,1) if dx or dy)<=1]
    start=endsP[0] if endsP else P[0]
    # greedy chain
    order=[start]; S.remove(start); cur=start
    while S:
        cands=[q for q in S if abs(q[0]-cur[0])<=1 and abs(q[1]-cur[1])<=1]
        if not cands:
            cands=[q for q in S if abs(q[0]-cur[0])<=2 and abs(q[1]-cur[1])<=2]
            if not cands: break
        q=min(cands,key=lambda q:(q[0]-cur[0])**2+(q[1]-cur[1])**2); order.append(q); S.remove(q); cur=q
    def nearest_node(p): return min(centers,key=lambda k:(centers[k][0]-p[0])**2+(centers[k][1]-p[1])**2)
    a,b=nearest_node(order[0]),nearest_node(order[-1])
    xy=np.array(order,np.int32).reshape(-1,1,2)
    simp=cv2.approxPolyDP(xy,1.5,False).reshape(-1,2).tolist()
    segs.append({'from':a,'to':b,'len':len(order),'pts':simp})
    print('seg',a,'->',b,'len',len(order),'simplified',len(simp),'start',order[0],'end',order[-1])
json.dump({'nodes':centers,'segs':segs},open(out+'/segs.json','w'))
im=cv2.imread('/home/vix/work/personali/wipeout1987/ref/sagarmatha.png')
cols=[(0,0,255),(0,180,0),(255,0,0),(0,200,255),(255,0,255)]
for i,s in enumerate(segs):
    for k in range(len(s['pts'])-1): cv2.line(im,tuple(s['pts'][k]),tuple(s['pts'][k+1]),cols[i%5],1)
    for p in s['pts']: cv2.circle(im,tuple(p),2,cols[i%5],-1)
for k,(x,y) in centers.items(): cv2.circle(im,(x,y),4,(0,255,0),-1); cv2.putText(im,str(k),(x+6,y+4),cv2.FONT_HERSHEY_SIMPLEX,0.45,(0,160,0),1)
cv2.imwrite(out+'/overlay.png',cv2.resize(im,None,fx=2,fy=2,interpolation=cv2.INTER_NEAREST))
