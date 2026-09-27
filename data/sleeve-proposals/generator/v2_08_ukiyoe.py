from px2 import *
from font35 import text35, width35
random.seed(12)
W,H=W2,H2
PAPER=[(214,196,160),(228,212,176),(238,224,192),(246,236,210)]
cv=C2(PAPER[2])
pn=noise(H,W,3,seed=1,octaves=2); fib=noise(H,W,1,seed=2,octaves=1)
for y in range(H):
    for x in range(W):
        v=pn[y,x]
        c=PAPER[2]
        if v<0.35 and BAYER4[y%4,x%4]<(0.35-v)*4: c=PAPER[1]
        if v>0.68 and BAYER4[y%4,x%4]<(v-0.68)*4: c=PAPER[3]
        if fib[y,x]>0.93: c=PAPER[1]
        cv.px(x,y,c)
# bokashi indigo at top
IND=[(30,40,84),(44,60,110),(64,84,138),(100,118,164),(150,158,184)]
for y in range(0,70):
    for x in range(W):
        t=y/70
        v=(1-t)**1.3*4.2
        i=int(v); f=v-i
        if i>=4: c=IND[0]
        else:
            idx=4-i
            c=IND[max(0,idx-1)] if f>BAYER4[y%4,x%4] else (IND[idx] if idx<5 else None)
            if idx>=4 and f<=BAYER4[y%4,x%4]: c=None
        if c: cv.px(x,y,c)
# ---------- sun ----------
SCX,SCY,SR=125,128,70
SUN=[(178,34,30),(204,50,38),(222,66,46),(236,92,60)]
sn=noise(H,W,6,seed=4)
for y in range(SCY-SR,SCY+SR+1):
    for x in range(SCX-SR,SCX+SR+1):
        d=math.hypot(x-SCX,y-SCY)
        if d<=SR:
            v=2
            if sn[y,x]>0.62 and BAYER4[y%4,x%4]<0.5: v=3
            if sn[y,x]<0.35 and BAYER4[y%4,x%4]<0.5: v=1
            if d>SR-3: v=1 if (x+y)%2 else 0
            cv.px(x,y,SUN[v])
# ---------- Fuji + mountains ----------
MT=[(40,56,100),(58,78,124),(80,100,146),(110,130,170)]
SNOW=[(200,206,220),(232,234,240),(250,250,252)]
for x in range(W):
    peak=abs(x-52)
    top=int(186+peak*0.72) if peak<9 else int(186+6+ (peak-9)*0.8)
    top2=int(214+abs(x-198)*0.55)
    for y in range(min(top,top2),262):
        ontop=top<=top2
        c=MT[1] if ontop else MT[2]
        # light side left, shadow right
        if ontop and x>52 and BAYER4[y%4,x%4]<0.6: c=MT[0]
        if not ontop and x>198 and BAYER4[y%4,x%4]<0.5: c=MT[1]
        # snow cap with ridges
        if ontop and y<200+int(4*abs(math.sin(x*0.45)))+ (0 if peak<22 else -40):
            c=SNOW[1] if x<=52 else SNOW[0]
            if (x-52)%7==0 and x>40: c=MT[1]
        cv.px(x,y,c)
# kasumi mist bands (stylized, outlined)
MISTC=[(244,236,214),(226,214,190)]; MO=(170,130,110)
def kasumi(x0,x1,y,h):
    for x in range(x0-h,x1+h):
        for yy_ in range(y,y+h):
            k=yy_-y
            dx=int(math.sqrt(max(0,(h/2)**2-(k-h/2+0.5)**2)))
            if x0-dx<=x<x1+dx:
                c=MISTC[0] if k<h-2 else MISTC[1]
                cv.px(x,yy_,c)
    for x in range(x0,x1): cv.px(x,y-1,MO); cv.px(x,y+h,MO)
    for k in range(h+2):
        dx=int(math.sqrt(max(0,(h/2+1)**2-(k-h/2-0.5)**2)))
        cv.px(x0-dx,y-1+k,MO); cv.px(x1+dx,y-1+k,MO)
