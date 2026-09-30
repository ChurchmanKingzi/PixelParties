import sys, os, json, time
import numpy as np
from PIL import Image
from gimpformats.gimpXcfDocument import GimpDocument
name=sys.argv[1]
src=f'/home/user/pixelpartiessprites/{name}.xcf'; out=f'/home/user/sprites_export/{name}'
os.makedirs(out+'/crops',exist_ok=True)
t=time.time(); d=GimpDocument(src); L=d._layers
info=[]
for i,l in enumerate(L):
    try:
        im=l.image  # PIL RGBA, layer-sized
        a=np.array(im.convert('RGBA'))
    except Exception as e:
        info.append(dict(index=i,name=l.name,error=str(e))); continue
    ys,xs=np.where(a[...,3]>0)
    rec=dict(index=i,name=l.name,visible=bool(l.visible),ox=int(l.xOffset),oy=int(l.yOffset),w=int(l.width),h=int(l.height))
    if len(xs):
        x0,x1,y0,y1=xs.min(),xs.max()+1,ys.min(),ys.max()+1
        rec.update(bx=int(l.xOffset+x0),by=int(l.yOffset+y0),bw=int(x1-x0),bh=int(y1-y0))
        Image.fromarray(a[y0:y1,x0:x1]).save(f'{out}/crops/{i:04d}.png')
    info.append(rec)
json.dump(dict(width=d.width,height=d.height,layers=info),open(out+'/layers.json','w'))
print(name,len(L),'Ebenen','%.0fs'%(time.time()-t),flush=True)
