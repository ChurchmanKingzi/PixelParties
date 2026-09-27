# Toolkit for sleeve generation
import os, re, json, math, random
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import cv2
HERE=os.path.dirname(os.path.abspath(__file__))
ROOT=os.path.abspath(os.path.join(HERE,'..','..','..'))
SP=os.environ.get('SLEEVE_SCRATCH','/tmp/sleeve-scratch'); os.makedirs(SP,exist_ok=True)
OUT=os.path.abspath(os.path.join(HERE,'..'))
FONT=ROOT+'/data/Pixel Intv.otf'

def card(name):
    p=f'{ROOT}/cards/{name}.png'
    if not os.path.exists(p): p=f'{ROOT}/cards/skins/{name}.png'
    return np.array(Image.open(p).convert('RGB'))

def detect_scale(a, smin=3, smax=12):
    g=a.astype(int)
    res={}
    for axis in (0,1):
        d=np.abs(np.diff(g,axis=axis)).sum(2)
        e=(d>40)
        prof=e.sum(axis=1-axis)  # count edges per column/row index
        for s in range(smin,smax+1):
            best=0;bp=0
            for p in range(s):
                f=prof[p::s].sum()/max(1,prof.sum())
                if f>best: best,bp=f,p
            res.setdefault(s,[]).append((best,bp))
    scores={s:(v[0][0]*v[1][0]) for s,v in res.items()}
    # prefer the largest s whose score is close to the best
    top=max(scores.values())
    s=max(k for k,v in scores.items() if v>=top*0.85)
    # phase: edge at index i means boundary between i and i+1 -> block starts at i+1
    py=(res[s][0][1]+1)%s; px=(res[s][1][1]+1)%s
    return s,px,py,scores

