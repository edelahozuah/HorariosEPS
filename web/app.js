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
function gTits() {
  checklistTits($("g-tits"), siglasTit(), cursosDe, gCons.sel, (sel) => { gCons.sel = sel; gTits(); gGuardar(); gDraw(); });
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

// ---------- calendario mensual (vistas Pruebas y Planificar) ----------
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

// ---------- vista pruebas: calendario de pruebas de evaluación (web/pruebas.js, opcional) ----------
// Consulta: { desde, hasta (AAAA-MM-DD), sel: ["GITT|3", ...], tipos: [...], modo: "grupo" | "todo", solo, dia }
const PR = (window.PRUEBAS && window.PRUEBAS.pruebas) || [];
const LSX = "horarios-eps-pruebas";
const TIPOS_PRUEBA = ["intermedia", "laboratorio", "entrega", "final", "extraordinaria", "presentación", "otra"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const DIAS7 = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const hoyISO = () => new Date().toISOString().slice(0, 10);
const fechaLarga = (f) => { const d = new Date(f + "T12:00"); return `${DIAS7[(d.getDay() + 6) % 7]} ${d.getDate()} de ${MESES[d.getMonth()]}`; };
const siglasPr = () => uniq(PR.flatMap(p => p.titulaciones.split("/"))).sort(sortNat);
const cursosPr = (t) => uniq(PR.filter(p => p.titulaciones.split("/").includes(t)).map(p => p.curso)).sort();
const asigPr = (p) => p.codigo || p.asignatura || p.prueba;    // misma asignatura -> no es coincidencia
let xCons = { desde: "", hasta: "", sel: [], tipos: TIPOS_PRUEBA.slice(), modo: "grupo", solo: false, dia: "" };

function xGuardar() { try { localStorage.setItem(LSX, JSON.stringify(xCons)); } catch {} }
function xCargar() {
  const m = location.hash.match(/^#pru=(.+)$/);
  try { if (m) { Object.assign(xCons, JSON.parse(decodeURIComponent(m[1]))); return true; } } catch {}
  try { const v = localStorage.getItem(LSX); if (v) Object.assign(xCons, JSON.parse(v)); } catch {}
  return false;
}
// cohortes (titulación|curso marcadas) a las que afecta una prueba
const cohortes = (p, sel) => p.titulaciones.split("/").map(t => `${t}|${p.curso}`).filter(k => sel.has(k));

function xInit() {
  if (!PR.length) { document.querySelector('.tabs button[data-view="pruebas"]').hidden = true; return; }
  const fechas = PR.map(p => p.fecha).sort();
  $("x-curso").textContent = window.PRUEBAS.curso_academico || "";
  const desdeUrl = xCargar();
  if (!xCons.desde) xCons.desde = hoyISO() > fechas[0] ? hoyISO() : fechas[0];
  if (!xCons.hasta) xCons.hasta = fechas[fechas.length - 1];
  if (!xCons.sel.length) xCons.sel = siglasPr().flatMap(t => cursosPr(t).map(c => `${t}|${c}`));
  $("x-tipos").innerHTML = TIPOS_PRUEBA.map(t => `<label><input type="checkbox" value="${t}"> ${t}</label>`).join("");
  xTits(); xControles();
  const leer = () => {
    xCons.desde = $("x-desde").value || fechas[0]; xCons.hasta = $("x-hasta").value || fechas[fechas.length - 1];
    xCons.tipos = [...$("x-tipos").querySelectorAll("input:checked")].map(i => i.value);
    xCons.modo = $("x-modo").value; xCons.solo = $("x-solo").checked; xCons.dia = "";
    xGuardar(); xDraw();
  };
  ["x-desde", "x-hasta", "x-modo", "x-solo"].forEach(id => $(id).addEventListener("change", leer));
  $("x-tipos").addEventListener("change", leer);
  $("x-todas").addEventListener("click", () => { xCons.sel = siglasPr().flatMap(t => cursosPr(t).map(c => `${t}|${c}`)); xTits(); xGuardar(); xDraw(); });
  $("x-ninguna").addEventListener("click", () => { xCons.sel = []; xTits(); xGuardar(); xDraw(); });
  $("x-compartir").addEventListener("click", () => {
    history.replaceState(null, "", location.pathname + location.search + "#pru=" + encodeURIComponent(JSON.stringify(xCons)));
    navigator.clipboard?.writeText(location.href).then(() => alert("Enlace copiado:\n" + location.href), () => prompt("Copia el enlace:", location.href));
  });
  // calendarios publicados con problemas (enlace iCal que no es el del calendario empotrado, sin calendario…)
  const av = (window.PRUEBAS.calendarios || []).filter(c => c.aviso && !/no es de pruebas/.test(c.aviso));
  $("x-avisos").innerHTML = av.length ? `<h3>Avisos de la web (${av.length})</h3>` + av.map(c =>
    `<div><a href="${c.url_pagina}" target="_blank" rel="noopener">${c.titulaciones} ${c.curso ? c.curso + "º" : ""}</a>: ${c.aviso}</div>`).join("") : "";
  if (desdeUrl) document.querySelector('.tabs button[data-view="pruebas"]').click();
  xDraw();
}
function xControles() {
  $("x-desde").value = xCons.desde; $("x-hasta").value = xCons.hasta; $("x-modo").value = xCons.modo; $("x-solo").checked = xCons.solo;
  $("x-tipos").querySelectorAll("input").forEach(i => { i.checked = xCons.tipos.includes(i.value); });
}
function xTits() {
  checklistTits($("x-tits"), siglasPr(), cursosPr, xCons.sel, (sel) => { xCons.sel = sel; xTits(); xGuardar(); xDraw(); });
  $("x-n").textContent = `(${xCons.sel.length})`;
}
/* Coincidencias de un día entre pruebas de asignaturas distintas que comparten titulación y curso (modo "grupo")
   o de toda la selección (modo "todo"): "solape" si las horas se pisan, "mismo día" si alguna no tiene hora. */
function xCoincidencias(ps, sel) {
  const marca = new Map(), pares = [];
  for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
    const a = ps[i], b = ps[j];
    if (asigPr(a) === asigPr(b)) continue;
    const comunes = xCons.modo === "todo" ? cohortes(a, sel) : cohortes(a, sel).filter(k => cohortes(b, sel).includes(k));
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
function xDraw() {
  const sel = new Set(xCons.sel), tipos = new Set(xCons.tipos);
  const ps = PR.filter(p => p.fecha >= xCons.desde && p.fecha <= xCons.hasta && tipos.has(p.tipo) && cohortes(p, sel).length);
  const porDia = new Map();
  ps.forEach(p => (porDia.get(p.fecha) || porDia.set(p.fecha, []).get(p.fecha)).push(p));
  const coinc = new Map();
  porDia.forEach((l, f) => coinc.set(f, xCoincidencias(l, sel)));
  const diasCoinc = [...coinc].filter(([, c]) => c.pares.length).length;
  const nSolapes = [...coinc.values()].reduce((n, c) => n + c.pares.filter(x => x.nivel === "solape").length, 0);
  $("x-resumen").innerHTML = !xCons.sel.length ? '<div class="meta">Marca al menos una titulación o curso.</div>' :
    `<div class="g-cifra"><b>${ps.length}</b> prueba${ps.length === 1 ? "" : "s"} en ${porDia.size} día${porDia.size === 1 ? "" : "s"}` +
    ` · <span class="x-sol">${nSolapes}</span> solape${nSolapes === 1 ? "" : "s"} de horario · ${diasCoinc} día${diasCoinc === 1 ? "" : "s"} con coincidencias</div>` +
    `<div class="meta">Del ${fechaLarga(xCons.desde)} de ${xCons.desde.slice(0, 4)} al ${fechaLarga(xCons.hasta)} de ${xCons.hasta.slice(0, 4)}. Datos de los calendarios de la EPS (fechas tentativas), generados el ${window.PRUEBAS.generado}.</div>`;

  const max = Math.max(1, ...[...porDia.values()].map(l => l.length));
  calendarioMeses($("x-meses"), xCons.desde, xCons.hasta, (f) => {
    const l = porDia.get(f) || [], c = coinc.get(f);
    return { clic: l.length > 0, txt: l.length || "", style: l.length ? `background:rgba(29,78,216,${(0.08 + 0.45 * l.length / max).toFixed(2)})` : "",
      cls: (c && c.pares.some(x => x.nivel === "solape") ? "sol" : c && c.pares.length ? "mismo" : "") + (f === xCons.dia ? " act" : ""),
      title: `${l.length} prueba(s)${c && c.pares.length ? ` · ${c.pares.length} coincidencia(s)` : ""}` };
  }, (f) => { xCons.dia = xCons.dia === f ? "" : f; xDraw(); },
  "Nº de pruebas por día. Borde rojo: pruebas que se solapan en horario; ámbar: varias el mismo día (alguna sin hora). Clic en un día para verlo; otra vez para verlos todos.");

  // lista por día
  let dias = [...porDia.keys()].sort();
  if (xCons.dia) dias = dias.filter(f => f === xCons.dia);
  else if (xCons.solo) dias = dias.filter(f => coinc.get(f).pares.length);
  $("x-lista").innerHTML = (xCons.dia ? `<div class="meta"><a href="#" id="x-todos">← todos los días</a></div>` : "") + dias.map(f => {
    const l = porDia.get(f).slice().sort((a, b) => (a.hora_inicio || "99").localeCompare(b.hora_inicio || "99") || sortNat(a.titulaciones, b.titulaciones));
    const c = coinc.get(f);
    return `<div class="x-dia"><h4>${fechaLarga(f)} <span class="meta">· ${l.length} prueba${l.length === 1 ? "" : "s"}</span></h4>
      <table class="g-tabla"><thead><tr><th>Hora</th><th>Asignatura</th><th>Prueba</th><th>Titulación</th><th>Tipo</th></tr></thead><tbody>` +
      l.map(p => { const m = c.marca.get(p.id); return `<tr class="${m === "solape" ? "x-sol" : m ? "x-mismo" : ""}" title="${(p.descripcion || "").replace(/"/g, "&quot;")}">
        <td>${p.dia_completo ? '<span class="meta">sin hora</span>' : `${p.hora_inicio}–${p.hora_fin}`}</td>
        <td>${p.asignatura ? `<span class="sw" style="background:${color(p.asignatura.toUpperCase())}"></span>${p.asignatura}${p.codigo ? ` <span class="meta">${p.codigo}</span>` : ""}` : '<span class="meta">—</span>'}</td>
        <td>${p.prueba}${p.descripcion ? ` <span class="meta">· ${p.descripcion.slice(0, 80)}</span>` : ""}</td>
        <td>${p.titulaciones} ${p.curso}º</td><td>${p.tipo}</td></tr>`; }).join("") + "</tbody></table>" +
      (c.pares.length ? `<div class="solapes">${c.pares.map(x => `<div class="${x.nivel === "solape" ? "s" : "s mismo"}">${x.nivel === "solape" ? "Solape" : "Mismo día"} (${x.comunes.map(k => k.replace("|", " ") + "º").join(", ")}): ` +
        `${x.a.asignatura || x.a.prueba}${x.a.hora_inicio ? " " + x.a.hora_inicio : ""} ↔ ${x.b.asignatura || x.b.prueba}${x.b.hora_inicio ? " " + x.b.hora_inicio : ""}</div>`).join("")}</div>` : "") + "</div>";
  }).join("") + (!dias.length && xCons.sel.length ? '<div class="empty">Sin pruebas con estos filtros</div>' : "");
  $("x-todos")?.addEventListener("click", (e) => { e.preventDefault(); xCons.dia = ""; xDraw(); });
}

// ---------- vista planificar: franjas libres para una prueba (sin clases ni otras pruebas) ----------
// Consulta: { asig: ["GIT|ARQUITECTURA DE COMPUTADORES", ...], alcance: "curso" | "contiguos", grupos: "asig" | "todos",
//             pequenos, propia, dur (h), hIni, hFin, desde, hasta, dia }
const PERIODOS = (window.PRUEBAS && window.PRUEBAS.periodos) || [], NOLECT = (window.PRUEBAS && window.PRUEBAS.no_lectivos) || {};
const LSF = "horarios-eps-planificar";
let fCons = { asig: [], alcance: "curso", grupos: "asig", pequenos: true, propia: true, dur: 2, hIni: 8, hFin: 21, desde: "", hasta: "", dia: "" };
const durTxt = () => ({ 0.5: "30 min", 1.5: "1 h 30", 2.5: "2 h 30" })[fCons.dur] || `${fCons.dur} h`;
const fmtH = (x) => `${Math.floor(x + 1e-6)}:${String(Math.round((x - Math.floor(x + 1e-6)) * 60)).padStart(2, "0")}`;
// periodo del calendario académico de una fecha (clases, exámenes…); en clases, el cuatrimestre cuyos horarios rigen
const periodoDe = (f) => PERIODOS.find(p => p.periodo !== "no_lectivo" && p.desde <= f && f <= p.hasta) || null;
const NOMBRE_PERIODO = { clases: "clases", examenes_ordinaria: "exámenes (ordinaria)", examenes_extraordinaria: "exámenes (extraordinaria)" };

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

function fGuardar() { try { localStorage.setItem(LSF, JSON.stringify(fCons)); } catch {} }
function fCargar() {
  const m = location.hash.match(/^#plan=(.+)$/);
  try { if (m) { Object.assign(fCons, JSON.parse(decodeURIComponent(m[1]))); return true; } } catch {}
  try { const v = localStorage.getItem(LSF); if (v) Object.assign(fCons, JSON.parse(v)); } catch {}
  return false;
}
function fInit() {
  if (!PR.length) { document.querySelector('.tabs button[data-view="planificar"]').hidden = true; return; }
  fill($("f-dur"), ["0.5", "1", "1.5", "2", "2.5", "3", "4"], ["30 min", "1 h", "1 h 30", "2 h", "2 h 30", "3 h", "4 h"]);
  const horas = []; for (let h = 8; h <= 22; h++) horas.push(String(h));
  fill($("f-hini"), horas.slice(0, -1), horas.slice(0, -1).map(h => h + ":00"));
  fill($("f-hfin"), horas.slice(1), horas.slice(1).map(h => h + ":00"));
  const desdeUrl = fCargar();
  fCons.asig = fCons.asig.filter(k => catAsig.has(k));
  if (!fCons.desde) fCons.desde = hoyISO();
  if (!fCons.hasta) {   // hasta el final de los exámenes ordinarios del cuatrimestre en curso (o el siguiente)
    const ex = PERIODOS.filter(p => p.periodo === "examenes_ordinaria" && p.hasta >= fCons.desde).sort((a, b) => a.hasta.localeCompare(b.hasta))[0];
    fCons.hasta = ex ? ex.hasta : PR.map(p => p.fecha).sort().pop();
  }
  fControles(); fSeleccion();
  const leer = () => {
    fCons.alcance = $("f-alcance").value; fCons.grupos = $("f-grupos").value;
    fCons.pequenos = $("f-pequenos").checked; fCons.propia = $("f-propia").checked;
    fCons.dur = Number($("f-dur").value); fCons.hIni = Number($("f-hini").value); fCons.hFin = Number($("f-hfin").value);
    if (fCons.hFin <= fCons.hIni) fCons.hFin = fCons.hIni + 1;
    fCons.desde = $("f-desde").value || hoyISO(); fCons.hasta = $("f-hasta").value || fCons.desde;
    fControles(); fGuardar(); fDraw();
  };
  ["f-alcance", "f-grupos", "f-pequenos", "f-propia", "f-dur", "f-hini", "f-hfin", "f-desde", "f-hasta"].forEach(id => $(id).addEventListener("change", leer));
  $("f-buscar").addEventListener("input", fBuscar);
  $("f-compartir").addEventListener("click", () => {
    history.replaceState(null, "", location.pathname + location.search + "#plan=" + encodeURIComponent(JSON.stringify(fCons)));
    navigator.clipboard?.writeText(location.href).then(() => alert("Enlace copiado:\n" + location.href), () => prompt("Copia el enlace:", location.href));
  });
  if (desdeUrl) document.querySelector('.tabs button[data-view="planificar"]').click();
  fBuscar(); fDraw();
}
function fControles() {
  $("f-alcance").value = fCons.alcance; $("f-grupos").value = fCons.grupos; $("f-pequenos").checked = fCons.pequenos; $("f-propia").checked = fCons.propia;
  $("f-dur").value = String(fCons.dur); $("f-hini").value = fCons.hIni; $("f-hfin").value = fCons.hFin;
  $("f-desde").value = fCons.desde; $("f-hasta").value = fCons.hasta;
}
const etiquetaAsig = (a) => `${a.nombre}${a.codigo ? ` <span class="meta">${a.codigo}</span>` : ""}<br><span class="meta">${a.tit} · ${a.curso}º · ${[...a.sems].sort().map(x => x + "º cuatr.").join(", ")}</span>`;
function fBuscar() {
  const q = $("f-buscar").value.trim().toLowerCase(), cont = $("f-resultados");
  if (!q) { cont.innerHTML = '<div class="item meta">Escribe para buscar y pulsa para añadir. Puedes añadir la misma asignatura en varias titulaciones.</div>'; return; }
  const pal = q.split(/\s+/), sel = new Set(fCons.asig);
  const res = [...catAsig.values()].filter(a => pal.every(p => `${a.nombre} ${a.norm} ${a.codigo} ${a.tit} ${a.curso}º`.toLowerCase().includes(p)))
    .sort((a, b) => sortNat(a.nombre, b.nombre) || sortNat(a.tit, b.tit)).slice(0, 60);
  cont.innerHTML = "";
  res.forEach(a => {
    const el = document.createElement("div"); el.className = "item";
    el.innerHTML = `<span class="sw" style="background:${color(a.norm)}"></span><span class="txt">${etiquetaAsig(a)}</span><button>${sel.has(a.clave) ? "Quitar" : "Añadir"}</button>`;
    el.addEventListener("click", () => { fToggle(a.clave); fBuscar(); });
    cont.appendChild(el);
  });
  if (!res.length) cont.innerHTML = '<div class="item meta">Sin resultados</div>';
}
function fToggle(k) {
  fCons.asig = fCons.asig.includes(k) ? fCons.asig.filter(x => x !== k) : [...fCons.asig, k];
  fCons.dia = ""; fGuardar(); fSeleccion(); fDraw();
}
function fSeleccion() {
  const cont = $("f-seleccion"); cont.innerHTML = "";
  fCons.asig.forEach(k => {
    const a = catAsig.get(k), el = document.createElement("div"); el.className = "item";
    el.innerHTML = `<span class="sw" style="background:${color(a.norm)}"></span><span class="txt">${etiquetaAsig(a)}</span><button>Quitar</button>`;
    el.addEventListener("click", () => { fToggle(k); fBuscar(); });
    cont.appendChild(el);
  });
  cont.hidden = !fCons.asig.length;
  $("f-n").textContent = `(${fCons.asig.length})`;
}
// cohortes afectadas: titulación|curso (con los contiguos si se pide) y, por cohorte, letras de grupo de horario
function fCohortes() {
  const coh = new Map();   // "GIT|3" -> Set(letras) ("*" = todos los grupos)
  fCons.asig.map(k => catAsig.get(k)).forEach(a => {
    const cursos = fCons.alcance === "contiguos" ? [a.curso - 1, a.curso, a.curso + 1] : [a.curso];
    cursos.filter(c => cursosDe(a.tit).includes(c)).forEach(c => {
      const k = `${a.tit}|${c}`, s = coh.get(k) || new Set();
      // misma letra que los grupos de la asignatura; si el curso no tiene ninguno con esas letras, todos sus grupos
      const letrasCurso = new Set(S.filter(x => x.curso === c && x.titulaciones.split("/").includes(a.tit)).map(x => letraDe(x.grupo_horario)));
      if (fCons.grupos === "todos" || ![...a.letras].some(l => letrasCurso.has(l))) s.add("*"); else a.letras.forEach(l => s.add(l));
      coh.set(k, s);
    });
  });
  return coh;
}
// ocupación de un día: clases (según el cuatrimestre en clases) y pruebas de las cohortes; franjas libres
function fDia(f, coh) {
  const dow = new Date(f + "T12:00").getDay(), dia = (dow + 6) % 7 + 1;
  const per = periodoDe(f), propias = new Set(fCons.asig.map(k => catAsig.get(k).norm));
  const r = { f, nolect: dia > 5 ? (dia === 6 ? "sábado" : "domingo") : NOLECT[f] || "", per, clases: [], pruebas: [], sinHora: [], libres: [] };
  if (r.nolect) return r;
  if (per && per.periodo === "clases") {
    r.clases = dedupe(S.filter(s => s.semestre == per.cuatrimestre && s.dia === dia
      && (fCons.pequenos || s.tipo_grupo !== "pequeño") && !(fCons.propia && propias.has(s.asignatura_norm))
      && s.titulaciones.split("/").some(t => { const l = coh.get(`${t}|${s.curso}`); return l && (l.has("*") || l.has(letraDe(s.grupo_horario)) || !letraDe(s.grupo_horario)); })));
  }
  PR.filter(p => p.fecha === f && p.titulaciones.split("/").some(t => coh.has(`${t}|${p.curso}`)))
    .forEach(p => (p.dia_completo ? r.sinHora : r.pruebas).push(p));
  // huecos de al menos la duración pedida entre hIni y hFin
  const ocup = [...r.clases.map(s => [h2n(s.hora_inicio), fin(s)]), ...r.pruebas.map(p => [h2n(p.hora_inicio), h2n(p.hora_fin)])]
    .map(([a, b]) => [Math.max(a, fCons.hIni), Math.min(b, fCons.hFin)]).filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]);
  let t = fCons.hIni;
  ocup.forEach(([a, b]) => { if (a - t >= fCons.dur - 1e-6) r.libres.push([t, a]); t = Math.max(t, b); });
  if (fCons.hFin - t >= fCons.dur - 1e-6) r.libres.push([t, fCons.hFin]);
  r.estado = !r.libres.length ? "rojo" : r.sinHora.length ? "naranja" : "verde";
  return r;
}
function fDraw() {
  if (!fCons.asig.length) {
    $("f-resumen").innerHTML = '<div class="meta">Busca y añade la asignatura (o asignaturas) para la que quieres poner la prueba.</div>';
    $("f-meses").innerHTML = ""; $("f-detalle").innerHTML = ""; return;
  }
  const coh = fCohortes(), dias = new Map();
  for (let d = new Date(fCons.desde + "T12:00"), d1 = new Date(fCons.hasta + "T12:00"); d <= d1 && dias.size < 400; d.setDate(d.getDate() + 1)) {
    const f = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    dias.set(f, fDia(f, coh));
  }
  const n = { verde: 0, naranja: 0, rojo: 0 };
  dias.forEach(r => { if (r.estado) n[r.estado]++; });
  $("f-resumen").innerHTML = `<div class="g-cifra"><span class="f-n verde">${n.verde}</span> días con franjas libres · <span class="f-n naranja">${n.naranja}</span> con pruebas sin hora · <span class="f-n rojo">${n.rojo}</span> sin franjas</div>` +
    `<div class="meta">Prueba de ${durTxt()} entre las ${fCons.hIni}:00 y las ${fCons.hFin}:00. Se comparan las clases y pruebas de ` +
    [...coh].map(([k, l]) => `${k.replace("|", " ")}º${l.has("*") ? "" : ` (grupos ${[...l].sort().join(", ")})`}`).join(", ") +
    `. Clases según los horarios publicados y el calendario académico de la UAH (clases: ${PERIODOS.filter(p => p.periodo === "clases").map(p => `${p.cuatrimestre}º cuatr. ${p.desde.slice(8)}/${p.desde.slice(5, 7)}–${p.hasta.slice(8)}/${p.hasta.slice(5, 7)}`).join(", ")}).</div>`;
  calendarioMeses($("f-meses"), fCons.desde, fCons.hasta, (f) => {
    const r = dias.get(f);
    if (!r) return {};
    if (r.nolect) return { cls: "nolect", title: r.nolect };
    return { clic: true, cls: `f-${r.estado}${f === fCons.dia ? " act" : ""}`, txt: r.libres.length || "",
      title: `${r.libres.length} franja(s) libre(s) · ${r.clases.length} clase(s) · ${r.pruebas.length + r.sinHora.length} prueba(s)${r.per ? " · " + NOMBRE_PERIODO[r.per.periodo] : ""}` };
  }, (f) => { fCons.dia = fCons.dia === f ? "" : f; fDraw(); },
  "Verde: hay franjas libres (sin clases ni pruebas); naranja: hay franjas libres si las pruebas sin hora de ese día se hacen fuera de ellas; rojo: sin franjas; gris: no lectivo. El número es el de franjas libres. Clic en un día para ver el detalle.");
  const r = dias.get(fCons.dia);
  $("f-detalle").innerHTML = r && !r.nolect ? fDetalle(r) : '<div class="meta">Pulsa un día del calendario para ver sus franjas libres, clases y pruebas.</div>';
}
function fDetalle(r) {
  const span = fCons.hFin - fCons.hIni, pos = (a, b) => `left:${((a - fCons.hIni) / span * 100).toFixed(2)}%;width:${((b - a) / span * 100).toFixed(2)}%`;
  const recorta = (a, b) => [Math.max(a, fCons.hIni), Math.min(b, fCons.hFin)];
  const marcas = []; for (let h = fCons.hIni; h <= fCons.hFin; h++) marcas.push(`<span style="left:${((h - fCons.hIni) / span * 100).toFixed(2)}%">${h}</span>`);
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
      `<div class="meta">${r.per && r.per.periodo === "clases" ? "Sin clases de estos cursos y grupos este día." : "Sin clases (periodo sin docencia)."}</div>`) + "</div>";
}

tInit(); aInit(); pInit(); eInit(); gInit(); xInit(); fInit();
})();
