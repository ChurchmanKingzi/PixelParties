from lib import *


def _bg(a, satm=0.28, Lm=150):
    L = a[..., :3].mean(2); mx = a[..., :3].max(2); mn = a[..., :3].min(2); sat = (mx - mn) / np.maximum(mx, 1)
    return (sat < satm) & (L < Lm)


def minions():
    nv = native('Raise the Minions!')
    out = []
    for i, box in enumerate([(8, 2, 27, 30), (27, 2, 46, 30), (46, 2, 66, 30)]):
        def bgf(a, i=i):
            redglow = (a[..., 0] > a[..., 1] + 25) & (a[..., 0] < 200) & (a[..., 1] < 110)
            return _bg(a) | (redglow if i == 2 else False)
        s = keep_largest(cut_by(nv, box, bgf))
        out.append(s.crop(s.getbbox()))
    return out


def bard():
    nb = native('Skeleton Bard')
    def bg2(a):
        L = a[..., :3].mean(2)
        purple = (a[..., 2] > a[..., 1] + 30) & (a[..., 0] > a[..., 1]) & (L < 150)
        brown = (a[..., 0] > a[..., 2] + 20) & (L < 150) & (a[..., 0] < 190)
        return _bg(a) | purple | brown
    s = keep_largest(cut_by(nb, (20, 10, 50, 40), bg2))
    return s.crop(s.getbbox())


def king():
    nk = native('Skeleton King Skullmael')
    s = keep_largest(cut_by(nk, (26, 0, 62, 34), lambda a: _bg(a, 0.4, 178)))
    return s.crop(s.getbbox())


def notes():
    nb = native('Skeleton Bard')
    a = np.array(nb).astype(int)
    mx = a[..., :3].max(2); mn = a[..., :3].min(2); sat = (mx - mn) / np.maximum(mx, 1)
    L = a[..., :3].mean(2)
    m = (sat > 0.45) & (L > 60)
    m &= ~((a[..., 2] > a[..., 1] + 30) & (a[..., 0] > a[..., 1]) & (L < 150) & (sat < 0.6))
    lab, k = ndimage.label(m)
    res = []
    for sl in ndimage.find_objects(lab):
        h = sl[0].stop - sl[0].start; w = sl[1].stop - sl[1].start
        if h >= 5 and w >= 3 and sl[0].start < 26:
            sub = np.array(nb)[sl].copy(); sub[..., 3] = np.where(m[sl], 255, 0)
            res.append(Image.fromarray(sub))
    return res
