from px2 import *
from font35 import text35, width35
import art_barker_back as BB
import art_barker_front as BF
random.seed(1)
W,H=W2,H2
cv=C2((20,16,32))
GB=BB.GB
def rrmask(x0,y0,x1,y1,r,rbr=None):
    rbr=rbr or r
    m=np.zeros((H,W),bool)
    for y in range(max(0,y0),min(H,y1)):
        for x in range(max(0,x0),min(W,x1)):
            ok=True
            for (cx,cy,rr,cond) in ((x0+r,y0+r,r,x<x0+r and y<y0+r),(x1-1-r,y0+r,r,x>x1-1-r and y<y0+r),
                                     (x0+r,y1-1-r,r,x<x0+r and y>y1-1-r),(x1-1-rbr,y1-1-rbr,rbr,x>x1-1-rbr and y>y1-1-rbr)):
                if cond and (x-cx)**2+(y-cy)**2>rr*rr+rr*0.8: ok=False
            m[y,x]=ok
    return m
def fillm(m,c):
    cv.a[m]=c
# ---------- body ----------
BODY=[(56,42,86),(86,68,128),(112,92,158),(126,106,174),(146,128,194),(176,160,220)]
body=rrmask(2,2,W-2,H-2,10,44)
dist=cv2.distanceTransform(np.pad(body.astype(np.uint8),1),cv2.DIST_L2,3)[1:-1,1:-1]
nz=noise(H,W,5,seed=3)
for y in range(H):
    for x in range(W):
        if not body[y,x]: continue
        v=3
        d=dist[y,x]
        # bevel: light top-left, dark bottom-right
        if d<5:
            if x<W/2 and y<H*0.8 and (x<y*0.7+20): v=5 if d<2 else 4
            else: v=1 if d<2 else 2
        if d<1.5: v=0
        # plastic grain
        if 3<=v<=3 and nz[y,x]>0.62 and (x+y)%2==0: v=2
        if v==3 and nz[y,x]<0.35 and (x+y)%2==0: v=4
        cv.px(x,y,BODY[v])
# top ridge
for x in range(14,W-14):
    cv.px(x,10,BODY[1]); cv.px(x,11,BODY[5])
for x in (14,W-15):
    for y in range(3,11): cv.px(x,y,BODY[1])
text35(cv,'<OFF  ON>',30,4,BODY[1])
# ---------- bezel ----------
BZ=[(30,30,46),(46,46,66),(58,58,82),(74,74,100)]
bez=rrmask(18,22,232,200,6,30)
bd=cv2.distanceTransform(np.pad(bez.astype(np.uint8),1),cv2.DIST_L2,3)[1:-1,1:-1]
for y in range(H):
    for x in range(W):
        if bez[y,x]:
            v=2
            if bd[y,x]<1.5: v=0
            elif bd[y,x]<3 and (x>W/2 or y>150): v=1
            elif bd[y,x]<3: v=3
            elif (x+y)%2==0 and y>160: v=1 if BAYER4[y%4,x%4]<(y-160)/60 else 2
            cv.px(x,y,BZ[v])
for x in range(28,222):
    if x<44 or x>206:
        cv.px(x,28,(170,40,96)); cv.px(x,31,(60,80,170))
draw_text(cv,'PIXEL PARTIES',9,125,25,(186,184,214),center=True)
# LED
for y in range(84,96):
    for x in range(22,38):
        d=math.hypot(x-29.5,y-89.5)
        if d<6 and BAYER4[y%4,x%4]<(6-d)/6*0.7: cv.px(x,y,lerp(tuple(cv.a[y,x]),(255,60,80),0.5))
cv.rect(27,87,32,92,(220,30,50)); cv.px(28,88,(255,180,190)); cv.px(29,88,(255,120,130))
text35(cv,'PWR',30,99,(140,140,176),center=True)
# ---------- screen ----------
SX0,SY0,SX1,SY1=42,38,208,186
cv.rect(SX0-2,SY0-2,SX1+2,SY1+2,(16,22,16)); cv.rect(SX0-1,SY0-1,SX1+1,SY1+1,(40,56,36))
cv.rect(SX0,SY0,SX1,SY1,GB[3])
def gbq(rgba, bias=0.0, lo_q=0.03, hi_q=0.97):
    a=rgba.copy(); L=lum(a[...,:3].astype(float)); op=a[...,3]>0
    lo,hi=np.quantile(L[op],[lo_q,hi_q]); v=np.clip((L-lo)/(hi-lo)+bias,0,1)*2.999
    h,w=L.shape
    Bm=BAYER4[np.arange(h)[:,None]%4,np.arange(w)[None,:]%4]
    lev=np.floor(v+(Bm-0.5)*0.9).clip(0,3).astype(int)
    a[...,:3]=np.array(GB)[lev]
    return a
