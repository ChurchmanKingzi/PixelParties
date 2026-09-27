# -*- coding: utf-8 -*-
import sys, os, re, json, time
from gimpformats.gimpXcfDocument import GimpDocument
src = sys.argv[1]
base = os.path.splitext(os.path.basename(src))[0]
out = os.path.join('/home/user/sprites_export', base); os.makedirs(out, exist_ok=True)
t = time.time()
d = GimpDocument(src)
info = {'file': base, 'w': d.width, 'h': d.height, 'layers': []}
for i, l in enumerate(d._layers):
    name = l.name or f'layer{i}'
    e = {'i': i, 'name': name, 'w': l.width, 'h': l.height, 'x': l.xOffset, 'y': l.yOffset,
         'group': bool(l.isGroup), 'visible': bool(l.visible), 'itemPath': getattr(l, 'itemPath', None)}
    if not l.isGroup:
        try:
            im = l.image
            if im is not None:
                fn = f'{i:03d}_' + re.sub(r'[^\w\-äöüÄÖÜß ]+', '_', name)[:60] + '.png'
                im.save(os.path.join(out, fn)); e['png'] = fn; e['mode'] = im.mode
        except Exception as ex:
            e['err'] = str(ex)[:100]
    info['layers'].append(e)
json.dump(info, open(os.path.join(out, 'layers.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1, default=str)
print(base, len(info['layers']), 'layers', '%.0fs' % (time.time() - t))
