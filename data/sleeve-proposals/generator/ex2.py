from pp import *
import sys
def show(name, rect, k=10):
    a,_=native2(name); x,y,w,h=rect
    Image.fromarray(a[y:y+h,x:x+w]).resize((w*k,h*k),Image.NEAREST).save(SP+'/raw.png')
if __name__=='__main__':
    show(sys.argv[1], tuple(map(int,sys.argv[2:6])))
