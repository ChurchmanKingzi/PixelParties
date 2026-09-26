# Doom Clock - v3 (from scratch): monumental Aztec sun-stone clock, eclipse, magma cracks
from px2 import *
random.seed(90)
W,H=W2,H2
cv=C2((10,2,6))
CX,CY,R=125,146,104
yy,xx=np.indices((H,W)); DIST=np.hypot(xx-CX,yy-CY); ANG=(np.degrees(np.arctan2(yy-CY,xx-CX))+90)%360
# ---------------- sky (violet, diagonal streaks like the card art) ----------------
dither_gradient(cv,0,0,W,H,[(14,8,34),(34,18,70),(62,30,104),(92,44,126),(70,30,96),(40,16,58)])
sn=noise(H,W,8,seed=5,octaves=2)
for y in range(H):
    for x in range(W):
        st=math.sin((x+y*0.55)*0.09+sn[y,x]*5)
        if st>0.8 and BAYER4[y%4,x%4]<(st-0.8)*3: cv.px(x,y,lerp(tuple(cv.a[y,x]),(150,100,190),0.35))
        elif st<-0.85 and BAYER4[y%4,x%4]<0.5: cv.px(x,y,lerp(tuple(cv.a[y,x]),(10,6,26),0.35))
for _ in range(90):
    x,y=random.randint(0,W-1),random.randint(0,140); cv.px(x,y,random.choice([(255,230,255),(190,160,230),(255,255,255)]))
# eclipse corona behind the stone: bright thin ring + soft falloff
cn=noise(H,W,5,seed=3,octaves=2)
RAMP=[(70,14,60),(150,30,70),(220,60,80),(255,140,120),(255,230,220)]
for y in range(H):
    for x in range(W):
        d=DIST[y,x]
        if R-2<d<R+30:
            a=math.atan2(y-CY,x-CX)
            s_=0.8+0.2*math.sin(a*13)+(cn[y,x]-0.5)*0.3
            f=max(0,1-(d-R)/30)**2.2*s_
            if f>0.05:
                v=min(0.999,f)*5; i=int(v); fr=v-i
                c=RAMP[min(4,i+1)] if fr>BAYER4[y%4,x%4] else RAMP[i]
                if i==0 and (x+y)%2: continue
                cv.px(x,y,c)
# long streamers
for k in range(40):
    a=k/40*2*math.pi+0.05; L=R+36+random.randint(0,46)
    for r in range(R+14,L):
        f=(1-(r-R-14)/(L-R-14))**1.5
        x=int(CX+math.cos(a)*r); y=int(CY+math.sin(a)*r)
        if 0<=x<W and 0<=y<H and BAYER4[y%4,x%4]<f*0.6: cv.px(x,y,(255,170,160) if f>0.6 else ((220,60,90) if f>0.3 else (120,30,80)))
# ash / embers in the sky
for _ in range(80):
    x,y=random.randint(0,W-1),random.randint(0,H-1)
    if DIST[y,x]>R+4: cv.px(x,y,random.choice([(255,120,120),(255,200,200),(110,60,120)]))
# ---------------- the Doom Clock (as on the card) ----------------
M=DIST<=R+0.5
Hm=np.zeros((H,W),np.float32); Mt=np.zeros((H,W),np.int32)
RIM0=80
# iron rim: bevelled outer edge, flat band, raised inner lip
rim=(DIST>=RIM0)&M
t=(DIST-RIM0)/(R-RIM0)
Hm[rim]=(2.2+1.4*np.sin(np.clip(t,0,1)*math.pi)**0.6)[rim]
lip=(DIST>=RIM0)&(DIST<RIM0+4)
Hm[lip]=3.6
# hammered texture + scratches
Hm+=(noise(H,W,2,seed=31,octaves=2)-0.5)*0.55*rim
# rivets (between counter sockets)
for k in range(20):
    ang=math.radians(k*18-90)
    rx_,ry_=CX+math.cos(ang)*(R-6),CY+math.sin(ang)*(R-6)
    d_=np.hypot(xx-rx_,yy-ry_)
    Hm[d_<2.6]=(4.6-d_[d_<2.6]*0.6)
