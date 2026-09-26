from px2 import *
from font35 import text35, width35
random.seed(9)
W,H=W2,H2
cv=C2((30,4,10))
# ---------- sky ----------
dither_gradient(cv,0,0,W,H,[(22,4,18),(52,8,26),(96,14,30),(150,34,32),(206,76,40),(240,130,56),(250,176,86)])
for _ in range(60):
    x,y=random.randint(0,W-1),random.randint(0,70)
    cv.px(x,y,random.choice([(255,210,200),(200,150,170),(255,255,255)]))
CX,CY,R=125,112,88
# eclipse corona
for y in range(0,230):
    for x in range(W):
        d=math.hypot(x-CX,y-CY); a=math.atan2(y-CY,x-CX)
        if R<d<R+34:
            s=0.5+0.5*math.sin(a*14)+0.3*math.sin(a*37+1)
            f=(1-(d-R)/34)*(0.55+0.45*s)
            if BAYER4[y%4,x%4]<f*0.9:
                c=(255,236,160) if f>0.7 else ((255,190,90) if f>0.45 else (230,110,50))
                cv.px(x,y,c)
# long rays
for k in range(24):
    a=k/24*2*math.pi+0.07
    L=R+40+(18 if k%2==0 else 0)
    for r in range(R+30,L):
        for w in (-1,0,1):
            x=int(CX+math.cos(a)*r-math.sin(a)*w*0.8); y=int(CY+math.sin(a)*r+math.cos(a)*w*0.8)
            if 0<=x<W and 0<=y<H and BAYER4[y%4,x%4]<(1-(r-R-30)/(L-R-30))*0.8: cv.px(x,y,(255,170,80))
# scroll clouds (aztec style)
def scroll_cloud(cx,cy,sc,flip=False):
    for t in np.linspace(0,4.2*math.pi,260):
        r=sc*(1-t/(5*math.pi))
        x=cx+(math.cos(t)*r)*(-1 if flip else 1); y=cy+math.sin(t)*r*0.8
        for w in range(2):
            X,Y=int(x)+w,int(y)
            if 0<=X<W and 0<=Y<H: cv.px(X,Y,(250,196,120) if w==0 else (160,60,40))
scroll_cloud(24,40,12); scroll_cloud(228,56,11,True); scroll_cloud(16,168,9); scroll_cloud(236,176,10,True)
# ---------- jungle silhouettes ----------
SIL=[(28,6,14),(44,10,20)]
def palm(x,y,h,flip=1):
    for k in range(h):
        xx=x+int(3*math.sin(k/h*1.6))*flip
        cv.rect(xx-1,y-k,xx+2,y-k+1,SIL[0])
    tx,ty=x+int(3*math.sin(1.6))*flip,y-h
    for a in [-2.6,-2.2,-1.7,-1.2,-0.7,-0.3]:
        for r in range(22):
            X=int(tx+math.cos(a)*r); Y=int(ty+math.sin(a)*r+ (r*r)/40)
            cv.rect(X,Y,X+2,Y+2,SIL[0])
            if r%3==0: cv.px(X+1,Y+3,SIL[0])
for (x,y,h,f) in [(12,300,90,1),(36,320,70,-1),(236,296,96,-1),(212,322,66,1)]: palm(x,y,h,f)
for x in range(W):
    hy=int(250+10*math.sin(x*0.07)+6*math.sin(x*0.19))
    for y in range(hy,H): cv.px(x,y,SIL[1] if y<hy+3 else SIL[0])
# ---------- sun stone height map ----------
Hm=np.zeros((H,W),np.float32); Mt=np.zeros((H,W),np.int32); M=np.zeros((H,W),bool)
GLY=[["#######","#.....#","#.###.#","#.#.#.#","#.###.#","#.....#","#######"],
     ["..###..",".#...#.","#..#..#","#.###.#","#..#..#",".#...#.","..###.."],
     ["#.#.#.#",".#####.","##...##",".#.#.#.","##...##",".#####.","#.#.#.#"],
     ["...#...","..###..",".#####.","#######","..#.#..","..#.#..",".##.##."],
     ["#.....#",".#...#.","..#.#..","...#...","..#.#..",".#...#.","#.....#"],
     [".#####.","#.....#","#.#.#.#","#.....#","#.###.#","#.....#",".#####."],
     ["...#...","..#.#..",".#.#.#.","#.###.#",".#.#.#.","..#.#..","...#..."],
     ["##..###","#..#..#","..###..",".#####.","..###..","#..#..#","###..##"]]
