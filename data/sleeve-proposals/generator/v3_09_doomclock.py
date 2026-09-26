# Doom Clock - v3 (from scratch): monumental Aztec sun-stone clock, eclipse, magma cracks
from px2 import *
random.seed(90)
W,H=W2,H2
cv=C2((10,2,6))
CX,CY,R=125,146,104
yy,xx=np.indices((H,W)); DIST=np.hypot(xx-CX,yy-CY); ANG=(np.degrees(np.arctan2(yy-CY,xx-CX))+90)%360
# ---------------- sky ----------------
dither_gradient(cv,0,0,W,H,[(8,2,10),(26,4,18),(60,8,24),(110,20,26),(160,44,30),(90,20,20)])
for _ in range(90):
    x,y=random.randint(0,W-1),random.randint(0,120); cv.px(x,y,random.choice([(255,220,210),(190,140,160),(255,255,255)]))
# eclipse corona behind the stone: bright thin ring + soft falloff
cn=noise(H,W,5,seed=3,octaves=2)
RAMP=[(90,14,18),(170,40,28),(236,110,44),(255,196,110),(255,246,214)]
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
        if 0<=x<W and 0<=y<H and BAYER4[y%4,x%4]<f*0.6: cv.px(x,y,(255,200,120) if f>0.6 else ((236,110,44) if f>0.3 else (150,36,26)))
# ash / embers in the sky
for _ in range(80):
    x,y=random.randint(0,W-1),random.randint(0,H-1)
    if DIST[y,x]>R+4: cv.px(x,y,random.choice([(255,170,70),(255,220,140),(120,60,60)]))
