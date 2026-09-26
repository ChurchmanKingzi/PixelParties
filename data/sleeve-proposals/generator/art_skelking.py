import numpy as np, math
PAL={
 'K':(22,16,30),'B':(236,230,210),'b':(186,176,152),'c':(128,118,102),
 'R':(255,70,60),'r':(170,20,40),'G':(242,192,62),'g':(176,118,30),'Y':(255,240,160),
 'P':(92,34,108),'p':(58,20,72),'Q':(170,34,56),'q':(118,20,40),
 'S':(206,212,226),'s':(134,140,162),'W':(246,246,246),'w':(196,196,210),'X':(30,26,34),
}
Wd,Hd=48,78
OY=6
def build(props=True):
    g=[['.']*Wd for _ in range(Hd)]
    def P(x,y,c,mirror=True):
        y=y+OY
        if 0<=x<Wd and 0<=y<Hd:
            g[y][x]=c
            if mirror: g[y][Wd-1-x]=c
    def rect(x0,y0,x1,y1,c,m=True):
        for y in range(y0,y1+1):
            for x in range(x0,x1+1): P(x,y,c,m)
    def line(x0,y0,x1,y1,c,w=1,m=True):
        n=max(abs(x1-x0),abs(y1-y0))+1
        for i in range(n):
            t=i/max(1,n-1); x=round(x0+(x1-x0)*t); y=round(y0+(y1-y0)*t)
            for k in range(w): P(x+k,y,c,m)
    # ---- cape (behind) ----
    for y in range(18,70):
        t=(y-18)/52
        xl=int(12-11*t**0.8)
        for x in range(xl,24):
            c='P'
            if x<=xl+1: c='Q'
            elif x==xl+2: c='q'
            elif (x+y//3)%7==0: c='p'
            P(x,y,c)
    # cape bottom hem ragged
    for x in range(0,24):
        if x%3==0: P(x,69,'.'); P(x,70,'.')
    # ---- legs ----
    for y in range(44,66):
        P(16,y,'B'); P(17,y,'b'); P(15,y,'K'); P(18,y,'K')
    rect(15,54,18,55,'B')  # knee
    P(15,54,'b'); P(18,55,'c')
    # feet
    rect(12,66,18,67,'B'); rect(12,68,18,68,'c'); P(11,66,'K'); P(11,67,'K'); rect(11,69,19,69,'K')
    # ---- pelvis ----
    rect(15,39,23,43,'B'); rect(15,43,23,43,'c'); P(15,39,'K'); rect(19,41,21,42,'K')
    # ---- ribcage ----
    for i,y in enumerate(range(24,38,2)):
        L=16+i//3
        line(L,y,23,y,'B'); line(L,y+1,23,y+1,'K')
        P(L-1,y,'K')
    rect(22,24,23,38,'b')  # spine / sternum
    # ---- ermine mantle ----
    for y in range(17,25):
        t=(y-17)/7
        xl=int(14-7*math.sin(t*math.pi/2))
        for x in range(xl,24):
            if y>=22 and x>17: continue
            c='W'
            if y>=23: c='w'
            if (x*3+y*5)%11==0 and y<23: c='X'
            P(x,y,c)
    # ---- arms: shoulder (8,23) -> elbow (11,33) -> hands at (20,26) ----
    line(9,23,10,33,'B',2); line(8,23,9,33,'K'); line(11,24,12,32,'b')
    line(11,33,19,27,'B',2); line(11,35,19,29,'K'); line(12,34,19,28,'b')
    # hands gripping pommel
    rect(18,24,21,28,'B'); rect(18,28,21,28,'c'); P(18,25,'b'); P(18,27,'b'); P(21,26,'K')
    # ---- sword (center) ----
    if props:
        # pommel
        rect(22,20,23,22,'G'); P(22,20,'Y'); rect(21,21,21,21,'g')
        # grip under hands
        rect(22,23,23,29,'q')
        # crossguard: sun-shaped
        rect(14,30,23,31,'G'); rect(14,32,23,32,'g'); P(13,30,'G'); P(13,31,'g'); P(12,29,'G'); P(12,32,'G')
        P(15,30,'Y'); P(16,30,'Y')
        # sun disc at guard center
        for y in range(26,37):
            for x in range(17,24):
                d=(x-23.5)**2+(y-31)**2
                if d<=22: P(x,y,'G' if d>8 else 'Y')
                elif d<=26: P(x,y,'g')
        P(22,31,'R'); P(23,31,'R'); P(23,30,'R')
        # sun rays
        for (x,y) in [(18,25),(16,27),(15,34),(18,37),(20,24),(20,38)]: P(x,y,'G')
        # blade
        for y in range(37,66):
            P(21,y,'K'); P(22,y,'S'); P(23,y,'s' if y%2 else 'S')
        P(22,66,'S'); P(23,66,'S'); P(22,67,'K'); P(23,67,'s'); P(23,68,'K')
        for y in range(37,66): P(22,y,'S'); P(25,y,'s',False)  # right side darker (asymmetric)
        for y in range(37,66): g[y+OY][24]='S'
    # ---- neck ----
    rect(21,16,23,18,'b')
    # ---- skull ----
    for y in range(4,17):
        for x in range(14,24):
            d=((x-23.5)/9.5)**2+((y-10)/6.8)**2
            if y>13: d=((x-23.5)/6.5)**2+((y-10)/6.8)**2
            if d<=1: P(x,y,'B')
    # skull shading
    for y in range(4,17):
        for x in range(14,24):
            if g[y+OY][x]=='B' and (x<16 or y>14): P(x,y,'b')
    # eye sockets
    rect(17,9,20,11,'X'); P(17,9,'b'); P(16,10,'X'); P(20,12,'X')
    P(18,10,'R'); P(19,10,'r'); P(18,9,'r')
    # nose
    P(23,12,'X'); P(22,13,'X')
    # teeth
    for x in range(19,24): P(x,15,'X' if x%2 else 'B')
    rect(19,14,23,14,'b'); rect(19,16,23,16,'c')
    # cheekbone
    P(16,12,'c'); P(17,13,'c')
    # ---- crown ----
    if props:
        rect(13,3,23,5,'G'); rect(13,6,23,6,'g')
        for (x,h) in [(13,4),(17,5),(21,7)]:
            for k in range(h): P(x,3-k,'G'); P(x+1,3-k,'g' if k<h-1 else 'G')
            P(x,3-h,'Y')
        P(23,-1,'G') 
        rect(22,0,23,2,'G')
        # gems
        P(15,4,'R'); P(19,4,'Q'); P(22,4,'R'); P(23,4,'R')
        P(22,-3+4,'Y')
    # outline pass
    out=[row[:] for row in g]
    for y in range(Hd):
        for x in range(Wd):
            if g[y][x]=='.':
                for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)):
                    X,Y=x+dx,y+dy
                    if 0<=X<Wd and 0<=Y<Hd and g[Y][X] not in '.K':
                        out[y][x]='K'; break
    return [''.join(r) for r in out]
def to_rgba(rows):
    h=len(rows); w=len(rows[0]); a=np.zeros((h,w,4),np.uint8)
    for y,r in enumerate(rows):
        for x,c in enumerate(r):
            if c!='.': a[y,x,:3]=PAL[c]; a[y,x,3]=255
    return a
if __name__=='__main__':
    from PIL import Image
    a=to_rgba(build())
    import sys; sys.path.insert(0,'.')
    from pp import preview, SP
    preview(a,SP+'/skelking.png',8)
