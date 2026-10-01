import sys, colorsys, random
sys.path.insert(0,__import__('os').path.dirname(__file__))
from board_png import write_png
OUT=__import__('os').path.join(__import__('os').path.dirname(__file__),'..','data','shop','boards')+'/'
GW,GH,CELL=15,21,8
def hsv(h,s,v): r,g,b=colorsys.hsv_to_rgb(h%1,max(0,min(1,s)),max(0,min(1,v))); return (int(r*255),int(g*255),int(b*255),255)
ICONS={
 'area':["....XXX....",".XX.XXX.XX.","X..XXXXX..X",".XXXXXXXXX.","XXXXXXXXXXX","XXXXXXXXXXX",".XXXXXXXXX.","X..XXXXX..X",".XX.XXX.XX.","....XXX...."],
 'delete':["..XXXXXXX..",".XX.....XX.","XX..XXX..XX","X..XX.XX..X","X..X...X..X","X..XX.XX..X","XX..XXX..XX",".XX.....XX.","..XXXXXXX.."],
 'discard':["....XXX....","....XXX....","XXXXXXXXXXX","XXXXXXXXXXX","....XXX....","....XXX....","....XXX....","..XXXXXXX..",".XXXXXXXXX."],
 'deck':["XXXXXXXXX..","X.......X..","X.XXXXX.XXX","X.X...X.X.X","X.X...X.X.X","X.XXXXX.X.X","X.......XXX","XXXXXXXXX.."],
 'hero':["....X....","...XXX...","..XXXXX..","XXXXXXXXX",".XXXXXXX.","..XXXXX..",".XX...XX.","XX.....XX"],
 'support':["..XXXXX..",".XXXXXXX.","XXXXXXXXX","XXX.X.XXX","XXXXXXXXX",".XXXXXXX.","..XXXXX..",".X.....X."],
 'ability':["....X....","....X....","...XXX...","XXXXXXXXX",".XXXXXXX.","..XXXXX..",".XXX.XXX.","XX.....XX"],
 'surprise':["..XXXXX..",".XX...XX.","XX.....XX","......XX.",".....XX..","....XX...","....XX...",".........","....XX...","....XX..."],
 'potion':["...XXX...","...XXX...","....X....","...XXX...","..XXXXX..",".XXXXXXX.","XXXXXXXXX","XXXXXXXXX",".XXXXXXX."],
}
ICON_ZONES={'area','delete','discard'}   # wie im Original: nur diese Zonen tragen ein Symbol
# Theme: Hue je Zonentyp, Sättigung, Helligkeits-Offset
THEMES={
 'board3':{'name':'Frost','zones':{'hero':.62,'support':.50,'ability':.55,'surprise':.72,'potion':.45,'deck':.58,'area':.48,'delete':.66,'discard':.60},'sat':.55,'val':1.0,'icon':(235,250,255,255)},
 'board4':{'name':'Inferno','zones':{'hero':.00,'support':.07,'ability':.12,'surprise':.95,'potion':.04,'deck':.02,'area':.09,'delete':.98,'discard':.05},'sat':.9,'val':1.0,'icon':(255,235,150,255)},
 'board5':{'name':'Wald','zones':{'hero':.33,'support':.42,'ability':.17,'surprise':.08,'potion':.25,'deck':.30,'area':.37,'delete':.45,'discard':.12},'sat':.7,'val':.9,'icon':(240,255,210,255)},
 'board6':{'name':'Void','zones':{'hero':.80,'support':.72,'ability':.88,'surprise':.93,'potion':.76,'deck':.78,'area':.84,'delete':.70,'discard':.74},'sat':.75,'val':.85,'icon':(255,210,255,255)},
}
def zone_img(theme,ztype,variant):
    T=THEMES[theme]; h=T['zones'][ztype]; s=T['sat']; v=T['val']
    if ztype in ('deck','discard'): s*=.35
    if variant==1:
        dark=hsv(h,s,.18*v+.05); edge=hsv(h,s,.55*v)
    else:
        dark=hsv(h,s*.9,.55*v); edge=hsv(h,s*.8,.35*v)
    g=[[None]*GW for _ in range(GH)]
    for y in range(GH):
        for x in range(GW):
            border=x in(0,GW-1) or y in(0,GH-1)
            if border: g[y][x]=dark; continue
            t=(x+y)/(GW+GH)           # diagonale Aufhellung
            chk=(x+y)%2
            if variant==1:
                val=(.55+.25*(1-t))*v+(.08 if chk else 0)
                g[y][x]=hsv(h+(.01 if chk else 0),s,val)
            else:
                val=(.95-.1*t)*v+(.03 if chk else 0)
                g[y][x]=hsv(h,s*.28,min(1,val+.08))
    if variant==2:  # abgerundeter Innenbereich: Eckfelder in Randfarbe
        for y in range(1,GH-1):
            for x in range(1,GW-1):
                dx=min(x-1,GW-2-x); dy=min(y-1,GH-2-y)
                if dx+dy<3 and (dx<2 and dy<2): g[y][x]=edge
                elif dx==0 or dy==0: g[y][x]=edge if (dx+dy)<4 else g[y][x]
    if ztype in ICON_ZONES:
        ic=ICONS[ztype]; ih=len(ic); iw=len(ic[0])
        ox=(GW-iw)//2; oy=(GH-ih)//2
        col=T['icon'] if variant==1 else hsv(h,.85,.35)
        sh=hsv(h,s,.1)
        for yy,row in enumerate(ic):
            for xx,c in enumerate(row):
                if c=='X': g[oy+yy+0][ox+xx]=col
    return [[g[y*GH//170][x//CELL] for x in range(120)] for y in range(170)]
def preview(theme):
    # Vorschau-Collage im Layout des Originals (halbe Größe: 1830x650)
    W,H=1830,650; bg=hsv(THEMES[theme]['zones']['hero'],.5,.12)
    P=[[bg]*W for _ in range(H)]
    def blit(img,x0,y0,sc=0.5):
        zw,zh=int(120*sc),int(170*sc)
        for y in range(zh):
            for x in range(zw):
                P[y0+y][x0+x]=img[int(y/sc)][int(x/sc)]
    # linke Spalte
    blit(zone_img(theme,'area',STYLE[theme]),30,2); blit(zone_img(theme,'delete',STYLE[theme]),30,127); blit(zone_img(theme,'discard',STYLE[theme]),30,245)
    for g in range(3):
        bx=130+g*248
        for c in range(3):
            if c<2: blit(zone_img(theme,['surprise','hero'][c],STYLE[theme]),bx+c*78,11)
            blit(zone_img(theme,'support',STYLE[theme]),bx+c*78,127)
            blit(zone_img(theme,'ability',STYLE[theme]),bx+c*78,245)
    blit(zone_img(theme,'area',STYLE[theme]),930,2); blit(zone_img(theme,'potion',STYLE[theme]),930,127); blit(zone_img(theme,'deck',STYLE[theme]),930,245)
    return W,H,P

STYLE={'board3':2,'board4':1,'board5':1,'board6':1}
for th,T in THEMES.items():
    n=th[5:]
    for z in T['zones']:
        write_png(f'{OUT}{z}{n}.png',120,170,zone_img(th,z,STYLE[th]))
    W,H,P=preview(th)
    write_png(f'{OUT}{th}.png',W,H,P)
    print('ok',th)
