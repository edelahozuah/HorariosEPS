#!/usr/bin/env python3
"""Extrae de www.uah.es la información pública de las asignaturas de un plan de estudios
(guías docentes, departamento, profesorado) y la deja en data/ en formato reutilizable.

Fuentes (todas públicas, sin autenticación):

  POST /system/modules/com.saga.uah.frontend/formatters/functions/nuevaUAH/asignaturasEstudio.jsp
       codPlan=G380&idioma=es        -> tabla de asignaturas por curso (la que carga por AJAX la página del grado)
  GET  /es/estudios/estudios-oficiales/grados/asignatura/<Nombre>-<codigo>/
                                     -> ficha: departamento, áreas, planes en que se imparte y pestaña «Profesores»
  GET  /es/estudios/profesor/<Nombre>/   -> ficha del profesor: puesto, categoría, departamento, correo, asignaturas
  POST /system/modules/com.saga.uah.frontend/formatters/functions/mostrarProgramaAsignatura.jsp
       anno=2026-27&codigoPlan=G380&codAsig=350000 -> guía docente en PDF (incrustada en base64)

Uso:
  python3 scripts/extraer_guias.py                      # plan G380 (Grado en Ingeniería Telemática)
  python3 scripts/extraer_guias.py G380 G350 G390 G370  # varios planes; se fusionan en los mismos CSV
  python3 scripts/extraer_guias.py --pdf                # además descarga las guías docentes a guias/<plan>/
  python3 scripts/extraer_guias.py --sin-cache          # ignora cache/guias/ y vuelve a descargar todo

Salida:
  data/guias.csv        una fila por (plan, asignatura): curso, código, nombre, créditos, tipo, periodo, idiomas,
                        departamento, áreas, profesores, URL de la ficha, guía en inglés, PDF local y fecha de aprobación.
  data/profesores.csv   una fila por profesor: puesto, categoría, departamento, área, correo, web y asignaturas.
  data/codigos.csv      código <-> asignatura <-> sigla de titulación, en el formato que lee extraer_horarios.py
                        (así sesiones.csv y asignaturas.csv quedan enlazados con la guía docente).
"""
import argparse
import base64
import csv
import datetime as dt
import json
import re
import sys
import time
from pathlib import Path

import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
CACHE_DIR = ROOT / "cache" / "guias"
GUIAS_DIR = ROOT / "guias"
BASE = "https://www.uah.es"
UA = {"User-Agent": "Mozilla/5.0 (HorariosEPS; +https://github.com/) python-requests"}
PAUSA = 0.4   # segundos entre peticiones

# Código de plan -> sigla usada en los PDF de horarios (cabecera «GRADO EN ... (G380) (GIT)»).
SIGLAS = {"G350": "GITT", "G390": "GIST", "G370": "GIEC", "G380": "GIT", "G781": "GII", "G591": "GIC",
          "G581": "GISI", "G782": "INFOADE", "G60": "GIEAI", "G610": "GITI", "G376": "GIECAI", "G61": "TRV"}
CURSOS = {"primer-curso": "1", "segundo-curso": "2", "tercer-curso": "3", "cuarto-curso": "4",
          "optativas": "OPT", "transversales": "TRV"}

sesion = requests.Session()
sesion.headers.update(UA)


def curso_academico_actual():
    hoy = dt.date.today()
    a = hoy.year if hoy.month >= 7 else hoy.year - 1
    return f"{a}-{str(a + 1)[2:]}"


def descargar(clave, url, datos=None, usar_cache=True):
    """Descarga (o lee de cache/guias/) el texto de una URL. clave: nombre del fichero de caché."""
    f = CACHE_DIR / clave
    if usar_cache and f.exists():
        return f.read_text(encoding="utf-8")
    for intento in range(3):
        try:
            r = sesion.post(url, data=datos, timeout=60) if datos else sesion.get(url, timeout=60)
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


def texto(el):
    return re.sub(r"\s+", " ", el.get_text(" ", strip=True)) if el else ""


