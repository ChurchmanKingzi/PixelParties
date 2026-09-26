from px2 import *
import art_skelking as SK
MERGE={'B':'B','b':'B','c':'B','G':'G','g':'G','Y':'G','R':'R','r':'R','P':'P','p':'P','Q':'Q','q':'Q','S':'S','s':'S','W':'W','w':'W','X':'X','K':'K','.':'.'}
BONE=[(60,48,44),(118,104,88),(176,164,140),(222,214,190),(246,242,226),(255,255,248)]
GOLD=[(90,44,10),(150,86,20),(212,146,40),(246,198,74),(255,236,150),(255,252,220)]
RED=[(90,6,16),(170,20,30),(230,50,50),(255,120,100),(255,210,190)]
CAPE=[(26,8,34),(48,16,62),(74,28,94),(100,44,124),(130,70,156)]
LINE=[(60,6,20),(104,14,34),(150,28,48),(196,52,64),(230,96,96)]
STEEL=[(40,44,60),(84,92,114),(140,148,172),(196,204,224),(236,242,252),(255,255,255)]
FUR=[(120,120,140),(178,178,196),(222,222,234),(244,244,250),(255,255,255)]
VOID=[(10,6,14),(24,14,30),(40,24,46)]
MATS={'B':dict(ramp=BONE,pillow=3,k=1.5,noise=0.6),
      'G':dict(ramp=GOLD,pillow=2.5,k=1.8,spec=True,spec_col=(255,255,230)),
      'R':dict(ramp=RED,pillow=2,k=1.2,bias=0.15),
      'P':dict(ramp=CAPE,pillow=4,k=1.3,folds=(0.28,0.02,1.1)),
      'Q':dict(ramp=LINE,pillow=2,k=1.3,folds=(0.28,0.02,0.8)),
      'S':dict(ramp=STEEL,pillow=2,k=2.0,spec=True),
      'W':dict(ramp=FUR,pillow=3,k=1.2,noise=1.4,nscale=2),
      'X':dict(ramp=VOID,pillow=1,k=0.8,bias=-0.1)}
def build_rgba(props=True):
    rows=SK.build(props)
    chars=sorted(set(''.join(rows))); cid={c:i for i,c in enumerate(chars)}
    A=np.array([[cid[c] for c in r] for r in rows])
    A3=scale3x_labels(A)
    L=np.vectorize(lambda i: MERGE[chars[i]])(A3)
    return render_regions(L,MATS,outline_col=(18,10,24))
if __name__=='__main__':
    a=build_rgba(); preview(a,SP+'/skelking2.png',3); print(a.shape)
