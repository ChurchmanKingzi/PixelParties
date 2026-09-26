LEFT=[
"..............KKKKK",
"...........KKKDDDDD",
".........KKDDDDDDDD",
".KK.....KDDDDDDDDDD",
".KDK...KDDDDDDDDDDD",
".KDDK.KDDDDDDDDDDDD",
".KMDDKDDDDDDDDDDDDD",
".KMMDDDDDDDDDDDDDDD",
"..KMMDDDDDDDDDDDDDD",
"..KLMMMDDDDDDDDDDDD",
"...KLLLMMMMMMMMMMMM",
"....KKKLLLLLLLLLLLL",
".......KKKKKKKKKKKK",
"..........KDDDDDDDD",
"..........KDDDDDDDD",
"..........KMMMMMMMM",
"..........KMMMMMMLL",
"...BB.....KMMMMMLLM",
"..B.B...BBBBBBBBBMM",
"..B..BBBbbbbbbbbbBB",
"..BB.BbbBBbbbbbBbbb",
"...BBbbbbbBBBbbbbbb",
"....BBBbbbbbbbbBBbb",
"......BBBBbbbBbbbbB",
".........BbbbBbbbbb",
"........BbbBbbbbBbb",
"....KKKKBbbbbBbbbbb",
"..KKLLLKBbBbbbbBbbb",
".KLLLLKBbbbbbBbbbbB",
".KLLMMKBbbBbbbbbbbb",
"KLLMMMKBbbbbbBbbbBb",
"KLMMMMMKBbbbbbbbbbb",
"KLMMMWMKBBbbBbbbbBb",
"KLMMMMWMKBbbbbbbbbb",
"KLMMMMWMMKBBbbBbbbB",
"KLMMMMMWMMMKBBbbbbB",
"KLMMMMMWMMMMMKBBBBb",
"KLMMMMMMWMMMMMMMMKB",
"KLMMMMMMWMMMMMMMMMK",
"KDMMMMMMMWMMMMMMMMM",
"KDDMMMMMMWMMMMMMMWM",
"KKKKKKKKKKKKKKKKKKK",
]
def build():
    rows=[list(r+r[::-1]) for r in LEFT]
    def put(x,y,c):
        rows[y][x]=c
    # skull on hat (full coords, center between 18|19)
    sk=["..WWWW..",
        ".WWWWWW.",
        ".WKWWKW.",
        ".WWWWWW.",
        "..WKKW..",
        "..W..W.."]
    for j,r in enumerate(sk):
        for i,c in enumerate(r):
            if c!='.': put(15+i,2+j,c)
    for (x,y) in [(12,2),(13,3),(25,2),(24,3),(12,8),(13,7),(25,8),(24,7)]: put(x,y,'W')
    # eyes glowing under brim
    for side in (0,1):
        for (x,y,c) in [(12,13,'K'),(13,13,'K'),(14,13,'K'),(15,13,'K'),(16,13,'K'),(13,14,'W'),(14,14,'W'),(15,14,'W'),(16,14,'K'),(12,14,'K'),(13,15,'K'),(14,15,'K'),(15,15,'K')]:
            X=x if side==0 else 37-x
            put(X,y,c)
    # gold earring right side
    put(30,17,'W'); put(30,18,'W')
    import math
    for y in range(len(rows)):
        for x in range(len(rows[0])):
            if rows[y][x] in 'Bb':
                strand=((x+int(1.6*math.sin(y*0.7+(x>18)*3)))%4==0)
                rows[y][x]='b' if strand else 'B'
    return [''.join(r) for r in rows]
