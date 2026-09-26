from px2 import *
from font35 import text35, width35
import skelking2 as SK2
random.seed(5)
W,H=W2,H2
cv=C2((16,10,24))
AX0,AY0,AX1,AY1=16,42,234,302
# ---------- sky ----------
dither_gradient(cv,AX0,AY0,AX1,AY1,[(10,10,34),(22,18,58),(44,26,84),(76,40,104),(104,56,112)])
for _ in range(120):
    x=random.randint(AX0,AX1-1); y=random.randint(AY0,AY0+150)
    c=random.choice([(255,255,255),(200,200,255),(255,240,210),(150,150,210)])
    cv.px(x,y,c)
    if random.random()<0.1:
        for (dx,dy) in [(1,0),(-1,0),(0,1),(0,-1)]: cv.px(x+dx,y+dy,lerp(c,(30,20,60),0.5))
# ---------- moon (relief) ----------
MCX,MCY,MR=125,112,64
Hm=np.zeros((H,W),np.float32); Mm=np.zeros((H,W),bool)
yy,xx=np.indices((H,W))
d=np.hypot(xx-MCX,yy-MCY)
Mm=d<=MR
Hm=np.where(Mm,np.sqrt(np.maximum(0,MR*MR-d*d))*0.05,0).astype(np.float32)
for (cx,cy,r) in [(98,86,11),(146,132,14),(112,140,7),(152,88,6),(90,120,6),(130,100,4),(160,110,5),(108,70,4)]:
    dd=np.hypot(xx-cx,yy-cy)
    Hm-=np.where(dd<r,0.9*np.sqrt(np.maximum(0,1-(dd/r)**2)),0)
    Hm+=np.where((dd>=r)&(dd<r+2),0.35,0)
Hm+=(noise(H,W,4,seed=3)-0.5)*0.4
MOON=[(120,110,120),(170,160,160),(212,204,190),(236,230,210),(252,248,232)]
relief(cv,Hm,np.zeros((H,W),np.int32),[MOON],Mm,k=2.0,bias=0.08)
for y in range(MCY-MR-10,MCY+MR+11):
    for x in range(MCX-MR-10,MCX+MR+11):
        dd=math.hypot(x-MCX,y-MCY)
        if MR<dd<MR+10 and AY0<=y<AY1 and BAYER4[y%4,x%4]<(1-(dd-MR)/10)*0.55:
            cv.px(x,y,lerp(tuple(cv.a[y,x]),(236,230,210),0.3))
# clouds across moon
def cloud_band(y0,x0,x1,col,col2):
    for x in range(x0,x1):
        top=y0+int(3*math.sin(x*0.13)+2*math.sin(x*0.31))
        for y in range(top,top+6):
            c=col if y<top+2 else col2
            if y==top+5 and (x+y)%2: continue
            cv.px(x,y,c)
cloud_band(150,16,120,(150,120,170),(100,74,130)); cloud_band(162,110,234,(130,100,156),(86,60,116)); cloud_band(84,160,234,(120,94,150),(80,56,110))
# ---------- graveyard ----------
SIL=(18,12,26); SIL2=(30,20,40)
for x in range(AX0,AX1):
    hgt=int(250+5*math.sin(x*0.05)+4*math.sin(x*0.17))
    for y in range(hgt,AY1): cv.px(x,y,SIL2 if y<hgt+3 else SIL)
# tombstones relief
TH=np.zeros((H,W),np.float32); TM=np.zeros((H,W),bool)
def tomb(x,y,w,h,kind):
    for yy_ in range(y-h,y):
        for xx_ in range(x,x+w):
            ok=True
            if kind=='round' and yy_<y-h+w//2 and (xx_-(x+w/2-0.5))**2+(yy_-(y-h+w//2))**2>(w/2)**2: ok=False
            if kind=='cross':
                ok=abs(xx_-(x+w/2-0.5))<=2 or (y-h+5<=yy_<=y-h+9)
            if ok:
                TM[yy_,xx_]=True
                e=min(xx_-x,x+w-1-xx_,yy_-(y-h),y-1-yy_)
                TH[yy_,xx_]=min(e,3)*0.6
for (x,y,w,h,k) in [(24,262,16,26,'round'),(46,258,12,30,'cross'),(186,260,18,24,'round'),(210,262,14,32,'cross'),(170,266,11,16,'round'),(64,268,10,14,'round')]:
    tomb(x,y,w,h,k)