# ----------------------------------------------------------------------------- tabla de asignaturas del plan
def tabla_plan(plan, usar_cache):
    html = descargar(f"plan_{plan}.html",
                     f"{BASE}/system/modules/com.saga.uah.frontend/formatters/functions/nuevaUAH/asignaturasEstudio.jsp",
                     {"codPlan": plan, "idioma": "es"}, usar_cache)
    soup = BeautifulSoup(html, "html.parser")
    m = re.search(r"Asignaturas por cursos\s*(\d{4}-\d{2})", soup.get_text(" "))
    anno = m.group(1) if m else curso_academico_actual()
    filas = []
    for panel_id, curso in CURSOS.items():
        panel = soup.find(id=panel_id)
        if not panel:
            continue
        for tr in panel.find_all("tr"):
            tds = tr.find_all("td")
            if len(tds) < 5:
                continue
            a = tds[0].find("a", href=re.compile(r"/asignatura/"))
            if not a:
                continue
            m = re.match(r"(.*?)\s*\((\d+(?:-\d+)?)\)\s*$", texto(a))
            if not m:
                continue
            nombre, codigo = m.group(1), m.group(2)
            guia_en = tds[2].find("a", href=re.compile(r"\.pdf$"))
            # en «Optativas» y «Transversales» la tabla no tiene columna «Tipo»
            tipo = texto(tds[4]) if len(tds) >= 6 else ("Optativa" if curso == "OPT" else "Transversal")
            periodo = texto(tds[5]) if len(tds) >= 6 else texto(tds[4])
            filas.append({
                "plan": plan, "titulacion": SIGLAS.get(plan, plan), "curso_academico": anno, "curso": curso,
                "codigo": codigo, "asignatura": nombre, "creditos": texto(tds[3]),
                "tipo": tipo, "periodo": periodo,
                "semestre": "1" if "1er" in periodo else "2" if "2º" in periodo else "",
                "idiomas": texto(tds[1]).replace(" | ", "; "),
                "url_ficha": BASE + a["href"],
                "url_guia_en": BASE + guia_en["href"] if guia_en else "",
                "guia_es": "javascript:mostrar" in str(tds[2]),
            })
    # nombres en inglés (misma tabla con idioma=en); sirven para casar los grupos en inglés de los horarios
    html_en = descargar(f"plan_{plan}_en.html",
                        f"{BASE}/system/modules/com.saga.uah.frontend/formatters/functions/nuevaUAH/asignaturasEstudio.jsp",
                        {"codPlan": plan, "idioma": "en"}, usar_cache)
    en = {}
    for a in BeautifulSoup(html_en, "html.parser").find_all("a", href=re.compile(r"/asignatura/")):
        m = re.match(r"(.*?)\s*\((\d+(?:-\d+)?)\)\s*$", texto(a))
        if m:
            en[m.group(2)] = m.group(1)
    for f in filas:
        f["asignatura_en"] = en.get(f["codigo"], "")
    return filas


