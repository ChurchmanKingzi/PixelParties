from pp import *
from font35 import text35, width35
random.seed(7)
W,H=150,210
cv=Canvas(W,H,(60,36,22))
# --- wooden planks background ---
PL=[(92,56,32),(104,64,36),(84,50,28),(98,60,34)]
for i,x0 in enumerate(range(0,W,19)):
    base=PL[i%4]
    for x in range(x0,min(W,x0+19)):
        for y in range(H):
            c=base
            n=math.sin((y*0.13+i*3.1))+math.sin(y*0.047+x*0.9+i)
            if n>1.3: c=lerp(base,(60,34,18),0.45)
            elif n<-1.5: c=lerp(base,(140,92,54),0.35)
            cv.px(x,y,c)
    cv.rect(x0,0,x0+1,H,(40,22,12))
    # plank end joints
    jy=random.randint(20,190)
    cv.rect(x0,jy,x0+19,jy+1,(40,22,12))
    for yy in (jy-3,jy+4):
        cv.px(x0+4,yy,(30,26,26)); cv.px(x0+14,yy,(30,26,26))
    # knots
    kx,ky=x0+random.randint(4,14),random.randint(10,200)
    for dy in range(-2,3):
        for dx in range(-1,2):
            cv.px(kx+dx,ky+dy,(62,36,18))
# --- parchment ---
INK=(58,32,18); DK=(104,66,36); MD=(156,112,66); LT=(200,160,104); PAP=(226,198,144); PAPL=(238,216,168)
PX0,PY0,PX1,PY1=14,14,136,198
poster=np.zeros((H,W),bool)
top=[PY0+random.choice([0,0,0,1,1,2]) for _ in range(W)]
bot=[PY1-random.choice([0,0,1,1,2,3]) for _ in range(W)]
lef=[PX0+random.choice([0,0,1,1,2]) for _ in range(H)]
rig=[PX1-random.choice([0,0,1,2]) for _ in range(H)]
for y in range(H):
    for x in range(W):
        if top[x]<=y<bot[x] and lef[y]<=x<rig[y]: poster[y,x]=True
# torn corner bottom-left & burnt missing piece top-right
for y in range(H):
    for x in range(W):
        if x-PX0+(PY1-y)<9: poster[y,x]=False
# drop shadow
for y in range(H):
    for x in range(W):
        if not poster[y,x] and y>=2 and x>=2 and poster[y-2,x-2]:
            cv.px(x,y,lerp(tuple(cv.a[y,x]),(20,10,4),0.6))
for y in range(H):
    for x in range(W):
        if poster[y,x]:
            # stains / aging via noise
            n=math.sin(x*0.21+y*0.05)*math.cos(y*0.17-x*0.04)+0.6*math.sin(x*0.07+y*0.11+1.3)
            c=PAP
            if n>0.95: c=LT if (x+y)%2 else PAP
            if n>1.25: c=LT
            if n<-1.0 and (x+y)%2==0: c=PAPL
            # edge darkening
            e=min(x-lef[y],rig[y]-1-x,y-top[x],bot[x]-1-y)
            if e<=1: c=MD
            elif e==2: c=LT
            elif e==3 and (x+y)%2==0: c=LT
            cv.px(x,y,c)
# fold creases
for y in range(PY0+2,PY1-2):
    if poster[y,75]: cv.px(75,y,LT if y%3 else MD)
for x in range(PX0+2,PX1-2):
    if poster[106,x]: cv.px(x,106,LT if x%3 else MD)
# --- title ---
def hr(y,x0=PX0+8,x1=PX1-8,c=INK):
    for x in range(x0,x1): cv.px(x,y,c)
