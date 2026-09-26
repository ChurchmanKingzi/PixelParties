from pp import *
import sys
def gridimg(n, path, k=8):
    a,_=native2(n)
    h,w=a.shape[:2]
    im=Image.fromarray(a).resize((w*k,h*k),Image.NEAREST)
    d=ImageDraw.Draw(im)
    for x in range(0,w,5):
        d.line([(x*k,0),(x*k,h*k)],fill=(255,255,0) if x%10==0 else (90,90,0),width=1)
        if x%10==0: d.text((x*k+2,2),str(x),fill=(255,255,0))
    for y in range(0,h,5):
        d.line([(0,y*k),(w*k,y*k)],fill=(0,255,255) if y%10==0 else (0,90,90),width=1)
        if y%10==0: d.text((2,y*k+2),str(y),fill=(0,255,255))
    im.save(path)
if __name__=='__main__':
    for n in sys.argv[1:]:
        gridimg(n, SP+'/g_'+re.sub(r'\W','',n)[:20]+'.png')