kasumi(10,96,208,8); kasumi(150,240,228,7); kasumi(80,150,176,5)
# near hills with pines
HL=[(34,70,52),(46,92,64),(62,116,78),(86,140,92)]
for x in range(W):
    hy=int(252+7*math.sin(x*0.05+1)+4*math.sin(x*0.17))
    for y in range(hy,300):
        c=HL[1]
        if (x*3+y*5)%11==0: c=HL[0]
        if y<hy+2: c=HL[3]
        elif y<hy+4 and (x+y)%2: c=HL[2]
        cv.px(x,y,c)
def pine(x,y,h):
    for k in range(h):
        w=int((k/h)*6)+1
        for dx in range(-w,w+1):
            X,Y=x+dx,y-h+k
            c=HL[0] if dx>0 else HL[1]
            if k%5==0 and abs(dx)>=w-1: c=HL[2]
            cv.px(X,Y,c)
    cv.rect(x-1,y,x+2,y+4,(70,46,30))
for (x,y,h) in [(14,262,26),(28,258,20),(226,260,28),(238,266,18),(200,266,16)]: pine(x,y,h)
# ---------- rock (relief) ----------
RH=np.zeros((H,W),np.float32); RM=np.zeros((H,W),bool)
for y in range(266,312):
    t=(y-266)/46
    hw=44+t*30+4*math.sin(y*0.4)
    for x in range(int(125-hw),int(125+hw)):
        RM[y,x]=True
        RH[y,x]=min(x-(125-hw),125+hw-x,(y-266)*1.5)*0.12
RH+=(noise(H,W,5,seed=7,octaves=3)-0.5)*2.2
ROCK=[(40,36,40),(66,60,64),(96,88,90),(128,120,118),(164,156,150)]
relief(cv,RH,np.zeros((H,W),np.int32),[ROCK],RM,k=1.4,bias=-0.02)
for x in range(60,190):
    for y in range(266,270):
        if RM[y,x] and (x*7+y)%5<2: cv.px(x,y,HL[2])
# ---------- fox (procedural letter map) ----------
Lm=np.full((H,W),'.',dtype='<U1')
def ell(cx,cy,rx,ry,ch,keep=None):
    for y in range(int(cy-ry)-1,int(cy+ry)+2):
        for x in range(int(cx-rx)-1,int(cx+rx)+2):
            if 0<=x<W and 0<=y<H and ((x-cx)/rx)**2+((y-cy)/ry)**2<=1 and (keep is None or Lm[y,x] in keep): Lm[y,x]=ch
def poly(pts,ch):
    mk=np.zeros((H,W),np.uint8); cv2.fillPoly(mk,[np.array(pts,np.int32)],1); Lm[mk>0]=ch
def bez(p0,p1,p2,t): return ((1-t)**2*p0[0]+2*(1-t)*t*p1[0]+t*t*p2[0],(1-t)**2*p0[1]+2*(1-t)*t*p1[1]+t*t*p2[1])
def stroke(p0,p1,p2,wfun,ch,tmin=0,tmax=1):
    for t in np.linspace(tmin,tmax,500):
        x,y=bez(p0,p1,p2,t); w=wfun(t)
        ell(x,y,w,w,ch)
HIP=(125,244)
TAILS=[(HIP,(150,176),(150,84)),(HIP,(64,236),(44,150)),(HIP,(186,236),(206,150))]
def tw(t): return 3+17*(t**0.75)*(1 if t<0.82 else max(0.25,1-(t-0.82)/0.18*0.75))
tails_pts=[]
for i,(p0,p1,p2) in enumerate(TAILS):
    stroke(p0,p1,p2,tw,'T')
    stroke(p0,p1,p2,tw,'F',0.74,1.0)
    tails_pts.append((p0,p1,p2))
