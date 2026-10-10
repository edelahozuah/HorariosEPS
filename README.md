# Horarios EPS (UAH) – todos los grados

Extracción a formato reutilizable de los horarios que la Escuela Politécnica Superior
publica en PDF en <https://escuelapolitecnica.uah.es/es/estudiantes/horarios/>.

## Contenido

- `pdfs/` – los PDF originales descargados de la web (curso 2026/27).
- `scripts/extraer_horarios.py` – script de extracción (`pdfplumber`, Python 3).
- `scripts/extraer_guias.py` – guías docentes, departamentos y profesorado desde www.uah.es (`requests`, `bs4`); ver «Guías docentes».
- `guias/<plan>/` – guías docentes en PDF descargadas de www.uah.es (`<código>_<asignatura>.pdf`).
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
  - `alias.csv` – pares `variante,canónico` para ampliar la tabla de abreviaturas sin tocar el código (p. ej. `CIRCUITS THEORY` → `Circuit Theory`).
  - `guias.csv` / `guias.json` – una fila por plan y asignatura: curso, código, nombre (español e inglés), créditos, tipo,
    periodo, idiomas, departamento, áreas, planes que comparten la asignatura, profesores, URL de la ficha, guía en inglés,
    PDF local y fecha de aprobación de la guía.
  - `profesores.csv` – una fila por profesor: puesto, categoría, departamento, área, correo, web, ficha y asignaturas
    (las del plan procesado y todas las que lista su ficha en la UAH).
  - `codigos.csv` – código ↔ nombre ↔ sigla de titulación; lo genera `extraer_guias.py` y lo consume `extraer_horarios.py`.

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

- Los PDF no indican profesorado; sólo asignatura, grupo y aula. El profesorado se obtiene aparte, de las guías docentes
  (`scripts/extraer_guias.py`, ver más abajo); por ahora sólo para el Grado en Ingeniería Telemática.
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

- **Estudiante**: elige titulación y cuatrimestre, marca asignaturas (agrupadas por curso) y, en cada una, el grupo grande
  y el pequeño; el horario se dibuja con los solapes resaltados y listados. «Buscar combinación sin solapes» prueba
  combinaciones de grupos (backtracking) hasta encontrar una sin conflictos, prefiriendo los grupos ya elegidos y los
  pequeños que pertenecen al grande (1A → 1A1). El selector «Grupo: solo B» restringe todos los grupos, grandes y
  pequeños, a los de una misma letra (1B, 1B1, 1B2…), tanto en los desplegables como en la búsqueda automática. La selección se guarda en el navegador y en la URL (`#est=…`), que se puede
  copiar y compartir; el botón PDF imprime la hoja en formato EPS (`imprimir.html?tipo=estudiante&sel=…`).

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

## Guías docentes y profesorado (`scripts/extraer_guias.py`)

La web de cada grado (p. ej. <https://www.uah.es/es/estudios/estudios-oficiales/grados/Grado-en-Ingenieria-Telematica/>)
carga por AJAX una tabla de asignaturas por curso; cada asignatura tiene una ficha
(`/es/estudios/estudios-oficiales/grados/asignatura/<Nombre>-<código>/`) con departamento, áreas, planes en que se imparte
y una pestaña «Profesores», y cada profesor una ficha con puesto, categoría, departamento, correo y asignaturas.
La guía docente en PDF se sirve incrustada en base64 (`mostrarProgramaAsignatura.jsp`). El script recorre todo eso:

    python3 scripts/extraer_guias.py                 # plan G380 (Grado en Ingeniería Telemática), sin PDF
    python3 scripts/extraer_guias.py --pdf           # además descarga las guías a guias/G380/
    python3 scripts/extraer_guias.py G380 G350 G390  # varios planes; los CSV se fusionan plan a plan
    python3 scripts/extraer_guias.py --sin-cache     # vuelve a descargar (las páginas se guardan en cache/guias/, no versionado)

Códigos de plan admitidos (sigla de los horarios): G350 GITT, G390 GIST, G370 GIEC, G380 GIT, G781 GII, G591 GIC, G581 GISI,
G782 INFOADE, G60 GIEAI, G610 GITI, G376 GIECAI. La pestaña «Transversales» (asignaturas de toda la UAH) se omite salvo
con `--transversales`. Genera `data/guias.csv`, `data/guias.json`, `data/profesores.csv`, `data/codigos.csv` y `web/guias.js` (por código de
asignatura: departamento, créditos, profesores con correo y ficha, enlaces a la ficha UAH y a la guía); después hay que
ejecutar `extraer_horarios.py` para que los códigos lleguen a `sesiones.csv`, `asignaturas.csv` y `web/data.js`.
En la app, el tooltip de cada sesión muestra departamento, créditos y profesorado, y en la vista Estudiante el botón ⓘ de
cada asignatura despliega profesorado (con enlace a su ficha y correo) y enlaces a la ficha UAH y a la guía docente;
el filtro busca también por profesor. Si `guias.js` falta, la app funciona igual sin esa información.

Notas:

- Las guías en PDF no listan el profesorado («Consultar página web»); de ellas sólo se extraen la fecha de aprobación y el idioma.
- Una misma asignatura puede tener varios códigos (p. ej. `Arquitectura de Computadores` 350020 en GITT y 380000 en GIT;
  `Seguridad` 380002 en castellano y 350039 en inglés). Por eso `codigos.csv` lleva la columna `titulaciones`.
- Los grupos en inglés de los horarios usan nombres que no siempre coinciden con los oficiales de la UAH
  (`CIRCUITS THEORY` frente a `Circuit Theory`); se corrigen en `data/alias.csv`.
- El Trabajo Fin de Grado (380008) no tiene guía en PDF; Prácticas Externas y Prácticas Profesionales la tienen sin fecha de aprobación.
- Con G380 procesado, las 58 asignaturas de GIT presentes en los horarios tienen código (386 sesiones).

## Códigos de asignatura

Los PDF no los incluyen. Se cargan de `data/codigos.csv` (columnas `codigo`, `asignatura`, y opcionalmente `titulaciones`
con siglas separadas por `/` cuando el código depende de la titulación). `asignatura` puede ser el nombre normalizado o
cualquier variante del PDF: se normaliza igual que los horarios. Lo genera `extraer_guias.py`; si el fichero no existe,
`extraer_horarios.py` genera `data/codigos_plantilla.csv` con las asignaturas detectadas para rellenar la columna `codigo` a mano.
Con el fichero presente, `codigo` aparece en `franjas.csv`, `sesiones.csv`, `asignaturas.csv` y en la aplicación
(tooltip y búsqueda de perfiles); las hojas de impresión lo muestran si se añade `&codigos=1` a la URL.
Las asignaturas que queden sin código se listan en `avisos.txt`.

## Repositorio y despliegue

- Código y datos: <https://github.com/edelahozuah/HorariosEPS>.
- Aplicación desplegada: <https://edelahozuah.github.io/HorariosEPS/>. El workflow `.github/workflows/pages.yml`
  publica `web/` en GitHub Pages automáticamente en cada push a `main` que modifique esa carpeta.
- `scripts/publicar.sh` es la alternativa manual (rama `gh-pages` con `git subtree`), ya no necesaria.