# ---------------- sun stone height map ----------------
Hm=np.zeros((H,W),np.float32); Mt=np.zeros((H,W),np.int32)
M=DIST<=R+0.5
def ring(r0,r1): return (DIST>=r0)&(DIST<r1)
# 1 outer rim with beads
rim=ring(R-6,R+0.5)
Hm[rim]=2.6+np.sqrt(np.clip(1-((DIST[rim]-(R-3))/3)**2,0,1))
beads=rim&(np.abs(((ANG*(R-3)*math.pi/180)%7)-3.5)<1.6)&(np.abs(DIST-(R-3))<1.6)
Hm[beads]+=0.9
# 2 fire serpents band (two bodies, heads meet at the bottom)
sb=ring(R-26,R-6)
seg=(ANG%12)/12; rr=(DIST-(R-26))/20
Hm[sb]=(1.3+0.9*np.sin(seg*math.pi)*np.sin(rr*math.pi))[sb]
Mt[sb&((ANG//12)%2==0)]=2        # red ochre segments
Mt[sb&((ANG//12)%2==1)]=0
# flame tufts on the outside of every segment
tuft=sb&(rr>0.62)&(np.abs(seg-0.5)<0.18)
Hm[tuft]+=0.8; Mt[tuft]=1
# 3 groove + 4 solar rays
Hm[ring(R-29,R-26)]=0.1
rays=ring(R-50,R-29)
k45=ANG%45; tt=(DIST-(R-50))/21
big=np.abs(k45-22.5)<(1-tt)*14
small=(np.minimum(k45,45-k45)<(1-tt)*6)
Hm[rays]=0.55
Hm[rays&big]=(2.8-tt*0.6)[rays&big]; Mt[rays&big]=0
Hm[rays&small]=2.1; Mt[rays&small]=1
# inner chevrons inside big rays
chev=rays&big&(np.abs(k45-22.5)<(1-tt)*8)&((DIST.astype(int))%5==0)
Hm[chev]-=0.9
# 5 bead ring (+ skull hour markers later)
Hm[ring(R-53,R-50)]=0.1
br=ring(R-62,R-53)
Hm[br]=0.8
bd=br&(np.abs(((ANG*(R-57.5)*math.pi/180)%6)-3)<1.7)&(np.abs(DIST-(R-57.5))<2.2)
Hm[bd]=2.0
# 6 day-sign ring (20 cells)
Hm[ring(R-64,R-62)]=0.1
ds=ring(R-78,R-64)
Hm[ds]=1.0
Hm[ds&((ANG%18)<1.4)]=0.1
Hm[ring(R-80,R-78)]=0.1
# 7 centre medallion
cm=DIST<R-80
Hm[cm]=1.4
GLY=[["#########","#.......#","#.#####.#","#.#...#.#","#.#.#.#.#","#.#...#.#","#.#####.#","#.......#","#########"],
     ["...###...","..#...#..",".#.###.#.","#.#...#.#","#.#.#.#.#","#.#...#.#",".#.###.#.","..#...#..","...###..."],
     ["#.#.#.#.#",".#######.","##.....##",".#.#.#.#.","##.....##",".#.###.#.","##.....##",".#######.","#.#.#.#.#"],
     ["....#....","...###...","..#####..",".#######.","#########","...#.#...","..##.##..","..#...#..",".##...##."],
     ["#.......#",".#.....#.","..#...#..","...#.#...","....#....","...#.#...","..#...#..",".#.....#.","#.......#"],
     [".#######.","#.......#","#.##.##.#","#.......#","#..###..#","#.......#","#.#.#.#.#","#.......#",".#######."],
     ["....#....","...#.#...","..#.#.#..",".#.###.#.","#.##.##.#",".#.###.#.","..#.#.#..","...#.#...","....#...."],
     ["###...###","#..#.#..#","...###...","..#####..",".#######.","..#####..","...###...","#..#.#..#","###...###"],
     ["..#####..",".#.....#.","#..#.#..#","#.......#","#.#####.#","#..#.#..#",".#.....#.","..#####..","........."],
     ["#...#...#",".#..#..#.","..#.#.#..","...###...","#########","...###...","..#.#.#..",".#..#..#.","#...#...#"]]
for i in range(20):
    ang=math.radians(i*18+9-90)
    gx=CX+math.cos(ang)*(R-71); gy=CY+math.sin(ang)*(R-71)
    g=GLY[i%len(GLY)]
    for y_ in range(1,8):
        for x_ in range(1,8):
            if g[y_][x_]=='#':
                X=int(round(gx-4+x_)); Y=int(round(gy-4+y_))
                Hm[Y,X]=2.1; Mt[Y,X]=[0,1,2,0,3][i%5]
# skull hour markers (12) on the bead ring
SKM=["..####..",".######.","########","##..#..#","##..#..#","########",".#.##.#.","..#.#.#."]
for h in range(12):
    ang=math.radians(h*30-90)
    sx0=CX+math.cos(ang)*(R-57.5); sy0=CY+math.sin(ang)*(R-57.5)
    for y_,row in enumerate(SKM):
        for x_,ch in enumerate(row):
            X=int(round(sx0-4+x_)); Y=int(round(sy0-4+y_))
            if ch=='#': Hm[Y,X]=2.8-0.1*abs(x_-3.5); Mt[Y,X]=3
            elif 2<=y_<=4 and 1<=x_<=6: Hm[Y,X]=1.1; Mt[Y,X]=4
# weathering
Hm+=(noise(H,W,3,seed=8,octaves=2)-0.5)*0.35*M
STONE=[(46,20,8),(84,44,16),(130,80,28),(180,124,46),(222,170,76),(248,214,130),(255,240,190)]
TURQ=[(8,40,48),(20,86,92),(40,140,136),(96,200,184),(170,240,220)]
REDO=[(56,8,8),(106,22,18),(164,42,30),(212,82,50),(238,138,90)]
BONE=[(64,48,38),(124,106,86),(190,174,146),(232,222,196),(254,250,236)]
VOID=[(16,4,4),(34,10,8),(52,18,12)]
relief(cv,Hm,Mt,[STONE,TURQ,REDO,BONE,VOID],M,k=1.35,bias=0.02)
# ---------------- obsidian hands (11:58) ----------------
OBS=[(10,6,14),(30,22,42),(70,58,96),(150,140,200)]
GOLDI=[(170,110,30),(240,190,80)]
def hand(ang_deg,L,w0):
    a=math.radians(ang_deg-90); ux,uy=math.cos(a),math.sin(a); nx,ny=-uy,ux
    for r in np.arange(22,L,0.5):
        w=w0*(1-((r-22)/(L-22))**1.5*0.65) if r<L-10 else w0*0.35*(L-r)/10*2.2
        for s_ in np.arange(-w,w+0.1,0.5):
            X=int(round(CX+ux*r+nx*s_+3)); Y=int(round(CY+uy*r+ny*s_+3))
            if (X+Y)%2==0: cv.px(X,Y,lerp(tuple(cv.a[Y,X]),(10,2,2),0.6))
    for r in np.arange(22,L,0.5):
        w=w0*(1-((r-22)/(L-22))**1.5*0.65) if r<L-10 else w0*0.35*(L-r)/10*2.2
        for s_ in np.arange(-w,w+0.1,0.5):
            X=int(round(CX+ux*r+nx*s_)); Y=int(round(CY+uy*r+ny*s_))
            c=OBS[1]
            if s_<-w+1: c=OBS[2]
            if s_>w-1: c=OBS[0]
            if abs(s_)<0.6 and r<L-12: c=GOLDI[1] if int(r)%6<3 else GOLDI[0]
            cv.px(X,Y,c)
        # serrated obsidian edge (macuahuitl teeth)
        if int(r)%5==0 and r<L-10:
            for side in (-1,1):
                X=int(round(CX+ux*r+nx*(w+1.5)*side)); Y=int(round(CY+uy*r+ny*(w+1.5)*side))
                cv.px(X,Y,OBS[3])
hand(-12,R-14,3.2)
hand(-1,R-46,4.2)
# ---------------- centre skull (full-res) ----------------
SK=[
"......########......",
"....############....",
"...##############...",
"..################..",
".##################.",
".##################.",
".###....####....###.",
"###......##......###",
"###..RR..##..RR..###",
"###..RR..##..RR..###",
".###....####....###.",
".########..########.",
"..######....######..",
"...##############...",
"....#.#.#.#.#.#.#...",
"....#############...",
".....#.#.#.#.#.#....",
"......#########.....",
]
from px2 import scale2x as _s2
chars_={'.':0,'#':1,'R':2}
Ls=np.array([[chars_[c] for c in r] for r in SK],np.uint8)
rg=np.zeros(Ls.shape+(4,),np.uint8); rg[...,0]=Ls*80; rg[...,3]=255
S2=_s2(rg)[...,0]//80
sh,sw=S2.shape; sx0,sy0=CX-sw//2,CY-sh//2-2
skm=np.zeros((H,W),bool)
for y_ in range(sh):
    for x_ in range(sw):
        v=S2[y_,x_]; X,Y=sx0+x_,sy0+y_
        inner_void=(12<=y_<=25 and 2<=x_<=37)
        if v==1:
            t=0.74-0.35*(x_-sw/2)/sw-0.25*(y_-sh/2)/sh
            cv.px(X,Y,BONE[max(0,min(4,int(t*5+(BAYER4[Y%4,X%4]-0.5)*0.9)))]); skm[Y,X]=True
        elif v==2:
            d_=min(math.hypot(x_-11.5,y_-17.5),math.hypot(x_-28.5,y_-17.5))
            cv.px(X,Y,(255,240,210) if d_<1.6 else (255,90,50)); skm[Y,X]=True
        elif inner_void:
            cv.px(X,Y,VOID[0]); skm[Y,X]=True
ringm=(cv2.dilate(skm.astype(np.uint8),np.ones((3,3),np.uint8))>0)&~skm
for y,x in zip(*np.where(ringm)): cv.px(x,y,(40,16,8))
# teeth separations / cheek shading
for x_ in range(8,32,4):
    for y_ in range(28,33): 
        X,Y=sx0+x_,sy0+y_
        if skm[Y,X] and S2[y_,x_]==1: cv.px(X,Y,BONE[1])
# obsidian knife tongue
for y in range(CY+14,CY+34):
    w=max(0,4-(y-CY-14)//5)
    for x in range(CX-w-1,CX+w+1):
        cv.px(x,y,(20,14,26) if x>=CX else (70,60,96))
    cv.px(CX-w-2,y,(40,16,8)); cv.px(CX+w+1,y,(40,16,8))
cv.px(CX-1,CY+16,(160,150,200)); cv.px(CX-1,CY+17,(160,150,200))
# eye glow
for ex in (sx0+12,sx0+29):
    for y in range(CY-8,CY+9):
        for x in range(ex-8,ex+9):
            d=math.hypot(x-ex,y-CY)
            if 2<d<8 and BAYER4[y%4,x%4]<(1-d/8)*0.45: cv.px(x,y,lerp(tuple(cv.a[y,x]),(255,70,40),0.4))
# ---------------- magma cracks ----------------
crng=random.Random(17)
cracks=[]
for k in range(5):
    a=k/5*2*math.pi+crng.uniform(-0.25,0.25)+0.4
    x,y=CX+math.cos(a)*24,CY+math.sin(a)*24
    pts=[(x,y)]; L=crng.randint(34,70); seglen=0
    for s_ in range(L):
        if seglen<=0: a+=crng.uniform(-0.55,0.55); seglen=crng.randint(4,9)
        seglen-=1
        x+=math.cos(a); y+=math.sin(a)
        if math.hypot(x-CX,y-CY)>R-8: break
        pts.append((x,y))
        if crng.random()<0.05:
            b=a+crng.choice([-0.8,0.8]); bx,by=x,y; bp=[]
            for _ in range(crng.randint(5,12)):
                bx+=math.cos(b); by+=math.sin(b); bp.append((bx,by))
            cracks.append((bp,1))
    cracks.append((pts,2))
LAVA=[(60,6,2),(170,34,8),(250,110,20),(255,200,70),(255,248,200)]
for pts,wd in cracks:
    for (x,y) in pts:
        X,Y=int(round(x)),int(round(y))
        for dy in range(-4,5):
            for dx in range(-4,5):
                d=math.hypot(dx,dy)
                if 1.5<d<4.5 and BAYER4[(Y+dy)%4,(X+dx)%4]<(1-d/4.5)*0.6:
                    cv.px(X+dx,Y+dy,lerp(tuple(cv.a[Y+dy,X+dx]),(255,120,40),0.35))
for pts,wd in cracks:
    n=len(pts)
    for i,(x,y) in enumerate(pts):
        X,Y=int(round(x)),int(round(y))
        cv.px(X-1,Y,LAVA[0]); cv.px(X+wd,Y,LAVA[0]); cv.px(X,Y-1,LAVA[0])
    for i,(x,y) in enumerate(pts):
        X,Y=int(round(x)),int(round(y))
        t=i/max(1,n-1)
        core=LAVA[4] if t<0.35 else (LAVA[3] if t<0.7 else LAVA[2])
        cv.px(X,Y,core)
        if wd>1: cv.px(X+1,Y,LAVA[2] if t<0.7 else LAVA[1])
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
        cv.px(x,y,(255,180,70)); 
        if random.random()<0.4: cv.px(x,y+1,(200,70,30))
save2(cv,'09_doom_clock')
