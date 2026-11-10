"""Untertitel im Video (Schreibmaschine in einer Pixelbox, Schlüsselwörter *gold*) – gemeinsamer Baustein für die Shows.
Die Show liefert `CAPTIONS` = [(von, bis, 'Text mit *Hervorhebung*')], `CPS`, `CAP_Y`, `draw_text`, `U` und `_cache`."""
from PIL import Image

GOLD = (255, 214, 64)
GOLD_HL = (255, 244, 170)


class CaptionMixin:
    CPS = 38.0
    CAP_Y = 1150

    def _tw(self, text, scale):
        tmp = Image.new('RGBA', (4, 4))
        x, y, w, h = self.draw_text(tmp, text, scale, (0, 0), color=(255, 255, 255), outline=None, shadow=None, anchor='lm')
        return w - 2 * scale

    def _cap_layout(self, idx):
        key = ('cap', idx)
        if key in self._cache:
            return self._cache[key]
        scale, maxw = 4, 880
        text = self.CAPTIONS[idx][2]
        space = self._tw('A A', scale) - self._tw('AA', scale)
        words, gold = [], False
        for raw in text.split(' '):
            pieces, cur = [], ''
            for ch in raw:
                if ch == '*':
                    if cur:
                        pieces.append((cur, gold)); cur = ''
                    gold = not gold
                else:
                    cur += ch
            if cur:
                pieces.append((cur, gold))
            words.append(pieces)
        lines, cur, cw = [], [], 0
        for pieces in words:
            ww = sum(self._tw(p, scale) for p, g in pieces)
            add = ww if not cur else space + ww
            if cur and cw + add > maxw:
                lines.append((cur, cw)); cur, cw = [], 0; add = ww
            cur.append(pieces); cw += add
        lines.append((cur, cw))
        out, ci = [], 0
        for li, (ws, lw) in enumerate(lines):
            x = -lw / 2.0
            for pieces in ws:
                for p, g in pieces:
                    out.append((li, x, p, g, ci))
                    ci += len(p); x += self._tw(p, scale)
                ci += 1; x += space
        res = dict(scale=scale, lines=len(lines), items=out, width=max(lw for ws, lw in lines), total=ci)
        self._cache[key] = res
        return res

    def _put(self, canvas, text, sc, x, y, color):
        """Ein Textstück zeichnen. Reine Satzzeichen (, . ! ? : ;) würden als eigener Text auf Zeilenmitte zentriert (die Maske wird auf die Tinte beschnitten) und stünden zu hoch:
        sie werden mit einem „H“ davor gesetzt (gleiche Grundlinie) und das „H“ wieder abgeschnitten."""
        punct = text and not any(ch.isalnum() for ch in text) and text != '-'
        if not punct:
            self.draw_text(canvas, text, sc, (x, y), color=color, outline=None, shadow=(20, 10, 30), anchor='lm')
            return
        wh = self._tw('H', sc)
        tmp = Image.new('RGBA', (self._tw('H' + text, sc) + 8 * sc, 24 * sc), (0, 0, 0, 0))
        bx, by, bw, bh = self.draw_text(tmp, 'H' + text, sc, (0, 12 * sc), color=color, outline=None, shadow=(20, 10, 30), anchor='lm')
        rest = tmp.crop((bx + sc + wh, 0, tmp.width, tmp.height))
        bb = rest.getbbox()
        if not bb:
            return
        canvas.paste(rest.crop(bb), (int(x), int(y - 12 * sc + bb[1])), rest.crop(bb))

    def _draw_caption(self, canvas, d, t):
        for idx, (t0, t1, text) in enumerate(self.CAPTIONS):
            if not (t0 <= t < t1):
                continue
            L = self._cap_layout(idx)
            sc = L['scale']
            n = int((t - t0) * self.CPS)
            lh = sc * 12
            bw, bh = L['width'] + 6 * sc * 2, L['lines'] * lh + 5 * sc * 2
            cx, cy = 540, self.CAP_Y
            u = self.U
            x0 = int(round((cx - bw / 2) / u) * u); y0 = int(round((cy - bh / 2) / u) * u)
            x1 = x0 + int(round(bw / u) * u); y1 = y0 + int(round(bh / u) * u)
            d.rectangle([x0 - 2 * u, y0 - 2 * u, x1 + 2 * u - 1, y1 + 2 * u - 1], fill=(20, 10, 30, 255))
            d.rectangle([x0 - 2 * u, y0 - 2 * u, x1 + 2 * u - 1, y1 + 2 * u - 1], outline=GOLD, width=u)
            d.rectangle([x0, y0, x1 - 1, y1 - 1], outline=(120, 100, 170, 255), width=max(1, u // 2))
            ty = y0 + (bh - L['lines'] * lh) // 2 + lh // 2
            for li, x, p, g, ci in L['items']:
                if ci >= n:
                    break
                self._put(canvas, p[:n - ci], sc, cx + x, ty + li * lh, GOLD_HL if g else (255, 255, 255))
            return
