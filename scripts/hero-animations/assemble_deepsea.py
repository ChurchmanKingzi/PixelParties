# -*- coding: utf-8 -*-
"""Hero- und Skin-Sprites aus MotiveDeepsea.xcf zusammensetzen (mit dem Nutzer abgeglichen).

Aufruf:  python3 assemble_deepsea.py <pfad/zu/MotiveDeepsea.xcf>
Schreibt src/<slug>.png und bewegliche Teile deckungsgleich als
src/<slug>-<teil>.png.

  bravo-arnold                           Skin: „Arnold-Kopie“ + Haartolle „Ebene #5“
  kit-the-shark-researcher               „Kit-Kopie“ + Hut „Ebene #49“
  lolek-the-shard-knight                 „Lolek“ + ausgestreckter Arm „Lolek #2“ +
                                         Schulterstücke „Ebene #74“;
                                         Teil shards = türkise Scherben „Ebene #75“
                                         (Vorlagen für die Partikel)
  division-captain-lolek                 Skin: „Byakuya“; Teil shards = pinke
                                         Scherben „Ebene #78“
  lolek-mender-of-the-shattered-trident  „Ascended Lolek“ + Dreizack „Ebene #108“
  rakah-the-loan-shark                   „Rakah“ + Rückenflosse „Rakah #4“, Glas
                                         „Rakah #5“, Schwanzflosse (das Stück aus
                                         „Rakah #3“ neben ihm) und das türkise
                                         Stück aus „Rakah #8“
  rha-bi-the-living-skeleton             „The Light Brigade Marches #8“
  saya-the-plant-princess                „Saya“ + Flügel „Saya #1“ + Arme „Ebene #114“
  saya-the-grass-princess                Skin: „ERIKA“ + Busch „Ebene #113“ (verdeckt
                                         die nicht umgepixelte untere Hälfte)
  siphem-the-deepsea-demon               „Siphem“
  monster-king-siphem                    Skin: „Asgore“; Teil trident = der rote
                                         Dreizack
  sorin-the-warden-of-blood-rock         nur der Vampir links aus „Sorin“
  toras-master-of-all-weapons            „Toras“ (mit Schwert und Schwungbogen)
  tryse-the-shadow-slayer                „Tryse #4“ + zustechender Arm „Tryse #2“,
                                         Hand „Tryse #8“, Schwert „Tryse #9“

Nachzügler (zweite Runde):

  arnold-the-maximum-lotl                „Arnold“ (ohne Shirt; „Arnold-Kopie“ ist Bravo Arnold)
  feral-the-fortress-breaker             „Feral“
  teppes-the-deepsea-vampire             die Figur aus „TEPPES“; Teil bats = die zwei
                                         Fledermäuse aus „Teppes“
  teppesman-the-deepsea-knight           Skin: die Figur aus „Ebene #143“; Teil bats =
                                         die drei Fledermäuse neben ihm
  shu-chaku-the-blood-moon-projection    graue Gestalt „Ebene #174“ (voll deckend) +
                                         Augen „Ebene #176“; Teil glow = das rote
                                         Glühen „Ebene #175“ (halbtransparent)
  deep-drowned-waflav                    die gekrönte Figur aus „Deep-Drowned Waflav“
                                         (ohne die Seetang-Monster); Teile tentacles =
                                         „Deep-Drowned Waflav #1“, wings = die
                                         Skelettflügel „Deep-Drowned Waflav #2“

Nicht gefunden (keine Ebene): Toras the Battle Maniac, RhaBi the Human Hunter,
Waflav, Silent Water Mizune/Regional Champ Mizune, Madaga.
"""
import sys
import numpy as np
import cv2
from PIL import Image
from gimpformats.gimpXcfDocument import GimpDocument

OUT = 'src'


