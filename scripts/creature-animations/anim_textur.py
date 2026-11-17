"""Texturierte Streckzeilen (Nutzer-Feedback Runde 4, Regel 43: „beim Stretching einfach kopierte Zeilen – passende Textur/Schattierung hinzufügen“).

Ersatz für L.streck_zeile / A.koerper_pose, wenn deren Mischung nicht greift (Nachbarzeile zu verschieden oder gleich → reine Kopie):
Jede eingefügte Zeile behält die SILHOUETTE der gestreckten Zeile (Umriss, Breite – die Bewegung ändert sich nicht), ihr Inneres wird aber
aus den Zeilen gebaut, zwischen denen sie liegt:
  * kurze Abweichungen (Schattierungsgrenze wandert um 1–4 px): die Grenze liegt in der neuen Zeile auf halbem Weg (Verlauf wird weitergeführt),
  * lange Abweichungen (anderes Muster/anderes Teil): das Muster der gestreckten Zeile wird mit ihrer anderen Nachbarzeile fortgesetzt
    (2-px-Wechsel, je Kopie versetzt),
  * dunkle Linien (Pixel, die deutlich dunkler sind als die Zeilen darüber UND darunter) werden nie übernommen → keine verdickten Nähte/Gürtel;
    schräg durchlaufende Linien bleiben geschlossen,
  * was dann noch auf ≥ 5 px einer Nachbarzeile gleicht, wird mit der übernächsten Zeile weitergemischt.
Es entstehen nur Pixel, die in derselben Spalte in einer der Nachbarzeilen schon vorkommen (keine neuen Farben)."""
import numpy as np
import anim_lib as L

_L_STRECK_ZEILE = L.streck_zeile      # das Original (umleiten() ersetzt L.streck_zeile zur Laufzeit durch die texturierte Fassung)

D_LINIE = 22          # Helligkeitsabstand, ab dem ein Pixel als „dunkle Linie“ gegenüber den Zeilen darüber/darunter gilt
D_AEHNLICH = 64       # bis zu diesem Helligkeitsabstand (heller) gelten zwei Pixel als „gleiches Material“ (Schattierungsstufen)
D_DUNKLER = 36        # … und höchstens so viel DUNKLER darf ein übernommenes Pixel sein (keine Umriss-/Mund-/Augenfarben in helle Flächen ziehen)
LANG = 5              # ab dieser Lauflänge gilt eine Abweichung als „anderes Muster“ (und eine Übereinstimmung als Kopie)
STANDARD_SPERRE = ()  # Sperrfarben für Aufrufe ohne eigenes `sperre` (setzt umleiten(sperre=…) je Figurenskript)
SPALTEN_TEXTUR = False  # True (umleiten(spalten=True)): koerper_pose texturiert auch die beim Stauchen verdoppelten Spalten
NICHT_HOLEN = ()      # Farben, die nie aus einer Nachbarzeile in eine eingefügte Zeile geholt werden (setzt umleiten(nicht_holen=…));
                      # anders als Sperrfarben dürfen sie in der eingefügten Zeile aber durch hellere Nachbarpixel ersetzt werden


def _lum(z):
    return 0.299 * z[:, 0].astype(float) + 0.587 * z[:, 1] + 0.114 * z[:, 2]


def _innen(z):
    """Deckende Pixel, deren linker und rechter Nachbar ebenfalls deckend ist (keine Umriss-/Randpixel)."""
    op = z[:, 3] > 0
    m = op.copy()
    m[1:] &= op[:-1]; m[:-1] &= op[1:]
    m[0] = m[-1] = False
    return m


def _ungleich(a, b):
    return (a[:, :3] != b[:, :3]).any(axis=1)


def _laeufe(m):
    out, x, w = [], 0, len(m)
    while x < w:
        if m[x]:
            x1 = x
            while x1 < w and m[x1]:
                x1 += 1
            out.append((x, x1)); x = x1
        else:
            x += 1
    return out


