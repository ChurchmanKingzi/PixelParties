from px2 import *
from font35 import text35, width35
from smugcoin import smug_coin
from art_blackstache import build as bs_build
random.seed(7)
W,H=W2,H2
cv=C2((50,28,16))
# ---------- wooden planks ----------
WD=[(38,20,10),(58,32,17),(78,45,24),(98,59,32),(120,76,42),(146,96,56)]
PW=31
nz=noise(H,W,8,seed=2)
for i,x0 in enumerate(range(-6,W,PW)):
    base=[2,3,2,3,2,3,2,3,2][i%9]
    off=random.random()*10
    for x in range(max(0,x0),min(W,x0+PW)):
        for y in range(H):
            g=math.sin((y*0.045+off)+math.sin(x*0.35+off)*0.8)*0.6+math.sin(y*0.012+x*0.2+off)*0.5
            v=base
            if g>0.75: v=base+1
            if g<-0.7: v=base-1
            if (x-x0) in (1,2) and (y+x)%2==0: v=min(5,v+1)
            if (x-x0)>=PW-3: v=max(0,v-1)
            if nz[y,x]>0.66 and (x+y)%2==0: v=max(0,v-1)
            cv.px(x,y,WD[v])
    cv.rect(max(0,x0),0,max(0,x0)+1,H,WD[0])
    jy=random.randint(40,300)
    cv.rect(max(0,x0),jy,min(W,x0+PW),jy+1,WD[0]); cv.rect(max(0,x0),jy+1,min(W,x0+PW),jy+2,WD[4])
    for yy in (jy-6,jy+7):
        for nx in (x0+7,x0+PW-9):
            cv.rect(nx,yy,nx+2,yy+2,(40,38,40)); cv.px(nx,yy,(120,118,120))
    kx,ky=x0+random.randint(8,PW-10),random.randint(20,330)
    for dy in range(-4,5):
        for dx in range(-3,4):
            d=(dx/3)**2+(dy/4.5)**2
            if d<=1: cv.px(kx+dx,ky+dy,WD[1] if d>0.4 else WD[0])
            elif d<=1.8 and (dx+dy)%2==0: cv.px(kx+dx,ky+dy,WD[base+1] if base<5 else WD[5])
# ---------- parchment ----------
INK=(52,28,14); DK=(98,60,32); MD=(150,106,62); LT=(196,156,100); PAP=(224,194,140); PAPL=(238,214,164); PAPW=(246,230,190)
PX0,PY0,PX1,PY1=20,22,230,334
poster=np.zeros((H,W),bool)
top=[PY0+random.choice([0,0,1,1,2,3]) for _ in range(W)]
bot=[PY1-random.choice([0,0,1,2,2,4]) for _ in range(W)]
lef=[PX0+random.choice([0,0,1,2,2,3]) for _ in range(H)]
rig=[PX1-random.choice([0,0,1,2,3]) for _ in range(H)]
for y in range(H):
    for x in range(W):
        if top[x]<=y<bot[x] and lef[y]<=x<rig[y]: poster[y,x]=True
# torn corner bottom-left, missing bite top-left
for y in range(H):
    for x in range(W):
        if x-PX0+(PY1-y)<16+int(2*math.sin(y*1.7)): poster[y,x]=False
        if (x-PX0)+(y-PY0)<7: poster[y,x]=False
curl=np.zeros((H,W),bool)
# curled corner bottom-right
CR=26
for y in range(H):
    for x in range(W):
        if (PX1-x)+(PY1-y)<CR and poster[y,x]:
            poster[y,x]=False
            if (PX1-x)+(PY1-y)>=0: pass
# shadow
for y in range(H):
    for x in range(W):
        if not poster[y,x]:
            for s in (3,2):
                if y>=s and x>=s and poster[y-s,x-s]:
                    cv.px(x,y,lerp(tuple(cv.a[y,x]),(14,6,2),0.55 if s==3 else 0.65)); break
