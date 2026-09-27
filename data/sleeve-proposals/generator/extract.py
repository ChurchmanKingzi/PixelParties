from pp import *
import sys
SPECS={
 'tobi':('Tobi the Average Student',(28,18,19,26)),
 'giant':('3-Headed Giant',(19,7,33,28)),
 'skullmael':('Skeleton King Skullmael',(19,4,28,24)),
 'kitsune':('Rebelliokai Kind Kitsune',(20,1,40,32)),
}
def run(key, rect=None, iters=10, largest=1):
    n,r=SPECS[key]; r=rect or r
    a,_=native2(n)
    m=grabcut(a,r,iters)
    if largest: m=keep_largest(m,largest)
    x,y,w,h=r
    rgba=to_rgba(a,m)[y:y+h,x:x+w]
    Image.fromarray(rgba).save(f'sprites/{key}.png')
    preview(rgba,f'{SP}/prev_{key}.png',8)
    return rgba
if __name__=='__main__':
    for k in sys.argv[1:]: run(k)
