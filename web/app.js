/* Horarios EPS – aplicación estática sobre web/data.js (generado por scripts/extraer_horarios.py) */
(() => {
"use strict";
const D = window.HORARIOS, S = D.sesiones;
const G = (window.GUIAS && window.GUIAS.asignaturas) || {};   // guías docentes por código (web/guias.js, opcional)
const guia = (codigo) => (codigo && G[codigo]) || null;
const htmlProfes = (g, enlaces = false) => g.profesores.map(p => enlaces && p.url
  ? `<a href="${p.url}" target="_blank" rel="noopener" title="Ficha en www.uah.es">${p.nombre}</a>` : p.nombre).join(", ");
const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];
const $ = (id) => document.getElementById(id);
const uniq = (arr) => [...new Set(arr)];
const h2n = (h) => parseInt(h.slice(0, 2), 10) + parseInt(h.slice(3, 5), 10) / 60;
const fin = (s) => h2n(s.hora_fin) + 5 / 60;           // "09:55" -> 10:00
const sortNat = (a, b) => String(a).localeCompare(String(b), "es", { numeric: true });
const claveOpcion = (s) => `${s.titulaciones}|${s.semestre}|${s.asignatura_norm}|${s.grupo}`;
const claveSesion = (s) => `${s.dia}|${s.hora_inicio}|${s.hora_fin}|${s.asignatura_norm}|${s.grupo}|${s.aulas}`;
const dedupe = (arr) => { const m = new Map(); arr.forEach(s => { const k = claveSesion(s); if (!m.has(k)) m.set(k, s); }); return [...m.values()]; };

// ---------- color por asignatura ----------
function color(nombre) {
  let h = 0; for (const c of nombre) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return `hsl(${h % 360} 70% 88%)`;
}

// ---------- rejilla ----------
function renderGrid(container, sesiones, opts = {}) {
  container.innerHTML = "";
  if (!sesiones.length) { container.innerHTML = '<div class="empty">Sin sesiones</div>'; return; }
  const hMin = Math.min(8, ...sesiones.map(s => Math.floor(h2n(s.hora_inicio))));
  const hMax = Math.max(15, ...sesiones.map(s => Math.ceil(fin(s))));
  const hourH = 44;
  const grid = document.createElement("div"); grid.className = "grid";
  grid.insertAdjacentHTML("beforeend", '<div class="head">Hora</div>' + DIAS.map(d => `<div class="head">${d}</div>`).join(""));
  const hours = document.createElement("div"); hours.className = "hours";
  for (let h = hMin; h < hMax; h++) hours.insertAdjacentHTML("beforeend", `<div>${h}:00</div>`);
  grid.appendChild(hours);
  const solapes = opts.solapes || new Set();
  for (let d = 1; d <= 5; d++) {
    const col = document.createElement("div"); col.className = "day"; col.style.height = `${(hMax - hMin) * hourH}px`;
    const ses = sesiones.filter(s => s.dia === d).sort((a, b) => h2n(a.hora_inicio) - h2n(b.hora_inicio) || sortNat(a.grupo, b.grupo));
    // carriles: agrupar en clusters de solape y asignar columna a cada sesión
    let cluster = [], clusterEnd = -1;
    const flush = () => {
      if (!cluster.length) return;
      const lanes = [];
      cluster.forEach(s => {
        let i = lanes.findIndex(end => end <= h2n(s.hora_inicio) + 1e-6);
        if (i < 0) { i = lanes.length; lanes.push(0); }
        lanes[i] = fin(s); s._lane = i;
      });
      cluster.forEach(s => { s._lanes = lanes.length; });
      cluster = [];
    };
    ses.forEach(s => {
      if (cluster.length && h2n(s.hora_inicio) >= clusterEnd - 1e-6) flush();
      cluster.push(s); clusterEnd = Math.max(clusterEnd, fin(s));
      if (cluster.length === 1) clusterEnd = fin(s);
    });
    flush();
    ses.forEach(s => {
      const el = document.createElement("div");
      el.className = "ses" + (s.tipo_grupo === "pequeño" ? " pequeno" : "") + (solapes.has(claveSesion(s)) ? " solape" : "");
      el.style.top = `${(h2n(s.hora_inicio) - hMin) * hourH}px`;
      el.style.height = `${(fin(s) - h2n(s.hora_inicio)) * hourH - 2}px`;
      el.style.left = `calc(${(100 / s._lanes) * s._lane}% + 1px)`;
      el.style.width = `calc(${100 / s._lanes}% - 3px)`;
      el.style.background = color(s.asignatura_norm);
      const extra = opts.etiqueta ? opts.etiqueta(s) : (s.aulas || s.aulas_raw || "");
      el.innerHTML = `<b>${s.asignatura}</b><small>${s.grupo}${extra ? " · " + extra : ""}</small>`;
      el.addEventListener("mousemove", (e) => tooltip(e, s));
      el.addEventListener("mouseleave", () => $("tooltip").hidden = true);
      col.appendChild(el);
    });
    grid.appendChild(col);
  }
  container.appendChild(grid);
}

function tooltip(e, s) {
  const t = $("tooltip"), g = guia(s.codigo);
  t.innerHTML = [
    `<div><b>${s.asignatura}</b>${s.codigo ? " · " + s.codigo : ""}</div>`,
    `<div>Grupo ${s.grupo} (${s.tipo_grupo}) · ${DIAS[s.dia - 1]} ${s.hora_inicio}–${s.hora_fin}</div>`,
    `<div>Aula: ${s.aulas || s.aulas_raw || "—"}</div>`,
    `<div>${s.titulaciones} · ${s.curso}º curso · ${s.semestre}º cuatr. · grupo ${s.grupo_horario}${s.semana ? " · " + s.semana : ""}</div>`,
    s.nota ? `<div>Nota: ${s.nota}</div>` : "",
    ...(g ? [`<div style="margin-top:4px">${g.departamento || ""}${g.departamento && g.creditos ? " · " : ""}${g.creditos ? g.creditos + " ECTS" : ""}</div>`,
             g.profesores.length ? `<div>Profesorado: ${htmlProfes(g)}</div>` : ""] : []),
    `<div style="color:#9ca3af">${s.fichero} p.${s.pagina}</div>`,
  ].join("");
  t.hidden = false;
  const x = Math.min(e.clientX + 14, window.innerWidth - 340), y = Math.min(e.clientY + 14, window.innerHeight - t.offsetHeight - 10);
  t.style.left = x + "px"; t.style.top = y + "px";
}

function fill(sel, values, labels) {
  const prev = sel.value;
  sel.innerHTML = values.map((v, i) => `<option value="${v}">${labels ? labels[i] : v}</option>`).join("");
  if (values.includes(prev)) sel.value = prev;
}

// ---------- pestañas ----------
document.querySelectorAll(".tabs button").forEach(b => b.addEventListener("click", () => {
  document.querySelectorAll(".tabs button").forEach(x => x.classList.toggle("active", x === b));
  document.querySelectorAll(".view").forEach(v => v.classList.toggle("active", v.id === "view-" + b.dataset.view));
}));

// ---------- vista por titulación ----------
const T = { rama: $("t-rama"), tit: $("t-tit"), curso: $("t-curso"), sem: $("t-sem"), semana: $("t-semana"), grupo: $("t-grupo") };
function tInit() {
  const ramas = uniq(S.map(s => s.rama));
  fill(T.rama, ramas);
  T.rama.value = ramas.find(r => /telecomunicaci/i.test(r) && !/conjunt/i.test(r)) || ramas[0];
  T.rama.addEventListener("change", tRama); T.tit.addEventListener("change", tTit);
  T.curso.addEventListener("change", tCurso); T.sem.addEventListener("change", tSem); T.semana.addEventListener("change", tDraw);
  T.grupo.addEventListener("change", tDraw); $("t-grandes").addEventListener("change", tDraw); $("t-pequenos").addEventListener("change", tDraw);
  tRama();
}
function tRama() {
  const ss = S.filter(s => s.rama === T.rama.value);
  const tits = uniq(ss.map(s => s.titulaciones)).sort(sortNat);
  fill(T.tit, tits, tits.map(t => { const w = uniq(ss.filter(s => s.titulaciones === t).map(s => s.titulacion_web)); return `${t} — ${w.join(" / ")}`; }));
  tTit();
}
function tTit() {
  const ss = S.filter(s => s.rama === T.rama.value && s.titulaciones === T.tit.value);
  fill(T.curso, uniq(ss.map(s => s.curso)).sort().map(String), null); tCurso();
}
function tCurso() {
  const ss = S.filter(s => s.rama === T.rama.value && s.titulaciones === T.tit.value && s.curso == T.curso.value);
  const sems = uniq(ss.map(s => s.semestre)).sort().map(String);
  fill(T.sem, sems, sems.map(x => x + "º")); tSem();
}
function tSem() {
  const ss = S.filter(s => s.rama === T.rama.value && s.titulaciones === T.tit.value && s.curso == T.curso.value && s.semestre == T.sem.value);
  const semanas = uniq(ss.map(s => s.semana)).filter(Boolean).sort(sortNat);
  $("t-semana-wrap").hidden = !semanas.length; fill(T.semana, semanas);
  fill(T.grupo, uniq(ss.map(s => s.grupo_horario)).sort(sortNat)); tDraw();
}
function tDraw() {
  let ss = S.filter(s => s.rama === T.rama.value && s.titulaciones === T.tit.value && s.curso == T.curso.value
    && s.semestre == T.sem.value && s.grupo_horario === T.grupo.value);
  if (!$("t-semana-wrap").hidden) ss = ss.filter(s => s.semana === T.semana.value);
  if (!$("t-grandes").checked) ss = ss.filter(s => s.tipo_grupo !== "grande");
  if (!$("t-pequenos").checked) ss = ss.filter(s => s.tipo_grupo !== "pequeño");
  renderGrid($("t-grid"), ss);
}

// ---------- vista por aula ----------
function aInit() {
  const aulas = uniq(S.flatMap(s => s.aulas ? s.aulas.split("/") : [])).sort(sortNat);
  fill($("a-aula"), aulas); $("a-aula").addEventListener("change", aDraw); $("a-sem").addEventListener("change", aDraw); aDraw();
}
function aDraw() {
  const aula = $("a-aula").value, sem = $("a-sem").value;
  const ss = dedupe(S.filter(s => s.semestre == sem && s.aulas && s.aulas.split("/").includes(aula)));
  const horas = ss.reduce((n, s) => n + s.horas, 0);
  // posible doble reserva: asignaturas distintas (la misma clase puede figurar en varios PDF) y aula única (sin alternativa "A/B")
  const { marcados, lista } = pSolapes(ss, (a, b) => a.asignatura_norm !== b.asignatura_norm && !a.aulas.includes("/") && !b.aulas.includes("/"));
  $("a-info").innerHTML = `${ss.length} sesiones · ${horas} h/semana` +
    (lista.length ? ` · <span style="color:var(--danger)" title="${lista.join("&#10;")}">${lista.length} posible(s) doble(s) reserva(s)</span>` : "");
  renderGrid($("a-grid"), ss, { solapes: marcados, etiqueta: (s) => `${s.titulaciones} ${s.grupo_horario}` });
}

// ---------- perfiles ----------
const opciones = new Map();   // claveOpcion -> {clave, sesiones, label...}
S.forEach(s => {
  const k = claveOpcion(s);
  if (!opciones.has(k)) opciones.set(k, { clave: k, asignatura: s.asignatura_norm, codigo: s.codigo || "", nombre: s.asignatura, grupo: s.grupo, tipo: s.tipo_grupo,
    titulaciones: s.titulaciones, curso: s.curso, semestre: s.semestre, sesiones: [] });
  opciones.get(k).sesiones.push(s);
});
let perfiles = {}, perfilActual = null;
const LS = "horarios-eps-perfiles";
function pCargar() { try { perfiles = JSON.parse(localStorage.getItem(LS) || "{}"); } catch { perfiles = {}; } }
function pGuardar() { try { localStorage.setItem(LS, JSON.stringify(perfiles)); } catch {} }
function pNuevo(nombre) {
  const id = "p" + Date.now();
  perfiles[id] = { nombre: nombre || "Perfil " + (Object.keys(perfiles).length + 1), semestre: Number($("p-sem").value) || 1, claves: [] };
  perfilActual = id; pGuardar(); pLista(); pDraw();
}
function pLista() {
  const ids = Object.keys(perfiles);
  fill($("p-lista"), ids, ids.map(i => perfiles[i].nombre));
  if (!ids.includes(perfilActual)) perfilActual = ids[0] || null;
  if (perfilActual) { $("p-lista").value = perfilActual; $("p-nombre").value = perfiles[perfilActual].nombre; $("p-sem").value = perfiles[perfilActual].semestre; }
}
function pInit() {
  pCargar(); pLista();
  if (!perfilActual) pNuevo("Mi perfil");
  $("p-lista").addEventListener("change", () => { perfilActual = $("p-lista").value; pLista(); pDraw(); });
  $("p-nuevo").addEventListener("click", () => pNuevo());
  $("p-borrar").addEventListener("click", () => { if (perfilActual && confirm(`¿Borrar el perfil "${perfiles[perfilActual].nombre}"?`)) { delete perfiles[perfilActual]; perfilActual = null; pGuardar(); pLista(); if (!perfilActual) pNuevo("Mi perfil"); pDraw(); } });
  $("p-nombre").addEventListener("input", () => { perfiles[perfilActual].nombre = $("p-nombre").value; pGuardar(); pLista(); });
  $("p-sem").addEventListener("change", () => { perfiles[perfilActual].semestre = Number($("p-sem").value); pGuardar(); pBuscar(); pDraw(); });
  $("p-buscar").addEventListener("input", pBuscar);
  $("p-exportar").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(perfiles, null, 1)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "perfiles-horarios.json"; a.click();
  });
  $("p-importar").addEventListener("click", () => $("p-fichero").click());
  $("p-fichero").addEventListener("change", (e) => {
    const f = e.target.files[0]; if (!f) return;
    f.text().then(txt => { const imp = JSON.parse(txt); Object.assign(perfiles, imp); pGuardar(); pLista(); pDraw(); }).catch(() => alert("Fichero no válido"));
    e.target.value = "";
  });
  pBuscar(); pDraw();
}
function pBuscar() {
  const q = $("p-buscar").value.trim().toLowerCase(), sem = perfiles[perfilActual].semestre;
  const cont = $("p-resultados"); cont.innerHTML = "";
  if (!q) { cont.innerHTML = '<div class="item meta">Escribe para buscar (p. ej. "cálculo", "3B1", "GITT 2")</div>'; return; }
  const palabras = q.split(/\s+/);
  const res = [...opciones.values()].filter(o => o.semestre === sem && palabras.every(p =>
    (o.asignatura + " " + o.nombre + " " + o.codigo + " " + o.grupo + " " + o.titulaciones + " " + o.curso).toLowerCase().includes(p)))
    .sort((a, b) => sortNat(a.asignatura, b.asignatura) || sortNat(a.titulaciones, b.titulaciones) || sortNat(a.grupo, b.grupo)).slice(0, 80);
  const sel = new Set(perfiles[perfilActual].claves);
  res.forEach(o => {
    const el = document.createElement("div"); el.className = "item";
    el.innerHTML = `<span class="sw" style="background:${color(o.asignatura)}"></span><span class="txt">${o.nombre} — <b>${o.grupo}</b> <span class="meta">(${o.tipo})</span><br><span class="meta">${o.codigo ? o.codigo + " · " : ""}${o.titulaciones} · ${o.curso}º · ${o.sesiones.length} ses./sem.</span></span><button>${sel.has(o.clave) ? "Quitar" : "Añadir"}</button>`;
    el.addEventListener("click", () => { pToggle(o.clave); pBuscar(); });
    cont.appendChild(el);
  });
  if (!res.length) cont.innerHTML = '<div class="item meta">Sin resultados en este cuatrimestre</div>';
}
function pToggle(clave) {
  const c = perfiles[perfilActual].claves, i = c.indexOf(clave);
  if (i >= 0) c.splice(i, 1); else c.push(clave);
  pGuardar(); pDraw();
}
function pSolapes(ses, filtro) {
  const marcados = new Set(), lista = [];
  for (let i = 0; i < ses.length; i++) for (let j = i + 1; j < ses.length; j++) {
    const a = ses[i], b = ses[j];
    if (a.dia !== b.dia || claveOpcion(a) === claveOpcion(b)) continue;
    if (filtro && !filtro(a, b)) continue;
    if (h2n(a.hora_inicio) < fin(b) && h2n(b.hora_inicio) < fin(a)) {
      marcados.add(claveSesion(a)); marcados.add(claveSesion(b));
      lista.push(`${DIAS[a.dia - 1]} ${a.hora_inicio}: ${a.asignatura} ${a.grupo} ↔ ${b.asignatura} ${b.grupo}`);
    }
  }
  return { marcados, lista };
}
function pDraw() {
  const p = perfiles[perfilActual]; const cont = $("p-seleccion"); cont.innerHTML = "";
  const ses = dedupe(p.claves.flatMap(k => (opciones.get(k) || { sesiones: [] }).sesiones));
  $("p-n").textContent = `(${p.claves.length})`;
  p.claves.forEach(k => {
    const o = opciones.get(k); if (!o) return;
    const el = document.createElement("div"); el.className = "item";
    el.innerHTML = `<span class="sw" style="background:${color(o.asignatura)}"></span><span class="txt">${o.nombre} — <b>${o.grupo}</b><br><span class="meta">${o.titulaciones} · ${o.curso}º · ${o.sesiones.reduce((n, s) => n + s.horas, 0)} h/sem.</span></span><button>Quitar</button>`;
    el.addEventListener("click", () => { pToggle(k); pBuscar(); });
    cont.appendChild(el);
  });
  const { marcados, lista } = pSolapes(ses);
  const horas = ses.reduce((n, s) => n + s.horas, 0);
  $("p-solapes").innerHTML = (ses.length ? `<div class="meta">${ses.length} sesiones · ${horas} h/semana</div>` : "") +
    (lista.length ? lista.map(l => `<div class="s">${l}</div>`).join("") : (ses.length ? '<div class="ok">Sin solapes</div>' : ""));
  renderGrid($("p-grid"), ses, { solapes: marcados, etiqueta: (s) => `${s.aulas || s.aulas_raw || ""} · ${s.titulaciones}` });
}

