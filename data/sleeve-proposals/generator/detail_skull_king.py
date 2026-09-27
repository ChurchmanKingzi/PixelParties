# Full-resolution detail parts for Skullmael: crown, sword, skull
from px2 import *
import skelking2 as SK2
GOLD=[(70,34,8),(120,70,16),(176,116,32),(222,164,52),(248,206,96),(255,236,170),(255,255,236)]
STEEL=[(30,32,46),(60,66,86),(98,106,130),(146,154,178),(190,198,218),(226,232,246),(255,255,255)]
BONE=[(52,40,36),(100,86,72),(150,136,114),(196,184,158),(228,220,198),(248,244,230)]
RUBY=[(60,4,14),(130,10,30),(200,30,50),(250,90,100),(255,200,200)]
SAPH=[(8,16,60),(20,50,140),(50,110,220),(140,190,255),(230,245,255)]
EMER=[(4,40,20),(10,100,50),(40,170,90),(140,240,170),(230,255,240)]
OUT=(18,10,24)
def px(cv,x,y,c):
    x,y=int(x),int(y)
    if 0<=x<cv.w and 0<=y<cv.h: cv.px(x,y,c)
def rampc(ramp,v,x,y):
    n=len(ramp)-1; v=min(0.9999,max(0,v))*n; i=int(v); f=v-i
    return ramp[min(n,i+1)] if f>BAYER4[int(y)%4,int(x)%4] else ramp[i]
def gem(cv,cx,cy,rx,ry,R):
    for y in range(int(cy-ry)-1,int(cy+ry)+2):
        for x in range(int(cx-rx)-1,int(cx+rx)+2):
            d=((x-cx)/rx)**2+((y-cy)/ry)**2
            if d<=1:
                # facets: quadrant shading
                u,v=(x-cx)/rx,(y-cy)/ry
                t=0.55-0.35*u-0.35*v
                if abs(u)<0.35 and abs(v)<0.35: t=0.75   # table facet
                if d>0.7: t-=0.25
                px(cv,x,y,rampc(R,t,x,y))
            elif d<=1.45: px(cv,x,y,GOLD[1] if (x+y)%2 else GOLD[2])  # bezel
    px(cv,cx-rx*0.4,cy-ry*0.45,R[4]); px(cv,cx-rx*0.4+1,cy-ry*0.45,R[3]); px(cv,cx+rx*0.35,cy+ry*0.4,R[3])
def draw_crown(cv):
    CX=124.5
    B0,B1=100,108          # band rows (sits on the forehead)
    HW=22                  # band half width (skull is ~23 half-wide here)
    # velvet cap
    for y in range(86,B0+1):
        for x in range(int(CX-HW),int(CX+HW)+1):
            dd=((x-CX)/(HW-3))**2+((y-B0)/13)**2
            if dd<=1: px(cv,x,y,rampc([(40,10,50),(70,20,90),(110,40,140),(150,70,180)],0.7-0.4*(x-CX)/HW-0.3*(y-86)/14,x,y))
    # five points with ball finials
    for (dx,ty,hw) in [(-18,90,3.5),(-9,86,3.5),(0,82,4.5),(9,86,3.5),(18,90,3.5)]:
        tx=CX+dx
        for y in range(ty,B0+1):
            t=(y-ty)/(B0-ty); w=max(0.8,hw*t**0.9)
            for x in range(int(round(tx-w)),int(round(tx+w))+1):
                u=(x-tx)/max(1,w)
                v=0.8-0.45*u-0.15*t
                if u>0.45: v=0.3
                px(cv,x,y,rampc(GOLD,v,x,y))
            px(cv,round(tx-w)-1,y,OUT); px(cv,round(tx+w)+1,y,OUT)
        for y in range(ty-4,ty+1):
            for x in range(int(tx)-3,int(tx)+4):
                dd=math.hypot(x-tx,y-(ty-2))
                if dd<=2.2: px(cv,x,y,rampc(GOLD,0.95-0.2*(x-tx)-0.15*(y-ty+2),x,y))
                elif dd<=3.0: px(cv,x,y,OUT)
        px(cv,tx-1,ty-3,GOLD[6])
    # band (slightly flared towards the bottom)
    for y in range(B0,B1+1):
        hw=HW-1+ (y-B0)*0.25
        for x in range(int(CX-hw),int(CX+hw)+1):
            e=min(x-(CX-hw),(CX+hw)-x)
            t=[0.95,0.78,0.66,0.6,0.55,0.5,0.44,0.36,0.26][y-B0]
            if e<1.5: t-=0.2
            c=rampc(GOLD,t,x,y)
            if y in (103,105) and int(x-CX)%6 in (2,3): c=GOLD[1]    # engraving
            px(cv,x,y,c)
        px(cv,CX-hw-1,y,OUT); px(cv,CX+hw+1,y,OUT)
    for x in range(int(CX-HW)-1,int(CX+HW)+3): px(cv,x,B0-1,OUT) if abs(x-CX)>6 else None; px(cv,x,B1+1,OUT)
    for x in range(int(CX-HW)+1,int(CX+HW),3): px(cv,x,B1-1,GOLD[5])
    # gems
    gem(cv,CX,104,3.2,3.0,RUBY); gem(cv,CX-12,104,2.0,2.0,SAPH); gem(cv,CX+12,104,2.0,2.0,SAPH)
    # glints
    for (gx,gy) in [(108,101),(121,84)]:
        for k in range(-1,2): px(cv,gx+k,gy,GOLD[6]); px(cv,gx,gy+k,GOLD[6])