# ----------------------------------------------------------------------------- ficha de la asignatura
def ficha_asignatura(fila, usar_cache):
    html = descargar(f"asig_{fila['codigo']}.html", fila["url_ficha"], usar_cache=usar_cache)
    soup = BeautifulSoup(html, "html.parser")
    out = {"departamento": "", "areas": "", "planes": [], "profesores": []}
    # Cabecera: «Departamentos» / «Áreas de Conocimiento» van como título + lista
    for h in soup.find_all(["h2", "h3", "h4", "strong"]):
        t = texto(h)
        if t in ("Departamentos", "Departamento"):
            out["departamento"] = valores_tras(h)
        elif t in ("Áreas de Conocimiento", "Área de Conocimiento"):
            out["areas"] = valores_tras(h)
    # Pestaña «Estudios»: planes en que se imparte (los que llevan botón «Guía Docente» son los vigentes)
    est = soup.find(id="tab-estudios")
    if est:
        # acordeón: <div id="heading-G380" class="u-accordion__header"> <a>Grado ... (G380)</a> [botones Guía Docente/Guide] </div>
        #           <div id="G380" class="collapse"> Centro / Tipología / Créditos </div>
        for cab in est.find_all("div", class_="u-accordion__header"):
            a = cab.find("a", attrs={"data-toggle": "collapse"})
            m = re.search(r"\((G\d{2,3})\)\s*$", texto(a)) if a else None
            if not m:
                continue
            cont = est.find(id=m.group(1)) or cab.find_next_sibling("div")
            bloque = texto(cont)
            out["planes"].append({
                "plan": m.group(1), "nombre": texto(a).rsplit("(", 1)[0].strip(),
                "tipologia": (re.search(r"Tipología:\s*(.+?)\s*(?:Créditos|$)", bloque) or [None, ""])[1].strip(),
                "creditos": (re.search(r"Créditos:\s*([\d.]+)", bloque) or [None, ""])[1],
                "guia": any("Gu" in texto(b) for b in cab.find_all("a", class_="button")),
            })
    # Pestaña «Profesores»
    prof = soup.find(id="tab-profesores")
    if prof:
        for a in prof.find_all("a", href=re.compile(r"/estudios/profesor/")):
            out["profesores"].append({"nombre": texto(a), "url": BASE + a["href"]})
    return out


def valores_tras(h):
    """Texto de la lista o párrafo que sigue a un título (Departamentos / Áreas)."""
    sig = h.find_next_sibling()
    if sig is None:
        sig = h.parent.find_next_sibling()
    if sig is None:
        return ""
    items = [texto(li) for li in sig.find_all("li")] or [texto(sig)]
    return "; ".join(i for i in items if i)


# ----------------------------------------------------------------------------- ficha del profesor
def ficha_profesor(url, usar_cache):
    clave = "prof_" + url.rstrip("/").rsplit("/", 1)[1] + ".html"
    html = descargar(clave, url, usar_cache=usar_cache)
    soup = BeautifulSoup(html, "html.parser")
    out = {"puesto": "", "categoria": "", "departamento": "", "area": "", "unidad": "", "email": "", "web": "", "docencia_uah": []}
    campos = {"Puesto": "puesto", "Categoría": "categoria", "Departamento": "departamento",
              "Subunidad": "area", "Unidad": "unidad"}
    for li in soup.find_all("li"):
        st = li.find("strong")
        if not st:
            continue
        k = texto(st).rstrip(":").strip()
        if k in campos:
            out[campos[k]] = texto(li)[len(texto(st)):].strip()
    m = re.search(r"fillText\('([^']+@[^']+)'", html)   # el correo se pinta en un <canvas>
    if m:
        out["email"] = m.group(1)
    web = soup.find("a", string=re.compile("gina Web personal"))
    if web is None:
        web = soup.find("a", title=True, href=re.compile(r"^https?://"), string=re.compile("Web"))
    if web:
        out["web"] = web["href"]
    plan = ""
    main = soup.find("main") or soup
    for el in main.find_all(["h3", "h4", "h5", "strong", "a"]):
        t = texto(el)
        m = re.search(r"\((G\d{2,3})\)\s*$", t)
        if m and (el.name != "a" or el.get("data-toggle") == "collapse"):
            plan = m.group(1)
            continue
        if el.name == "a" and "/asignatura/" in (el.get("href") or ""):
            m = re.match(r"(.*?)\s*\((\d+(?:-\d+)?)\)\s*$", t)
            if m:
                out["docencia_uah"].append({"plan": plan, "codigo": m.group(2), "asignatura": m.group(1)})
    return out


# ----------------------------------------------------------------------------- guía docente (PDF)
def descargar_guia(fila):
    destino = GUIAS_DIR / fila["plan"] / f"{fila['codigo']}_{slug(fila['asignatura'])}.pdf"
    if destino.exists():
        return destino
    r = sesion.post(f"{BASE}/system/modules/com.saga.uah.frontend/formatters/functions/mostrarProgramaAsignatura.jsp",
                    data={"anno": fila["curso_academico"], "codigoPlan": fila["plan"], "codAsig": fila["codigo"]}, timeout=120)
    time.sleep(PAUSA)
    m = re.search(r"JVBERi[A-Za-z0-9+/=\s]+", r.text)   # «%PDF» en base64
    if not m:
        return None
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_bytes(base64.b64decode(re.sub(r"\s", "", m.group(0))))
    return destino


