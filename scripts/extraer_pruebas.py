#!/usr/bin/env python3
"""
Calendarios de pruebas de evaluación de la EPS (UAH), publicados por titulación y curso en
https://escuelapolitecnica.uah.es/es/estudiantes/calendario-academico/

Cada enlace «Calendario» de la tabla lleva a una página con un calendario de Outlook empotrado y, bajo
«Cómo integrar los calendarios en lectores compatibles con iCAL», la URL de su fichero .ics.

Uso:
    python3 scripts/extraer_pruebas.py              # inventario de páginas + descarga de los .ics -> data/, web/pruebas.js
    python3 scripts/extraer_pruebas.py --sin-cache  # vuelve a descargar páginas y calendarios (cache/calendarios/)

Salida:
    data/calendarios.csv   una fila por enlace «Calendario»: titulación(es), curso, página, URL del .ics y nº de eventos
    data/no_lectivos.csv   festivos y vacaciones (calendario «Festivos et al. EPS-UAH» y periodos no lectivos de data/periodos.csv)
    data/pruebas.csv/json  una fila por prueba: fecha, horas (o día completo), asignatura, código, prueba, sigla, tipo…
    web/pruebas.js         lo mismo para la aplicación web
"""
import argparse, base64, csv, datetime as dt, hashlib, html, json, re, sys, time, urllib.parse
from pathlib import Path
from zoneinfo import ZoneInfo

import requests
from dateutil.rrule import rrulestr

sys.path.insert(0, str(Path(__file__).resolve().parent))
import extraer_horarios as eh   # normalización de nombres de asignatura y códigos

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
CACHE_DIR = ROOT / "cache" / "calendarios"
BASE = "https://escuelapolitecnica.uah.es"
URL_INDICE = BASE + "/es/estudiantes/calendario-academico/"
UA = {"User-Agent": "Mozilla/5.0 (HorariosEPS; +https://github.com/) python-requests"}
PAUSA = 0.4
MADRID = ZoneInfo("Europe/Madrid")

# Slug de la página -> siglas de titulación (las mismas que en los horarios). El orden importa: el doble grado
# contiene el nombre de GIEC y de GIEAI.
TITULACIONES = [
    (r"Grados-de-Telecomunicacion", "GITT/GIST/GIEC/GIT"),
    (r"Doble-Grado-en-Ingenieria-Electronica-de-Comunicaciones-e-Ingenieria-Electronica-y-Automatica", "GIECAI"),
    (r"Grado-en-Ingenieria-de-Sistemas-de-Telecomunicacion", "GIST"),
    (r"Grado-en-Ingenieria-Electronica-de-Comunicaciones", "GIEC"),
    (r"Grado-en-Ingenieria-Telematica", "GIT"),
    (r"Grado-en-Ingenieria-en-Tecnologias-de-la-Telecomunicacion", "GITT"),
    (r"Grado-en-Ingenieria-Electronica-y-Automatica-Industrial", "GIEAI"),
    (r"Grado-en-Ingenieria-en-Tecnologias-Industriales", "GITI"),
    (r"Grado-en-Ingenieria-de-Computadores", "GIC"),
    (r"Grado-en-Ingenieria-Informatica", "GII"),
    (r"Grado-en-Ingenieria-en-Sistemas-de-Informacion", "GISI"),
    (r"Grado-en-Matematicas-y-computacion", "GMC"),
    (r"Master-Universitario-en-Ingenieria-Industrial", "MUII"),
    (r"Master-Universitario-en-Ingenieria-de-Telecomunicacion", "MUIT"),
    (r"asignaturas-transversales", "TRV"),
    (r"bonocreditos", "BONO"),
]
CURSOS = {"primer": 1, "segundo": 2, "tercer": 3, "cuarto": 4, "quinto": 5}

sesion = requests.Session()
sesion.headers.update(UA)


