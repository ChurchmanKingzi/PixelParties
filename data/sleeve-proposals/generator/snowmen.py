from pp import *
SW=(248,248,255); SL=(214,214,240); SD=(170,168,214); SO=(96,90,150)
def snowman(kind='plain', br=6, hr=5):
    Wd=br*2+16; Hd=br*2+hr*2+22
    a=np.zeros((Hd,Wd,4),np.uint8)
    def P(x,y,c):
        if 0<=x<Wd and 0<=y<Hd: a[y,x,:3]=c; a[y,x,3]=255
    cx=Wd//2
    by=Hd-br-1; hy=by-br-hr+2
    def ball(cy,r):
        for y in range(cy-r,cy+r+1):
            for x in range(cx-r,cx+r+1):
                dx,dy=x-cx+0.5*0,y-cy
                if dx*dx+dy*dy<=r*r+r*0.6:
                    c=SW
                    if dx*0.6+dy*0.8>r*0.35: c=SL
                    if dx*0.6+dy*0.8>r*0.75: c=SD
                    P(x,y,c)
    ball(by,br); ball(hy,hr)
    # face
    P(cx-2,hy-1,(30,26,40)); P(cx+1,hy-1,(30,26,40))
    P(cx,hy+1,(255,140,40)); P(cx+1,hy+1,(230,100,30)); P(cx+2,hy+1,(230,100,30)) if kind!='wizard' else None
    # buttons
    P(cx,by-2,(40,36,50)); P(cx,by+1,(40,36,50))
    top=hy-hr
    if kind=='wizard':
        B=(40,50,140); BL=(70,90,190); ST=(255,230,110)
        for k in range(9):
            w=max(0,4-k//2)
            for dx in range(-w,w+1): P(cx+dx+(1 if k>6 else 0),top+1-k,B if dx<1 else BL)
        for dx in range(-6,7): P(cx+dx,top+1,B)
        P(cx-2,top-2,ST); P(cx+1,top-4,ST); P(cx,top-1,ST)
    if kind=='knight':
        HM=(90,96,116); HL=(150,156,176)
        for y in range(top-1,hy+1):
            for x in range(cx-hr-1,cx+hr+2):
                if (x-cx)**2+(y-hy)**2<=(hr+1)**2 and y<hy: P(x,y,HM if x>cx else HL)
        for dx in range(-hr,hr+1): P(cx+dx,hy-1,(40,40,50)) if abs(dx)>0 else None
        P(cx-2,hy-1,(200,200,220)); P(cx+1,hy-1,(200,200,220))
        for k in range(3): P(cx,top-2-k,(200,40,60))
    if kind=='heli':
        # propeller cap
        P(cx,top,(220,60,60)); P(cx-1,top,(220,60,60)); P(cx+1,top,(220,60,60)); P(cx,top-1,(120,120,130))
        for dx in range(-7,8): P(cx+dx,top-2,(236,236,246) if abs(dx)>1 else (120,120,130))
    if kind=='grad':
        K=(30,28,40)
        for dx in range(-5,6): P(cx+dx,top,K); 
        for dx in range(-3,4): P(cx+dx,top+1,K)
        P(cx+5,top+1,(240,200,60)); P(cx+5,top+2,(240,200,60))
        # red bowtie
        P(cx-1,by-br+1,(220,40,50)); P(cx+1,by-br+1,(220,40,50)); P(cx,by-br+1,(160,20,30))
    if kind=='banner':
        # stick arm holding a flag pole
        px_=cx+br+2
        for k in range(22): P(px_,by-k,(110,70,40))
        for j in range(6):
            for i in range(8-j//2): P(px_+1+i,by-21+j,(60,110,220) if j not in (2,3) else (240,240,255))
        P(cx+br,by-3,(110,70,40)); P(cx+br+1,by-4,(110,70,40))
    # stick arms
    if kind not in ('banner',):
        for k in range(4): P(cx-br-k,by-2-k,(110,70,40))
        for k in range(4): P(cx+br+k,by-2-k,(110,70,40))
        P(cx-br-3,by-7,(110,70,40)); P(cx+br+3,by-7,(110,70,40))
    # outline
    al=a[...,3]>0
    ring=cv2.dilate(al.astype(np.uint8),np.array([[0,1,0],[1,1,1],[0,1,0]],np.uint8)).astype(bool)&~al
    a[ring,:3]=SO; a[ring,3]=255
    return a
def dog():
    rows=[
    "..W........",
    ".WWW.......",
    "WWKWW...G.G",
    "WWWWWWWWWWW",
    ".GRRRRRRWW.",
    ".WWWWWWWWW.",
    ".WW.....WW.",
    ".WW.....WW."]
    rows=[
    "...........G..",
    "..........GWG.",
    "..........WWW.",
    "GW.......WWKWO",
    ".WWWWWWWWWWWW.",
    ".WWRRRRRRRWW..",
    ".WWWWWWWWWW...",
    ".WW.WW..WW.WW.",
    ".WW.WW..WW.WW."]
    col={'W':SW,'G':(150,150,190),'K':(30,26,40),'R':(210,40,50),'O':(40,30,40)}
    h=len(rows); w=len(rows[0]); a=np.zeros((h,w,4),np.uint8)
    for y,r in enumerate(rows):
        for x,c in enumerate(r):
            if c in col: a[y,x,:3]=col[c]; a[y,x,3]=255
    for y in range(h):
        for x in range(w):
            if a[y,x,3] and y>=6 and tuple(a[y,x,:3])==SW: a[y,x,:3]=SL
    al=a[...,3]>0
    pad=np.zeros((h+2,w+2,4),np.uint8); pad[1:-1,1:-1]=a
    al=pad[...,3]>0
    ring=cv2.dilate(al.astype(np.uint8),np.array([[0,1,0],[1,1,1],[0,1,0]],np.uint8)).astype(bool)&~al
    pad[ring,:3]=SO; pad[ring,3]=255
    return pad
if __name__=='__main__':
    cv=Canvas(160,50,(40,50,90)); x=2
    for k in ['plain','wizard','knight','heli','grad','banner']:
        s=snowman(k); cv.paste(s,x,4); x+=s.shape[1]+2
    cv.paste(dog(),x,30)
    cv.save(SP+'/snowmen.png',5)