def native(name_or_arr, box=None, s=None, px=None, py=None):
    a=card(name_or_arr) if isinstance(name_or_arr,str) else name_or_arr
    if box: x0,y0,x1,y1=box; a=a[y0:y1,x0:x1]
    if s is None:
        s,px2,py2,_=detect_scale(a)
        px = px2 if px is None else px; py = py2 if py is None else py
    px=px or 0; py=py or 0
    a=a[py:,px:]
    h=a.shape[0]//s; w=a.shape[1]//s
    a=a[:h*s,:w*s].reshape(h,s,w,s,3)
    # take center-ish median of each block to avoid blur on edges
    c=a[:,s//4:s-s//4,:,s//4:s-s//4,:]
    out=np.median(c.reshape(h,c.shape[1],w,c.shape[3],3).transpose(0,2,1,3,4).reshape(h,w,-1,3),axis=2)
    return out.astype(np.uint8), s

def to_rgba(a, mask=None):
    h,w=a.shape[:2]
    out=np.zeros((h,w,4),np.uint8); out[...,:3]=a[...,:3]
    out[...,3]=255 if mask is None else (mask>0)*255
    return out

def floodmask(a, seeds=None, tol=30, border=True):
    """Background mask by flood fill from border pixels (or seeds) with color tolerance."""
    h,w=a.shape[:2]
    bg=np.zeros((h,w),bool)
    img=a.astype(int)
    from collections import deque
    q=deque()
    if border:
        for x in range(w): q.append((0,x)); q.append((h-1,x))
        for y in range(h): q.append((y,0)); q.append((y,w-1))
    for s in (seeds or []): q.append(s)
    for (y,x) in list(q): bg[y,x]=True
    while q:
        y,x=q.popleft()
        for dy,dx in ((1,0),(-1,0),(0,1),(0,-1)):
            ny,nx=y+dy,x+dx
            if 0<=ny<h and 0<=nx<w and not bg[ny,nx]:
                if np.abs(img[ny,nx]-img[y,x]).sum()<=tol:
                    bg[ny,nx]=True; q.append((ny,nx))
    return ~bg

def grabcut(a, rect, iters=8, fg=None, bgpts=None):
    img=cv2.cvtColor(a,cv2.COLOR_RGB2BGR)
    big=cv2.resize(img,(a.shape[1]*4,a.shape[0]*4),interpolation=cv2.INTER_NEAREST)
    mask=np.zeros(big.shape[:2],np.uint8)
    bgd=np.zeros((1,65),np.float64); fgd=np.zeros((1,65),np.float64)
    x,y,w,h=rect
    cv2.grabCut(big,mask,(x*4,y*4,w*4,h*4),bgd,fgd,iters,cv2.GC_INIT_WITH_RECT)
    if fg is not None or bgpts is not None:
        if fg is not None:
            for (yy,xx) in fg: mask[yy*4:yy*4+4,xx*4:xx*4+4]=cv2.GC_FGD
        if bgpts is not None:
            for (yy,xx) in bgpts: mask[yy*4:yy*4+4,xx*4:xx*4+4]=cv2.GC_BGD
        cv2.grabCut(big,mask,None,bgd,fgd,iters,cv2.GC_INIT_WITH_MASK)
    m=((mask==1)|(mask==3)).astype(np.uint8)
    m=m.reshape(a.shape[0],4,a.shape[1],4).mean((1,3))>0.5
    return m

def keep_largest(m, n=1):
    num,lab,stats,_=cv2.connectedComponentsWithStats(m.astype(np.uint8),connectivity=4)
    if num<=1: return m
    order=np.argsort(-stats[1:,cv2.CC_STAT_AREA])[:n]+1
    return np.isin(lab,order)

def preview(rgba, path, scale=8):
    h,w=rgba.shape[:2]
    cb=np.indices((h,w)).sum(0)%2
    bg=np.where(cb[...,None],np.array([255,0,255]),np.array([0,200,120])).astype(np.uint8)
    al=rgba[...,3:4]/255
    out=(rgba[...,:3]*al+bg*(1-al)).astype(np.uint8)
    Image.fromarray(out).resize((w*scale,h*scale),Image.NEAREST).save(path)

# ---------- canvas helpers ----------
class Canvas:
    def __init__(self,w,h,color=(0,0,0)):
        self.w,self.h=w,h
        self.a=np.zeros((h,w,3),np.uint8); self.a[:]=color
    def px(self,x,y,c):
        if 0<=x<self.w and 0<=y<self.h: self.a[y,x]=c[:3]
    def rect(self,x0,y0,x1,y1,c):
        x0,y0=max(0,x0),max(0,y0); x1,y1=min(self.w,x1),min(self.h,y1)
        if x1>x0 and y1>y0: self.a[y0:y1,x0:x1]=c[:3]
    def paste(self,rgba,x,y,flip=False,alpha=1.0):
        s=rgba[:, ::-1] if flip else rgba
        h,w=s.shape[:2]
        X0,Y0=max(0,x),max(0,y); X1,Y1=min(self.w,x+w),min(self.h,y+h)
        if X1<=X0 or Y1<=Y0: return
        sub=s[Y0-y:Y1-y,X0-x:X1-x]
        al=(sub[...,3:4]/255.0)*alpha
        dst=self.a[Y0:Y1,X0:X1].astype(float)
        self.a[Y0:Y1,X0:X1]=(sub[...,:3]*al+dst*(1-al)).astype(np.uint8)
    def img(self): return Image.fromarray(self.a)
    def save(self,path,scale):
        self.img().resize((self.w*scale,self.h*scale),Image.NEAREST).save(path)

def outline(rgba, color=(0,0,0), thick=1, diag=False):
    a=rgba.copy(); h,w=a.shape[:2]
    pad=np.zeros((h+2*thick,w+2*thick,4),np.uint8); pad[thick:-thick,thick:-thick]=a
    m=pad[...,3]>0
    grown=m.copy()
    for _ in range(thick):
        g=grown.copy()
        g[1:]|=grown[:-1]; g[:-1]|=grown[1:]; g[:,1:]|=grown[:,:-1]; g[:,:-1]|=grown[:,1:]
        if diag:
            g[1:,1:]|=grown[:-1,:-1]; g[:-1,:-1]|=grown[1:,1:]; g[1:,:-1]|=grown[:-1,1:]; g[:-1,1:]|=grown[1:,:-1]
        grown=g
    ring=grown&~m
    pad[ring]=list(color)+[255]
    return pad

def upscale(rgba,k):
    return np.repeat(np.repeat(rgba,k,0),k,1)

def text_mask(txt,size,spacing=0):
    f=ImageFont.truetype(FONT,size)
    bbox=f.getbbox(txt)
    w=bbox[2]-bbox[0]+len(txt)*spacing+4; h=bbox[3]+4
    im=Image.new('L',(w,h),0); d=ImageDraw.Draw(im); d.fontmode='1'
    x=0
    if spacing:
        for ch in txt:
            d.text((x-bbox[0],0),ch,font=f,fill=255); x+=f.getlength(ch)+spacing
    else:
        d.text((-bbox[0],0),txt,font=f,fill=255)
    m=np.array(im)>127
    ys,xs=np.where(m)
    return m[ys.min():ys.max()+1, xs.min():xs.max()+1]

def draw_text(cv,txt,size,x,y,color,shadow=None,outline_c=None,center=False,spacing=0,grad=None):
    m=text_mask(txt,size,spacing)
    h,w=m.shape
    if center: x=x-w//2
    def stamp(mm,ox,oy,c):
        ys,xs=np.where(mm)
        for yy,xx in zip(ys,xs):
            col=c(yy,h) if callable(c) else c
            cv.px(ox+xx,oy+yy,col)
    if outline_c is not None:
        big=np.zeros((h+2,w+2),bool)
        for dy in (0,1,2):
            for dx in (0,1,2):
                big[dy:dy+h,dx:dx+w]|=m
        if shadow is not None:
            stamp(big,x-1+shadow[0],y-1+shadow[1],outline_c)
        stamp(big,x-1,y-1,outline_c)
    elif shadow is not None:
        stamp(m,x+shadow[0],y+shadow[1],shadow[2])
    stamp(m,x,y,grad if grad else color)
    return w,h

def lerp(c1,c2,t): return tuple(int(int(c1[i])+(int(c2[i])-int(c1[i]))*t) for i in range(3))

BAYER4=np.array([[0,8,2,10],[12,4,14,6],[3,11,1,9],[15,7,13,5]])/16.0
def dither_gradient(cv,x0,y0,x1,y1,stops,axis=1):
    """stops: list of colors; ordered dithering between successive bands"""
    n=len(stops)-1
    for y in range(y0,y1):
        for x in range(x0,x1):
            t=((y-y0)/(max(1,y1-y0-1))) if axis==1 else ((x-x0)/max(1,x1-x0-1))
            f=t*n; i=min(int(f),n-1); fr=f-i
            c=stops[i+1] if fr>BAYER4[y%4,x%4] else stops[i]
            cv.px(x,y,c)

def quantize(a, palette):
    pal=np.array(palette,float)
    d=((a[...,None,:3].astype(float)-pal[None,None])**2).sum(-1)
    return pal[d.argmin(-1)].astype(np.uint8)

def save_sleeve(cv, name, scale):
    out=cv.img().resize((cv.w*scale,cv.h*scale),Image.NEAREST)
    # fit to 750x1050
    if out.size!=(750,1050):
        bg=Image.new('RGB',(750,1050),tuple(int(v) for v in cv.a[0,0]))
        bg.paste(out,((750-out.size[0])//2,(1050-out.size[1])//2)); out=bg
    out.save(os.path.join(OUT,f'{name}.png'))
    return out

def grid_params(a):
    a=a.astype(int); res=[]
    for axis in (1,0):
        d=np.abs(np.diff(a,axis=axis)).sum(2)
        prof=d.sum(axis=0 if axis==1 else 1).astype(float); prof-=prof.mean()
        N=len(prof)*16
        F=np.fft.rfft(prof,n=N); freqs=np.fft.rfftfreq(N)
        m=(freqs>1/14)&(freqs<1/2.5)
        i=np.argmax(np.abs(F)*m); f=freqs[i]
        period=1/f
        # phase: edges located at positions k*period + ph
        ph=(-np.angle(F[i])/(2*np.pi*f))%period
        res.append((period,ph))
    return res  # [(px_period, x_edge_phase),(py_period,y_edge_phase)]

def native2(name_or_arr, box=None, period=None):
    """Resample card art to its native pixel grid."""
    a=card(name_or_arr) if isinstance(name_or_arr,str) else name_or_arr
    full=a
    if box: x0,y0,x1,y1=box
    else: x0,y0,x1,y1=70,168,680,568
    art=full[168:568,70:680]
    (pxp,phx),(pyp,phy)=grid_params(art)
    if period: pxp=pyp=period
    # edges at 70+phx+k*pxp (diff index i is boundary between i,i+1)
    ex=70+phx+0.5; ey=168+phy+0.5
    kx0=math.ceil((x0-ex)/pxp); kx1=math.floor((x1-ex)/pxp)
    ky0=math.ceil((y0-ey)/pyp); ky1=math.floor((y1-ey)/pyp)
    W=kx1-kx0; H=ky1-ky0
    out=np.zeros((H,W,3),np.uint8)
    for j in range(H):
        for i in range(W):
            cx=ex+(kx0+i+0.5)*pxp; cy=ey+(ky0+j+0.5)*pyp
            r=max(1,int(pxp*0.25))
            blk=full[int(cy)-r:int(cy)+r+1,int(cx)-r:int(cx)+r+1].reshape(-1,3)
            out[j,i]=np.median(blk,axis=0)
    return out,(pxp,pyp,ex,ey,kx0,ky0)

def keymask(a, rect, bg_pts, tol=40, fg_pts=(), connect=True):
    """Remove background by color key: colors near sampled bg colors, flood-connected from rect border."""
    x,y,w,h=rect
    sub=a[y:y+h,x:x+w].astype(int)
    cols=np.array([a[py,px] for (px,py) in bg_pts],int)
    d=np.sqrt(((sub[:,:,None,:]-cols[None,None])**2).sum(-1)).min(-1)
    near=d<tol
    if connect:
        num,lab=cv2.connectedComponents(near.astype(np.uint8),connectivity=4)
        border=set(np.unique(np.concatenate([lab[0],lab[-1],lab[:,0],lab[:,-1]])))-{0}
        for (px,py) in bg_pts:
            if x<=px<x+w and y<=py<y+h: border.add(lab[py-y,px-x])
        border.discard(0)
        bgm=np.isin(lab,list(border))
    else: bgm=near
    fg=~bgm
    for (px,py) in fg_pts: fg[py-y,px-x]=True
    return fg