for y in range(CY-R-1,CY+R+2):
    for x in range(CX-R-1,CX+R+2):
        dx,dy=x-CX,y-CY; r=math.hypot(dx,dy)
        if r>R+0.5: continue
        M[y,x]=True
        a=(math.degrees(math.atan2(dy,dx))+90)%360
        h=0.0; mt=0
        if r>R-5: h=2.4+math.sqrt(max(0,1-((r-(R-2.5))/2.5)**2))
        elif r>R-17:
            # fire serpent band: scales
            seg=(a%9)/9; ring=(r-(R-17))/12
            h=1.4+0.9*math.sin(seg*math.pi)*math.sin(ring*math.pi)
            if int(a/45)%2==0 and abs(((a%45)-22.5))<3: h=2.4; mt=2
        elif r>R-19: h=0
        elif r>R-35:
            t=(r-(R-35))/16
            k=a%45
            if abs(k-22.5)<(1-t)*15: h=2.6-t*0.4
            elif min(k,45-k)<(1-t)*6: h=2.0; mt=1
            else: h=0.6
        elif r>R-38: h=0
        elif r>R-45:
            bead=(a%6)/6
            dd=math.hypot((bead-0.5)*2*(R-41)*6/57.3/1.0,(r-(R-41.5)))
            h=0.8+ (1.4 if dd<2.6 else 0)
        elif r>R-47: h=0
        elif r>R-63:
            h=1.0
            if (a%18)<1.3: h=0
        elif r>R-65: h=0
        else:
            h=1.6
            if r>R-68: h=1.0
        Hm[y,x]=h; Mt[y,x]=mt
# day-sign glyphs
for i in range(20):
    ang=math.radians(i*18+9-90)
    gx=CX+math.cos(ang)*(R-55); gy=CY+math.sin(ang)*(R-55)
    g=GLY[i%len(GLY)]
    for yy in range(7):
        for xx in range(7):
            if g[yy][xx]=='#':
                for sy in range(2):
                    for sx in range(2):
                        X=int(gx-7+xx*2+sx); Y=int(gy-7+yy*2+sy)
                        Hm[Y,X]=2.2; Mt[Y,X]=2 if i%5==0 else (1 if i%5==2 else 0)
# 12 skull hour markers
SK=[".####.","######","#..#.#","######",".#.#.."]
SK=["..####..",".######.","########","##..#..#","########",".##.##..","..#.#.#."]
for hr in range(12):
    ang=math.radians(hr*30-90)
    sx0=CX+math.cos(ang)*(R-41.5); sy0=CY+math.sin(ang)*(R-41.5)
    for yy,row in enumerate(SK):
        for xx,ch in enumerate(row):
            X=int(sx0-4+xx); Y=int(sy0-3+yy)
            if ch=='#': Hm[Y,X]=2.6; Mt[Y,X]=3
            elif ch=='.' and 2<=yy<=4 and 1<=xx<=6: Hm[Y,X]=1.2; Mt[Y,X]=4
# centre skull (big) 26x28
FACE=[
"........##########........",
"......##############......",
"....##################....",
"...####################...",
"..######################..",
"..######################..",
".########################.",
".#####....######....#####.",
".####......####......####.",
".####..RR..####..RR..####.",
".####..RR..####..RR..####.",
".#####....######....#####.",
"..###########..###########",
"..##########....##########",
"...#########....#########.",
"....####################..",
".....##################...",
"......#.#.#.#.#.#.#.#.....",
"......################....",
".......#.#.#.#.#.#.#......",
"........#############.....",
"..........#########.......",
]
fx0,fy0=CX-13,CY-12
for yy,row in enumerate(FACE):
    for xx,ch in enumerate(row):
        X,Y=fx0+xx,fy0+yy
        if ch=='#':
            dd=math.hypot(xx-12.5,(yy-9)*1.1)
            Hm[Y,X]=2.2+1.4*max(0,1-dd/14); Mt[Y,X]=3
        elif ch=='R': Hm[Y,X]=0.6; Mt[Y,X]=5
        elif ch=='.' and 7<=yy<=13 and 1<=xx<=24: Hm[Y,X]=0.2; Mt[Y,X]=4
        elif ch=='.' and 17<=yy<=19 and 6<=xx<=20: Hm[Y,X]=0.8; Mt[Y,X]=4