def datos_guia_pdf(path):
    """Campos de la portada/cabecera de la guía docente: fecha de aprobación e idioma."""
    out = {"guia_aprobacion": "", "guia_idioma": ""}
    try:
        import pdfplumber
        with pdfplumber.open(path) as pdf:
            t = "\n".join((p.extract_text() or "") for p in pdf.pages[:2])
    except Exception as e:   # pdfplumber ausente o PDF ilegible
        print(f"  no se pudo leer {path.name}: {e}", file=sys.stderr)
        return out
    m = re.search(r"Aprobada en Junta de Escuela de la EPS el día (\d{1,2} de \w+ de \d{4})", t)
    if m:
        out["guia_aprobacion"] = m.group(1)
    m = re.search(r"Idioma en el que se imparte:\s*(.+)", t)
    if m:
        out["guia_idioma"] = m.group(1).strip()
    return out


def slug(s):
    import unicodedata
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return re.sub(r"[^A-Za-z0-9]+", "-", s).strip("-")


# ----------------------------------------------------------------------------- CSV con fusión por planes
def leer_csv(path):
    if not path.exists():
        return []
    with open(path, encoding="utf-8", newline="") as fh:
        return list(csv.DictReader(fh))


def escribir_csv(path, filas, campos):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=campos, extrasaction="ignore")
        w.writeheader()
        for f in filas:
            w.writerow({k: f.get(k, "") for k in campos})


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("planes", nargs="*", default=["G380"], help="códigos de plan (por defecto G380)")
    ap.add_argument("--pdf", action="store_true", help="descarga las guías docentes en PDF a guias/<plan>/")
    ap.add_argument("--sin-cache", action="store_true", help="vuelve a descargar las páginas aunque estén en cache/guias/")
    ap.add_argument("--sin-profesores", action="store_true", help="no visita las fichas de los profesores")
    ap.add_argument("--transversales", action="store_true", help="incluye la pestaña «Transversales» (asignaturas de toda la UAH)")
    args = ap.parse_args()
    usar_cache = not args.sin_cache

    guias, profesores = [], {}
    for plan in args.planes:
        print(f"== Plan {plan} ({SIGLAS.get(plan, '?')})")
        filas = tabla_plan(plan, usar_cache)
        if not args.transversales:
            filas = [f for f in filas if f["curso"] != "TRV"]
        print(f"  {len(filas)} asignaturas en la tabla")
        for f in filas:
            ficha = ficha_asignatura(f, usar_cache)
            f["departamento"] = ficha["departamento"]
            f["areas"] = ficha["areas"]
            propio = next((p for p in ficha["planes"] if p["plan"] == plan), None)
            f["tipologia"] = propio["tipologia"] if propio else ""
            f["planes_compartidos"] = "; ".join(sorted({p["plan"] for p in ficha["planes"] if p["guia"] and p["plan"] != plan}))
            f["profesores"] = "; ".join(p["nombre"] for p in ficha["profesores"])
            f["n_profesores"] = len(ficha["profesores"])
            for p in ficha["profesores"]:
                profesores.setdefault(p["url"], {"profesor": p["nombre"], "url": p["url"], "imparte": set()})
                profesores[p["url"]]["imparte"].add((plan, f["codigo"], f["asignatura"]))
            f["guia_pdf"] = ""
            f.update({"guia_aprobacion": "", "guia_idioma": ""})
            if args.pdf and f["guia_es"]:
                pdf = descargar_guia(f)
                if pdf:
                    f["guia_pdf"] = str(pdf.relative_to(ROOT))
                    f.update(datos_guia_pdf(pdf))
                else:
                    print(f"  sin guía PDF: {f['codigo']} {f['asignatura']}", file=sys.stderr)
            print(f"  {f['curso']:>3} {f['codigo']} {f['asignatura'][:45]:<45} {f['n_profesores']} prof.  {f['departamento'][:40]}")
            guias.append(f)

    if not args.sin_profesores:
        print(f"== {len(profesores)} profesores")
        for url, p in profesores.items():
            try:
                p.update(ficha_profesor(url, usar_cache))
            except requests.RequestException as e:
                print(f"  error en {url}: {e}", file=sys.stderr)
    for p in profesores.values():
        p["asignaturas"] = "; ".join(f"{c} {n} ({pl})" for pl, c, n in sorted(p["imparte"], key=lambda x: (x[2], x[0])))
        p["codigos"] = "; ".join(sorted({c for _, c, _ in p["imparte"]}))
        p["planes"] = "; ".join(sorted({pl for pl, _, _ in p["imparte"]}))
        p["asignaturas_uah"] = "; ".join(f"{a['codigo']} {a['asignatura']} ({a['plan']})" for a in p.get("docencia_uah", []))

    # --- fusión con lo que ya hubiera de otros planes
    campos_g = ["plan", "titulacion", "curso_academico", "curso", "codigo", "asignatura", "asignatura_en", "creditos", "tipo", "tipologia",
                "periodo", "semestre", "idiomas", "departamento", "areas", "planes_compartidos", "n_profesores", "profesores",
                "url_ficha", "url_guia_en", "guia_pdf", "guia_aprobacion", "guia_idioma"]
    previas = [g for g in leer_csv(DATA_DIR / "guias.csv") if g["plan"] not in args.planes]
    todas = previas + guias
    orden = {c: i for i, c in enumerate(["1", "2", "3", "4", "OPT", "TRV"])}
    todas.sort(key=lambda g: (g["plan"], orden.get(g["curso"], 9), g.get("semestre", ""), g["asignatura"]))
    escribir_csv(DATA_DIR / "guias.csv", todas, campos_g)
    with open(DATA_DIR / "guias.json", "w", encoding="utf-8") as fh:
        json.dump([{k: g.get(k, "") for k in campos_g} for g in todas], fh, ensure_ascii=False, indent=1)

    campos_p = ["profesor", "puesto", "categoria", "departamento", "area", "email", "web", "url", "planes", "codigos",
                "asignaturas", "asignaturas_uah"]
    previas_p = {p["url"]: p for p in leer_csv(DATA_DIR / "profesores.csv")}
    for url, p in profesores.items():
        q = previas_p.get(url)
        if q:   # une las asignaturas de otros planes ya guardadas
            for k in ("planes", "codigos", "asignaturas"):
                p[k] = "; ".join(sorted(set(filter(None, (q.get(k, "") + "; " + p[k]).split("; ")))))
        previas_p[url] = p
    todos_p = sorted(previas_p.values(), key=lambda p: p["profesor"].split()[-2:] if len(p["profesor"].split()) > 1 else p["profesor"])
    escribir_csv(DATA_DIR / "profesores.csv", todos_p, campos_p)

    # --- data/codigos.csv para extraer_horarios.py (codigo, asignatura, titulaciones)
    codigos = {(c["codigo"], c["asignatura"]): c for c in leer_csv(DATA_DIR / "codigos.csv")}
    for g in guias:
        for nombre in filter(None, {g["asignatura"], g["asignatura_en"]}):   # una fila por nombre (español e inglés)
            k = (g["codigo"], nombre)
            c = codigos.setdefault(k, {"codigo": g["codigo"], "asignatura": nombre, "titulaciones": ""})
            tits = set(filter(None, c["titulaciones"].split("/")))
            tits.add(g["titulacion"])
            c["titulaciones"] = "/".join(sorted(tits))
    escribir_csv(DATA_DIR / "codigos.csv", sorted(codigos.values(), key=lambda c: (c["asignatura"], c["codigo"])),
                 ["codigo", "asignatura", "titulaciones"])

    print(f"TOTAL: {len(todas)} asignaturas en guias.csv, {len(todos_p)} profesores, {len(codigos)} códigos")


if __name__ == "__main__":
    main()
