import zlib, struct
def read_png(path):
    d=open(path,'rb').read(); pos=8; idat=b''; plte=None; trns=None
    while pos<len(d):
        n,=struct.unpack('>I',d[pos:pos+4]); t=d[pos+4:pos+8]; c=d[pos+8:pos+8+n]; pos+=12+n
        if t==b'IHDR': w,h,bd,ct=struct.unpack('>IIBB',c[:10])
        elif t==b'PLTE': plte=c
        elif t==b'tRNS': trns=c
        elif t==b'IDAT': idat+=c
    raw=zlib.decompress(idat)
    ch={0:1,2:3,3:1,4:2,6:4}[ct]; bpp=ch*(bd//8); stride=w*bpp
    rows=[]; prev=bytearray(stride); p=0
    for y in range(h):
        f=raw[p]; line=bytearray(raw[p+1:p+1+stride]); p+=1+stride
        for i in range(stride):
            a=line[i-bpp] if i>=bpp else 0; b=prev[i]; cc=prev[i-bpp] if i>=bpp else 0
            if f==1: line[i]=(line[i]+a)&255
            elif f==2: line[i]=(line[i]+b)&255
            elif f==3: line[i]=(line[i]+(a+b)//2)&255
            elif f==4:
                pa=abs(b-cc); pb=abs(a-cc); pc=abs(a+b-2*cc)
                pr=a if pa<=pb and pa<=pc else (b if pb<=pc else cc)
                line[i]=(line[i]+pr)&255
        rows.append(line); prev=line
    px=[]
    for line in rows:
        r=[]
        for x in range(w):
            s=line[x*bpp:(x+1)*bpp]
            if ct==6: r.append(tuple(s))
            elif ct==2: r.append((*s,255))
            elif ct==3: i=s[0]; r.append((*plte[i*3:i*3+3], trns[i] if trns and i<len(trns) else 255))
            elif ct==0: r.append((s[0],s[0],s[0],255))
            else: r.append((s[0],s[0],s[0],s[1]))
        px.append(r)
    return w,h,px
def write_png(path,w,h,px):
    raw=bytearray()
    for row in px:
        raw.append(0)
        for p in row: raw+=bytes(p if len(p)==4 else (*p,255))
    def ch(t,c): 
        x=struct.pack('>I',len(c))+t+c; return x+struct.pack('>I',zlib.crc32(t+c)&0xffffffff)
    open(path,'wb').write(b'\x89PNG\r\n\x1a\n'+ch(b'IHDR',struct.pack('>IIBBBBB',w,h,8,6,0,0,0))+ch(b'IDAT',zlib.compress(bytes(raw),9))+ch(b'IEND',b''))
