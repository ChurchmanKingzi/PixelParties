# v2 toolkit: 250x350 canvas (3px grid), scale2x, auto-shading, sprite adaptation
from pp import *
W2,H2=250,350
def scale2x(a):
    """EPX/Scale2x on RGBA array (compares full RGBA)."""
    h,w=a.shape[:2]
    P=np.pad(a,((1,1),(1,1),(0,0)),mode='edge')
    E=P[1:-1,1:-1]; B=P[:-2,1:-1]; D=P[1:-1,:-2]; F=P[1:-1,2:]; Hh=P[2:,1:-1]
    eq=lambda x,y: np.all(x==y,axis=-1)
    c=(~eq(B,Hh))&(~eq(D,F))
    E0=np.where((c&eq(D,B))[...,None],D,E)
    E1=np.where((c&eq(B,F))[...,None],F,E)
    E2=np.where((c&eq(D,Hh))[...,None],D,E)
    E3=np.where((c&eq(Hh,F))[...,None],F,E)
    out=np.zeros((h*2,w*2,a.shape[2]),a.dtype)
    out[0::2,0::2]=E0; out[0::2,1::2]=E1; out[1::2,0::2]=E2; out[1::2,1::2]=E3
    return out

def quant_colors(a, n=12):
    """reduce sprite palette (removes jpeg-ish noise)"""
    op=a[...,3]>0
    Z=a[op][:,:3].astype(np.float32)
    n=min(n,len(np.unique(Z,axis=0)))
    _,lab,cen=cv2.kmeans(Z,n,None,(cv2.TERM_CRITERIA_EPS+cv2.TERM_CRITERIA_MAX_ITER,40,0.5),4,cv2.KMEANS_PP_CENTERS)
    out=a.copy(); out[op,:3]=cen[lab.ravel()].astype(np.uint8)
    return out

def lum(c): return 0.3*c[...,0]+0.59*c[...,1]+0.11*c[...,2]

def shade_pass(a, light=(-0.6,-0.8), strength=0.28, ambient=None, amb_k=0.0, rim=None, rim_k=0.55, seed=0):
    """Adds form shading with ordered dithering: computes a soft normal from the alpha mask
    distance field, darkens away from the light, lightens toward it."""
    a=a.copy(); h,w=a.shape[:2]
    m=(a[...,3]>0).astype(np.uint8)
    dist=cv2.distanceTransform(np.pad(m,1),cv2.DIST_L2,3)[1:-1,1:-1]
    hgt=np.sqrt(np.minimum(dist,6)/6.0)
    hb=cv2.GaussianBlur(hgt.astype(np.float32),(0,0),1.6)
    gy,gx=np.gradient(hb)
    nz=0.35
    nrm=np.sqrt(gx**2+gy**2+nz**2)
    L=np.array([light[0],light[1],0.7]); L=L/np.linalg.norm(L)
    d=(-gx*L[0]-gy*L[1]+nz*L[2])/nrm  # -grad points outward? gradient points inward (height increases inward)
    d=(gx*(-L[0])*-1 + gy*(-L[1])*-1)  # placeholder
    # outward normal = -grad(height)
    nxo,nyo=-gx,-gy
    lam=(nxo*L[0]+nyo*L[1])/np.maximum(1e-6,np.sqrt(nxo**2+nyo**2+1e-4))*np.minimum(1,np.sqrt(nxo**2+nyo**2)*6)
    # lam in [-1,1]: +1 facing light
    rgb=a[...,:3].astype(float)
    B=BAYER4[np.arange(h)[:,None]%4,np.arange(w)[None,:]%4]
    dark=(lam<-0.15)
    darker=(lam<-0.55)
    lite=(lam>0.35)
    t_d=np.clip((-lam-0.15)/0.6,0,1); t_l=np.clip((lam-0.35)/0.5,0,1)
    fd=np.where(B<t_d*1.2,1-strength,1.0)
    fd=np.where(darker&(B<0.8),fd*(1-strength*0.5),fd)
    rgb=rgb*fd[...,None]
    fl=np.where(B<t_l*0.9,1,0)
    hi=np.array(rim if rim is not None else (255,255,255),float)
    rgb=np.where(fl[...,None]>0, rgb*(1-strength)+hi*strength, rgb)
    if ambient is not None and amb_k>0:
        rgb=rgb*(1-amb_k)+np.array(ambient,float)*amb_k
    a[...,:3]=np.clip(rgb,0,255).astype(np.uint8)
    a[m==0]=0
    return a

