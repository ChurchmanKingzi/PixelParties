# Barker's in-game sprite (Monster Trainer card), cut out row by row (the card art is heavily overlaid)
from px2 import *
ROWS={2:(10,13),3:(9,14),4:(8,15),5:(7,16),6:(7,16),7:(7,16),8:(7,16),9:(6,16),10:(7,17),11:(8,17),
      12:(7,17),13:(6,18),14:(5,18),15:(4,19),16:(3,19),17:(3,19),18:(6,16),19:(6,16),20:(6,16),
      21:(7,15),22:(7,15),23:(7,15),24:(8,15),25:(8,15)}
def sprite(stretch=True):
    a,_=native2('Barker the Monster Trainer')
    sub=a[0:34,26:54].astype(float)
    lo=np.percentile(sub,1,axis=(0,1)); hi=np.percentile(sub,99,axis=(0,1))
    st=np.clip((sub-lo)/(hi-lo)*255,0,255).astype(np.uint8) if stretch else sub.astype(np.uint8)
    m=np.zeros(st.shape[:2],bool)
    for y,(x0,x1) in ROWS.items(): m[y,x0:x1+1]=True
    rgba=to_rgba(st,m)
    ys,xs=np.where(m)
    return rgba[ys.min():ys.max()+1,xs.min():xs.max()+1]
if __name__=='__main__':
    preview(sprite(),SP+'/p_btf.png',12)
