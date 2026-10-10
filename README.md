# Horarios EPS (UAH) – todos los grados

Extracción a formato reutilizable de los horarios que la Escuela Politécnica Superior
publica en PDF en <https://escuelapolitecnica.uah.es/es/estudiantes/horarios/>.

## Contenido

- `pdfs/` – los PDF originales descargados de la web (curso 2026/27).
- `scripts/extraer_horarios.py` – script de extracción (`pdfplumber`, Python 3).
  - `python3 scripts/extraer_horarios.py --descargar` lee la web, guarda `data/fuentes.csv` y baja los PDF.
  - `python3 scripts/extraer_horarios.py` regenera `data/` a partir de `pdfs/` y `data/fuentes.csv`.
  - `python3 scripts/extraer_horarios.py --solo GITT GIST` procesa solo los ficheros cuyo nombre contenga esas cadenas.
- `data/`
  - `fuentes.csv` – PDF encontrados en la web: rama (desplegable), titulación (texto de la fila), cuatrimestre y URL.
  - `franjas.csv` – una fila por hora y por ítem de celda (granularidad del PDF).
  - `sesiones.csv` / `sesiones.json` – franjas consecutivas fusionadas en sesiones (con `horas`).
  - `asignaturas.csv` – catálogo de asignaturas: nombre normalizado, variantes de escritura, grupos grandes y pequeños, aulas y horas/semana.
  - `aulas.csv` – catálogo de aulas: edificio (letra inicial), tipo (A = aula, L = laboratorio), horas/semana por cuatrimestre, titulaciones y asignaturas.
  - `avisos.txt` – texto que el parser no supo interpretar, para revisión manual.
  - `alias.csv` (opcional, no incluido) – pares `variante,canónico` para ampliar la tabla de abreviaturas sin tocar el código.

## Modelo de datos

Cada hoja de horario es la semana de un **grupo de horario** (p. ej. `3B`) de una titulación, curso y
cuatrimestre; puede ocupar más de una página del PDF (`paginas_hoja`). Cada celda contiene uno o más ítems:

    ASIGNATURA - GRUPO (AULA[/AULA...])

Variantes admitidas: guión ausente (`ANÁLISIS MATEMÁTICO I 1A (Aula 5)`), grupo compartido o doble
(`1A/G`, `1A1/1A2`, `3A/3A1`, `1T-A1`), sigla de la titulación de origen (`4A/G (GIEAI) (NA5)`),
referencia al grupo de otra titulación donde se imparte (`5A1 → 3A1 GII (NL12)`), marcas `TUTORÍA`,
`(PC)`, `(*)`, y asignaturas sin aula (INFOADE, impartidas en otra facultad).

Campos principales de `sesiones.csv`:

- `rama`, `titulacion_web`: tal como aparecen en la web.
- `titulaciones`, `codigos`: siglas y códigos de plan de la cabecera del PDF (varias si el horario es común, p. ej. `GITT/GIST/GIEC/GIT`).
- `curso`, `semestre`, `cuatrimestre`, `semana` (solo GMC: `Semana 1`, `Resto`, `1ra parte C2`…), `grupo_horario`.
- `dia`, `dia_nombre`, `hora_inicio`, `hora_fin`, `horas`.
- `asignatura` (texto original), `asignatura_norm` (mayúsculas, sin acentos, abreviaturas expandidas según `ALIAS`).
- `grupo`, `tipo_grupo`: sin dígito final (`1A`, `4OPT`, `ECOM1`) → `grande` (teoría, en mayúsculas en el PDF);
  con dígito final (`1A1`, `3R1`) → `pequeño` (laboratorio/prácticas). `asignatura_mayusculas` permite detectar incoherencias.
- `aulas`: aulas con código EPS (`EA6`, `OL5`, `PL15`) separadas por `/`; `aulas_raw` conserva el texto original
  (`lab`, `Aula 5`, `Aula informática grande`, `LabQ`, `--`, `pendiente asig.`…).
- `nota`: anotaciones (`TUTORÍA`, `(PC)`, `(*)`, `(GIEAI)`, `→ 3A1 GII`, `(16:30)`).
- `fichero`, `pagina`, `paginas_hoja`, `aprobacion` (fecha de la Junta de Escuela).

## Limitaciones conocidas

