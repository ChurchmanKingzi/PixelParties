from px2 import *
from font35 import text35, width35
random.seed(10)
W,H=W2,H2
cv=C2((70,44,100))
# ---------- wallpaper ----------
WP=[(62,40,96),(74,50,112),(86,60,126),(100,74,142)]
for y in range(0,236):
    for x in range(W):
        st=(x//10)%2
        c=WP[1] if st else WP[2]
        # small diamond motif in the lighter stripes
        if not st and ((x%10)-5)**2+((y%14)-7)**2<=3: c=WP[3]
        if x%10==0: c=WP[0]
        cv.px(x,y,c)
# warm light falloff (dither) + disco spots on the wall
for y in range(0,236):
    for x in range(W):
        d=math.hypot(x-125,y-70)
        if d>110 and BAYER4[y%4,x%4]<min(0.6,(d-110)/180): cv.px(x,y,lerp(tuple(cv.a[y,x]),(30,16,50),0.4))
SPOTC=[(255,240,180),(180,220,255),(255,180,220)]
for _ in range(36):
    x,y=random.randint(4,246),random.randint(60,230); c=random.choice(SPOTC)
    cv.rect(x,y,x+3,y+2,lerp(tuple(cv.a[y,x]),c,0.6)); cv.px(x+1,y,lerp(c,(255,255,255),0.5))
# ---------- wainscoting (relief) ----------
WH=np.zeros((H,W),np.float32); WMk=np.zeros((H,W),bool)
for y in range(236,272):
    for x in range(W):
        WMk[y,x]=True
        px_=x%42; e=min(px_-4,37-px_,y-242,266-y)
        WH[y,x]=2.0 if y<240 else (0.4+min(max(e,0),3)*0.5 if e>=0 else 1.2)
WOOD=[(52,28,18),(86,50,30),(122,76,44),(160,108,64),(196,142,88)]
relief(cv,WH,np.zeros((H,W),np.int32),[WOOD],WMk,k=1.3)
# ---------- floor (planks) ----------
for y in range(272,H):
    row=(y-272)//8; ly=(y-272)%8
    for x in range(W):
        off=(row*37)%60
        bx=(x+off)%60
        c=WOOD[3] if row%2 else WOOD[2]
        g=math.sin(x*0.15+row*2+math.sin(x*0.05)*2)
        if g>0.7: c=WOOD[min(4,WOOD.index(c)+1)] if (x+y)%2 else c
        if ly==0: c=WOOD[1]
        elif ly==1: c=WOOD[4] if c==WOOD[3] else WOOD[3]
        if bx==0: c=WOOD[0]
        cv.px(x,y,c)
# floor reflection of disco light
for y in range(272,H):
    for x in range(60,190):
        d=((x-125)/65)**2+((y-300)/22)**2
        if d<1 and BAYER4[y%4,x%4]<(1-d)*0.35: cv.px(x,y,lerp(tuple(cv.a[y,x]),(255,230,190),0.3))
# ---------- bunting ----------
FLAGS=[(255,90,110),(255,200,70),(90,210,140),(90,170,255),(200,120,255)]
def bunting(x0,x1,y0,sag,off=0):
    for x in range(x0,x1+1):
        t=(x-x0)/(x1-x0); y=int(y0+sag*4*t*(1-t)); cv.px(x,y,(250,246,236)); cv.px(x,y+1,(180,170,190))
    for i,xx in enumerate(range(x0+4,x1-8,12)):
        t=(xx-x0)/(x1-x0); y=int(y0+sag*4*t*(1-t))+2
        c=FLAGS[(i+off)%len(FLAGS)]; cd=tuple(int(v*0.75) for v in c); cl=lerp(c,(255,255,255),0.4)
        for k in range(12):
            w=5-k*5//12
            for dx in range(-w,w+1):
                cc=c if dx<w-1 else cd
                if dx<-w+2 and k<6: cc=cl
                cv.px(xx+dx+5,y+k,cc)
bunting(-4,128,4,16); bunting(122,254,4,16,2)
# ---------- banner ----------
BX0,BX1,BY0,BY1=38,212,32,58
BN=[(180,150,120),(226,206,170),(248,236,210),(255,250,236)]
for y in range(BY0,BY1):
    for x in range(BX0,BX1):
        v=2
        if y==BY0 or y==BY1-1: v=0
        elif y<BY0+2: v=3
        elif (x+y)%2==0 and y>BY1-4: v=1
        cv.px(x,y,BN[v])
for (sx,dr) in [(BX0,-1),(BX1-1,1)]:
    for k in range(14):
        for y in range(BY0+3+k//3,BY1-3-k//3):
            cv.px(sx+dr*(k+1),y,(200,50,90) if k<12 else (150,30,70))
cols=[(240,70,100),(250,150,40),(230,190,30),(60,180,100),(50,140,230),(150,90,230)]
txt='PIXEL PARTIES'
m=text_mask(txt,14); mh,mw=m.shape
x0=125-mw//2
colidx=np.cumsum(np.r_[0,(m.any(0)[1:]&~m.any(0)[:-1])])
for yy,xx in zip(*np.where(m)):
    c=cols[colidx[xx]%len(cols)]
    cv.px(x0+xx+1,BY0+6+yy+1,tuple(int(v*0.5) for v in c)); cv.px(x0+xx,BY0+6+yy,c)
for x in range(BX0+3,BX1-3,3): cv.px(x,BY0+3,(236,120,150)); cv.px(x,BY1-4,(236,120,150))
# ---------- balloons ----------
def balloon(cx,cy,c,L=40,rx=11,ry=14):
    cd=tuple(int(v*0.62) for v in c); cm=tuple(int(v*0.82) for v in c); cl=lerp(c,(255,255,255),0.45)
    for y in range(cy-ry,cy+ry+1):
        for x in range(cx-rx,cx+rx+1):
            d=((x-cx)/rx)**2+((y-cy)/ry)**2
            if d<=1:
                sh=(x-cx)/rx*0.6+(y-cy)/ry*0.8
                col=c
                if sh>0.35: col=cm if BAYER4[y%4,x%4]<(sh-0.35)*3 else c
                if sh>0.7: col=cd
                if sh<-0.5 and BAYER4[y%4,x%4]<0.5: col=cl
                cv.px(x,y,col)
    cv.rect(cx-5,cy-9,cx-2,cy-5,(255,255,255)); cv.px(cx-6,cy-7,cl)
    for k in range(-2,3): cv.px(cx+k,cy+ry+1,cd)
    cv.px(cx,cy+ry+2,cd)
    for k in range(L):
        cv.px(cx+int(2*math.sin(k*0.35)),cy+ry+3+k,(236,232,240))
balloon(20,96,(240,70,100),60); balloon(44,80,(250,190,50),70); balloon(230,94,(70,170,250),60); balloon(206,76,(120,210,110),72); balloon(12,140,(170,100,240),30,9,12)
# ---------- disco ball ----------
DX,DY,DR=125,86,14
for k in range(DY-DR-18,DY-DR): cv.px(DX,k,(200,200,210))
for y in range(DY-DR,DY+DR+1):
    for x in range(DX-DR,DX+DR+1):
        d=math.hypot(x-DX,y-DY)
        if d<=DR:
            fx=((x-DX)+DR)//4; fy=((y-DY)+DR)//4
            base=(170,176,200) if (fx+fy)%2 else (130,136,166)
            sh=(x-DX)/DR*0.6+(y-DY)/DR*0.8
            if sh>0.4: base=tuple(int(v*0.72) for v in base)
            if (x-DX)%4==0 or (y-DY)%4==0: base=tuple(int(v*0.8) for v in base)
            if sh<-0.55 and (fx+fy)%3==0: base=(250,252,255)
            cv.px(x,y,base)
for (sx,sy) in [(DX-6,DY-7),(DX+3,DY-10),(DX-9,DY+2)]:
    for k in range(-3,4): cv.px(sx+k,sy,(255,255,255)); cv.px(sx,sy+k,(255,255,255))
# ---------- characters (adapted & integrated) ----------
def load(k): return np.array(Image.open(f'sprites/{k}.png')).copy()
OUTC=(46,22,54)
def integrate(a):
    s=quant_colors(a,14); s=scale2x(s)
    s=shade_pass(s,light=(-0.3,-0.9),strength=0.22,ambient=(255,214,170),amb_k=0.08,rim=(255,236,210))
    L=lum(s[...,:3].astype(float)); dark=(L<42)&(s[...,3]>0)
    s[dark,:3]=OUTC
    return outline(s,OUTC)
def floor_shadow(cx,y,w):
    for yy in range(y-2,y+3):
        for xx in range(cx-w,cx+w+1):
            if ((xx-cx)/w)**2+((yy-y)/2.6)**2<=1 and (xx+yy)%2==0: cv.px(xx,yy,WOOD[1])
def party_hat(x,y,c1,c2,h=18):
    for k in range(h):
        w=k*6//h
        for dx in range(-w,w+1):
            c=c1 if ((k//3)+(1 if dx>0 else 0))%2==0 else c2
            if dx==w: c=tuple(int(v*0.7) for v in c)
            if dx<=-w+1 and k>2: c=lerp(c,(255,255,255),0.3)
            cv.px(x+dx,y+k,c)
    for dx in range(-7,8): cv.px(x+dx,y+h,OUTC) if abs(dx)>=6 else None
    for (dx,dy) in [(0,-1),(-1,-2),(1,-2),(0,-3),(-2,-1),(2,-1),(0,-2)]:
        cv.px(x+dx,y+dy,(255,240,140))
    cv.px(x,y-2,(255,255,255))
def top_of(s):
    ys,xs=np.where(s[...,3]>0); t=ys.min(); return t,int(xs[ys==t].mean())
inya=load('inya'); inya[:,16:,3]=0; inya[:,:1,3]=0
IN=integrate(inya)
tobi=integrate(load('tobi')); maho=integrate(load('maho')); willy=integrate(load('willy')); corgi=integrate(load('corgi'))
# Inya behind the table (right of cake)
ix,iy=172,238-IN.shape[0]+12
cv.paste(IN,ix,iy); t,tx=top_of(IN); party_hat(ix+tx,iy+t-16,(255,90,110),(255,244,236))
# ---------- table + cake ----------
TX0,TX1,TY=62,196,236
TC=np.zeros((H,W),np.float32); TMk=np.zeros((H,W),bool)
for y in range(TY,TY+34):
    for x in range(TX0-4,TX1+5):
        TMk[y,x]=True
        TC[y,x]=(2.5 if y<TY+4 else 1.0)+0.9*math.sin((x-TX0)*0.35)*(1 if y>=TY+4 else 0)
CLOTH=[(170,120,150),(214,170,196),(240,210,226),(255,240,248)]
relief(cv,TC,np.zeros((H,W),np.int32),[CLOTH],TMk,k=1.2,bias=0.05)
for x in range(TX0-4,TX1+5):
    y=TY+33+int(2*abs(math.sin((x-TX0)*0.35)))
    cv.px(x,y,CLOTH[0]); cv.px(x,y-1,CLOTH[1])
    if x%8==0: cv.px(x,y+1,(230,90,120)); cv.px(x,y+2,(230,90,120))
for lx in (TX0+6,TX1-10):
    cv.rect(lx,TY+34,lx+5,272,WOOD[1]); cv.rect(lx,TY+34,lx+2,272,WOOD[2])
# cake
CK=[(170,110,70),(214,156,104),(240,196,140),(252,226,180)]
ICE=[(210,90,140),(246,150,190),(255,196,220),(255,236,244)]
WICE=[(200,190,210),(226,220,232),(242,238,248),(255,255,255)]
def tier(cx,y,w,h,ice):
    for yy in range(y,y+h):
        for xx in range(cx-w//2,cx+w//2+1):
            sh=(xx-cx)/(w/2)
            c=CK[2]
            if sh>0.55: c=CK[1] if BAYER4[yy%4,xx%4]<(sh-0.55)*3 else CK[2]
            if sh>0.85: c=CK[0]
            if sh<-0.6: c=CK[3]
            if (yy-y)%7==5: c=CK[1]
            cv.px(xx,yy,c)
    for xx in range(cx-w//2,cx+w//2+1):
        drip=3+int(3*abs(math.sin(xx*0.7)))+(3 if xx%9==0 else 0)
        for k in range(drip):
            sh=(xx-cx)/(w/2)
            c=ice[2] if k<2 else ice[1]
            if sh>0.6: c=ice[0] if k>1 else ice[1]
            if sh<-0.5 and k<2: c=ice[3]
            cv.px(xx,y+k,c)
    # sprinkles
    for k in range(w//3):
        sx=cx-w//2+3+random.randint(0,w-6); sy=y+5+random.randint(0,h-8)
        cv.px(sx,sy,random.choice([(255,80,120),(80,180,255),(255,220,60),(120,220,120)]))
CX=125
tier(CX,208,76,28,ICE); tier(CX,184,56,26,WICE); tier(CX,164,38,22,ICE)
# candles
for i,cx_ in enumerate([CX-12,CX,CX+12]):
    c=[(90,170,255),(255,200,60),(150,230,120)][i]
    for yy in range(150,164):
        cv.px(cx_,yy,c); cv.px(cx_+1,yy,tuple(int(v*0.8) for v in c)); 
        if yy%4==0: cv.px(cx_,yy,(255,255,255))
    for (dx,dy,cc) in [(0,-1,(255,250,200)),(1,-1,(255,220,120)),(0,-2,(255,200,90)),(1,-2,(255,170,60)),(0,-3,(255,150,50)),(0,-4,(240,100,40))]:
        cv.px(cx_+dx,150+dy,cc)
# presents + cupcakes on the table
def gift(x,y,w,h,c,rib):
    cd=tuple(int(v*0.7) for v in c); cl=lerp(c,(255,255,255),0.35)
    cv.rect(x,y,x+w,y+h,c); cv.rect(x+w-3,y,x+w,y+h,cd); cv.rect(x,y,x+2,y+h,cl)
    cv.rect(x+w//2-1,y,x+w//2+2,y+h,rib); cv.rect(x,y+h//3,x+w,y+h//3+2,rib)
    for (dx,dy) in [(-4,-3),(-3,-4),(-2,-3),(-1,-2),(1,-2),(2,-3),(3,-4),(4,-3),(-3,-2),(3,-2)]: cv.px(x+w//2+dx,y+dy,rib)
gift(66,216,20,20,(80,160,250),(255,236,110)); gift(88,222,14,14,(250,90,120),(255,255,255)); gift(160,220,16,16,(130,220,120),(240,80,120))
# ---------- characters in front ----------
def stand(s,x,ybot,hat=None,flip=False):
    floor_shadow(x+s.shape[1]//2,ybot,s.shape[1]//2-2)
    cv.paste(s,x,ybot-s.shape[0],flip=flip)
    if hat:
        t,tx=top_of(s if not flip else s[:,::-1])
        party_hat(x+tx+hat[2],ybot-s.shape[0]+t-15+hat[3],hat[0],hat[1])
stand(willy,10,330)
stand(maho,58,338,((90,170,255),(255,255,255),0,4))
stand(corgi,114,342)
stand(tobi,154,336,((150,230,120),(255,240,120),0,3))
gift(200,300,28,28,(250,90,120),(255,236,110)); gift(206,284,18,16,(90,170,255),(255,255,255)); gift(230,314,16,16,(130,220,120),(255,255,255))
# party horn for tobi
for k in range(12):
    X=154-k+46*0; X=154-k; Y=304-k//4
    cv.px(X,Y,(255,90,110) if (k//2)%2 else (255,240,120)); cv.px(X,Y+1,(200,60,90) if (k//2)%2 else (220,200,90))
for (dx,dy) in [(-13,-4),(-14,-3),(-14,-2),(-13,-1)]: cv.px(154+dx,304+dy,(90,170,255))
# bow on corgi
cv.rect(125,307,130,311,(240,70,110)); cv.px(124,308,(240,70,110)); cv.px(131,308,(240,70,110)); cv.px(127,309,(255,160,190))
# ---------- confetti & streamers ----------
CF=[(255,90,110),(255,200,70),(90,210,140),(90,170,255),(200,120,255),(255,255,255)]
for _ in range(140):
    x,y=random.randint(0,W-1),random.randint(10,H-4)
    c=random.choice(CF); k=random.random()
    if k<0.4: cv.px(x,y,c)
    elif k<0.8: cv.px(x,y,c); cv.px(x+1,y,tuple(int(v*0.75) for v in c))
    else: cv.px(x,y,c); cv.px(x,y+1,tuple(int(v*0.75) for v in c))
for (x0,c) in [(30,(255,90,110)),(220,(90,170,255)),(96,(255,200,70))]:
    for y in range(0,40):
        cv.px(x0+int(4*math.sin(y*0.4)),y,c); cv.px(x0+1+int(4*math.sin(y*0.4)),y,tuple(int(v*0.7) for v in c))
save2(cv,'10_pixel_party')
