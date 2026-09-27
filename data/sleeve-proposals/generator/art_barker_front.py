# Barker (Monster Trainer) front sprite, 4-shade handheld style, based on the in-game sprite
import numpy as np, math
LEFT=[
".....0000",
"...003333",
"..0333333",
"..0333311",
"..0333311",
".00000000",
"011111111",
".00000000",
".00022222",
".00220222",
"..0220222",
"..0222222",
"..0022222",
"...002222",
"....02222",
"..0013300",
".01113300",
"010111300",
"010111000",
"010111000",
"020111000",
".00111000",
"..0000000",
"..0222222",
"..0222220",
"..0222220",
"..0222220",
"..0000000",
".00000000",
]
def build():
    rows=[r+r[::-1] for r in LEFT]
    g=np.array([[int(c) if c!='.' else -1 for c in r] for r in rows])
    h,w=g.shape
    g=np.pad(g,((0,0),(0,5)),constant_values=-1)
    # mouth + cap highlight + jacket highlight
    g[12,8]=1; g[12,9]=1
    for (x,y) in [(4,2),(5,2),(4,3)]: g[y,x]=3
    for (x,y) in [(12,2),(13,2),(13,3),(14,3),(14,4)]: g[y,x]=2
    for y in range(17,21):
        if y%2==0: g[y,1]=2
    for (x,y) in [(3,1),(6,1)]: g[y,x]=2 if False else g[y,x]
    # ball in the (viewer's) right hand
    cx,cy,r=19,19,3.2
    for y in range(h):
        for x in range(g.shape[1]):
            d=math.hypot(x-cx,y-cy)
            if d<=r+0.6:
                v=1 if y<cy else 3
                if y==cy: v=0
                if d>r-0.4: v=0
                g[y,x]=v
    g[cy,cx]=3; g[cy-1,cx]=0; g[cy+1,cx]=0; g[cy,cx-1]=0; g[cy,cx+1]=0
    g[cy-2,cx-1]=2
    return g
def to_rgba(g,pal):
    h,w=g.shape; a=np.zeros((h,w,4),np.uint8)
    for y in range(h):
        for x in range(w):
            if g[y,x]>=0: a[y,x,:3]=pal[g[y,x]]; a[y,x,3]=255
    return a