def draw_sword(cv):
    CX=124.5
    # pommel
    for y in range(144,158):
        for x in range(116,134):
            d=math.hypot(x-CX,y-151)
            if d<=6: px(cv,x,y,rampc(GOLD,0.85-0.12*(x-CX)-0.1*(y-151),x,y))
            elif d<=7: px(cv,x,y,OUT)
    gem(cv,CX,151,2.2,2.2,RUBY)
    # grip: leather wrap
    for y in range(158,178):
        for x in range(119,131):
            u=(x-CX)/5.5
            band=((y+ (x-119)//2)%5)
            c=[(40,22,14),(80,46,24),(118,72,38),(150,98,54)][2 if band in (1,2) else (1 if band==3 else 0)]
            if u<-0.5 and band in (1,2): c=(176,120,70)
            if u>0.6: c=(30,16,10)
            px(cv,x,y,c)
        px(cv,118,y,OUT); px(cv,131,y,OUT)
    for y in (158,177):
        for x in range(118,132): px(cv,x,y,GOLD[3] if x<125 else GOLD[2])
    # bony fingers wrapping the grip (two hands)
    for (hy,side) in [(161,-1),(169,1)]:
        for k in range(4):
            fy=hy+k*2
            for x in range(117,133):
                if (x in (120,129) and k%2==0) or (x in (124,125) and k%2==1): continue
                px(cv,x,fy,rampc(BONE,0.75-0.3*(x-117)/16,x,fy))
            px(cv,116,fy,OUT); px(cv,133,fy,OUT); 
        for x in range(117,133,5): px(cv,x,hy+7,BONE[1])
    # cross-guard with curled quillons
    for y in range(176,190):
        for x in range(84,166):
            dx=abs(x-CX)
            top=178+ (dx/42)**2*6
            bot=186+ (dx/42)**2*7
            if top<=y<=bot and dx<=41:
                t=0.85-(y-top)/(bot-top+1)*0.6
                px(cv,x,y,rampc(GOLD,t,x,y))
            elif (top-1<=y<top or bot<y<=bot+1) and dx<=41: px(cv,x,y,OUT)
    for sx in (-1,1):
        cx,cy=CX+sx*41,191
        for a in np.linspace(0,1.6*math.pi,50):
            r=4.5-a*0.9
            X=cx+sx*math.cos(a)*r*(-1); Y=cy-math.sin(a)*r
            px(cv,X,Y,GOLD[4]); px(cv,X+sx,Y+1,GOLD[1])
    # sun medallion
    for y in range(170,196):
        for x in range(110,140):
            d=math.hypot(x-CX,y-183); a=math.atan2(y-183,x-CX)
            ray=abs(math.sin(a*6))>0.7 and d<12.5
            if d<=8: px(cv,x,y,rampc(GOLD,0.9-0.06*(x-CX)-0.05*(y-183),x,y))
            elif d<=9: px(cv,x,y,OUT)
            elif ray: px(cv,x,y,GOLD[4] if a<0 else GOLD[3])
    gem(cv,CX,183,4,4,RUBY)
    # blade
    for y in range(196,292):
        t=(y-196)/96
        hw=7.0 if y<280 else 7.0*(292-y)/12
        for x in range(int(CX-hw)-1,int(CX+hw)+2):
            u=(x-CX)/max(0.8,hw)
            if abs(u)<=1:
                if abs(u)<0.16: c=STEEL[1]                 # fuller groove
                elif abs(u)<0.3: c=STEEL[4] if u<0 else STEEL[2]
                elif u<0: c=rampc(STEEL,0.78-0.15*t,x,y)   # lit bevel
                else: c=rampc(STEEL,0.42-0.12*t,x,y)       # shadow bevel
                if u<-0.85: c=STEEL[6]
                if u>0.85: c=STEEL[0]
                px(cv,x,y,c)
    # outline hugging the blade (computed from the drawn pixels)
    bm=np.zeros((cv.h,cv.w),bool)
    for y in range(196,293):
        hw=7.0 if y<280 else 7.0*(292-y)/12
        for x in range(int(CX-hw)-1,int(CX+hw)+2):
            if abs((x-CX)/max(0.8,hw))<=1: bm[y,x]=True
    ring=(cv2.dilate(bm.astype(np.uint8),np.array([[0,1,0],[1,1,1],[0,1,0]],np.uint8))>0)&~bm
    for y,x in zip(*np.where(ring)):
        if y>=196: px(cv,x,y,OUT)
    # diagonal specular glints on the blade
    for y0 in (204,236):
        for k in range(10): px(cv,CX-6+k*0.6,y0+k,STEEL[6]) if k%3!=2 else None
    # glowing runes in the fuller
    RUNES=[["#.#",".#.","#.#"],["##.",".#.",".##"],[".#.","###",".#."],["#..","###","..#"]]
    for i,y0 in enumerate(range(212,272,14)):
        g=RUNES[i%4]
        for yy,r in enumerate(g):
            for xx,ch in enumerate(r):
                if ch=='#': px(cv,CX-1+xx-0.5,y0+yy,(230,160,255))
        for dy in range(-3,6):
            for dx in range(-3,4):
                X,Y=int(CX+dx),y0+dy
                if BAYER4[Y%4,X%4]<0.18 and dx*dx+(dy-1)**2<12: cv.px(X,Y,lerp(tuple(cv.a[Y,X]),(200,120,255),0.35))
def draw_skull(cv):
    CX=124.5; CY=117
    # cranium + cheek + jaw mask
    m=np.zeros((cv.h,cv.w),bool)
    for y in range(96,140):
        for x in range(96,154):
            u=(x-CX); v=(y-CY)
            cran=(u/26)**2+((v+2)/19)**2<=1 and y<=124
            cheek=abs(u)<=22-max(0,y-124)*0.9 and 118<=y<=132
            jaw=abs(u)<=14-max(0,y-132)*0.8 and 128<=y<=139
            if cran or cheek or jaw: m[y,x]=True
    d=cv2.distanceTransform(np.pad(m.astype(np.uint8),1),cv2.DIST_L2,3)[1:-1,1:-1]
    for y,x in zip(*np.where(m)):
        u=(x-CX)/26; v=(y-CY)/20
        t=0.72-0.35*u-0.2*v+min(d[y,x],4)/4*0.12
        px(cv,x,y,rampc(BONE,t,x,y))
    # outline
    ring=(cv2.dilate(m.astype(np.uint8),np.ones((3,3),np.uint8))>0)&~m
    for y,x in zip(*np.where(ring)):
        px(cv,x,y,OUT)
    # eye sockets (deep) with glowing pupils
    for sx in (-1,1):
        ex,ey=CX+sx*10,119
        for y in range(ey-6,ey+6):
            for x in range(int(ex-8),int(ex+8)):
                dd=((x-ex)/7)**2+((y-ey)/5.2)**2
                if dd<=1: px(cv,x,y,(14,6,14) if dd<0.75 else (40,26,34))
                elif dd<=1.35 and y<ey: px(cv,x,y,BONE[1])
        for y in range(ey-2,ey+3):
            for x in range(int(ex-2),int(ex+3)):
                dd=math.hypot(x-ex,y-ey)
                if dd<=2.4: px(cv,x,y,(255,70,50) if dd>1.2 else (255,220,190))
        for y in range(ey-9,ey+10):
            for x in range(int(ex-10),int(ex+11)):
                dd=math.hypot(x-ex,y-ey)
                if 3<dd<9 and BAYER4[y%4,x%4]<(1-dd/9)*0.5: cv.px(x,y,lerp(tuple(cv.a[y,x]),(255,60,40),0.4))
    # nasal cavity (inverted heart)
    for y in range(124,131):
        for x in range(119,131):
            u=abs(x-CX); v=y-124
            if u<=3.5-v*0.45 and not (v<2 and u<0.6): px(cv,x,y,(20,10,16))
    # cheekbone shadows
    for sx in (-1,1):
        for k in range(7): px(cv,CX+sx*(15+k*0.6),127+k*0.5,BONE[1])
    # cracks
    crack=[(104,112),(105,113),(105,114),(106,115),(107,115),(107,116),(108,117)]
    for (x,y) in crack: px(cv,x,y,BONE[0]); px(cv,x+1,y,BONE[4])
    for (x,y) in [(145,111),(144,112),(144,113),(143,114),(144,115)]: px(cv,x,y,BONE[0])
def bone_seg(cv,p0,p1,w):
    m=np.zeros((cv.h,cv.w),bool)
    n=int(max(abs(p1[0]-p0[0]),abs(p1[1]-p0[1]))*2)+1
    for i in range(n):
        t=i/(n-1); x=p0[0]+(p1[0]-p0[0])*t; y=p0[1]+(p1[1]-p0[1])*t
        for yy in range(int(y-w)-1,int(y+w)+2):
            for xx in range(int(x-w)-1,int(x+w)+2):
                if (xx-x)**2+(yy-y)**2<=w*w: m[yy,xx]=True
    return m
def draw_forearms(cv):
    for side in (-1,1):
        el=(124.5+side*39,190.0); wr=(124.5+side*9,167.0)
        dx,dy=wr[0]-el[0],wr[1]-el[1]; L=math.hypot(dx,dy); nx,ny=-dy/L,dx/L
        mA=bone_seg(cv,(el[0]+nx*2.2,el[1]+ny*2.2),(wr[0]+nx*1.6,wr[1]+ny*1.6),1.9)   # ulna
        mB=bone_seg(cv,(el[0]-nx*2.2,el[1]-ny*2.2),(wr[0]-nx*1.6,wr[1]-ny*1.6),1.7)   # radius
        knob=np.zeros_like(mA); yy,xx=np.indices(knob.shape)
        knob|=np.hypot(xx-el[0],yy-el[1])<=4.6
        knob|=np.hypot(xx-wr[0],yy-wr[1])<=3.2
        m=mA|mB|knob
        ring=(cv2.dilate(m.astype(np.uint8),np.ones((3,3),np.uint8))>0)&~m
        for y,x in zip(*np.where(ring)): px(cv,x,y,OUT)
        for y,x in zip(*np.where(m)):
            t=0.9-0.25*(y-167)/24
            c=rampc(BONE,t,x,y)
            px(cv,x,y,c)
        # gap between the two bones
        for i in range(4,int(L)-4):
            t=i/L; x=el[0]+dx*t; y=el[1]+dy*t
            px(cv,x,y,BONE[1])
        px(cv,el[0]-1,el[1]-2,BONE[5]); px(cv,wr[0]-1,wr[1]-1,BONE[5])
def draw_mouth(cv):
    CX=124.5
    DARK=(30,14,20)
    U=12.5
    top=lambda u: 131.0-2.6*(u/U)**2
    mid=lambda u: 134.6-2.9*(u/U)**2
    bot=lambda u: 138.0-3.2*(u/U)**2
    for x in range(int(CX-U)-1,int(CX+U)+2):
        u=x-CX
        if abs(u)>U+0.5: continue
        yt,ym,yb=int(round(top(u))),int(round(mid(u))),int(round(bot(u)))
        gap=(int(round(u+0.5))%3==0)          # 1px fugue between 2px teeth (symmetric)
        for y in range(yt,yb+1):
            if y==yt or y==yb or y==ym or gap: c=DARK
            elif y<ym: c=BONE[5] if y==yt+1 else BONE[4]
            else: c=BONE[3] if y==ym+1 else BONE[2]
            px(cv,x,y,c)
    # corners
    for s in (-1,1):
        x=CX+s*(U+1); px(cv,x,round(mid(U)),DARK)
def draw_all(cv,KX,KY):
    draw_skull(cv)
    draw_mouth(cv)
    draw_crown(cv)
    draw_sword(cv)
    draw_forearms(cv)
