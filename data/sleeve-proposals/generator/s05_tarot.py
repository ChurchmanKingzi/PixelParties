from pp import *
from font35 import text35, width35
import art_skelking as SK
random.seed(5)
W,H=150,210
BG=(20,12,30)
cv=Canvas(W,H,BG)
GOLD=(232,184,70); GOLDL=(255,232,150); GOLDD=(150,100,34); GOLDDD=(90,56,20)
# subtle pattern on outer background
for y in range(H):
    for x in range(W):
        if (x+y)%6==0 and (x-y)%6==0: cv.px(x,y,(36,24,50))
def frame(x0,y0,x1,y1,thick=True):
    for x in range(x0,x1+1):
        cv.px(x,y0,GOLDL); cv.px(x,y1,GOLDD)
        if thick: cv.px(x,y0+1,GOLD); cv.px(x,y1-1,GOLD)
    for y in range(y0,y1+1):
        cv.px(x0,y,GOLDL); cv.px(x1,y,GOLDD)
        if thick: cv.px(x0+1,y,GOLD); cv.px(x1-1,y,GOLD)
frame(3,3,146,206)
frame(6,6,143,203,False)
# --- art panel ---
AX0,AY0,AX1,AY1=12,26,138,180
stops=[(14,14,44),(34,22,74),(70,34,96),(110,52,110)]
dither_gradient(cv,AX0,AY0,AX1,AY1,stops)
# stars
for _ in range(60):
    x=random.randint(AX0+1,AX1-2); y=random.randint(AY0+1,AY0+90)
    c=random.choice([(255,255,255),(200,200,255),(255,240,200)])
    cv.px(x,y,c)
    if random.random()<0.15:
        cv.px(x-1,y,lerp(c,(40,30,80),0.5)); cv.px(x+1,y,lerp(c,(40,30,80),0.5)); cv.px(x,y-1,lerp(c,(40,30,80),0.5)); cv.px(x,y+1,lerp(c,(40,30,80),0.5))
# moon
MCX,MCY,MR=75,66,36
for y in range(MCY-MR-4,MCY+MR+5):
    for x in range(MCX-MR-4,MCX+MR+5):
        d=math.hypot(x-MCX,y-MCY)
        if d<=MR:
            c=(250,240,200)
            if d>MR-3: c=(236,220,170)
            n=math.sin(x*0.35)*math.cos(y*0.3)+math.sin((x+y)*0.15)
            if n>1.1: c=(226,210,160)
            cv.px(x,y,c)
        elif d<=MR+3 and (x+y)%2==0 and AY0<=y<AY1:
            cv.px(x,y,lerp(tuple(cv.a[y,x]),(250,240,200),0.35))
# craters
for (cx,cy,r) in [(58,50,5),(92,78,6),(66,88,4),(98,48,3),(52,74,3)]:
    for y in range(cy-r,cy+r+1):
        for x in range(cx-r,cx+r+1):
            d=math.hypot(x-cx,y-cy)
            if d<=r: cv.px(x,y,(224,206,156) if d<r-1 else (208,190,140))
# wispy clouds across moon
for (cy,x0,x1) in [(92,20,70),(98,60,132),(46,96,136)]:
    for x in range(x0,x1):
        for k in range(3):
            y=cy+k+int(2*math.sin(x*0.2))
            if (x+k)%2==0 or k==1: cv.px(x,y,(150,110,160) if k==1 else (120,86,140))
# graveyard silhouette
SIL=(26,16,34); SIL2=(40,26,50)
for x in range(AX0,AX1):
    hgt=int(150+4*math.sin(x*0.08)+3*math.sin(x*0.21))
    for y in range(hgt,AY1): cv.px(x,y,SIL2 if y<hgt+2 else SIL)