pd=cv2.distanceTransform(np.pad(poster.astype(np.uint8),1),cv2.DIST_L2,3)[1:-1,1:-1]
st=noise(H,W,22,seed=5,octaves=3); st2=noise(H,W,5,seed=9,octaves=2)
for y in range(H):
    for x in range(W):
        if not poster[y,x]: continue
        v=st[y,x]*0.7+st2[y,x]*0.3
        c=PAP
        if v>0.6: c=PAPL
        if v>0.72 and BAYER4[y%4,x%4]<0.5: c=PAPW
        if v<0.38: c=LT if BAYER4[y%4,x%4]<(0.38-v)*5 else PAP
        if v<0.3: c=LT
        if v<0.26 and BAYER4[y%4,x%4]<0.4: c=MD
        e=pd[y,x]
        if e<1.5: c=DK
        elif e<2.5: c=MD
        elif e<4 and BAYER4[y%4,x%4]<(4-e)/2.5: c=LT
        elif e<7 and BAYER4[y%4,x%4]<(7-e)/10: c=LT
        cv.px(x,y,c)
# curl flap (back side of paper, lighter + shading)
for y in range(PY1-CR,PY1+1):
    for x in range(PX1-CR,PX1+1):
        u=(PX1-x)+(PY1-y)
        # reflected triangle over diagonal
        if u<CR and (x-(PX1-CR))+(y-(PY1-CR))>=CR and (PX1-x)<=CR and (PY1-y)<=CR:
            xr,yr=PX1-CR+(PY1-y)-0,PY1-CR+(PX1-x)
            if 0<=xr<W and 0<=yr<H:
                t=u/CR
                c=PAPW if t>0.6 else (PAPL if t>0.3 else LT)
                cv.px(xr,yr,c)
for k in range(CR+1):
    cv.px(PX1-CR+k,PY1-k,DK)
# fold creases (shadow+highlight)
for y in range(PY0+3,PY1-3):
    if poster[y,125]: cv.px(125,y,LT); cv.px(126,y,PAPW) if poster[y,126] else None
for x in range(PX0+3,PX1-3):
    if poster[178,x]: cv.px(x,178,LT); cv.px(x,179,PAPW) if poster[179,x] else None
# ---------- print helpers (ink with texture) ----------
def ink_text(t,size,cx,y,col=INK,shadow=None):
    m=text_mask(t,size); h,w=m.shape; x=cx-w//2
    ys,xs=np.where(m)
    for yy,xx in zip(ys,xs):
        X,Y=x+xx,y+yy
        if shadow: cv.px(X+1,Y+1,shadow)
    for yy,xx in zip(ys,xs):
        X,Y=x+xx,y+yy
        c=col
        if st2[Y,X]>0.78 and (X+Y)%2==0: c=DK   # worn ink
        cv.px(X,Y,c)
    return w,h
def rule(y,x0,x1,c=INK):
    for x in range(x0,x1):
        if poster[y,x]: cv.px(x,y,c)
# ---------- header ----------
rule(34,40,210); rule(36,40,210)
ink_text('WANTED',40,125,41,INK,shadow=MD)
rule(80,40,210); rule(82,40,210)
def star(x,y,c=INK):
    for (dx,dy) in [(0,0),(1,0),(-1,0),(0,1),(0,-1),(0,-2),(0,2),(2,0),(-2,0)]: cv.px(x+dx,y+dy,c)
ink_text('DEAD  OR  ALIVE',10,125,87,DK)
star(46,91); star(204,91)
# ---------- portrait frame ----------
FX0,FY0,FX1,FY1=58,102,192,222
cv.rect(FX0-4,FY0-4,FX1+4,FY1+4,INK); cv.rect(FX0-3,FY0-3,FX1+3,FY1+3,PAPL); cv.rect(FX0-2,FY0-2,FX1+2,FY1+2,INK)
for x in range(FX0-3,FX1+3,4): cv.px(x,FY0-3,INK); cv.px(x+2,FY1+2,INK)
for y in range(FY0-3,FY1+3,4): cv.px(FX0-3,y,INK); cv.px(FX1+2,y+2,INK)
cv.rect(FX0,FY0,FX1,FY1,PAPL)
# engraved backdrop: sky hatching, sun, sea, ship
for y in range(FY0,FY1):
    for x in range(FX0,FX1):
        t=(y-FY0)/(FY1-FY0)
        c=PAPL
        if t<0.62:
            if (x+y)%5==0 and t<0.45: c=LT
            if (x+y)%3==0 and t<0.18: c=LT
        else:
            w=(x+int(3*math.sin(y*0.8+x*0.05)))%7
            c=MD if w==0 else (LT if w in (1,4) else PAPL)
            if t>0.85 and w in (2,5): c=MD
        cv.px(x,y,c)
