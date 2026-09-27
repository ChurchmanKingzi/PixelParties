from pp import *
a,_=native2('Blackstache Scourge of the Pixel Seas')
rect=(28,8,28,28)
x,y,w,h=rect
sub=a[y:y+h,x:x+w].astype(int)
r,g,b=sub[...,0],sub[...,1],sub[...,2]
blue=(b>r+40)&(b>g+10)
yellow=(r>180)&(g>170)&(b<120)
fg=~blue & ~yellow
# drop wooden beam region rows >= 36 unless dark/grey (keep boots)
m=keep_largest(fg,1)
rgba=to_rgba(a[y:y+h,x:x+w],m)
Image.fromarray(rgba).save('sprites/blackstache.png')
preview(rgba,SP+'/prev_black.png',10)
