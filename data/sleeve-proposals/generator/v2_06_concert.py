from px2 import *
from font35 import text35, width35
random.seed(21)
W,H=W2,H2
cv=C2((16,6,26))
dither_gradient(cv,0,0,W,260,[(14,6,26),(30,10,48),(52,16,72),(76,24,92)])
# backdrop LED wall: faint grid of dots
for y in range(100,236,4):
    for x in range(40,212,4):
        cv.px(x,y,(70,30,90) if (x//4+y//4)%3 else (96,40,120))
# big emblem on the backdrop: harpy wings + note
EM=[(120,60,150),(170,90,200)]
for s in (-1,1):
    for k in range(9):
        for t in range(40-k*3):
            x=125+s*(14+t); y=150-k*5+int(t*0.35)+ (t*t)//90
            cv.px(x,y,EM[k%2]); cv.px(x,y+1,EM[0])
for y in range(128,168):
    for x in range(118,133):
        if (x-125)**2/40+(y-160)**2/40<=1 or (x in (130,131) and y<160): cv.px(x,y,EM[1])
# ---------- truss + lamps ----------
TR=[(40,40,52),(90,90,108),(150,150,170)]
for x in range(0,W):
    for y in (84,94): cv.px(x,y,TR[1]); cv.px(x,y+1,TR[0])
for x in range(0,W,10):
    for k in range(10):
        cv.px(x+k,85+k,TR[1]); cv.px(x+k,94-k,TR[1])
LAMPS=[(28,(255,90,180)),(78,(90,220,255)),(125,(255,240,160)),(172,(255,210,80)),(222,(170,110,255))]
TARGET=[118,40,125,210,130]
def beam(x0,y0,x1,y1,spread,col,strength=0.4):
    for y in range(y0,y1):
        t=(y-y0)/(y1-y0); cx=x0+(x1-x0)*t; hw=3+spread*t
        for x in range(int(cx-hw),int(cx+hw)+1):
            if 0<=x<W:
                e=abs(x-cx)/hw; a=max(0.0,strength*(1-e**2))*(1-t*0.3)
                if BAYER4[y%4,x%4]<a*1.6: cv.px(x,y,lerp(tuple(cv.a[y,x]),col,0.45))
for (lx,c),tx in zip(LAMPS,TARGET): beam(lx,98,tx,262,30,c)
for lx,c in LAMPS:
    cv.rect(lx-5,95,lx+6,104,TR[0]); cv.rect(lx-4,96,lx+5,103,TR[1]); cv.rect(lx-3,102,lx+4,106,c)
    cv.rect(lx-1,103,lx+2,105,(255,255,255)); cv.rect(lx-6,94,lx+7,96,TR[2])
# haze
hz=noise(H,W,12,seed=4,octaves=2)
for y in range(150,262):
    for x in range(W):
        if hz[y,x]>0.55 and BAYER4[y%4,x%4]<(hz[y,x]-0.55)*1.5: cv.px(x,y,lerp(tuple(cv.a[y,x]),(200,150,230),0.25))
# ---------- amp stacks ----------
def amp(x0,y0,w,h):
    AM=[(18,16,22),(34,32,40),(56,54,64),(90,88,100)]
    cv.rect(x0,y0,x0+w,y0+h,AM[1]); cv.rect(x0,y0,x0+w,y0+2,AM[3]); cv.rect(x0+w-2,y0,x0+w,y0+h,AM[0])
    for y in range(y0+5,y0+h-4):
        for x in range(x0+3,x0+w-4):
            cv.px(x,y,AM[0] if (x+y)%2 else AM[2])
    cv.rect(x0+4,y0+2,x0+10,y0+4,(236,220,180))
amp(8,186,44,30); amp(8,216,44,36); amp(198,186,44,30); amp(198,216,44,36)
# ---------- stage floor ----------
FL=[(60,34,20),(96,58,34),(128,82,48),(160,108,64)]
for y in range(252,278):
    for x in range(W):
        c=FL[2]
        if (y-252)%6==0: c=FL[0]
        elif (x+((y-252)//6)*17)%29==0: c=FL[0]
        elif (y-252)%6==1: c=FL[3]
        cv.px(x,y,c)
# coloured light pools on floor
for (lx,c),tx in zip(LAMPS,TARGET):
    for y in range(252,278):
        for x in range(tx-34,tx+35):
            d=((x-tx)/34)**2+((y-262)/10)**2
            if d<1 and 0<=x<W and BAYER4[y%4,x%4]<(1-d)*0.6: cv.px(x,y,lerp(tuple(cv.a[y,x]),c,0.35))
cv.rect(0,276,W,282,(40,20,14)); cv.rect(0,276,W,277,(200,140,80))
for x in range(6,W,16):
    cv.rect(x,272,x+7,276,(255,236,170)); cv.px(x+3,271,(255,255,230))
# ---------- band ----------
def load(k): return np.array(Image.open(f'sprites/{k}.png')).copy()
def prep(a,grade,k=0.1):
    s=quant_colors(a,14); s=scale2x(s)
    s=shade_pass(s,light=(-0.5,-0.85),strength=0.22,ambient=grade,amb_k=k,rim=(255,220,255))
    return outline(s,(20,8,26))
metal=load('h_metal'); metal[:13,:10,3]=0; metal[30:,27:,3]=0
metal=prep(metal,(120,40,140))
shanty=prep(load('h_shanty2'),(60,120,200))
ballad=prep(load('h_ballad'),(200,160,90))
rap=prep(load('h_rap'),(200,60,160))
def shadow(x,y,w):
    for dx in range(w):
        for dy in range(3):
            if (x+dx+dy)%2==0: cv.px(x+dx,y+dy,(40,20,14))
# riser for the rapper (back)
cv.rect(76,216,136,254,(44,28,40)); cv.rect(76,216,136,219,(120,80,110))
for x in range(78,134,6): cv.rect(x,222,x+3,252,(30,18,28))
shadow(86,213,40); cv.paste(rap,84,216-rap.shape[0]+2)
# ballad (right)
shadow(166,262,70); cv.paste(ballad,168,264-ballad.shape[0])
# metal (left) + completing the flames above the guitar
mx,my=16,262-metal.shape[0]
shadow(24,258,56); cv.paste(metal,mx,my)
FIRE=[(120,16,10),(186,34,16),(236,90,30),(255,160,50),(255,224,120),(255,250,220)]
fn=noise(H,W,3,seed=41,octaves=2)
fx,fy=mx+34,my+8
for y in range(fy-44,fy+10):
    for x in range(fx-28,fx+28):
        if not(0<=x<W and 0<=y<H): continue
        t=(fy+10-y)/54
        wid=22*(1-t)**0.7*(0.8+0.3*math.sin(y*0.4+x*0.2))+(fn[y,x]-0.5)*12
        if abs(x-fx)<wid:
            v=(1-abs(x-fx)/max(1,wid))*(1-t*0.7)+(fn[y,x]-0.5)*0.3
            v=max(0,min(0.999,v))*6; i=int(v); f=v-i
            c=FIRE[min(5,i+1)] if f>BAYER4[y%4,x%4] else FIRE[i]
            if i==0 and (x+y)%2: continue
            cv.px(x,y,c)
# shanty + ship-wheel podium in front of his lower body
sx,sy=102,268-shanty.shape[0]-22
cv.paste(shanty,sx,sy)
WC,WY=134,250
WD=[(60,30,14),(110,62,30),(160,100,52),(206,146,84)]
for y in range(WY-26,WY+27):
    for x in range(WC-30,WC+31):
        d=math.hypot(x-WC,y-WY); a=math.atan2(y-WY,x-WC)
        spoke=min(abs(((a*8/math.pi)%2)-1),9)<0.12 and d<24
        c=None
        if 17<=d<=21: c=WD[2] if (x+y)%2 else WD[1]
        elif 21<d<=22.5 or 16<=d<17: c=WD[0]
        elif spoke and d>5: c=WD[3] if a<0 else WD[2]
        elif d<5: c=WD[3] if x<WC else WD[1]
        if c: cv.px(x,y,c)
for k in range(8):
    a=k*math.pi/4
    hx,hy=WC+math.cos(a)*25,WY+math.sin(a)*25
    for dy in range(-2,3):
        for dx in range(-2,3):
            if dx*dx+dy*dy<=5: cv.px(int(hx)+dx,int(hy)+dy,WD[2] if dx+dy<0 else WD[0])
# podium post
cv.rect(WC-4,WY+22,WC+5,276,WD[1]); cv.rect(WC-4,WY+22,WC-2,276,WD[2])
# mic stand for rapper
cv.rect(130,190,132,216,(150,150,170)); cv.rect(128,188,134,192,(60,60,70))
# ---------- curtains (relief, velvet) ----------
CH=np.zeros((H,W),np.float32); CMk=np.zeros((H,W),bool)
for y in range(0,300):
    for side in (0,1):
        wid=int(12+14*abs((y-170)/130)**0.8+3*math.sin(y*0.05)) if y>40 else 250
        if y<=40: continue
        for i in range(wid):
            x=i if side==0 else W-1-i
            CMk[y,x]=True
            CH[y,x]=math.sin(i*0.55+y*0.01)*1.4+ (i/wid)*0.3
for y in range(0,44):
    for x in range(W):
        d=6*abs(math.sin(x*math.pi/25))
        if y<34+d: CMk[y,x]=True; CH[y,x]=math.sin(x*0.5)*1.2+ (1.6 if y>30+d else 0)
VEL=[(56,6,24),(100,14,40),(150,26,56),(196,50,76),(230,96,110)]
relief(cv,CH,np.zeros((H,W),np.int32),[VEL],CMk,k=1.1,bias=-0.05)
GT=[(120,80,20),(200,150,50),(250,210,100)]
for x in range(W):
    d=int(6*abs(math.sin(x*math.pi/25)))
    cv.px(x,34+d,GT[1]); cv.px(x,35+d,GT[0])
    if x%25==12:
        for k in range(8): cv.px(x,36+d+k,GT[2] if k<5 else GT[1]); cv.px(x+1,36+d+k,GT[1])
        for dx in range(-2,4): cv.px(x+dx,44+d,GT[1])
for (tx,ty) in [(8,170),(242,170)]:
    for k in range(-3,4): cv.rect(tx-8,ty+k,tx+9,ty+k+1,GT[1] if k%2 else GT[2])
# ---------- title ----------
grad=lambda yy,h: [(255,252,214),(255,228,110),(255,164,60),(246,86,126)][min(3,yy*4//h)]
draw_text(cv,'HARPY',32,125,46,None,center=True,outline_c=(30,6,40),shadow=(2,3),grad=grad)
draw_text(cv,'FORMERS',28,125,76,None,center=True,outline_c=(30,6,40),shadow=(2,3),grad=grad)
# ribbon
RB=[(120,20,60),(200,40,90),(240,90,130)]
for y in range(106,118):
    for x in range(58,193):
        cv.px(x,y,RB[1] if 108<y<116 else RB[0])
for s in (-1,1):
    x0=58 if s<0 else 192
    for k in range(8):
        for y in range(108+k//3,118-k//3): cv.px(x0+s*(k+1),y,RB[0])
m=text_mask('LIVE IN CONCERT',9)
for yy,xx in zip(*np.where(m)): cv.px(125-m.shape[1]//2+xx,108+yy,(255,244,230))
# notes
NOTE=["..##","..#.","..#.","###.","##.."]; NOTE2=["####","#..#","#..#","#.##","#.##"]
def note(x,y,c,s):
    for j,r in enumerate(s):
        for i,ch in enumerate(r):
            if ch=='#': cv.rect(x+i*2,y+j*2,x+i*2+2,y+j*2+2,c)
for (x,y,c,s) in [(52,130,(255,120,200),NOTE),(86,146,(120,230,255),NOTE2),(168,136,(255,230,110),NOTE),(196,124,(190,140,255),NOTE2),(140,176,(255,120,200),NOTE)]:
    note(x,y,c,s)
# ---------- crowd ----------
CRW=[(22,8,30),(40,16,52)]
RIMS=[c for _,c in LAMPS]
random.seed(4)
def person(x,hy,hw,col,rim,arm):
    for y in range(hy-hw,hy+hw):
        for xx in range(x-hw,x+hw):
            if (xx-x)**2+(y-hy)**2<=hw*hw: cv.px(xx,y,col)
    cv.rect(x-hw-7,hy+hw-3,x+hw+7,H,col)
    for xx in range(x-hw+2,x+hw-1):
        y=hy-int(math.sqrt(max(0,hw*hw-(xx-x)**2)))
        cv.px(xx,y,lerp(rim,col,0.3))
        if (xx+y)%2==0: cv.px(xx,y+1,lerp(rim,col,0.65))
    if arm:
        side=random.choice([-1,1]); ax=x+side*(hw+4); ay=hy+hw
        lean=random.choice([-1,0,1])
        for k in range(24):
            X=ax+(lean*k)//7
            cv.rect(X-2,ay-k,X+2,ay-k+1,col)
            if k>3: cv.px(X-2 if side<0 else X+1,ay-k,lerp(rim,col,0.55))
        tx,ty=ax+(lean*24)//7,ay-24
        kind=random.random()
        if kind<0.35:
            cv.rect(tx-3,ty-4,tx+4,ty+1,col); cv.rect(tx-3,ty-10,tx-1,ty-4,col); cv.rect(tx+2,ty-10,tx+4,ty-4,col)
            cv.px(tx-3,ty-10,rim); cv.px(tx+2,ty-10,rim)
        elif kind<0.7:
            cv.rect(tx-3,ty-12,tx+4,ty,(30,30,40)); cv.rect(tx-2,ty-11,tx+3,ty-2,(200,230,255))
            for dy in range(-16,4):
                for dx in range(-7,8):
                    if dx*dx+(dy+6)**2<60 and BAYER4[(ty+dy)%4,(tx+dx)%4]<0.3: cv.px(tx+dx,ty+dy,lerp(tuple(cv.a[ty+dy,tx+dx]),(200,230,255),0.3))
        else:
            gc=random.choice([(120,255,180),(255,120,220),(120,220,255)])
            cv.rect(tx-3,ty-4,tx+4,ty+1,col)
            for k in range(10): cv.px(tx+k//4,ty-4-k,gc); cv.px(tx+k//4+1,ty-4-k,lerp(gc,(255,255,255),0.4))
for layer,(base,col,prob) in enumerate([(304,CRW[1],0.55),(326,CRW[0],0.5)]):
    x=random.randint(-8,0)
    while x<W+8:
        hw=random.randint(9,12)
        person(x,base-random.randint(0,6),hw,col,random.choice(RIMS),random.random()<prob)
        x+=hw*2+random.randint(6,12)
# confetti
CF=[(255,90,110),(255,200,70),(90,210,140),(90,170,255),(200,120,255),(255,255,255)]
for _ in range(90):
    x,y=random.randint(0,W-1),random.randint(40,300)
    c=random.choice(CF); cv.px(x,y,c)
    if random.random()<0.5: cv.px(x+1,y+(1 if random.random()<0.5 else 0),c)
save2(cv,'06_harpyformers_live')
