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

# ---------------- per-exemplar variation ----------------
# eye boxes (x0,y0,x1,y1 inclusive, native coords of make(kind)), found by inspecting the sprites
def find_eyes(a):
    """dark blobs inside the body (not touching transparency) in the middle band -> eye boxes (left,right)"""
    h,w=a.shape[:2]; op=a[...,3]>0
    L=lum(a[...,:3].astype(float))
    med=np.median(L[op])
    inner=cv2.erode(op.astype(np.uint8),np.ones((3,3),np.uint8))>0
    dark=inner&(L<med*0.62)
    num,lab,st,cen=cv2.connectedComponentsWithStats(dark.astype(np.uint8),connectivity=8)
    ys,xs=np.where(op); top,bot=ys.min(),ys.max()
    cands=[]
    for i in range(1,num):
        x,y,ww,hh,area=st[i]
        cy=y+hh/2
        if 1<=area<=12 and ww<=4 and hh<=3 and top+(bot-top)*0.25<cy<top+(bot-top)*0.75:
            cands.append((x,y,x+ww-1,y+hh-1,cen[i][0]))
    cands.sort(key=lambda c:c[4])
    if len(cands)>=2:
        # pick the pair most symmetric around the body centre
        cx=(xs.min()+xs.max())/2; best=None
        for i in range(len(cands)):
            for j in range(i+1,len(cands)):
                a_,b_=cands[i],cands[j]
                if a_[4]<cx<b_[4] and abs(a_[1]-b_[1])<=1:
                    sc=abs((a_[4]+b_[4])/2-cx)
                    if best is None or sc<best[0]: best=(sc,a_,b_)
        if best: return best[1][:4],best[2][:4]
    return None
_BODY_EYES=((5,4,6,6),(9,4,10,6))
_PADS={'slimy':(2,2),'splashy':(5,5),'hardy':(1,7),'shiny':(1,7),'shadowy':(3,6)}
EYES={'sparky':((9,15,11,16),(16,15,18,16)),'fiery':((14,19,16,20),(19,19,21,20)),
      'icy':((4,9,6,10),(12,9,13,10)),'rocky':((7,9,9,11),(12,9,14,11)),'cloudy':((14,8,15,10),(18,8,19,10))}
for k_,(px_,py_) in _PADS.items():
    EYES[k_]=tuple((x0+px_,y0+py_,x1+px_,y1+py_) for (x0,y0,x1,y1) in _BODY_EYES)
def set_expression(a,expr,rng,kind=None):
    eyes=EYES.get(kind) if kind else find_eyes(a)
    if eyes is None or expr=='normal': return a
    a=a.copy(); L=lum(a[...,:3].astype(float))
    op=a[...,3]>0
    body=tuple(int(v) for v in np.median(a[op][:,:3],axis=0))
    def eyecol(box):
        x0,y0,x1,y1=box; sub=a[y0:y1+1,x0:x1+1,:3].reshape(-1,3)
        return tuple(int(v) for v in sub[np.argmin(lum(sub.astype(float)))])
    def neighbour_body(box):
        x0,y0,x1,y1=box
        cand=[a[y0-1,x] for x in range(x0,x1+1)]+[a[y1+1,x] for x in range(x0,x1+1)]
        cand=[c[:3] for c in cand if c[3]>0]
        return tuple(int(v) for v in np.median(cand,axis=0)) if cand else body
    def clear(box):
        x0,y0,x1,y1=box
        fill=neighbour_body(box)
        # also clear bright glints right next to the eye
        for y in range(y0-1,y1+2):
            for x in range(x0-1,x1+2):
                if 0<=y<a.shape[0] and 0<=x<a.shape[1] and a[y,x,3]:
                    if (x0<=x<=x1 and y0<=y<=y1) or L[y,x]>230: a[y,x,:3]=fill
    def closed(box,happy=True):
        c=eyecol(box); x0,y0,x1,y1=box
        clear(box)
        w=x1-x0+1; yb=y1
        if happy and w>=3:   # ^ shape
            for x in range(x0,x1+1): a[yb if x in (x0,x1) else yb-1,x,:3]=c
        else:
            for x in range(x0,x1+1): a[yb,x,:3]=c
    le,re=eyes
    if expr=='closed': closed(le); closed(re)
    elif expr=='wink': closed(re if rng.rand()<0.5 else le)
    elif expr=='look':
        # move the glint: brightest pixel near eyes to the other side
        for box in (le,re):
            x0,y0,x1,y1=box; c=eyecol(box)
            for y in range(y0,y1+1):
                for x in range(x0,x1+1): a[y,x,:3]=c
            gx=x0 if rng.rand()<0.5 else x1
            a[y0,gx,:3]=(250,250,250)
    elif expr=='angry':
        c=eyecol(le)
        for box,s in ((le,1),(re,-1)):
            x0,y0,x1,y1=box
            xs_=[x0,x1] if s>0 else [x1,x0]
            if y0-2>=0:
                a[y0-2,xs_[0],:3]=c; a[y0-1,xs_[1],:3]=c
                mid=(x0+x1)//2; a[y0-1 if s>0 else y0-2, mid,:3]=c
    return a
def flame_variant(a,rng):
    """Fiery: bend/mirror the flame crown (rows above the body)"""
    a=a.copy(); h,w=a.shape[:2]
    top=15  # first body row of the fiery sprite
    fl=a[:top].copy(); body=a[top:]
    mode=rng.choice(['bendL','bendR','mirror','tall'])
    if mode=='mirror': fl=fl[:,::-1]
    out=np.zeros_like(fl)
    for y in range(top):
        k=top-y
        if mode=='bendL': s=-int(k*0.2)
        elif mode=='bendR': s=int(k*0.2)
        else: s=0
        row=np.roll(fl[y],s,axis=0)
        if s>0: row[:s]=0
        elif s<0: row[s:]=0
        out[y]=row
    if mode=='tall':
        out=np.zeros_like(fl); out[:-2]=fl[2:]; out[:3]=0
        # stretch: duplicate middle rows upward
        out=np.concatenate([fl[2:6],fl[4:]],axis=0)[:top]
    a[:top]=out
    a[top:]=body
    return a
def rotsprite(a,angle,sy=1.0):
    """RotSprite-style rotation at 2x: scale2x x3 (8x) -> rotate nearest -> sample to 2x"""
    pad=4
    a=np.pad(a,((pad,pad),(pad,pad),(0,0)))
    s8=scale2x(scale2x(scale2x(a)))
    h,w=s8.shape[:2]
    M=cv2.getRotationMatrix2D((w/2,h*0.8),angle,1.0)
    M[1]*=sy; M[1,2]+=h*0.8*(1-sy)
    r=cv2.warpAffine(s8,M,(w,h),flags=cv2.INTER_NEAREST,borderMode=cv2.BORDER_CONSTANT,borderValue=(0,0,0,0))
    out=r[2::4,2::4].copy()
    out[out[...,3]<128]=0; out[...,3]=np.where(out[...,3]>0,255,0)
    ys,xs=np.where(out[...,3]>0)
    return out[ys.min():ys.max()+1,xs.min():xs.max()+1]
def variant(kind,rng):
    a=make(kind)
    if kind=='fiery': a=flame_variant(a,rng)
    a=set_expression(a,rng.choice(['normal','normal','closed','wink','look','angry']),rng,kind)
    ang=rng.uniform(-11,11); sy=rng.uniform(0.9,1.06)
    return rotsprite(a,ang,sy)
