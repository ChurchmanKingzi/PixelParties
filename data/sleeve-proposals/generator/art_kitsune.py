import numpy as np, math
LEFT=[
".....K.........",
".....KK........",
".....KRK.......",
".....KRWK......",
"....KRRWWK.....",
"....KRWWWWKKKKK",
"....KWWWWWWWWWW",
"...KWWWWWWWWWWW",
"...KWWRRWWWWWWW",
"...KWWWKKWWWWWW",
"...KWWWWRKWWWWW",
"....KWWWWWWWWWW",
".....KWWWWWWWWS",
"......KWWWWWWWK",
".......KKWWWWWW",
".........KKKWWW",
"........KRRRRRR",
".......KWWWWWWY",
"......KWWWSWWWY",
"......KWWSWWWWW",
".....KWWWWWSWWW",
".....KWWWWWWWWW",
".....KWWWWWWWWW",
"....KWWSWWWKWWW",
"....KWWSWWWKWWW",
"....KWWSWWKWWWW",
"....KWWSWWKWWWK",
"....KWWSWWKWWWK",
"...KWWWSWWKWWWK",
"...KWWWWWWKWWWK",
"...KWWWWWKKWWWK",
"...KKKKKKK.KKKK",
]
PAL={'K':(70,30,34),'W':(250,246,236),'S':(210,200,196),'R':(214,52,42),'Y':(242,192,64),
     'T':(238,228,212),'t':(212,198,186),'F':(230,70,44),'f':(250,150,60),'O':(120,34,30)}
def build(tail_r=44, n_tails=9):
    body=[r+r[::-1] for r in LEFT]
    bw=len(body[0]); bh=len(body)
    Wd=tail_r*2+bw//2+10; Hd=bh+tail_r+4
    Wd=max(Wd,bw)+ (1 if (max(Wd,bw)-bw)%2 else 0)
    g=[['.']*Wd for _ in range(Hd)]
    ox=(Wd-bw)//2; oy=Hd-bh
    # tails: base point
    bx=Wd/2-0.5; by=oy+bh-10
    for i in range(n_tails):
        ang=math.pi+ (i+0.5)/n_tails*math.pi  # from left (pi) over top to right (2pi)
        for y in range(Hd):
            for x in range(Wd):
                dx,dy=x-bx,y-by
                r=math.hypot(dx,dy)
                if r<4 or r>tail_r: continue
                a=math.atan2(dy,dx)%(2*math.pi)
                da=abs(((a-ang)+math.pi)%(2*math.pi)-math.pi)
                t=r/tail_r
                # teardrop width (in radians), widest ~0.7
                wid=(0.5/n_tails*math.pi*2.0)*math.sin(min(1,t*1.15)*math.pi)**0.7*1.25
                if da<=wid:
                    edge=(wid-da)*r<1.1
                    if t>0.62: c='F' if t<0.86 else 'f'
                    else: c='T' if da<wid*0.55 else 't'
                    if t>0.93 and da<wid*0.3: c='f'
                    if edge or r>tail_r-1: c='O' if t>0.55 else 'K'
                    g[y][x]=c
    # body over tails
    for y,r in enumerate(body):
        for x,c in enumerate(r):
            if c!='.': g[oy+y][ox+x]=c
    rows=[''.join(r) for r in g]
    ys=[i for i,r in enumerate(rows) if r.strip('.')]
    return rows[ys[0]:ys[-1]+1]
def to_rgba(rows):
    h=len(rows); w=len(rows[0]); a=np.zeros((h,w,4),np.uint8)
    for y,r in enumerate(rows):
        for x,c in enumerate(r):
            if c!='.': a[y,x,:3]=PAL[c]; a[y,x,3]=255
    return a
if __name__=='__main__':
    import sys; sys.path.insert(0,'.')
    from pp import preview, SP
    preview(to_rgba(build()),SP+'/kit_art.png',6)
