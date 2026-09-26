# In-game style slimes: 5 original sprites + 5 derived from the Cloudy Slime body
from px2 import *
import colorsys
D=os.path.join(HERE,'sprites','slimes')
def load(k):
    a=np.array(Image.open(f'{D}/{k}.png').convert('RGBA'))
    a[...,3]=np.where(a[...,3]>100,255,0); a[a[...,3]==0]=0
    return a
WING={(12,116,107),(187,232,225),(154,217,209),(130,193,185),(32,153,162)}
def base_body():
    a=load('cloudy')
    b=a.copy()
    for y in range(a.shape[0]):
        for x in range(a.shape[1]):
            if tuple(a[y,x,:3]) in WING or x<9 or x>25: b[y,x]=0
    ys,xs=np.where(b[...,3]>0)
    return b[ys.min():ys.max()+1, xs.min():xs.max()+1]
FACE={(76,108,103),(237,243,243),(66,100,96),(90,133,128)}
def recolor(a,hue,sat=1.0,val=1.0,face_val=1.0):
    b=a.copy()
    for y in range(a.shape[0]):
        for x in range(a.shape[1]):
            if a[y,x,3]==0: continue
            r,g,bb=(a[y,x,:3]/255.0)
            h,s,v=colorsys.rgb_to_hsv(r,g,bb)
            isface=tuple(a[y,x,:3]) in FACE
            s2=min(1,s*sat) if not isface else s*0.6
            v2=min(1,v*(face_val if isface else val))
            b[y,x,:3]=np.array(colorsys.hsv_to_rgb(hue,s2,v2))*255
    return b
def pad(a,l=0,t=0,r=0,b=0):
    return np.pad(a,((t,b),(l,r),(0,0)))
def put(a,x,y,c):
    if 0<=y<a.shape[0] and 0<=x<a.shape[1]: a[y,x,:3]=c; a[y,x,3]=255
def make(kind):
    if kind in ('sparky','fiery','icy','rocky','cloudy'): return load(kind)
    body=base_body()
    if kind=='slimy':
        s=pad(recolor(body,0.33,1.1,0.95),2,2,2,4)
        for (x,L) in [(6,3),(12,2),(17,4)]:
            for k in range(L): put(s,x,s.shape[0]-5+k,(60,170,70) if k<L-1 else (120,220,110))
        return s
    if kind=='splashy':
        s=pad(recolor(body,0.58,1.25,1.0),5,5,5,2)
        DR=(30,110,190); DL=(150,220,255)
        for (x,y) in [(1,7),(26,6),(3,1),(24,1),(28,12)]:
            put(s,x,y,DL); put(s,x,y+1,DR); put(s,x+1,y+1,DR); put(s,x,y+2,DR)
        return s
    if kind=='hardy':
        s=pad(recolor(body,0.30,0.9,0.85),1,7,1,1)
        HM=(110,116,130); HL=(176,182,196); HD=(64,68,82); OUT=(36,38,50)
        cx=s.shape[1]//2
        for y in range(1,10):
            for x in range(s.shape[1]):
                d=((x-cx+0.5)/9.0)**2+((y-9)/7.5)**2
                if d<=1:
                    c=HM
                    if d>0.8: c=OUT
                    elif x<cx-3 and y<6: c=HL
                    elif x>cx+3: c=HD
                    put(s,x,y,c)
        for x in range(cx-10,cx+10): put(s,x,9,OUT); put(s,x,8,HD if x>cx else HM)
        put(s,cx,0,OUT); put(s,cx-1,0,OUT); put(s,cx,1,HL)
        for x in (cx-6,cx-2,cx+2,cx+6): put(s,x,7,HL)
        return s
    if kind=='shiny':
        s=pad(recolor(body,0.16,1.1,1.05),1,7,1,1)
        G=(250,206,60); GL=(255,240,160); GD=(190,130,30); OUT=(110,70,20); GEM=(220,40,70)
        cx=s.shape[1]//2
        for x in range(cx-6,cx+6):
            for y in range(4,9):
                put(s,x,y,G if y<7 else GD)
            put(s,x,9,OUT)
        for px_ in (cx-6,cx-1,cx+4):
            for y in range(1,4): put(s,px_,y,G); put(s,px_+1,y,GD)
            put(s,px_,0,GL)
        for x in range(cx-7,cx+7): 
            if s[4,x,3]==0 or x in (cx-7,cx+6): pass
        for y in range(1,10): put(s,cx-7,y,OUT) if y>3 else None; 
        for y in range(4,10): put(s,cx+6,y,OUT)
        put(s,cx-1,6,GEM); put(s,cx,6,GEM); put(s,cx-1,5,(255,120,150)); put(s,cx-4,6,(80,160,255)); put(s,cx+3,6,(80,200,120))
        for x in range(cx-5,cx+5,2): put(s,x,4,GL)
        return s
    if kind=='shadowy':
        s=pad(recolor(body,0.76,1.3,0.75,0.8),3,6,3,1)
        HN=(70,40,110); HL=(150,110,210); OUT=(30,16,50)
        cx=s.shape[1]//2
        for side in (-1,1):
            pts=[(cx+side*6,8),(cx+side*7,7),(cx+side*8,6),(cx+side*9,5),(cx+side*9,4),(cx+side*9,3),(cx+side*8,2),(cx+side*8,1)]
            for i,(x,y) in enumerate(pts):
                put(s,x,y,HL if i<3 else HN); put(s,x+side,y,OUT); put(s,x-side,y,HN if i<5 else OUT)
            put(s,cx+side*8,0,OUT)
        return s
KINDS=['sparky','fiery','icy','rocky','cloudy','slimy','splashy','hardy','shiny','shadowy']
if __name__=='__main__':
    cv=Canvas(10*38,40,(46,40,70)); x=2
    for k in KINDS:
        s=make(k); cv.paste(s,x,2); cv.paste(scale2x(s),x,2+0) if False else None; x+=s.shape[1]+4
    x=2
    cv2_=Canvas(20*40,70,(46,40,70))
    for k in KINDS:
        s=scale2x(make(k)); cv2_.paste(s,x,2); x+=s.shape[1]+4
    cv2_.save(SP+'/slimes2.png',3)
