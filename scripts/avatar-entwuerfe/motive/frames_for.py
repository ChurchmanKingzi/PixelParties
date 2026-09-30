import os, json, numpy as np, cv2
from PIL import Image
R='/home/user/PixelParties'; E='/home/user/sprites_export'
S=json.load(open('/home/user/scenes_for.json'))
cards=[]
for d in ('cards','cards/skins'):
    for fn in sorted(os.listdir(f'{R}/{d}')):
        if fn.endswith('.png'):
            a=np.array(Image.open(f'{R}/{d}/{fn}').convert('RGB'))[168:568,70:680]
            cards.append((f'{d}/{fn}',cv2.resize(a,(76,50),interpolation=cv2.INTER_AREA).astype(np.float32)))
print(len(cards),'Karten')
ORIG='/home/user/orig_avatars'
res={}
for n,b in S.items():
    if b is None: continue
    err,nop,f,i,name,x,y,bx,by,bw,bh,sc=b
    c=np.array(Image.open(f'{E}/{f}/crops/{i:04d}.png').convert('RGB'))
    a=Image.open(f'{ORIG}/{n}.png'); k=1
    arr=np.array(a.convert('RGBA')); H,W=arr.shape[:2]
    for kk in range(2,64):
        if H%kk or W%kk: continue
        bb=arr.reshape(H//kk,kk,W//kk,kk,-1)
        if (bb==bb[:,:1,:,:1]).all(): k=kk
    h,w=H//k,W//k
    X0=max(bx,x-80); Y0=max(by,y-60); X1=min(bx+bw,x+w+80); Y1=min(by+bh,y+h+60)
    reg=c[Y0-by:Y1-by, X0-bx:X1-bx].astype(np.float32)
    best=[]
    for cn,t in cards:
        if reg.shape[0]<50 or reg.shape[1]<76: continue
        r=cv2.matchTemplate(reg,t,cv2.TM_SQDIFF)/(76*50*3*255*255)
        yy,xx=np.unravel_index(np.argmin(r),r.shape)
        fx,fy=X0+xx,Y0+yy
        if fx<=x and fy<=y and fx+76>=x+min(w,76)//2:   # Rahmen muss Sprite (zumindest teils) enthalten
            best.append((float(r[yy,xx]),cn,fx,fy))
    best.sort(); res[n]=best[:3]
    print(n,[(round(v[0],4),v[1][6:30] if v[1].startswith('cards/s') else v[1][6:30],v[2],v[3]) for v in best[:2]],flush=True)
res={k:[(float(a),b,int(c),int(d)) for a,b,c,d in v] for k,v in res.items()}; json.dump(res,open('/home/user/frames_for.json','w'))
