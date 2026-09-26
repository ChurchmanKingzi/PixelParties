from pp import *
from font35 import text35, width35
random.seed(10)
W,H=75,105
cv=Canvas(W,H,(92,64,140))
# wall: stripes
for y in range(H):
    for x in range(W):
        c=(98,70,150) if (x//4)%2==0 else (86,60,134)
        cv.px(x,y,c)
# polka sparkles on wall
for _ in range(14):
    x,y=random.randint(0,W-1),random.randint(20,70); cv.px(x,y,(140,110,190))
# floor
for y in range(86,H):
    for x in range(W):
        c=(150,96,62) if ((x+ (y//3)*5)//9)%2==0 else (132,84,54)
        if y==86: c=(80,48,30)
        cv.px(x,y,c)
# baseboard
cv.rect(0,84,W,86,(230,220,240)); cv.rect(0,85,W,86,(170,160,190))
# --- bunting ---
FLAGS=[(255,90,110),(255,200,70),(90,210,140),(90,170,255),(200,120,255)]
def bunting(x0,x1,y0,sag,off=0):
    pts=[]
    for x in range(x0,x1+1):
        t=(x-x0)/(x1-x0); y=int(y0+sag*4*t*(1-t))
        cv.px(x,y,(240,240,250)); pts.append((x,y))
    for i,xx in enumerate(range(x0+2,x1-2,6)):
        t=(xx-x0)/(x1-x0); y=int(y0+sag*4*t*(1-t))+1
        c=FLAGS[(i+off)%len(FLAGS)]
        for k in range(4):
            for dx in range(-(3-k)+1,(3-k)):
                cv.px(xx+dx+1,y+k,c)
bunting(-2,40,2,6); bunting(35,77,2,6,2)
# --- balloons ---
def balloon(cx,cy,c,string_len=18):
    for y in range(cy-5,cy+6):
        for x in range(cx-4,cx+5):
            if ((x-cx)/4.3)**2+((y-cy)/5.4)**2<=1: cv.px(x,y,c)
    d=tuple(int(v*0.7) for v in c)
    for y in range(cy-5,cy+6):
        for x in range(cx-4,cx+5):
            if ((x-cx)/4.3)**2+((y-cy)/5.4)**2<=1 and (x-cx)+(y-cy)*0.6>3: cv.px(x,y,d)
    cv.px(cx-2,cy-3,(255,255,255)); cv.px(cx-2,cy-2,(255,240,250)); cv.px(cx-1,cy-4,(255,255,255))
    cv.px(cx,cy+6,d); cv.px(cx-1,cy+6,d); cv.px(cx+1,cy+6,d)
    for k in range(string_len):
        cv.px(cx+int(1.2*math.sin(k*0.5)),cy+7+k,(230,230,240))
balloon(8,30,(255,80,110)); balloon(16,24,(255,200,60),22); balloon(66,28,(80,190,255)); balloon(58,22,(150,230,120),20)
# --- banner ---
BX0,BX1,BY0=10,65,12
cv.rect(BX0,BY0,BX1,BY0+9,(255,244,220)); cv.rect(BX0,BY0+9,BX1,BY0+10,(210,180,150))
for (sx,dirn) in [(BX0,-1),(BX1,1)]:
    for k in range(4):
        cv.rect(sx+dirn*(k+1) if dirn>0 else sx-(k+1),BY0+2+k//2,(sx+dirn*(k+1)+1) if dirn>0 else sx-k,BY0+9-k//2,(230,70,100))
cols=[(255,80,110),(255,160,40),(240,200,40),(80,190,110),(60,160,240),(160,100,240)]
txt='PIXEL PARTIES'
x=W//2-width35(txt)//2
for i,ch in enumerate(txt):
    text35(cv,ch,x+i*4,BY0+3,cols[i%len(cols)])
# --- characters ---
def load(k): return np.array(Image.open(f'sprites/{k}.png')).copy()
tobi=load('tobi'); maho=load('maho'); willy=load('willy'); corgi=load('corgi'); inya=load('inya')
inya[:,16:,3]=0; inya[:,:1,3]=0
OUT=(40,24,50)
def party_hat(x,y,c1,c2):
    for k in range(8):
        w=k//2
        for dx in range(-w,w+1):
            cv.px(x+dx,y+k,c1 if ((k+dx)//2)%2==0 else c2)
    cv.px(x,y-1,(255,255,255)); cv.px(x-1,y-1,(255,240,120)); cv.px(x+1,y-1,(255,240,120)); cv.px(x,y-2,(255,240,120))
    for dx in range(-4,5): cv.px(x+dx,y+8,OUT) if abs(dx)==4 else None
def put(s,x,y,hat=None,flip=False):
    so=outline(s,OUT)
    cv.paste(so,x,y,flip=flip)
    if hat:
        op=np.where(so[...,3]>0)
        top=op[0].min(); xs=op[1][op[0]==top]
        hx=x+int(xs.mean()) if not flip else x+so.shape[1]-1-int(xs.mean())
        party_hat(hx+hat[2],y+top-7+hat[3],hat[0],hat[1])
put(inya,48,57,((255,90,110),(255,240,240),0,1))
# --- table + cake ---
TX0,TX1,TY=20,55,80
cv.rect(TX0,TY,TX1,TY+3,(255,250,250))
for x in range(TX0,TX1):
    for y in range(TY+3,TY+10):
        if y<TY+3+ (3 if (x//3)%2 else 5): cv.px(x,y,(255,250,250) if (x//3)%2 else (255,200,220))
cv.rect(TX0+2,TY+8,TX0+4,H,(110,70,50)); cv.rect(TX1-4,TY+8,TX1-2,H,(110,70,50))
# cake tiers
def tier(cx,y,w,h,base,icing):
    cv.rect(cx-w//2,y,cx+w//2+1,y+h,base)
    cv.rect(cx-w//2,y,cx+w//2+1,y+2,icing)
    for x in range(cx-w//2,cx+w//2+1,3): cv.px(x,y+2,icing); cv.px(x+1,y+3,icing) if x%2 else None
    cv.rect(cx+w//2-1,y,cx+w//2+1,y+h,tuple(int(v*0.8) for v in base))
    for x in range(cx-w//2+2,cx+w//2-1,4): cv.px(x,y+h-2,(255,80,110))
CXC=37
tier(CXC,70,28,10,(250,200,150),(255,160,200))
tier(CXC,62,20,8,(250,200,150),(255,250,250))
tier(CXC,55,12,7,(250,200,150),(255,160,200))
# candles
for i,cx_ in enumerate([CXC-4,CXC,CXC+4]):
    c=[(90,170,255),(255,200,60),(150,230,120)][i]
    cv.rect(cx_,50,cx_+1,55,c); cv.px(cx_,49,(255,220,110)); cv.px(cx_,48,(255,150,50))
# strawberry on top
# --- presents ---
def gift(x,y,w,h,c,rib):
    cv.rect(x,y,x+w,y+h,c); cv.rect(x+w//2,y,x+w//2+1,y+h,rib); cv.rect(x,y+h//3,x+w,y+h//3+1,rib)
    cv.px(x+w//2-1,y-1,rib); cv.px(x+w//2+1,y-1,rib); cv.px(x+w//2-2,y-2,rib); cv.px(x+w//2+2,y-2,rib)
    cv.rect(x+w-1,y,x+w,y+h,tuple(int(v*0.75) for v in c))
gift(47,74,7,6,(90,170,255),(255,240,120))
put(willy,-1,60)
put(maho,11,64,((90,170,255),(255,255,255),0,3))
put(tobi,56,60,((150,230,120),(255,240,120),0,2))
put(corgi,29,85)
# party horn for tobi
for k in range(7): cv.px(61-k,73-k//3,(255,90,110) if k%2 else (255,240,120))
cv.px(54,70,(255,240,120)); cv.px(53,69,(255,90,110)); cv.px(53,71,(90,170,255))
# candle flames
for cx_ in [CXC-4,CXC,CXC+4]:
    cv.px(cx_,49,(255,240,140)); cv.px(cx_,48,(255,170,60)); cv.px(cx_+1,49,(255,200,90)); cv.px(cx_,47,(255,120,50))
# disco ball
DBX,DBY=37,33
for k in range(DBY-8,DBY-4): cv.px(DBX,k,(200,200,210))
for y in range(DBY-4,DBY+5):
    for x in range(DBX-4,DBX+5):
        if (x-DBX)**2+(y-DBY)**2<=18:
            c=(190,196,214) if (x+y)%2 else (140,146,170)
            if (x-DBX)+(y-DBY)<-3: c=(240,244,255)
            cv.px(x,y,c)
for (dx,dy) in [(-7,-2),(7,1),(-6,5),(6,-5)]:
    cv.px(DBX+dx,DBY+dy,(255,255,255)); cv.px(DBX+dx+1,DBY+dy,(220,230,255)); cv.px(DBX+dx-1,DBY+dy,(220,230,255)); cv.px(DBX+dx,DBY+dy+1,(220,230,255)); cv.px(DBX+dx,DBY+dy-1,(220,230,255))
# confetti
CF=[(255,90,110),(255,200,70),(90,210,140),(90,170,255),(200,120,255),(255,255,255)]
for _ in range(60):
    x,y=random.randint(0,W-1),random.randint(8,H-6)
    c=random.choice(CF); cv.px(x,y,c)
    if random.random()<0.3: cv.px(x+1,y,c)
save_sleeve(cv,'10_pixel_party',10)