# sun rays
SUX,SUY=164,128
for y in range(FY0,FY0+70):
    for x in range(FX0,FX1):
        d=math.hypot(x-SUX,y-SUY)
        if d<11: cv.px(x,y,PAPW if d<9 else LT)
        elif d<30:
            a=math.atan2(y-SUY,x-SUX)
            if int(a*8/math.pi*2)%2==0 and (x+y)%2==0: cv.px(x,y,PAPW)
# ship silhouette
ship=["......#.......",
      "......#.......",
      ".....###......",
      "....#####.#...",
      "...######.##..",
      "..#######.###.",
      "......#...#...",
      "##############",
      ".############.",
      "..##########.."]
for j,r in enumerate(ship):
    for i,ch in enumerate(r):
        if ch=='#': cv.px(70+i,168+j,DK)
for (gx,gy) in [(80,120),(92,114),(150,158)]:
    cv.px(gx,gy,DK); cv.px(gx-1,gy-1,DK); cv.px(gx+1,gy-1,DK); cv.px(gx-2,gy,DK); cv.px(gx+2,gy,DK)
# ---------- Blackstache (engraving shading) ----------
art=bs_build()
cmap={'K':0,'B':0,'D':1,'b':1,'M':2,'L':3,'W':4}
hh=len(art); ww=len(art[0])
lv=np.full((hh,ww),-1)
for y,r in enumerate(art):
    for x,c in enumerate(r):
        if c in cmap: lv[y,x]=cmap[c]
