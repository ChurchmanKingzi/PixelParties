# Mischief Militia snowmen in the in-game style (gumdrop body, steel-blue outline, dot eyes)
from px2 import *
BODY=[
"......OOOOOO......",
".....OWWWWWWO.....",
"....OWWWWWWWLO....",
"...OWWWWWWWWWLO...",
"...OWWWWWWWWWLO...",
"...OWWWWWWWWWLO...",
"...OWWWWWWWWWLO...",
"....OWWWWWWWLLO...",
"....OWWWWWWWWLO...",
"...OWWWWWWWWWLLO..",
"..OWWWWWWWWWWWLLO.",
"..OWWWWWWWWWWWLLO.",
".OWWWWWWWWWWWWWLLO",
".OWWWWWWWWWWWWWLLO",
".OWWWWWWWWWWWWLLLO",
".OLWWWWWWWWWWWLLLO",
"..OLLWWWWWWWWLLLO.",
"...OOLLLLLLLLLOO..",
".....OOOOOOOOO....",
]
PAL={'O':(86,104,156),'W':(240,240,252),'L':(190,192,228),'l':(214,216,240),'E':(52,36,40),
     'S':(116,74,44),'s':(84,50,30),'R':(214,40,52),'r':(150,20,34),'B':(40,58,130),'b':(66,90,170),'Y':(255,226,80),
     'G':(128,132,144),'g':(176,180,192),'h':(88,90,104),'K':(30,28,40),'k':(64,62,78),'P':(230,70,60),'p':(255,150,100),
     'F':(250,250,255),'f':(206,210,232),'D':(120,120,140),'T':(236,200,70),'X':(255,110,90),'x':(255,200,150),
     'N':(210,170,130),'n':(170,120,90)}
def grid(rows,w=None,h=None):
    h=h or len(rows); w=w or max(len(r) for r in rows)
    return [list(r.ljust(w,'.')) for r in rows]
def place(g,rows,x0,y0):
    for j,r in enumerate(rows):
        for i,c in enumerate(r):
            if c!='.' and 0<=y0+j<len(g) and 0<=x0+i<len(g[0]): g[y0+j][x0+i]=c
def base(pad_top=12,pad_side=8,pad_bot=0):
    w=len(BODY[0])+2*pad_side
    g=[['.']*w for _ in range(pad_top+len(BODY)+pad_bot)]
    place(g,BODY,pad_side,pad_top)
    return g
def eyes(g,y,x1,x2,tall=2):
    for k in range(tall): g[y+k][x1]='E'; g[y+k][x2]='E'
def arms(g,y,xl,xr):
    place(g,["S..","sS.","..S"],xl-2,y-2); place(g,["..S",".Ss","S.."],xr,y-2)
