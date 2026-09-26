from px2 import *
from font35 import text35, width35
from slimes2 import make, KINDS
random.seed(4)
W,H=W2,H2
cv=C2((40,28,54))
# ---------- wallpaper (damask) ----------
WA=[(34,22,48),(44,30,62),(56,38,76),(70,50,92)]
tile=["................",
      ".......##.......",
      "......#..#......",
      ".....#.##.#.....",
      "...##.#..#.##...",
      "..#..#....#..#..",
      "..#.#..##..#.#..",
      "...#..#..#..#...",
      "...#..#..#..#...",
      "..#.#..##..#.#..",
      "..#..#....#..#..",
      "...##.#..#.##...",
      ".....#.##.#.....",
      "......#..#......",
      ".......##.......",
      "................"]
lamp=(40,40)
for y in range(H):
    for x in range(W):
        ty,tx=(y+ (8 if (x//16)%2 else 0))%16, x%16
        d=math.hypot(x-lamp[0],y-lamp[1])
        lv=max(0,1-d/260)
        f=lv*2.2
        base=int(f); fr=f-base
        if fr>BAYER4[y%4,x%4]: base+=1
        base=min(2,base)
        c=WA[base]
        if tile[ty][tx]=='#': c=WA[min(3,base+1)]
        cv.px(x,y,c)
# vertical stripes between damask columns
for x in range(0,W,32):
    for y in range(H):
        if y%2==0: cv.px(x,y,WA[0])
# picture rail
# ---------- shelf ----------
SY=318
WD=[(62,34,20),(96,56,32),(128,80,46),(160,106,62),(196,140,86)]
for y in range(SY,H):
    for x in range(W):
        g=math.sin(x*0.09+math.sin(y*0.7)*2+y*0.3)
        v=2 if g<0.6 else 3
        if g<-0.7: v=1
        if y<SY+2: v=4
        elif y<SY+4: v=3
        elif y>H-6: v=1 if y<H-3 else 0
        cv.px(x,y,WD[v])
# brackets
for bx in (22,222):
    for k in range(16):
        cv.rect(bx-2,SY+ -0,bx+2,SY+1,WD[0]) if False else None
# jar shadow
for x in range(44,214):
    for y in range(SY,SY+6):
        if (x+y)%2==0 or y<SY+2:
            if ((x-128)/86)**2+((y-SY)/6)**2<1: cv.px(x,y,WD[0])
# ---------- jar geometry ----------
JX0,JX1=46,206; JTOP=120; JBOT=316; NX0,NX1=74,178; NTOP=92
jar=np.zeros((H,W),bool)
for y in range(NTOP,JBOT):
    for x in range(W):
        if y<104: ok=NX0<=x<NX1
        elif y<JTOP:
            t=(y-104)/(JTOP-104)
            hw=(NX1-NX0)/2+((JX1-JX0)-(NX1-NX0))/2*math.sin(t*math.pi/2)
            ok=abs(x-(JX0+JX1)/2+0.5)<=hw
        else:
            ok=JX0<=x<JX1; r=20
            if y>JBOT-r:
                if x<JX0+r and (x-(JX0+r))**2+(y-(JBOT-r))**2>r*r: ok=False
                if x>=JX1-r and (x-(JX1-r-1))**2+(y-(JBOT-r))**2>r*r: ok=False
        jar[y,x]=ok
inner=cv2.erode(jar.astype(np.uint8),np.ones((5,5),np.uint8)).astype(bool)
# glass tint on wall behind
for y in range(H):
    for x in range(W):
        if jar[y,x]: cv.px(x,y,lerp(tuple(cv.a[y,x]),(90,150,150),0.22))
# ---------- slimes ----------
layer=np.zeros((H,W,4),np.uint8)
def blit(dst,s,x,y,flip=False):
    if flip: s=s[:,::-1]
    h,w=s.shape[:2]
    for yy in range(h):
        for xx in range(w):
            if s[yy,xx,3]:
                X,Y=x+xx,y+yy
                if 0<=X<W and 0<=Y<H: dst[Y,X]=s[yy,xx]
cache={k:scale2x(make(k)) for k in KINDS}
order=['rocky','slimy','splashy','hardy','icy','fiery','cloudy','shadowy','sparky','slimy','splashy','rocky','icy','hardy','fiery','shadowy','cloudy','slimy','sparky','splashy','icy','rocky','hardy','fiery','cloudy','shadowy','slimy','splashy','sparky','icy','rocky','hardy','fiery']
placed=[]; idx=0
yb=JBOT-3; row=0
while yb>JTOP-6:
    x=JX0-6+(row%2)*18
    while x<JX1-14:
        k=order[idx%len(order)]; idx+=1
        s=cache[k]
        placed.append((yb,x+random.randint(-3,3),s,random.random()<0.5))
        x+=s.shape[1]-8+random.randint(-2,2)
    yb-=24; row+=1
for (yb,x,s,fl) in sorted(placed,key=lambda p:p[0]):
    blit(layer,s,x,yb-s.shape[0],fl)
# depth darkening towards jar bottom-right + glass tint
for y in range(H):
    for x in range(W):
        if inner[y,x] and layer[y,x,3]:
            c=tuple(int(v) for v in layer[y,x,:3])
            c=lerp(c,(150,220,215),0.10)
            dep=(x-JX0)/(JX1-JX0)
            if dep>0.8 and BAYER4[y%4,x%4]<(dep-0.8)*3: c=lerp(c,(20,30,40),0.3)
            cv.px(x,y,c)
# ---------- glass rendering ----------
GE=(196,240,236); GE2=(120,180,182); GED=(52,90,100)
for y in range(1,H-1):
    for x in range(1,W-1):
        if jar[y,x]:
            edge=not(jar[y,x-1] and jar[y,x+1] and jar[y-1,x] and jar[y+1,x])
            if edge: cv.px(x,y,GE if x<(JX0+JX1)//2 else GE2)
            elif not inner[y,x]:
                cv.px(x,y,lerp(tuple(cv.a[y,x]),(200,240,240),0.35) if x<128 else lerp(tuple(cv.a[y,x]),(20,40,50),0.3))
# big left highlight (two strips, dithered ends)
for y in range(JTOP+8,JBOT-24):
    t=(y-JTOP)/(JBOT-JTOP)
    fade=min(1,t*6,(1-t)*5)
    for (hx,wid,k) in [(JX0+9,4,0.6),(JX0+15,1,0.45),(JX1-14,2,0.35)]:
        for i in range(wid):
            if BAYER4[y%4,(hx+i)%4]<fade: cv.px(hx+i,y,lerp(tuple(cv.a[y,hx+i]),(255,255,255),k))
# bottom glass arc
for x in range(JX0+18,JX1-18):
    y=JBOT-4-int(3*math.sin((x-JX0-18)/(JX1-JX0-36)*math.pi))
    cv.px(x,y,lerp(tuple(cv.a[y,x]),(230,255,255),0.5))
# neck threads
for i,y in enumerate(range(NTOP+2,NTOP+12,3)):
    for x in range(NX0,NX1):
        if not (100<x<152 and y<NTOP+14):
            cv.px(x,y,lerp(tuple(cv.a[y,x]),(220,250,250),0.55)); cv.px(x,y+1,lerp(tuple(cv.a[y+1,x]),(40,70,80),0.3))
# ---------- king slime popping out ----------
king=scale2x(make('shiny'))
kx=126-king.shape[1]//2; ky=NTOP-king.shape[0]+14
cv.paste(king,kx,ky)
# neck rim in front of king
for x in range(NX0,NX1):
    for y in range(NTOP+10,NTOP+13):
        if not jar[y,x]: continue
        cv.px(x,y,lerp(tuple(cv.a[y,x]),(220,250,250),0.4))
for x in range(NX0-2,NX1+2):
    cv.px(x,NTOP+13,GE); cv.px(x,NTOP+14,GE2)
# motion lines + sparkles
def spark(x,y,r=3,c=(255,244,170)):
    for k in range(-r,r+1): cv.px(x+k,y,c); cv.px(x,y+k,c)
    cv.px(x,y,(255,255,255))
for (x,y,r) in [(92,62,3),(162,54,2),(98,40,2),(176,78,3)]: spark(x,y,r)
for (x0,y0) in [(110,58),(142,56),(126,52)]:
    for k in range(6):
        if k%2==0: cv.px(x0,y0-k*2,(255,244,200))
# ---------- flying lid ----------
LID=[(96,70,24),(150,112,40),(206,160,64),(240,200,100),(255,236,160)]
lcx,lcy=196,40; ang=math.radians(-24)
for y in range(0,90):
    for x in range(150,W):
        dx,dy=x-lcx,y-lcy
        u=dx*math.cos(ang)+dy*math.sin(ang); v=-dx*math.sin(ang)+dy*math.cos(ang)
        top=(u/27)**2+(v/8)**2<=1
        side=(abs(u)<=27 and 0<v<=9) or ((u/27)**2+((v-9)/8)**2<=1)
        if top:
            rr=(u/27)**2+(v/8)**2
            i=3 if rr<0.55 else 2
            if u<-8 and v<-2 and rr<0.7: i=4
            if rr>0.85: i=1
            if rr<0.55 and BAYER4[y%4,x%4]<(u+27)/54*0.5: i=2
            cv.px(x,y,LID[i])
        elif side:
            i=2 if (int(u)+60)%5 else 0
            if u>14: i=max(0,i-1)
            cv.px(x,y,LID[i])
for (x,y) in [(158,70),(152,64),(164,76)]:
    for t in range(8): cv.px(x-t,y+t,(240,236,220)) if t%3!=2 else None
# POP!
def burst(cx,cy,r1,r2,c,cd):
    for y in range(cy-r2-2,cy+r2+3):
        for x in range(cx-r2-2,cx+r2+3):
            a=math.atan2(y-cy,x-cx); rr=r1+(r2-r1)*(0.5+0.5*math.cos(a*9))
            d=math.hypot(x-cx,(y-cy)*1.3)
            if d<=rr: cv.px(x,y,c)
            elif d<=rr+1.2: cv.px(x,y,cd)
burst(46,34,20,30,(255,226,90),(150,60,40))
draw_text(cv,'POP!',16,46,24,(255,255,255),center=True,outline_c=(150,60,40),shadow=(1,1))
# ---------- label ----------
LB=[(150,120,86),(206,180,136),(236,218,178),(248,236,206)]
lx0,lx1,ly0,ly1=74,178,196,252
for y in range(ly0,ly1):
    for x in range(lx0,lx1):
        n=math.sin(x*0.9+y*0.3)*math.sin(y*0.7-x*0.2)
        c=LB[2]
        if n>0.7: c=LB[3]
        if n<-0.8 and (x+y)%2: c=LB[1]
        e=min(x-lx0,lx1-1-x,y-ly0,ly1-1-y)
        if e==0: c=LB[0]
        cv.px(x,y,c)
for x in range(lx0,lx1,6):
    for k in range(3): cv.px(x+k+1,ly0-1,LB[2] if k==1 else LB[1]); cv.px(x+k+3,ly1,LB[2] if k==1 else LB[1])
for x in range(lx0+4,lx1-4):
    cv.px(x,ly0+4,(196,58,96)); cv.px(x,ly1-5,(196,58,96))
    if x%2==0: cv.px(x,ly0+5,(230,140,160)); cv.px(x,ly1-6,(230,140,160))
draw_text(cv,'SLIMES',16,126,ly0+9,(86,34,60),center=True,shadow=(1,1,(206,150,150)))
text35(cv,'FRESH BATCH',126,ly0+29,(140,70,100),center=True)
text35(cv,'DO NOT SHAKE!',126,ly0+38,(200,50,90),center=True)
ic=make('slimy')

# ---------- escaped slimes on the shelf ----------
e1=scale2x(make('splashy')); cv.paste(e1,2,SY-e1.shape[0]+3)
e2=scale2x(make('icy')); cv.paste(e2[:,::-1],W-e2.shape[1]-2,SY-e2.shape[0]+2)
for x in range(8,44):
    if x%3: cv.px(x,SY+1,(70,150,230))
# dust motes in lamp light
for _ in range(40):
    x,y=random.randint(0,120),random.randint(0,190)
    if not jar[y,x] and math.hypot(x-40,y-40)<140: cv.px(x,y,(150,120,170))
save2(cv,'04_slime_jar')
