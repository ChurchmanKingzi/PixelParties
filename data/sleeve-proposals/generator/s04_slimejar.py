from pp import *
from font35 import text35, width35
from slimes import slime, KINDS, shade
random.seed(11)
W,H=150,210
cv=Canvas(W,H,(46,34,62))
# wallpaper: diamond pattern
WP=(52,40,72); WP2=(62,48,84); WP3=(40,30,56)
for y in range(H):
    for x in range(W):
        d=(abs((x%16)-8)+abs((y%16)-8))
        c=WP
        if d==8: c=WP2
        if d==0: c=(88,66,110)
        if (x//16+y//16)%2==0 and d<3: c=WP2
        cv.px(x,y,c)
# vertical dither vignette at edges
for y in range(H):
    for x in range(W):
        e=min(x,W-1-x,y)
        if e<6 and (x+y)%2==0: cv.px(x,y,WP3)
# shelf
SH=(128,80,44); SHL=(168,110,62); SHD=(84,50,26)
cv.rect(0,190,W,H,SH); cv.rect(0,190,W,192,SHL); cv.rect(0,200,W,H,SHD)
for x in range(0,W,3):
    cv.px(x,195+(x//7)%3,SHD)
# shadow under jar
for x in range(26,126):
    if x%2==0: cv.px(x,192,SHD)
# --- jar geometry ---
JX0,JX1=24,126; JTOP=58; JBOT=190; NX0,NX1=38,112; NTOP=40
jar=np.zeros((H,W),bool)
for y in range(NTOP,JBOT):
    for x in range(W):
        if y<50:
            ok=NX0<=x<NX1
        elif y<JTOP:
            t=(y-50)/(JTOP-50)
            hw=(NX1-NX0)/2+((JX1-JX0)-(NX1-NX0))/2*math.sin(t*math.pi/2)
            ok=abs(x-75)<=hw
        else:
            ok=JX0<=x<JX1
            r=12
            if y>JBOT-r:
                if x<JX0+r and (x-(JX0+r))**2+(y-(JBOT-r))**2>r*r: ok=False
                if x>=JX1-r and (x-(JX1-r-1))**2+(y-(JBOT-r))**2>r*r: ok=False
        if ok: jar[y,x]=True
# glass interior tint
GL=(70,96,110)
for y in range(H):
    for x in range(W):
        if jar[y,x]:
            cv.px(x,y,lerp(tuple(cv.a[y,x]),(110,170,170),0.25))
# --- slimes stacked inside ---
order=['rocky','slimy','splashy','hardy','pink','icy','cloudy','shadowy','fiery','slimy','sparky','pink','splashy','rocky','icy','hardy','cloudy','fiery','shadowy','slimy','splashy','pink','sparky','icy']
rows=[]
for i,yb in enumerate(range(186,66,-13)):
    off=0 if i%2==0 else 10
    xs=[24+off+k*20 for k in range(5 if off==0 else 5)]
    xs=[x for x in xs if x<=108]
    rows.append((yb,xs,i))
idx=0
placed=[]
for (ybot,xs,ri) in rows:
    for x in xs:
        k=order[idx%len(order)]; idx+=1
        c,kind=KINDS[k]
        w=random.choice([21,22,23,24]); h=random.choice([15,16,17])
        s=slime(c,w=w,h=h,kind=kind,seed=idx)
        placed.append((ybot,x+random.randint(-2,2),s,w,h))
# draw from top rows to bottom rows
layer=np.zeros((H,W,4),np.uint8)
lc=Canvas(W,H,(0,0,0)); lc.a=np.zeros((H,W,3),np.uint8)
mask=np.zeros((H,W),bool)
def paste_rgba(dst,dmask,s,x,y):
    h,w=s.shape[:2]
    for yy in range(h):
        for xx in range(w):
            if s[yy,xx,3]:
                X,Y=x+xx,y+yy
                if 0<=X<W and 0<=Y<H:
                    dst[Y,X]=s[yy,xx,:3]; dmask[Y,X]=True
for (ybot,x,s,w,h) in sorted(placed,key=lambda p:p[0]):
    PAD=8
    paste_rgba(lc.a,mask,s,x-PAD,ybot-h-PAD)
# clip to jar interior (inset 2)
inner=cv2.erode(jar.astype(np.uint8),np.ones((5,5),np.uint8)).astype(bool)
for y in range(H):
    for x in range(W):
        if mask[y,x] and inner[y,x]:
            cv.px(x,y,lerp(tuple(lc.a[y,x]),(150,210,210),0.12))
# --- escaping shiny slime on top (king) popping out ---
king=slime(KINDS['shiny'][0],w=26,h=19,kind='shiny',seed=99)
kh=king.shape[0]
cv.paste(king,75-king.shape[1]//2,NTOP-19-8+6)
# glass walls: outline + highlights
GE=(180,230,230); GED=(90,130,140)
for y in range(H):
    for x in range(W):
        if jar[y,x]:
            edge=not(jar[y,x-1] and jar[y,x+1] and jar[y-1,x] and jar[y+1,x]) if 0<x<W-1 and 0<y<H-1 else True
            if edge: cv.px(x,y,GE if x<75 else GED)
# redraw king over the neck rim? king sits in the neck; rim drawn behind? draw rim threads
RIM=(170,200,205); RIMD=(110,140,150)
for y in range(NTOP,NTOP+10):
    if y%3==0:
        for x in range(NX0,NX1):
            if not (abs(x-75)<12 and y<NTOP+6): cv.px(x,y,RIM if (x-NX0)<(NX1-NX0)*0.4 else RIMD)
# vertical highlight streaks
for y in range(JTOP+6,JBOT-10):
    for (hx,wid) in [(JX0+6,2),(JX0+10,1),(JX1-9,1)]:
        for k in range(wid):
            if inner[y,hx+k] and (y%9!=0):
                cv.px(hx+k,y,lerp(tuple(cv.a[y,hx+k]),(255,255,255),0.55))
for x in range(NX0+4,NX0+10):
    for y in range(NTOP+11,NTOP+16): pass
# --- lid popped off, flying at top-right ---
LID=(214,178,70); LIDL=(250,226,140); LIDD=(150,112,36); LIDDD=(100,70,20)
lcx,lcy=118,22; ang=math.radians(-22)
for y in range(0,50):
    for x in range(88,150):
        dx,dy=x-lcx,y-lcy
        u=dx*math.cos(ang)+dy*math.sin(ang); v=-dx*math.sin(ang)+dy*math.cos(ang)
        top=(u/17)**2+((v)/5)**2<=1
        side=(abs(u)<=17 and 0<v<=5) or ((u/17)**2+((v-5)/5)**2<=1)
        if side and not top:
            c=LIDD if (int(u)+40)%4 else LIDDD
            cv.px(x,y,c)
        elif top:
            c=LID
            if (u/17)**2+(v/5)**2>0.7: c=LIDL if v<0 else LID
            if u<-6 and v<-1: c=LIDL
            cv.px(x,y,c)
# motion lines
for (x,y) in [(96,40),(92,35),(100,44)]:
    for t in range(6): cv.px(x-t,y+t,(220,220,240))
# "POP!" burst around king
def spark(cx,cy,r=3):
    for k in range(-r,r+1):
        cv.px(cx+k,cy,(255,240,140)); cv.px(cx,cy+k,(255,240,140))
    cv.px(cx,cy,(255,255,255))
for (sx,sy) in [(44,30),(98,56),(50,44)]: spark(sx,sy,2)
text35(cv,'POP!',14,10,(255,240,140),scale=3,shadow=(1,1,(150,60,60)))
# --- label ---
LB=(238,226,196); LBD=(196,178,140); INK=(80,40,60)
lx0,lx1,ly0,ly1=40,110,118,152
for y in range(ly0,ly1):
    for x in range(lx0,lx1):
        c=LB
        if y in (ly0,ly1-1) or x in (lx0,lx1-1): c=LBD
        cv.px(x,y,c)
# scalloped edge
for x in range(lx0,lx1,4):
    cv.px(x+2,ly0-1,LB); cv.px(x+1,ly0-1,LBD); cv.px(x+2,ly1,LB); cv.px(x+3,ly1,LBD)
for x in range(lx0+3,lx1-3):
    cv.px(x,ly0+3,(200,60,110)); cv.px(x,ly1-4,(200,60,110))
draw_text(cv,'SLIMES',11,75,ly0+6,INK,center=True)
text35(cv,'FRESH BATCH',75,ly0+18,(140,70,100),center=True)
text35(cv,'DO NOT SHAKE',75,ly0+24,(200,60,110),center=True)
# --- escaped slimes on the shelf ---
s1=slime(KINDS['splashy'][0],w=16,h=12,kind='plain',seed=5); cv.paste(s1,-2,190-12-8+1)
s2=slime(KINDS['pink'][0],w=14,h=11,kind='plain',seed=6); cv.paste(s2,124,190-11-8+1)
# drip trail on shelf
for x in range(4,24):
    if x%3: cv.px(x,191,(80,150,220))
save_sleeve(cv,'04_slime_jar',5)
