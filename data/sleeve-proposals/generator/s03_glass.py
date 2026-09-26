from pp import *
from font35 import text35, width35
import colorsys
random.seed(3)
W,H=150,210
cv=Canvas(W,H,(40,36,52))
# --- stone wall ---
ST=[(74,68,92),(84,78,104),(66,60,84),(92,86,110)]
MORT=(38,34,50)
for row,y0 in enumerate(range(0,H,8)):
    off=(row%2)*9
    for bx in range(-18,W,18):
        c=random.choice(ST)
        x0=bx+off
        cv.rect(x0,y0,x0+17,y0+7,c)
        cv.rect(x0,y0,x0+17,y0+1,lerp(c,(255,255,255),0.12))
        cv.rect(x0,y0+6,x0+17,y0+7,lerp(c,(0,0,0),0.2))
        for k in range(3):
            cv.px(x0+random.randint(1,15),y0+random.randint(2,5),lerp(c,(0,0,0),0.15))
# --- window mask (pointed arch) ---
X0,X1,SPR,BOT=14,136,84,188
R=78
c1=X1-R; c2=X0+R
win=np.zeros((H,W),bool)
for y in range(H):
    for x in range(W):
        if X0<=x<X1 and y<BOT:
            if y>=SPR: win[y,x]=True
            elif (x-c1)**2+(y-SPR)**2<=R*R and (x-c2)**2+(y-SPR)**2<=R*R: win[y,x]=True
# stone frame: dilate window
fr=cv2.dilate(win.astype(np.uint8),np.ones((11,11),np.uint8)).astype(bool)
FRC=(150,140,160); FRL=(186,178,196); FRD=(98,90,112)
for y in range(H):
    for x in range(W):
        if fr[y,x] and not win[y,x]:
            c=FRC
            # voussoir joints: radial lines
            ang=math.atan2(y-SPR,x-75)
            if y<SPR and int((ang+4)*9)%3==0 and ((int((ang+4)*90))%30==0): c=FRD
            cv.px(x,y,c)
# bevel highlight/shadow on frame
for y in range(1,H-1):
    for x in range(1,W-1):
        if fr[y,x] and not win[y,x]:
            if not fr[y-1,x] or not fr[y,x-1]: cv.px(x,y,FRL)
            elif win[y+1,x] or win[y,x+1]: cv.px(x,y,FRD)
            elif not fr[y+1,x] or not fr[y,x+1]: cv.px(x,y,FRD)
# voussoir joints on the arch
for k in range(-9,10):
    ang=-math.pi/2+k*0.17
    for r in range(0,7):
        pass
# --- cells ---
dist=cv2.distanceTransform(win.astype(np.uint8),cv2.DIST_L2,3)
seeds=[(random.randint(X0,X1),random.randint(0,BOT)) for _ in range(90)]
seeds=[s for s in seeds if win[min(H-1,s[1]),min(W-1,s[0])]]
seeds=np.array(seeds)
JCX,JCY=75,96
ROSE=(75,28,13)
def cell(x,y):
    d=dist[y,x]
    if d<=5:
        # border band: along perimeter
        if y<SPR: t=int((math.atan2(y-SPR,x-75)+4)*14)
        else: t=y//6+(1000 if x<75 else 2000)
        return ('b',t)
    rx,ry,rr=ROSE
    r=math.hypot(x-rx,y-ry)
    if r<=rr:
        if r<5: return ('rc',0)
        a=(math.atan2(y-ry,x-rx)+math.pi)/(2*math.pi)*8
        return ('rose',int(a)%8, r>11)
    if r<=rr+2: return ('rr',0)
    if 170<=y<=182 and 26<=x<=124: return ('banner',0)
    r2=math.hypot(x-JCX,(y-JCY)*0.9)
    if r2<54 and y<168:
        a=(math.atan2(y-JCY,x-JCX)+math.pi)/(2*math.pi)*22
        return ('ray',int(a),int(r2/15))
    i=np.argmin(((seeds-[x,y])**2).sum(1))
    return ('v',int(i))
cells={}
for y in range(H):
    for x in range(W):
        if win[y,x]: cells[(x,y)]=cell(x,y)
BLUES=[(36,64,150),(52,92,184),(80,56,150),(30,46,116),(98,130,206),(60,70,170)]
GOLDS=[(255,208,86),(246,172,52),(255,232,140),(250,192,70)]
RUBY=(176,30,62); EMER=(40,140,90)
colmap={}
def color_for(c,x,y):
    if c in colmap: return colmap[c]
    k=c[0]
    if k=='b': col=[RUBY,(40,64,170),(236,190,70)][c[1]%3] if True else None
    elif k=='rc': col=(255,220,110)
    elif k=='rose': col=RUBY if (c[1]%2==0)!=c[2] else (46,80,190)
    elif k=='rr': col=(255,200,80)
    elif k=='banner': col=(236,226,200)
    elif k=='ray':
        col=GOLDS[(c[1]+c[2])%4] if c[2]<2 else [(255,236,160),(248,200,90),(236,160,60)][(c[1])%3]
    else:
        sx,sy=seeds[c[1]]
        if sy>176: col=random.choice([EMER,(60,120,60),(34,110,74)])
        elif random.random()<0.12: col=RUBY
        elif random.random()<0.08: col=(120,40,140)
        else: col=random.choice(BLUES)
    colmap[c]=col; return col
