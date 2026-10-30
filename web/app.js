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

// ---------- gestión: ámbito común y vistas Semana tipo, Calendario de pruebas y Buscar hueco ----------
// El ámbito dice a quién afecta lo que se mira: asignaturas de referencia, titulaciones y cursos, cursos contiguos y letras
// de grupo de horario. Las tres vistas lo comparten; el estado completo va en localStorage y en el enlace (#gestion=…).
const PR = (window.PRUEBAS && window.PRUEBAS.pruebas) || [];
const PERIODOS = (window.PRUEBAS && window.PRUEBAS.periodos) || [], NOLECT = (window.PRUEBAS && window.PRUEBAS.no_lectivos) || {};
const TIPOS_PRUEBA = ["intermedia", "laboratorio", "entrega", "final", "extraordinaria", "presentación", "otra"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const DIAS7 = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const NOMBRE_PERIODO = { clases: "clases", examenes_ordinaria: "exámenes (ordinaria)", examenes_extraordinaria: "exámenes (extraordinaria)" };
const H_MIN = 8, H_MAX = Math.max(21, ...S.map(s => Math.ceil(fin(s))));
const LSGE = "horarios-eps-gestion";
const hoyISO = () => new Date().toISOString().slice(0, 10);
const fechaLarga = (f) => { const d = new Date(f + "T12:00"); return `${DIAS7[(d.getDay() + 6) % 7]} ${d.getDate()} de ${MESES[d.getMonth()]}`; };
const fmtH = (x) => `${Math.floor(x + 1e-6)}:${String(Math.round((x - Math.floor(x + 1e-6)) * 60)).padStart(2, "0")}`;
const esTutoria = (s) => /TUTOR[IÍ]A/i.test(s.asignatura + " " + s.nota);
const enFranja = (s, dia, desde, hasta) => s.dia === dia && h2n(s.hora_inicio) < hasta && desde < fin(s);
const asigPr = (p) => p.codigo || p.asignatura || p.prueba;    // misma asignatura -> no es coincidencia
// periodo del calendario académico de una fecha (clases, exámenes…); en clases, el cuatrimestre cuyos horarios rigen
const periodoDe = (f) => PERIODOS.find(p => p.periodo !== "no_lectivo" && p.desde <= f && f <= p.hasta) || null;
// titulaciones y cursos: los de los horarios y los de los calendarios de pruebas (p. ej. másteres)
const titsGestion = uniq([...S, ...PR].flatMap(x => x.titulaciones.split("/"))).sort(sortNat);
const cursosGestion = (t) => uniq([...S, ...PR].filter(x => x.curso !== "" && x.titulaciones.split("/").includes(t)).map(x => Number(x.curso))).sort((a, b) => a - b);
const letrasCurso = (t, c) => new Set(S.filter(s => s.curso === c && s.titulaciones.split("/").includes(t)).map(s => letraDe(s.grupo_horario)).filter(Boolean));

// catálogo de asignaturas por titulación (una sigla) a partir de los horarios
const catAsig = new Map();
S.forEach(s => s.titulaciones.split("/").forEach(t => {
  const k = `${t}|${s.asignatura_norm}`;
  const a = catAsig.get(k) || { clave: k, tit: t, norm: s.asignatura_norm, nombre: s.asignatura, codigo: s.codigo || "", curso: s.curso, sems: new Set(), letras: new Set() };
  if (s.asignatura.toUpperCase() !== s.asignatura) a.nombre = s.asignatura.replace(/\s*TUTOR[IÍ]A\s*/i, "");
  a.curso = Math.min(a.curso, s.curso); a.sems.add(s.semestre);
  if (letraDe(s.grupo_horario)) a.letras.add(letraDe(s.grupo_horario));
  catAsig.set(k, a);
}));
catAsig.forEach(a => { const g = guia(a.codigo); if (g && g.asignatura) a.nombre = g.asignatura; });
const etiquetaAsig = (a) => `${a.nombre}${a.codigo ? ` <span class="meta">${a.codigo}</span>` : ""}<br><span class="meta">${a.tit} · ${a.curso}º · ${[...a.sems].sort().map(x => x + "º cuatr.").join(", ")}${a.letras.size ? " · grupos " + [...a.letras].sort().join(", ") : ""}</span>`;

const GS = {
  vista: "semana",
  ambito: { asig: [], sel: [], contiguos: false, letras: [] },   // letras: [] = todos los grupos
  semana: { sem: 1, dia: 1, desde: 9, hasta: 11, grandes: true, pequenos: true, tutorias: true },
  cal: { tipos: TIPOS_PRUEBA.slice(), modo: "grupo", solo: false, dia: "" },
  hueco: { dur: 2, hIni: 8, hFin: 21, pequenos: true, propia: true, dia: "" },
  desde: "", hasta: "",   // fechas, comunes al calendario y a la búsqueda de huecos
};
function gsMezclar(o) {
  if (!o || typeof o !== "object") return;
  ["ambito", "semana", "cal", "hueco"].forEach(k => { if (o[k]) Object.assign(GS[k], o[k]); });
  ["vista", "desde", "hasta"].forEach(k => { if (o[k] !== undefined) GS[k] = o[k]; });
}
function gsGuardar() { try { localStorage.setItem(LSGE, JSON.stringify(GS)); } catch {} }
// enlaces de las vistas anteriores (#ges, #pru, #plan), ya publicados: se convierten al estado común
function gsDesdeEnlaceAntiguo(tipo, o) {
  const fechas = () => { if (o.desde) GS.desde = o.desde; if (o.hasta) GS.hasta = o.hasta; };
  GS.ambito = { asig: [], sel: o.sel || [], contiguos: false, letras: [] };   // el enlace define todo el ámbito
  if (tipo === "ges") {
    GS.vista = "semana";
    ["sem", "dia", "desde", "hasta", "grandes", "pequenos", "tutorias"].forEach(k => { if (o[k] !== undefined) GS.semana[k] = o[k]; });
  } else if (tipo === "pru") {
    GS.vista = "calendario"; fechas();
    ["tipos", "modo", "solo", "dia"].forEach(k => { if (o[k] !== undefined) GS.cal[k] = o[k]; });
  } else if (tipo === "plan") {
    const asig = (o.asig || []).filter(k => catAsig.has(k)).map(k => catAsig.get(k));
    GS.vista = "hueco"; fechas();
    GS.ambito = { asig: asig.map(a => a.clave), sel: uniq(asig.map(a => `${a.tit}|${a.curso}`)), contiguos: o.alcance === "contiguos",
      letras: o.grupos === "todos" ? [] : uniq(asig.flatMap(a => [...a.letras])).sort() };
    ["dur", "hIni", "hFin", "pequenos", "propia", "dia"].forEach(k => { if (o[k] !== undefined) GS.hueco[k] = o[k]; });
  }
}
function gsCargar() {
  const m = location.hash.match(/^#(gestion|ges|pru|plan)=(.+)$/);
  try { const v = localStorage.getItem(LSGE); if (v) gsMezclar(JSON.parse(v)); } catch {}
  if (!m) return false;
  try {
    const o = JSON.parse(decodeURIComponent(m[2]));
    if (m[1] === "gestion") gsMezclar(o); else gsDesdeEnlaceAntiguo(m[1], o);
    return true;
  } catch { return false; }
}

// cohortes del ámbito: "TIT|curso" -> Set de letras de grupo de horario ("*" = todos). Cada titulación y curso marcado
// (y sus contiguos, si se pide) con las letras elegidas que existan en él; si no tiene ninguna, todos sus grupos.
function cohortes() {
  const A = GS.ambito, coh = new Map();
  A.sel.forEach(k => {
    const [t, c] = k.split("|"), cu = Number(c), cs = cursosGestion(t);
    (A.contiguos ? [cu - 1, cu, cu + 1] : [cu]).filter(x => cs.includes(x)).forEach(x => {
      const disp = letrasCurso(t, x), ls = A.letras.filter(l => disp.has(l));
      coh.set(`${t}|${x}`, new Set(ls.length ? ls : ["*"]));
    });
  });
  return coh;
}
const sesionEnAmbito = (s, coh) => s.titulaciones.split("/").some(t => {
  const l = coh.get(`${t}|${s.curso}`), le = letraDe(s.grupo_horario);
  return l && (l.has("*") || !le || l.has(le));
});
// titulación|curso del ámbito a los que afecta una prueba (las pruebas no indican grupo)
const cohortesPrueba = (p, coh) => p.titulaciones.split("/").map(t => `${t}|${p.curso}`).filter(k => coh.has(k));
const textoCohortes = (coh) => [...coh].sort((a, b) => sortNat(a[0], b[0])).map(([k, l]) => `${k.replace("|", " ")}º${l.has("*") ? "" : ` (${[...l].sort().join(", ")})`}`).join(", ");

// lista de titulaciones con una casilla por curso; la casilla de la titulación marca o desmarca todos sus cursos.
// tits: siglas; cursos(t): cursos de la titulación; sel: claves "SIGLA|curso" marcadas; cambio(nuevaSel): al marcar/desmarcar
function checklistTits(cont, tits, cursos, sel, cambio) {
  const marcadas = new Set(sel);
  cont.innerHTML = "";
  tits.forEach(t => {
    const cs = cursos(t), n = cs.filter(c => marcadas.has(`${t}|${c}`)).length;
    const el = document.createElement("div"); el.className = "g-tit";
    el.innerHTML = `<label class="nombre" title="${(D.titulaciones[t] || {}).nombre || ""}"><input type="checkbox" class="todo"${n === cs.length ? " checked" : ""}> <b>${t}</b></label>
      <span class="cursos">${cs.map(c => `<label><input type="checkbox" data-c="${c}"${marcadas.has(`${t}|${c}`) ? " checked" : ""}>${c}º</label>`).join("")}</span>`;
    el.querySelector(".todo").indeterminate = n > 0 && n < cs.length;
    el.querySelector(".todo").addEventListener("change", (ev) => {
      const resto = sel.filter(k => !k.startsWith(t + "|"));
      cambio(ev.target.checked ? [...resto, ...cs.map(c => `${t}|${c}`)] : resto);
    });
    el.querySelectorAll("[data-c]").forEach(cb => cb.addEventListener("change", () => {
      const k = `${t}|${cb.dataset.c}`;
      cambio(cb.checked ? [...sel, k] : sel.filter(x => x !== k));
    }));
    cont.appendChild(el);
  });
}

// ---------- panel del ámbito ----------
function amInit() {
  $("am-buscar").addEventListener("input", amBuscar);
  $("am-buscar").addEventListener("focus", amBuscar);
  $("am-todas").addEventListener("click", () => { GS.ambito.sel = titsGestion.flatMap(t => cursosGestion(t).map(c => `${t}|${c}`)); amCambio(); });
  $("am-ninguna").addEventListener("click", () => { GS.ambito.sel = []; GS.ambito.asig = []; amCambio(); });
  $("am-contiguos").addEventListener("change", (e) => { GS.ambito.contiguos = e.target.checked; amCambio(); });
  $("am-compartir").addEventListener("click", () => {
    history.replaceState(null, "", location.pathname + location.search + "#gestion=" + encodeURIComponent(JSON.stringify(GS)));
    navigator.clipboard?.writeText(location.href).then(() => alert("Enlace copiado:\n" + location.href), () => prompt("Copia el enlace:", location.href));
  });
}
function amCambio() { GS.cal.dia = ""; GS.hueco.dia = ""; gsGuardar(); amDraw(); vistaDraw(); }
function amBuscar() {
  const q = $("am-buscar").value.trim().toLowerCase(), cont = $("am-resultados");
  cont.hidden = !q;
  if (!q) return;
  const pal = q.split(/\s+/), sel = new Set(GS.ambito.asig);
  const res = [...catAsig.values()].filter(a => pal.every(p => `${a.nombre} ${a.norm} ${a.codigo} ${a.tit} ${a.curso}º`.toLowerCase().includes(p)))
    .sort((a, b) => sortNat(a.nombre, b.nombre) || sortNat(a.tit, b.tit)).slice(0, 60);
  cont.innerHTML = "";
  res.forEach(a => {
    const el = document.createElement("div"); el.className = "item";
    el.innerHTML = `<span class="sw" style="background:${color(a.norm)}"></span><span class="txt">${etiquetaAsig(a)}</span><button>${sel.has(a.clave) ? "Quitar" : "Añadir"}</button>`;
    el.addEventListener("click", () => { amAsig(a.clave); amBuscar(); });
    cont.appendChild(el);
  });
  if (!res.length) cont.innerHTML = '<div class="item meta">Sin resultados</div>';
}
// añadir una asignatura marca su titulación y curso y, si se filtra por grupos (o el ámbito estaba vacío), sus letras;
// quitarla desmarca su titulación y curso si ninguna otra asignatura de referencia los usa
function amAsig(k) {
  const A = GS.ambito, a = catAsig.get(k), tc = `${a.tit}|${a.curso}`;
  if (A.asig.includes(k)) {
    A.asig = A.asig.filter(x => x !== k);
    if (!A.asig.some(x => { const b = catAsig.get(x); return `${b.tit}|${b.curso}` === tc; })) A.sel = A.sel.filter(x => x !== tc);
  } else {
    const vacio = !A.sel.length && !A.asig.length;
    A.asig = [...A.asig, k];
    if (!A.sel.includes(tc)) A.sel = [...A.sel, tc];
    if (vacio || A.letras.length) A.letras = uniq([...A.letras, ...a.letras]).sort();
  }
  amCambio();
}
function amDraw() {
  const A = GS.ambito, coh = cohortes();
  // asignaturas de referencia
  const cont = $("am-asig"); cont.innerHTML = "";
  A.asig.forEach(k => {
    const a = catAsig.get(k); if (!a) return;
    const el = document.createElement("div"); el.className = "item";
    el.innerHTML = `<span class="sw" style="background:${color(a.norm)}"></span><span class="txt">${etiquetaAsig(a)}</span><button>Quitar</button>`;
    el.addEventListener("click", () => amAsig(k));
    cont.appendChild(el);
  });
  cont.hidden = !A.asig.length;
  $("am-na").textContent = A.asig.length ? `(${A.asig.length})` : "";
  // titulaciones y cursos
  checklistTits($("am-tits"), titsGestion, cursosGestion, A.sel, (sel) => { A.sel = sel; amCambio(); });
  $("am-n").textContent = `(${A.sel.length})`;
  $("am-contiguos").checked = A.contiguos;
  // letras de grupo presentes en los cursos del ámbito
  const presentes = uniq([...coh.keys()].flatMap(k => { const [t, c] = k.split("|"); return [...letrasCurso(t, Number(c))]; })).sort();
  const letras = uniq([...presentes, ...A.letras]).sort();
  $("am-letras").innerHTML = `<label><input type="checkbox" data-l=""${A.letras.length ? "" : " checked"}> Todos</label>` +
    letras.map(l => `<label title="Grupos ${l}: 1${l}, 2${l}… y sus subgrupos"><input type="checkbox" data-l="${l}"${A.letras.includes(l) ? " checked" : ""}> ${l}</label>`).join("");
  $("am-letras").querySelectorAll("input").forEach(cb => cb.addEventListener("change", () => {
    const l = cb.dataset.l;
    A.letras = !l ? [] : cb.checked ? uniq([...A.letras, l]).sort() : A.letras.filter(x => x !== l);
    amCambio();
  }));
  $("am-resumen").innerHTML = coh.size ? `<b>${coh.size}</b> ${coh.size === 1 ? "titulación y curso" : "titulaciones y cursos"}: ${textoCohortes(coh)}`
    : '<span class="meta">Añade asignaturas de referencia o marca titulaciones y cursos.</span>';
}

// ---------- subvistas ----------
function gestionInit() {
  const desdeUrl = gsCargar();
  GS.ambito.asig = GS.ambito.asig.filter(k => catAsig.has(k));
  if (!PR.length) {   // sin pruebas.js sólo queda la semana tipo
    document.querySelectorAll('.subtabs button[data-sub="calendario"], .subtabs button[data-sub="hueco"]').forEach(b => { b.hidden = true; });
    GS.vista = "semana";
  }
  if (!GS.desde) GS.desde = hoyISO();
  if (!GS.hasta) {   // hasta el final de los exámenes ordinarios del cuatrimestre en curso (o el siguiente)
    const ex = PERIODOS.filter(p => p.periodo === "examenes_ordinaria" && p.hasta >= GS.desde).sort((a, b) => a.hasta.localeCompare(b.hasta))[0];
    GS.hasta = ex ? ex.hasta : (PR.map(p => p.fecha).sort().pop() || GS.desde);
  }
  document.querySelectorAll(".subtabs button").forEach(b => b.addEventListener("click", () => { GS.vista = b.dataset.sub; gsGuardar(); vistaDraw(); }));
  amInit(); semInit(); calInit(); hueInit();
  if (desdeUrl) document.querySelector('.tabs button[data-view="gestion"]').click();
  amDraw(); vistaDraw();
}
function vistaDraw() {
  document.querySelectorAll(".subtabs button").forEach(b => b.classList.toggle("active", b.dataset.sub === GS.vista));
  document.querySelectorAll("#view-gestion .sub").forEach(s => { s.hidden = s.id !== "sub-" + GS.vista; });
  ({ semana: semDraw, calendario: calDraw, hueco: hueDraw })[GS.vista]();
}
const sinAmbito = (cont) => { cont.innerHTML = '<div class="meta">Define el ámbito en el panel: añade asignaturas de referencia o marca titulaciones y cursos.</div>'; };
const fijarFechas = (desde, hasta) => {
  GS.desde = desde || hoyISO(); GS.hasta = hasta && hasta >= GS.desde ? hasta : GS.desde;
  ["c", "h"].forEach(p => { $(p + "-desde").value = GS.desde; $(p + "-hasta").value = GS.hasta; });
};

// --- semana tipo: asignaturas que coinciden en una franja ---
function semInit() {
  const horas = []; for (let h = H_MIN; h <= H_MAX; h++) horas.push(h);
  fill($("s-dia"), ["1", "2", "3", "4", "5"], DIAS);
  fill($("s-desde"), horas.slice(0, -1).map(String), horas.slice(0, -1).map(h => `${h}:00`));
  fill($("s-hasta"), horas.slice(1).map(String), horas.slice(1).map(h => `${h}:00`));
  const leer = (ev) => {
    const o = GS.semana;
    o.sem = Number($("s-sem").value); o.dia = Number($("s-dia").value); o.desde = Number($("s-desde").value); o.hasta = Number($("s-hasta").value);
    if (o.hasta <= o.desde) { if (ev.target.id === "s-hasta") o.desde = o.hasta - 1; else o.hasta = o.desde + 1; }
    o.grandes = $("s-grandes").checked; o.pequenos = $("s-pequenos").checked; o.tutorias = $("s-tutorias").checked;
    gsGuardar(); semDraw();
  };
  ["s-sem", "s-dia", "s-desde", "s-hasta", "s-grandes", "s-pequenos", "s-tutorias"].forEach(id => $(id).addEventListener("change", leer));
}
function semDraw() {
  const o = GS.semana, coh = cohortes();
  $("s-sem").value = o.sem; $("s-dia").value = o.dia; $("s-desde").value = o.desde; $("s-hasta").value = o.hasta;
  $("s-grandes").checked = o.grandes; $("s-pequenos").checked = o.pequenos; $("s-tutorias").checked = o.tutorias;
  if (!coh.size) { sinAmbito($("s-resumen")); $("s-mapa").innerHTML = ""; $("s-resultado").innerHTML = ""; return; }
  const ss = S.filter(s => s.semestre == o.sem && sesionEnAmbito(s, coh)
    && (o.grandes || s.tipo_grupo !== "grande") && (o.pequenos || s.tipo_grupo !== "pequeño") && (o.tutorias || !esTutoria(s)));
  const { dia, desde, hasta } = o;
  // mapa semanal: asignaturas distintas por hora y día; clic = elegir esa hora, mayúsculas+clic = ampliar la franja
  const mapa = [];
  for (let h = H_MIN; h < H_MAX; h++) mapa.push([1, 2, 3, 4, 5].map(d => uniq(ss.filter(s => enFranja(s, d, h, h + 1)).map(s => s.asignatura_norm)).length));
  const max = Math.max(1, ...mapa.flat());
  $("s-mapa").innerHTML = `<table class="g-mapa"><thead><tr><th></th>${DIAS.map(d => `<th>${d}</th>`).join("")}</tr></thead><tbody>` +
    mapa.map((fila, i) => { const h = H_MIN + i; return `<tr><th>${h}:00</th>` + fila.map((n, j) => {
      const act = j + 1 === dia && h >= desde && h < hasta;
      return `<td data-d="${j + 1}" data-h="${h}" class="${act ? "act" : ""}" style="${n ? `background:rgba(220,38,38,${(0.1 + 0.6 * n / max).toFixed(2)})` : ""}" title="${DIAS[j]} ${h}:00–${h + 1}:00: ${n} asignatura(s)">${n || ""}</td>`;
    }).join("") + "</tr>"; }).join("") + "</tbody></table>" +
    '<div class="meta">Asignaturas distintas por hora en el ámbito. Clic en una celda: elige esa hora; mayúsculas + clic: amplía la franja en el mismo día.</div>';
  $("s-mapa").querySelectorAll("td").forEach(td => td.addEventListener("click", (ev) => {
    const d = Number(td.dataset.d), h = Number(td.dataset.h);
    if (ev.shiftKey && d === o.dia) { o.desde = Math.min(o.desde, h); o.hasta = Math.max(o.hasta, h + 1); }
    else { o.dia = d; o.desde = h; o.hasta = h + 1; }
    gsGuardar(); semDraw();
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
  const porTC = new Map();   // recuento por titulación y curso del ámbito
  fr.forEach(s => s.titulaciones.split("/").forEach(t => {
    const k = `${t}|${s.curso}`; if (!coh.has(k)) return;
    (porTC.get(k) || porTC.set(k, new Set()).get(k)).add(s.asignatura_norm);
  }));
  const franja = `${DIAS[dia - 1]} ${desde}:00–${hasta}:00 · ${o.sem}º cuatrimestre`;
  $("s-resumen").innerHTML = `<div class="g-cifra"><b>${lista.length}</b> asignatura${lista.length === 1 ? "" : "s"} coinciden · ${nGrupos} grupo${nGrupos === 1 ? "" : "s"}</div><div class="meta">${franja}</div>` +
    (porTC.size ? `<div class="g-chips">${[...porTC].sort((a, b) => sortNat(a[0], b[0])).map(([k, v]) => `<span>${k.replace("|", " ")}º: <b>${v.size}</b></span>`).join("")}</div>` : "");
  $("s-resultado").innerHTML = !lista.length ? `<div class="empty">Ninguna asignatura en ${franja}</div>` :
    `<table class="g-tabla"><thead><tr><th>Asignatura</th><th>Grupo</th><th>Horario</th><th>Aula</th><th>Hojas de horario</th></tr></thead><tbody>` +
    lista.map(a => [...a.grupos.values()].sort((x, y) => sortNat(x.s.grupo, y.s.grupo)).map((g, i) => `<tr>` +
      (i === 0 ? `<td rowspan="${a.grupos.size}"><span class="sw" style="background:${color(g.s.asignatura_norm)}"></span>${a.nombre}${a.codigo ? ` <span class="meta">${a.codigo}</span>` : ""}</td>` : "") +
      `<td>${g.s.grupo} <span class="meta">${g.s.tipo_grupo}${g.tutoria ? " · tutoría" : ""}</span></td><td>${g.s.hora_inicio}–${g.s.hora_fin}</td>` +
      `<td>${g.s.aulas || g.s.aulas_raw || "—"}</td><td>${[...g.hojas].sort(sortNat).join(", ")}</td></tr>`).join("")).join("") +
    "</tbody></table>";
}

// ---------- calendario mensual (calendario de pruebas y búsqueda de huecos) ----------
// Un bloque por mes, semanas de lunes a domingo. celda(f) -> { txt, cls, style, title, clic }; alClic(f) al pulsar un día.
function calendarioMeses(cont, desde, hasta, celda, alClic, leyenda) {
  let html = "";
  if (desde && hasta && desde <= hasta) {
    const d0 = new Date(desde + "T12:00"), d1 = new Date(hasta + "T12:00");
    for (let m = new Date(d0.getFullYear(), d0.getMonth(), 1, 12); m <= d1 && html.length < 300000; m.setMonth(m.getMonth() + 1)) {
      const y = m.getFullYear(), mo = m.getMonth(), nd = new Date(y, mo + 1, 0).getDate(), hueco = (new Date(y, mo, 1).getDay() + 6) % 7;
      let celdas = "<td></td>".repeat(hueco);
      for (let d = 1; d <= nd; d++) {
        const f = `${y}-${String(mo + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`, fuera = f < desde || f > hasta;
        const c = fuera ? {} : celda(f);
        celdas += `<td data-f="${c.clic ? f : ""}" class="${fuera ? "fuera" : ""} ${c.cls || ""}${f === hoyISO() ? " hoy" : ""}" style="${c.style || ""}"` +
          ` title="${fechaLarga(f)}${c.title ? ": " + c.title : ""}"><span class="d">${d}</span>${c.txt !== undefined && c.txt !== "" ? `<b>${c.txt}</b>` : ""}</td>`;
        if ((hueco + d) % 7 === 0) celdas += "</tr><tr>";
      }
      html += `<table class="x-mes"><caption>${MESES[mo]} ${y}</caption><thead><tr>${["L", "M", "X", "J", "V", "S", "D"].map(x => `<th>${x}</th>`).join("")}</tr></thead><tbody><tr>${celdas}</tr></tbody></table>`;
    }
  }
  cont.innerHTML = html + (leyenda ? `<div class="meta">${leyenda}</div>` : "");
  cont.querySelectorAll("td[data-f]").forEach(td => { if (td.dataset.f) td.addEventListener("click", () => alClic(td.dataset.f)); });
}

// --- calendario de pruebas: pruebas por día y coincidencias ---
function calInit() {
  $("c-tipos").innerHTML = '<span class="meta">Tipos:</span>' + TIPOS_PRUEBA.map(t => `<label class="chk"><input type="checkbox" value="${t}"> ${t}</label>`).join("");
  const leer = () => {
    const o = GS.cal;
    o.tipos = [...$("c-tipos").querySelectorAll("input:checked")].map(i => i.value);
    o.modo = $("c-modo").value; o.solo = $("c-solo").checked; o.dia = "";
    fijarFechas($("c-desde").value, $("c-hasta").value); gsGuardar(); calDraw();
  };
  ["c-desde", "c-hasta", "c-modo", "c-solo"].forEach(id => $(id).addEventListener("change", leer));
  $("c-tipos").addEventListener("change", leer);
  // calendarios publicados con problemas (enlace iCal que no es el del calendario empotrado, sin calendario…)
  const av = ((window.PRUEBAS && window.PRUEBAS.calendarios) || []).filter(c => c.aviso && !/no es de pruebas|festivos/.test(c.aviso));
  $("c-avisos").innerHTML = av.length ? `<h3>Avisos de la web de la EPS (${av.length})</h3>` + av.map(c =>
    `<div><a href="${c.url_pagina}" target="_blank" rel="noopener">${c.titulaciones} ${c.curso ? c.curso + "º" : ""}</a>: ${c.aviso}</div>`).join("") : "";
}
/* Coincidencias de un día entre pruebas de asignaturas distintas que comparten titulación y curso (modo "grupo")
   o de todo el ámbito (modo "todo"): "solape" si las horas se pisan, "mismo día" si alguna no tiene hora. */
function calCoincidencias(ps, coh) {
  const marca = new Map(), pares = [];
  for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
    const a = ps[i], b = ps[j];
    if (asigPr(a) === asigPr(b)) continue;
    const comunes = GS.cal.modo === "todo" ? cohortesPrueba(a, coh) : cohortesPrueba(a, coh).filter(k => cohortesPrueba(b, coh).includes(k));
    if (!comunes.length) continue;
    let nivel;
    if (a.dia_completo || b.dia_completo) nivel = "mismo día";
    else if (h2n(a.hora_inicio) < h2n(b.hora_fin) && h2n(b.hora_inicio) < h2n(a.hora_fin)) nivel = "solape";
    else continue;
    pares.push({ a, b, nivel, comunes });
    [a, b].forEach(p => { if (marca.get(p.id) !== "solape") marca.set(p.id, nivel); });
  }
  return { marca, pares };
}
function calDraw() {
  const o = GS.cal, coh = cohortes();
  $("c-modo").value = o.modo; $("c-solo").checked = o.solo; $("c-desde").value = GS.desde; $("c-hasta").value = GS.hasta;
  $("c-tipos").querySelectorAll("input").forEach(i => { i.checked = o.tipos.includes(i.value); });
  if (!coh.size) { sinAmbito($("c-resumen")); $("c-meses").innerHTML = ""; $("c-lista").innerHTML = ""; return; }
  const tipos = new Set(o.tipos);
  // asignaturas de referencia, por código o por nombre (una misma asignatura puede tener un código por plan)
  const sinAcentos = (x) => x.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  const refAsig = GS.ambito.asig.map(k => catAsig.get(k));
  const refCod = new Set(refAsig.map(a => a.codigo).filter(Boolean)), refNom = new Set(refAsig.map(a => sinAcentos(a.nombre)));
  const esRef = (p) => refCod.has(p.codigo) || (p.asignatura && refNom.has(sinAcentos(p.asignatura)));
  const ps = PR.filter(p => p.fecha >= GS.desde && p.fecha <= GS.hasta && tipos.has(p.tipo) && cohortesPrueba(p, coh).length);
  const porDia = new Map();
  ps.forEach(p => (porDia.get(p.fecha) || porDia.set(p.fecha, []).get(p.fecha)).push(p));
  const coinc = new Map();
  porDia.forEach((l, f) => coinc.set(f, calCoincidencias(l, coh)));
  const diasCoinc = [...coinc].filter(([, c]) => c.pares.length).length;
  const nSolapes = [...coinc.values()].reduce((n, c) => n + c.pares.filter(x => x.nivel === "solape").length, 0);
  $("c-resumen").innerHTML =
    `<div class="g-cifra"><b>${ps.length}</b> prueba${ps.length === 1 ? "" : "s"} en ${porDia.size} día${porDia.size === 1 ? "" : "s"}` +
    ` · <span class="x-sol">${nSolapes}</span> solape${nSolapes === 1 ? "" : "s"} de horario · ${diasCoinc} día${diasCoinc === 1 ? "" : "s"} con coincidencias</div>` +
    `<div class="meta">Del ${fechaLarga(GS.desde)} de ${GS.desde.slice(0, 4)} al ${fechaLarga(GS.hasta)} de ${GS.hasta.slice(0, 4)}. ` +
    `Calendarios de la EPS (fechas tentativas), generados el ${window.PRUEBAS.generado}. Las pruebas no indican grupo: cuentan todas las de cada titulación y curso.` +
    (refAsig.length ? " ★ = asignatura de referencia." : "") + "</div>";
  const max = Math.max(1, ...[...porDia.values()].map(l => l.length));
  calendarioMeses($("c-meses"), GS.desde, GS.hasta, (f) => {
    const l = porDia.get(f) || [], c = coinc.get(f);
    return { clic: l.length > 0, txt: l.length || "", style: l.length ? `background:rgba(29,78,216,${(0.08 + 0.45 * l.length / max).toFixed(2)})` : "",
      cls: (c && c.pares.some(x => x.nivel === "solape") ? "sol" : c && c.pares.length ? "mismo" : "") + (f === o.dia ? " act" : "") + (NOLECT[f] ? " nolect-borde" : ""),
      title: `${l.length} prueba(s)${c && c.pares.length ? ` · ${c.pares.length} coincidencia(s)` : ""}${NOLECT[f] ? " · " + NOLECT[f] : ""}` };
  }, (f) => { o.dia = o.dia === f ? "" : f; gsGuardar(); calDraw(); },
  "Nº de pruebas por día. Borde rojo: pruebas que se solapan en horario; ámbar: varias el mismo día (alguna sin hora). Clic en un día para verlo; otra vez para verlos todos.");
  // lista por día
  let dias = [...porDia.keys()].sort();
  if (o.dia) dias = dias.filter(f => f === o.dia);
  else if (o.solo) dias = dias.filter(f => coinc.get(f).pares.length);
  $("c-lista").innerHTML = (o.dia ? `<div class="meta"><a href="#" id="c-todos">← todos los días</a></div>` : "") + dias.map(f => {
    const l = porDia.get(f).slice().sort((a, b) => (a.hora_inicio || "99").localeCompare(b.hora_inicio || "99") || sortNat(a.titulaciones, b.titulaciones));
    const c = coinc.get(f);
    return `<div class="x-dia"><h4>${fechaLarga(f)} <span class="meta">· ${l.length} prueba${l.length === 1 ? "" : "s"}</span></h4>
      <table class="g-tabla"><thead><tr><th>Hora</th><th>Asignatura</th><th>Prueba</th><th>Titulación</th><th>Tipo</th></tr></thead><tbody>` +
      l.map(p => { const m = c.marca.get(p.id); return `<tr class="${m === "solape" ? "x-sol" : m ? "x-mismo" : ""}" title="${(p.descripcion || "").replace(/"/g, "&quot;")}">
        <td>${p.dia_completo ? '<span class="meta">sin hora</span>' : `${p.hora_inicio}–${p.hora_fin}`}</td>
        <td>${esRef(p) ? "★ " : ""}${p.asignatura ? `<span class="sw" style="background:${color(p.asignatura.toUpperCase())}"></span>${p.asignatura}${p.codigo ? ` <span class="meta">${p.codigo}</span>` : ""}` : '<span class="meta">—</span>'}</td>
        <td>${p.prueba}${p.descripcion ? ` <span class="meta">· ${p.descripcion.slice(0, 80)}</span>` : ""}</td>
        <td>${p.titulaciones} ${p.curso}º</td><td>${p.tipo}</td></tr>`; }).join("") + "</tbody></table>" +
      (c.pares.length ? `<div class="solapes">${c.pares.map(x => `<div class="${x.nivel === "solape" ? "s" : "s mismo"}">${x.nivel === "solape" ? "Solape" : "Mismo día"} (${x.comunes.map(k => k.replace("|", " ") + "º").join(", ")}): ` +
        `${x.a.asignatura || x.a.prueba}${x.a.hora_inicio ? " " + x.a.hora_inicio : ""} ↔ ${x.b.asignatura || x.b.prueba}${x.b.hora_inicio ? " " + x.b.hora_inicio : ""}</div>`).join("")}</div>` : "") + "</div>";
  }).join("") + (!dias.length ? '<div class="empty">Sin pruebas con estos filtros</div>' : "");
  $("c-todos")?.addEventListener("click", (e) => { e.preventDefault(); o.dia = ""; gsGuardar(); calDraw(); });
}

// --- buscar hueco: franjas sin clases ni pruebas para poner una prueba ---
const durTxt = () => ({ 0.5: "30 min", 1.5: "1 h 30", 2.5: "2 h 30" })[GS.hueco.dur] || `${GS.hueco.dur} h`;
function hueInit() {
  fill($("h-dur"), ["0.5", "1", "1.5", "2", "2.5", "3", "4"], ["30 min", "1 h", "1 h 30", "2 h", "2 h 30", "3 h", "4 h"]);
  const horas = []; for (let h = 8; h <= 22; h++) horas.push(String(h));
  fill($("h-hini"), horas.slice(0, -1), horas.slice(0, -1).map(h => h + ":00"));
  fill($("h-hfin"), horas.slice(1), horas.slice(1).map(h => h + ":00"));
  const leer = () => {
    const o = GS.hueco;
    o.dur = Number($("h-dur").value); o.hIni = Number($("h-hini").value); o.hFin = Number($("h-hfin").value);
    if (o.hFin <= o.hIni) o.hFin = o.hIni + 1;
    o.pequenos = $("h-pequenos").checked; o.propia = $("h-propia").checked;
    fijarFechas($("h-desde").value, $("h-hasta").value); gsGuardar(); hueDraw();
  };
  ["h-dur", "h-hini", "h-hfin", "h-desde", "h-hasta", "h-pequenos", "h-propia"].forEach(id => $(id).addEventListener("change", leer));
}
// ocupación de un día: clases (según el cuatrimestre en clases) y pruebas del ámbito; franjas libres
function hueDia(f, coh) {
  const o = GS.hueco, dow = new Date(f + "T12:00").getDay(), dia = (dow + 6) % 7 + 1;
  const per = periodoDe(f), propias = new Set(GS.ambito.asig.map(k => catAsig.get(k).norm));
  const r = { f, nolect: dia > 5 ? (dia === 6 ? "sábado" : "domingo") : NOLECT[f] || "", per, clases: [], pruebas: [], sinHora: [], libres: [] };
  if (r.nolect) return r;
  if (per && per.periodo === "clases") {
    r.clases = dedupe(S.filter(s => s.semestre == per.cuatrimestre && s.dia === dia && sesionEnAmbito(s, coh)
      && (o.pequenos || s.tipo_grupo !== "pequeño") && !(o.propia && propias.has(s.asignatura_norm))));
  }
  PR.filter(p => p.fecha === f && cohortesPrueba(p, coh).length).forEach(p => (p.dia_completo ? r.sinHora : r.pruebas).push(p));
  // huecos de al menos la duración pedida entre hIni y hFin
  const ocup = [...r.clases.map(s => [h2n(s.hora_inicio), fin(s)]), ...r.pruebas.map(p => [h2n(p.hora_inicio), h2n(p.hora_fin)])]
    .map(([a, b]) => [Math.max(a, o.hIni), Math.min(b, o.hFin)]).filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]);
  let t = o.hIni;
  ocup.forEach(([a, b]) => { if (a - t >= o.dur - 1e-6) r.libres.push([t, a]); t = Math.max(t, b); });
  if (o.hFin - t >= o.dur - 1e-6) r.libres.push([t, o.hFin]);
  r.estado = !r.libres.length ? "rojo" : r.sinHora.length ? "naranja" : "verde";
  return r;
}
function hueDraw() {
  const o = GS.hueco, coh = cohortes();
  $("h-dur").value = String(o.dur); $("h-hini").value = o.hIni; $("h-hfin").value = o.hFin;
  $("h-pequenos").checked = o.pequenos; $("h-propia").checked = o.propia; $("h-desde").value = GS.desde; $("h-hasta").value = GS.hasta;
  $("h-propia").parentElement.style.display = GS.ambito.asig.length ? "" : "none";
  if (!coh.size) { sinAmbito($("h-resumen")); $("h-meses").innerHTML = ""; $("h-detalle").innerHTML = ""; return; }
  const dias = new Map();
  for (let d = new Date(GS.desde + "T12:00"), d1 = new Date(GS.hasta + "T12:00"); d <= d1 && dias.size < 400; d.setDate(d.getDate() + 1)) {
    const f = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    dias.set(f, hueDia(f, coh));
  }
  const n = { verde: 0, naranja: 0, rojo: 0 };
  dias.forEach(r => { if (r.estado) n[r.estado]++; });
  $("h-resumen").innerHTML = `<div class="g-cifra"><span class="f-n verde">${n.verde}</span> días con franjas libres · <span class="f-n naranja">${n.naranja}</span> con pruebas sin hora · <span class="f-n rojo">${n.rojo}</span> sin franjas</div>` +
    `<div class="meta">Prueba de ${durTxt()} entre las ${o.hIni}:00 y las ${o.hFin}:00, frente a las clases y pruebas de ${textoCohortes(coh)}. ` +
    `Clases según los horarios publicados y el calendario académico de la UAH (clases: ${PERIODOS.filter(p => p.periodo === "clases").map(p => `${p.cuatrimestre}º cuatr. ${p.desde.slice(8)}/${p.desde.slice(5, 7)}–${p.hasta.slice(8)}/${p.hasta.slice(5, 7)}`).join(", ")}).</div>`;
  calendarioMeses($("h-meses"), GS.desde, GS.hasta, (f) => {
    const r = dias.get(f);
    if (!r) return {};
    if (r.nolect) return { cls: "nolect", title: r.nolect };
    return { clic: true, cls: `f-${r.estado}${f === o.dia ? " act" : ""}`, txt: r.libres.length || "",
      title: `${r.libres.length} franja(s) libre(s) · ${r.clases.length} clase(s) · ${r.pruebas.length + r.sinHora.length} prueba(s)${r.per ? " · " + NOMBRE_PERIODO[r.per.periodo] : ""}` };
  }, (f) => { o.dia = o.dia === f ? "" : f; gsGuardar(); hueDraw(); },
  "Verde: hay franjas libres (sin clases ni pruebas); naranja: hay franjas libres si las pruebas sin hora de ese día se hacen fuera de ellas; rojo: sin franjas; gris: no lectivo. El número es el de franjas libres. Clic en un día para ver el detalle.");
  const r = dias.get(o.dia);
  $("h-detalle").innerHTML = r && !r.nolect ? hueDetalle(r) : '<div class="meta">Pulsa un día del calendario para ver sus franjas libres, clases y pruebas.</div>';
}
function hueDetalle(r) {
  const o = GS.hueco, span = o.hFin - o.hIni, pos = (a, b) => `left:${((a - o.hIni) / span * 100).toFixed(2)}%;width:${((b - a) / span * 100).toFixed(2)}%`;
  const recorta = (a, b) => [Math.max(a, o.hIni), Math.min(b, o.hFin)];
  const marcas = []; for (let h = o.hIni; h <= o.hFin; h++) marcas.push(`<span style="left:${((h - o.hIni) / span * 100).toFixed(2)}%">${h}</span>`);
  const barras = [
    ...r.libres.map(([a, b]) => `<div class="f-seg libre" style="${pos(a, b)}" title="Libre ${fmtH(a)}–${fmtH(b)}"></div>`),
    ...r.clases.map(s => recorta(h2n(s.hora_inicio), fin(s))).filter(([a, b]) => b > a).map(([a, b]) => `<div class="f-seg clase" style="${pos(a, b)}"></div>`),
    ...r.pruebas.map(p => recorta(h2n(p.hora_inicio), h2n(p.hora_fin))).filter(([a, b]) => b > a).map(([a, b]) => `<div class="f-seg prueba" style="${pos(a, b)}"></div>`),
  ].join("");
  const estado = { verde: "Hay franjas libres", naranja: "Hay franjas libres si las pruebas sin hora se hacen fuera de ellas", rojo: "No hay franjas libres" }[r.estado];
  return `<div class="x-dia"><h4>${fechaLarga(r.f)} <span class="meta">· ${r.per ? NOMBRE_PERIODO[r.per.periodo] + (r.per.cuatrimestre ? ` del ${r.per.cuatrimestre}º cuatrimestre` : "") : "fuera de los periodos de clases y exámenes"}</span></h4>
    <div class="f-estado f-${r.estado}">${estado}${r.libres.length ? ": " + r.libres.map(([a, b]) => `<b>${fmtH(a)}–${fmtH(b)}</b>`).join(", ") : ""}</div>
    <div class="f-linea"><div class="f-barra">${barras}</div><div class="f-marcas">${marcas.join("")}</div></div>
    <div class="meta"><span class="f-ley libre"></span> libre (al menos ${durTxt()}) <span class="f-ley clase"></span> clase <span class="f-ley prueba"></span> prueba con hora</div>` +
    (r.sinHora.length ? `<h4>Pruebas sin hora</h4><table class="g-tabla"><tbody>${r.sinHora.map(p => `<tr class="x-mismo"><td>${p.asignatura || "—"}</td><td>${p.prueba}${p.descripcion ? ` <span class="meta">· ${p.descripcion.slice(0, 80)}</span>` : ""}</td><td>${p.titulaciones} ${p.curso}º</td></tr>`).join("")}</tbody></table>` : "") +
    (r.pruebas.length ? `<h4>Pruebas</h4><table class="g-tabla"><tbody>${r.pruebas.map(p => `<tr class="x-sol"><td>${p.hora_inicio}–${p.hora_fin}</td><td>${p.asignatura || "—"}</td><td>${p.prueba}</td><td>${p.titulaciones} ${p.curso}º</td></tr>`).join("")}</tbody></table>` : "") +
    (r.clases.length ? `<h4>Clases (${r.clases.length})</h4><table class="g-tabla"><thead><tr><th>Hora</th><th>Asignatura</th><th>Grupo</th><th>Aula</th><th>Hoja</th></tr></thead><tbody>` +
      r.clases.slice().sort((a, b) => h2n(a.hora_inicio) - h2n(b.hora_inicio) || sortNat(a.grupo, b.grupo)).map(s =>
        `<tr><td>${s.hora_inicio}–${s.hora_fin}</td><td><span class="sw" style="background:${color(s.asignatura_norm)}"></span>${s.asignatura}</td><td>${s.grupo} <span class="meta">${s.tipo_grupo}</span></td><td>${s.aulas || s.aulas_raw || "—"}</td><td>${s.titulaciones} ${s.curso}º ${s.grupo_horario}</td></tr>`).join("") + "</tbody></table>" :
      `<div class="meta">${r.per && r.per.periodo === "clases" ? "Sin clases del ámbito este día." : "Sin clases (periodo sin docencia)."}</div>`) + "</div>";
}

tInit(); aInit(); pInit(); eInit(); gestionInit();
})();
