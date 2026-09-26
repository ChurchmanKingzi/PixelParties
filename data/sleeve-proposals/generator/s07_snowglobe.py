from pp import *
from font35 import text35, width35
from snowmen import snowman, dog, SW, SL, SD, SO
random.seed(8)
W,H=150,210
cv=Canvas(W,H,(20,24,52))
# --- background: cozy night with bokeh ---
dither_gradient(cv,0,0,W,H,[(16,18,44),(30,28,70),(56,34,80)])
for _ in range(0):
    bx,by=random.randint(0,W),random.randint(0,H)
    r=random.randint(3,7); col=random.choice([(255,200,110),(255,150,140),(150,210,255),(255,236,160)])
    for y in range(by-r,by+r+1):
        for x in range(bx-r,bx+r+1):
            d=math.hypot(x-bx,y-by)
            if d<=r and 0<=x<W and 0<=y<H:
                a=0.28 if d<r-1 else 0.45
                cv.px(x,y,lerp(tuple(cv.a[y,x]),col,a))
# falling snow outside
for _ in range(70):
    x,y=random.randint(0,W-1),random.randint(0,H-1)
    cv.px(x,y,(200,210,240))
# --- base ---
BASE=(110,40,40); BASEL=(150,64,56); BASED=(70,24,26); GT=(236,190,80); GTD=(170,120,40)
GCX,GCY,GR=75,92,60
for y in range(146,198):
    t=(y-146)/52
    hw=int(46+12*t)
    for x in range(GCX-hw,GCX+hw+1):
        c=BASE
        if x<GCX-hw+4: c=BASEL
        if x>GCX+hw-5: c=BASED
        cv.px(x,y,c)
cv.rect(GCX-60,194,GCX+61,200,BASED); cv.rect(GCX-60,194,GCX+61,195,GT)
for x in range(GCX-48,GCX+49): cv.px(x,150,GT); cv.px(x,151,GTD)
for x in range(GCX-57,GCX+58): cv.px(x,190,GT); cv.px(x,191,GTD)
# plaque
PX0,PY0,PX1,PY1=34,162,116,183
cv.rect(PX0,PY0,PX1,PY1,GTD); cv.rect(PX0+1,PY0+1,PX1-1,PY1-1,GT); cv.rect(PX0+2,PY0+2,PX1-2,PY1-2,(250,220,120))
for (sx,sy) in [(PX0+3,PY0+3),(PX1-4,PY0+3),(PX0+3,PY1-4),(PX1-4,PY1-4)]: cv.px(sx,sy,GTD)
text35(cv,'MISCHIEF',75,PY0+5,(110,60,20),center=True)
text35(cv,'MILITIA',75,PY0+12,(110,60,20),center=True)
def flake(cx,cy,c):
    for k in range(-3,4):
        cv.px(cx+k,cy,c); cv.px(cx,cy+k,c)
        if abs(k)<3: cv.px(cx+k,cy+k,c); cv.px(cx+k,cy-k,c)
flake(25,172,GT); flake(125,172,GT)
# --- globe interior ---
inside=np.zeros((H,W),bool)
for y in range(H):
    for x in range(W):
        if math.hypot(x-GCX,y-GCY)<=GR: inside[y,x]=True
# sky inside
for y in range(GCY-GR,GCY+GR+1):
    for x in range(GCX-GR,GCX+GR+1):
        if 0<=y<H and inside[y,x]:
            t=(y-(GCY-GR))/(2*GR)
            stops=[(120,150,220),(170,190,240),(210,210,246)]
            f=t*2; i=min(int(f),1); fr=f-i
            c=stops[i+1] if fr>BAYER4[y%4,x%4] else stops[i]
            cv.px(x,y,c)
# distant mountains
for x in range(GCX-GR,GCX+GR):
    hgt=int(GCY+8-14*abs(math.sin((x-40)*0.045))-6*abs(math.sin(x*0.13)))
    for y in range(hgt,GCY+30):
        if 0<=y<H and inside[y,x]:
            c=(150,160,210)
            if y<hgt+3: c=(236,240,255)
            cv.px(x,y,c)
# snowy ground
for x in range(GCX-GR,GCX+GR+1):
    gy=int(GCY+22+5*math.sin((x-GCX)*0.05)-4*math.cos((x-GCX)*0.11))
    for y in range(gy,GCY+GR+1):
        if 0<=y<H and inside[y,x]:
            c=SW if y<gy+2 else (SL if (x+y)%7 else SD)
            if y>gy+10: c=SL if (x*3+y)%11 else SD
            cv.px(x,y,c)
