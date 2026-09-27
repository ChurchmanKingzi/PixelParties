LEFT=[
"....................",
"..............HHHHHH",
"............HHHHHHHH",
"...........HHhhHHHHH",
"..........HHhhHHHHHH",
"..........HhhHHHHHHH",
".........HHhHHHHHHHH",
".........HhHHHHHhHHH",
".........HhHHHHHHHHH",
".........HhHHHHFHHHH",
".........HhHHHFFFHFF",
".........HhHHFEFFFEF",
".........HhHHFFEEEFF",
".........HhHHFCCFFFF",
".........HhHHFFFFFFF",
"........HHhHHFFFFFFF",
"........HhhHHHFFFFEF",
"........HhHHHHFFFFFE",
"........HhHHHHHFFFFF",
".....PPPHhHHHHHHHFFF",
"...PPPPPPhHHHHHHHDDD",
"..PPpPPPPPHHHHHHDDDD",
".PPpPPPPPPPHHHHDDDDD",
".PpPPPPPPPPPHHDDDDDD",
".PPPPPPPPPPPHHDDDDDD",
"..PPPPPPPPPPHDDDDDDD",
"...AAAAAAAAHHDDDDDDo",
"...AAAAAAAAHHDDDDooo",
"...AAAaAAAAHDDDDoooo",
"....AAaAAAAHDDDooOOO",
"....AAaAAAAHDDooOOOO",
"....AAaAAAAHDDoOOOOO",
".....AaAAAAHDDoOOOOO",
".....AAAAAAFFDoOOOOO",
"......AAAAFFFFoOOOOO",
"......AAAFFFFFooOOOO",
".......DDFFFFDDooOOO",
".......DDDFFDDDDoooo",
"......DDDDDDDDDDDooo",
"......DDdDDDDDDDDDDD",
".....DDDdDDDDDDDdDDD",
".....DDDdDDDDDDDdDDD",
".....DDdDDDDDDDdDDDD",
"....DDDdDDDDDDDdDDDD",
"....DDdDDDDDDDdDDDDD",
"....DDdDDDDDDDdDDDDD",
"...DDDdDDDDDDdDDDDDD",
"...DDdDDDDDDDdDDDDDD",
"...DDdDDDDDDdDDDDDDD",
"..DDDdDDDDDDdDDDDDDD",
"..DDdDDDDDDdDDDDDDDD",
"..DDdDDDDDDdDDDDDDDD",
".DDDdDDDDDdDDDDDDDDD",
".DDdDDDDDDdDDDDDDDDD",
".DDdDDDDDdDDDDDDDDDD",
".GGGGGGGGGGGGGGGGGGG",
"..........BBB.......",
"..........BBB.......",
]
def build():
    rows=[list(r) for r in LEFT]
    for y in range(39,55):
        r=rows[y]
        e=next(i for i,c in enumerate(r) if c!='.')
        for x in range(e,20):
            if r[x] in 'Dd': r[x]='D'
        k=y-39
        for fx in (max(e+2,8-k//5),13-k//6):
            if r[fx]=='D': r[fx]='d'
    return [''.join(r)+''.join(r)[::-1] for r in rows]
COL={'H':(186,36,52),'h':(238,92,84),'F':(252,212,176),'E':(28,24,34),'P':(176,164,70),'p':(226,216,126),
     'A':(64,70,170),'a':(112,120,214),'D':(104,58,168),'d':(156,122,224),'O':(255,252,226),'o':(255,206,84),
     'G':(240,190,60),'C':(246,150,150),'B':(92,52,30)}