# noise weathering
wn=noise(H,W,3,seed=4,octaves=2)
Hm+=(wn-0.5)*0.35*M
STONE=[(58,26,10),(98,52,18),(146,90,32),(196,136,52),(230,180,84),(252,222,140)]
TURQ=[(10,50,58),(24,96,100),(46,150,146),(104,206,190),(170,240,220)]
REDO=[(60,10,10),(110,24,20),(170,44,32),(214,84,52),(240,140,90)]
BONE=[(70,52,40),(130,110,88),(196,178,150),(236,224,196),(255,250,236)]
DARK=[(20,6,4),(36,12,8),(54,20,12),(70,30,18)]
GLOW=[(120,10,10),(220,30,30),(255,90,70),(255,190,150)]
relief(cv,Hm,Mt,[STONE,TURQ,REDO,BONE,DARK,GLOW],M,k=1.4)
# outer dark edge
for y in range(CY-R-2,CY+R+3):
    for x in range(CX-R-2,CX+R+3):
        d=math.hypot(x-CX,y-CY)
        if R+0.5<d<=R+1.6: cv.px(x,y,(40,14,6))
# glowing eyes
for (ex,ey) in [(fx0+7,fy0+9),(fx0+17,fy0+9)]:
    for dy in range(-4,6):
        for dx in range(-4,6):
            d=math.hypot(dx-0.5,dy-0.5)
            if d<4.5 and BAYER4[(ey+dy)%4,(ex+dx)%4]<(4.5-d)/4.5*0.6:
                cv.px(ex+dx,ey+dy,lerp(tuple(cv.a[ey+dy,ex+dx]),(255,80,50),0.6))
    cv.rect(ex,ey,ex+2,ey+2,(255,236,200))
# ---------- obsidian clock hands (11:57) ----------
OBS=[(10,6,14),(28,20,40),(64,52,86),(150,140,190)]
JADE=[(20,90,60),(50,170,110),(150,240,190)]
def hand(ang_deg,L,w0,tip_len):
    a=math.radians(ang_deg-90)
    ux,uy=math.cos(a),math.sin(a); px_,py_=-uy,ux
    # shadow
    for r in np.arange(17,L,0.5):
        w=w0*(1-(r/L)**3)
        for s in np.arange(-w,w+0.1,0.5):
            x=CX+ux*r+px_*s+3; y=CY+uy*r+py_*s+3
            X,Y=int(round(x)),int(round(y))
            if (X+Y)%2==0: cv.px(X,Y,lerp(tuple(cv.a[Y,X]),(20,6,4),0.6))
    for r in np.arange(17,L,0.5):
        w=w0*(1-(r/L)**3) if r<L-tip_len else w0*1.3*(L-r)/tip_len
        for s in np.arange(-w,w+0.1,0.5):
            x=CX+ux*r+px_*s; y=CY+uy*r+py_*s
            X,Y=int(round(x)),int(round(y))
            if r>L-tip_len: c=JADE[1] if s<0 else JADE[0]
            else:
                c=OBS[1]
                if s<-w+1: c=OBS[2]
                if s>w-1: c=OBS[0]
                if abs(s+w*0.3)<0.5 and int(r)%5<3: c=OBS[3]
            cv.px(X,Y,c)
    tx,ty=CX+ux*(L-tip_len*0.6),CY+uy*(L-tip_len*0.6)
    cv.px(int(tx)-1,int(ty)-1,JADE[2])
hand(-18,R-10,2.6,10)
hand(-1.5,R-42,3.4,9)
# ---------- pyramid ----------
PH=np.zeros((H,W),np.float32); PM=np.zeros((H,W),np.int32); PMask=np.zeros((H,W),bool)
TOP=206
tiers=[(TOP,24,58),(TOP+24,24,82),(TOP+48,24,106),(TOP+72,24,130),(TOP+96,24,154),(TOP+120,24,178)]
for (y0,h,hw) in tiers:
    for y in range(y0,min(H,y0+h)):
        for x in range(max(0,CX-hw),min(W,CX+hw)):
            PMask[y,x]=True
            ly=y-y0
            if ly<3: PH[y,x]=3.0-ly*0.3; PM[y,x]=0; continue  # ledge
            # block pattern
            row=(ly-3)//7; bw=14; off=(row%2)*7
            bx=(x-(CX-hw)+off)%bw; byy=(ly-3)%7
            e=min(bx,bw-1-bx,byy,6-byy)
            PH[y,x]=0.6+min(e,2)*0.55
            if e==0: PH[y,x]=0.1
            PM[y,x]=0
    # carved band on lowest visible tiers handled later
# staircase (overrides)
for y in range(TOP,H):
    t=(y-TOP)/(H-TOP); hw=int(18+t*16)
    for x in range(CX-hw-6,CX+hw+7):
        if not (0<=x<W): continue
        PMask[y,x]=True
        if abs(x-CX)<=hw:
            s=(y-TOP)%4
            PH[y,x]=2.0-s*0.45; PM[y,x]=1
        else:
            # balustrade
            PH[y,x]=3.2- (abs(abs(x-CX)-hw-3))*0.3; PM[y,x]=0