TH+=(noise(H,W,3,seed=6)-0.5)*0.5
TST=[(24,20,34),(46,40,60),(72,66,90),(104,98,124),(140,134,160)]
relief(cv,TH,np.zeros((H,W),np.int32),[TST],TM,k=1.5,bias=-0.05)
# dead trees
def branch(x,y,ang,L,w,depth=0):
    for i in range(L):
        X=int(x+math.cos(ang)*i); Y=int(y+math.sin(ang)*i)
        for k in range(w): cv.px(X+k,Y,SIL)
        if w>1: cv.px(X+w,Y,(60,46,80))  # moon rim light
    ex,ey=int(x+math.cos(ang)*L),int(y+math.sin(ang)*L)
    if depth<3 and L>6:
        branch(ex,ey,ang-0.5,int(L*0.65),max(1,w-1),depth+1)
        branch(ex,ey,ang+0.45,int(L*0.6),max(1,w-1),depth+1)
branch(30,258,-1.45,42,4); branch(222,256,-1.7,38,3)
# fog
fn=noise(H,W,10,seed=9,octaves=2)
for y in range(236,AY1):
    for x in range(AX0,AX1):
        t=(y-236)/(AY1-236)
        if fn[y,x]>0.5 and BAYER4[y%4,x%4]<(fn[y,x]-0.5)*2.2*t+0.05:
            cv.px(x,y,lerp(tuple(cv.a[y,x]),(150,130,180),0.45))
# ---------- aura behind king ----------
for y in range(AY0,AY1):
    for x in range(AX0,AX1):
        dd=math.hypot((x-125)*1.3,(y-190)*0.8)
        if dd<95 and BAYER4[y%4,x%4]<(1-dd/95)*0.35:
            cv.px(x,y,lerp(tuple(cv.a[y,x]),(150,60,200),0.3))
# ---------- king ----------
_bg=cv.a.copy()
king=SK2.build_rgba(props=False)
kh,kw=king.shape[:2]
KX,KY=125-kw//2,AY1-kh+2
cv.paste(king,KX,KY)
# paint-overs (in king coordinates *3 of design)
def kp(x,y,c): cv.px(KX+x,KY+y,c)
# cape gold trim along lining edge
for y in range(kh):
    for x in range(kw):
        if king[y,x,3] and tuple(king[y,x,:3]) in [tuple(c) for c in SK2.LINE] and (y%6==0):
            if x+3<kw and tuple(king[y,x+3,:3]) in [tuple(c) for c in SK2.CAPE]:
                kp(x+2,y,SK2.GOLD[3]); kp(x+2,y+1,SK2.GOLD[2])
            if x-3>=0 and tuple(king[y,x-3,:3]) in [tuple(c) for c in SK2.CAPE]:
                kp(x-2,y,SK2.GOLD[3]); kp(x-2,y+1,SK2.GOLD[2])
# ---------- detailed parts (drawn at full resolution) ----------
import detail_skull_king as DK
DK.draw_all(cv,KX,KY)
# symmetry: copy the left half of the figure (only pixels the figure pass changed) onto the right half
_drawn=cv.a.copy(); _chg=np.any(_drawn!=_bg,axis=2)
for y in range(H):
    for x in range(125,KX+kw+2):
        xm=249-x
        if 0<=xm<W:
            if _chg[y,xm]: cv.a[y,x]=_drawn[y,xm]
            elif _chg[y,x]: cv.a[y,x]=_bg[y,x]
# ---------- soul wisps ----------
def wisp(x,y,s=1):
    F=[(220,255,245),(120,236,214),(50,170,176),(30,100,120)]
    shape=["..0..",".010.","01210","12321",".232.","..3.."," .3.."]
    for j,r in enumerate(shape):
        for i,ch in enumerate(r):
            if ch.isdigit():
                for sy in range(s):
                    for sx in range(s): cv.px(x+i*s+sx,y+j*s+sy,F[int(ch)])
for (x,y,s) in [(40,190,2),(200,200,2),(52,120,1),(196,128,1),(30,236,1),(214,236,1)]: wisp(x,y,s)
# ---------- skull bats ----------
BAT=["W...............W",
     "WW.............WW",
     "WBW...........WBW",
     ".WBBW..SSS..WBBW.",
     ".WBBBWSSSSSWBBBW.",
     "..WBBBSXSXSBBBW..",
     "..WBBBSRSRSBBBW..",
     "...WBBSSSSSBBW...",
     "...WB.SXSXS.BW...",
     "....W..SSS..W....",
     "........S........"]
