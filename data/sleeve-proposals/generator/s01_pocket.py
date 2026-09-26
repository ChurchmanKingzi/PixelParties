from pp import *
from font35 import text35, width35
W,H=150,210
cv=Canvas(W,H,(20,16,32))
GB=[(15,56,15),(48,98,48),(139,172,15),(155,188,15)]
BODY=(122,98,170); BODY_L=(150,128,196); BODY_D=(92,72,136); BODY_DD=(62,48,96)
def rrect(x0,y0,x1,y1,r,c,rbr=None):
    rbr=rbr or r
    for y in range(y0,y1):
        for x in range(x0,x1):
            ok=True
            for (cx,cy,rr,cond) in ((x0+r,y0+r,r,x<x0+r and y<y0+r),(x1-1-r,y0+r,r,x>x1-1-r and y<y0+r),
                                     (x0+r,y1-1-r,r,x<x0+r and y>y1-1-r),(x1-1-rbr,y1-1-rbr,rbr,x>x1-1-rbr and y>y1-1-rbr)):
                if cond and (x-cx)**2+(y-cy)**2>rr*rr+rr*0.8: ok=False
            if ok: cv.px(x,y,c)
# body with dithered shading
rrect(1,1,W-1,H-1,6,BODY_DD,rbr=26)
rrect(2,2,W-2,H-2,5,BODY,rbr=25)
# subtle vertical dither shading on right edge and highlight on left
for y in range(3,H-3):
    for x in range(3,W-3):
        if tuple(cv.a[y,x])==BODY:
            if x<6 and (x+y)%2==0: cv.px(x,y,BODY_L)
            if x>W-8 and (x+y)%2==0: cv.px(x,y,BODY_D)
            if y>H-8 and (x+y)%2==0: cv.px(x,y,BODY_D)
# top ridge line
for x in range(8,W-8): cv.px(x,6,BODY_D); cv.px(x,7,BODY_L)

# bezel
BZ=(52,50,74); BZ_L=(70,68,98)
rrect(10,12,140,122,4,BZ,rbr=18)
for x in range(16,134):
    if x<28 or x>122: cv.px(x,16,(160,40,90)); cv.px(x,18,(40,70,160))
text35(cv,'PIXEL PARTIES DOT MATRIX',75,15,(170,168,196),center=True)
# LED
for (dx,dy) in [(0,0),(1,0),(0,1),(1,1)]: cv.px(16+dx,52+dy,(240,40,60))
cv.px(16,52,(255,160,170))
text35(cv,'PWR',13,58,(150,148,176))
# screen
SX0,SY0,SX1,SY1=26,24,124,112
cv.rect(SX0-1,SY0-1,SX1+1,SY1+1,(20,40,20))
cv.rect(SX0,SY0,SX1,SY1,GB[3])
# faint screen dot texture
for y in range(SY0,SY1):
    for x in range(SX0,SX1):
        if (x%2==0 and y%2==0): pass
def gbq(rgba,q=(0.2,0.5,0.85)):
    a=rgba.copy(); lum=(a[...,0]*0.3+a[...,1]*0.59+a[...,2]*0.11)
    op=a[...,3]>0
    th=np.quantile(lum[op],q)
    idx=np.digitize(lum,th)
    idx=np.minimum(idx,2)  # lightest sprite tone = GB[2]... keep GB[3] for highlights only
    idx[lum>=np.quantile(lum[op],0.93)]=3
    pal=np.array(GB)
    a[...,:3]=pal[idx]
    return outline(a,GB[0])
giant=np.array(Image.open('sprites/giant.png')); tobi=np.array(Image.open('sprites/tobi.png'))
# platforms
def ellipse(cx,cy,rx,ry,c,fill=True):
    for y in range(cy-ry,cy+ry+1):
        for x in range(cx-rx,cx+rx+1):
            v=((x-cx)/rx)**2+((y-cy)/ry)**2
            if (fill and v<=1) or (not fill and 0.72<v<=1): cv.px(x,y,c)
