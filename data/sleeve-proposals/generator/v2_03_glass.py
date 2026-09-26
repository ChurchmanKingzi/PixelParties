from px2 import *
from font35 import text35, width35
from art_johanna import LEFT as JLEFT, COL as JCOL
random.seed(3)
W,H=W2,H2
cv=C2((34,30,46))
# ---------- stone wall (relief) ----------
WH=np.zeros((H,W),np.float32); WM=np.zeros((H,W),np.int32); WMask=np.ones((H,W),bool)
for y in range(H):
    row=y//13; off=(row%2)*14
    for x in range(W):
        bx=(x+off)%28; by=y%13
        e=min(bx,27-bx,by,12-by)
        WH[y,x]=0.3+min(e,3)*0.5 if e>0 else 0.0
wn=noise(H,W,5,seed=11,octaves=3); WH+=(wn-0.5)*0.9
bn=noise(H,W,30,seed=12,octaves=1)
STONE=[(22,20,32),(38,34,52),(54,50,72),(72,68,94),(94,90,118),(120,116,144)]
MOSS=[(20,30,24),(34,50,36),(52,72,46),(74,96,60),(96,120,74)]
# vignette via albedo
yy,xx=np.indices((H,W)); vig=-0.35*np.clip((np.hypot(xx-125,yy-160)-120)/140,0,1)
# warm light from window lowers
relief(cv,WH,WM,[STONE,MOSS],WMask,k=1.3,bias=-0.12,albedo=vig)
# ---------- window mask ----------
X0,X1,SPR,BOT=24,226,140,300
R=132; c1=X1-R; c2=X0+R
win=np.zeros((H,W),bool)
for y in range(H):
    for x in range(W):
        if X0<=x<X1 and y<BOT:
            if y>=SPR: win[y,x]=True
            elif (x-c1)**2+(y-SPR)**2<=R*R and (x-c2)**2+(y-SPR)**2<=R*R: win[y,x]=True
# stone surround (relief): dilated ring with voussoir joints
fr=cv2.dilate(win.astype(np.uint8),np.ones((17,17),np.uint8)).astype(bool)
ring=fr&~win
fd=cv2.distanceTransform(np.pad(fr.astype(np.uint8),1),cv2.DIST_L2,3)[1:-1,1:-1]
wd=cv2.distanceTransform(np.pad((~win).astype(np.uint8),1),cv2.DIST_L2,3)[1:-1,1:-1]
FH=np.zeros((H,W),np.float32)
for y in range(H):
    for x in range(W):
        if ring[y,x]:
            d1=fd[y,x]; d2=wd[y,x]
            h=min(d1,d2)
            FH[y,x]=min(h,4)*0.7+ (1.2 if 3<d2<5 else 0)
            # voussoir joints on the arch
            if y<SPR:
                a=math.degrees(math.atan2(y-SPR,x-125))
                if abs((a+180)%9-4.5)<0.4: FH[y,x]=0.2
            else:
                if (y-SPR)%22==0: FH[y,x]=0.2
FH+=(wn-0.5)*0.5*ring
FR=[(44,40,56),(74,70,90),(106,100,124),(140,134,158),(176,170,192),(214,210,226)]
relief(cv,FH,np.zeros((H,W),np.int32),[FR],ring,k=1.4,bias=0.05)
# ---------- cells ----------
dist=cv2.distanceTransform(win.astype(np.uint8),cv2.DIST_L2,3)
seeds=[(random.randint(X0,X1),random.randint(0,BOT)) for _ in range(150)]
seeds=np.array([s for s in seeds if win[min(H-1,s[1]),min(W-1,s[0])]])
JCX,JCY=125,150
ROSE=(125,50,24)
def cell(x,y):
    d=dist[y,x]
    if d<=7:
        if y<SPR: t=int((math.atan2(y-SPR,x-125)+4)*22)
        else: t=y//8+(1000 if x<125 else 2000)
        return ('b',t)
    rx,ry,rr=ROSE; r=math.hypot(x-rx,y-ry)
    if r<=rr:
        if r<7: return ('rc',0)
        a=(math.atan2(y-ry,x-rx)+math.pi)/(2*math.pi)*12
        return ('rose',int(a)%12, r>16)
    if r<=rr+3: return ('rr',0)
    if 256<=y<=290 and 46<=x<=204: return ('banner',0)
    r2=math.hypot(x-JCX,(y-JCY)*0.9)
    if r2<86 and y<256:
        a=(math.atan2(y-JCY,x-JCX)+math.pi)/(2*math.pi)*28
        return ('ray',int(a),int(r2/22))
    i=int(np.argmin(((seeds-[x,y])**2).sum(1)))
    return ('v',i)
