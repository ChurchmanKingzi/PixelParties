from pp import *
def shade(c,f): return tuple(max(0,min(255,int(v*f))) for v in c)
def slime(base, w=22, h=17, kind='plain', face=True, seed=0):
    rnd=random.Random(seed)
    PAD=8
    Wd,Hd=w+2*PAD,h+2*PAD
    a=np.zeros((Hd,Wd,4),np.uint8)
    def P(x,y,c):
        if 0<=x<Wd and 0<=y<Hd: a[y,x,:3]=c[:3]; a[y,x,3]=255
    light=shade(base,1.3); lighter=shade(base,1.6); dark=shade(base,0.62); outl=shade(base,0.35)
    body=np.zeros((Hd,Wd),bool)
    cx=Wd/2-0.5
    for y in range(h):
        t=y/(h-1)
        # bell: dome on top, flare at bottom
        if t<0.72: hw=(w/2-1.5)*math.sqrt(max(0,1-((0.72-t)/0.72)**2))**0.9
        else: hw=(w/2-1.5)+1.2*((t-0.72)/0.28)
        for x in range(Wd):
            if abs(x-cx)<=hw: body[PAD+y,x]=True
    for y in range(Hd):
        for x in range(Wd):
            if body[y,x]:
                yy=(y-PAD)/h; xx=(x-cx)/(w/2)
                c=base
                if xx+0.25*(1-yy)>0.62 or yy>0.84: c=dark
                if xx<-0.2 and yy<0.45: c=light
                P(x,y,c)
    # highlight
    hx,hy=int(cx-w*0.22),PAD+3
    P(hx,hy,lighter); P(hx+1,hy,lighter); P(hx,hy+1,lighter); P(hx-1,hy+2,light)
    # rocky texture
    if kind=='rocky':
        for k in range(10):
            x=rnd.randint(int(cx-w/2+3),int(cx+w/2-3)); y=rnd.randint(PAD+3,PAD+h-2)
            if body[y,x] and body[y,x+1]: P(x,y,dark); P(x+1,y,dark); P(x,y-1,light)
    # face
    if face:
        ey=PAD+int(h*0.45); ex1=int(cx-4); ex2=int(cx+3)
        EYE=(24,20,30)
        for ex in (ex1,ex2):
            P(ex,ey,EYE); P(ex+1,ey,EYE); P(ex,ey+1,EYE); P(ex+1,ey+1,EYE); P(ex,ey,(255,255,255))
        my=ey+3
        if kind in ('shadowy',):
            for dx in range(-2,3): P(int(cx)+dx,my,EYE)
            P(int(cx)-2,my-1,EYE); P(int(cx)+2,my-1,EYE)
        else:
            P(int(cx)-2,my,EYE); P(int(cx)+2,my,EYE)
            for dx in range(-1,2): P(int(cx)+dx,my+1,EYE)
            P(int(cx)-3,my-1,shade(base,1.0)) 
        # blush
        P(ex1-2,ey+2,shade((255,120,140),0.9)); P(ex2+3,ey+2,shade((255,120,140),0.9))
    top=PAD
    # accessories
    if kind=='hardy':
        HC=(150,156,170); HL=(210,214,224); HD=(90,94,108)
        for y in range(top-4,top+4):
            for x in range(Wd):
                d=((x-cx)/(w*0.36))**2+((y-(top+3))/6.5)**2
                if d<=1 and y<=top+3: P(x,y,HC if x<cx+3 else HD)
        for x in range(int(cx-w*0.42),int(cx+w*0.42)+1): P(x,top+4,HD)
        P(int(cx-3),top-1,HL); P(int(cx-2),top-2,HL); P(int(cx),top-4,HD); P(int(cx),top-5,HC)
    if kind=='fiery':
        F=[(255,236,110),(255,170,40),(236,80,30)]
        for fx,fh in [(-5,6),(-1,9),(3,7),(7,4)]:
            x0=int(cx)+fx
            for k in range(fh):
                y=top+2-k
                wdt=max(0,2-k*2//fh)
                for dx in range(-wdt,wdt+1):
                    P(x0+dx,y,F[2] if abs(dx)==wdt and wdt>0 else (F[0] if k<fh//3 else F[1]))
            P(x0,top+2-fh,F[2])
    if kind=='icy':
        IC=(210,244,255); ICD=(120,190,230)
        for fx,fh in [(-6,4),(-2,6),(2,5),(6,3)]:
            x0=int(cx)+fx
            for k in range(fh):
                P(x0,top+2-k,IC); 
                if k<fh-2: P(x0+1,top+2-k,ICD)
    if kind=='shiny':
        G=(255,210,60); GD=(200,140,30); GEM=(230,40,70)
        for x in range(int(cx)-5,int(cx)+6):
            for y in range(top-2,top+2): P(x,y,G if y<top+1 else GD)
        for px_ in (-5,0,5):
            P(int(cx)+px_,top-3,G); P(int(cx)+px_,top-4,G); P(int(cx)+px_,top-5,(255,250,200))
        for px_ in (-3,3): P(int(cx)+px_,top-3,G)
        P(int(cx),top-1,GEM); P(int(cx)-1,top-1,GEM)
    if kind=='sparky':
        Y=(255,240,80); YD=(210,170,20)
        for side in (-1,1):
            x=int(cx)+side*4; y=top+1
            for k,(dx,dy) in enumerate([(0,-1),(side,-1),(side,-1),(0,-1),(-side,-1),(side,-1),(side,-1)]):
                x+=dx; y+=dy; P(x,y,Y if k%2==0 else YD)
    if kind=='cloudy':
        WG=(250,252,255); WGD=(190,210,230)
        for side in (-1,1):
            bx=int(cx)+side*(w//2)
            for k in range(6):
                for j in range(4-abs(k-2)):
                    P(bx+side*(k),PAD+5-j+k//2,WG if j>0 else WGD)
    if kind=='shadowy':
        HN=(60,30,90)
        for side in (-1,1):
            x=int(cx)+side*5
            for k in range(5): P(x+side*(k//2),top+1-k,HN); P(x+side*(k//2)-side,top+1-k,shade(HN,1.5)) if k<3 else None
    if kind=='splashy':
        D=(140,210,255)
        for (dx,dy) in [(-w//2-2,4),(w//2+2,3),(-w//2,-1),(w//2+1,-2)]:
            x=int(cx)+dx; y=top+dy
            P(x,y,D); P(x,y+1,D); P(x,y-1,(230,250,255))
    if kind=='slimy':
        for dx in (-6,1,6):
            x=int(cx)+dx
            for k in range(rnd.randint(2,4)): P(x,PAD+h+k,base if k<2 else light)
    # outline
    al=a[...,3]>0
    ring=cv2.dilate(al.astype(np.uint8),np.array([[0,1,0],[1,1,1],[0,1,0]],np.uint8)).astype(bool)&~al
    a[ring,:3]=outl; a[ring,3]=255
    return a
KINDS={
 'slimy':((96,200,90),'slimy'),
 'hardy':((110,190,110),'hardy'),
 'fiery':((222,90,50),'fiery'),
 'icy':((140,220,236),'icy'),
 'shiny':((200,210,70),'shiny'),
 'sparky':((220,226,80),'sparky'),
 'splashy':((60,150,230),'splashy'),
 'cloudy':((120,220,210),'cloudy'),
 'rocky':((130,150,110),'rocky'),
 'shadowy':((120,70,200),'shadowy'),
 'pink':((240,130,190),'plain'),
}
if __name__=='__main__':
    cv=Canvas(200,60,(40,30,50))
    x=2
    for i,(k,(c,kind)) in enumerate(KINDS.items()):
        s=slime(c,kind=kind,seed=i)
        cv.paste(s,(i%6)*36,(i//6)*30)
    cv.save(SP+'/slimetest.png',5)
