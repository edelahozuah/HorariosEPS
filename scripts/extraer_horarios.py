#!/usr/bin/env python3
"""
Extrae los horarios de los grados de la EPS (UAH) a partir de los PDF publicados en
https://escuelapolitecnica.uah.es/es/estudiantes/horarios/

Uso:
    python3 scripts/extraer_horarios.py --descargar   # lee la web, guarda data/fuentes.csv y baja los PDF a pdfs/
    python3 scripts/extraer_horarios.py               # procesa los PDF listados en data/fuentes.csv -> data/
    python3 scripts/extraer_horarios.py --solo GITT GIST   # filtra por sigla de titulación (según nombre de fichero)

Salida (en data/):
    fuentes.csv       PDF encontrados en la web: rama, titulación (texto de la web), cuatrimestre y URL
    franjas.csv       una fila por franja horaria (hora) y por ítem de celda
    sesiones.csv      franjas consecutivas del mismo ítem fusionadas en sesiones
    sesiones.json     lo mismo en JSON
    asignaturas.csv   catálogo de asignaturas (nombre normalizado, variantes, grupos, aulas)
    aulas.csv         catálogo de aulas con horas semanales ocupadas por cuatrimestre
    avisos.txt        textos no interpretados / anomalías para revisión manual
"""
import argparse, csv, html, json, re, sys, unicodedata, urllib.request
from collections import defaultdict, OrderedDict
from pathlib import Path

import pdfplumber

ROOT = Path(__file__).resolve().parent.parent
PDF_DIR = ROOT / "pdfs"
DATA_DIR = ROOT / "data"
URL_WEB = "https://escuelapolitecnica.uah.es/es/estudiantes/horarios/"
NO_SOPORTADOS = ("MUIT", "MUII")   # másteres: plantilla distinta, no se procesan

DIAS = {"LUNES": 1, "MARTES": 2, "MIÉRCOLES": 3, "MIERCOLES": 3, "JUEVES": 4, "VIERNES": 5}
DIA_NOMBRE = {1: "Lunes", 2: "Martes", 3: "Miércoles", 4: "Jueves", 5: "Viernes"}

# ---------------------------------------------------------------------------
# Web: lista de PDF
# ---------------------------------------------------------------------------
def limpiar_html(s):
    return html.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", s))).strip()

def leer_fuentes_web():
    pagina = urllib.request.urlopen(URL_WEB, timeout=60).read().decode("utf-8", "ignore")
    fuentes = []
    # cada desplegable es un <div id="X" class="collapse ..."> precedido por su cabecera con id="accordion-X"
    for m in re.finditer(r'id="accordion-([\w-]+)">(.*?)<span', pagina, re.S):
        clave, rama = m.group(1), limpiar_html(m.group(2))
        cuerpo = re.search(r'<div id="%s" class="collapse.*?(?=<!-- Card -->|<div id="h-)' % re.escape(clave), pagina, re.S)
        if not cuerpo:
            continue
        for fila in re.finditer(r"<tr.*?</tr>", cuerpo.group(0), re.S):
            celdas = re.findall(r"<td.*?</td>", fila.group(0), re.S)
            if len(celdas) < 2:
                continue
            titulacion = limpiar_html(celdas[0])
            for ncuat, celda in enumerate(celdas[1:], 1):
                for href in re.findall(r'href="([^"]+\.pdf)"', celda, re.I):
                    url = href if href.startswith("http") else "https://escuelapolitecnica.uah.es" + href
                    fuentes.append({"fichero": url.rsplit("/", 1)[-1], "rama": rama, "titulacion_web": titulacion,
                                    "cuatrimestre_web": ncuat, "url": url})
    return fuentes

# ---------------------------------------------------------------------------
# Normalización de nombres de asignatura
# ---------------------------------------------------------------------------
def sin_acentos(s):
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")