lab=np.full((H,W),-1,np.int64); keys={}
for y in range(H):
    for x in range(W):
        if win[y,x]:
            c=cell(x,y)
            if c not in keys: keys[c]=len(keys)
            lab[y,x]=keys[c]
inv={v:k for k,v in keys.items()}
BLUES=[(40,70,170),(56,100,200),(84,60,166),(34,52,130),(96,136,220),(62,78,186)]
GOLDS=[(255,206,90),(248,172,56),(255,226,140),(250,190,74)]
RUBY=(186,32,64); EMER=(40,150,96); AMETH=(130,50,160)
colmap={}
rng=random.Random(5)
def color_for(i):
    if i in colmap: return colmap[i]
    c=inv[i]; k=c[0]
    if k=='b': col=[RUBY,(44,70,180),(236,190,70),EMER][c[1]%4]
    elif k=='rc': col=(255,222,120)
    elif k=='rose': col=RUBY if (c[1]%2==0)!=c[2] else (50,86,200)
    elif k=='rr': col=(255,200,80)
    elif k=='banner': col=(240,230,204)
    elif k=='ray': col=GOLDS[(c[1]+c[2])%4] if c[2]<3 else [(255,236,160),(248,200,90),(236,160,60)][c[1]%3]
    else:
        sy=seeds[c[1]][1]
        if sy>284: col=rng.choice([EMER,(60,130,60),(36,116,80)])
        elif rng.random()<0.12: col=RUBY
        elif rng.random()<0.1: col=AMETH
        else: col=rng.choice(BLUES)
    colmap[i]=col; return col
# ---------- figure labels (scale3x) ----------
art=[r+r[::-1] for r in JLEFT]
# clear hand-drawn face features; we paint them later
chars=sorted(set(''.join(art)))
cid={ch:i for i,ch in enumerate(chars)}
A=np.array([[cid[ch] for ch in row] for row in art])
for ch in 'EC':
    if ch in cid: A[A==cid[ch]]=cid['F']
A3=scale3x_labels(A)
fh,fw=A3.shape
FX=JCX-fw//2; FY=80
FIG=100000
for y in range(fh):
    for x in range(fw):
        ch=chars[A3[y,x]]
        if ch!='.':
            X,Y=FX+x,FY+y
            if 0<=Y<H and win[Y,X]: lab[Y,X]=FIG+A3[y,x]
# dress pane divisions
for y in range(FY+130,FY+fh-8,22):
    for x in range(fw):
        if chars[A3[y-FY if False else y-FY,x]] in 'Dd' if 0<=y-FY<fh else False: pass
# ---------- shard subdivision of the figure (stained-glass pieces) ----------
srng=np.random.RandomState(77)
fig_mask=lab>=FIG
fys,fxs=np.where(fig_mask)
face_ch=cid['F'] if 'F' in cid else -1
body_pts=[]
while len(body_pts)<95:
    i=srng.randint(len(fys)); y,x=fys[i],fxs[i]
    if lab[y,x]-FIG!=face_ch: body_pts.append((x,y))
body_pts=np.array(body_pts,float)
face_pts=np.array([(FX+fw/2-14,FY+40),(FX+fw/2+14,FY+38),(FX+fw/2,FY+54)],float)
pid=lab.copy()
for y,x in zip(fys,fxs):
    L_=lab[y,x]
    pts=face_pts if L_-FIG==face_ch else body_pts
    k=int(np.argmin(((pts-[x,y])**2).sum(1)))
    pid[y,x]=L_*1000+k+ (500 if L_-FIG==face_ch else 0)
piece_off={}
def poff(p):
    if p not in piece_off: piece_off[p]=srng.uniform(-0.16,0.2)
    return piece_off[p]
# ---------- leads + pane shading ----------
lead=np.zeros((H,W),bool)
for y in range(H):
    for x in range(W):
        if lab[y,x]<0: continue
        for dx,dy in ((1,0),(0,1)):
            X,Y=x+dx,y+dy
            if X<W and Y<H and lab[Y,X]>=0 and pid[Y,X]!=pid[y,x]: lead[y,x]=True
        if not (win[y,x-1] and win[y,x+1] and win[y-1,x] and win[y+1,x]): lead[y,x]=True
