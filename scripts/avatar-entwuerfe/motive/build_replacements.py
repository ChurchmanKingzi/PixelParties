import os, json, numpy as np
from PIL import Image, ImageDraw
E='/home/user/sprites_export'; ORIG='/home/user/orig_avatars'
SP='/tmp/claude-0/-home-user-PixelParties/ba24cb66-9bb9-5fd5-a116-fde55cc1f4a5/scratchpad'
S=json.load(open('/home/user/scenes_for.json'))
REF=json.load(open(SP+'/refine.json'))
FR=json.load(open('/home/user/frames_for.json')) if os.path.exists('/home/user/frames_for.json') else {}
OUT='/home/user/PixelParties/data/shop/avatar-entwuerfe/ersatz2'; os.makedirs(OUT,exist_ok=True)
def load(n):
    a=np.array(Image.open(f'{ORIG}/{n}.png').convert('RGBA')); h,w=a.shape[:2]; k=1
    for kk in range(2,64):
        if h%kk or w%kk: continue
        b=a.reshape(h//kk,kk,w//kk,kk,-1)
        if (b==b[:,:1,:,:1]).all(): k=kk
    return a[::k,::k],k
info={}
SKIP={'Rosie','avatar15','GoldenAbomination','RealmniversalEmperor','avatar12'}
for n,b in S.items():
    if b is None or n in SKIP: continue
    err,nop,f,i,name,sx,sy,bx,by,bw,bh,sc=b
    nat,k=load(n); h,w=nat.shape[:2]
    c=np.array(Image.open(f'{E}/{f}/crops/{i:04d}.png').convert('RGBA'))
    if n in REF:
        _,_,m,rx,ry=REF[n][0:1]+REF[n][1:] if False else (None,None,REF[n][2],REF[n][3],REF[n][4])
        fx,fy=sx-rx/m,sy-ry/m; fw,fh=610/m,400/m; src='karte'
    elif FR.get(n) and FR[n][0][0]<0.03:
        _,cn,fx,fy=FR[n][0]; fw,fh=76,50; src='rahmen'
    else:
        fx=fy=None; fw,fh=76,50; src='ohne'
    if fx is not None and not (fx<=sx+w/2<=fx+fw and fy<=sy+h/2<=fy+fh): fx=fy=None; src='ohne'
    side=int(np.ceil(max(w,h)/0.72)); side+=side%2
    side=min(side,int(fh))
    cx,cy=sx+w/2,sy+h/2
    x0=int(round(cx-side/2)); y0=int(round(cy-side/2))
    if fx is not None:
        x0=int(max(round(fx),min(round(fx+fw)-side,x0))); y0=int(max(round(fy),min(round(fy+fh)-side,y0)))
    x0=max(bx,min(bx+bw-side,x0)); y0=max(by,min(by+bh-side,y0))
    if n=='Foresta': x0,y0,side=222,67,50
    win=c[y0-by:y0-by+side, x0-bx:x0-bx+side]
    scale=k if k>=10 else max(3,round(240/side))
    im=Image.fromarray(win).convert('RGB').resize((side*scale,side*scale),Image.NEAREST)
    im.save(f'{OUT}/{n}.png'); info[n]=(f,i,src,side,scale)
    print(n,src,side,'x',scale,flush=True)
json.dump(info,open('/home/user/build_info.json','w'))
ids=list(info); t=200
Sh=Image.new('RGB',(5*(t+6),((len(ids)+4)//5)*(t+18)),(24,24,24)); d=ImageDraw.Draw(Sh)
for j,n in enumerate(ids):
    x,y=(j%5)*(t+6),(j//5)*(t+18); d.text((x+2,y+2),f'{n} [{info[n][2]}]',fill=(255,255,0))
    Sh.paste(Image.open(f'{OUT}/{n}.png').resize((t,t),Image.NEAREST),(x+2,y+16))
Sh.save(SP+'/ersatz2.png')
