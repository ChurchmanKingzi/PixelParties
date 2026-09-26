from px2 import *
GOLD=[(92,52,12),(150,92,24),(206,146,44),(240,196,84),(255,234,150),(255,252,220)]
def smug_coin(R=12):
    """Smug Coin icon: star-studded rim + the coin's pixel face (sampled from data/sc.png on its 10px grid)"""
    a=np.array(Image.open(os.path.join(ROOT,'data','sc.png')).convert('RGBA')).astype(int)
    per=10.095; x0=(40+8.81+0.5)%per; y0=(40+8.12+0.5)%per
    n=24; grid=np.zeros((n,n,3))
    for j in range(n):
        for i in range(n):
            cx=int(x0+(i+0.5)*per); cy=int(y0+(j+0.5)*per)
            if cx<238 and cy<239: grid[j,i]=a[cy,cx,:3]
    S=2*R+1
    out=np.zeros((S,S,4),np.uint8)
    face=grid[5:19,5:19]; L=lum(face)
    lo,hi=np.quantile(L,[0.08,0.92]); Ln=np.clip((L-lo)/(hi-lo),0,1)
    for y in range(S):
        for x in range(S):
            d=math.hypot(x-R,y-R)
            if d>R+0.4: continue
            if d>R-0.6: c=GOLD[0]
            elif d>R-3.2:
                ang=math.atan2(y-R,x-R)
                c=GOLD[2] if (x+y)%2 else GOLD[3]
                if (x-R)+(y-R)>4: c=GOLD[2] if (x+y)%2 else GOLD[1]
                k=(ang+math.pi)/(2*math.pi)*14
                if abs(k-round(k))<0.12 and R-2.6<d<R-1.2: c=GOLD[5]
            elif d>R-3.9: c=GOLD[1]
            else:
                fx=int((x-(R-7))); fy=int((y-(R-7)))
                v=0.55
                if 0<=fx<14 and 0<=fy<14: v=Ln[fy,fx]
                i=[1,2,3,4,4,5][min(5,int(v**1.3*6))]
                c=GOLD[i]
            out[y,x,:3]=c; out[y,x,3]=255
    return out
if __name__=='__main__':
    cv=Canvas(70,34,(230,210,160)); cv.paste(smug_coin(12),2,2); cv.paste(smug_coin(15),30,1); cv.save(SP+'/coin.png',8)