def descargar(clave, url, usar_cache=True):
    """Descarga (o lee de cache/calendarios/) el texto de una URL. clave: nombre del fichero de caché."""
    f = CACHE_DIR / clave
    if usar_cache and f.exists():
        return f.read_text(encoding="utf-8")
    for intento in range(3):
        try:
            r = sesion.get(url, timeout=60)
            r.raise_for_status()
            break
        except requests.RequestException as e:
            if intento == 2:
                raise
            print(f"  reintento {url}: {e}", file=sys.stderr)
            time.sleep(2)
    time.sleep(PAUSA)
    r.encoding = "utf-8"
    f.parent.mkdir(parents=True, exist_ok=True)
    f.write_text(r.text, encoding="utf-8")
    return r.text


def limpiar(s):
    return html.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", s))).strip()


# ----------------------------------------------------------------------------- inventario
def id_google(src):
    """Parámetro src= del calendario empotrado de Google: el ID tal cual o en base64."""
    src = urllib.parse.unquote(src)
    if "@" in src:
        return src
    try:
        s = base64.urlsafe_b64decode(src + "=" * (-len(src) % 4)).decode()
        return s if "@" in s else ""
    except (ValueError, UnicodeDecodeError):
        return ""


def ics_google(cid):
    return "https://calendar.google.com/calendar/ical/" + urllib.parse.quote(cid) + "/public/basic.ics"


def inventario(usar_cache):
    """Una fila por página «Calendario» y fichero .ics. Se toma como referencia el calendario empotrado (lo que ve el
    estudiante); el enlace del texto «Cómo integrar…» está a veces copiado de otra página, y se avisa."""
    indice = descargar("indice.html", URL_INDICE, usar_cache)
    filas = []
    for m in re.finditer(r'<a[^>]*href="([^"]*/calendario-academico/[^"]+/)"[^>]*>\s*Calendario\s*</a>', indice):
        href = m.group(1)
        url = href if href.startswith("http") else BASE + href
        slug = url.rstrip("/").rsplit("/", 1)[-1]
        tit = next((t for patron, t in TITULACIONES if re.search(patron, slug, re.I)), "")
        mc = re.match(r"Calendario-(\w+)-curso", slug)
        curso = CURSOS.get(mc.group(1).lower(), "") if mc else ""
        if not tit:
            print(f"  aviso: titulación no reconocida en {slug}", file=sys.stderr)
        pagina = html.unescape(descargar(f"{slug}.html", url, usar_cache))
        base = {"titulaciones": tit, "curso": curso, "pagina": slug, "url_pagina": url}
        # enlaces del texto (sin el ejemplo genérico «.../public/basic.ics» ni los «safelinks» de Outlook)
        texto = [u for u in re.findall(r'https://[^\s"<>]+?\.ics', pagina) if "/.../" not in u and "safelinks" not in u]
        texto = list(dict.fromkeys(u.replace("www.google.com/calendar", "calendar.google.com/calendar") for u in texto))
        outlook = [u.replace("/calendar.html", "/calendar.ics") for u in re.findall(r'<iframe[^>]+src="(https://outlook\.office365\.com/[^"]+/calendar\.html)"', pagina)]
        google = [ics_google(c) for e in re.findall(r'<iframe[^>]+src="(https://calendar\.google\.com/[^"]+)"', pagina)
                  for c in map(id_google, re.findall(r"[?&]src=([^&]+)", e)) if c]
        fuentes = [(u, "empotrado") for u in outlook + google]
        texto_outlook = [u for u in texto if "outlook" in u]
        if outlook:
            for u in texto_outlook:
                if u not in outlook:
                    base["aviso"] = f"el enlace iCal del texto no es el del calendario empotrado ({u.split('/')[-2][:12]}…)"
        else:
            fuentes += [(u, "texto") for u in texto_outlook]
        fuentes += [(u, "texto") for u in texto if "google" in u and u not in google]
        if not fuentes:
            filas.append({**base, "aviso": "sin calendario"})
        for u, origen in fuentes:
            filas.append({**base, "ics": u, "origen": origen, "plataforma": "outlook" if "outlook" in u else "google"})
    return filas