# pine trees
def pine(x,y,h):
    for k in range(h):
        w=(k*5)//h+1
        for dx in range(-w,w+1):
            X,Y=x+dx,y-h+k
            if 0<=Y<H and inside[Y,X]:
                c=(40,110,80) if dx<=0 else (26,80,62)
                if k%4==0 and abs(dx)>=w-1: c=SW
                cv.px(X,Y,c)
    cv.rect(x-1,y,x+1,y+3,(90,60,40))
    cv.px(x,y-h-1,SW)
pine(30,112,22); pine(40,108,16); pine(118,110,20); pine(110,116,14)
# snow fort
FX0,FX1,FY=56,98,118
for y in range(FY-12,FY):
    for x in range(FX0,FX1):
        c=SW if (y-FY)%4 else SD
        if (y-FY)%4 and ((x+ (y//4)*3)%7==0): c=SD
        cv.px(x,y,c)
for x in range(FX0,FX1,6): cv.rect(x,FY-16,x+4,FY-12,SW); cv.rect(x,FY-13,x+4,FY-12,SL)
# fort flag
for k in range(20): cv.px(77,FY-16-k,(110,70,40))
for j in range(7):
    for i in range(10-j//2):
        cv.px(78+i,FY-36+j,(220,50,70) if j%3 else (250,250,255))
# snowmen
sm=[('wizard',52,130),('knight',94,132),('grad',70,138),('banner',32,134),('heli',108,92)]
for kind,x,y in sm:
    s=snowman(kind)
    h=s.shape[0]; w=s.shape[1]
    # clip to globe
    for yy in range(h):
        for xx in range(w):
            if s[yy,xx,3]:
                X,Y=x-w//2+xx,y-h+yy
                if 0<=X<W and 0<=Y<H and inside[Y,X]: cv.px(X,Y,tuple(s[yy,xx,:3]))
d=dog()
cv.paste(d,104,127)
# snowballs being thrown + pile
for (x,y) in [(58,96),(64,92),(86,100)]:
    for (dx,dy) in [(0,0),(1,0),(0,1),(1,1)]: cv.px(x+dx,y+dy,SW)
    cv.px(x+2,y+1,SD); cv.px(x-1,y+1,(200,200,230))
# snowflakes inside
for _ in range(80):
    x,y=random.randint(GCX-GR,GCX+GR),random.randint(GCY-GR,GCY+GR)
    if inside[y,x] and y<GCY+20:
        cv.px(x,y,(255,255,255))
        if random.random()<0.2:
            for (dx,dy) in [(1,0),(-1,0),(0,1),(0,-1)]: cv.px(x+dx,y+dy,(230,236,255))
# --- glass effects ---
for y in range(GCY-GR-2,GCY+GR+3):
    for x in range(GCX-GR-2,GCX+GR+3):
        d=math.hypot(x-GCX,y-GCY)
        if GR-1<=d<=GR+1 and 0<=y<H:
            ang=math.atan2(y-GCY,x-GCX)
            c=(220,236,255) if (ang<-0.8 and ang>-2.8) else (120,140,190)
            if y>146: continue
            cv.px(x,y,c)
        elif GR-5<=d<GR-1 and 0<=y<H and y<146:
            ang=math.atan2(y-GCY,x-GCX)
            if -2.9<ang<-1.9 and (x+y)%2==0: cv.px(x,y,lerp(tuple(cv.a[y,x]),(255,255,255),0.6))
# big highlight arc upper-left
for y in range(GCY-GR,GCY):
    for x in range(GCX-GR,GCX):
        d=math.hypot(x-(GCX-8),y-(GCY-6))
        if GR-14<=d<=GR-11 and inside[y,x]:
            ang=math.atan2(y-GCY,x-GCX)
            if -2.6<ang<-1.75: cv.px(x,y,lerp(tuple(cv.a[y,x]),(255,255,255),0.7))
# small sparkle
for (sx,sy) in [(44,52),(48,48)]:
    cv.px(sx,sy,(255,255,255))
cv.rect(40,56,43,59,(255,255,255))
# base top collar over globe bottom
for y in range(144,152):
    for x in range(GCX-50,GCX+51):
        t=(y-144)/8
        if abs(x-GCX)<=44+6*t: cv.px(x,y,BASEL if abs(x-GCX)<44 else BASED)
for x in range(GCX-46,GCX+47): cv.px(x,144,GT); cv.px(x,145,GTD)
# title above
draw_text(cv,'LET IT SNOW!',11,75,10,(255,255,255),center=True,outline_c=(30,30,80),shadow=(1,1))
save_sleeve(cv,'07_snow_globe',5)
