/* Horarios EPS – aplicación estática sobre web/data.js (generado por scripts/extraer_horarios.py) */
(() => {
"use strict";
const S = window.HORARIOS.sesiones;
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
  const t = $("tooltip");
  t.innerHTML = [
    `<div><b>${s.asignatura}</b>${s.codigo ? " · " + s.codigo : ""}</div>`,
    `<div>Grupo ${s.grupo} (${s.tipo_grupo}) · ${DIAS[s.dia - 1]} ${s.hora_inicio}–${s.hora_fin}</div>`,
    `<div>Aula: ${s.aulas || s.aulas_raw || "—"}</div>`,
    `<div>${s.titulaciones} · ${s.curso}º curso · ${s.semestre}º cuatr. · grupo ${s.grupo_horario}${s.semana ? " · " + s.semana : ""}</div>`,
    s.nota ? `<div>Nota: ${s.nota}</div>` : "",
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

tInit(); aInit(); pInit();
})();
