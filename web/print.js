/* Genera hojas de horario con el formato de los PDF de la EPS a partir de window.HORARIOS.
   Parámetros (query string):
     ?tipo=titulacion&tit=GIST&curso=3&sem=1[&grupo=3B][&semana=Semana%201][&rama=...]
     ?tipo=aula&aula=EA6[&sem=1]
     ?tipo=perfil&id=<id de perfil guardado en localStorage>[&titulo=...]
*/
(() => {
"use strict";
const D = window.HORARIOS, S = D.sesiones, TITS = D.titulaciones || {};
const DIAS = ["LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES"];
const q = Object.fromEntries(new URLSearchParams(location.search));
const esc = (t) => String(t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
const sortNat = (a, b) => String(a).localeCompare(String(b), "es", { numeric: true });
const uniq = (a) => [...new Set(a)];
const ordinal = (n) => `${n}º`;
const hIni = (s) => parseInt(s.hora_inicio.slice(0, 2), 10);
const hFin = (s) => parseInt(s.hora_fin.slice(0, 2), 10);   // "09:55" -> 9 (última hora ocupada)

function itemHTML(s, modo) {
  const notaPre = s.nota && !s.nota.startsWith("(") && !s.nota.startsWith("→") ? " " + s.nota : "";
  const notaPost = s.nota && (s.nota.startsWith("(") || s.nota.startsWith("→")) ? " " + s.nota : "";
  let aula = s.aulas_raw || s.aulas || "";
  if (modo === "aula") aula = `${s.titulaciones} ${s.grupo_horario}`;
  if (modo === "perfil") aula = `${s.aulas_raw || s.aulas || "—"} · ${s.titulaciones}`;
  const cod = q.codigos && s.codigo ? `[${esc(s.codigo)}] ` : "";
  return `<span class="it">${cod}${esc(s.asignatura)} - ${esc(s.grupo)}${esc(notaPre)} <b>(${esc(aula)})</b>${esc(notaPost)}</span>`;
}

/* Una hoja: cabecera + tabla horas × días */
function hoja({ titulo, sub, sesiones, modo, pie }) {
  const ultima = Math.max(13, ...sesiones.map(hFin));
  const hMax = Math.min(20, ultima + 2);               // dos filas vacías (grises) tras la última clase, como en los PDF
  const porCelda = {};
  sesiones.forEach(s => { for (let h = hIni(s); h <= hFin(s); h++) (porCelda[`${h}|${s.dia}`] ||= []).push(s); });
  let filas = "";
  for (let h = 8; h <= hMax; h++) {
    const celdas = DIAS.map((_, i) => {
      const items = (porCelda[`${h}|${i + 1}`] || []).slice().sort((a, b) => sortNat(a.grupo, b.grupo) || sortNat(a.asignatura, b.asignatura));
      return `<td>${items.map(s => itemHTML(s, modo)).join("")}</td>`;
    });
    const hay = DIAS.some((_, i) => porCelda[`${h}|${i + 1}`]);
    const cls = hay ? "con" : (h > ultima ? "gris vacia" : "vacia");
    filas += `<tr class="${cls}"><td class="hora">${h}:00/${h}:55</td>${celdas.join("")}</tr>`;
  }
  return `<section class="hoja">
  <div class="logos"><img class="eps" src="img/eps.png" alt="EPS"><img class="uah" src="img/uah.png" alt="Universidad de Alcalá"></div>
  <div class="titulo">${titulo.map(t => `<div>${esc(t)}</div>`).join("")}</div>
  <div class="sub"><div>${esc(sub[0])}</div><div>${esc(sub[1])}</div><div class="r">${esc(sub[2])}</div></div>
  <table class="h"><thead><tr><th class="hora">HORA</th>${DIAS.map(d => `<th>${d}</th>`).join("")}</tr></thead><tbody>${filas}</tbody></table>
  <div class="pie">${esc(pie)}</div>
</section>`;
}

function tituloTitulacion(siglas) {
  return siglas.split("/").map(sg => { const t = TITS[sg] || {}; return `${t.nombre || sg}${t.codigo ? " (" + t.codigo + ")" : ""} (${sg})`; });
}

function hojasTitulacion() {
  let ss = S.filter(s => s.titulaciones === q.tit && String(s.curso) === q.curso && String(s.semestre) === q.sem);
  if (q.rama) ss = ss.filter(s => s.rama === q.rama);
  if (q.grupo) ss = ss.filter(s => s.grupo_horario === q.grupo);
  if (q.semana) ss = ss.filter(s => s.semana === q.semana);
  const claves = uniq(ss.map(s => `${s.semana}|${s.grupo_horario}`)).sort(sortNat);
  return claves.map(k => {
    const [semana, grupo] = k.split("|");
    const sg = ss.filter(s => s.semana === semana && s.grupo_horario === grupo);
    const s0 = sg[0];
    return hoja({
      titulo: tituloTitulacion(q.tit),
      sub: [`CUATRIMESTRE ${ordinal(s0.cuatrimestre)} (Curso ${ordinal(s0.curso)}, Semestre ${ordinal(s0.semestre)}${semana ? ", " + semana : ""})`,
            `Curso ${s0.curso_academico}`, `GRUPO ${grupo.replace(/^(\d)/, "$1º")}`],
      sesiones: sg, modo: "titulacion",
      pie: s0.aprobacion ? `Aprobado en Junta de Escuela con fecha ${s0.aprobacion}` : "",
    });
  });
}

function hojasAula() {
  const sems = q.sem ? [Number(q.sem)] : [1, 2];
  return sems.map(sem => {
    const seen = new Set();
    const ss = S.filter(s => s.semestre === sem && s.aulas && s.aulas.split("/").includes(q.aula))
      .filter(s => { const k = `${s.dia}|${s.hora_inicio}|${s.hora_fin}|${s.asignatura_norm}|${s.grupo}|${s.aulas}`; if (seen.has(k)) return false; seen.add(k); return true; });
    const tipo = { A: "Aula", L: "Laboratorio" }[q.aula[1]] || "Espacio";
    const anio = ss[0]?.curso_academico || "";
    return hoja({
      titulo: [`${tipo.toUpperCase()} ${q.aula} (EDIFICIO ${q.aula[0]})`],
      sub: [`CUATRIMESTRE ${ordinal(sem)}`, `Curso ${anio}`, `${ss.reduce((n, s) => n + s.horas, 0)} h/semana`],
      sesiones: ss, modo: "aula",
      pie: `Ocupación según los horarios publicados por la EPS (generado ${D.generado})`,
    });
  });
}

function hojasPerfil() {
  let perfiles = {}; try { perfiles = JSON.parse(localStorage.getItem("horarios-eps-perfiles") || "{}"); } catch {}
  const p = perfiles[q.id]; if (!p) return ["<p style='color:#fff;text-align:center'>Perfil no encontrado</p>"];
  const claves = new Set(p.claves), seen = new Set();
  const ss = S.filter(s => claves.has(`${s.titulaciones}|${s.semestre}|${s.asignatura_norm}|${s.grupo}`))
    .filter(s => { const k = `${s.dia}|${s.hora_inicio}|${s.hora_fin}|${s.asignatura_norm}|${s.grupo}|${s.aulas}`; if (seen.has(k)) return false; seen.add(k); return true; });
  return [hoja({
    titulo: [(q.titulo || p.nombre).toUpperCase()],
    sub: [`CUATRIMESTRE ${ordinal(p.semestre)}`, `Curso ${ss[0]?.curso_academico || ""}`, `${ss.reduce((n, s) => n + s.horas, 0)} h/semana`],
    sesiones: ss, modo: "perfil", pie: `Perfil "${p.nombre}" (generado ${D.generado})`,
  })];
}

const gen = { titulacion: hojasTitulacion, aula: hojasAula, perfil: hojasPerfil }[q.tipo];
const hojas = gen ? gen() : ["<p style='color:#fff;text-align:center'>Indica ?tipo=titulacion|aula|perfil</p>"];
document.getElementById("hojas").innerHTML = hojas.join("");
document.getElementById("info").textContent = `${hojas.length} página(s)`;
// ajustar la tabla a la altura disponible de la página (hojas con muchas franjas)
document.querySelectorAll(".hoja").forEach(h => {
  const tabla = h.querySelector("table.h"), pie = h.querySelector(".pie");
  const disponible = pie.getBoundingClientRect().top - tabla.getBoundingClientRect().top - 8;
  const alto = tabla.getBoundingClientRect().height;
  if (alto > disponible) tabla.style.zoom = String(Math.max(0.5, disponible / alto));
});
document.title = `Horario ${q.tit || q.aula || q.id || ""}`.trim();
window.HOJAS_LISTAS = true;
})();