def layer(doc, layers, name, full=False):
    hits = [l for l in layers if l.name == name]
    assert len(hits) == 1, (name, len(hits))
    l = hits[0]
    im = l.image.convert('RGBA')
    if l.opacity < 255 and not full:                                   # Ebenen-Deckkraft übernehmen
        a = np.array(im)
        a[:, :, 3] = (a[:, :, 3].astype(int) * l.opacity // 255).astype(np.uint8)
        im = Image.fromarray(a)
    c = Image.new('RGBA', (doc.width, doc.height), (0, 0, 0, 0))
    c.paste(im, (l.xOffset, l.yOffset))
    return np.array(c)


def components(a):
    return cv2.connectedComponents((a[:, :, 3] > 0).astype(np.uint8), connectivity=8)


def only(a, keep):
    return np.where(keep[:, :, None], a, 0).astype(np.uint8)


def biggest(a):
    n, lab = components(a)
    k = int(np.argmax([(lab == k).sum() for k in range(1, n)])) + 1
    return only(a, lab == k)


def save_parts(slug, parts):
    """parts: [(teil, Leinwand-RGBA)] von unten nach oben."""
    comp = Image.new('RGBA', (parts[0][1].shape[1], parts[0][1].shape[0]), (0, 0, 0, 0))
    for _, a in parts:
        comp.alpha_composite(Image.fromarray(a))
    bb = comp.getbbox()
    if len(parts) > 1:
        for name, a in parts:
            Image.fromarray(a).crop(bb).save(f'{OUT}/{slug}-{name}.png')
    img = comp.crop(bb)
    img.save(f'{OUT}/{slug}.png')
    print(slug, img.size)


def near(a, ref):
    """Die Zusammenhangskomponente von a, die ref (Leinwand) am nächsten liegt."""
    n, lab = components(a)
    ys, xs = np.nonzero(ref[:, :, 3])
    cx, cy = xs.mean(), ys.mean()
    best = min(range(1, n), key=lambda k: np.hypot(np.nonzero(lab == k)[1].mean() - cx, np.nonzero(lab == k)[0].mean() - cy))
    return only(a, lab == best)


def comp_at(a, x, y, dil=0):
    """Die Zusammenhangskomponente von a, die (x, y) am nächsten liegt (dil: vorher wachsen lassen)."""
    m = (a[:, :, 3] > 0).astype(np.uint8)
    if dil:
        m = cv2.dilate(m, np.ones((3, 3), np.uint8), iterations=dil)
    n, lab = cv2.connectedComponents(m, connectivity=8)
    ys, xs = np.nonzero(lab > 0)
    d = (xs - x) ** 2 + (ys - y) ** 2
    return only(a, (lab == lab[ys[d.argmin()], xs[d.argmin()]]) & (a[:, :, 3] > 0))


def split_x(a, x):
    """a in links (< x) und rechts (>= x) teilen."""
    l, r = a.copy(), a.copy()
    l[:, x:] = 0
    r[:, :x] = 0
    return l, r


def main(path):
    doc = GimpDocument(path)
    L = doc.raw_layers
    g = lambda n: layer(doc, L, n)
    save_parts('bravo-arnold', [('body', g('Arnold-Kopie')), ('hair', g('Ebene #5'))])
    save_parts('kit-the-shark-researcher', [('body', g('Kit-Kopie')), ('hat', g('Ebene #49'))])
    save_parts('lolek-the-shard-knight', [('arm', g('Lolek #2')), ('shoulders', g('Ebene #74')), ('body', g('Lolek'))])
    # Scherben-Vorlagen separat (gehören nicht ins Sprite)
    Image.fromarray(g('Ebene #75')).crop(Image.fromarray(g('Ebene #75')).getbbox()).save(f'{OUT}/lolek-the-shard-knight-shards.png')
    save_parts('division-captain-lolek', [('body', g('Byakuya'))])
    Image.fromarray(g('Ebene #78')).crop(Image.fromarray(g('Ebene #78')).getbbox()).save(f'{OUT}/division-captain-lolek-shards.png')
    save_parts('lolek-mender-of-the-shattered-trident', [('body', g('Ascended Lolek')), ('trident', g('Ebene #108'))])
    rakah = g('Rakah')
    save_parts('rakah-the-loan-shark', [('fin', g('Rakah #4')), ('tail', near(g('Rakah #3'), rakah)),
                                        ('blob', near(g('Rakah #8'), rakah)), ('body', rakah), ('glass', g('Rakah #5'))])
    save_parts('rha-bi-the-living-skeleton', [('body', g('The Light Brigade Marches #8'))])
    save_parts('saya-the-plant-princess', [('wings', g('Saya #1')), ('body', g('Saya')), ('arms', g('Ebene #114'))])
    save_parts('saya-the-grass-princess', [('body', g('ERIKA')), ('bush', g('Ebene #113'))])
    save_parts('siphem-the-deepsea-demon', [('body', g('Siphem'))])
    asg = g('Asgore')
    n, lab = components(asg)
    sizes = sorted(((lab == k).sum(), k) for k in range(1, n))
    body_k = sizes[-1][1]
    trident = only(asg, (lab > 0) & (lab != body_k))
    save_parts('monster-king-siphem', [('trident', trident), ('body', only(asg, lab == body_k))])
    sorin = g('Sorin')
    n, lab = components(sorin)
    xs_mean = {k: np.nonzero(lab == k)[1].mean() for k in range(1, n) if (lab == k).sum() > 30}
    save_parts('sorin-the-warden-of-blood-rock', [('body', only(sorin, lab == min(xs_mean, key=xs_mean.get)))])
    save_parts('toras-master-of-all-weapons', [('body', g('Toras'))])
    save_parts('tryse-the-shadow-slayer', [('body', g('Tryse #4')), ('arm', g('Tryse #2')), ('hand', g('Tryse #8')), ('sword', g('Tryse #9'))])
    # ---- Nachzügler
    save_parts('arnold-the-maximum-lotl', [('body', g('Arnold'))])
    save_parts('feral-the-fortress-breaker', [('body', g('Feral'))])
    save_parts('teppes-the-deepsea-vampire', [('body', comp_at(g('TEPPES'), 245, 308, dil=1)), ('bats', g('Teppes'))])
    tm = g('Ebene #143')                                  # die Figur unten rechts und die drei Fledermäuse bei ihr
    body = comp_at(tm, 325, 305)
    n, lab = components(tm)
    near_bats = np.zeros(tm.shape[:2], bool)
    for k in range(1, n):
        ys, xs = np.nonzero(lab == k)
        if xs.mean() > 290 and ys.mean() > 260 and not (body[ys, xs, 3] > 0).any():
            near_bats |= lab == k
    save_parts('teppesman-the-deepsea-knight', [('body', body), ('bats', only(tm, near_bats))])
    shu = layer(doc, L, 'Ebene #174', full=True)                     # die graue Gestalt voll deckend, darauf die Augen
    eyes = g('Ebene #176')
    shu[eyes[:, :, 3] > 0] = eyes[eyes[:, :, 3] > 0]
    save_parts('shu-chaku-the-blood-moon-projection', [('glow', g('Ebene #175')), ('body', shu)])
    save_parts('deep-drowned-waflav', [('wings', g('Deep-Drowned Waflav #2')), ('tentacles', g('Deep-Drowned Waflav #1')),
                                       ('body', comp_at(g('Deep-Drowned Waflav'), 222, 310, dil=1))])


if __name__ == '__main__':
    main(sys.argv[1])