# separate tails with outline where they overlap: draw outlines per tail later via ring
tm=np.isin(Lm,['T','F'])
ring=(cv2.dilate(tm.astype(np.uint8),np.ones((3,3),np.uint8))>0)&~tm
Lm[ring]='K'
# body parts
bodyL=np.full((H,W),'.',dtype='<U1'); saveL=Lm; Lm=bodyL
poly([(110,198),(140,198),(147,230),(142,262),(108,262),(103,230)],'W')
# legs + feet
for lx in (111,139):
    poly([(lx-8,250),(lx+8,250),(lx+7,272),(lx-7,272)],'W')
    ell(lx,275,9,5,'D')
# arms + paws
for s in (-1,1):
    for t in np.linspace(0,1,60):
        x=125+s*(22+6*t); y=204+t*34; ell(x,y,7,7,'W')
    ell(125+s*28,242,7,6,'D')
# chest fluff
poly([(110,200),(140,200),(137,212),(131,208),(128,220),(122,208),(118,216),(113,208)],'M')
# head + cheek tufts
ell(125,176,31,24,'W')
for s in (-1,1):
    poly([(125+s*24,176),(125+s*38,190),(125+s*30,188),(125+s*34,198),(125+s*20,194)],'W')
# muzzle
ell(125,190,10,8,'M')
# ears
for s in (-1,1):
    poly([(125+s*8,160),(125+s*30,122),(125+s*30,166)],'W')
    poly([(125+s*14,160),(125+s*28,132),(125+s*27,160)],'P')
bm=(bodyL!='.')
# outline around body, and between body parts
out=(cv2.dilate(bm.astype(np.uint8),np.ones((3,3),np.uint8))>0)&~bm
Lm=saveL
Lm[bm]=bodyL[bm]; Lm[out]='K'
# internal separations (arms vs torso, legs, paws)
for y in range(1,H-1):
    for x in range(1,W-1):
        if Lm[y,x]=='W' and Lm[y,x+1]=='D' or Lm[y,x]=='D' and Lm[y-1,x]=='W': pass
FUR=[(116,108,138),(168,162,188),(210,206,224),(236,234,244),(252,252,255)]
MUZ=[(170,166,190),(216,214,230),(244,244,250),(255,255,255)]
PINK=[(140,60,84),(196,98,124),(232,146,164),(250,196,206)]
PAW=[(70,60,90),(100,90,124),(134,126,160),(168,160,192)]
TFUR=[(126,118,148),(176,170,196),(218,214,230),(242,240,248),(255,255,255)]
mats={'W':dict(ramp=FUR,pillow=7,k=1.3),
      'M':dict(ramp=MUZ,pillow=4,k=1.0,bias=0.08),
      'P':dict(ramp=PINK,pillow=3,k=1.2),
      'D':dict(ramp=PAW,pillow=3,k=1.3),
      'T':dict(ramp=TFUR,pillow=9,k=1.4),
      'F':dict(ramp=[(236,120,50),(250,170,60),(255,220,110)],pillow=4,k=0.8)}
fox=render_regions(Lm,mats,outline_col=(58,34,48),thin=False)
cv.paste(fox,0,0)
# fur strands on tails (along tangent) and body
for (p0,p1,p2) in tails_pts:
    for t in np.linspace(0.08,0.74,70):
        x,y=bez(p0,p1,p2,t); x2,y2=bez(p0,p1,p2,min(1,t+0.02))
        tx,ty=x2-x,y2-y; tl=math.hypot(tx,ty); tx,ty=tx/tl,ty/tl; nx,ny=-ty,tx
        w=tw(t)
        for k in range(-2,3):
            off=k*w/3.2+random.uniform(-1.5,1.5)
            sx,sy=x+nx*off,y+ny*off
            for r in range(5):
                X,Y=int(sx+tx*r+nx*r*0.3*(1 if k>0 else -1)),int(sy+ty*r)
                if 0<=X<W and 0<=Y<H and Lm[Y,X]=='T':
                    cv.px(X,Y,TFUR[1] if (k>0) else TFUR[2])
