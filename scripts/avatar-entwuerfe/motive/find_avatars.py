import os, json, sys, numpy as np, cv2
from PIL import Image
from multiprocessing import Pool
R='/home/user/PixelParties'; E='/home/user/sprites_export'
skip={'avatar2','avatar4','avatar9','avatar10','avatar11','avatar13','avatar17'}
new=set(f[:-4] for f in os.listdir(R+'/data/shop/avatar-entwuerfe') if not f.startswith('00'))
# Originale aus Git-Historie (vor Ersetzung): erste Version aus Commit vor meinen Aenderungen
ORIG='/home/user/orig_avatars'
def load(n):
    a=np.array(Image.open(f'{ORIG}/{n}.png').convert('RGBA')); h,w=a.shape[:2]; k=1
    for kk in range(2,64):
        if h%kk or w%kk: continue
        b=a.reshape(h//kk,kk,w//kk,kk,-1)
        if (b==b[:,:1,:,:1]).all(): k=kk
    return a[::k,::k],k
LAY=[]
for f in sorted(os.listdir(E)):
    j=json.load(open(f'{E}/{f}/layers.json'))
    for l in j['layers']:
        if 'bw' in l: LAY.append((f,l['index'],l['name'],l['bx'],l['by'],l['bw'],l['bh']))
def work(n):
    nat,k=load(n); h,w=nat.shape[:2]
    al=(nat[...,3]>0).astype(np.uint8)
    if al.sum()<10: return n,[]
    res=[]
    for fl in (0,1):
        a=nat[:,::-1] if fl else nat; m=al[:,::-1] if fl else al
        t=np.ascontiguousarray(a[...,:3]).astype(np.float32); m3=np.repeat(m[...,None],3,2).astype(np.float32); den=m.sum()*3*255*255
        for (f,i,name,bx,by,bw,bh) in LAY:
            if bw<w or bh<h: continue
            c=np.array(Image.open(f'{E}/{f}/crops/{i:04d}.png').convert('RGBA'))
            # nur opake Pixel zaehlen: transparente Ebenenpixel -> weit weg
            rgb=c[...,:3].astype(np.float32).copy(); rgb[c[...,3]<255]=-1000
            r=cv2.matchTemplate(rgb,t,cv2.TM_SQDIFF,mask=m3)/den
            y,x=np.unravel_index(np.argmin(r),r.shape)
            res.append((float(r[y,x]),f,i,name,bx+int(x),by+int(y),fl))
    res.sort(); return n,res[:8]
if __name__=='__main__':
    names=[f[:-4] for f in sorted(os.listdir(ORIG)) if f[:-4] not in skip|new]
    with Pool(4) as p: out=dict(p.map(work,names,chunksize=1))
    json.dump(out,open('/home/user/find_avatars.json','w'),indent=1); print('fertig')