def gpx(x,y,v): 
    if SX0<=x<SX1 and SY0<=y<SY1: cv.px(x,y,GB[v])
def gellipse(cx,cy,rx,ry,v,ring=None):
    for y in range(cy-ry,cy+ry+1):
        for x in range(cx-rx,cx+rx+1):
            d=((x-cx)/rx)**2+((y-cy)/ry)**2
            if d<=1:
                gpx(x,y,v if (ring is None or d<0.75) else ring)
                if d<=1 and v==2 and BAYER4[y%4,x%4]<(1-d)*0.4: gpx(x,y,3)
# ground texture: sparse grass dots
for y in range(SY0,SY1):
    for x in range(SX0,SX1):
        if (x*7+y*13)%97==0: gpx(x,y,2)
# enemy platform + giant
gellipse(170,96,34,7,2,1)
for k in range(-26,27,6): gpx(170+k,96+(k%3)-1,1)
a,_=native2('3-Headed Giant'); gi=np.array(Image.open(os.path.join(HERE,'sprites','giant.png')))
def gbq_plain(rgba,cuts=(0.22,0.5,0.8)):
    a=rgba.copy(); L=lum(a[...,:3].astype(float)); op=a[...,3]>0
    q=np.quantile(L[op],cuts); lev=np.digitize(L,q)
    a[...,:3]=np.array(GB)[lev]; return a
def gbq_classes(rgba):
    # map by colour class so the outer heads' red eyes / white horns stay readable
    a=rgba.copy(); op=a[...,3]>0
    rgb=a[...,:3].astype(int); r,g,b=rgb[...,0],rgb[...,1],rgb[...,2]
    L=lum(rgb.astype(float)); sat=rgb.max(-1)-rgb.min(-1)
    skin=op&(sat<=90)&(L>=70)&(L<=175)
    med=np.median(L[skin]) if skin.any() else 110
    lev=np.full(L.shape,1)
    lev[skin&(L>=med)]=2
    lev[op&(L<60)]=0
    lev[op&(L>175)&(sat<60)]=3          # horns / claws / tusks
    lev[op&(r>g+45)&(r>b+30)]=0         # red eyes -> darkest
    a[...,:3]=np.array(GB)[lev]
    # eyes: add a light glint so they read as eyes, not holes
    return a
gq=gbq_classes(gi)
# retouch the three heads so each reads clearly: outlined face, light skin, dark eyes, small mouth
def head(cx,cy,rx,ry):
    for y in range(int(cy-ry)-1,int(cy+ry)+2):
        for x in range(int(cx-rx)-1,int(cx+rx)+2):
            if not(0<=y<gq.shape[0] and 0<=x<gq.shape[1]): continue
            d=((x-cx)/rx)**2+((y-cy)/ry)**2
            if d<=1.0:
                lv=2 if y>cy-ry+1 else 3
                if d>0.62: lv=0
                gq[y,x,:3]=GB[lv]; gq[y,x,3]=255
    for ex in (int(round(cx-1.5)),int(round(cx+1.5))):
        gq[int(cy),ex,:3]=GB[0]
    gq[int(cy)+2,int(cx),:3]=GB[1]; gq[int(cy)+2,int(cx)+ (1 if rx>3 else 0),:3]=GB[1]
