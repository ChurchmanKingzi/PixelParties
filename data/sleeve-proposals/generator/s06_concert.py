from pp import *
from font35 import text35, width35
random.seed(21)
W,H=150,210
cv=Canvas(W,H,(18,8,30))
# --- backdrop: dark stage wall with dither gradient ---
dither_gradient(cv,0,0,W,160,[(20,8,34),(44,14,60),(70,20,80)])
# speaker stacks / truss hint
TR=(60,60,76)
for x in range(0,W):
    cv.px(x,66,TR); cv.px(x,70,TR)
for x in range(0,W,6):
    for k in range(4): cv.px(x+k,67+k if k<3 else 70,TR)
# lamps on truss
LAMPS=[(20,(255,90,170)),(55,(90,220,255)),(95,(255,220,90)),(130,(160,110,255))]
# --- light beams (additive dither) ---
def beam(x0,y0,x1,y1,spread,col,strength=0.35):
    for y in range(y0,y1):
        t=(y-y0)/(y1-y0)
        cx=x0+(x1-x0)*t; hw=2+spread*t
        for x in range(int(cx-hw),int(cx+hw)+1):
            if 0<=x<W and 0<=y<H:
                edge=abs(x-cx)/hw
                a=max(0.0,strength*(1-edge**2))
                if (x+y)%2==0 or edge<0.5:
                    cv.px(x,y,lerp(tuple(cv.a[y,x]),col,a))
for (lx,c),tx in zip(LAMPS,[70,30,120,80]):
    beam(lx,72,tx,142,20,c,0.42)
for lx,c in LAMPS:
    cv.rect(lx-3,70,lx+4,75,(40,40,50)); cv.rect(lx-2,74,lx+3,76,c); cv.px(lx,75,(255,255,255))
# --- curtains ---
CR=(150,20,60); CRL=(200,50,90); CRD=(90,10,40); GT=(236,180,60)
for side in (0,1):
    for y in range(0,172):
        wid=int(16+6*math.sin(y*0.02)+ (y/172)*6)
        for i in range(wid):
            x=i if side==0 else W-1-i
            fold=(i*3)%9
            c=CR if fold<4 else (CRL if fold<6 else CRD)
            if i==wid-1: c=CRD
            cv.px(x,y,c)
    # tie-back
    ty=110
    for k in range(-2,3):
        x0=(18 if side==0 else W-24)
        cv.rect(x0,ty+k,x0+6,ty+k+1,GT)