wn2=noise(H,W,4,seed=8,octaves=2)
PH+=(wn2-0.5)*0.4*PMask
PSTONE=[(40,22,16),(74,44,30),(110,72,50),(150,108,76),(190,150,108),(222,190,146)]
STAIR=[(48,26,20),(88,52,36),(132,88,60),(176,128,90),(214,170,124)]
relief(cv,PH,PM,[PSTONE,STAIR],PMask,k=1.2,bias=-0.05)
# red carpet of doom down the stairs
for y in range(TOP+2,H):
    t=(y-TOP)/(H-TOP); hw=int(6+t*6)
    for x in range(CX-hw,CX+hw+1):
        s=(y-TOP)%4
        c=[(170,30,36),(140,20,30),(110,14,24),(90,10,20)][s]
        if abs(x-CX)==hw: c=(220,170,70)
        cv.px(x,y,c)
# serpent heads at the base of balustrades (kukulkan)
def serpent(x,y,flip):
    S=["..####....",".######...","##.#####..","#########.","####.#####","##########","#.#.#.#.##","##########"]
    for j,r in enumerate(S):
        for i,ch in enumerate(r):
            X=x+(i if not flip else -i)
            if ch=='#': cv.px(X,y+j,(196,150,100) if j<3 else (150,104,70))
            elif ch=='.' and j in (2,4): cv.px(X,y+j,(30,10,6))
    cv.px(x+(3 if not flip else -3),y+2,(255,80,50))
serpent(CX-48,H-12,True); serpent(CX+48,H-12,False)
# ---------- braziers ----------
def brazier(x,y):
    BR=[(40,24,18),(80,52,36),(130,90,60),(170,126,86)]
    for yy in range(y-12,y):
        t=(yy-(y-12))/12; hw=int(9-t*4)
        for xx in range(x-hw,x+hw+1):
            c=BR[2] if xx<x else BR[1]
            if yy==y-12: c=BR[3]
            if (yy-(y-12))%4==2: c=BR[0]
            cv.px(xx,yy,c)
    # fire
    FR=[(120,20,10),(200,50,20),(250,120,40),(255,200,80),(255,250,200)]
    for yy in range(y-48,y-11):
        for xx in range(x-12,x+13):
            t=(y-12-yy)/36
            wob=math.sin(yy*0.5+xx*0.2)*2+math.sin(yy*0.23)*2
            hw=10*(1-t)**0.8*(0.8+0.2*math.sin(yy*0.9))
            d=abs(xx-x-wob*t)
            if d<hw:
                v=(1-d/hw)*(1-t*0.7)
                i=int(v*4.99)
                if BAYER4[yy%4,xx%4]<(v*5-i): i=min(4,i+1)
                cv.px(xx,yy,FR[i])
    for k in range(8):
        ex,ey=x+random.randint(-14,14),y-random.randint(50,80)
        cv.px(ex,ey,(255,200,90))
brazier(CX-66,TOP+2); brazier(CX+66,TOP+2)
# ---------- title tablet ----------
TH=np.zeros((H,W),np.float32); TM=np.zeros((H,W),np.int32); TMk=np.zeros((H,W),bool)
tx0,tx1,ty0,ty1=44,206,316,344
for y in range(ty0,ty1):
    for x in range(tx0,tx1):
        TMk[y,x]=True
        e=min(x-tx0,tx1-1-x,y-ty0,ty1-1-y)
        TH[y,x]=min(e,3)*0.6
        if 3<e<5: TH[y,x]=0.8
m=text_mask('DOOM CLOCK',20); mh,mw=m.shape
ox,oy=125-mw//2,ty0+6
for yy in range(mh):
    for xx in range(mw):
        if m[yy,xx]: TH[oy+yy,ox+xx]=0.2; TM[oy+yy,ox+xx]=1
# glyph dots border
for x in range(tx0+6,tx1-6,8):
    TH[ty0+3:ty0+5,x:x+2]=2.6; TH[ty1-5:ty1-3,x:x+2]=2.6
TSTONE=[(50,28,18),(96,62,40),(146,104,70),(196,150,104),(232,196,146)]
TGOLD=[(90,40,10),(170,90,20),(240,160,50),(255,220,120),(255,246,200)]
relief(cv,TH,TM,[TSTONE,TGOLD],TMk,k=1.6,bias=0.02)
# ---------- embers ----------
for _ in range(50):
    x,y=random.randint(0,W-1),random.randint(120,300)
    if random.random()<0.6: cv.px(x,y,(255,170,60))
    else: cv.px(x,y,(255,230,150)); cv.px(x,y+1,(220,90,40))
save2(cv,'09_doom_clock')