head(9.5,9.2,3.3,3.3); head(26.5,9.2,3.3,3.3); head(18,5.6,3.4,3.0)
g4=scale2x(outline(gq,GB[0]))
cv.paste(g4,170-g4.shape[1]//2,98-g4.shape[0]+1)
# player platform
gellipse(88,148,40,7,2,1)
bb=scale2x(BF.to_rgba(BF.build(),GB))
cv.paste(bb,62,150-bb.shape[0])
# ---------- HUDs ----------
def hpbar(x,y,w,frac):
    for i in range(w):
        gpx(x+i,y,0); gpx(x+i,y+4,0)
    for j in range(5): gpx(x,y+j,0); gpx(x+w-1,y+j,0)
    for i in range(1,w-1):
        for j in range(1,4):
            gpx(x+i,y+j,1 if i<(w-2)*frac else 3)
    for i in range(1,int((w-2)*frac)): gpx(x+i,y+1,2)
def gtext(t,x,y,size=9,v=0):
    m=text_mask(t,size)
    ys,xs=np.where(m)
    for yy,xx in zip(ys,xs): gpx(x+xx,y+yy,v)
    return m.shape[1]
gtext('3-HEADED GIANT',48,44)
gtext(':L50',60,56)
text35(cv,'HP',50,65,GB[0]); hpbar(60,65,58,0.85)
for x in range(48,126): gpx(x,72,0)
for y in range(56,73): gpx(48,y,0)
gpx(126,72,0); gpx(127,71,0); gpx(128,70,0)
PX=150; PY=104
gtext('BARKER',PX,PY)
gtext(':L42',PX+20,PY+11)
text35(cv,'HP',PX,PY+22,GB[0]); hpbar(PX+10,PY+22,44,0.72)
gtext('87/120',PX+10,PY+30)
for x in range(PX-4,PX+56): gpx(x,PY+41,0)
for y in range(PY+18,PY+42): gpx(PX+55,y,0)
gpx(PX-5,PY+40,0); gpx(PX-6,PY+39,0)
# ---------- text box ----------
TY=150
for y in range(TY,SY1):
    for x in range(SX0,SX1): gpx(x,y,3)
for (i,v) in [(0,0),(1,3),(2,0),(3,3)]:
    for x in range(SX0+i,SX1-i): gpx(x,TY+i,v); gpx(x,SY1-1-i,v)
    for y in range(TY+i,SY1-i): gpx(SX0+i,y,v); gpx(SX1-1-i,y,v)
gtext('A wild 3-HEADED GIANT',SX0+8,TY+8)
gtext('appeared!',SX0+8,TY+21)
for i,w in enumerate([4,3,2,1]):
    for k in range(-w+1,w): gpx(SX1-14+k,SY1-13+i,0)
# screen glass glare
for k in range(26):
    x=SX1-40+k; y=SY0+2+k//2
for y in range(SY0,SY1):
    for x in range(SX0,SX1):
        if 0<(x-SX0)-(y-SY0)*0.9-110<3 and y<SY0+30: cv.px(x,y,lerp(tuple(cv.a[y,x]),(255,255,255),0.18))
# ---------- logo ----------
wa=text_mask('PIXEL',16).shape[1]; wb=text_mask('POCKET',16).shape[1]
x0=125-(wa+wb+8)//2
draw_text(cv,'PIXEL',16,x0,208,(36,40,120),shadow=(1,1,BODY[1]))
draw_text(cv,'POCKET',16,x0+wa+8,208,(214,40,120),shadow=(1,1,BODY[1]))
text35(cv,'TM',x0+wa+wb+10,208,BODY[1])
# ---------- D-pad ----------
DX,DY=60,262
# recess
for y in range(DY-30,DY+31):
    for x in range(DX-30,DX+31):
        d=math.hypot(x-DX,y-DY)
        if d<28: cv.px(x,y,BODY[2] if d>26 else (BODY[2] if BAYER4[y%4,x%4]<(d-20)/8 else tuple(cv.a[y,x])))
DP=[(20,20,28),(36,36,46),(56,56,70),(84,84,100)]
arm,wid=24,9
for y in range(DY-arm,DY+arm+1):
    for x in range(DX-arm,DX+arm+1):
        if abs(x-DX)<=wid or abs(y-DY)<=wid:
            if abs(x-DX)<=arm and abs(y-DY)<=arm and (abs(x-DX)<=wid or abs(y-DY)<=wid):
                v=1
                ex=min(arm-abs(x-DX) if abs(y-DY)<=wid else 99, arm-abs(y-DY) if abs(x-DX)<=wid else 99)
                cv.px(x,y,DP[v])
# bevels
for y in range(DY-arm,DY+arm+1):
    for x in range(DX-arm,DX+arm+1):
        if tuple(cv.a[y,x])==DP[1]:
            up=tuple(cv.a[y-1,x])!=DP[1] and tuple(cv.a[y-1,x]) not in DP
            lf=tuple(cv.a[y,x-1]) not in DP
            dn=tuple(cv.a[y+1,x]) not in DP; rt=tuple(cv.a[y,x+1]) not in DP
            if up or lf: cv.px(x,y,DP[3])
            elif dn or rt: cv.px(x,y,DP[0])
# drop shadow of dpad
for y in range(DY-arm,DY+arm+3):
    for x in range(DX-arm,DX+arm+3):
        if tuple(cv.a[y,x]) not in DP and tuple(cv.a[y-2,x-2]) in DP[1:] and (x+y)%2==0: cv.px(x,y,BODY[1])
# center dimple + arrows
for y in range(DY-4,DY+5):
    for x in range(DX-4,DX+5):
        d=math.hypot(x-DX,y-DY)
        if d<4.5: cv.px(x,y,DP[0] if (x-DX)+(y-DY)<0 else DP[2])
for i in range(4):
    for j in range(-i,i+1):
        cv.px(DX+j,DY-19+i,DP[3]); cv.px(DX+j,DY+19-i,DP[2]); cv.px(DX-19+i,DY+j,DP[3]); cv.px(DX+19-i,DY+j,DP[2])
# ---------- A/B ----------
# slanted recess plate
plate=np.zeros((H,W),bool)
for y in range(H):
    for x in range(W):
        # capsule between (176,270) and (214,250)
        ax,ay,bx_,by_=176,272,214,252
        t=np.clip(((x-ax)*(bx_-ax)+(y-ay)*(by_-ay))/((bx_-ax)**2+(by_-ay)**2),0,1)
        px_,py_=ax+t*(bx_-ax),ay+t*(by_-ay)
        if math.hypot(x-px_,y-py_)<19: plate[y,x]=True
for y in range(H):
    for x in range(W):
        if plate[y,x]:
            e=not(plate[y-1,x] and plate[y+1,x] and plate[y,x-1] and plate[y,x+1])
            cv.px(x,y,BODY[1] if e else BODY[2])
BT=[(92,14,50),(150,24,82),(204,40,114),(236,90,154),(255,176,210)]
def button(cx,cy,lab):
    for y in range(cy-14,cy+15):
        for x in range(cx-14,cx+15):
            d=math.hypot(x-cx,y-cy)
            if d<=12.5:
                dd=math.hypot(x-(cx-4),y-(cy-4))
                v=2
                if dd<6: v=3
                if dd<2.5: v=4
                if d>10.5 and (x-cx)+(y-cy)>2: v=1
                if d>11.8: v=0
                if v==2 and dd<9 and BAYER4[y%4,x%4]<0.4: v=3
                cv.px(x,y,BT[v])
            elif d<=14 and (x-cx)+(y-cy)>4 and (x+y)%2==0: cv.px(x,y,BODY[1])
    draw_text(cv,lab,9,cx+10,cy+14,(52,40,96))
button(176,272,'B'); button(214,252,'A')
# ---------- start/select ----------
def pill(cx,cy,lab):
    for y in range(cy-5,cy+6):
        for x in range(cx-14,cx+15):
            # slanted capsule
            u=(x-cx)*0.94+(y-cy)*0.34; v=-(x-cx)*0.34+(y-cy)*0.94
            if abs(v)<=3.5 and (abs(u)<=9 or (abs(u)-9)**2+v*v<=12):
                cv.px(x,y,(64,60,86) if v<1 else (40,38,58))
                if v<-2: cv.px(x,y,(100,96,124))
    text35(cv,lab,cx+2,cy+9,(52,40,96),center=True)
pill(98,318,'SELECT'); pill(142,318,'START')
# ---------- speaker ----------
for k in range(6):
    for t in range(34):
        x=184+k*8+t//3; y=338-t
        if body[y,x]:
            cv.px(x,y,BODY[0]); cv.px(x+1,y,BODY[1]); cv.px(x-1,y,BODY[4])
save2(cv,'01_pixel_pocket')
