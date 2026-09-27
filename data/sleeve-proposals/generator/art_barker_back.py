# Barker (Monster Trainer skin) seen from behind, 4-shade handheld style.
# values: 0 darkest .. 3 lightest, -1 transparent
import numpy as np, math, cv2
Wd,Hd=50,54
def build():
    g=np.full((Hd,Wd),-1,int); part=np.full((Hd,Wd),'',object)
    def ell(cx,cy,rx,ry,v,p,cond=None):
        for y in range(Hd):
            for x in range(Wd):
                if ((x-cx)/rx)**2+((y-cy)/ry)**2<=1 and (cond is None or cond(x,y)): g[y,x]=v; part[y,x]=p
    def poly(pts,v,p):
        mk=np.zeros((Hd,Wd),np.uint8); cv2.fillPoly(mk,[np.array(pts,np.int32)],1)
        g[mk>0]=v; part[mk>0]=p
    def thick(p0,p1,w,v,p):
        n=int(max(abs(p1[0]-p0[0]),abs(p1[1]-p0[1]))*2)+1
        for i in range(n):
            t=i/(n-1); cx=p0[0]+(p1[0]-p0[0])*t; cy=p0[1]+(p1[1]-p0[1])*t
            ell(cx,cy,w/2,w/2,v,p)
    CX=19
    # torso
    poly([(CX-11,25),(CX+11,25),(CX+19,31),(CX+21,54),(CX-21,54),(CX-19,31)],1,'jacket')
    # left arm (hanging) - slightly separated
    poly([(CX-19,31),(CX-23,35),(CX-24,54),(CX-17,54),(CX-16,38)],1,'larm')
    # raised right arm
    thick((CX+14,29),(CX+22,18),7,1,'rarm')
    thick((CX+22,18),(CX+23,10),6,1,'rarm')
    ell(CX+23,8,3,3,2,'hand')
    # ball
    ell(CX+24,5,5.2,5.2,3,'ball')
    # neck, collar
    poly([(CX-3,20),(CX+3,20),(CX+3,23),(CX-3,23)],2,'neck')
    poly([(CX-11,25),(CX-4,22),(CX+4,22),(CX+11,25),(CX+9,27),(CX-9,27)],2,'collar')
    # hair
    ell(CX,17.5,8.5,4,0,'hair')
    # cap dome
    ell(CX,13,11.5,11,3,'cap',cond=lambda x,y: y<=15)
    # --- shading & details ---
    for y in range(Hd):
        for x in range(Wd):
            p=part[y,x]
            if p=='cap':
                if x>CX+5: g[y,x]=2
                elif x>CX+3 and (x+y)%2: g[y,x]=2
                if y==15: g[y,x]=2 if x<=CX+5 else 1
            if p=='hair':
                if (x*3+y)%5==0 and x<CX+4: g[y,x]=1
            if p in('jacket','larm'):
                if y<31 and x<CX-2 and (x+y)%2==0: g[y,x]=2
                if x>CX+12 and (x+y)%2==0: g[y,x]=0
                if p=='larm' and x<CX-21 and (x+y)%2==0: g[y,x]=2
            if p=='rarm':
                if x>CX+24 or (x>CX+22 and (x+y)%2): g[y,x]=0
                elif x<CX+19 and (x+y)%2==0: g[y,x]=2
            if p=='ball':
                if y<5: g[y,x]=1
                if y==5: g[y,x]=0
                if y in (1,2) and x in (CX+21,CX+22): g[y,x]=2
                if y>5 and x>CX+26: g[y,x]=2
    # cap seams + button + strap
    for y in range(3,15):
        g[y,CX]=2
        for s in (-1,1):
            xx=int(round(CX+s*(1.5+(y-3)*0.55)))
            if part[y,xx]=='cap': g[y,xx]=2 if s<0 else 1
    g[2,CX]=1; g[2,CX+1]=1
    for x in range(CX-3,CX+4): g[14,x]=1 if x%2 else 2
    # hair spikes
    for (x,y) in [(CX-8,20),(CX-9,21),(CX-4,21),(CX-3,22),(CX+2,21),(CX+3,22),(CX+7,20),(CX+8,21)]: g[y,x]=0; part[y,x]='hair'
    # ears
    for s in (-1,1):
        g[16,CX+s*10]=2; g[17,CX+s*10]=2; part[16,CX+s*10]='ear'; part[17,CX+s*10]='ear'
    # jacket: centre seam, emblem (ball), folds
    for y in range(29,Hd): g[y,CX]=0 if y%4 else 1
    for y in range(32,41):
        for x in range(CX-5,CX+6):
            d=math.hypot(x-CX,y-36)
            if d<=3.6: g[y,x]=3 if y<36 else 2
            elif d<=4.6: g[y,x]=0
    for x in range(CX-4,CX+5): g[36,x]=0
    g[36,CX]=3
    for (x0,y0) in [(CX-13,42),(CX+9,45),(CX-7,48)]:
        for k in range(5): g[y0+k,x0+k//2]=0
    # separation line between left arm and torso
    for y in range(36,Hd): g[y,CX-17+ (0 if y<44 else 0)]=0
    # ball button
    for (dx,dy,v) in [(0,0,3),(-1,0,0),(1,0,0),(0,-1,0),(0,1,0),(-1,-1,0),(1,-1,0),(-1,1,0),(1,1,0),(-2,0,0),(2,0,0)]: g[5+dy,CX+24+dx]=v
    g[5,CX+24]=3
    # --- outline ---
    m=g>=0; out=g.copy()
    for y in range(Hd):
        for x in range(Wd):
            if not m[y,x]:
                for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)):
                    X,Y=x+dx,y+dy
                    if 0<=X<Wd and 0<=Y<Hd and m[Y,X]: out[y,x]=0; break
    # inner separations
    for y in range(1,Hd):
        for x in range(1,Wd):
            a,b=part[y,x],part[y-1,x]
            if a in('collar','neck') and b in('hair',): out[y,x]=0
            if a=='jacket' and b=='collar': out[y,x]=0
            if a=='rarm' and part[y,x-1] in ('jacket',) : out[y,x]=0
            if a=='hand' and b=='ball': out[y,x]=0
            if a=='ball' and part[y+1 if y+1<Hd else y,x]=='hand': out[y,x]=0
    return out
def to_rgba(g,pal):
    h,w=g.shape; a=np.zeros((h,w,4),np.uint8)
    for y in range(h):
        for x in range(w):
            if g[y,x]>=0: a[y,x,:3]=pal[g[y,x]]; a[y,x,3]=255
    return a
GB=[(30,44,30),(72,104,56),(140,170,74),(210,224,150)]
if __name__=='__main__':
    import sys; sys.path.insert(0,'.')
    from pp import SP
    from PIL import Image
    a=to_rgba(build(),GB); bg=np.zeros_like(a); bg[...]=(*GB[3],255)
    al=a[...,3:]/255; im=(a[...,:3]*al+bg[...,:3]*(1-al)).astype(np.uint8)
    Image.fromarray(im).resize((Wd*8,Hd*8),Image.NEAREST).save(SP+'/barker_back.png')