for _ in range(90):
    x,y=random.randint(96,154),random.randint(155,262)
    if Lm[y,x]=='W' and Lm[y+3,x]=='W':
        for r in range(3): cv.px(x+(r if x>125 else -r)//2,y+r,FUR[1])
# face: eyes, markings, nose, mouth
EYE=(24,16,30)
for sg in (-1,1):
    ex=125+sg*14; ey=177
    for dx in range(-4,5):
        for dy in range(-4,5):
            if dx*dx+dy*dy<=12: cv.px(ex+dx,ey+dy,EYE)
    cv.px(ex-1,ey-2,(255,255,255)); cv.px(ex-2,ey-2,(255,255,255)); cv.px(ex-2,ey-1,(230,230,250)); cv.px(ex+2,ey+2,(120,110,150))
    # red eyeliner flick at outer corner (upward = gentle)
    for k in range(6): cv.px(ex+sg*(4+k),ey-1-k//2,(214,44,40))
    for k in range(4): cv.px(ex+sg*(4+k),ey-k//2,(236,90,70))
    for dx in range(4):
        for dy in range(2):
            if (dx+dy)%2==0: cv.px(125+sg*23+dx-2,186+dy,(250,160,176))
# forehead mark (small flame drop)
for dy in range(-6,1):
    w=max(0,1-abs(dy+2)//3)
    for dx in range(-w,w+1): cv.px(125+dx,163+dy,(214,44,40))
cv.px(125,164,(236,90,70))
# nose + smiling mouth
cv.rect(123,187,128,190,(40,26,36)); cv.px(124,187,(120,100,120))
cv.px(125,190,(40,26,36))
for dx,dy in [(-4,191),(-3,192),(-2,192),(-1,191),(1,191),(2,192),(3,192),(4,191)]: cv.px(125+dx,dy,(40,26,36))
# fire engulfing tail tips
FIRE=[(110,14,10),(176,30,16),(226,70,26),(250,130,40),(255,196,80),(255,244,200)]
fn=noise(H,W,3,seed=31,octaves=2)
for (p0,p1,p2) in tails_pts:
    tx,ty=bez(p0,p1,p2,0.88)
    for y in range(int(ty-78),int(ty+30)):
        for x in range(int(tx-44),int(tx+44)):
            if not (0<=x<W and 0<=y<H): continue
            rx,ry=x-tx,y-ty
            along=-ry; perp=rx
            if along<-26: continue
            t=(along+26)/100
            wid=(24*(1-t)**0.6)*(0.8+0.3*math.sin(along*0.28+perp*0.15))+(fn[y,x]-0.5)*14
            if abs(perp)<wid and t<1:
                v=(1-abs(perp)/max(1,wid))**0.8*(1-t*0.75)+(fn[y,x]-0.5)*0.35
                v=max(0,min(0.999,v))*6; i=int(v); f=v-i
                c=FIRE[min(5,i+1)] if f>BAYER4[y%4,x%4] else FIRE[i]
                if i==0 and f<0.5 and (x+y)%2: continue
                cv.px(x,y,c)
    for k in range(18):
        ex,ey=int(tx+random.randint(-34,34)),int(ty-random.randint(50,100))
        if 0<=ex<W and 0<=ey<H: cv.px(ex,ey,random.choice(FIRE[3:])); 
# ---------- sakura branch (top-left) ----------
BR=[(52,30,26),(80,48,38),(116,74,56)]
def limb(p0,p1,w):
    n=int(max(abs(p1[0]-p0[0]),abs(p1[1]-p0[1])))+1
    for i in range(n):
        t=i/max(1,n-1); x=p0[0]+(p1[0]-p0[0])*t; y=p0[1]+(p1[1]-p0[1])*t
        ww=w*(1-t*0.4)
        for k in range(-int(ww),int(ww)+1):
            c=BR[2] if k<-ww*0.3 else (BR[1] if k<ww*0.5 else BR[0])
            if (int(x)+int(y)+k)%7==0: c=BR[0]
            cv.px(int(x),int(y+k),c)
pts=[(-6,64),(20,54),(46,50),(72,40),(98,36),(124,26),(150,24)]
for i in range(len(pts)-1): limb(pts[i],pts[i+1],max(1,5-i))
for (a,b,w) in [((46,50),(58,70),2),((72,40),(78,18),2),((98,36),(114,52),2),((20,54),(12,34),2),((124,26),(134,8),1),((58,70),(70,78),1)]:
    limb(a,b,w)
PK=[(206,96,130),(236,150,176),(250,196,212),(255,232,240)]
def blossom(x,y,s=1):
    for k in range(5):
        a=k/5*2*math.pi-math.pi/2
        px_,py_=x+math.cos(a)*2.4,y+math.sin(a)*2.4
        for dy in range(-2,2):
            for dx in range(-2,2):
                if (dx+0.5)**2+(dy+0.5)**2<=3.2: cv.px(int(px_+dx),int(py_+dy),PK[2] if dy<0 else PK[1])
        cv.px(int(x+math.cos(a)*3.6),int(y+math.sin(a)*3.6),PK[0])
    cv.px(x,y,(250,220,110)); cv.px(x+1,y,(230,170,80)); cv.px(x,y-1,PK[3])
for (x,y) in [(18,48),(30,58),(42,44),(56,62),(60,40),(70,74),(76,20),(84,34),(96,30),(110,48),(116,22),(130,12),(136,26),(150,20),(10,34),(26,40),(66,50),(102,40)]:
    blossom(x,y)
# petals falling
for _ in range(40):
    x,y=random.randint(4,246),random.randint(70,300)
    cv.px(x,y,PK[1]); cv.px(x+1,y,PK[2]); cv.px(x,y+1,PK[0])
# ---------- seigaiha waves ----------
WV=[(26,36,80),(44,62,116),(96,120,170),(236,230,214)]
Y0=306
for y in range(Y0,H):
    for x in range(W): cv.px(x,y,WV[0])
Rw=12
for j,cy in enumerate(range(Y0+6,H+Rw,6)):
    for cx in range(-Rw+(j%2)*Rw,W+Rw,2*Rw):
        for y in range(cy-Rw,cy+1):
            for x in range(cx-Rw,cx+Rw+1):
                d=math.hypot(x-cx,y-cy)
                if d<=Rw and 0<=x<W and Y0<=y<H:
                    ring_=int(d)%4
                    c=[WV[3],WV[2],WV[1],WV[1]][ring_]
                    if d>Rw-1: c=WV[0]
                    cv.px(x,y,c)
for x in range(W):
    cv.px(x,Y0,WV[3]); 
    if (x//3)%2: cv.px(x,Y0-1,WV[3])
# ---------- cartouche + hanko ----------
CX0,CY0,CX1,CY1=8,160,34,256
cv.rect(CX0-1,CY0-1,CX1+1,CY1+1,(110,30,30)); cv.rect(CX0,CY0,CX1,CY1,(246,236,210)); cv.rect(CX0+2,CY0+2,CX1-2,CY1-2,(176,48,40)); cv.rect(CX0+3,CY0+3,CX1-3,CY1-3,(246,236,210))
for i,ch in enumerate('KITSUNE'):
    m=text_mask(ch,12); ys,xs=np.where(m)
    for yy_,xx_ in zip(ys,xs): cv.px(21-m.shape[1]//2+xx_,CY0+8+i*13+yy_,(40,30,50))
HX,HY=10,262
cv.rect(HX,HY,HX+22,HY+22,(196,40,40)); cv.rect(HX+2,HY+2,HX+20,HY+20,(226,70,56)); cv.rect(HX+3,HY+3,HX+19,HY+19,(196,40,40))
m=text_mask('PP',9); ys,xs=np.where(m)
for yy_,xx_ in zip(ys,xs): cv.px(HX+11-m.shape[1]//2+xx_,HY+7+yy_,(250,232,214))
save2(cv,'08_ukiyoe_kitsune')