def clave(s):
    s = sin_acentos(s).upper()
    s = re.sub(r"[^A-Z0-9 ]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()

# Abreviaturas que aparecen en los PDF -> nombre canónico (clave sin acentos). Ampliar según aparezcan.
ALIAS = {
    "ARQ DE REDES I": "ARQUITECTURA DE REDES I",
    "ARQ DE REDES II": "ARQUITECTURA DE REDES II",
    "ARQ REDES II": "ARQUITECTURA DE REDES II",
    "COMUN OPTICAS": "COMUNICACIONES OPTICAS",
    "ELECT DE CIRCUITOS": "ELECTRONICA DE CIRCUITOS",
    "ELECT DE POTENCIA": "ELECTRONICA DE POTENCIA",
    "ELECT BIOMEDICA": "ELECTRONICA BIOMEDICA",
    "INSTRUM ELECTRONICA": "INSTRUMENTACION ELECTRONICA",
    "LAB DE REDES SIST Y SERVICIOS": "LABORATORIO DE REDES SISTEMAS Y SERVICIOS",
    "LAB DE REDES SISTEMAS Y SERVICIOS": "LABORATORIO DE REDES SISTEMAS Y SERVICIOS",
    "PROG AVANZADA": "PROGRAMACION AVANZADA",
    "PROG VISUAL": "PROGRAMACION VISUAL",
    "PROGRAM VISUAL": "PROGRAMACION VISUAL",
    "RAD Y RADIOCOMUNICACION": "RADIACION Y RADIOCOMUNICACION",
    "RUIDO E INTERF EN SISTEMAS ELECTRONICOS": "RUIDO E INTERFERENCIAS EN SISTEMAS ELECTRONICOS",
    "SIST INTELIG Y SOST DE NUEVA GENERACION": "SISTEMAS INTELIGENTES Y SOSTENIBLES DE NUEVA GENERACION",
    "SIST INTELIGENTES Y SOSTENIBLES DE NUEVA GENERACION": "SISTEMAS INTELIGENTES Y SOSTENIBLES DE NUEVA GENERACION",
    "SUBSIST ELECTRONICOS": "SUBSISTEMAS ELECTRONICOS",
    "TECN DE REDES Y SERV TELEM": "TECNOLOGIAS DE REDES Y SERVICIOS TELEMATICOS",
    "TECN DE SIST DE TELECOMUNICACION": "TECNOLOGIAS DE SISTEMAS DE TELECOMUNICACION",
    "TECN EN SIST ELECT": "TECNOLOGIAS EN SISTEMAS ELECTRONICOS",
    "TECN FOTONICAS": "TECNOLOGIAS FOTONICAS",
    "TECN INALAMBRICAS": "TECNOLOGIAS INALAMBRICAS",
    "TEORIA DE LA COMUN": "TEORIA DE LA COMUNICACION",
}
_ALIAS_EXTRA = ROOT / "data" / "alias.csv"   # opcional: clave,canonico (una por línea) para ampliar sin tocar código

def cargar_alias():
    if _ALIAS_EXTRA.exists():
        with open(_ALIAS_EXTRA, encoding="utf-8") as fh:
            for fila in csv.reader(fh):
                if len(fila) >= 2 and fila[0] and not fila[0].startswith("#"):
                    ALIAS[clave(fila[0])] = clave(fila[1])

CODIGOS_ASIG = {}   # (asignatura_norm, sigla o "") -> codigo; se carga de data/codigos.csv
_CODIGOS_CSV = ROOT / "data" / "codigos.csv"

def cargar_codigos():
    """data/codigos.csv: columnas codigo, asignatura (nombre o variante) y opcionalmente titulaciones (siglas separadas por /).
    Si una asignatura tiene códigos distintos según titulación, se añade una fila por titulación."""
    if not _CODIGOS_CSV.exists():
        return
    with open(_CODIGOS_CSV, encoding="utf-8") as fh:
        for fila in csv.DictReader(fh):
            cod = (fila.get("codigo") or "").strip()
            if not cod:
                continue
            k = nombre_canonico(fila.get("asignatura", ""))
            tits = [t.strip() for t in (fila.get("titulaciones") or "").split("/") if t.strip()] or [""]
            for t in tits:
                CODIGOS_ASIG[(k, t)] = cod

def codigo_de(asignatura_norm, titulaciones):
    for t in titulaciones.split("/"):
        if (asignatura_norm, t) in CODIGOS_ASIG:
            return CODIGOS_ASIG[(asignatura_norm, t)]
    return CODIGOS_ASIG.get((asignatura_norm, ""), "")

def nombre_canonico(raw):
    k = clave(raw)
    return ALIAS.get(k, k)

# ---------------------------------------------------------------------------
# Parser de celdas
# ---------------------------------------------------------------------------
# Un ítem: "<asignatura> [-] <grupo> [-] [TUTORÍA|(PC)] [(SIGLA)] [→ <grupo destino> [(SIGLA)|SIGLA]] (<aulas>)"
# El guión entre asignatura y grupo falta en algunos PDF (GMC, GIECAI, INFOADE).
GRUPO = r"(?:\d[A-Z]{1,3}\d?(?:-[A-Z]\d)?|ECO[MT]\d)(?:\s*[/-]\s*(?:\d[A-Z]{1,3}\d?|G))*"
FLECHA = r"(?:→||->|=>)"
ITEM_RE = re.compile(
    r"(?P<asig>.+?)(?:\s*[-–—]\s*|\s+)"
    r"(?P<grupo>" + GRUPO + r")(?![A-Za-z0-9])"
    r"(?:\s*-(?![A-Z0-9]))?"
    r"(?:\s*(?P<extra>TUTORÍA|TUTORIA|\(PC\)))?"
    r"(?:\s*\(?(?P<tit>[A-Z]{3,8})\)?(?=\s*[(→]))?"
    r"(?:\s*" + FLECHA + r"\s*-?\s*(?P<ref>" + GRUPO + r"(?:\s*\(?[A-Z]{3,8}\)?)?))?"
    r"(?:\s*\((?P<aulas>[^)]*)\))?",      # sin aula: asignaturas de ADE impartidas en otra facultad (INFOADE)
)
MARCADORES = {"FESTIVO", "FESTIVOS", "NO LECTIVO"}   # celdas sin docencia
AULA_RE = re.compile(r"^[A-Z]{2}\d{1,2}[A-Z]?$")

def parse_celda(texto):
    """Devuelve (items, restos). items: lista de dicts; restos: fragmentos no interpretados."""
    t = re.sub(r"\s+", " ", texto.replace("\n", " ")).strip()
    if t.upper() in MARCADORES:
        return [], []
    asterisco = "(*)" in t
    t = t.replace("(*)", " ").strip()
    t = re.sub(r"(\d)ª", r"\1A", t)          # errata "2ª" -> "2A"
    t = re.sub(r"\s+", " ", t)
    items, restos, pos = [], [], 0
    for m in ITEM_RE.finditer(t):
        pre = t[pos:m.start()].strip(" ,;")
        if pre:
            if items:
                items[-1]["nota"] = (items[-1]["nota"] + " " + pre).strip()
            else:
                restos.append(pre)
        asig = m.group("asig").strip(" -–—")
        grupo = m.group("grupo")
        partes = re.split(r"\s*[/-]\s*", grupo)
        if len(partes) > 1 and all(re.match(r"^(\d[A-Z]{1,3}\d?|G|ECO[MT]\d)$", x) for x in partes):
            grupo = "/".join(dict.fromkeys(partes))      # "3A1- 3A1-3A2" -> "3A1/3A2"
        aulas_raw = (m.group("aulas") or "").strip()
        aulas = [re.sub(r"^([A-Z]{2})0(\d)$", r"\1\2", a.strip()) for a in re.split(r"[/-]", aulas_raw) if a.strip()]  # EL06 -> EL6
        aulas_validas = [a for a in aulas if AULA_RE.match(a)]
        nota_aula = ""
        if not aulas_validas and re.match(r"^(?:[A-Z]{3,8}(?:\s*[-–]\s*.+)?|\d{1,2}[:.]\d{2}.*|\d{1,2}-\d{1,2})$", aulas_raw):
            nota_aula, aulas_raw = "(" + aulas_raw + ")", ""   # el paréntesis no era un aula: sigla de titulación u hora
        grupo_base = grupo.split("/")[0]
        es_grande = not re.search(r"\d$", grupo_base) or grupo_base.startswith("ECO")
        nota = " ".join(x for x in (m.group("extra"), ("(" + m.group("tit") + ")") if m.group("tit") else None,
                                   ("→ " + re.sub(r"\s+", " ", m.group("ref")).strip()) if m.group("ref") else None,
                                   nota_aula or None, "(*)" if asterisco else None) if x)
        items.append({
            "asignatura": asig,
            "asignatura_norm": nombre_canonico(asig),
            "grupo": grupo,
            "tipo_grupo": "grande" if es_grande else "pequeño",
            "asignatura_mayusculas": asig.upper() == asig,
            "aulas": aulas_validas,
            "aulas_raw": aulas_raw,
            "nota": nota,
        })
        pos = m.end()
    tail = t[pos:].strip(" ,;")
    if tail:
        if items:
            items[-1]["nota"] = (items[-1]["nota"] + " " + tail).strip()
        else:
            restos.append(tail)
    return items, restos

# ---------------------------------------------------------------------------
# Cabecera de página
# ---------------------------------------------------------------------------
HDR_RE = re.compile(
    r"CUATRIMESTRE\s+(?P<cuat>\d+)º\s*\(Curso\s+(?P<curso>\d)º(?:\s*y\s*(?P<curso2>\d)º)?,\s*Semestre\s+(?P<sem>\d)º"
    r"(?:,\s*(?P<semana>.+?))?\s*\)\s*(?:\([^)]*\)\s*)?"
    r"Curso\s+(?P<anio>\d{4}[/-]\d{2,4})\s*GRUPO\s+(?P<grupo>\dº?[A-Z]\w*)"
)
TIT_RE = re.compile(r"(?P<nombre>(?:DOBLE\s+)?GRADO EN .+?|OPTATIVIDAD TRANSVERSAL)\s*(?:\((?P<codigo>G\d{2,3})\)\s*)?\((?P<sigla>[A-Z]{3,8})\)")

TITULACIONES = {}   # sigla -> {"nombre", "codigo"}; se rellena al leer cabeceras (para la app web / impresión)

def parse_cabecera(lineas):
    texto = " ".join(l.strip() for l in lineas)
    texto = re.sub(r"\bEscuela Politécnica\b|\bSuperior\b|^\d+\s+", " ", texto)
    tits = [{"sigla": m.group("sigla"), "codigo": m.group("codigo") or "", "nombre": re.sub(r"\s+", " ", m.group("nombre")).strip()}
            for m in TIT_RE.finditer(texto)]
    for t in tits:
        TITULACIONES.setdefault(t["sigla"], {"nombre": t["nombre"], "codigo": t["codigo"]})
        if t["codigo"] and not TITULACIONES[t["sigla"]]["codigo"]:
            TITULACIONES[t["sigla"]]["codigo"] = t["codigo"]
    m = HDR_RE.search(texto)
    if not m or not tits:
        raise ValueError("Cabecera no reconocida: " + texto[:200])
    meta = m.groupdict()
    return tits, meta

# ---------------------------------------------------------------------------
# Procesado
# ---------------------------------------------------------------------------
def hora(s):
    m = re.match(r"^\D?(\d{1,2})[:_.](\d{2})\s*/\s*(\d{1,2})[:_.](\d{2})$", s.strip())
    if not m:
        return None
    # cada fila es una franja de una hora; la hora de fin se normaliza a hh:55
    return f"{int(m.group(1)):02d}:00", f"{int(m.group(1)):02d}:55"

def procesar_pdf(path, fuente, avisos):
    """Agrupa las filas de cada hoja de horario (que puede ocupar varias páginas) y las parsea."""
    franjas = []
    hojas = []   # [(tits, meta, dias, aprob, filas, paginas)]
    with pdfplumber.open(path) as pdf:
        for npag, page in enumerate(pdf.pages, 1):
            texto = page.extract_text() or ""
            lineas = [l for l in texto.split("\n") if l.strip()]
            k = next((i for i, l in enumerate(lineas) if l.startswith("HORA")), None)
            tablas = page.extract_tables()
            if not tablas:
                avisos.append(f"{path.name} p{npag}: sin tabla, página ignorada"); continue
            aprob = next((l for l in lineas if l.startswith("Aprobado")), "")
            # una página puede contener el final de una hoja (tabla sin cabecera) y el inicio de otra (tabla con HORA)
            for tabla in tablas:
                cab = [(c or "").strip().upper() for c in tabla[0]]
                if cab[0] == "HORA":
                    if k is None:
                        avisos.append(f"{path.name} p{npag}: tabla con HORA pero sin cabecera de texto, ignorada"); continue
                    tits, meta = parse_cabecera(lineas[:k])
                    dias = [DIAS.get(c) for c in cab[1:]]
                    hojas.append([tits, meta, dias, aprob, [], [npag]])
                    filas = tabla[1:]
                else:
                    if not hojas:
                        avisos.append(f"{path.name} p{npag}: tabla sin cabecera y sin contexto previo, ignorada"); continue
                    if npag not in hojas[-1][5]:
                        hojas[-1][5].append(npag)
                    if aprob and not hojas[-1][3]:
                        hojas[-1][3] = aprob
                    filas = tabla
                acum = hojas[-1][4]
                for fila in filas:
                    h = hora(fila[0] or "") if fila[0] else None
                    celdas = [(c or "").strip() for c in fila[1:]]
                    if h is not None:
                        acum.append([h, celdas, npag])
                    elif acum and not (fila[0] or "").strip():
                        # subfila o continuación de celda (misma hora): se concatena a la fila anterior
                        for i, c in enumerate(celdas):
                            if c:
                                acum[-1][1][i] = (acum[-1][1][i] + " " + c).strip()
                    elif any(celdas) or (fila[0] or "").strip():
                        avisos.append(f"{path.name} p{npag}: fila sin hora reconocible {fila[0]!r}, ignorada: {[c[:30] for c in celdas]}")

    for tits, meta, dias, aprob, filas, paginas in hojas:
        for (hini, hfin), celdas, npag in filas:
            for dia, celda in zip(dias, celdas):
                if not celda or dia is None:
                    continue
                items, restos = parse_celda(celda)
                for r in restos:
                    avisos.append(f"{path.name} p{npag} {meta['grupo']} {DIA_NOMBRE[dia]} {hini}: texto no interpretado: {r!r}")
                for it in items:
                    franjas.append({
                        "rama": fuente.get("rama", ""), "titulacion_web": fuente.get("titulacion_web", ""),
                        "fichero": path.name, "pagina": npag, "paginas_hoja": "-".join(map(str, paginas)),
                        "titulaciones": "/".join(t["sigla"] for t in tits),
                        "codigos": "/".join(t["codigo"] for t in tits),
                        "curso_academico": meta["anio"],
                        "curso": int(meta["curso"]), "semestre": int(meta["sem"]),
                        "cuatrimestre": int(meta["cuat"]), "semana": meta.get("semana") or "",
                        "grupo_horario": meta["grupo"].replace("º", ""),
                        "dia": dia, "dia_nombre": DIA_NOMBRE[dia],
                        "hora_inicio": hini, "hora_fin": hfin,
                        **it,
                        "codigo": codigo_de(it["asignatura_norm"], "/".join(t["sigla"] for t in tits)),
                        "aulas": "/".join(it["aulas"]),
                        "aprobacion": aprob.replace("Aprobado en Junta de Escuela", "").strip(" .con fecha"),
                    })
    return franjas

def fusionar(franjas):
    """Une franjas consecutivas (misma hoja de horario, día e ítem) en sesiones."""
    key = lambda f: (f["fichero"], f["titulaciones"], f["curso"], f["semestre"], f["semana"], f["grupo_horario"],
                     f["dia"], f["asignatura_norm"], f["grupo"], f["aulas"], f["nota"])
    por_clave = defaultdict(list)
    for f in franjas:
        por_clave[key(f)].append(f)
    sesiones = []
    for fs in por_clave.values():
        fs.sort(key=lambda f: f["hora_inicio"])
        actual = None
        for f in fs:
            if actual and int(f["hora_inicio"][:2]) == int(actual["hora_fin"][:2]) + 1:
                actual["hora_fin"] = f["hora_fin"]; actual["horas"] += 1
            else:
                actual = dict(f); actual["horas"] = 1
                sesiones.append(actual)
    sesiones.sort(key=lambda s: (s["rama"], s["titulaciones"], s["curso"], s["semestre"], s["semana"], s["grupo_horario"],
                                 s["dia"], s["hora_inicio"], s["asignatura_norm"], s["grupo"]))
    return sesiones

def escribir_csv(path, filas, campos):
    with open(path, "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=campos, extrasaction="ignore")
        w.writeheader(); w.writerows(filas)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--descargar", action="store_true", help="lee la web, guarda data/fuentes.csv y descarga los PDF")
    ap.add_argument("--solo", nargs="*", help="procesar solo ficheros cuyo nombre contenga alguna de estas cadenas")
    args = ap.parse_args()
    PDF_DIR.mkdir(exist_ok=True); DATA_DIR.mkdir(exist_ok=True)
    cargar_alias(); cargar_codigos()

    fuentes_csv = DATA_DIR / "fuentes.csv"
    if args.descargar:
        fuentes = leer_fuentes_web()
        escribir_csv(fuentes_csv, fuentes, ["rama", "titulacion_web", "cuatrimestre_web", "fichero", "url"])
        for f in fuentes:
            print("descargando", f["fichero"])
            urllib.request.urlretrieve(f["url"], PDF_DIR / f["fichero"])
    elif fuentes_csv.exists():
        with open(fuentes_csv, encoding="utf-8") as fh:
            fuentes = list(csv.DictReader(fh))
    else:
        fuentes = [{"fichero": p.name} for p in sorted(PDF_DIR.glob("*.pdf"))]

    avisos, franjas = [], []
    for fu in fuentes:
        name = fu["fichero"]
        if args.solo and not any(s in name for s in args.solo):
            continue
        if any(s in name.upper() for s in NO_SOPORTADOS):
            avisos.append(f"{name}: plantilla de máster no soportada, omitido"); continue
        p = PDF_DIR / name
        if not p.exists():
            avisos.append(f"falta {name} (usa --descargar)"); continue
        n0 = len(avisos)
        try:
            fr = procesar_pdf(p, fu, avisos)
        except Exception as e:
            avisos.append(f"{name}: ERROR {e}"); print(f"{name}: ERROR {e}"); continue
        franjas += fr
        print(f"{name}: {len(fr)} franjas, {len(avisos) - n0} avisos")

    campos = ["rama", "titulacion_web", "titulaciones", "codigos", "curso_academico", "curso", "semestre", "cuatrimestre", "semana",
              "grupo_horario", "dia", "dia_nombre", "hora_inicio", "hora_fin", "codigo", "asignatura_norm", "asignatura", "grupo",
              "tipo_grupo", "asignatura_mayusculas", "aulas", "aulas_raw", "nota", "fichero", "pagina", "paginas_hoja", "aprobacion"]
    escribir_csv(DATA_DIR / "franjas.csv", franjas, campos)
    sesiones = fusionar(franjas)
    i = campos.index("hora_fin") + 1
    escribir_csv(DATA_DIR / "sesiones.csv", sesiones, campos[:i] + ["horas"] + campos[i:])
    with open(DATA_DIR / "sesiones.json", "w", encoding="utf-8") as fh:
        json.dump(sesiones, fh, ensure_ascii=False, indent=1)

    # catálogo de asignaturas
    asig = OrderedDict()
    for f in franjas:
        a = asig.setdefault(f["asignatura_norm"], {"asignatura_norm": f["asignatura_norm"], "codigo": set(), "variantes": set(),
                                                   "titulaciones": set(), "curso": set(), "semestre": set(),
                                                   "grupos_grandes": set(), "grupos_pequeños": set(), "aulas": set(), "horas_semana": 0})
        a["variantes"].add(f["asignatura"]); a["titulaciones"].add(f["titulaciones"])
        if f["codigo"]: a["codigo"].add(f["codigo"])
        a["curso"].add(str(f["curso"])); a["semestre"].add(str(f["semestre"]))
        (a["grupos_grandes"] if f["tipo_grupo"] == "grande" else a["grupos_pequeños"]).add(f["grupo"])
        a["aulas"].update(f["aulas"].split("/") if f["aulas"] else [])
        a["horas_semana"] += 1
    filas = [{k: ("; ".join(sorted(v)) if isinstance(v, set) else v) for k, v in a.items()}
             for a in sorted(asig.values(), key=lambda a: a["asignatura_norm"])]
    escribir_csv(DATA_DIR / "asignaturas.csv", filas, list(filas[0].keys()))
    if not _CODIGOS_CSV.exists():   # plantilla para rellenar los códigos a mano
        escribir_csv(DATA_DIR / "codigos_plantilla.csv",
                     [{"codigo": "", "asignatura": a["asignatura_norm"], "titulaciones": "", "variantes": a["variantes"],
                       "titulaciones_horario": a["titulaciones"], "curso": a["curso"], "semestre": a["semestre"]} for a in filas],
                     ["codigo", "asignatura", "titulaciones", "variantes", "titulaciones_horario", "curso", "semestre"])
    sin_codigo = [a["asignatura_norm"] for a in filas if not a["codigo"]]
    if _CODIGOS_CSV.exists() and sin_codigo:
        avisos.append(f"{len(sin_codigo)} asignaturas sin código en data/codigos.csv: " + "; ".join(sin_codigo))

    # catálogo de aulas
    aulas = defaultdict(lambda: {"horas_semana_s1": 0, "horas_semana_s2": 0, "titulaciones": set(), "asignaturas": set()})
    for f in franjas:
        for a in (f["aulas"].split("/") if f["aulas"] else []):
            aulas[a][f"horas_semana_s{f['semestre']}"] += 1
            aulas[a]["titulaciones"].add(f["titulaciones"]); aulas[a]["asignaturas"].add(f["asignatura_norm"])
    filas = [{"aula": a, "edificio": a[0], "tipo": {"A": "aula", "L": "laboratorio"}.get(a[1], "?"),
              **{k: ("; ".join(sorted(v)) if isinstance(v, set) else v) for k, v in d.items()}}
             for a, d in sorted(aulas.items())]
    escribir_csv(DATA_DIR / "aulas.csv", filas, list(filas[0].keys()))

    # datos para la aplicación web (web/data.js): campos mínimos, cargable desde file://
    WEB_DIR = ROOT / "web"; WEB_DIR.mkdir(exist_ok=True)
    campos_web = ["rama", "titulacion_web", "titulaciones", "curso", "semestre", "cuatrimestre", "semana", "grupo_horario",
                  "dia", "hora_inicio", "hora_fin", "horas", "codigo", "asignatura", "asignatura_norm", "grupo", "tipo_grupo",
                  "aulas", "aulas_raw", "nota", "fichero", "pagina", "curso_academico", "aprobacion"]
    web = [{k: s[k] for k in campos_web} for s in sesiones]
    with open(WEB_DIR / "data.js", "w", encoding="utf-8") as fh:
        fh.write("window.HORARIOS = ")
        json.dump({"generado": __import__("datetime").date.today().isoformat(), "titulaciones": TITULACIONES, "sesiones": web}, fh, ensure_ascii=False, separators=(",", ":"))
        fh.write(";\n")

    (DATA_DIR / "avisos.txt").write_text("\n".join(avisos) + "\n", encoding="utf-8")
    print(f"TOTAL: {len(franjas)} franjas, {len(sesiones)} sesiones, {len(asig)} asignaturas, {len(aulas)} aulas, {len(avisos)} avisos")

if __name__ == "__main__":
    main()