def snowman(kind):
    T=12; S=8
    g=base(T,S)
    cx=S+9  # body centre column
    if kind!='wizard': eyes(g,T+4,cx-3,cx+2)
    if kind=='plain':
        place(g,["EE....EE"],cx-5,T+2)
        place(g,[".RRR.","R...R"][:1],cx-2,T+7); g[T+7][cx-2]='R'; g[T+7][cx-1]='R'; g[T+7][cx]='R'
        arms(g,T+10,S+1,S+17)
    if kind=='wizard':
        eyes(g,T+4,cx-3,cx+2,1)
        hat=["........B.......",
             ".......BB.......",
             "......BbBB......",
             "......BBYB......",
             ".....BbBBBB.....",
             ".....BYBBbB.....",
             "....BBBBBYBB....",
             "....BbBBBBBBB...",
             "...BBBYBBbBBB...",
             "..BBBBBBBBBYBB..",
             ".BBBBBbBBBBBBBB.",
             "BBBBBBBBBBBBBBBB"]
        place(g,hat,cx-8,T-8)
        beard=[".DgDgDgD.",
               "DgDgDgDgD",
               ".DgDgDgD.",
               "..DgDgD..",
               "...DgD..."]
        place(g,beard,cx-5,T+6)
        arms(g,T+11,S+1,S+17)
    if kind=='heli':
        prop=["GGGGGGGGGGGGGGGGGG",".ggggggggggggggggg"]
        place(g,["hh"],cx-1,T-2); place(g,["hh"],cx-1,T-3)
        place(g,prop,cx-9,T-5)
        place(g,["RR"],cx-1,T-1)
        arms(g,T+10,S+1,S+17)
    if kind=='knight':
        helm=["....hhhhhh....",
              "...hggggggGh...",
              "..hgggggggGGh..",
              "..hggggggGGGh..",
              "..hKKKKKKKKKh..",
              "..hgggggggGGh..",
              "...hhhhhhhhh..."]
        place(g,helm,cx-7,T-1)
        place(g,["R","R","r"],cx,T-4)
        # banner pole + flag
        for k in range(26): g[T+17-k][cx+10]='s' if k%3 else 'S'
        flag=["FFFFFFFFF","FfFFFFFfF","FFFFFFFFF","FFfFFFfFF","FFFFFFFFF","FFFFFFFF.","FFFFFFF..","FFFFFF..."]
        place(g,flag,cx+11,T-8)
        arms(g,T+10,S+1,S+17)
    if kind=='grad':
        cap=["KKKKKKKKKKKKKK","..kKKKKKKKKk..","...KKKKKKKK...","...kkkkkkkk..."]
        place(g,cap,cx-7,T-2); place(g,["T","T","T"],cx+6,T-1)
        place(g,["KKKK.KKKK","K..KKK..K","KKKK.KKKK"],cx-5,T+3)
        g[T+4][cx-3]='E'; g[T+4][cx+2]='E'
        place(g,["RR.RR","RrRrR","RR.RR"],cx-3,T+8)
        arms(g,T+10,S+1,S+17)
    if kind=='blade':
        eyes(g,T+4,cx-3,cx+2)
        place(g,["EE","..EE"],cx-5,T+2); place(g,["..EE","EE.."],cx+1,T+2)
        for k in range(16):
            g[T+13-k][cx+11+ (k//6)]='X' if k%2 else 'P'
            g[T+13-k][cx+12+ (k//6)]='x'
        place(g,["sSSs"],cx+9,T+14)
        arms(g,T+10,S+1,S+17)
    return g
def dog():
    rows=[
    "..............f..f...",
    ".............fWffW...",
    "............OWWWWWO..",
    "...........OWWEWWEWO.",
    "...........OWWWWWWKK.",
    ".fW.......OWWWWWWWO..",
    ".fWW......ORRRRRRO...",
    "..OWWOOOOOWWWWWWO....",
    "...OWWWWWWWWWWWWO....",
    "...OWRRRRRRRRWWWO....",
    "...OWWWWWWWWWWWO.....",
    "...OWLLWWWWWLLWO.....",
    "...OW.OW...OW.OW.....",
    "...OLOOL...OLOOL.....",
    "....OO......OO......."]
    return [list(r) for r in rows]
def to_rgba(g):
    h=len(g); w=len(g[0]); a=np.zeros((h,w,4),np.uint8)
    for y in range(h):
        for x in range(w):
            c=g[y][x]
            if c!='.': a[y,x,:3]=PAL[c]; a[y,x,3]=255
    # auto outline for accessories (dark blue) where transparent touches non-body
    return a
def sprite(kind, big=True):
    a=to_rgba(dog() if kind=='dog' else snowman(kind))
    ys,xs=np.where(a[...,3]>0); a=a[ys.min():ys.max()+1,xs.min():xs.max()+1]
    return scale2x(a) if big else a
KINDS=['plain','wizard','heli','knight','grad','blade','dog']
if __name__=='__main__':
    cv=Canvas(7*46,62,(60,70,110)); x=2
    for k in KINDS:
        s=sprite(k); cv.paste(s,x,60-s.shape[0]); x+=s.shape[1]+4
    cv.save(SP+'/snowmen2.png',3)
