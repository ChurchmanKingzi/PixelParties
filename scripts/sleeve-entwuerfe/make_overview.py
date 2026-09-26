from lib import *
import glob
fs = sorted(glob.glob(os.path.join(OUT, '[0-9][0-9]_*.png')))
LABELS = {'01': '1 Tiefsee-Abgrund', '02': '2 Engelsherz', '03': '3 Blaupause', '04': '4 The Eye Sees You', '05': '5 Wowhalla',
          '06': '6 Mondzyklus', '08': '8 King of Kings', '09': '9 Welcome to the Hive'}
names = [LABELS.get(os.path.basename(f)[:2], os.path.basename(f)) for f in fs]
tw, th, gap = 300, 420, 24
sheet = Image.new('RGB', (4 * tw + 5 * gap, 2 * (th + 40) + 3 * gap), (28, 24, 36))
d = ImageDraw.Draw(sheet)
f = ImageFont.truetype(FONT, 20)
for i, fp in enumerate(fs):
    im = Image.open(fp).resize((tw, th), Image.LANCZOS)
    x = gap + (i % 4) * (tw + gap); y = gap + (i // 4) * (th + 40 + gap)
    sheet.paste(im, (x, y))
    d.text((x, y + th + 8), names[i], font=f, fill=(240, 236, 250))
sheet.save(os.path.join(TMP, 'uebersicht.png'))
