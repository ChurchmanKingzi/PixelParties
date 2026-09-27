from px2 import *
from font35 import text35, width35
import snowmen2 as SM
random.seed(8)
W,H=W2,H2
cv=C2((18,22,48))
# ---------- window at night ----------
dither_gradient(cv,0,0,W,H,[(10,14,38),(20,26,62),(34,40,86),(52,54,104)])
# distant snowy rooftops outside
for x in range(W):
    hy=int(236+10*math.sin(x*0.04)+ (12 if (x//30)%3==0 else 0))
    for y in range(hy,H):
        cv.px(x,y,(30,34,70) if y>hy+3 else (160,170,210))
for (wx,wy) in [(20,248),(48,244),(170,250),(212,246)]:
    cv.rect(wx,wy,wx+5,wy+6,(255,210,120)); cv.rect(wx+2,wy,wx+3,wy+6,(120,90,60))
# snowfall outside (two sizes)
for _ in range(160):
    x,y=random.randint(0,W-1),random.randint(0,H-1)
    cv.px(x,y,(200,210,240))
for _ in range(30):
    x,y=random.randint(0,W-2),random.randint(0,H-2)
    cv.rect(x,y,x+2,y+2,(230,236,255))
# window frame (wood, relief) with cross bar
FH=np.zeros((H,W),np.float32); FM=np.zeros((H,W),bool)
def bar(x0,y0,x1,y1):
    for y in range(y0,y1):
        for x in range(x0,x1):
            FM[y,x]=True; e=min(x-x0,x1-1-x,y-y0,y1-1-y); FH[y,x]=min(e,3)*0.8
bar(0,0,W,10); bar(0,0,10,H); bar(W-10,0,W,H); bar(120,0,130,236)
FH+=(noise(H,W,3,seed=5)-0.5)*0.4
WOOD=[(40,22,14),(70,40,24),(104,62,36),(140,90,52),(176,122,72)]
relief(cv,FH,np.zeros((H,W),np.int32),[WOOD],FM,k=1.3)
# frost in the window corners
fr=noise(H,W,4,seed=13,octaves=3)
for y in range(H):
    for x in range(W):
        if FM[y,x]: continue
        dc=min(math.hypot(x-10,y-10),math.hypot(x-120,y-10),math.hypot(x-130,y-10),math.hypot(x-240,y-10))
        if dc<70 and fr[y,x]>0.35+dc/110:
            cv.px(x,y,lerp(tuple(cv.a[y,x]),(210,226,255),0.55 if (x+y)%2 else 0.35))
# fairy lights string
LC=[(255,90,90),(255,210,90),(110,220,140),(110,170,255),(230,120,255)]
pts=[]
for x in range(0,W):
    y=int(18+14*abs(math.sin(x*math.pi/125)))
    cv.px(x,y,(30,40,30)); pts.append((x,y))
for i,x in enumerate(range(6,W,14)):
    y=int(18+14*abs(math.sin(x*math.pi/125)))+2
    c=LC[i%len(LC)]
    for dy in range(-6,9):
        for dx in range(-6,7):
            d=math.hypot(dx,dy-2)
            if d<7 and BAYER4[(y+dy)%4,(x+dx)%4]<(1-d/7)*0.5: cv.px(x+dx,y+dy,lerp(tuple(cv.a[y+dy,x+dx]),c,0.4))
    cv.rect(x-1,y,x+2,y+4,c); cv.px(x-1,y,lerp(c,(255,255,255),0.6)); cv.rect(x-1,y-1,x+2,y,(60,70,60))
# ---------- table / sill ----------
TY=300
for y in range(TY,H):
    for x in range(W):
        g=math.sin(x*0.06+math.sin(y*0.8)*1.5+y*0.2)
        v=2 if g<0.5 else 3
        if g<-0.8: v=1
        if y<TY+2: v=4
        elif y>H-4: v=0
        cv.px(x,y,WOOD[v])
# ---------- base (carved wood, relief) ----------
GCX,GCY,GR=125,150,96
BH=np.zeros((H,W),np.float32); BM=np.zeros((H,W),bool); BMat=np.zeros((H,W),np.int32)
for y in range(236,304):
    t=(y-236)/68
    hw=70+t*22
    for x in range(int(GCX-hw),int(GCX+hw)):
        BM[y,x]=True
        e=min(x-(GCX-hw),GCX+hw-x)
        BH[y,x]=min(e,6)*0.5+ (2.2 if y<242 else 0)+(1.4 if 290<y<296 else 0)
        if y in (242,243,289,290): BH[y,x]-=1.0
# brass plaque
PX0,PY0,PX1,PY1=70,254,180,282
for y in range(PY0,PY1):
    for x in range(PX0,PX1):
        e=min(x-PX0,PX1-1-x,y-PY0,PY1-1-y)
        BH[y,x]=3+min(e,2)*0.7; BMat[y,x]=1

# carved snowflakes
for (fx,fy) in [(44,268),(206,268)]:
    for k in range(-6,7):
        for (dx,dy) in [(k,0),(0,k),(k,k),(k,-k)]:
            if abs(k)<6 or dx==0 or dy==0: BH[fy+dy,fx+dx]+=1.3
BH+=(noise(H,W,3,seed=15)-0.5)*0.5*BM
BRASS=[(80,50,14),(140,96,30),(200,150,50),(240,200,90),(255,236,160)]
relief(cv,BH,BMat,[WOOD,BRASS],BM,k=1.2,bias=0.02)
for t_,yo in (('MISCHIEF',PY0+4),('MILITIA',PY0+15)):
    m=text_mask(t_,9); mh,mw=m.shape
    for yy_,xx_ in zip(*np.where(m)):
        cv.px(125-mw//2+xx_+1,yo+yy_+1,(255,236,160)); 
    for yy_,xx_ in zip(*np.where(m)):
        cv.px(125-mw//2+xx_,yo+yy_,(90,54,16))
# ---------- globe interior ----------
yy,xx=np.indices((H,W))
dist=np.hypot(xx-GCX,yy-GCY)
inside=(dist<=GR)&(yy<238)
sky=[(120,150,220),(150,176,236),(186,200,246),(212,220,250)]
for y in range(GCY-GR,238):
    for x in range(GCX-GR,GCX+GR+1):
        if inside[y,x]:
            t=(y-(GCY-GR))/(238-(GCY-GR))
            v=t*3; i=min(2,int(v)); f=v-i
            cv.px(x,y,sky[i+1] if f>BAYER4[y%4,x%4] else sky[i])
# mountains inside
MT=[(120,130,190),(146,156,210),(236,240,255)]
for x in range(GCX-GR,GCX+GR):
    top=int(158-18*abs(math.sin((x-40)*0.03))-8*abs(math.sin(x*0.11)))
    for y in range(top,240):
        if inside[y,x]:
            c=MT[0] if (x+y)%3 else MT[1]
            if y<top+4+int(2*math.sin(x)): c=MT[2]
            cv.px(x,y,c)
# snow ground (relief)
SH=np.zeros((H,W),np.float32); SMk=np.zeros((H,W),bool)
for x in range(GCX-GR,GCX+GR+1):
    gy=int(178+6*math.sin((x-GCX)*0.05)-5*math.cos((x-GCX)*0.09))
    for y in range(gy,240):
        if inside[y,x]: SMk[y,x]=True; SH[y,x]=min(y-gy,4)*0.6+2*math.sin(x*0.12)*0.3
SH+=(noise(H,W,3,seed=17)-0.5)*0.6
SNOW=[(120,124,180),(170,174,220),(210,214,244),(240,242,255),(255,255,255)]
relief(cv,SH,np.zeros((H,W),np.int32),[SNOW],SMk,k=1.4,bias=0.08)
# snow fort (relief bricks)
FH2=np.zeros((H,W),np.float32); FM2=np.zeros((H,W),bool)
FX0,FX1,FY=88,166,182
for y in range(FY-24,FY+2):
    for x in range(FX0,FX1):
        if not inside[y,x]: continue
        merlon=y<FY-18 and ((x-FX0)%12)>=6
        if y<FY-18 and not merlon: continue
        FM2[y,x]=True
        row=(y-(FY-24))//6; bx=(x-FX0+(row%2)*6)%12; by=(y-(FY-24))%6
        e=min(bx,11-bx,by,5-by)
        FH2[y,x]=0.4+min(e,2)*0.7
relief(cv,FH2,np.zeros((H,W),np.int32),[SNOW],FM2,k=1.3,bias=0.02)
# flag on fort
for k in range(30): cv.px(128,FY-24-k,(110,70,40)); cv.px(129,FY-24-k,(80,50,30))
for j in range(10):
    for i in range(16-j//2):
        wave=int(1.5*math.sin(i*0.5))
        cv.px(130+i,FY-54+j+wave,(214,50,70) if (j//3)%2==0 else (250,250,255))
# pines inside
def pine(x,y,h):
    for k in range(h):
        w=int(k*0.42)+1
        for dx in range(-w,w+1):
            X,Y=x+dx,y-h+k
            if inside[Y,X]:
                c=(40,110,80) if dx<=0 else (26,80,62)
                if k%6 in (0,1) and abs(dx)>=w-2: c=(240,244,255)
                if k%6==0 and abs(dx)<w-1 and (dx%2==0): c=(220,228,250)
                cv.px(X,Y,c)
    for k in range(4): cv.px(x,y+k,(90,60,40)); cv.px(x+1,y+k,(70,46,30))
for (x,y,h) in [(56,188,34),(74,184,26),(194,186,36),(178,192,24),(44,198,22)]: pine(x,y,h)
# snowmen + dog
def put(s,x,ybot,flip=False):
    if flip: s=s[:,::-1]
    h,w=s.shape[:2]
    for yy_ in range(h):
        for xx_ in range(w):
            if s[yy_,xx_,3]:
                X,Y=x+xx_,ybot-h+yy_
                if 0<=Y<H and 0<=X<W and inside[Y,X]: cv.px(X,Y,tuple(s[yy_,xx_,:3]))
    # contact shadow
    for dx in range(4,w-4):
        X,Y=x+dx,ybot
        if inside[Y,X] and (X+Y)%2==0: cv.px(X,Y,(150,156,210))
put(SM.sprite('knight'),44,214)
put(SM.sprite('wizard'),84,220)
put(SM.sprite('grad'),120,224,True)
put(SM.sprite('blade'),160,212,True)
put(SM.sprite('dog'),170,224)
put(SM.sprite('heli'),150,128)
put(SM.sprite('plain'),150,138) if False else None
# snowballs in flight
for (x,y) in [(112,150),(126,142),(100,160)]:
    for dy in range(-2,3):
        for dx in range(-2,3):
            if dx*dx+dy*dy<=5: cv.px(x+dx,y+dy,(255,255,255) if dx+dy<0 else (200,204,236))
    for k in range(1,5): cv.px(x-2-k*2,y+k,(230,236,255)) if (k%2) else None
# snowflakes inside
for _ in range(120):
    x,y=random.randint(GCX-GR,GCX+GR),random.randint(GCY-GR,236)
    if inside[y,x]:
        cv.px(x,y,(255,255,255))
        if random.random()<0.15:
            for (dx,dy) in [(1,0),(-1,0),(0,1),(0,-1)]: cv.px(x+dx,y+dy,(230,236,255))
# ---------- glass ----------
for y in range(GCY-GR-3,240):
    for x in range(GCX-GR-3,GCX+GR+4):
        d=dist[y,x]
        if GR-1.5<=d<=GR+1.2:
            a=math.atan2(y-GCY,x-GCX)
            cv.px(x,y,(226,238,255) if -2.9<a<-0.6 else (110,130,190))
        elif GR-6<=d<GR-1.5 and y<238:
            a=math.atan2(y-GCY,x-GCX)
            if -2.8<a<-1.6 and BAYER4[y%4,x%4]<0.55: cv.px(x,y,lerp(tuple(cv.a[y,x]),(255,255,255),0.55))
            if 0.2<a<1.3 and BAYER4[y%4,x%4]<0.4: cv.px(x,y,lerp(tuple(cv.a[y,x]),(40,50,110),0.35))
# big highlight arc + window reflection
for y in range(GCY-GR,GCY):
    for x in range(GCX-GR,GCX):
        d=math.hypot(x-(GCX-12),y-(GCY-10))
        if GR-22<=d<=GR-17 and inside[y,x]:
            a=math.atan2(y-GCY,x-GCX)
            if -2.55<a<-1.75: cv.px(x,y,lerp(tuple(cv.a[y,x]),(255,255,255),0.75))
for y in range(GCY-70,GCY-40):
    for x in range(GCX+30,GCX+56):
        if inside[y,x] and ((x-GCX-30)<4 or (y-GCY+70)<4) and (x+y)%2==0:
            cv.px(x,y,lerp(tuple(cv.a[y,x]),(255,255,255),0.4))
# base collar over globe bottom
CH=np.zeros((H,W),np.float32); CMk=np.zeros((H,W),bool)
for y in range(228,240):
    for x in range(GCX-80,GCX+81):
        t=(y-228)/12
        if abs(x-GCX)<=68+12*t: CMk[y,x]=True; CH[y,x]=1.5+ (1.5 if y<231 else 0)
relief(cv,CH,np.zeros((H,W),np.int32),[BRASS],CMk,k=1.2)
save2(cv,'07_snow_globe')
