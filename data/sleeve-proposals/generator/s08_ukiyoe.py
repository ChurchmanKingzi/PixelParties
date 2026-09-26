from pp import *
from font35 import text35, width35
import art_kitsune as KT
random.seed(12)
W,H=150,210
PAPER=(238,224,192); PAPER2=(228,212,178)
cv=Canvas(W,H,PAPER)
for y in range(H):
    for x in range(W):
        n=math.sin(x*1.7+y*0.3)*math.sin(y*1.3-x*0.2)
        if n>0.85: cv.px(x,y,PAPER2)
dither_gradient(cv,0,0,W,48,[IND0:=(44,60,110),(52,70,120),(92,112,158),(170,170,180),PAPER])
# sun
SCX,SCY,SR=75,90,40
SUN=(214,58,44); SUN2=(196,44,36)
for y in range(SCY-SR,SCY+SR+1):
    for x in range(SCX-SR,SCX+SR+1):
        d=math.hypot(x-SCX,y-SCY)
        if d<=SR: cv.px(x,y,SUN if d<SR-2 or (x+y)%2 else SUN2)
# far mountain (fuji)
MT=(84,100,150); MTD=(62,78,126); SNOW=(246,242,232)
for x in range(W):
    peak=abs(x-36)
    top=int(122+peak*0.62) if peak<60 else 200
    if peak<5: top=122+peak//2
    top2=int(132+abs(x-116)*0.5)
    t=min(top,top2)
    for y in range(t,176):
        c=MT if (x<40 or (x>70 and x<112)) else MTD
        if top<=top2 and y<126+int(3*abs(math.sin(x*0.7)))+ (0 if peak<12 else -20) and peak<14: c=SNOW
        cv.px(x,y,c)
# stylized cloud bands
CL=(244,236,214); CLO=(160,120,100)
def cloud(x0,x1,y,h):
    for x in range(x0,x1):
        for yy in range(y,y+h):
            cv.px(x,yy,CL)
    for x in range(x0,x1): cv.px(x,y-1,CLO); cv.px(x,y+h,CLO)
    for k in range(h+2):
        yy=y-1+k
        dx=int(math.sqrt(max(0,(h/2+1)**2-(k-h/2-0.5)**2)))
        for xx in range(x0-dx,x0): cv.px(xx,yy,CL)
        for xx in range(x1,x1+dx): cv.px(xx,yy,CL)
        cv.px(x0-dx,yy,CLO); cv.px(x1+dx,yy,CLO)
cloud(6,48,134,5); cloud(104,146,146,4); cloud(52,80,120,3)
# near hills
for x in range(W):
    hy=int(160+6*math.sin(x*0.06+1)+3*math.sin(x*0.2))
    for y in range(hy,186):
        c=(56,98,74) if (x+y)%5 else (44,82,62)
        cv.rect(x,y,x+1,y+1,c)
    cv.px(x,hy,(84,130,96))
# rock the fox sits on
RK=(96,86,84); RKL=(140,128,120); RKD=(62,54,56)
for y in range(162,190):
    t=(y-162)/28
    hw=int(26+t*14)
    for x in range(75-hw,75+hw):
        c=RK
        if x<75-hw+4 or y<164: c=RKL
        if x>75+hw-6: c=RKD
        if (x*7+y*3)%17==0: c=RKD
        cv.px(x,y,c)
# fox
fox=outline(KT.to_rgba(KT.build()),(250,242,222))
fh,fw=fox.shape[:2]
cv.paste(fox,75-fw//2,167-fh)
# seigaiha waves at bottom
WAVE=(44,62,116); WAVEL=(236,230,214); WAVEM=(96,120,170)
Y0=184
for y in range(Y0,H):
    for x in range(W):
        cv.px(x,y,WAVE)
R=9
rows=[]
for j,cy in enumerate(range(Y0+4,H+R,5)):
    for i,cx in enumerate(range(-R+(j%2)*R, W+R, 2*R)):
        for y in range(cy-R,cy+1):
            for x in range(cx-R,cx+R+1):
                d=math.hypot(x-cx,y-cy)
                if d<=R and 0<=x<W and Y0<=y<H:
                    ring=int(d)%3
                    c=WAVEL if ring==0 else (WAVEM if ring==1 else WAVE)
                    if d>R-1: c=WAVE
                    cv.px(x,y,c)
# foam crest
for x in range(W):
    cv.px(x,Y0,WAVEL); 
    if x%3: cv.px(x,Y0-1,WAVEL)
# sakura branch from top-left
BR=(70,44,40); BRL=(110,70,56)
pts=[(-4,44),(14,36),(30,34),(46,26),(62,24),(80,16),(96,14)]
def thick_line(p0,p1,w):
    n=max(abs(p1[0]-p0[0]),abs(p1[1]-p0[1]))+1
    for i in range(n):
        t=i/max(1,n-1); x=round(p0[0]+(p1[0]-p0[0])*t); y=round(p0[1]+(p1[1]-p0[1])*t)
        for dy in range(w):
            cv.px(x,y+dy,BR if dy>0 else BRL)
for i in range(len(pts)-1): thick_line(pts[i],pts[i+1],max(1,4-i//2))
for (p0,p1) in [((30,34),(38,46)),((46,26),(50,12)),((62,24),(72,34)),((14,36),(8,24)),((80,16),(86,4))]:
    thick_line(p0,p1,2)
PK=(246,176,196); PKL=(255,222,232); PKD=(222,110,146)
def blossom(x,y):
    for (dx,dy) in [(0,-2),(2,0),(0,2),(-2,0),(1,-1),(1,1),(-1,1),(-1,-1),(0,-1),(1,0),(0,1),(-1,0)]:
        cv.px(x+dx,y+dy,PK)
    for (dx,dy) in [(0,-2),(-2,0)]: cv.px(x+dx,y+dy,PKL)
    cv.px(x+2,y+1,PKD); cv.px(x+1,y+2,PKD)
    cv.px(x,y,(250,220,110))
for (x,y) in [(14,32),(22,38),(34,30),(40,44),(50,14),(54,22),(64,20),(72,32),(84,10),(90,18),(8,24),(26,30),(46,32),(78,22),(98,12),(6,40),(58,28)]:
    blossom(x,y)
# falling petals
for _ in range(22):
    x,y=random.randint(4,146),random.randint(40,170)
    if math.hypot(x-SCX,y-SCY)<SR+1 or True:
        cv.px(x,y,PK); cv.px(x+1,y,PKD)
# title cartouche (vertical)
CX0,CY0,CX1,CY1=124,44,140,100
cv.rect(CX0-1,CY0-1,CX1+1,CY1+1,(120,30,30)); cv.rect(CX0,CY0,CX1,CY1,(246,236,210)); cv.rect(CX0+1,CY0+1,CX1-1,CY1-1,(180,50,40)); cv.rect(CX0+2,CY0+2,CX1-2,CY1-2,(246,236,210))
for i,ch in enumerate('KITSUNE'):
    text35(cv,ch,CX0+7,CY0+5+i*7,(40,30,50))
# hanko seal
HX,HY=124,104
cv.rect(HX,HY,HX+16,HY+16,(200,40,40)); cv.rect(HX+1,HY+1,HX+15,HY+15,(226,64,54))
cv.rect(HX+2,HY+2,HX+14,HY+14,(200,40,40))
text35(cv,'PP',HX+8,HY+6,(246,230,210),center=True)
save_sleeve(cv,'08_ukiyoe_kitsune',5)