def bat(x,y,flip=False):
    col={'W':(120,80,150),'B':(56,30,72),'S':(236,228,206),'X':(26,16,30),'R':(255,70,60)}
    for j,r in enumerate(BAT):
        for i,ch in enumerate(r):
            if ch in col:
                X=x+(len(r)-1-i if flip else i)
                cv.px(X,y+j,col[ch])
for (x,y,f) in [(26,56,False),(196,50,True),(206,164,False),(22,150,True),(170,70,False)]: bat(x,y,f)
# ---------- ornate frame (relief) ----------
FH=np.zeros((H,W),np.float32); FMk=np.zeros((H,W),bool)
for y in range(H):
    for x in range(W):
        e=min(x,W-1-x,y,H-1-y)
        if e<12: FMk[y,x]=True; FH[y,x]=[0,1.5,2.5,3,2.6,1.8,1.0,1.2,2.2,2.6,1.8,0.6][e]
# panel border
for y in range(AY0-4,AY1+4):
    for x in range(AX0-4,AX1+4):
        e=min(x-(AX0-4),AX1+3-x,y-(AY0-4),AY1+3-y)
        if 0<=e<4: FMk[y,x]=True; FH[y,x]=[1.0,2.4,2.4,1.0][e]
# plates
def plate(x0,y0,x1,y1):
    for y in range(y0,y1):
        for x in range(x0,x1):
            e=min(x-x0,x1-1-x,y-y0,y1-1-y)
            FMk[y,x]=True
            FH[y,x]=[0.8,2.2,2.6,2.0][e] if e<4 else -9
plate(70,8,180,40); plate(30,304,220,342)
# corner filigree: spirals
for (cx,cy,sx,sy) in [(14,14,1,1),(W-15,14,-1,1),(14,H-15,1,-1),(W-15,H-15,-1,-1)]:
    for t in np.linspace(0,3.5*math.pi,140):
        r=12*(1-t/(4*math.pi))
        x=int(cx+sx*(6+math.cos(t)*r)); y=int(cy+sy*(6+math.sin(t)*r))
        for dx in range(2):
            FMk[y,x+dx]=True; FH[y,x+dx]=2.8
GOLD=SK2.GOLD
PLATEC=[(24,12,30),(34,18,42),(46,26,56)]
Mplate=(FH==-9)
FMk2=FMk&~Mplate
relief(cv,FH,np.zeros((H,W),np.int32),[GOLD],FMk2,k=1.3,bias=0.02)
for y,x in zip(*np.where(Mplate)): cv.px(x,y,PLATEC[1] if (x+y)%2 else PLATEC[0])
# embossed gold text
def gold_text(t,size,cx,cy):
    m=text_mask(t,size); mh,mw=m.shape
    y=int(round(cy-mh/2))
    x0=cx-mw//2
    TH2=np.zeros((H,W),np.float32); TM2=np.zeros((H,W),bool)
    mm=np.pad(m,1)
    dist_=cv2.distanceTransform(mm.astype(np.uint8),cv2.DIST_L2,3)[1:-1,1:-1]
    for yy_ in range(mh):
        for xx_ in range(mw):
            if m[yy_,xx_]:
                TM2[y+yy_,x0+xx_]=True; TH2[y+yy_,x0+xx_]=min(dist_[yy_,xx_],2.5)
    # drop shadow
    for yy_ in range(mh):
        for xx_ in range(mw):
            if m[yy_,xx_]: cv.px(x0+xx_+1,y+yy_+2,(8,4,10))
    relief(cv,TH2,np.zeros((H,W),np.int32),[GOLD],TM2,k=1.2,bias=0.12,blur=0.4)
gold_text('XIII',24,125,24)
gold_text('DEATH',24,125,323)
# plate ornaments: small skulls
def tiny_skull(x,y):
    S=[".###.","#####","#.#.#","#####",".#.#."]
    for j,r in enumerate(S):
        for i,ch in enumerate(r):
            if ch=='#': cv.px(x+i,y+j,(236,228,206))
            elif j==2: cv.px(x+i,y+j,(200,40,40))
tiny_skull(78,21); tiny_skull(167,21); tiny_skull(38,320); tiny_skull(207,320)
save2(cv,'05_tarot_skeleton_king')