def tomb(x,y,w,h,cross=False):
    if cross:
        cv.rect(x+w//2-1,y-h,x+w//2+1,y,SIL); cv.rect(x,y-h+3,x+w,y-h+5,SIL)
    else:
        for yy in range(y-h,y):
            for xx in range(x,x+w):
                if yy>y-h+w//2 or (xx-(x+w/2-0.5))**2+(yy-(y-h+w//2))**2<=(w/2)**2: cv.px(xx,yy,SIL)
tomb(16,154,9,14); tomb(28,152,7,16,True); tomb(112,152,10,15); tomb(126,154,7,14,True); tomb(100,156,6,10)
# dead tree left
def branch(x,y,ang,L,w):
    for i in range(L):
        X=int(x+math.cos(ang)*i); Y=int(y+math.sin(ang)*i)
        for k in range(w): cv.px(X+k,Y,SIL)
    return int(x+math.cos(ang)*L),int(y+math.sin(ang)*L)
e=branch(20,152,-1.45,30,3); f=branch(*e,-2.3,12,2); branch(*e,-0.7,14,2); branch(*f,-2.8,7,1); branch(21,140,-0.3,10,1)
e=branch(132,150,-1.7,22,2); branch(*e,-0.9,10,1); branch(*e,-2.4,9,1)
# skull bats
def bat(x,y,flip=False):
    pts=["W.............W",
         "WW...........WW",
         "WBB..SSSSS..BBW",
         ".WBBSSSSSSSBBW.",
         ".WBBSXXSXXSBBW.",
         "..WBSRXSRXSBW..",
         "..WB.SSSSS.BW..",
         "...W..S.S..W...",
         ]
    for j,r in enumerate(pts):
        for i,c in enumerate(r):
            X=x+(len(r)-1-i if flip else i)
            col={'W':(120,70,140),'B':(62,34,78),'S':(236,230,210),'X':(30,20,30),'R':(255,70,60)}.get(c)
            if col: cv.px(X,y+j,col)
bat(18,36); bat(112,30,True); bat(116,108); bat(18,100,True)
# soul wisps
def wisp(x,y):
    F=[(200,255,240),(110,230,210),(50,160,170)]
    shape=["..0..",".010.","01210","12221",".222.","..2.."]
    shape=[".0.","010","121","222",".2."]
    for j,r in enumerate(shape):
        for i,c in enumerate(r):
            if c!='.': cv.px(x+i,y+j,F[int(c)])
for (wx,wy) in [(36,128),(110,134),(30,70),(122,72)]: wisp(wx,wy)
# mist
for y in range(160,AY1):
    for x in range(AX0,AX1):
        if (x+y*2)%5==0 and math.sin(x*0.1+y)>0.2: cv.px(x,y,(90,70,110))
# --- the king ---
king=SK.to_rgba(SK.build())
big=upscale(king,2)
# aura glow behind king
kx=W//2-big.shape[1]//2; ky=AY1-big.shape[0]+2
cv.paste(big,kx,ky)
# panel frame
frame(AX0-1,AY0-1,AX1,AY1)
# --- top plate ---
cv.rect(46,8,104,22,(34,20,46)); frame(46,8,104,22,False)
draw_text(cv,'XIII',16,75,10,GOLD,center=True,shadow=(1,1,GOLDDD))
for sx in (40,110):
    for (dx,dy) in [(0,0),(1,0),(-1,0),(0,1),(0,-1)]: cv.px(sx+dx,15+dy,GOLD)
    cv.px(sx,15,GOLDL)
# --- bottom plate ---
cv.rect(16,184,134,200,(34,20,46)); frame(16,184,134,200,False)
draw_text(cv,'SKELETON KING',10,75,188,GOLD,center=True,shadow=(1,1,GOLDDD))
# corner ornaments
def corner(x,y,sx,sy):
    for i in range(7):
        cv.px(x+sx*i,y,GOLD); cv.px(x,y+sy*i,GOLD)
    cv.px(x+sx*2,y+sy*2,GOLDL); cv.px(x+sx*3,y+sy*3,GOLD); cv.px(x+sx*1,y+sy*1,GOLD)
    cv.px(x+sx*8,y+sy*1,GOLD); cv.px(x+sx*1,y+sy*8,GOLD)
corner(8,8,1,1); corner(141,8,-1,1); corner(8,201,1,-1); corner(141,201,-1,-1)
save_sleeve(cv,'05_tarot_skeleton_king',5)