def selout(a, outc, darken=0.45):
    """selective outline: 1px outer outline colored by darkened neighbour, plus darkest where silhouette faces down"""
    h,w=a.shape[:2]
    pad=np.zeros((h+2,w+2,4),np.uint8); pad[1:-1,1:-1]=a
    m=pad[...,3]>0
    out=pad.copy()
    for y in range(h+2):
        for x in range(w+2):
            if m[y,x]: continue
            nb=[]
            for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)):
                X,Y=x+dx,y+dy
                if 0<=X<w+2 and 0<=Y<h+2 and m[Y,X]: nb.append(pad[Y,X,:3].astype(float))
            if nb:
                c=np.mean(nb,0)*darken+np.array(outc,float)*(1-darken)*1.0
                c=np.array(outc,float)*0.7+np.mean(nb,0)*0.3*darken
                out[y,x,:3]=np.clip(c,0,255); out[y,x,3]=255
    return out

def adapt(a, grade=None, grade_k=0.12, light=(-0.6,-0.8), rim=None, outc=(24,16,32), n_colors=14, strength=0.25):
    """in-game sprite -> bigger (scale2x), cleaned palette, shaded w/ dither, graded to scene."""
    s=quant_colors(a,n_colors)
    s=scale2x(s)
    s=shade_pass(s,light=light,strength=strength,ambient=grade,amb_k=grade_k,rim=rim)
    return s

class C2(Canvas):
    def __init__(self,color=(0,0,0)): super().__init__(W2,H2,color)

def save2(cv,name): return save_sleeve(cv,name,3)