# ----------------------------------------------------------------------------- iCalendar
def propiedades(texto):
    """Devuelve una lista de VEVENT; cada uno, dict nombre -> (parámetros, valor)."""
    lineas = re.sub(r"\r?\n[ \t]", "", texto).splitlines()   # desplegar líneas continuadas
    eventos, ev, nombre_cal = [], None, ""
    for ln in lineas:
        if ln == "BEGIN:VEVENT":
            ev = {}
        elif ln == "END:VEVENT":
            eventos.append(ev); ev = None
        elif ":" in ln:
            cab, valor = ln.split(":", 1)
            nombre, *params = cab.split(";")
            p = dict(x.split("=", 1) for x in params if "=" in x)
            if ev is not None and nombre.upper() == "EXDATE":
                ev.setdefault("EXDATE", []).extend((p, x) for x in valor.split(","))
            elif ev is not None:
                ev.setdefault(nombre.upper(), (p, valor))
            elif nombre.upper() == "X-WR-CALNAME":
                nombre_cal = valor
    return nombre_cal, eventos


def desescapar(v):
    return re.sub(r"\\([nN,;\\])", lambda m: "\n" if m.group(1) in "nN" else m.group(1), v).strip()


def fecha_ics(p, v):
    """(datetime local sin zona o date, es_dia_completo). Las horas con TZID (Outlook: «Romance Standard Time»,
    Google: Europe/Madrid) ya son hora de Madrid; las UTC (…Z) se convierten."""
    if p.get("VALUE") == "DATE" or re.fullmatch(r"\d{8}", v):
        return dt.datetime.strptime(v[:8], "%Y%m%d").date(), True
    d = dt.datetime.strptime(v[:15], "%Y%m%dT%H%M%S")
    if v.endswith("Z"):
        d = d.replace(tzinfo=dt.timezone.utc).astimezone(MADRID).replace(tzinfo=None)
    return d, False


def repeticiones(ev, ini, dia_completo, desde, hasta):
    """Inicios del evento dentro de [desde, hasta]; expande RRULE (con EXDATE) si la hay."""
    if "RRULE" not in ev:
        return [ini]
    base = dt.datetime.combine(ini, dt.time()) if dia_completo else ini
    regla = re.sub(r"UNTIL=(\d{8})(?!T)", r"UNTIL=\1T235959Z", ev["RRULE"][1])
    try:
        r = rrulestr(regla, dtstart=base.replace(tzinfo=MADRID))
        xs = [x.astimezone(MADRID).replace(tzinfo=None) for x in r.between(
            dt.datetime.combine(desde, dt.time(), MADRID), dt.datetime.combine(hasta, dt.time(23, 59), MADRID), inc=True)]
    except (ValueError, TypeError) as e:
        print(f"  RRULE no interpretada ({e}): {regla}", file=sys.stderr)
        return [ini]
    excl = {fecha_ics(*x)[0] for x in ev.get("EXDATE", [])}
    xs = [x for x in xs if x not in excl and x.date() not in excl]
    return [x.date() for x in xs] if dia_completo else xs


# En los calendarios de Google de Industriales (uno por asignatura) conviven clases y pruebas; en los de Outlook,
# todo son actividades de evaluación.
ES_PRUEBA = re.compile(r"\bpei|\bpl ?\d|\bprl\b|\bpecl?\d*\b|\bpf\b|\btcl?\d|examen|prueba|parcial|entrega|entregable|\bfinal\b|"
                       r"extraordinari|ordinaria|evaluaci|cuestionario|\btest\b|defensa|\b(?:e|p)\d\b|hito", re.I)