# counter sockets (20): recessed holes, gems added later
SOCK=[]
for k in range(20):
    ang=math.radians(k*18+9-90)
    sx_,sy_=CX+math.cos(ang)*(R-13),CY+math.sin(ang)*(R-13)
    SOCK.append((sx_,sy_))
    d_=np.hypot(xx-sx_,yy-sy_)
    Hm[d_<4.6]=1.0; Hm[(d_>=4.6)&(d_<5.6)]=3.4
Mt[rim]=0
# face: wine-red, engraved spiral, darker toward the rim
face=DIST<RIM0
Hm[face]=1.0
th=np.arctan2(yy-CY,xx-CX)
spiral=np.abs(((DIST-th*5.2/(math.pi))%10.4)-5.2)
groove=face&(spiral<0.9)&(DIST>12)&(DIST<RIM0-12)
Hm[groove]=0.45
Hm+=(noise(H,W,3,seed=33,octaves=2)-0.5)*0.35*face
# minute track ring with ticks
trk=face&(DIST>=RIM0-10)&(DIST<RIM0-7)
Hm[trk]=0.3
for m_ in range(60):
    ang=math.radians(m_*6-90)
    for r_ in np.arange(RIM0-10,RIM0-6.5,0.5):
        X,Y=int(round(CX+math.cos(ang)*r_)),int(round(CY+math.sin(ang)*r_))
        Hm[Y,X]=1.6 if m_%5 else 2.2
Mt[face]=1
IRON=[(14,12,20),(30,28,40),(50,48,64),(76,74,94),(108,106,128),(150,148,170),(196,196,214)]
WINE=[(40,10,18),(70,20,30),(100,36,44),(130,56,62),(160,82,86),(190,112,112)]
relief(cv,Hm,Mt,[IRON,WINE],M,k=1.4,bias=0.0,albedo=np.where(face,-0.18*np.clip(DIST/RIM0,0,1)**2,0))
# outer dark edge
ringm=(DIST>R+0.5)&(DIST<=R+2)
for y,x in zip(*np.where(ringm)): cv.px(x,y,(8,4,12))
# doom counters: 19 lit, the 20th still dark
GEMR=[(60,6,14),(140,14,28),(220,40,50),(255,120,110),(255,230,220)]
for k,(sx_,sy_) in enumerate(SOCK):
    lit=k<19
    for y in range(int(sy_)-8,int(sy_)+9):
        for x in range(int(sx_)-8,int(sx_)+9):
            d_=math.hypot(x-sx_,y-sy_)
            if d_<3.8:
                if lit:
                    t_=0.55-0.35*(x-sx_)/3.8-0.35*(y-sy_)/3.8
                    cv.px(x,y,GEMR[max(0,min(4,int(t_*5+(BAYER4[y%4,x%4]-0.5)*0.8)))])
                else:
                    cv.px(x,y,(20,14,22) if d_<3 else (40,34,46))
            elif lit and d_<8 and BAYER4[y%4,x%4]<(1-d_/8)*0.4:
                cv.px(x,y,lerp(tuple(cv.a[y,x]),(255,60,60),0.35))
    if lit: cv.px(int(sx_)-1,int(sy_)-1,(255,240,235))
# hour markers: skulls at 12/3/6/9, silver studs elsewhere
SKULL=["...######...",
       "..########..",
       ".##########.",
       "############",
       "###..##..###",
       "##.RR##RR.##",
       "##.RR##RR.##",
       "###..##..###",
       ".####..####.",
       "..########..",
       "..#.#.#.#.#.",
       "..#########.",
       "...#.#.#.#.."]
BONE=[(60,46,44),(120,104,96),(180,166,154),(222,214,202),(248,244,236)]
def skull(cx,cy):
    h_=len(SKULL); w_=len(SKULL[0])
    m_=np.zeros((h_+2,w_+2),bool)
    for j,r_ in enumerate(SKULL):
        for i,ch in enumerate(r_):
            X,Y=int(cx-w_/2+i),int(cy-h_/2+j)
            if ch=='#':
                t_=0.78-0.05*(i-w_/2)-0.04*(j-h_/2)
                cv.px(X,Y,BONE[max(0,min(4,int(t_*5+(BAYER4[Y%4,X%4]-0.5)*0.9)))]); m_[j+1,i+1]=True
            elif ch=='R': cv.px(X,Y,(255,60,50) if (i+j)%2 else (255,170,150)); m_[j+1,i+1]=True
            elif 4<=j<=7 and 2<=i<=9: cv.px(X,Y,(24,8,12)); m_[j+1,i+1]=True
    ring_=(cv2.dilate(m_.astype(np.uint8),np.ones((3,3),np.uint8))>0)&~m_
    for j,i in zip(*np.where(ring_)): cv.px(int(cx-w_/2+i-1),int(cy-h_/2+j-1),(16,6,10))
    # glow from the eyes
    for (ex,ey) in [(cx-2.5,cy-0.5),(cx+2.5,cy-0.5)]:
        for y in range(int(ey)-6,int(ey)+7):
            for x in range(int(ex)-6,int(ex)+7):
                d_=math.hypot(x-ex,y-ey)
                if 2.5<d_<6 and BAYER4[y%4,x%4]<(1-d_/6)*0.35: cv.px(x,y,lerp(tuple(cv.a[y,x]),(255,60,50),0.3))