def noise(h,w,scale=6,seed=0,octaves=3):
    rng=np.random.RandomState(seed); out=np.zeros((h,w),np.float32); amp=1; tot=0
    for o in range(octaves):
        s=max(1,int(scale/(2**o)))
        small=rng.rand(h//s+2,w//s+2).astype(np.float32)
        big=cv2.resize(small,((w//s+2)*s,(h//s+2)*s),interpolation=cv2.INTER_CUBIC)[:h,:w]
        out+=big*amp; tot+=amp; amp*=0.5
    return out/tot

def ramp_fill(cv, mask, ramp, value, x0=0,y0=0):
    """fill mask pixels choosing ramp color by value in [0,1] with ordered dither"""
    ys,xs=np.where(mask)
    n=len(ramp)-1
    for y,x in zip(ys,xs):
        v=min(0.9999,max(0,value[y,x]))*n
        i=int(v); f=v-i
        c=ramp[min(n,i+1)] if f>BAYER4[(y+y0)%4,(x+x0)%4] else ramp[i]
        cv.px(x+x0,y+y0,c)

def dither_edges(a, max_dl=70, min_dl=6, width=1):
    """soften internal colour-band boundaries with checker dithering (outline edges untouched)"""
    a=a.copy(); h,w=a.shape[:2]
    src=a.copy()
    L=lum(src[...,:3].astype(float))
    for y in range(h):
        for x in range(w):
            if src[y,x,3]==0 or (x+y)%2: continue
            for dx,dy in ((1,0),(0,1),(-1,0),(0,-1)):
                X,Y=x+dx,y+dy
                if 0<=X<w and 0<=Y<h and src[Y,X,3]:
                    dl=L[Y,X]-L[y,x]
                    if min_dl<abs(dl)<max_dl and L[y,x]>40 and L[Y,X]>40:
                        # take the lighter neighbour's colour into the darker band (one px)
                        if dl>0: a[y,x,:3]=src[Y,X,:3]
                        break
    return a

def adapt(a, grade=None, grade_k=0.12, light=(-0.6,-0.8), rim=None, n_colors=14, strength=0.25, dither=True):
    s=quant_colors(a,n_colors)
    s=scale2x(s)
    if dither: s=dither_edges(s)
    s=shade_pass(s,light=light,strength=strength,ambient=grade,amb_k=grade_k,rim=rim)
    return s

def relief(cv, hmap, matmap, ramps, mask, light=(-0.62,-0.62,0.48), k=2.2, bias=0.0, blur=0.6, albedo=None):
    """shade a height map (carved relief) with per-material colour ramps and ordered dithering"""
    h=hmap.astype(np.float32)
    if blur>0: h=cv2.GaussianBlur(h,(0,0),blur)
    gy,gx=np.gradient(h)
    L=np.array(light,float); L/=np.linalg.norm(L)
    nx,ny,nz=-gx*k,-gy*k,np.ones_like(gx)
    nn=np.sqrt(nx*nx+ny*ny+nz*nz)
    lam=(nx*L[0]+ny*L[1]+nz*L[2])/nn
    lam0=L[2]  # flat surface value
    val=0.5+(lam-lam0)*1.6+bias
    if albedo is not None: val=val+albedo
    ys,xs=np.where(mask)
    for y,x in zip(ys,xs):
        ramp=ramps[matmap[y,x]]
        n=len(ramp)-1
        v=min(0.9999,max(0.0,val[y,x]))*n
        i=int(v); f=v-i
        c=ramp[min(n,i+1)] if f>BAYER4[y%4,x%4] else ramp[i]
        cv.px(x,y,c)
    return val

def scale3x_labels(L):
    """AdvMAME3x on a 2D integer label array"""
    h,w=L.shape
    P=np.pad(L,1,mode='edge')
    A=P[:-2,:-2];B=P[:-2,1:-1];C=P[:-2,2:];D=P[1:-1,:-2];E=P[1:-1,1:-1];F=P[1:-1,2:];G=P[2:,:-2];Hh=P[2:,1:-1];I=P[2:,2:]
    out=np.zeros((h*3,w*3),L.dtype)
    c1=(D==B)&(D!=Hh)&(B!=F); c2=(B==F)&(B!=D)&(F!=Hh); c3=(D==Hh)&(D!=B)&(Hh!=F); c4=(Hh==F)&(Hh!=D)&(F!=B)
    out[0::3,0::3]=np.where(c1,D,E)
    out[0::3,1::3]=np.where((c1&(E!=C))|(c2&(E!=A)),B,E)
    out[0::3,2::3]=np.where(c2,F,E)
    out[1::3,0::3]=np.where((c1&(E!=G))|(c3&(E!=A)),D,E)
    out[1::3,1::3]=E
    out[1::3,2::3]=np.where((c2&(E!=I))|(c4&(E!=C)),F,E)
    out[2::3,0::3]=np.where(c3,D,E)
    out[2::3,1::3]=np.where((c3&(E!=I))|(c4&(E!=G)),Hh,E)
    out[2::3,2::3]=np.where(c4,F,E)
    return out
def glass_ramp(c):
    c=np.array(c,float)
    return [tuple(np.clip(c*0.45,0,255).astype(int)),tuple(np.clip(c*0.72,0,255).astype(int)),tuple(c.astype(int)),
            tuple(np.clip(c+(255-c)*0.35,0,255).astype(int)),tuple(np.clip(c+(255-c)*0.7,0,255).astype(int))]

def render_regions(L, mats, outline_key='K', outline_col=(20,14,26), light=(-0.62,-0.62,0.48), seed=0, thin=True):
    """L: 2D array of single-char material keys ('.' = empty).
    mats: key -> dict(ramp=[...], pillow=3.0, k=1.4, noise=0.0, folds=None, spec=False, bias=0.0, flat=False)
    Returns RGBA."""
    L=np.array(L)
    h,w=L.shape
    empty=(L=='.')
    K=(L==outline_key)
    if thin:
        # keep silhouette outline; thin internal outlines to 1px
        sil=K & (cv2.dilate(empty.astype(np.uint8),np.ones((3,3),np.uint8))>0)
        core=cv2.erode(K.astype(np.uint8),np.ones((3,3),np.uint8))>0
        # skeleton-ish: keep pixels whose 4-neighbourhood has non-K on both opposite sides OR core
        keep=sil|core
        rem=K&~keep
        # assign removed pixels to nearest non-K material
        src=(~K&~empty).astype(np.uint8)
        _,labels=cv2.distanceTransformWithLabels(1-src,cv2.DIST_L2,3,labelType=cv2.DIST_LABEL_PIXEL)
        ys,xs=np.where(src>0)
        lookup={}
        for y,x in zip(ys,xs): lookup[labels[y,x]]=L[y,x]
        L2=L.copy()
        for y,x in zip(*np.where(rem)):
            L2[y,x]=lookup.get(labels[y,x],outline_key)
        # then thin the remaining 'core' further: 3px lines -> keep middle line only
        L=L2
    out=np.zeros((h,w,4),np.uint8)
    rng=np.random.RandomState(seed)
    Lv=np.array(light,float); Lv/=np.linalg.norm(Lv)
    for key,m in mats.items():
        mask=(L==key)
        if not mask.any(): continue
        num,cc=cv2.connectedComponents(mask.astype(np.uint8),connectivity=4)
        hgt=np.zeros((h,w),np.float32)
        for i in range(1,num):
            mm=(cc==i).astype(np.uint8)
            d=cv2.distanceTransform(np.pad(mm,1),cv2.DIST_L2,3)[1:-1,1:-1]
            p=m.get('pillow',3.0)
            hgt+=np.sqrt(np.minimum(d,p)/p)*p*0.6
        if m.get('folds'):
            fx,fy,amp=m['folds']
            yy,xx=np.indices((h,w))
            hgt+=np.sin(xx*fx+yy*fy+np.sin(yy*0.05)*2)*amp*mask
        if m.get('noise',0)>0:
            hgt+=(noise(h,w,m.get('nscale',3),seed=seed+ord(key),octaves=2)-0.5)*m['noise']*mask
        hb=cv2.GaussianBlur(hgt,(0,0),0.7)
        gy,gx=np.gradient(hb)
        k=m.get('k',1.4)
        nx,ny,nz=-gx*k,-gy*k,np.ones_like(gx)
        nn=np.sqrt(nx*nx+ny*ny+nz*nz)
        lam=(nx*Lv[0]+ny*Lv[1]+nz*Lv[2])/nn
        val=0.5+(lam-Lv[2])*1.8+m.get('bias',0.0)
        if m.get('flat'): val=np.full((h,w),0.5+m.get('bias',0.0))
        ramp=m['ramp']; n=len(ramp)-1
        ys,xs=np.where(mask)
        for y,x in zip(ys,xs):
            v=min(0.9999,max(0,val[y,x]))*n; i=int(v); f=v-i
            c=ramp[min(n,i+1)] if f>BAYER4[y%4,x%4] else ramp[i]
            out[y,x,:3]=c; out[y,x,3]=255
        if m.get('spec'):
            for y,x in zip(ys,xs):
                if val[y,x]>0.93 and (x+y)%3==0: out[y,x,:3]=m.get('spec_col',(255,255,240))
    kk=(L==outline_key)
    out[kk,:3]=outline_col; out[kk,3]=255
    return out
