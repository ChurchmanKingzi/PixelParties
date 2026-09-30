import os, sys, json, re, numpy as np, cv2
from PIL import Image
from multiprocessing import Pool
R='/home/user/PixelParties'; E='/home/user/sprites_export'
SP='/tmp/claude-0/-home-user-PixelParties/ba24cb66-9bb9-5fd5-a116-fde55cc1f4a5/scratchpad'
items=json.load(open(SP+'/items.json'))
CAND=[12,26,35,42,43,53,63,79,85,88,89,90,91,96,97,105,132,133,137,140,145,152,153,159,180,181,188,189,203,205,224,226,233,243,264,265,303,306,308,316,325,335,350,354,356,363,366,368,374,388,397,401,403,410,420,442,463,467,469,497,501,507,513,514,515,519,523,524,525,526,3,14,21,22,58,61,72,84,147,168,167,45,57,74,76,100,101,102,110,111,113,117,118,128,130,136,141,144,146,148,149,150,151,154,155,156,157,158,160,161,164,165,166,169,170,171,172,173,174,175,176,177,178,179,182,183,184,185,186,187,190,191,192,193,194,195,196,197,198,199,201,202,206,207,208,209,210,211,212,213,214,215,216,217,218,219,220,221,222,223,225,227,228,229,230,231,232,234,235,236,237,238,239,240,241,242,244,245,246,247,248,249,250,251,252,253,254,255,256,257,258,259,260,261,262,263]
CAND=[c for c in dict.fromkeys(CAND) if c<len(items)]
def cardart(i):
    f=items[i]['file']; p=f'{R}/cards/{f}'
    a=np.array(Image.open(p).convert('RGB'))[168:568,70:680]
    return a
LAY=[]
for f in sorted(os.listdir(E)):
    for l in json.load(open(f'{E}/{f}/layers.json'))['layers']:
        if 'bw' in l and l['bw']>=150 and l['bh']>=100 and (l['name'].startswith('Sichtbar') or l['bw']*l['bh']>60000): LAY.append((f,l['index'],l['name'],l['bx'],l['by']))
def init():
    global BIG
    BIG=[]
    for (f,i,name,bx,by) in LAY:
        c=np.array(Image.open(f'{E}/{f}/crops/{i:04d}.png').convert('RGBA'))
        rgb=c[...,:3].copy(); rgb[c[...,3]<255]=0
        h,w=rgb.shape[:2]
        BIG.append(cv2.resize(rgb,(w//2,h//2),interpolation=cv2.INTER_AREA).astype(np.float32))
def work(i):
    a=cardart(i); best=[]
    for m in (8,6,10):
        tw,th=round(610/m/2),round(400/m/2)
        t=cv2.resize(a,(tw,th),interpolation=cv2.INTER_AREA).astype(np.float32)
        for li,b in enumerate(BIG):
            if b.shape[0]<th or b.shape[1]<tw: continue
            r=cv2.matchTemplate(b,t,cv2.TM_SQDIFF)/(tw*th*3*255*255)
            y,x=np.unravel_index(np.argmin(r),r.shape)
            best.append((float(r[y,x]),m,li,int(x),int(y)))
    best.sort(); out=[]
    for sc,m,li,x,y in best[:3]:
        f,idx,name,bx,by=LAY[li]; out.append((sc,m,f,idx,name,bx+2*x,by+2*y))
    return i,out
if __name__=='__main__':
    print(len(LAY),'Ebenen',len(CAND),'Karten',flush=True)
    with Pool(4,initializer=init) as p:
        res=dict(p.imap_unordered(work,CAND,chunksize=2))
    json.dump(res,open('/home/user/locate_cards.json','w'))
    print('fertig')