SILV=[(60,62,78),(120,124,144),(180,184,204),(230,234,246),(255,255,255)]
for h in range(12):
    ang=math.radians(h*30-90)
    hx,hy=CX+math.cos(ang)*(RIM0-22),CY+math.sin(ang)*(RIM0-22)
    if h%3==0: skull(hx,hy)
    else:
        for y in range(int(hy)-3,int(hy)+4):
            for x in range(int(hx)-3,int(hx)+4):
                e=max(abs(x-hx),abs(y-hy))
                if e<=2.6:
                    t_=0.6-0.12*(x-hx)-0.12*(y-hy)
                    cv.px(x,y,SILV[max(0,min(4,int(t_*5)))])
                elif e<=3.6: cv.px(x,y,(20,8,14))
# silver hands (9:00 like the card)
def shand(ang_deg,L,w0):
    a=math.radians(ang_deg-90); ux,uy=math.cos(a),math.sin(a); nx,ny=-uy,ux
    for r_ in np.arange(-6,L,0.5):
        w=w0 if r_<L-8 else w0*(L-r_)/8+0.4
        for s_ in np.arange(-w-1,w+1.1,0.5):
            X=int(round(CX+ux*r_+nx*s_+2)); Y=int(round(CY+uy*r_+ny*s_+3))
            if (X+Y)%2==0: cv.px(X,Y,lerp(tuple(cv.a[Y,X]),(10,2,8),0.55))
    for r_ in np.arange(-6,L,0.5):
        w=w0 if r_<L-8 else w0*(L-r_)/8+0.4
        for s_ in np.arange(-w-1,w+1.1,0.5):
            X=int(round(CX+ux*r_+nx*s_)); Y=int(round(CY+uy*r_+ny*s_))
            if abs(s_)>w: cv.px(X,Y,(16,8,14)); continue
            t_=0.7-0.35*s_/max(0.5,w)
            c=SILV[max(0,min(4,int(t_*5)))]
            cv.px(X,Y,c)
    # ornamental loop in the middle of the hand
    mx,my=CX+ux*L*0.55,CY+uy*L*0.55
    for y in range(int(my)-4,int(my)+5):
        for x in range(int(mx)-4,int(mx)+5):
            d_=math.hypot(x-mx,y-my)
            if 2.2<d_<3.6: cv.px(x,y,SILV[3] if (x-mx)+(y-my)<0 else SILV[1])
            elif d_<=2.2: cv.px(x,y,WINE[1])
shand(0,RIM0-30,1.6)     # minute hand -> 12
shand(-90,RIM0-34,2.2)   # hour hand -> 9
# centre pivot: small skull like on the card
skull(CX,CY+1)
# ---------------- temple platform ----------------
TOP=250
PH=np.zeros((H,W),np.float32); PM=np.zeros((H,W),np.int32); PMk=np.zeros((H,W),bool)
for (y0,h,hw) in [(TOP,16,70),(TOP+16,16,96),(TOP+32,16,124)]:
    for y in range(y0,min(H,y0+h)):
        for x in range(max(0,CX-hw),min(W,CX+hw)):
            PMk[y,x]=True; ly=y-y0
            if ly<3: PH[y,x]=3-ly*0.4; continue
            row=(ly-3)//6; off=(row%2)*8; bx=(x-(CX-hw)+off)%16; by=(ly-3)%6
            e=min(bx,15-bx,by,5-by); PH[y,x]=0.5+min(e,2)*0.6 if e>0 else 0.05
