import os, json, numpy as np
from PIL import Image
E='/home/user/sprites_export'; ORIG='/home/user/orig_avatars'
F=json.load(open('/home/user/find_avatars.json'))
cache={}
def meta(f):
    if f not in cache: cache[f]=json.load(open(f'{E}/{f}/layers.json'))['layers']
    return cache[f]
def crop(f,i): return np.array(Image.open(f'{E}/{f}/crops/{i:04d}.png').convert('RGBA'))
def load(n):
    a=np.array(Image.open(f'{ORIG}/{n}.png').convert('RGBA')); h,w=a.shape[:2]; k=1
    for kk in range(2,64):
        if h%kk or w%kk: continue
        b=a.reshape(h//kk,kk,w//kk,kk,-1)
        if (b==b[:,:1,:,:1]).all(): k=kk
    return a[::k,::k],k
out={}
for n,res in F.items():
    nat,k=load(n); h,w=nat.shape[:2]; m=nat[...,3]>0
    best=None
    for sc,f,i,name,x,y,fl in res[:4]:
        if fl: continue
        if sc>0.03: continue
        for l in meta(f):
            if 'bw' not in l or l['bw']<150 or l['bh']<150: continue
            if not(l['bx']<=x and l['by']<=y and x+w<=l['bx']+l['bw'] and y+h<=l['by']+l['bh']): continue
            c=crop(f,l['index']); px=c[y-l['by']:y-l['by']+h, x-l['bx']:x-l['bx']+w]
            d=np.abs(px[...,:3].astype(int)-nat[...,:3].astype(int)).sum(2)[m]
            err=d.mean()/765
            # Szene muss deckend sein (Hintergrund vorhanden)
            op=(c[...,3]==255).mean()
            cand=(err,-op,f,l['index'],l['name'],x,y,l['bx'],l['by'],l['bw'],l['bh'],sc)
            if best is None or cand<best: best=cand
    out[n]=best
    print(n, None if best is None else (round(float(best[0]),4),round(float(-best[1]),2),best[2][6:],best[4],best[5],best[6]))
json.dump({k:(None if v is None else [float(v[0]),float(v[1])]+list(v[2:5])+[int(x) for x in v[5:11]]+[float(v[11])]) for k,v in out.items()},open('/home/user/scenes_for.json','w'))