hr(21); hr(23)
draw_text(cv,'WANTED',24,W//2,27,INK,center=True,shadow=(1,1,DK))
hr(50); hr(52)
text35(cv,'DEAD  OR  ALIVE',W//2,55,DK,center=True)
# --- portrait ---
FX0,FY0,FX1,FY1=33,63,117,140
cv.rect(FX0-2,FY0-2,FX1+2,FY1+2,INK); cv.rect(FX0-1,FY0-1,FX1+1,FY1+1,PAP); cv.rect(FX0,FY0,FX1,FY1,INK)
# sepia sea/sky backdrop with dither
for y in range(FY0+1,FY1-1):
    for x in range(FX0+1,FX1-1):
        t=(y-FY0)/(FY1-FY0)
        c=PAPL if t<0.55 else LT
        if 0.55<=t<0.6 and (x+y)%2: c=PAPL
        # hatch lines for sky
        if t<0.55 and (x-y)%6==0 and t>0.1: c=PAP
        # waves
        if t>=0.6 and (x+int(3*math.sin(y*0.9)))%9<2: c=MD
        cv.px(x,y,c)
# sun
for y in range(FY0+6,FY0+18):
    for x in range(FX1-22,FX1-8):
        if (x-(FX1-15))**2+(y-(FY0+12))**2<=30: cv.px(x,y,LT)
from art_blackstache import build
art=build()
cmap={'K':INK,'D':DK,'M':MD,'L':LT,'W':PAPL,'B':INK,'b':DK}
h=len(art); w=len(art[0])
spr=np.zeros((h,w,4),np.uint8)
for y,r in enumerate(art):
    for x,c in enumerate(r):
        if c in cmap: spr[y,x,:3]=cmap[c]; spr[y,x,3]=255
big=upscale(spr,2)
bx=W//2-big.shape[1]//2; by=FY0+5
big=big[:FY1-by]
cv.paste(big,bx,by)
# --- name ---
draw_text(cv,'BLACKSTACHE',12,W//2,146,INK,center=True,shadow=(1,1,MD))
text35(cv,'SCOURGE OF THE PIXEL SEAS',W//2,160,DK,center=True)
hr(168,PX0+18,PX1-18,DK)
# reward
text35(cv,'REWARD',W//2,172,INK,center=True,scale=1)
def coin(cx,cy):
    for dy in range(-3,4):
        for dx in range(-3,4):
            d=dx*dx+dy*dy
            if d<=10: cv.px(cx+dx,cy+dy,INK if d>6 else (LT if (dx+dy)<0 else MD))
    cv.px(cx,cy-1,INK); cv.px(cx,cy,INK); cv.px(cx,cy+1,INK)
draw_text(cv,'999.999 G',12,W//2,179,INK,center=True)
coin(PX0+13,185); coin(PX1-14,185)
# --- bullet holes ---
def hole(cx,cy):
    for dy in range(-3,4):
        for dx in range(-3,4):
            d=dx*dx+dy*dy
            if d<=2: cv.px(cx+dx,cy+dy,(24,12,6))
            elif d<=5 and (dx+dy)%2==0: cv.px(cx+dx,cy+dy,DK)
            elif d<=9 and random.random()<0.35: cv.px(cx+dx,cy+dy,MD)
    for k in range(5):
        ang=random.random()*6.28; L=random.randint(3,5)
        for r in range(2,L): cv.px(int(cx+math.cos(ang)*r),int(cy+math.sin(ang)*r),MD)
hole(112,40); hole(40,120)
# --- dagger pinning top-right corner ---
BL=(206,212,222); BLD=(120,128,146); BLL=(244,246,250); HND=(70,36,16); HNDL=(118,66,30); GLD=(232,184,64); GLDD=(150,104,28)
tipx,tipy=118,34
for i in range(18):
    x=tipx+i; y=tipy-i
    w=1 if i<3 else 2
    cv.px(x,y,BL); cv.px(x+1,y,BLD); cv.px(x,y-1,BLL)
    if w==2: cv.px(x+1,y+1,BLD); cv.px(x-1,y,BLL) if i<16 else None
# shadow of blade on paper
for i in range(3,16): cv.px(tipx+i+2,tipy-i+3,LT)
# guard
gx,gy=tipx+18,tipy-18
for k in range(-5,6): cv.px(gx+k,gy+k,GLD); cv.px(gx+k+1,gy+k,GLDD)
cv.px(gx-6,gy-6,GLDD); cv.px(gx+6,gy+6,GLDD)
# handle
for i in range(1,10):
    x=gx+i; y=gy-i
    cv.px(x,y,HND); cv.px(x+1,y,HND); cv.px(x,y-1,HNDL); cv.px(x+1,y+1,(40,18,6))
    if i%3==0: cv.px(x,y,GLDD)
# pommel
px_,py_=gx+11,gy-11
for dy in range(-2,2):
    for dx in range(-1,3): cv.px(px_+dx,py_+dy,GLD)
cv.px(px_+2,py_+1,GLDD); cv.px(px_,py_-2,(255,230,140))
# nails other corners
for (nx,ny) in [(19,19),(131,193),(21,187)]:
    if poster[ny,nx]:
        cv.rect(nx-1,ny-1,nx+2,ny+2,(70,70,78)); cv.px(nx-1,ny-1,(170,170,180)); cv.px(nx+1,ny+1,(36,36,40))
save_sleeve(cv,'02_wanted',5)