# fret (step-meander) frieze on the middle tier
for y in range(TOP+20,TOP+28):
    for x in range(CX-90,CX+90):
        u=(x-(CX-90))%16; v=y-(TOP+20)
        fret=(v in (0,7)) or (u in (0,1) and v<6) or (v==3 and 1<u<10) or (u in (9,10) and 3<=v<=7)
        PH[y,x]=2.2 if fret else 0.6; PM[y,x]=1 if fret else 0
PH+=(noise(H,W,3,seed=12,octaves=2)-0.5)*0.4*PMk
PST=[(34,16,10),(64,36,22),(100,64,40),(144,100,64),(186,142,96),(220,182,132)]
PTQ=[(10,50,50),(24,100,96),(52,160,146),(120,220,196)]
relief(cv,PH,PM,[PST,PTQ],PMk,k=1.3,bias=-0.04)
# braziers
def brazier(x,y):
    BR=[(30,16,10),(70,44,28),(120,80,50),(170,120,74)]
    for yy_ in range(y-14,y):
        t=(yy_-(y-14))/14; hw=int(11-t*5)
        for xx_ in range(x-hw,x+hw+1):
            c=BR[2] if xx_<x-2 else (BR[1] if xx_<x+4 else BR[0])
            if yy_==y-14: c=BR[3]
            if (yy_-(y-14))%5==3: c=BR[0]
            cv.px(xx_,yy_,c)
    FR=[(120,16,10),(200,50,18),(250,120,40),(255,196,80),(255,250,210)]
    fn=noise(H,W,3,seed=x,octaves=2)
    for yy_ in range(y-56,y-13):
        for xx_ in range(x-14,x+15):
            t=(y-14-yy_)/42
            wid=12*(1-t)**0.75*(0.8+0.3*math.sin(yy_*0.5+xx_*0.2))+(fn[yy_,xx_]-0.5)*9
            if abs(xx_-x)<wid:
                v=(1-abs(xx_-x)/max(1,wid))*(1-t*0.75)+(fn[yy_,xx_]-0.5)*0.3
                v=max(0,min(0.999,v))*5; i=int(v); f=v-i
                c=FR[min(4,i+1)] if f>BAYER4[yy_%4,xx_%4] else FR[i]
                if i==0 and (xx_+yy_)%2: continue
                cv.px(xx_,yy_,c)
brazier(40,TOP+16); brazier(210,TOP+16)
# ---------------- title lintel ----------------
TH=np.zeros((H,W),np.float32); TMt=np.zeros((H,W),np.int32); TMk=np.zeros((H,W),bool)
tx0,tx1,ty0,ty1=18,232,298,340
for y in range(ty0,ty1):
    for x in range(tx0,tx1):
        TMk[y,x]=True
        e=min(x-tx0,tx1-1-x,y-ty0,ty1-1-y)
        TH[y,x]=min(e,4)*0.55
        if 4<=e<6: TH[y,x]=0.6
# glyph dots and corner spirals
for x in range(tx0+10,tx1-10,10):
    TH[ty0+3:ty0+5,x:x+3]+=1.6; TH[ty1-5:ty1-3,x:x+3]+=1.6
m=text_mask('DOOM CLOCK',24); mh,mw=m.shape
ox,oy=125-mw//2,319-mh//2
dm=cv2.distanceTransform(np.pad(m.astype(np.uint8),1),cv2.DIST_L2,3)[1:-1,1:-1]
for y_,x_ in zip(*np.where(m)):
    TH[oy+y_,ox+x_]=4.2+min(dm[y_,x_],2)*0.6; TMt[oy+y_,ox+x_]=1
TH+=(noise(H,W,3,seed=21,octaves=2)-0.5)*0.35*TMk
TSTONE=[(34,16,10),(70,40,24),(112,74,46),(158,114,74),(200,158,108),(232,198,150)]
TGOLD=[(90,40,8),(160,90,18),(228,150,40),(255,208,90),(255,240,170),(255,255,230)]
relief(cv,TH,TMt,[TSTONE,TGOLD],TMk,k=1.4,bias=0.0)
# ---------------- embers ----------------
for _ in range(70):
    x,y=random.randint(0,W-1),random.randint(150,296)
    if not M[y,x]:
        cv.px(x,y,(255,150,120)); 
        if random.random()<0.4: cv.px(x,y+1,(180,50,70))
save2(cv,'09_doom_clock')