def tipo_prueba(t):
    t = eh.sin_acentos(t).lower()
    for patron, tipo in [(r"extraordinari", "extraordinaria"), (r"\bfinal\b|ordinari|\bpe?f\b", "final"),
                         (r"laboratorio|\blab\b|practica|\bprl?\d*\b|\bpl\b|\bpl ?\d|\bplab|\bepl|\bpecl", "laboratorio"),
                         (r"entrega|memoria|informe|trabajo|\be\d\b", "entrega"),
                         (r"intermedia|parcial|\bpei|\bpec ?\d*\b|\bpe ?\d|\btcl?\d|continua|\btest\b|examen", "intermedia"),
                         (r"presentacion|exposicion|defensa", "presentación")]:
        if re.search(patron, t):
            return tipo
    return "otra"


# ----------------------------------------------------------------------------- asignaturas
# Los calendarios de Outlook escriben la asignatura a su manera: nombre completo, abreviado («Estruct. Datos»,
# «E. Potencia»), por siglas («TDS», «PV-PEI») o sólo en la descripción. Se casa con el catálogo de la titulación y curso.
VACIAS = {"DE", "DEL", "LA", "LAS", "EL", "LOS", "Y", "E", "EN", "A", "AL", "PARA", "CON", "O", "U", "POR"}
SIGLAS_FIJAS = {"SSOO": "SISTEMAS OPERATIVOS", "BBDD": "BASES DE DATOS"}
GENERICAS = {"PRUEBA", "PRUEBAS", "EXAMEN", "EVALUACION", "INTERMEDIA", "LABORATORIO", "PRACTICA", "PRACTICAS", "ENTREGA",
             "ENTREGABLE", "TEORIA", "GRUPO", "PARCIAL", "FINAL", "CONTROL", "TRABAJO", "PROYECTO", "HORARIO", "MANANA", "TARDE"}