ellipse(96,57,22,5,GB[2]); ellipse(96,57,22,5,GB[1],fill=False)
ellipse(47,85,20,4,GB[2]); ellipse(47,85,20,4,GB[1],fill=False)
cv.paste(gbq(giant),79,27)
cv.paste(gbq(tobi),36,59)
# enemy box (top-left)
text35(cv,'3-HEADED GIANT',SX0+3,SY0+4,GB[0])
text35(cv,'LV50',SX0+3,SY0+11,GB[0])
cv.rect(SX0+20,SY0+12,SX0+50,SY0+15,GB[0]); cv.rect(SX0+21,SY0+13,SX0+49,SY0+14,GB[3])
cv.rect(SX0+21,SY0+13,SX0+44,SY0+14,GB[1])
text35(cv,'HP',SX0+20,SY0+17,GB[0])
for x in range(SX0+2,SX0+54): cv.px(x,SY0+23,GB[0])
cv.rect(SX0+2,SY0+10,SX0+3,SY0+24,GB[0])
# player box (right)
PX0=SX0+52; PY0=SY0+41
text35(cv,'TOBI',PX0,PY0,GB[0]); text35(cv,'LV5',PX0+27,PY0,GB[0])
cv.rect(PX0+8,PY0+8,PX0+42,PY0+11,GB[0]); cv.rect(PX0+9,PY0+9,PX0+41,PY0+10,GB[3]); cv.rect(PX0+9,PY0+9,PX0+19,PY0+10,GB[1])
text35(cv,'HP',PX0,PY0+7,GB[0])
text35(cv,'12/150',PX0+18,PY0+14,GB[0])
for x in range(PX0-2,PX0+44): cv.px(x,PY0+21,GB[0])
cv.rect(PX0+43,PY0+6,PX0+44,PY0+22,GB[0])
# text box
TY=SY1-22
cv.rect(SX0+1,TY,SX1-1,SY1-1,GB[0]); cv.rect(SX0+2,TY+1,SX1-2,SY1-2,GB[3]); cv.rect(SX0+3,TY+2,SX1-3,SY1-3,GB[0]); cv.rect(SX0+4,TY+3,SX1-4,SY1-4,GB[3])
text35(cv,'A WILD 3-HEADED GIANT',SX0+7,TY+5,GB[0])
text35(cv,'APPEARED!',SX0+7,TY+12,GB[0])
for i,(dx,dy) in enumerate([(0,0),(1,0),(2,0),(3,0),(4,0),(1,1),(2,1),(3,1),(2,2)]): cv.px(SX1-12+dx,SY1-8+dy,GB[0])
# screen glare

# logo under bezel
wa,h=draw_text(cv,'PIXEL',12,0,-50,(0,0,0))
wb,h=draw_text(cv,'POCKET',12,0,-50,(0,0,0))
x0=W//2-(wa+wb+5)//2
draw_text(cv,'PIXEL',12,x0,127,(38,40,118),shadow=(1,1,BODY_D))
draw_text(cv,'POCKET',12,x0+wa+5,127,(200,40,110),shadow=(1,1,BODY_D))
w=wa+wb+5
cv_logo_y=127
# small colorful tag
text35(cv,'TM',W//2+w//2+2,127,(60,50,110))
# D-pad
DX,DY=30,160
DP=(34,32,44); DPL=(70,68,86)
cv.rect(DX-4,DY-13,DX+5,DY+14,DP); cv.rect(DX-13,DY-4,DX+14,DY+5,DP)
cv.rect(DX-3,DY-12,DX+4,DY-10,DPL); cv.rect(DX-12,DY-3,DX-10,DY+4,DPL)
for x in range(DX-2,DX+3):
    for y in range(DY-2,DY+3):
        if (x-DX)**2+(y-DY)**2<=5: cv.px(x,y,(22,20,30))
# arrows
for i in range(3):
    for j in range(-i,i+1): cv.px(DX+j,DY-9+i,(90,88,110)); cv.px(DX+j,DY+10-i,(90,88,110)); cv.px(DX-9+i,DY+j,(90,88,110)); cv.px(DX+10-i,DY+j,(90,88,110))
# recess around dpad
# A/B buttons
BTN=(200,40,110); BTN_L=(240,110,160); BTN_D=(140,20,76)
def btn(cx,cy,lab):
    ellipse(cx,cy+1,9,9,BTN_D); ellipse(cx,cy,9,9,BTN)
    for (dx,dy) in [(-4,-5),(-5,-4),(-3,-6),(-5,-3),(-2,-6)]: cv.px(cx+dx,cy+dy,BTN_L)
    text35(cv,lab,cx-1,cy+12,(60,40,100))
btn(102,168,'B'); btn(124,154,'A')
# start/select pills
def pill(cx,cy,lab):
    for x in range(cx-7,cx+8):
        for y in range(cy-2,cy+3):
            if abs(x-cx)<=5 or (abs(x-cx)-5)**2+(y-cy)**2<=4: cv.px(x,y,(70,64,94))
    text35(cv,lab,cx,cy+5,(60,40,100),center=True)
pill(58,190,'SELECT'); pill(88,190,'START')
# speaker grille
for k in range(6):
    for t in range(14):
        x=112+k*4+t//2; y=196-t
        cv.px(x,y,BODY_DD); cv.px(x+1,y,BODY_D)
# pixel parties heart sticker
save_sleeve(cv,'01_pixel_pocket',5)
