import sys, cv2, numpy as np, json
src = sys.argv[1]; out = sys.argv[2]
im = cv2.imread(src, cv2.IMREAD_GRAYSCALE)
mask = (im < 128).astype(np.uint8)
n, lab, stats, _ = cv2.connectedComponentsWithStats(mask, 8)
big = 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA]); mask = (lab == big).astype(np.uint8)
k=np.ones((3,3),np.uint8)
mask=cv2.morphologyEx(cv2.morphologyEx(mask,cv2.MORPH_CLOSE,k),cv2.MORPH_OPEN,k)
print('stroke width approx', 2*cv2.distanceTransform(mask, cv2.DIST_L2, 5).max())

def zhang_suen(img):
    img = img.copy().astype(np.uint8); H, W = img.shape
    while True:
        removed = 0
        for step in (0, 1):
            to_del = []
            for y in range(1, H-1):
                for x in range(1, W-1):
                    if img[y, x] == 0: continue
                    p2=img[y-1,x]; p3=img[y-1,x+1]; p4=img[y,x+1]; p5=img[y+1,x+1]
                    p6=img[y+1,x]; p7=img[y+1,x-1]; p8=img[y,x-1]; p9=img[y-1,x-1]
                    nb=[p2,p3,p4,p5,p6,p7,p8,p9]; B=sum(nb)
                    if B<2 or B>6: continue
                    A=sum(1 for i in range(8) if nb[i]==0 and nb[(i+1)%8]==1)
                    if A!=1: continue
                    if step==0 and (p2*p4*p6!=0 or p4*p6*p8!=0): continue
                    if step==1 and (p2*p4*p8!=0 or p2*p6*p8!=0): continue
                    to_del.append((y,x))
            for y,x in to_del: img[y,x]=0
            removed += len(to_del)
        if removed == 0: break
    return img
sk = zhang_suen(np.pad(mask,1))[1:-1,1:-1]
cv2.imwrite(out + '/skeleton.png', (1-sk)*255)