class Catalogo:
    def __init__(self):
        self.por_tc, self.por_tit, self.por_codigo, self.plan = {}, {}, {}, {}   # plan: sigla -> código de plan (GIT -> G380)

    def _alta(self, tit, curso, codigo, nombre, nombre_en="", de_guia=False):
        k = eh.nombre_canonico(nombre)
        c = self.por_codigo.get(codigo) if codigo else None
        if not c:
            c = {"codigo": codigo, "nombre": nombre, "clave": k, "nombres": [], "tits": set()}
            if codigo:
                self.por_codigo[codigo] = c
        if de_guia:
            c["tits"].add(tit)   # titulaciones cuya guía docente usa este código
        for nm in (nombre, nombre_en):
            kk = eh.nombre_canonico(nm) if nm else ""
            if kk and kk not in [x["clave"] for x in c["nombres"]]:
                pal = [w for w in kk.split() if w not in VACIAS]
                c["nombres"].append({"clave": kk, "palabras": pal, "siglas": "".join(w[0] for w in pal if not w.isdigit())})
        for d, kk in ((self.por_tc, (tit, str(curso))), (self.por_tit, tit)):
            d.setdefault(kk, {})[c["codigo"] or k] = c
        return c

    def cargar(self):
        with open(DATA_DIR / "guias.csv", encoding="utf-8") as fh:
            for g in csv.DictReader(fh):
                self.plan.setdefault(g["titulacion"], g["plan"])
                cursos = [g["curso"]] if g["curso"].isdigit() else (["3", "4", "5"] if g["curso"] == "OPT" else [""])
                for cu in cursos:
                    self._alta(g["titulacion"], cu, g["codigo"], g["asignatura"], g["asignatura_en"], de_guia=True)
        with open(DATA_DIR / "sesiones.csv", encoding="utf-8") as fh:
            for s in csv.DictReader(fh):
                for t in s["titulaciones"].split("/"):
                    c = self.por_codigo.get(s["codigo"])
                    self._alta(t, s["curso"], s["codigo"], c["nombre"] if c else s["asignatura"])

    def casar(self, texto, titulaciones, curso):
        """Asignatura (dict del catálogo) mencionada en texto, o None."""
        m = re.search(r"\b(\d{6})\b", texto)
        if m and m.group(1) in self.por_codigo:
            return self.por_codigo[m.group(1)]
        tits = titulaciones.split("/")
        # a igualdad (asignaturas compartidas con un código por plan), el código numerado como el plan de la titulación
        # (GITT, plan G350: 350020; GIT, plan G380: 380000) y, si no, uno cuya guía docente sea de la titulación
        prefijos = tuple(self.plan[t][1:] for t in tits if self.plan.get(t))
        propio = lambda c: (bool(prefijos) and c["codigo"].startswith(prefijos), bool(c["tits"] & set(tits)))
        niveles = [[c for t in tits for c in self.por_tc.get((t, str(curso)), {}).values()],
                   [c for t in tits for c in self.por_tit.get(t, {}).values()]]
        T = eh.clave(texto)
        toks = T.split()
        # alias (data/alias.csv) aplicados a cualquier tramo del texto
        alias = {eh.ALIAS[" ".join(toks[i:j])] for i in range(len(toks)) for j in range(i + 1, len(toks) + 1) if " ".join(toks[i:j]) in eh.ALIAS}
        alias |= {SIGLAS_FIJAS[w] for w in toks if w in SIGLAS_FIJAS}
        sig = [w for w in toks if w not in VACIAS - {"E"}]   # «E. Potencia»: la E es abreviatura, no conjunción
        orig = set(re.findall(r"\b[A-Z]{2,6}\b", eh.sin_acentos(texto)))
        for cands in niveles:
            # 1) nombre completo (o alias)
            completos = [(len(n["clave"]), c) for c in cands for n in c["nombres"]
                         if n["clave"] in alias or re.search(r"\b%s\b" % re.escape(n["clave"]), T)]
            if completos:
                return max(completos, key=lambda x: (x[0], propio(x[1])))[1]
            # 2) abreviaturas y nombres parciales: palabras seguidas del texto que son prefijo de palabras seguidas del
            #    nombre («Estruct. Datos», «Arquitectura y Diseño de Sistemas»); vale si cubre el nombre entero, dos
            #    palabras con 8 letras o una palabra distintiva; gana la que más letras cubre si no hay empate
            puntos = {}
            for c in cands:
                for n in c["nombres"]:
                    P = n["palabras"]
                    for i in range(len(sig)):
                        for s in range(len(P)):
                            j = 0
                            while i + j < len(sig) and s + j < len(P) and P[s + j].startswith(sig[i + j]):
                                j += 1
                            letras = sum(len(sig[i + x]) for x in range(j))
                            if (j == len(P) and letras >= 4 and letras > j) or (j >= 2 and letras >= 8) or \
                                    (j == 1 and letras >= 6 and sig[i] not in GENERICAS):   # una palabra distintiva: «PEI Álgebra»
                                letras -= 50 if j == 1 and j < len(P) else 0
                                k = c["codigo"] or c["clave"]
                                puntos[k] = max(puntos.get(k, (0, c))[0], letras + (100 if j == len(P) else 0)), c
            if puntos:
                mejor = max(x[0] for x in puntos.values())
                ganan = [c for n, c in puntos.values() if n == mejor]
                if len({c["clave"] for c in ganan}) == 1:   # una asignatura (quizá con un código por plan)
                    return max(ganan, key=propio)
            # 3) siglas (iniciales de las palabras significativas), en mayúsculas en el original: «TDS», «PV-PEI»
            sg = {c["codigo"] or c["clave"]: c for c in cands for n in c["nombres"] if len(n["siglas"]) >= 2 and n["siglas"] in orig}
            if len({c["clave"] for c in sg.values()}) == 1:
                return max(sg.values(), key=propio)
        return None


CODIGO_PRUEBA = re.compile(r"\b(PEI ?\d*[A-Z]?|PECL ?\d+|PEC ?\d+|PL ?\d+|PRL|TCL? ?\d+|PE ?\d+|PF|E\d+|PSIM|PLAB|TEST)\b", re.I)
NO_PRUEBA = re.compile(r"fiesta|festivo|no lectivo|vacaciones|clase (?:de )?(?:teoria|practica|laboratorio)|periodo de examenes|cancelad", re.I)