# valance
for x in range(W):
    d=int(3*abs(math.sin(x*math.pi/15)))
    for y in range(0,12+d):
        c=CR if (x//3)%3 else CRL
        cv.px(x,y,c)
    cv.px(x,12+d,GT); cv.px(x,13+d,(170,120,40))
    if x%15==7: 
        for k in range(4): cv.px(x,14+d+k,GT)
# --- stage floor ---
FL=(120,74,40); FLL=(160,104,58); FLD=(80,46,24)
for y in range(138,156):
    for x in range(W):
        c=FL
        if (y-138)%5==0: c=FLD
        elif (x+ (y//5)*13)%23==0: c=FLD
        cv.px(x,y,c)
cv.rect(0,138,W,139,FLL)
# stage front edge
cv.rect(0,154,W,158,(50,26,14)); cv.rect(0,154,W,155,(180,120,60))
# footlights
for x in range(8,W,14):
    cv.rect(x,152,x+4,154,(255,236,160)); 
    for dx in range(-2,7):
        if (x+dx)%2==0 and x+dx<W: cv.px(x+dx,151,lerp(tuple(cv.a[151,x+dx]),(255,230,150),0.5))
# --- band ---
def load(k): return np.array(Image.open(f'sprites/{k}.png')).copy()
metal=load('h_metal'); metal[:14,:9,3]=0
shanty=load('h_shanty'); 
sub=shanty[...,:3].astype(int)
for yy in range(22,shanty.shape[0]):
    for xx in range(shanty.shape[1]):
        r,g,b=sub[yy,xx]
        if r>g>b and r<200 and r-b>40: shanty[yy,xx,3]=0
shanty[26:,:,3]=0
ballad=load('h_ballad')
sub=ballad[...,:3].astype(int)
for yy in range(24,ballad.shape[0]):
    for xx in range(30,ballad.shape[1]):
        r,g,b=sub[yy,xx]
        if r>g>b and r<200 and (r-b)>30 and g<150: ballad[yy,xx,3]=0
ballad[:,38:,3]=np.where(ballad[:,38:,3]>0,ballad[:,38:,3],0)
rap=load('h_rap')
def shadow(x,y,w):
    for dx in range(w):
        if (dx+y)%2==0: cv.px(x+dx,y,(50,28,14))
# mic stand for shanty
cv.rect(77,114,78,142,(150,150,160)); cv.rect(74,142,81,143,(150,150,160))
cv.paste(outline(ballad,(20,8,20)),101,107)
cv.paste(outline(metal,(20,8,20)),2,102)
cv.paste(outline(rap,(20,8,20)),36,117)
cv.paste(outline(shanty,(20,8,20)),61,106)
# monitor speakers
for mx in (46,92):
    cv.rect(mx,144,mx+14,152,(30,30,38)); cv.rect(mx+1,145,mx+13,151,(50,50,60))
    for k in range(3): cv.rect(mx+3+k*4,147,mx+5+k*4,149,(20,20,26))
# --- music notes ---
NOTE=["..##","..#.","..#.","###.","##.."]
NOTE2=["####","#..#","#..#","#.##","#.##"]
def note(x,y,c,shape=NOTE):
    for j,r in enumerate(shape):
        for i,ch in enumerate(r):
            if ch=='#': cv.px(x+i,y+j,c); cv.px(x+i+1,y+j+1,(20,8,30)) if False else None
for (x,y,c,s) in [(30,88,(255,120,200),NOTE),(56,84,(120,230,255),NOTE2),(92,92,(255,230,110),NOTE),(122,86,(190,140,255),NOTE2),(76,80,(255,120,200),NOTE),(104,78,(120,230,255),NOTE)]:
    note(x,y,c,s)
# --- title ---
grad=lambda yy,h: [(255,252,210),(255,226,100),(255,160,60),(246,84,120)][min(3,yy*4//h)]
draw_text(cv,'HARPY',24,W//2,18,None,center=True,outline_c=(30,8,40),shadow=(2,2),grad=grad)
draw_text(cv,'FORMERS',20,W//2,40,None,center=True,outline_c=(30,8,40),shadow=(2,2),grad=grad)
text35(cv,'* LIVE IN CONCERT *',W//2,59,(255,255,255),center=True,shadow=(1,1,(120,20,80)))
# --- crowd silhouettes ---
CRW=(20,6,28); CRW2=(44,16,58)
RIMS=[(255,90,170),(90,220,255),(255,220,90),(160,110,255)]
random.seed(4)
def person(x,hy,hw,col,rim,arm):
    for y in range(hy-hw,hy+hw):
        for xx in range(x-hw,x+hw):
            if (xx-x)**2+(y-hy)**2<=hw*hw: cv.px(xx,y,col)
    cv.rect(x-hw-5,hy+hw-2,x+hw+5,H,col)
    for xx in range(x-hw-5,x+hw+5): cv.px(xx,hy+hw-2,col)
    # rim light on top of head
    for xx in range(x-hw+2,x+hw-1):
        y=hy-int(math.sqrt(max(0,hw*hw-(xx-x)**2)))
        cv.px(xx,y,lerp(rim,col,0.35))
    cv.px(x-hw-4,hy+hw-2,lerp(rim,col,0.5)); cv.px(x+hw+4,hy+hw-2,lerp(rim,col,0.5))
    if arm:
        side=random.choice([-1,1]); ax=x+side*(hw+3); ay=hy+hw
        lean=random.choice([-1,0,1])
        for k in range(17):
            X=ax+ (lean*k)//6
            cv.rect(X-1,ay-k,X+3,ay-k+1,col)
            if k>2: cv.px(X-1 if side<0 else X+2,ay-k,lerp(rim,col,0.6))
        tx=ax+(lean*17)//6; ty=ay-17
        kind=random.random()
        if kind<0.35:  # rock horns
            cv.rect(tx-2,ty-3,tx+3,ty+1,col); cv.rect(tx-2,ty-7,tx-1,ty-3,col); cv.rect(tx+2,ty-7,tx+3,ty-3,col)
            cv.px(tx-2,ty-7,rim); cv.px(tx+2,ty-7,rim)
        elif kind<0.7:  # lighter
            cv.rect(tx-2,ty-3,tx+3,ty+1,col); cv.rect(tx-1,ty-6,tx+2,ty-3,(150,150,160))
            for (dx,dy,c) in [(0,-7,(255,240,150)),(0,-8,(255,190,70)),(1,-7,(255,200,90)),(0,-9,(255,120,50))]: cv.px(tx+dx,ty+dy,c)
        else:  # glowstick
            cv.rect(tx-2,ty-3,tx+3,ty+1,col)
            gc=random.choice([(120,255,180),(255,120,220),(120,220,255)])
            for k in range(7): cv.px(tx+k//3,ty-3-k,gc)
for layer,(base,col,prob) in enumerate([(176,CRW2,0.55),(192,CRW,0.5)]):
    x=random.randint(-6,0)
    while x<W+6:
        hw=random.randint(6,8)
        person(x,base-random.randint(0,5),hw,col,random.choice(RIMS),random.random()<prob)
        x+=hw*2+random.randint(5,9)
# ticket stub
TX0,TY0=100,188
save_sleeve(cv,'06_harpyformers_live',5)
