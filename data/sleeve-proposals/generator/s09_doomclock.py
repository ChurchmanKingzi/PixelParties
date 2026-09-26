from pp import *
from font35 import text35, width35
random.seed(9)
W,H=150,210
cv=Canvas(W,H,(40,6,10))
dither_gradient(cv,0,0,W,150,[(30,4,14),(80,10,20),(150,30,24),(220,90,40),(250,160,70)])
# stars in upper sky
for _ in range(25):
    x,y=random.randint(0,W-1),random.randint(0,40); cv.px(x,y,(255,200,190))
CX,CY,R=75,74,52
# corona rays behind
for a_ in range(0,360,10):
    L=R+10+ (6 if a_%20==0 else 0)
    for r in range(R,L):
        x=int(CX+math.cos(math.radians(a_))*r); y=int(CY+math.sin(math.radians(a_))*r)
        if (r+a_//10)%2==0: cv.px(x,y,(255,190,90))
for y in range(CY-R-8,CY+R+9):
    for x in range(CX-R-8,CX+R+9):
        d=math.hypot(x-CX,y-CY)
        if R<d<=R+5 and (x+y)%2==0 and 0<=y<H: cv.px(x,y,lerp(tuple(cv.a[y,x]),(255,200,100),0.4))
# --- sun stone ---
G=(222,170,70); GL=(255,222,126); GD=(150,96,34); GDD=(96,56,20); RED=(196,44,40); TQ=(60,170,160); TQD=(30,110,110)
GLYPHS=[["###","#.#","###"],["#.#",".#.","#.#"],[".#.","###",".#."],["##.","#.#",".##"],["###","..#","###"]]
for y in range(CY-R,CY+R+1):
    for x in range(CX-R,CX+R+1):
        dx,dy=x-CX,y-CY; d=math.hypot(dx,dy)
        if d>R: continue
        a=(math.degrees(math.atan2(dy,dx))+90)%360   # 0 = up
        c=G
        if d>R-2: c=GDD
        elif d>R-10:
            # serpent band: scales
            s=int(a/7)%2; c=GD if (int(d)+s)%3==0 else G
            if int(a)%45<3: c=RED
        elif d>R-12: c=GDD
        elif d>R-22:
            # rays: 8 big + 8 small triangles
            k=a%45; big=int(a/45)
            t=(d-(R-22))/10
            if abs(k-22.5)<(1-t)*14: c=GL if k<22.5 else G
            elif abs(k-0)<(1-t)*5 or abs(k-45)<(1-t)*5: c=TQ
            else: c=GD
        elif d>R-24: c=GDD
        elif d>R-27:
            c=GL if int(a/6)%2==0 else G  # beads
        elif d>R-29: c=GDD
        elif d>R-38:
            c=G
            # glyph cells 20
            cell=int(a/18)
            if (a%18)<1.2: c=GDD
        elif d>R-40: c=GDD
        else:
            c=(236,190,90) if d<R-44 else G
        cv.px(x,y,c)
# glyph patterns in cells
for i in range(20):
    ang=math.radians(i*18+9-90)
    gx=int(CX+math.cos(ang)*(R-33.5)); gy=int(CY+math.sin(ang)*(R-33.5))
    gl=GLYPHS[i%len(GLYPHS)]
    for yy,row in enumerate(gl):
        for xx,ch in enumerate(row):
            if ch=='#': cv.px(gx-1+xx,gy-1+yy,GDD if i%3 else RED)
# 12 skull hour markers on bead ring
def mini_skull(x,y):
    S=["###","#.#","###",".#."]
    S=[".###.","#####","#.#.#","#####",".#.#."]
    for yy,row in enumerate(S):
        for xx,ch in enumerate(row):
            if ch=='#': cv.px(x-2+xx,y-2+yy,(248,240,220))
            elif ch=='.' and yy==2: cv.px(x-2+xx,y-2+yy,(150,20,20))
for h in range(12):
    ang=math.radians(h*30-90)
    mini_skull(int(round(CX+math.cos(ang)*(R-17))),int(round(CY+math.sin(ang)*(R-17))))
# center skull face
FACE=[
"....######....",
"..##########..",
".############.",
"##############",
"###..####..###",
"##....##....##",
"##..R.##.R..##",
"###..#..#..###",
"######..######",
".#####..#####.",
"..##########..",
"..#.#.##.#.#..",
"..##########..",
"...#.#..#.#...",
]
fy0=CY-7; fx0=CX-7
for yy,row in enumerate(FACE):
    for xx,ch in enumerate(row):
        if ch=='#': cv.px(fx0+xx,fy0+yy,(252,244,224))
        elif ch=='R': cv.px(fx0+xx,fy0+yy,(255,60,50))
        elif ch=='.' and 3<yy<13 and 0<xx<13: cv.px(fx0+xx,fy0+yy,(40,14,10))
# clock hands: 11:59
def hand(angle_deg,length,width,col,tip):
    a=math.radians(angle_deg-90)
    for r in range(4,length):
        for w in range(-width,width+1):
            x=CX+math.cos(a)*r - math.sin(a)*w*0.8
            y=CY+math.sin(a)*r + math.cos(a)*w*0.8
            cv.px(int(round(x)),int(round(y)),col if r<length-4 else tip)
hand(-18,R-8,1,(24,18,28),(230,50,40))
hand(-1.5,R-26,1,(24,18,28),(230,50,40))
for (dx,dy) in [(0,0),(1,0),(0,1),(1,1),(-1,0),(0,-1)]: cv.px(CX+dx,CY+dy,(255,210,90))
# --- pyramid ---
ST=(150,132,110); STL=(186,168,140); STD=(104,88,74); STDD=(70,58,50)
PTOP=128
for i in range(7):
    y0=PTOP+i*12; y1=y0+12
    hw=30+i*14
    for y in range(y0,y1):
        for x in range(CX-hw,CX+hw):
            c=ST
            if y==y0: c=STL
            if y==y1-1: c=STD
            if (x-(CX-hw)+ (i%2)*4)%8==0 and y0<y<y1-1: c=STD
            if y==y0+6 and (x+i)%2==0: c=lerp(ST,STD,0.4)
            cv.px(x,y,c)
    # side shading
    for y in range(y0,y1):
        cv.px(CX-hw,y,STDD); cv.px(CX+hw-1,y,STDD)
# central staircase
for y in range(PTOP,H):
    t=(y-PTOP)/(H-PTOP)
    hw=int(9+t*8)
    for x in range(CX-hw,CX+hw):
        c=(176,156,128) if (y-PTOP)%3 else (120,100,84)
        if abs(x-CX)>=hw-2: c=STD
        cv.px(x,y,c)
# red carpet of doom on stairs
for y in range(PTOP,H):
    for x in range(CX-4,CX+4):
        cv.px(x,y,(150,24,30) if (y-PTOP)%3 else (110,14,22))
# braziers on platform
def brazier(x,y):
    cv.rect(x-3,y-4,x+4,y,(90,70,50)); cv.rect(x-4,y-5,x+5,y-4,(130,100,70))
    F=[(255,240,140),(255,180,60),(236,90,40)]
    for k in range(9):
        w=max(0,3-k//3)
        for dx in range(-w,w+1):
            cv.px(x+dx+ (1 if k%3==0 else 0),y-6-k,F[0] if abs(dx)<w-1 else (F[1] if k<6 else F[2]))
brazier(52,128); brazier(98,128)
# warriors
eagle=np.array(Image.open('sprites/eagle.png')).copy(); eagle[:,:14,3]=0
jag=np.array(Image.open('sprites/jaguar.png')).copy()
sub=jag[...,:3].astype(int)
gm=(sub[...,1]>sub[...,0]+5)&(sub[...,1]>sub[...,2]); jag[gm,3]=0
cv.paste(outline(eagle,(30,10,10)),-6,144)
cv.paste(outline(jag,(30,10,10)),117,140,flip=True)
# title carved
cv.rect(18,188,132,204,(70,58,50)); cv.rect(19,189,131,203,(120,104,88))
draw_text(cv,'DOOM CLOCK',10,75,192,(250,210,110),center=True,shadow=(1,1,(60,20,10)))
save_sleeve(cv,'09_doom_clock',5)