def curso_academico(d):
    a = d.year if d.month >= 9 else d.year - 1
    return f"{a}/{a + 1}"


def pruebas_de(cal, texto, semestres, catalogo, desde, hasta):
    """Pruebas de un .ics entre las fechas desde y hasta. Devuelve (nombre del calendario, nº de eventos, pruebas, descartados)."""
    nombre_cal, eventos = propiedades(texto)
    # calendario de Google de una asignatura: «1-600000-Álgebra…» (cuatrimestre 1..8 del plan) o «1C1-610000 ÁLGEBRA» (curso, C, cuatrimestre)
    mg = re.match(r"^\s*(\d)(?:C(\d))?\s*-\s*(\d{6})\s*[- ]\s*(.+?)\s*$", nombre_cal) if cal["plataforma"] == "google" else None
    out, n, descartes = [], 0, []
    for ev in eventos:
        if "DTSTART" not in ev or ev.get("STATUS", ({}, ""))[1].upper() == "CANCELLED":
            continue
        resumen = desescapar(ev.get("SUMMARY", ({}, ""))[1])
        descripcion = desescapar(ev.get("DESCRIPTION", ({}, ""))[1])
        ini, dia_completo = fecha_ics(*ev["DTSTART"])
        fin = fecha_ics(*ev["DTEND"])[0] if "DTEND" in ev else ini
        dur = fin - ini
        inicios = [x for x in repeticiones(ev, ini, dia_completo, desde, hasta) if desde <= (x if dia_completo else x.date()) <= hasta]
        if not inicios:
            continue
        n += len(inicios)
        txt = eh.sin_acentos(resumen + " " + descripcion)
        # en Google (un calendario por asignatura) hay también clases: sólo lo que tenga aspecto de prueba
        if NO_PRUEBA.search(txt) or (cal["plataforma"] == "google" and not ES_PRUEBA.search(eh.sin_acentos(resumen))):
            descartes.append(resumen)
            continue
        if mg:
            c = catalogo.por_codigo.get(mg.group(3))
            asig = c["nombre"] if c else mg.group(4).title()
            codigo, norm = mg.group(3), c["clave"] if c else eh.nombre_canonico(mg.group(4))
        else:
            c = catalogo.casar(resumen, cal["titulaciones"], cal["curso"]) or catalogo.casar(resumen + " " + descripcion, cal["titulaciones"], cal["curso"])
            asig, codigo, norm = (c["nombre"], c["codigo"], c["clave"]) if c else ("", "", "")
        sems = sorted({s for t in cal["titulaciones"].split("/") for k in (codigo, norm) if k for s in semestres.get((k, t), ())})
        if not sems and mg:
            sems = [int(mg.group(2))] if mg.group(2) else [2 - int(mg.group(1)) % 2]
        siglas = "+".join(dict.fromkeys(re.sub(r"\s+", "", x).upper() for x in CODIGO_PRUEBA.findall(eh.sin_acentos(resumen))))
        uid = ev.get("UID", ({}, ""))[1]
        for i0 in inicios:
            f0 = i0 if dia_completo else i0.date()
            f1 = (i0 + dur - dt.timedelta(days=1)) if dia_completo else (i0 + dur).date()
            out.append({
                "titulaciones": cal["titulaciones"], "curso": cal["curso"], "calendario": nombre_cal,
                "curso_academico": curso_academico(f0), "fecha": f0.isoformat(), "fecha_fin": max(f0, f1).isoformat(),
                "dia": f0.isoweekday(), "hora_inicio": "" if dia_completo else i0.strftime("%H:%M"),
                "hora_fin": "" if dia_completo else (i0 + dur).strftime("%H:%M"), "dia_completo": int(dia_completo),
                "asignatura": asig, "asignatura_norm": norm, "codigo": codigo, "semestre": "/".join(map(str, sems)),
                "prueba": resumen, "sigla": siglas, "tipo": tipo_prueba(resumen + " " + descripcion),
                "descripcion": descripcion, "ubicacion": desescapar(ev.get("LOCATION", ({}, ""))[1]),
                "id": hashlib.sha1(f"{uid}|{f0}|{cal['pagina']}".encode()).hexdigest()[:12], "pagina": cal["pagina"],
            })
    # la misma prueba anotada dos veces el mismo día, de día completo y con hora: se queda la que tiene hora
    con_hora = {(p["fecha"], p["codigo"] or p["prueba"]) for p in out if not p["dia_completo"]}
    out = [p for p in out if not (p["dia_completo"] and (p["fecha"], p["codigo"] or p["prueba"]) in con_hora)]
    return nombre_cal, n, out, descartes


