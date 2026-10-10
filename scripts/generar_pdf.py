#!/usr/bin/env python3
"""
Genera PDF con el formato de los horarios de la EPS a partir de web/imprimir.html (Chrome headless).

Ejemplos:
    python3 scripts/generar_pdf.py --titulacion GIST --curso 3 --sem 1            # todas las hojas (grupos) -> salida/
    python3 scripts/generar_pdf.py --titulacion GIST --curso 3 --sem 1 --grupo 3B
    python3 scripts/generar_pdf.py --aula EA6 --sem 1
    python3 scripts/generar_pdf.py --todo                                          # un PDF por titulación/curso/cuatrimestre y uno por aula
    python3 scripts/generar_pdf.py --url "tipo=aula&aula=OL5" -o salida/OL5.pdf    # cualquier query de imprimir.html
"""
import argparse, json, re, shutil, subprocess, sys, urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WEB = ROOT / "web"
CHROMES = ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/Applications/Chromium.app/Contents/MacOS/Chromium",
           "google-chrome", "chromium", "chromium-browser", "chrome"]

def chrome():
    for c in CHROMES:
        if Path(c).exists() or shutil.which(c):
            return c
    sys.exit("No se encuentra Chrome/Chromium; instálalo o abre web/imprimir.html y usa 'Guardar como PDF'.")

def generar(query, salida):
    salida = Path(salida); salida.parent.mkdir(parents=True, exist_ok=True)
    url = (WEB / "imprimir.html").as_uri() + "?" + query
    cmd = [chrome(), "--headless=new", "--disable-gpu", "--no-pdf-header-footer", "--allow-file-access-from-files",
           "--virtual-time-budget=5000", f"--print-to-pdf={salida}", url]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0 or not salida.exists():
        sys.exit(f"Error generando {salida}:\n{r.stderr[-800:]}")
    print("generado", salida)

def datos():
    txt = (WEB / "data.js").read_text(encoding="utf-8")
    return json.loads(txt[txt.index("{"):txt.rstrip().rstrip(";").rindex("}") + 1])

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--titulacion"); ap.add_argument("--curso"); ap.add_argument("--sem"); ap.add_argument("--grupo"); ap.add_argument("--semana")
    ap.add_argument("--aula"); ap.add_argument("--url", help="query string completa para imprimir.html")
    ap.add_argument("--todo", action="store_true"); ap.add_argument("-o", "--salida")
    ap.add_argument("--dir", default=str(ROOT / "salida"), help="directorio de salida (por defecto salida/)")
    a = ap.parse_args()
    out = Path(a.dir)
    if a.url:
        generar(a.url, a.salida or out / "horario.pdf")
    elif a.aula:
        q = {"tipo": "aula", "aula": a.aula, **({"sem": a.sem} if a.sem else {})}
        generar(urllib.parse.urlencode(q), a.salida or out / f"Aula_{a.aula}{'_S' + a.sem if a.sem else ''}.pdf")
    elif a.titulacion:
        if not (a.curso and a.sem):
            sys.exit("--titulacion requiere --curso y --sem")
        q = {"tipo": "titulacion", "tit": a.titulacion, "curso": a.curso, "sem": a.sem}
        if a.grupo: q["grupo"] = a.grupo
        if a.semana: q["semana"] = a.semana
        nombre = f"{a.titulacion.replace('/', '-')}_curso{a.curso}_S{a.sem}{'_' + a.grupo if a.grupo else ''}.pdf"
        generar(urllib.parse.urlencode(q), a.salida or out / nombre)
    elif a.todo:
        d = datos()
        hojas = sorted({(s["titulaciones"], s["curso"], s["semestre"]) for s in d["sesiones"]})
        for tit, curso, sem in hojas:
            q = urllib.parse.urlencode({"tipo": "titulacion", "tit": tit, "curso": curso, "sem": sem})
            generar(q, out / "titulaciones" / f"{tit.replace('/', '-')}_curso{curso}_S{sem}.pdf")
        aulas = sorted({a for s in d["sesiones"] if s["aulas"] for a in s["aulas"].split("/")})
        for aula in aulas:
            generar(urllib.parse.urlencode({"tipo": "aula", "aula": aula}), out / "aulas" / f"Aula_{aula}.pdf")
    else:
        ap.print_help()

if __name__ == "__main__":
    main()