// ---------- impresión (abre web/imprimir.html con la selección) ----------
function abrirImpresion(params) {
  const u = new URL("imprimir.html", location.href);
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== "") u.searchParams.set(k, v); });
  window.open(u.toString(), "_blank");
}
$("t-print-grupo").addEventListener("click", () => abrirImpresion({ tipo: "titulacion", rama: T.rama.value, tit: T.tit.value, curso: T.curso.value, sem: T.sem.value,
  grupo: T.grupo.value, semana: $("t-semana-wrap").hidden ? "" : T.semana.value }));
$("t-print-todos").addEventListener("click", () => abrirImpresion({ tipo: "titulacion", rama: T.rama.value, tit: T.tit.value, curso: T.curso.value, sem: T.sem.value }));
$("a-print").addEventListener("click", () => abrirImpresion({ tipo: "aula", aula: $("a-aula").value, sem: $("a-sem").value }));
$("p-print").addEventListener("click", () => abrirImpresion({ tipo: "perfil", id: perfilActual }));


// ---------- vista estudiante ----------
// Selección: { tit, sem, asig: { asignatura_norm: { g: grupoGrande|"", p: grupoPequeño|"" } } }
const E = { tit: $("e-tit"), sem: $("e-sem"), lista: $("e-lista"), filtro: $("e-filtro") };
let estSel = { tit: "", sem: 1, letra: "", asig: {} };   // letra: "" = cualquier grupo, "B" = solo grupos 1B, 1B1, 1B2…
const letraDe = (g) => (g.match(/^\d([A-Z])/) || [])[1] || "";
const LSE = "horarios-eps-estudiante";
const siglasTit = () => uniq(S.flatMap(s => s.titulaciones.split("/"))).sort(sortNat);
const sesTit = (tit, sem) => S.filter(s => s.semestre == sem && s.titulaciones.split("/").includes(tit));