def no_lectivos_de(texto, desde, hasta):
    """Días de un calendario de festivos (p. ej. «Festivos et al. EPS-UAH»): [(fecha, motivo)]."""
    out = []
    for ev in propiedades(texto)[1]:
        if "DTSTART" not in ev:
            continue
        ini, dia_completo = fecha_ics(*ev["DTSTART"])
        fin = fecha_ics(*ev["DTEND"])[0] if "DTEND" in ev else ini
        dias = max(1, (fin - ini).days) if dia_completo else 1
        for i0 in repeticiones(ev, ini, dia_completo, desde, hasta):
            f0 = i0 if dia_completo else i0.date()
            for k in range(dias):
                if desde <= f0 + dt.timedelta(days=k) <= hasta:
                    out.append(((f0 + dt.timedelta(days=k)).isoformat(), desescapar(ev.get("SUMMARY", ({}, ""))[1])))
    return out


def escribir_csv(path, filas, campos):
    with open(path, "w", encoding="utf-8", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=campos, extrasaction="ignore")
        w.writeheader()
        for f in filas:
            w.writerow({k: f.get(k, "") for k in campos})


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--sin-cache", action="store_true", help="vuelve a descargar páginas y calendarios")
    ap.add_argument("--curso", default=curso_academico(dt.date.today()), help="curso académico (p. ej. 2026/2027; por defecto, el actual)")
    ap.add_argument("-v", "--verbose", action="store_true", help="lista los eventos descartados por no ser pruebas")
    args = ap.parse_args()
    usar_cache = not args.sin_cache
    a = int(args.curso[:4])
    desde, hasta = dt.date(a, 9, 1), dt.date(a + 1, 8, 31)
    eh.cargar_alias(); eh.cargar_codigos()

    # semestre de cada asignatura según los horarios: (código o nombre normalizado, sigla) -> {1, 2}
    semestres = {}
    with open(DATA_DIR / "sesiones.csv", encoding="utf-8") as fh:
        for s in csv.DictReader(fh):
            for t in s["titulaciones"].split("/"):
                for k in (s["codigo"], s["asignatura_norm"]):
                    if k:
                        semestres.setdefault((k, t), set()).add(int(s["semestre"]))

    catalogo = Catalogo(); catalogo.cargar()
    cals = inventario(usar_cache)
    pruebas, descartados, no_lectivos = [], [], set()
    for c in cals:
        if not c.get("ics"):
            print(f"  sin .ics: {c['pagina']}", file=sys.stderr)
            continue
        try:
            texto = descargar(c["pagina"] + "_" + hashlib.sha1(c["ics"].encode()).hexdigest()[:8] + ".ics", c["ics"], usar_cache)
        except requests.RequestException as e:
            c["aviso"] = (c.get("aviso", "") + f" no se pudo descargar: {e}").strip()
            print(f"  {c['pagina']}: {e}", file=sys.stderr)
            continue
        c["nombre"], c["eventos"], ps, desc = pruebas_de(c, texto, semestres, catalogo, desde, hasta)
        descartados += [(c["pagina"], d) for d in desc]
        if re.search(r"festivos", c["nombre"], re.I):
            no_lectivos.update(no_lectivos_de(texto, desde, hasta))
            c["aviso"] = (c.get("aviso", "") + " festivos: se usan como días no lectivos").strip()
            continue
        if c["titulaciones"] == "BONO" or re.search(r"calendario acad", c["nombre"], re.I):
            c["aviso"] = (c.get("aviso", "") + " no es de pruebas: se omite").strip()
            continue
        c["pruebas"] = len(ps)
        pruebas += ps
    pruebas.sort(key=lambda p: (p["fecha"], p["hora_inicio"], p["titulaciones"], str(p["curso"]), p["asignatura"]))
    # periodos de clases y exámenes del calendario académico de la UAH (data/periodos.csv, a mano) y días no lectivos
    periodos = [r for r in csv.DictReader(open(DATA_DIR / "periodos.csv", encoding="utf-8"))] if (DATA_DIR / "periodos.csv").exists() else []
    periodos = [r for r in periodos if r["curso_academico"] == args.curso]
    for r in periodos:
        if r["periodo"] == "no_lectivo":
            d = dt.date.fromisoformat(r["desde"])
            while d <= dt.date.fromisoformat(r["hasta"]):
                no_lectivos.add((d.isoformat(), r["descripcion"])); d += dt.timedelta(days=1)
    nl = {}
    for f, motivo in sorted(no_lectivos):
        nl.setdefault(f, []).append(motivo)
    nl = {f: "; ".join(dict.fromkeys(m)) for f, m in nl.items()}
    escribir_csv(DATA_DIR / "no_lectivos.csv", [{"fecha": f, "motivo": m} for f, m in nl.items()], ["fecha", "motivo"])

    escribir_csv(DATA_DIR / "calendarios.csv", cals, ["titulaciones", "curso", "pagina", "url_pagina", "plataforma", "origen", "ics",
                                                       "nombre", "eventos", "pruebas", "aviso"])
    campos = ["titulaciones", "curso", "curso_academico", "fecha", "fecha_fin", "dia", "hora_inicio", "hora_fin", "dia_completo",
              "asignatura", "asignatura_norm", "codigo", "semestre", "prueba", "sigla", "tipo", "descripcion", "ubicacion",
              "calendario", "pagina", "id"]
    escribir_csv(DATA_DIR / "pruebas.csv", pruebas, campos)
    with open(DATA_DIR / "pruebas.json", "w", encoding="utf-8") as fh:
        json.dump([{k: p[k] for k in campos} for p in pruebas], fh, ensure_ascii=False, indent=1)
    web = [{k: p[k] for k in campos if k not in ("asignatura_norm", "calendario", "curso_academico")} for p in pruebas]
    with open(ROOT / "web" / "pruebas.js", "w", encoding="utf-8") as fh:
        fh.write("window.PRUEBAS = ")
        json.dump({"generado": dt.date.today().isoformat(), "curso_academico": args.curso,
                   "calendarios": [{k: c.get(k, "") for k in ("titulaciones", "curso", "url_pagina", "nombre", "pruebas", "aviso")} for c in cals],
                   "periodos": [{k: r[k] for k in ("periodo", "cuatrimestre", "desde", "hasta", "descripcion")} for r in periodos],
                   "no_lectivos": nl, "pruebas": web}, fh, ensure_ascii=False, separators=(",", ":"))

    sin_cod = sorted({f"{p['titulaciones']} {p['curso']}º: {p['prueba']}" for p in pruebas if not p["codigo"]})
    print(f"{len({c['pagina'] for c in cals})} páginas, {sum(1 for c in cals if c.get('ics'))} calendarios .ics, "
          f"{len(pruebas)} pruebas en {args.curso}; {len(sin_cod)} asignaturas sin código")
    for x in sin_cod:
        print("  sin código:", x, file=sys.stderr)
    if args.verbose:
        for pag, d in sorted(set(descartados)):
            print(f"  descartado ({pag[11:40]}…): {d}", file=sys.stderr)
    for c in cals:
        if c.get("aviso"):
            print(f"  aviso {c['pagina']}: {c['aviso']}", file=sys.stderr)


if __name__ == "__main__":
    main()