# thicker leads around the figure silhouette
for y in range(1,H-1):
    for x in range(1,W-1):
        if lab[y,x]>=FIG:
            for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)):
                if 0<=lab[y+dy,x+dx]<FIG: lead[y,x]=True
# halo ring behind the head
for y in range(FY-20,FY+60):
    for x in range(FX,FX+fw):
        d=math.hypot(x-(FX+fw/2),y-(FY+30))
        if 40.5<=d<42 and lab[y,x]>=0 and lab[y,x]<FIG: lead[y,x]=True
        if 42<=d<46 and lab[y,x]>=0 and lab[y,x]<FIG: lab[y,x]=keys.setdefault(('halo',0),len(keys)); inv[lab[y,x]]=('halo',0); colmap[lab[y,x]]=(255,236,150)
        if 46<=d<47.5 and lab[y,x]>=0 and lab[y,x]<FIG: lead[y,x]=True
ld=cv2.distanceTransform((~lead&win).astype(np.uint8),cv2.DIST_L2,3)
mott=noise(H,W,4,seed=21,octaves=2)
LEAD=(24,20,30); LEADL=(70,66,84)
for y in range(H):
    for x in range(W):
        if not win[y,x]: continue
        if lead[y,x]:
            cv.px(x,y,LEAD if (x+y)%5 else LEADL); continue
        L_=lab[y,x]
        base=JCOL[chars[L_-FIG]] if L_>=FIG else color_for(L_)
        ramp=glass_ramp(base)
        d=ld[y,x]
        if L_>=FIG:
            v=0.5+poff(pid[y,x])+(mott[y,x]-0.5)*0.18-(0.14 if d<1.5 else 0)
        else:
            v=0.25+min(d,6)/6*0.45+(mott[y,x]-0.5)*0.5
        # light glows through the upper-left more
        v+= (0.06 if (x+y)<260 else -0.04)
        n=len(ramp)-1; vv=min(0.999,max(0,v))*n; i=int(vv); f=vv-i
        c=ramp[min(n,i+1)] if f>BAYER4[y%4,x%4] else ramp[i]
        cv.px(x,y,c)
# hairline cracks through some of Johanna's shards
crng=np.random.RandomState(9)
plist=sorted(set(pid[fig_mask&~lead].ravel().tolist()))
for p in crng.choice(plist,26,replace=False):
    ys_,xs_=np.where((pid==p)&~lead)
    if len(ys_)<40: continue
    i=crng.randint(len(ys_)); x,y=float(xs_[i]),float(ys_[i])
    ang=crng.uniform(0,math.pi*2); L=crng.randint(8,20)
    for step in range(L):
        ang+=crng.uniform(-0.6,0.6)
        x+=math.cos(ang); y+=math.sin(ang)
        X,Y=int(round(x)),int(round(y))
        if not (0<=X<W and 0<=Y<H) or pid[Y,X]!=p or lead[Y,X]: break
        base=tuple(int(v) for v in cv.a[Y,X])
        cv.px(X,Y,lerp(base,(30,20,36),0.55))
        if pid[Y-1,X]==p and not lead[Y-1,X]: cv.px(X,Y-1,lerp(tuple(int(v) for v in cv.a[Y-1,X]),(255,255,245),0.45))
        if crng.rand()<0.12:   # small side branch
            bx,by=X,Y; ba=ang+crng.choice([-1.2,1.2])
            for _ in range(crng.randint(2,5)):
                bx+=math.cos(ba); by+=math.sin(ba); BX,BY=int(round(bx)),int(round(by))
                if pid[BY,BX]!=p or lead[BY,BX]: break
                cv.px(BX,BY,lerp(tuple(int(v) for v in cv.a[BY,BX]),(30,20,36),0.45))
# painted details on glass (grisaille lines)
def paint(x,y,c=(40,30,40)):
    if win[y,x] and not lead[y,x]: cv.px(x,y,c)
# ray panes: radial streaks
for k in range(28):
    a=(k+0.5)/28*2*math.pi-math.pi
    for r in range(30,84,1):
        x=int(JCX+math.cos(a)*r); y=int(JCY+math.sin(a)*r/0.9)
        if 0<=y<H and lab[y,x]>=0 and lab[y,x]<FIG and inv[lab[y,x]][0]=='ray' and r%3!=0:
            cv.px(x,y,lerp(tuple(cv.a[y,x]),(255,250,220),0.35))