function eCatalogo() {
  // asignaturas de la titulación y cuatrimestre con sus grupos grandes y pequeños
  const cat = new Map();
  sesTit(estSel.tit, estSel.sem).forEach(s => {
    const a = cat.get(s.asignatura_norm) || { norm: s.asignatura_norm, nombre: s.asignatura, curso: s.curso, codigo: s.codigo || "", grandes: new Set(), pequenos: new Set() };
    if (s.asignatura.toUpperCase() !== s.asignatura) a.nombre = s.asignatura;   // preferir Title Case
    (s.tipo_grupo === "grande" ? a.grandes : a.pequenos).add(s.grupo);
    a.curso = Math.min(a.curso, s.curso);
    cat.set(s.asignatura_norm, a);
  });
  const L = estSel.letra, ok = (g) => !L || letraDe(g) === L;
  return [...cat.values()].map(a => ({ ...a, grandes: [...a.grandes].filter(ok).sort(sortNat), pequenos: [...a.pequenos].filter(ok).sort(sortNat) }))
    .sort((a, b) => a.curso - b.curso || sortNat(a.nombre, b.nombre));
}
function eSesiones(sel = estSel) {
  const out = [];
  const ss = sesTit(sel.tit, sel.sem);
  Object.entries(sel.asig).forEach(([norm, g]) => {
    ss.forEach(s => { if (s.asignatura_norm === norm && ((g.g && s.grupo === g.g) || (g.p && s.grupo === g.p))) out.push(s); });
  });
  return dedupe(out);
}
function eGuardar() {
  try { localStorage.setItem(LSE, JSON.stringify(estSel)); } catch {}
  const h = "#est=" + encodeURIComponent(JSON.stringify(estSel));
  history.replaceState(null, "", location.pathname + location.search + h);
}
function eCargar() {
  const m = location.hash.match(/^#est=(.+)$/);
  try { if (m) { estSel = JSON.parse(decodeURIComponent(m[1])); return true; } } catch {}
  try { const v = localStorage.getItem(LSE); if (v) estSel = JSON.parse(v); } catch {}
  return false;
}
function eInit() {
  const tits = siglasTit();
  fill(E.tit, tits, tits.map(t => `${t} — ${(D.titulaciones[t] || {}).nombre || ""}`.replace(/GRADO EN /, "")));
  const desdeUrl = eCargar();
  if (!tits.includes(estSel.tit)) { estSel.tit = tits.includes("GITT") ? "GITT" : tits[0]; estSel.asig = {}; }
  E.tit.value = estSel.tit; E.sem.value = estSel.sem;
  E.tit.addEventListener("change", () => { estSel = { tit: E.tit.value, sem: Number(E.sem.value), letra: "", asig: {} }; eGuardar(); eLetras(); eLista(); eDraw(); });
  E.sem.addEventListener("change", () => { estSel = { tit: E.tit.value, sem: Number(E.sem.value), letra: "", asig: {} }; eGuardar(); eLetras(); eLista(); eDraw(); });
  $("e-letra").addEventListener("change", () => {
    estSel.letra = $("e-letra").value;
    // reajustar los grupos ya elegidos que no sean de la letra
    const cat = Object.fromEntries(eCatalogo().map(a => [a.norm, a]));
    Object.entries(estSel.asig).forEach(([norm, g]) => {
      const a = cat[norm]; if (!a) return;
      if (g.g && !a.grandes.includes(g.g)) g.g = a.grandes[0] || "";
      if (g.p && !a.pequenos.includes(g.p)) g.p = a.pequenos[0] || "";
    });
    eGuardar(); eLista(); eDraw();
  });
  eLetras();
  E.filtro.addEventListener("input", eLista);
  $("e-limpiar").addEventListener("click", () => { estSel.asig = {}; eGuardar(); eLista(); eDraw(); });
  $("e-auto").addEventListener("click", eAuto);
  $("e-compartir").addEventListener("click", () => { eGuardar(); navigator.clipboard?.writeText(location.href).then(() => alert("Enlace copiado:\n" + location.href), () => prompt("Copia el enlace:", location.href)); });
  $("e-print").addEventListener("click", () => abrirImpresion({ tipo: "estudiante", sel: JSON.stringify(estSel) }));
  if (desdeUrl) document.querySelector('.tabs button[data-view="estudiante"]').click();
  eLista(); eDraw();
}
function eLetras() {
  const letras = uniq(sesTit(estSel.tit, estSel.sem).map(s => letraDe(s.grupo)).filter(Boolean)).sort();
  fill($("e-letra"), ["", ...letras], ["Grupo: cualquiera", ...letras.map(l => `Grupo: solo ${l} (${l}, ${l}1, ${l}2…)`)]);
  if (!["", ...letras].includes(estSel.letra)) estSel.letra = "";
  $("e-letra").value = estSel.letra;
}
const eAbiertas = new Set();   // asignaturas con el detalle (profesorado, guía) desplegado
function eLista() {
  const cat = eCatalogo(), q = E.filtro.value.trim().toLowerCase();
  E.lista.innerHTML = "";
  let cursoAct = null;
  cat.forEach(a => {
    if (q && !(a.nombre + " " + a.codigo + " " + (guia(a.codigo)?.profesores.map(p => p.nombre).join(" ") || "")).toLowerCase().includes(q)) return;
    if (a.curso !== cursoAct) { cursoAct = a.curso; E.lista.insertAdjacentHTML("beforeend", `<div class="curso">${a.curso}º curso</div>`); }
    const sel = estSel.asig[a.norm];
    const el = document.createElement("div"); el.className = "asig" + (sel ? "" : " off");
    const opts = (lista, v, nada) => `<option value="">${nada}</option>` + lista.map(g => `<option value="${g}"${g === v ? " selected" : ""}>${g}</option>`).join("");
    const g = guia(a.codigo);
    const detalle = g ? `<div class="detalle"${eAbiertas.has(a.norm) ? "" : " hidden"}>${g.departamento ? `<div>${g.departamento}${g.areas && g.areas !== "Area no especificada" ? " · " + g.areas : ""}</div>` : ""}
        ${g.profesores.length ? `<div>Profesorado: ${htmlProfes(g, true)}</div>` : ""}
        <div><a href="${g.url_ficha}" target="_blank" rel="noopener">Ficha UAH</a>${g.url_guia ? ` · <a href="${g.url_guia}" target="_blank" rel="noopener">Guía docente</a>` : ""}${g.url_guia_en ? ` · <a href="${g.url_guia_en}" target="_blank" rel="noopener">Guide (EN)</a>` : ""}</div></div>` : "";
    el.innerHTML = `<label class="nombre"><input type="checkbox"${sel ? " checked" : ""}><span class="sw" style="background:${color(a.norm)}"></span><span>${a.nombre}${a.codigo ? ` <span class="meta">${a.codigo}</span>` : ""}</span>${g ? `<button type="button" class="info" title="Departamento, profesorado y guía docente">ⓘ</button>` : ""}</label>
      <div class="grupos"><select class="g" title="Grupo grande (teoría)">${opts(a.grandes, sel?.g, "— grande —")}</select><select class="p" title="Grupo pequeño (laboratorio)">${opts(a.pequenos, sel?.p, "— pequeño —")}</select></div>${detalle}`;
    el.querySelector(".info")?.addEventListener("click", (ev) => { ev.preventDefault(); const d = el.querySelector(".detalle"); d.hidden = !d.hidden; d.hidden ? eAbiertas.delete(a.norm) : eAbiertas.add(a.norm); });
    el.querySelector("input").addEventListener("change", (ev) => {
      if (ev.target.checked) estSel.asig[a.norm] = { g: a.grandes[0] || "", p: a.pequenos[0] || "" }; else delete estSel.asig[a.norm];
      eGuardar(); eLista(); eDraw();
    });
    el.querySelector(".g").addEventListener("change", (ev) => { estSel.asig[a.norm].g = ev.target.value; eGuardar(); eDraw(); });
    el.querySelector(".p").addEventListener("change", (ev) => { estSel.asig[a.norm].p = ev.target.value; eGuardar(); eDraw(); });
    E.lista.appendChild(el);
  });
  $("e-n").textContent = `(${Object.keys(estSel.asig).length} de ${cat.length})`;
}
function eDraw() {
  const ses = eSesiones();
  const { marcados, lista } = pSolapes(ses);
  const horas = ses.reduce((n, s) => n + s.horas, 0);
  $("e-solapes").innerHTML = (ses.length ? `<div class="meta">${ses.length} sesiones · ${horas} h/semana</div>` : "<div class='meta'>Marca asignaturas y elige sus grupos</div>") +
    (lista.length ? lista.map(l => `<div class="s">${l}</div>`).join("") : (ses.length ? '<div class="ok">Sin solapes</div>' : ""));
  renderGrid($("e-grid"), ses, { solapes: marcados, etiqueta: (s) => s.aulas || s.aulas_raw || "" });
}
/* Búsqueda de una combinación de grupos sin solapes (backtracking sobre las asignaturas marcadas).
   Prefiere mantener los grupos ya elegidos y que el grupo pequeño pertenezca al grande (1A -> 1A1). */
function eAuto() {
  const cat = eCatalogo().filter(a => estSel.asig[a.norm]);
  if (!cat.length) { alert("Marca primero las asignaturas."); return; }
  const ss = sesTit(estSel.tit, estSel.sem);
  const sesDe = (norm, grupo) => grupo ? ss.filter(s => s.asignatura_norm === norm && s.grupo === grupo) : [];
  const choca = (a, b) => a.dia === b.dia && h2n(a.hora_inicio) < fin(b) && h2n(b.hora_inicio) < fin(a);
  const cands = cat.map(a => {
    const act = estSel.asig[a.norm];
    const gs = a.grandes.length ? a.grandes : [""], ps = a.pequenos.length ? a.pequenos : [""];
    const list = [];
    gs.forEach(g => ps.forEach(p => list.push({ g, p, ses: [...sesDe(a.norm, g), ...sesDe(a.norm, p)],
      pref: (g === act.g ? 2 : 0) + (p === act.p ? 2 : 0) + (p && g && p.startsWith(g) ? 1 : 0) })));
    list.sort((x, y) => y.pref - x.pref);
    return { a, list };
  }).sort((x, y) => x.list.length - y.list.length);
  const elegido = [], usados = [];
  let nodos = 0;
  function bt(i) {
    if (i === cands.length) return true;
    for (const c of cands[i].list) {
      if (++nodos > 200000) return false;
      if (c.ses.some(s => usados.some(u => choca(s, u)))) continue;
      elegido[i] = c; usados.push(...c.ses);
      if (bt(i + 1)) return true;
      usados.length -= c.ses.length;
    }
    return false;
  }
  if (bt(0)) {
    cands.forEach((c, i) => { estSel.asig[c.a.norm] = { g: elegido[i].g, p: elegido[i].p }; });
    eGuardar(); eLista(); eDraw();
  } else {
    alert("No existe ninguna combinación de grupos sin solapes para estas asignaturas" + (nodos > 200000 ? " (búsqueda interrumpida)" : "") + ".");
  }
}

// ---------- vista gestor: asignaturas que coinciden en una franja ----------
// Consulta: { sem, dia, desde, hasta (horas enteras), sel: ["GITT|2", ...], grandes, pequenos, tutorias }
const LSG = "horarios-eps-gestor";
const H_MIN = 8, H_MAX = Math.max(21, ...S.map(s => Math.ceil(fin(s))));
const esTutoria = (s) => /TUTOR[IÍ]A/i.test(s.asignatura + " " + s.nota);
const cursosDe = (tit) => uniq(S.filter(s => s.titulaciones.split("/").includes(tit)).map(s => s.curso)).sort();
let gCons = { sem: 1, dia: 1, desde: 9, hasta: 11, sel: [], grandes: true, pequenos: true, tutorias: true };

function gGuardar() { try { localStorage.setItem(LSG, JSON.stringify(gCons)); } catch {} }
function gCargar() {
  const m = location.hash.match(/^#ges=(.+)$/);
  try { if (m) { Object.assign(gCons, JSON.parse(decodeURIComponent(m[1]))); return true; } } catch {}
  try { const v = localStorage.getItem(LSG); if (v) Object.assign(gCons, JSON.parse(v)); } catch {}
  return false;
}
// sesiones del cuatrimestre de las titulaciones-curso marcadas y tipos de grupo elegidos (sin franja)
function gSesiones() {
  const sel = new Set(gCons.sel);
  return S.filter(s => s.semestre == gCons.sem && s.titulaciones.split("/").some(t => sel.has(`${t}|${s.curso}`))
    && (gCons.grandes || s.tipo_grupo !== "grande") && (gCons.pequenos || s.tipo_grupo !== "pequeño")
    && (gCons.tutorias || !esTutoria(s)));
}
const enFranja = (s, dia, desde, hasta) => s.dia === dia && h2n(s.hora_inicio) < hasta && desde < fin(s);

function gInit() {
  const horas = []; for (let h = H_MIN; h <= H_MAX; h++) horas.push(h);
  fill($("g-dia"), ["1", "2", "3", "4", "5"], DIAS);
  fill($("g-desde"), horas.slice(0, -1).map(String), horas.slice(0, -1).map(h => `${h}:00`));
  fill($("g-hasta"), horas.slice(1).map(String), horas.slice(1).map(h => `${h}:00`));
  const desdeUrl = gCargar();
  if (!gCons.sel.length) gCons.sel = ["GITT|1"];
  gTits(); gControles();
  const leer = () => {
    gCons.sem = Number($("g-sem").value); gCons.dia = Number($("g-dia").value);
    gCons.desde = Number($("g-desde").value); gCons.hasta = Number($("g-hasta").value);
    if (gCons.hasta <= gCons.desde) { if (document.activeElement === $("g-hasta")) gCons.desde = gCons.hasta - 1; else gCons.hasta = gCons.desde + 1; }
    gCons.grandes = $("g-grandes").checked; gCons.pequenos = $("g-pequenos").checked; gCons.tutorias = $("g-tutorias").checked;
    gControles(); gGuardar(); gDraw();
  };
  ["g-sem", "g-dia", "g-desde", "g-hasta", "g-grandes", "g-pequenos", "g-tutorias"].forEach(id => $(id).addEventListener("change", leer));
  $("g-todas").addEventListener("click", () => { gCons.sel = siglasTit().flatMap(t => cursosDe(t).map(c => `${t}|${c}`)); gTits(); gGuardar(); gDraw(); });
  $("g-ninguna").addEventListener("click", () => { gCons.sel = []; gTits(); gGuardar(); gDraw(); });
  $("g-compartir").addEventListener("click", () => {
    history.replaceState(null, "", location.pathname + location.search + "#ges=" + encodeURIComponent(JSON.stringify(gCons)));
    navigator.clipboard?.writeText(location.href).then(() => alert("Enlace copiado:\n" + location.href), () => prompt("Copia el enlace:", location.href));
  });
  if (desdeUrl) document.querySelector('.tabs button[data-view="gestor"]').click();
  gDraw();
}
function gControles() {
  $("g-sem").value = gCons.sem; $("g-dia").value = gCons.dia; $("g-desde").value = gCons.desde; $("g-hasta").value = gCons.hasta;
  $("g-grandes").checked = gCons.grandes; $("g-pequenos").checked = gCons.pequenos; $("g-tutorias").checked = gCons.tutorias;
}
// lista de titulaciones con una casilla por curso; la casilla de la titulación marca o desmarca todos sus cursos
function gTits() {
  const cont = $("g-tits"), sel = new Set(gCons.sel);
  cont.innerHTML = "";
  siglasTit().forEach(t => {
    const cursos = cursosDe(t), n = cursos.filter(c => sel.has(`${t}|${c}`)).length;
    const el = document.createElement("div"); el.className = "g-tit";
    el.innerHTML = `<label class="nombre" title="${(D.titulaciones[t] || {}).nombre || ""}"><input type="checkbox" class="todo"${n === cursos.length ? " checked" : ""}> <b>${t}</b></label>
      <span class="cursos">${cursos.map(c => `<label><input type="checkbox" data-c="${c}"${sel.has(`${t}|${c}`) ? " checked" : ""}>${c}º</label>`).join("")}</span>`;
    el.querySelector(".todo").indeterminate = n > 0 && n < cursos.length;
    el.querySelector(".todo").addEventListener("change", (ev) => {
      gCons.sel = gCons.sel.filter(k => !k.startsWith(t + "|"));
      if (ev.target.checked) gCons.sel.push(...cursos.map(c => `${t}|${c}`));
      gTits(); gGuardar(); gDraw();
    });
    el.querySelectorAll("[data-c]").forEach(cb => cb.addEventListener("change", () => {
      const k = `${t}|${cb.dataset.c}`;
      gCons.sel = gCons.sel.filter(x => x !== k); if (cb.checked) gCons.sel.push(k);
      gTits(); gGuardar(); gDraw();
    }));
    cont.appendChild(el);
  });
  $("g-n").textContent = `(${gCons.sel.length})`;
}
function gDraw() {
  const ss = gSesiones();
  const { dia, desde, hasta } = gCons;
  // mapa semanal: asignaturas distintas por hora y día; clic = elegir esa hora, mayúsculas+clic = ampliar la franja
  const mapa = [];
  for (let h = H_MIN; h < H_MAX; h++) mapa.push([1, 2, 3, 4, 5].map(d => uniq(ss.filter(s => enFranja(s, d, h, h + 1)).map(s => s.asignatura_norm)).length));
  const max = Math.max(1, ...mapa.flat());
  $("g-mapa").innerHTML = `<table class="g-mapa"><thead><tr><th></th>${DIAS.map(d => `<th>${d}</th>`).join("")}</tr></thead><tbody>` +
    mapa.map((fila, i) => { const h = H_MIN + i; return `<tr><th>${h}:00</th>` + fila.map((n, j) => {
      const act = j + 1 === dia && h >= desde && h < hasta;
      return `<td data-d="${j + 1}" data-h="${h}" class="${act ? "act" : ""}" style="${n ? `background:rgba(220,38,38,${(0.1 + 0.6 * n / max).toFixed(2)})` : ""}" title="${DIAS[j]} ${h}:00–${h + 1}:00: ${n} asignatura(s)">${n || ""}</td>`;
    }).join("") + "</tr>"; }).join("") + "</tbody></table>" +
    '<div class="meta">Asignaturas distintas por hora para la selección. Clic en una celda: elige esa hora; mayúsculas + clic: amplía la franja en el mismo día.</div>';
  $("g-mapa").querySelectorAll("td").forEach(td => td.addEventListener("click", (ev) => {
    const d = Number(td.dataset.d), h = Number(td.dataset.h);
    if (ev.shiftKey && d === gCons.dia) { gCons.desde = Math.min(gCons.desde, h); gCons.hasta = Math.max(gCons.hasta, h + 1); }
    else { gCons.dia = d; gCons.desde = h; gCons.hasta = h + 1; }
    gControles(); gGuardar(); gDraw();
  }));

  // detalle de la franja: asignatura -> grupo/horario/aula -> hojas de horario (titulación, curso, grupo) donde aparece
  const fr = ss.filter(s => enFranja(s, dia, desde, hasta));
  const asigs = new Map();
  fr.forEach(s => {
    const a = asigs.get(s.asignatura_norm) || { nombre: s.asignatura_norm, codigo: s.codigo || "", grupos: new Map() };
    if (s.asignatura.toUpperCase() !== s.asignatura) a.nombre = s.asignatura.replace(/\s*TUTOR[IÍ]A\s*/i, "");
    const k = `${s.grupo}|${s.hora_inicio}|${s.hora_fin}|${s.aulas || s.aulas_raw}`;
    const g = a.grupos.get(k) || { s, hojas: new Set(), tutoria: false };
    g.hojas.add(`${s.titulaciones} ${s.curso}º ${s.grupo_horario}${s.semana ? " (" + s.semana + ")" : ""}`);
    g.tutoria = g.tutoria || esTutoria(s);
    a.grupos.set(k, g); asigs.set(s.asignatura_norm, a);
  });
  const lista = [...asigs.values()].sort((a, b) => sortNat(a.nombre, b.nombre));
  const nGrupos = lista.reduce((n, a) => n + a.grupos.size, 0);
  // recuento por titulación y curso marcados
  const porTC = new Map();
  fr.forEach(s => s.titulaciones.split("/").forEach(t => {
    const k = `${t}|${s.curso}`; if (!gCons.sel.includes(k)) return;
    (porTC.get(k) || porTC.set(k, new Set()).get(k)).add(s.asignatura_norm);
  }));
  const franja = `${DIAS[dia - 1]} ${desde}:00–${hasta}:00 · ${gCons.sem}º cuatrimestre`;
  $("g-resumen").innerHTML = !gCons.sel.length ? '<div class="meta">Marca al menos una titulación o curso.</div>' :
    `<div class="g-cifra"><b>${lista.length}</b> asignatura${lista.length === 1 ? "" : "s"} coinciden · ${nGrupos} grupo${nGrupos === 1 ? "" : "s"}</div><div class="meta">${franja}</div>` +
    (porTC.size ? `<div class="g-chips">${[...porTC].sort((a, b) => sortNat(a[0], b[0])).map(([k, v]) => `<span>${k.replace("|", " ")}º: <b>${v.size}</b></span>`).join("")}</div>` : "");
  $("g-resultado").innerHTML = !lista.length ? (gCons.sel.length ? `<div class="empty">Ninguna asignatura en ${franja}</div>` : "") :
    `<table class="g-tabla"><thead><tr><th>Asignatura</th><th>Grupo</th><th>Horario</th><th>Aula</th><th>Hojas de horario</th></tr></thead><tbody>` +
    lista.map(a => [...a.grupos.values()].sort((x, y) => sortNat(x.s.grupo, y.s.grupo)).map((g, i) => `<tr>` +
      (i === 0 ? `<td rowspan="${a.grupos.size}"><span class="sw" style="background:${color(g.s.asignatura_norm)}"></span>${a.nombre}${a.codigo ? ` <span class="meta">${a.codigo}</span>` : ""}</td>` : "") +
      `<td>${g.s.grupo} <span class="meta">${g.s.tipo_grupo}${g.tutoria ? " · tutoría" : ""}</span></td><td>${g.s.hora_inicio}–${g.s.hora_fin}</td>` +
      `<td>${g.s.aulas || g.s.aulas_raw || "—"}</td><td>${[...g.hojas].sort(sortNat).join(", ")}</td></tr>`).join("")).join("") +
    "</tbody></table>";
}

tInit(); aInit(); pInit(); eInit(); gInit();
})();
