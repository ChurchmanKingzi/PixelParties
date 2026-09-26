from pp import *
def keyed(name,rect,bgfn,key,n=1,extra=None):
    a,_=native2(name); x,y,w,h=rect
    sub=a[y:y+h,x:x+w].astype(int)
    r,g,b=sub[...,0],sub[...,1],sub[...,2]
    bg=bgfn(r,g,b,np.indices(r.shape)[0],np.indices(r.shape)[1])
    m=keep_largest(~bg,n)
    if extra: m=extra(m)
    rgba=to_rgba(a[y:y+h,x:x+w],m)
    Image.fromarray(rgba).save(f'sprites/{key}.png'); preview(rgba,f'{SP}/prev_{key}.png',8)
keyed('Metal Harpyformer',(17,0,34,39),lambda r,g,b,Y,X:(g>r+15)&(g>b+5)|((Y>34)&(g>=r-10)),'h_metal')
keyed('Shanty Harpyformer',(21,3,30,28),lambda r,g,b,Y,X:(b>r+30)&(b>g+10),'h_shanty')
keyed('Ballad Harpyformer',(20,14,42,33),lambda r,g,b,Y,X:((b>r+10)&(b>g+20)&(r+g+b<330))|((Y>=26)&(r>g)&(g>b)&(r<200)&(X<12)),'h_ballad')
a,_=native2('Rap Harpyformer'); x,y,w,h=40,16,22,24
m=keep_largest(grabcut(a,(x,y,w,h),10),1)
rgba=to_rgba(a,m)[y:y+h,x:x+w]; Image.fromarray(rgba).save('sprites/h_rap.png'); preview(rgba,SP+'/prev_h_rap.png',8)
from PIL import Image as I
ims=[I.open(f'{SP}/prev_{k}.png') for k in ['h_metal','h_shanty','h_ballad','h_rap']]
Wt=sum(i.width for i in ims)+40; Ht=max(i.height for i in ims)
s=I.new('RGB',(Wt,Ht),'white'); xx=0
for i in ims: s.paste(i,(xx,0)); xx+=i.width+10
s.save(SP+'/prev_harps.png')