# scale2x on level map
rgba=np.zeros((hh,ww,4),np.uint8); rgba[...,0]=np.where(lv>=0,lv*40,0); rgba[...,3]=np.where(lv>=0,255,0)
big=scale2x(rgba); L2=np.where(big[...,3]>0,big[...,0].astype(int)//40,-1)
# add form shading from distance field
m=L2>=0
dist=cv2.distanceTransform(np.pad(m.astype(np.uint8),1),cv2.DIST_L2,3)[1:-1,1:-1]
bx=125-L2.shape[1]//2; by=FY1-L2.shape[0]+2
for y in range(L2.shape[0]):
    for x in range(L2.shape[1]):
        v=L2[y,x]
        if v<0: continue
        X,Y=bx+x,by+y
        if Y>=FY1 or Y<FY0 or X<FX0 or X>=FX1: continue
        rightside=x>L2.shape[1]*0.55
        if v==0: c=INK
            # beard strands
        elif v==1:
            c=DK
            if (X+Y)%4==0 or (rightside and (X-Y)%3==0): c=INK
        elif v==2:
            c=MD
            if (X-Y)%4==0: c=DK
            if rightside and (X+Y)%3==0: c=DK
        elif v==3:
            c=LT
            if (X-Y)%5==0: c=MD
        else: c=PAPW
        if v>0 and dist[y,x]<1.5: c=INK
        cv.px(X,Y,c)
# beard highlight strands (wavy)
for y in range(L2.shape[0]):
    for x in range(L2.shape[1]):
        if L2[y,x]==0 and 38<y<80 and ((x+int(2.5*math.sin(y*0.35+x*0.1)))%6==0):
            X,Y=bx+x,by+y
            if FY0<=Y<FY1: cv.px(X,Y,DK)
# ---------- name + reward ----------
ink_text('BLACKSTACHE',20,125,232,INK,shadow=MD)
ink_text('SCOURGE OF THE PIXEL SEAS',9,125,254,DK)
rule(268,60,190,DK)
ink_text('REWARD',14,125,274,INK)
coin=outline(smug_coin(12),INK)
nm=text_mask('999.999',22); w,h=nm.shape[1],nm.shape[0]
GAP=6
x0=125-(w+GAP+coin.shape[1])//2          # centre the whole group (number + coin)
ink_text('999.999',22,x0+w//2,292,INK,shadow=MD)
cv.paste(coin,x0+w+GAP,292+h//2-coin.shape[0]//2)   # coin vertically centred on the digits
star(52,306); star(198,306)
ink_text('PAYABLE IN SMUG COINS',9,125,316,DK)
# ---------- red stamp ----------
RS=(170,36,36); RSL=(200,70,60)
sx0,sy0=62,194
for y in range(sy0,sy0+24):
    for x in range(sx0,sx0+50):
        e=min(x-sx0,sx0+49-x,y-sy0,sy0+23-y)
        if (e in (0,2)) and st2[y,x]<0.75: cv.px(x,y,RS)
m=text_mask('PIXEL',9); ys,xs=np.where(m)
for yy,xx in zip(ys,xs):
    if st2[sy0+4+yy,sx0+8+xx]<0.8: cv.px(sx0+8+xx,sy0+4+yy,RS)
m=text_mask('NAVY',9); ys,xs=np.where(m)
for yy,xx in zip(ys,xs):
    if st2[sy0+13+yy,sx0+12+xx]<0.8: cv.px(sx0+12+xx,sy0+13+yy,RSL)
# ---------- bullet holes ----------
def hole(cx,cy):
    for dy in range(-5,6):
        for dx in range(-5,6):
            d=math.hypot(dx,dy)
            if d<=1.6: cv.px(cx+dx,cy+dy,(20,10,4))
            elif d<=2.6: cv.px(cx+dx,cy+dy,INK if (dx+dy)%2 else DK)
            elif d<=4 and random.random()<0.5: cv.px(cx+dx,cy+dy,MD)
            elif d<=5.2 and random.random()<0.2: cv.px(cx+dx,cy+dy,LT)
    for k in range(6):
        a=random.random()*6.28; L=random.randint(4,7)
        for r in range(3,L): cv.px(int(cx+math.cos(a)*r),int(cy+math.sin(a)*r),DK if r<5 else MD)
hole(200,56); hole(70,150); hole(206,248)
# ---------- dagger (top-right) ----------
BL=[(90,96,112),(150,158,176),(206,212,226),(244,248,252)]
tipx,tipy=192,58
for i in range(30):
    x=tipx+i; y=tipy-i
    w=1 if i<4 else 2
    cv.px(x,y,BL[2]); cv.px(x+1,y,BL[1]); cv.px(x,y-1,BL[3])
    if w==2: cv.px(x+1,y+1,BL[0]); cv.px(x-1,y,BL[3]) if i<28 else None
    if i%5==2: cv.px(x,y,BL[3])
for i in range(3,26): cv.px(tipx+i+3,tipy-i+4,MD) if poster[tipy-i+4,tipx+i+3] else None
gx,gy=tipx+30,tipy-30
GD=[(120,80,20),(190,140,44),(236,190,80),(255,236,150)]
for k in range(-8,9):
    cv.px(gx+k,gy+k,GD[2]); cv.px(gx+k+1,gy+k,GD[1]); cv.px(gx+k,gy+k-1,GD[3]) if k<0 else None
cv.rect(gx-10,gy-10,gx-7,gy-7,GD[2]); cv.rect(gx+7,gy+7,gx+10,gy+10,GD[1])
HN=[(40,18,8),(70,36,16),(110,62,30)]
for i in range(1,16):
    x=gx+i; y=gy-i
    cv.px(x,y,HN[1]); cv.px(x+1,y,HN[1]); cv.px(x,y-1,HN[2]); cv.px(x+1,y+1,HN[0]); cv.px(x+2,y,HN[0])
    if i%3==0: cv.px(x,y,GD[1]); cv.px(x+1,y,GD[1])
px_,py_=gx+17,gy-17
for dy in range(-3,4):
    for dx in range(-3,4):
        if dx*dx+dy*dy<=9: cv.px(px_+dx,py_+dy,GD[2] if dx+dy<0 else GD[1])
cv.px(px_-1,py_-1,GD[3])
# nails
for (nx,ny) in [(30,34),(220,322),(214,32)]:
    if poster[ny,nx]:
        for dy in range(-2,3):
            for dx in range(-2,3):
                if dx*dx+dy*dy<=5: cv.px(nx+dx,ny+dy,(70,70,78) if dx+dy>0 else (150,150,160))
        cv.px(nx-1,ny-1,(220,220,230))
save2(cv,'02_wanted')