LEAD=(28,24,34)
def shash(c): return sum((i+1)*(ord(v[0]) if isinstance(v,str) else int(v)) for i,v in enumerate(c))
for (x,y),c in cells.items():
    col=color_for(c,x,y)
    # mottled glass
    n=math.sin(x*0.6+y*0.35+shash(c)%7)+math.sin(x*0.23-y*0.5+shash(c)%5)
    if n>1.2: col=lerp(col,(255,255,255),0.22)
    elif n<-1.3: col=lerp(col,(0,0,0),0.18)
    cv.px(x,y,col)
# lead lines where neighbouring cells differ
for (x,y),c in cells.items():
    for (dx,dy) in ((1,0),(0,1)):
        n=cells.get((x+dx,y+dy))
        if n is not None and n!=c: cv.px(x,y,LEAD)
    if not win[y,x-1] or not win[y,x+1] or not win[y-1,x] or not win[y+1,x]: cv.px(x,y,LEAD)
# rose window tracery accent
# --- halo ---
for y in range(H):
    for x in range(W):
        r=math.hypot(x-JCX,y-62)
        if 19.5<=r<21.5 and y<78: cv.px(x,y,(255,246,200))
        elif 21.5<=r<22.5 and y<78: cv.px(x,y,LEAD)
# --- Johanna ---
from art_johanna import build, COL
art=build()
fh=len(art); fw=len(art[0])
K=2
bx=JCX-fw*K//2; by=48
lab=np.full((fh*K,fw*K),'.')
for y,r in enumerate(art):
    for x,c in enumerate(r):
        lab[y*K:(y+1)*K,x*K:(x+1)*K]=c
hh,ww=lab.shape
for y in range(hh):
    for x in range(ww):
        L=lab[y,x]
        if L=='.': continue
        col=COL[L]
        n=math.sin((x+bx)*0.6+(y+by)*0.35+ord(L))+math.sin((x+bx)*0.23-(y+by)*0.5)
        if n>1.25 and L!='E': col=lerp(col,(255,255,255),0.22)
        elif n<-1.35 and L!='E': col=lerp(col,(0,0,0),0.15)
        cv.px(bx+x,by+y,col)
for y in range(hh):
    for x in range(ww):
        L=lab[y,x]
        if L=='.': continue
        for dx,dy in ((1,0),(0,1),(-1,0),(0,-1)):
            X,Y=x+dx,y+dy
            N=lab[Y,X] if 0<=X<ww and 0<=Y<hh else '.'
            if N!=L and (N=='.' or (dx+dy)>0): cv.px(bx+x,by+y,LEAD)
# extra pane divisions in the dress (horizontal leads every 14px)
for y in range(76,hh-6,16):
    for x in range(ww):
        if lab[y,x] in 'Dd': cv.px(bx+x,by+y,LEAD)
# lead grid over figure: every 3px block boundary where colour class changes is implied by the sprite outline
# --- banner text ---
text35(cv,'CRUSADER OF LIGHT',75,174,(60,30,40),center=True)
# small star sparkles
for (sx,sy) in [(44,70),(106,66),(40,128),(112,132),(58,52),(94,50)]:
    if win[sy,sx]:
        cv.px(sx,sy,(255,255,240)); cv.px(sx-1,sy,(255,240,180)); cv.px(sx+1,sy,(255,240,180)); cv.px(sx,sy-1,(255,240,180)); cv.px(sx,sy+1,(255,240,180))
# --- sill + candles ---
cv.rect(10,BOT+5,140,BOT+10,FRC); cv.rect(10,BOT+5,140,BOT+6,FRL); cv.rect(10,BOT+9,140,BOT+10,FRD)
cv.rect(14,BOT+10,136,BOT+13,(52,46,64))
def candle(x,h):
    y1=BOT+5
    cv.rect(x,y1-h,x+4,y1,(240,232,210)); cv.rect(x+3,y1-h,x+4,y1,(200,190,170))
    cv.px(x+2,y1-h-1,(40,30,30))
    for (dx,dy,c) in [(2,-2,(255,240,150)),(2,-3,(255,200,80)),(1,-3,(255,160,60)),(2,-4,(255,160,60)),(2,-5,(240,110,40))]:
        cv.px(x+dx,y1-h+dy,c)
    # glow
    for dy in range(-9,2):
        for dx in range(-5,10):
            X,Y=x+dx,y1-h+dy
            if 0<=X<W and 0<=Y<H and not win[Y,X] and (dx-2)**2+(dy+3)**2<30 and (X+Y)%2==0:
                cv.px(X,Y,lerp(tuple(cv.a[Y,X]),(255,200,120),0.35))
candle(22,12); candle(29,8); candle(118,10); candle(125,14)
save_sleeve(cv,'03_stained_glass',5)