def _linie(z, a, b):
    """Maske: Pixel von z, die deutlich dunkler sind als die Zeilen a UND b (darüber/darunter) → waagerechte dunkle Linie. Wo eine Seite
    transparent ist (Ebenen- oder Figurenrand), zählt ein Pixel nur als Linie, wenn es so dunkel ist wie der Umriss der Zeile selbst;
    ist eine Seite unbekannt (None), gilt nichts als Linie."""
    lz = _lum(z)
    op_z = z[:, 3] > 0
    m = op_z.copy()
    rand = op_z & ~_innen(z)
    umriss = (lz <= lz[rand].min() + 6) if rand.any() else np.zeros(len(z), bool)
    for n in (a, b):
        if n is None:
            return np.zeros(len(z), bool)
        op = n[:, 3] > 0
        m &= np.where(op, lz + D_LINIE < _lum(n), umriss)
    return m


def _leer_wie(z):
    return np.zeros_like(z)


def _mische(basis, quelle, ok, k, nur_kurz=False):
    """Pixel von `quelle` in `basis` einmischen, wo beide abweichen und `ok` gilt. Kurze Läufe: Grenze auf halbem Weg (die Hälfte, die an die
    gleichfarbige Umgebung der Quelle anschließt, kommt aus der Quelle); lange Läufe: 2-px-Wechsel (Phase k). Gibt (Zeile, Maske der langen Läufe) zurück."""
    neu = basis.copy()
    lang = np.zeros(len(basis), bool)
    diff = ok & _ungleich(basis, quelle)
    nr = k
    for x0, x1 in _laeufe(diff):
        n = x1 - x0
        if n >= LANG:
            lang[x0:x1] = True
            if not nur_kurz:
                for x in range(x0, x1):
                    if ((x + k) // 2) % 2 == 1:
                        neu[x] = quelle[x]
            continue
        if n == 1:
            # einzelnes abweichendes Pixel: abwechselnd übernehmen (sonst entstünde wieder eine reine Kopie einer der Zeilen)
            if nr % 2 == 0:
                neu[x0] = quelle[x0]
            nr += 1
            continue
        halb = n // 2 if (n % 2 == 0 or nr % 2 == 0) else n // 2 + 1
        nr += 1
        # Welche Seite schließt in der QUELLE an die gemeinsame Umgebung an? Dort setzt sich die Quelle fort.
        links_q = x0 > 0 and not (quelle[x0, :3] != quelle[x0 - 1, :3]).any()
        rechts_q = x1 < len(basis) and not (quelle[x1 - 1, :3] != quelle[x1, :3]).any()
        if rechts_q and not links_q:
            neu[x1 - halb:x1] = quelle[x1 - halb:x1]
        else:
            neu[x0:x0 + halb] = quelle[x0:x0 + halb]
    return neu, lang


def zwischenzeile(form, nah, fern=None, nah2=None, k=1, fern2=None, sperre=()):
    """Neue Zeile mit der Silhouette von `form` (der gestreckten Zeile), die zwischen `form` und `nah` zu liegen kommt.
    fern = Nachbarzeile von `form` auf der anderen Seite, nah2 = Zeile hinter `nah` (beide dürfen None sein). k = Nummer der Kopie (Phase).
    sperre: Farben (Augen, Mund, Glanzpunkte …), die weder übernommen noch überschrieben werden."""
    sperre = sperre or STANDARD_SPERRE
    if nah is None:
        nah = _leer_wie(form)
    sp = {tuple(int(v) for v in c[:3]) for c in sperre}

    spq = sp | set(NICHT_HOLEN)

    def frei(z, menge=None):
        menge = spq if menge is None else menge
        if not menge or z is None:
            return np.ones(len(form), bool)
        return np.array([tuple(int(v) for v in p[:3]) not in menge for p in z])
    inn = _innen(form) & (nah[:, 3] > 0) & frei(form, sp)          # wo die angrenzende Zeile fehlt, liegt die neue Zeile frei (Umriss) → bleibt wie die gestreckte
    if inn.sum() < 2:
        return form.copy()
    ok_nah = inn & _innen(nah) & ~_linie(nah, nah2, form) & frei(nah)
    ok_fern = (inn & _innen(fern) & ~_linie(fern, form, fern2) & frei(fern)) if fern is not None else np.zeros(len(form), bool)
    lf = _lum(form)

    def aehnlich(q):
        d = _lum(q) - lf
        return (d <= D_AEHNLICH) & (d >= -D_DUNKLER)
    # 1. kurze Abweichungen zur Zeile, an die die Kopie grenzt: Schattierungsgrenze auf halbem Weg
    lang_alle = _mische(form, nah, ok_nah, k, nur_kurz=True)[1]
    neu, _ = _mische(form, nah, ok_nah & aehnlich(nah), k, nur_kurz=True)
    lang = lang_alle
    # 2. lange Abweichungen: (a) Schattierung zur angrenzenden Zeile hin verjüngen – die Enden jedes Farbabschnitts der gestreckten Zeile
    #    nehmen die Farbe der angrenzenden Zeile an (nur bei ähnlicher Helligkeit, also gleichem Material); (b) wo danach noch ≥ LANG px
    #    gemusterte Kopie stehen (Schuppen, Dither: kurze Abschnitte), das Muster mit der anderen Nachbarzeile fortsetzen (2-px-Wechsel)
    aehn_nah = ok_nah & aehnlich(nah)
    for x0, x1 in _laeufe(lang):
        s0 = x0
        while s0 < x1:
            s1 = s0
            while s1 < x1 and not (form[s1, :3] != form[s0, :3]).any():
                s1 += 1
            n = s1 - s0
            e = 0 if n < 3 else (1 if n < 6 else 2)
            for x in list(range(s0, s0 + e)) + list(range(s1 - e, s1)):
                if aehn_nah[x]:
                    neu[x] = nah[x]
            s0 = s1
        if fern is not None:
            rest = np.zeros(len(form), bool)
            rest[x0:x1] = ~_ungleich(neu[x0:x1], form[x0:x1])
            for r0, r1 in _laeufe(rest):
                if r1 - r0 >= LANG and len({tuple(p) for p in form[r0:r1, :3].tolist()}) >= 2:
                    okf = ok_fern & aehnlich(fern)
                    okf[:r0] = False; okf[r1:] = False
                    m2, _ = _mische(form, fern, okf, k)
                    neu[r0:r1] = m2[r0:r1]
    # 3. dunkle waagerechte Linien der gestreckten Zeile nicht verdoppeln (außer sie laufen schräg in die Nachbarzeile weiter)
    lin = _linie(form, nah, fern) & inn
    if lin.any():
        ln, lf = _lum(nah), _lum(form)
        for x in np.nonzero(lin)[0]:
            weiter = any(0 <= x + d < len(form) and nah[x + d, 3] > 0 and ln[x + d] <= lf[x] + D_LINIE / 2 for d in (-1, 1))
            gerade = nah[x, 3] > 0 and ln[x] <= lf[x] + D_LINIE / 2
            if weiter and not gerade:
                neu[x] = form[x]                                     # schräge Linie: bleibt geschlossen
            elif ok_nah[x]:
                neu[x] = nah[x]
            elif ok_fern[x]:
                neu[x] = fern[x]
    # 4. Reste, die auf ≥ LANG px einer Nachbarzeile gleichen (und dort Textur haben), weitermischen
    for runde, (gegen, quellen) in enumerate(((nah, (nah2, fern)), (form, (fern, nah)))):
        gleich = inn & (gegen[:, 3] > 0) & ~_ungleich(neu, gegen)
        for x0, x1 in _laeufe(gleich):
            if x1 - x0 < LANG:
                continue
            for q in quellen:
                if q is None:
                    continue
                okq = inn & _innen(q) & frei(q) & ~(_lum(q) + D_LINIE < _lum(neu))        # hier nichts deutlich Dunkleres einmischen
                okq[:x0] = False; okq[x1:] = False
                if not (okq & _ungleich(neu, q)).any():
                    continue
                m4, _ = _mische(neu, q, okq, k + runde)
                # nichts übernehmen, was die jeweils andere Nachbarzeile kopieren würde
                neu[x0:x1] = m4[x0:x1]
                break
    # 5. Steht danach immer noch ein gemusterter Abschnitt (≥ LANG px, ≥ 3 Farben) als reine Kopie der gestreckten Zeile da, weil die
    #    Nachbarzeilen dort zu verschieden sind: gelockert mischen – beliebig HELLERE Pixel der Nachbarzeilen sind erlaubt (dunkle Details
    #    der Kopie werden so eher dünner als dicker), deutlich dunklere weiterhin nicht.
    for q in (nah, fern):
        if q is None:
            continue
        gleich = inn & ~_ungleich(neu, form)
        for x0, x1 in _laeufe(gleich):
            if x1 - x0 < LANG or len({tuple(p) for p in form[x0:x1, :3].tolist()}) < 3:
                continue
            okq = inn & _innen(q) & frei(q) & (_lum(q) - lf >= -D_DUNKLER)
            okq[:x0] = False; okq[x1:] = False
            m5, _ = _mische(neu, q, okq, k)
            neu[x0:x1] = m5[x0:x1]
    return neu


def kopien(form, nah, fern=None, nah2=None, n=1, fern2=None, sperre=()):
    """n eingefügte Zeilen zwischen `nah` und `form`, Reihenfolge von `nah` nach `form` (die erste grenzt an `nah`)."""
    out = []
    grenze = form
    for k in range(1, n + 1):                                         # von form aus nach außen bauen
        z = zwischenzeile(grenze if k > 1 else form, nah, fern if k == 1 else form, nah2, k, fern2 if k == 1 else fern, sperre)
        if k > 1:
            # Silhouette bleibt die der gestreckten Zeile
            rand = (form[:, 3] > 0) & ~_innen(form)
            z[rand] = form[rand]; z[form[:, 3] == 0] = 0
        out.append(z); grenze = z
    return out[::-1]


def streck_zeile(a, zeile, n=1, sperre=()):
    """Wie L.streck_zeile (Zeile `zeile` n-mal zusätzlich einfügen, alles darüber rückt hoch; n < 0 → L.streck_zeile), aber die eingefügten
    Zeilen sind texturiert statt kopiert (siehe Modulkopf). Silhouette und Bewegung sind identisch zu L.streck_zeile."""
    if n <= 0:
        return _L_STRECK_ZEILE(a, zeile, n)
    h = a.shape[0]
    if a[:n, :, 3].any():
        raise L.ClipError(f'streck_zeile würde {n} belegte Zeile(n) am oberen Rand abschneiden')
    rows = list(range(zeile)) + [zeile] * (n + 1) + list(range(zeile + 1, h))
    out = a[rows[n:]].copy()
    form = a[zeile]
    nah = a[zeile - 1] if zeile >= 1 else None
    nah2 = a[zeile - 2] if zeile >= 2 else None
    fern = a[zeile + 1] if zeile + 1 < h else None
    fern2 = a[zeile + 2] if zeile + 2 < h else None
    for j, z in enumerate(kopien(form, nah, fern, nah2, n, fern2, sperre)):
        out[zeile - n + j] = z                                         # Ausgabezeilen zeile-n … zeile-1 sind die Kopien, `zeile` das Original
    return out


def streck_spalte(a, spalte, n=1):
    """Dasselbe waagerecht: Spalte `spalte` n-mal zusätzlich einfügen, alles links davon rückt nach links."""
    return np.ascontiguousarray(streck_zeile(np.ascontiguousarray(a.transpose(1, 0, 2)), spalte, n).transpose(1, 0, 2))


def streck_unten(a, zeile, n=1, sperre=()):
    """Gegenstück zu streck_zeile für hängende Teile (Hinterleib, Fänge): Zeile `zeile` n-mal zusätzlich einfügen, alles OBERHALB bleibt stehen,
    alles darunter rückt nach unten. Ersetzt die handgeschriebenen `streck_unten`-Kopierfunktionen der Figurenskripte (gleiche Silhouette, gleiche
    Bewegung), die eingefügten Zeilen sind texturiert statt kopiert."""
    if n <= 0:
        return a.copy()
    if a[a.shape[0] - n:, :, 3].any():
        raise L.ClipError(f'streck_unten würde {n} belegte Zeile(n) am unteren Rand abschneiden')
    return np.ascontiguousarray(streck_zeile(np.ascontiguousarray(a[::-1]), a.shape[0] - 1 - zeile, n, sperre)[::-1])


def spalten_hub(a, zeile, k_von_x, sperre=()):
    """Wie anim_tiere.spalten_hub (in jeder Spalte x werden bei `zeile` k_von_x(x) Zeilen eingefügt bzw. bei k < 0 entfernt – der Rumpf hebt/neigt
    sich, die Füße bleiben), aber die eingefügten Pixel stammen aus texturierten Zwischenzeilen statt aus Kopien der Zeile `zeile`.
    Silhouette und Bewegung jeder Spalte sind identisch zum Original."""
    h, w = a.shape[:2]
    ks = [int(k_von_x(x)) if a[:, x, 3].any() else 0 for x in range(w)]
    out = np.zeros_like(a)
    kmax = max([k for k in ks if k > 0], default=0)
    hoch = np.concatenate([np.zeros((kmax, w, 4), a.dtype), a]) if kmax else a          # oben Platz, damit die Ganzzeilen-Streckung nie abschneidet
    voll = {}
    for x in range(w):
        k = ks[x]
        if not a[:, x, 3].any():
            continue
        if k <= 0:
            out[:, x:x + 1] = _L_STRECK_ZEILE(a[:, x:x + 1], zeile, k)
            continue
        if a[:k, x, 3].any():
            raise L.ClipError(f'spalten_hub würde in Spalte {x} {k} belegte Zeile(n) am oberen Rand abschneiden')
        if k not in voll:
            voll[k] = streck_zeile(hoch, zeile + kmax, k, sperre)[kmax:]
        out[:, x] = voll[k][:, x]
    return out


def misch_kopie(roh, nachbarn, k=1, sperre=()):
    """Ersatz für L.misch_kopie(roh, [nachbar1, nachbar2], k): eine einzelne eingefügte Zeile mit der Silhouette von `roh`, die an `nachbarn[0]`
    grenzt (nachbarn[1] = Zeile auf der anderen Seite von `roh`, darf None sein bzw. fehlen) – texturiert nach diesem Modul."""
    nb = list(nachbarn) + [None, None]
    if nb[0] is None:
        nb[0], nb[1] = nb[1], None
    if nb[0] is None:
        return roh.copy()
    return zwischenzeile(roh, nb[0], nb[1], None, k, None, sperre)


def koerper_pose(*args, funktion=None, spalten=None, **kw):
    """Wie A.koerper_pose (oder `funktion`, z. B. anim_slime.koerper_pose mit `sperre`), aber die gedoppelten Zeilen werden nach diesem Modul
    texturiert (sie liegen UNTER ihrer Quellzeile). `sperre`-Farben werden auch hier weder übernommen noch überschrieben.
    spalten=True (oder umleiten(spalten=True)): auch die beim Stauchen verdoppelten SPALTEN (p > 0) werden texturiert statt kopiert."""
    if funktion is None:
        import anim_amorph as A
        funktion = A.koerper_pose
        sperre = kw.pop('sperre', ())
    else:
        sperre = kw.get('sperre', ())
    funktion = getattr(funktion, '_tx_original', funktion)          # nach umleiten(): nicht doppelt texturieren
    out, quelle = funktion(*args, **kw)
    out = entkopiere_zeilen(out, quelle, sperre)
    if SPALTEN_TEXTUR if spalten is None else spalten:
        import inspect
        b = inspect.signature(funktion).bind(*args, **kw)
        b.apply_defaults()
        a = b.arguments
        out = entkopiere_spalten(out, quelle, a['zeilen'], a['p'], a['paare'], a.get('paare_je_zeile'), a.get('x0', 0), a.get('p_je_zeile'), sperre)
    return out, quelle


def entkopiere_spalten(out, quelle, zeilen, p, paare, paare_je_zeile=None, x0=0, p_je_zeile=None, sperre=()):
    """Die von anim_amorph.zeile_umbauen bei p > 0 verdoppelten Spalten (Stauchen: der Körper wird breiter) neu texturieren: von jedem
    Spaltenpaar bleibt die innere (zur Körpermitte gelegene) Kopie, die äußere wird wie eine Streckzeile aus ihren Nachbarspalten gebaut
    (zwischenzeile, senkrecht angewandt). Silhouette und Breite bleiben unverändert; `sperre`-Farben (Gesicht) bleiben unangetastet."""
    paare_je_zeile = paare_je_zeile or {}
    p_je_zeile = p_je_zeile or {}
    n, w = out.shape[:2]
    dup = np.zeros((n, w), bool)
    for j, k in enumerate(quelle):
        pk = p_je_zeile.get(k, p)
        if pk <= 0:
            continue
        spalten = {c + x0 for pr in list(paare_je_zeile.get(k, paare))[:pk] for c in pr}
        t = -pk
        for x in range(w):
            if x in spalten:
                if zeilen[k][x, 3] and 0 <= t + 1 < w:
                    dup[j, t + 1] = True                              # Kopien stehen in den Ausgabespalten t und t+1
                t += 2
            else:
                t += 1
    if not dup.any():
        return out
    out = out.copy()
    xs = np.nonzero(out[..., 3].any(axis=0))[0]
    mitte = (xs.min() + xs.max()) / 2.0

    def sp(x):
        return np.ascontiguousarray(out[:, x]) if 0 <= x < w else None
    for t in np.nonzero(dup.any(axis=0))[0]:
        rows = dup[:, t]
        if t - 0.5 <= mitte:                                          # linke Körperhälfte: äußere Kopie = Spalte t-1
            ziel, form, nah, fern, nah2, fern2 = t - 1, sp(t), sp(t - 2), sp(t + 1), sp(t - 3), sp(t + 2)
        else:                                                         # rechte Körperhälfte: äußere Kopie = Spalte t
            ziel, form, nah, fern, nah2, fern2 = t, sp(t - 1), sp(t + 1), sp(t - 2), sp(t + 2), sp(t - 3)
        if nah is None:
            continue
        v = zwischenzeile(form, nah, fern, nah2, 1 + int(t) % 2, fern2, sperre)
        ok = rows & (out[:, ziel, 3] > 0) & (v[:, 3] > 0)
        out[ok, ziel] = v[ok]
    return out


def entkopiere_zeilen(out, quelle, sperre=()):
    """out: (n, w, 4) Zeilenstapel, quelle: Quellzeilenindex je Ausgabezeile (gleiche aufeinanderfolgende Indizes = Kopien). Die Kopien
    (alle nach der ersten) werden neu texturiert: sie liegen zwischen ihrer Quellzeile (oben) und der nächsten Zeile (unten)."""
    out = out.copy()
    n = len(quelle)
    j = 0
    while j < n:
        e = j
        while e + 1 < n and quelle[e + 1] == quelle[j]:
            e += 1
        if e > j:
            form = out[j].copy()
            nah = out[e + 1] if e + 1 < n else None
            nah2 = out[e + 2] if e + 2 < n else None
            fern = out[j - 1] if j >= 1 else None
            fern2 = out[j - 2] if j >= 2 else None
            neu = kopien(form, nah, fern, nah2, e - j, fern2, sperre)                # Reihenfolge nah → form, hier also von unten nach oben
            for t, z in enumerate(neu[::-1]):
                out[j + 1 + t] = z
        j = e + 1
    return out


def atmen(a, brustzeile, halszeile, brust, kopf):
    """Wie anim_humanoide.atmen (nur der Brusthub wirkt, `kopf` wird wie dort ignoriert), mit texturierten Einfügezeilen."""
    return streck_zeile(a, brustzeile, brust) if brust else a


def szene_atmen(sz, layers, naht, n):
    """Wie anim_gb.Szene.atmen (Zeile `naht` n-mal in jede Ebene einfügen), mit texturierten Einfügezeilen."""
    if not n:
        return layers
    return [streck_zeile(a, sz.PT + naht, n) for a in layers]


def hupf_figur(spr, pose, dy, posen, paare_je_zeile, sperre, h, w, pad_l, pad_t, boden, paare=((8, 9),)):
    """Wie anim_hupf.hupf_figur (Squash-&-Stretch-Pose eines hüpfenden Wesens), aber mit texturierten statt kopierten Streckzeilen."""
    import anim_amorph as A
    import anim_slime as SL
    loeschen, doppeln, p = posen[pose]
    koerper = A.zeilen_von(spr, 0, spr.shape[0] - 1, h, w, pad_l, pad_t)
    z, quelle = koerper_pose(koerper, loeschen=loeschen, doppeln=doppeln, p=p, paare=paare,
                             paare_je_zeile=paare_je_zeile, x0=pad_l, sperre=sperre, funktion=SL.koerper_pose)
    fig, top = A.auf_leinwand(z, h, boden, dy)
    return fig, top, quelle


def ebene_atmung(teil, doppeln, h, w, pad_l, pad_t, boden):
    """Wie anim_shard.ebene_atmung (Teilebene mit eingefügten Atemzeilen auf die Leinwand), aber mit texturierten Einfügezeilen."""
    import anim_amorph as A
    k = A.zeilen_von(teil, 0, teil.shape[0] - 1, h, w, pad_l, pad_t)
    z, quelle = koerper_pose(k, doppeln=doppeln, x0=pad_l)
    ebene, top = A.auf_leinwand(z, h, boden, 0)
    return ebene, top, quelle


def umleiten(sperre=(), nicht_holen=(), spalten=False):
    """Leitet die Streckfunktionen der gemeinsamen Module für den laufenden Prozess auf dieses Modul um (die Moduldateien bleiben unverändert):
    L.streck_zeile, anim_amorph.koerper_pose und anim_slime.koerper_pose liefern danach texturierte statt kopierter Einfügezeilen – auch dort,
    wo ein Gruppenmodul sie intern aufruft (Hm.atmen, Szene.atmen, K.bob, U2.streck_teil, SH.ebene_atmung, HP.hupf_figur, anim_eis.schleim_koerper …).
    Einmal direkt nach den Importen eines Figurenskripts aufrufen. Mehrfachaufrufe sind unschädlich.
    sperre: Farben (z. B. die dunklen Umriss-/Nahtfarben der Figur), die in KEINER texturierten Zeile dieses Prozesses übernommen oder
    überschrieben werden, sofern der Aufruf kein eigenes `sperre` mitbringt.
    nicht_holen: Farben (die dunklen Umriss-/Nahtfarben der Figur), die nie aus einer Nachbarzeile in eine eingefügte Zeile geholt werden –
    für Figuren, bei denen sonst eine dunkle Naht dicker würde (Regel 43: dunkle Linien werden durch Strecken nie dicker)."""
    global STANDARD_SPERRE, NICHT_HOLEN, SPALTEN_TEXTUR
    if spalten:
        SPALTEN_TEXTUR = True                                         # spalten=True: koerper_pose texturiert auch die beim Stauchen verdoppelten Spalten
    if nicht_holen:
        NICHT_HOLEN = tuple(tuple(int(v) for v in c[:3]) for c in nicht_holen)
    if sperre:
        STANDARD_SPERRE = tuple(tuple(int(v) for v in c[:3]) for c in sperre)
    import anim_amorph as A
    import anim_slime as SL
    if getattr(L.streck_zeile, '_tx_original', None) is None:
        def _streck(a, zeile, n=1):
            return streck_zeile(a, zeile, n)
        _streck._tx_original = _L_STRECK_ZEILE
        L.streck_zeile = _streck
    for modul in (A, SL):
        orig = modul.koerper_pose
        if getattr(orig, '_tx_original', None) is not None:
            continue

        def _pose(*args, _orig=orig, **kw):
            return koerper_pose(*args, funktion=_orig, **kw)
        _pose._tx_original = orig
        modul.koerper_pose = _pose