# ---------- face / hair details (painted) ----------
ox,oy=FX,FY
fcx=ox+fw//2
# eyes (closed, serene) with lashes, brows, blush, nose, lips
EYE=(80,34,40)
for sgn in (-1,1):
    ex=fcx+sgn*10
    for dx in range(-5,6):
        yy=oy+37+int(round(2.0*(1-(dx/5.5)**2)))
        cv.px(ex+dx,yy,EYE)
    cv.px(ex+sgn*6,oy+37,EYE); cv.px(ex+sgn*7,oy+36,EYE)
    for dx in range(-4,5): cv.px(ex+dx,oy+31-(1 if abs(dx)<3 else 0),(160,50,44))
cv.px(fcx,oy+42,(214,160,130)); cv.px(fcx+1,oy+43,(214,160,130))
for dx in range(-3,4): cv.px(fcx+dx,oy+49+(1 if abs(dx)<2 else 0),(196,70,76))
for dx in range(-1,2): cv.px(fcx+dx,oy+51,(236,130,130))
# orb glow
ocx,ocy=fcx,oy+100
for y in range(ocy-26,ocy+27):
    for x in range(ocx-26,ocx+27):
        d=math.hypot(x-ocx,y-ocy)
        if d<24 and win[y,x] and not lead[y,x] and BAYER4[y%4,x%4]<(1-d/24)*0.8:
            cv.px(x,y,lerp(tuple(cv.a[y,x]),(255,250,220),0.45))
# sparkles in glass
for (sx,sy) in [(60,96),(190,92),(56,196),(196,204),(86,70),(168,66)]:
    for k in range(-3,4): paint(sx+k,sy,(255,255,240)); paint(sx,sy+k,(255,255,240))
# ---------- banner text ----------
for t_,yo in (('THE CHURCH',261),('OF THE LIGHT',276)):
    m=text_mask(t_,16); mh,mw=m.shape
    for yy_,xx_ in zip(*np.where(m)):
        cv.px(125-mw//2+xx_+1,yo+yy_+1,(196,170,140)); 
    for yy_,xx_ in zip(*np.where(m)):
        cv.px(125-mw//2+xx_,yo+yy_,(90,28,40))
# ---------- coloured light falling on the sill ----------
SILL_Y=BOT+6
SH=np.zeros((H,W),np.float32); SMk=np.zeros((H,W),bool)
for y in range(BOT+4,BOT+16):
    for x in range(10,240):
        SMk[y,x]=True
        SH[y,x]=3.0 if y<BOT+6 else (2.2 if y<BOT+13 else 0.6)
relief(cv,SH,np.zeros((H,W),np.int32),[FR],SMk,k=1.5)
# warm candle-lit glow on the wall below the sill
for y in range(BOT+16,H):
    for x in range(W):
        d=min(math.hypot(x-40,y-BOT-10),math.hypot(x-212,y-BOT-10))
        if d<50 and BAYER4[y%4,x%4]<(1-d/50)*0.5: cv.px(x,y,lerp(tuple(cv.a[y,x]),(255,180,110),0.25))
# sill shadow
for x in range(10,240):
    for y in range(BOT+16,BOT+19):
        if (x+y)%2==0 or y==BOT+16: cv.px(x,y,(18,16,26))
# candles on the sill
def candle(x,h):
    y1=BOT+5
    for yy in range(y1-h,y1):
        for xx in range(x,x+6):
            c=(244,236,214) if xx<x+3 else (206,196,176)
            if xx==x: c=(255,250,236)
            cv.px(xx,yy,c)
    for k in range(3): cv.px(x+1+k,y1-h+ (k%2),(255,250,236))
    cv.px(x+3,y1-h-1,(50,40,40))
    for (dx,dy,c) in [(3,-2,(255,250,200)),(3,-3,(255,236,140)),(2,-3,(255,200,80)),(4,-3,(255,200,80)),(3,-4,(255,180,70)),(3,-5,(250,120,40)),(3,-6,(220,80,30))]:
        cv.px(x+dx,y1-h+dy,c)
    for dy in range(-16,3):
        for dx in range(-9,15):
            X,Y=x+dx,y1-h+dy
            if 0<=X<W and 0<=Y<H and not win[Y,X] and (dx-3)**2+(dy+4)**2<80 and BAYER4[Y%4,X%4]<0.4:
                cv.px(X,Y,lerp(tuple(cv.a[Y,X]),(255,200,120),0.35))
candle(30,20); candle(40,13); candle(206,15); candle(216,22)
save2(cv,'03_stained_glass')
