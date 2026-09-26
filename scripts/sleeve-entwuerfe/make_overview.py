from lib import *
import glob
fs = sorted(glob.glob(os.path.join(OUT, '[0-9][0-9]_*.png')))
names = ['1 Tiefsee-Abgrund', '2 Engelsherz', '3 Blaupause', '4 The Eye Sees You', '5 Wowhalla',
         '6 Mondzyklus', '7 Fire + Ice', '8 King of Kings', '9 Welcome to the Hive', '10 Rest in Party']
tw, th, gap = 300, 420, 24
sheet = Image.new('RGB', (5 * tw + 6 * gap, 2 * (th + 40) + 3 * gap), (28, 24, 36))
d = ImageDraw.Draw(sheet)
f = ImageFont.truetype(FONT, 20)
for i, fp in enumerate(fs):
    im = Image.open(fp).resize((tw, th), Image.LANCZOS)
    x = gap + (i % 5) * (tw + gap); y = gap + (i // 5) * (th + 40 + gap)
    sheet.paste(im, (x, y))
    d.text((x, y + th + 8), names[i], font=f, fill=(240, 236, 250))
sheet.save(os.path.join(TMP, 'uebersicht.png'))