- Los PDF no indican profesorado; sólo asignatura, grupo y aula.
- Los másteres (MUIT, MUII) usan otra plantilla y no se procesan.
- Erratas de origen (`18_00/18:55`, `12:00/14:00`, `i11:00`, `2ª`) se corrigen asumiendo que cada fila es una franja de una hora.
- GMC (Guadalajara) usa nombres de aula propios (`Aula 5`), que quedan solo en `aulas_raw`.
- Quedan en `avisos.txt` los ítems sin grupo (p. ej. `Marketing: Estrategias (16:30)` en INFOADE 5º).
- La tabla `ALIAS` de abreviaturas se ha revisado solo para Telecomunicación; en otras ramas una misma asignatura
  puede aparecer con dos claves normalizadas si el PDF la abrevia de formas distintas.

## Aplicación web (`web/`)

Aplicación estática (HTML + JS, sin dependencias) sobre `web/data.js`, que genera el script de extracción.
Se puede abrir directamente `web/index.html` en el navegador o servirla con `python3 -m http.server -d web`.

- **Por titulación**: rama → titulación → curso → cuatrimestre (→ semana en GMC) → grupo de horario; reproduce la hoja del PDF,
  con filtros de grupos grandes/pequeños. Al pasar el ratón se ve aula, nota y PDF/página de origen.
- **Por aula**: ocupación semanal de cada aula con código EPS por cuatrimestre, horas/semana y posibles dobles reservas
  (asignaturas distintas a la misma hora en un aula sin alternativa). Muchas coincidencias son docencia compartida entre titulaciones.
- **Perfiles**: conjuntos de asignatura+grupo (p. ej. «Cálculo I — 1A» o «Cálculo I — 1A2») por cuatrimestre; se buscan por nombre,
  grupo o titulación, se dibujan juntas y se listan los solapes. Los perfiles se guardan en el navegador (localStorage) y se pueden
  exportar/importar como JSON.

## Impresión y generación de PDF

`web/imprimir.html` reproduce el formato de los PDF de la EPS (A4 apaisado, logos, cabecera, tabla HORA × días,
«ASIGNATURA - GRUPO (AULA)» con el aula en negrita, filas vacías finales en gris y pie con la fecha de aprobación).
Las hojas se generan en el navegador a partir de `web/data.js`; si una hoja tiene muchas franjas la tabla se escala para caber.

- Desde la aplicación: botones «🖨» en cada vista (grupo actual, curso completo, aula o perfil) abren la vista de impresión;
  «Imprimir / Guardar como PDF» del navegador produce el PDF (A4 apaisado, sin márgenes ni encabezados).
- Por lotes, con Chrome headless (`scripts/generar_pdf.py`, salida en `salida/`):

      python3 scripts/generar_pdf.py --titulacion GIST --curso 3 --sem 1          # una hoja por grupo (3ºB, 3ºE…)
      python3 scripts/generar_pdf.py --titulacion GIST --curso 3 --sem 1 --grupo 3B
      python3 scripts/generar_pdf.py --aula EA6 --sem 1
      python3 scripts/generar_pdf.py --todo                                        # todas las titulaciones y aulas

  Parámetros de `imprimir.html`: `?tipo=titulacion&tit=GIST&curso=3&sem=1[&grupo=3B][&semana=…]`,
  `?tipo=aula&aula=EA6[&sem=1]`, `?tipo=perfil&id=<id>` (perfil guardado en el navegador).

## Códigos de asignatura

Los PDF no los incluyen. Se cargan de `data/codigos.csv` (columnas `codigo`, `asignatura`, y opcionalmente `titulaciones`
con siglas separadas por `/` cuando el código depende de la titulación). `asignatura` puede ser el nombre normalizado o
cualquier variante del PDF: se normaliza igual que los horarios. Si el fichero no existe, el script genera
`data/codigos_plantilla.csv` con las 358 asignaturas detectadas para rellenar la columna `codigo`.
Con el fichero presente, `codigo` aparece en `franjas.csv`, `sesiones.csv`, `asignaturas.csv` y en la aplicación
(tooltip y búsqueda de perfiles); las hojas de impresión lo muestran si se añade `&codigos=1` a la URL.
Las asignaturas que queden sin código se listan en `avisos.txt`.

## Repositorio y despliegue

- Código y datos: <https://github.com/edelahozuah/HorariosEPS>.
- Aplicación desplegada: <https://edelahozuah.github.io/HorariosEPS/> (GitHub Pages sirve el contenido de `web/` desde la rama `gh-pages`).
- Para publicar cambios: regenerar datos, hacer commit en `main` y ejecutar `scripts/publicar.sh`, que actualiza `gh-pages` con `git subtree`.
