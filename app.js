console.log("app.js cargado correctamente");

function hoyPeru() {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Lima" }));
  return d.getFullYear() + "-" +
    String(d.getMonth() + 1).padStart(2, "0") + "-" +
    String(d.getDate()).padStart(2, "0");
}

function fechaPeruISO() {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Lima" }));
  return d.getFullYear() + "-" +
    String(d.getMonth() + 1).padStart(2, "0") + "-" +
    String(d.getDate()).padStart(2, "0") + "T" +
    String(d.getHours()).padStart(2, "0") + ":" +
    String(d.getMinutes()).padStart(2, "0") + ":" +
    String(d.getSeconds()).padStart(2, "0");
}

function stringFecha(d) {
  return d.getFullYear() + "-" +
    String(d.getMonth() + 1).padStart(2, "0") + "-" +
    String(d.getDate()).padStart(2, "0");
}

// Migración única: convierte fechas guardadas en UTC (terminan en "Z") a hora Lima
(function migrarFechasUTCALima() {
  const movimientos = JSON.parse(localStorage.getItem("movimientos") || "[]");
  let cambiados = 0;
  const migrados = movimientos.map(m => {
    if (!m.fecha || !m.fecha.endsWith("Z")) return m;
    const d = new Date(new Date(m.fecha).toLocaleString("en-US", { timeZone: "America/Lima" }));
    const nueva = d.getFullYear() + "-" +
      String(d.getMonth() + 1).padStart(2, "0") + "-" +
      String(d.getDate()).padStart(2, "0") + "T" +
      String(d.getHours()).padStart(2, "0") + ":" +
      String(d.getMinutes()).padStart(2, "0") + ":" +
      String(d.getSeconds()).padStart(2, "0");
    cambiados++;
    return { ...m, fecha: nueva };
  });
  if (cambiados > 0) {
    localStorage.setItem("movimientos", JSON.stringify(migrados));
    console.log(`Migración TZ: ${cambiados} movimiento(s) corregido(s) a hora Lima.`);
  }
})();

const cuentasIniciales = [
  "Yape (conectado a 0092)",
  "BCP - Cuenta de ahorro 0092",
  "BCP - Cuenta Digital Soles 1062",
  "BCP - Cuenta Digital Soles 4017",
  "BCP - Cuenta Digital Dólares 0193",
  "BCP - Cuenta Corriente 2015",
  "BCP - Corriente VATIO S.A.C.",
  "BBVA - Cuenta de ahorro",
  "Efectivo",
  "Interbank - Cuenta de ahorro",
  "Banco de la Nación - Cuenta de ahorro",
  "Interbank - Tarjeta de crédito VISA",
  "Tarjeta OH",
  "AMEX Gold"
];

const CUENTAS_CREDITO = [
  "Interbank - Tarjeta de crédito VISA",
  "Tarjeta OH",
  "AMEX Gold"
];

function getTCMetadata() {
  return JSON.parse(localStorage.getItem("tcMetadata") || "{}");
}
function guardarTCMetadata(meta) {
  localStorage.setItem("tcMetadata", JSON.stringify(meta));
}
function diasHastaVencimiento(dia) {
  const hoy = hoyPeru();
  const anio = parseInt(hoy.slice(0, 4));
  const mes = parseInt(hoy.slice(5, 7));
  const diaHoy = parseInt(hoy.slice(8, 10));
  let targetMes = mes, targetAnio = anio;
  if (dia <= diaHoy) {
    targetMes++;
    if (targetMes > 12) { targetMes = 1; targetAnio++; }
  }
  const target = new Date(targetAnio, targetMes - 1, dia);
  const hoyDate = new Date(anio, mes - 1, diaHoy);
  return Math.round((target - hoyDate) / 86400000);
}

let tipoActual = "";
let movimientoTipo = ""; // Nueva variable para el tipo de movimiento
let categoriaActual = "";
let detalleActual = "";
let origen = "";
let destino = "";
let montoTemp = 0;
let monedaTemp = "PEN";
let cuentaSeleccionadaActual = "";
let cuentaComisionSeleccionada = "";
let tcVencimientoSeleccionada = null;
let chartBarras, chartCategorias, chartTendencia;
let rrCuentaActual = "";
let rrCatActual = "";
let indiceEdicion = -1;

// Navegación
const navigationStack = [];

function renderPanelInicio() {
  const panel = document.getElementById("panel-inicio");
  if (!panel) return;

  const movimientos = JSON.parse(localStorage.getItem("movimientos") || "[]");
  const hoy = hoyPeru();
  const mesActual = hoy.slice(0, 7);
  const [anio, mes] = mesActual.split("-").map(Number);
  const diaHoy = parseInt(hoy.slice(8, 10));
  const diasEnMes = new Date(anio, mes, 0).getDate();

  // ── Top 3 categorías para registro rápido ──
  const freq = {};
  movimientos.filter(m => m.tipo === "egreso").forEach(m => {
    if (m.categoria) freq[m.categoria] = (freq[m.categoria] || 0) + 1;
  });
  const top3 = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 3).map(e => e[0]);
  const defCats = ["Comida", "Transporte", "Piqueos"];
  while (top3.length < 3) { const nx = defCats.find(d => !top3.includes(d)); if (nx) top3.push(nx); else break; }
  const rrCatsEl = document.getElementById("rr-cats");
  if (rrCatsEl) {
    rrCatsEl.innerHTML = top3.map(cat =>
      `<button class="btn-rr-cat${rrCatActual === cat ? ' selected' : ''}" onclick="selRRCat('${cat}', this)">${cat}</button>`
    ).join("");
  }

  // Egresos de hoy
  const egresosHoy = movimientos
    .filter(m => m.tipo === "egreso" && m.fecha?.slice(0, 10) === hoy)
    .reduce((s, m) => s + (m.moneda === "USD" ? m.monto * 3.8 : m.monto), 0);

  // Egresos del mes
  const egresosMes = movimientos
    .filter(m => m.tipo === "egreso" && m.fecha?.slice(0, 7) === mesActual)
    .reduce((s, m) => s + (m.moneda === "USD" ? m.monto * 3.8 : m.monto), 0);

  // Semáforo del día
  const limiteDiario = parseFloat(localStorage.getItem("limiteDiario")) || 0;
  let dotColor, estadoTexto, pctDia = 0;
  if (limiteDiario <= 0) {
    dotColor = "#94d2bd"; estadoTexto = "Sin límite diario configurado";
  } else {
    pctDia = egresosHoy / limiteDiario;
    if (pctDia >= 1)        { dotColor = "#ee6c4d"; estadoTexto = `⚠️ Límite superado (${Math.round(pctDia*100)}%)`; }
    else if (pctDia >= 0.75){ dotColor = "#f4a261"; estadoTexto = `Cerca del límite (${Math.round(pctDia*100)}%)`; }
    else                    { dotColor = "#52b788"; estadoTexto = `Dentro del límite (${Math.round(pctDia*100)}%)`; }
  }

  // Proyección del mes
  const promDiario = diaHoy > 0 ? egresosMes / diaHoy : 0;
  const proyeccion = promDiario * diasEnMes;

  const gastosFijos = JSON.parse(localStorage.getItem("gastosFijos") || "[]");
  const totalFijos = gastosFijos.reduce((s, g) => s + (parseFloat(g.monto) || 0), 0);
  const proyeccionTotal = proyeccion + totalFijos;

  const presupuestos = JSON.parse(localStorage.getItem("presupuestos") || "{}");
  const totalPresup = Object.values(presupuestos).reduce((s, v) => s + (parseFloat(v) || 0), 0);
  let pctProy = 0, proyColor = "#52b788";
  if (totalPresup > 0) {
    pctProy = Math.min(100, Math.round(proyeccionTotal / totalPresup * 100));
    proyColor = pctProy >= 100 ? "#ee6c4d" : pctProy >= 80 ? "#f4a261" : "#52b788";
  }

  const mesNombre = new Date(anio, mes - 1, 1).toLocaleDateString("es-PE", { month: "long" });

  panel.innerHTML = `
    <div class="semaforo-card">
      <div class="semaforo-dot" style="background:${dotColor}"></div>
      <div class="semaforo-info">
        <span class="semaforo-titulo">Gastos de hoy</span>
        <span class="semaforo-monto">S/ ${egresosHoy.toFixed(2)}</span>
        <span class="semaforo-estado">${estadoTexto}</span>
        ${limiteDiario > 0 ? `
          <div class="semaforo-barra-bg">
            <div class="semaforo-barra-fill" style="width:${Math.min(100, pctDia*100).toFixed(1)}%;background:${dotColor}"></div>
          </div>` : ""}
      </div>
    </div>
    <div class="proyeccion-card">
      <div class="proy-header">
        <span class="proy-titulo">📅 Proyección de ${mesNombre}</span>
        <span class="proy-monto" style="color:${totalPresup > 0 ? proyColor : "#333"}">S/ ${proyeccionTotal.toFixed(0)}</span>
      </div>
      <p class="proy-detalle">
        Llevas <strong>S/ ${egresosMes.toFixed(0)}</strong> en ${diaHoy} día${diaHoy !== 1 ? "s" : ""}
        &nbsp;·&nbsp; Prom. S/ ${promDiario.toFixed(1)}/día
      </p>
      ${totalFijos > 0 ? `<p class="proy-fijos-texto">📌 Fijos del mes: S/ ${totalFijos.toFixed(0)} &nbsp;·&nbsp; Variables: S/ ${proyeccion.toFixed(0)}</p>` : ""}
      ${totalPresup > 0 ? `
        <div class="proy-barra-bg">
          <div class="proy-barra-fill" style="width:${pctProy}%;background:${proyColor}"></div>
        </div>
        <p class="proy-presup-texto">Presupuesto total: S/ ${totalPresup.toFixed(0)}&nbsp;·&nbsp;Proyección: ${pctProy}%</p>` :
        `<p class="proy-presup-texto">Configura presupuestos para ver el progreso</p>`}
    </div>
  `;

  // Tarjeta meta de ahorro
  const metaAhorro = parseFloat(localStorage.getItem("metaAhorro")) || 0;
  if (metaAhorro > 0) {
    const ingMes = movimientos
      .filter(m => m.tipo === "ingreso" && m.fecha?.slice(0, 7) === mesActual)
      .reduce((s, m) => s + (m.moneda === "USD" ? m.monto * 3.8 : m.monto), 0);
    const ahorroActual = ingMes - egresosMes;
    const pctMeta = Math.min(100, Math.max(0, ahorroActual / metaAhorro * 100));
    const metaColor = pctMeta >= 100 ? "#52b788" : pctMeta >= 60 ? "#f4a261" : "#ee6c4d";
    const metaTexto = ahorroActual >= metaAhorro ? "✅ Meta alcanzada" : ahorroActual >= 0 ? `Faltan S/ ${(metaAhorro - ahorroActual).toFixed(0)}` : "⚠️ Balance negativo";
    panel.innerHTML += `
    <div class="proyeccion-card">
      <div class="proy-header">
        <span class="proy-titulo">🎯 Meta de ahorro</span>
        <span class="proy-monto" style="color:${metaColor}">S/ ${ahorroActual.toFixed(0)} / ${metaAhorro.toFixed(0)}</span>
      </div>
      <p class="proy-detalle">${metaTexto}</p>
      <div class="proy-barra-bg">
        <div class="proy-barra-fill" style="width:${pctMeta.toFixed(1)}%;background:${metaColor}"></div>
      </div>
      <p class="proy-presup-texto">${pctMeta.toFixed(0)}% completado este mes</p>
    </div>`;
  }

  panel.classList.remove("oculto");

  // ── Mini historial de ahorros (últimos 4 meses) ──
  const mesesAhorro = [...new Set(
    movimientos.filter(m => m.tipo !== "intercambio").map(m => m.fecha?.slice(0, 7)).filter(Boolean)
  )].sort().reverse().slice(0, 4);

  if (mesesAhorro.length > 0) {
    const metaAhorroMini = parseFloat(localStorage.getItem("metaAhorro")) || 0;
    let aHtml = '<div class="mini-ahorros-card"><span class="mini-ahorros-titulo">💰 Ahorros recientes</span>';
    mesesAhorro.forEach(m => {
      const tot = calcularTotales(movimientos.filter(mv => mv.tipo !== "intercambio" && mv.fecha?.slice(0, 7) === m));
      const ahorro = tot.ingresos - tot.egresos;
      const color = ahorro >= 0 ? "#52b788" : "#ee6c4d";
      const icon = metaAhorroMini > 0 ? (ahorro >= metaAhorroMini ? " ✅" : ahorro >= 0 ? " ⚠️" : " ❌") : "";
      const [y, mo] = m.split("-");
      const nombre = new Date(+y, +mo - 1, 1).toLocaleDateString("es-PE", { month: "short", year: "2-digit" });
      const pct = metaAhorroMini > 0 ? Math.min(100, Math.max(0, ahorro / metaAhorroMini * 100)).toFixed(0) : null;
      aHtml += `<div class="mini-ahorro-row">
        <div class="mini-ahorro-left">
          <span class="mini-ahorro-mes">${nombre}${icon}</span>
          ${pct !== null ? `<span class="mini-ahorro-pct" style="color:${color}">${pct}%</span>` : ""}
        </div>
        <div class="mini-ahorro-right">
          <span style="color:#0a9396;font-size:0.72rem">↑ S/ ${tot.ingresos.toFixed(0)}</span>
          <span style="color:#ee6c4d;font-size:0.72rem">↓ S/ ${tot.egresos.toFixed(0)}</span>
          <span class="mini-ahorro-neto" style="color:${color}">= S/ ${ahorro.toFixed(0)}</span>
        </div>
      </div>`;
    });
    aHtml += '</div>';
    panel.innerHTML += aHtml;
  }

  // ── Deuda de tarjetas de crédito ──
  const cuentasVinc = { "Yape (conectado a 0092)": "BCP - Cuenta de ahorro 0092" };
  const saldosTC = new Map(CUENTAS_CREDITO.map(c => [c, 0]));
  movimientos.forEach(m => {
    let monto = m.moneda === "USD" ? m.monto * 3.8 : m.monto;
    const dest = cuentasVinc[m.destino] || m.destino;
    const orig = cuentasVinc[m.origen] || m.origen;
    if (m.tipo === "egreso" && saldosTC.has(orig)) {
      saldosTC.set(orig, saldosTC.get(orig) - monto);
    }
    if (m.tipo === "intercambio") {
      if (saldosTC.has(orig)) saldosTC.set(orig, saldosTC.get(orig) - monto);
      if (saldosTC.has(dest)) saldosTC.set(dest, saldosTC.get(dest) + monto);
    }
  });
  const deudaTotal = [...saldosTC.values()].reduce((s, v) => s + (v < 0 ? -v : 0), 0);
  if (deudaTotal > 0) {
    const filasTC = CUENTAS_CREDITO
      .filter(c => (saldosTC.get(c) || 0) < 0)
      .map(c => {
        const deuda = -(saldosTC.get(c));
        return `<div class="mini-ahorro-row"><span class="mini-ahorro-mes">${c}</span><span style="color:#ee6c4d;font-weight:bold">S/ ${deuda.toFixed(2)}</span></div>`;
      }).join("");
    panel.innerHTML += `
    <div class="mini-ahorros-card" style="border-left:3px solid #ee6c4d">
      <span class="mini-ahorros-titulo">&#x1F4B3; Deuda en tarjetas</span>
      ${filasTC}
      <div class="mini-ahorro-row" style="border-top:1px solid #eee;margin-top:4px;padding-top:4px">
        <span class="mini-ahorro-mes" style="font-weight:bold">Total deuda TC</span>
        <span style="color:#ee6c4d;font-weight:bold">S/ ${deudaTotal.toFixed(2)}</span>
      </div>
    </div>`;
  }

  // ── Alertas de vencimiento TC ──
  const tcMetaVenc = getTCMetadata();
  const alertasVenc = CUENTAS_CREDITO
    .filter(c => tcMetaVenc[c]?.diaVencimiento && (saldosTC.get(c) || 0) < 0)
    .map(c => ({
      nombre: c,
      dias: diasHastaVencimiento(tcMetaVenc[c].diaVencimiento),
      deuda: -(saldosTC.get(c)),
      diaVenc: tcMetaVenc[c].diaVencimiento
    }))
    .filter(a => a.dias <= 7)
    .sort((a, b) => a.dias - b.dias);

  if (alertasVenc.length > 0) {
    let alertHtml = '<div class="mini-ahorros-card" style="border-left:3px solid #e76f51">';
    alertHtml += '<span class="mini-ahorros-titulo">🔔 Vencimientos próximos</span>';
    alertasVenc.forEach(a => {
      const color = a.dias <= 3 ? "#ee6c4d" : "#f4a261";
      const diasTxt = a.dias === 0 ? "¡Hoy vence!" : a.dias === 1 ? "Vence mañana" : `Vence en ${a.dias} días (día ${a.diaVenc})`;
      alertHtml += `
        <div class="mini-ahorro-row">
          <div>
            <span class="mini-ahorro-mes">${a.nombre}</span>
            <span style="font-size:0.7rem;color:${color};display:block">${diasTxt}</span>
          </div>
          <span style="color:#ee6c4d;font-weight:bold">S/ ${a.deuda.toFixed(2)}</span>
        </div>`;
    });
    alertHtml += '</div>';
    panel.innerHTML += alertHtml;
  }
}

function guardarMetaAhorro() {
  const val = parseFloat(document.getElementById("input-meta-ahorro").value) || 0;
  localStorage.setItem("metaAhorro", val);
  const btn = document.querySelector("#vista-configuracion .config-section:nth-child(2) button");
  if (btn) { btn.textContent = "✔ Guardado"; setTimeout(() => btn.textContent = "✔ Guardar", 1500); }
  renderPanelInicio();
}

// ── Historial de ahorros ──
function renderHistorialAhorros() {
  const el = document.getElementById("lista-ahorros");
  if (!el) return;
  const movimientos = JSON.parse(localStorage.getItem("movimientos") || "[]");
  const metaAhorro = parseFloat(localStorage.getItem("metaAhorro")) || 0;

  const meses = [...new Set(
    movimientos.filter(m => m.tipo !== "intercambio").map(m => m.fecha?.slice(0, 7)).filter(Boolean)
  )].sort().reverse();

  if (!meses.length) { el.innerHTML = '<p class="presup-desc">No hay datos aún.</p>'; return; }

  let html = '<div class="ahorro-tabla">';
  meses.forEach(mes => {
    const tot = calcularTotales(movimientos.filter(m => m.tipo !== "intercambio" && m.fecha?.slice(0, 7) === mes));
    const ahorro = tot.ingresos - tot.egresos;
    const color = ahorro >= 0 ? "#52b788" : "#ee6c4d";
    const metaIcon = metaAhorro > 0 ? (ahorro >= metaAhorro ? "✅" : ahorro >= 0 ? "⚠️" : "❌") : "";
    const [y, m] = mes.split("-");
    const nombre = new Date(+y, +m - 1, 1).toLocaleDateString("es-PE", { month: "long", year: "numeric" });
    const pct = metaAhorro > 0 ? Math.min(100, Math.max(0, ahorro / metaAhorro * 100)).toFixed(1) : 0;
    html += `
      <div class="ahorro-row">
        <div class="ahorro-mes">${nombre} ${metaIcon}</div>
        <div class="ahorro-numeros">
          <span style="color:#0a9396">↑ S/ ${tot.ingresos.toFixed(0)}</span>
          <span style="color:#ee6c4d">↓ S/ ${tot.egresos.toFixed(0)}</span>
          <span class="ahorro-neto" style="color:${color};font-weight:700">= S/ ${ahorro.toFixed(0)}</span>
        </div>
        ${metaAhorro > 0 ? `<div class="ahorro-barra-bg"><div class="ahorro-barra-fill" style="width:${pct}%;background:${color}"></div></div>
          <span class="ahorro-meta-txt" style="color:${color}">${pct}% de meta S/ ${metaAhorro.toFixed(0)}</span>` : ""}
      </div>`;
  });
  html += '</div>';
  el.innerHTML = html;
}

// ── Backup ──
function exportarBackup() {
  const data = {
    version: 1,
    fecha: fechaPeruISO(),
    movimientos: JSON.parse(localStorage.getItem("movimientos") || "[]"),
    cuentas: JSON.parse(localStorage.getItem("cuentas") || "null"),
    comisiones: JSON.parse(localStorage.getItem("comisiones") || "{}"),
    limiteDiario: localStorage.getItem("limiteDiario"),
    presupuestos: JSON.parse(localStorage.getItem("presupuestos") || "{}"),
    metaAhorro: localStorage.getItem("metaAhorro")
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `mis-finanzas-backup-${hoyPeru()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importarBackup(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      if (!Array.isArray(data.movimientos)) throw new Error("Archivo inválido o dañado.");
      if (!confirm(`¿Restaurar backup con ${data.movimientos.length} movimientos?\nEsto reemplazará todos los datos actuales.`)) return;
      localStorage.setItem("movimientos", JSON.stringify(data.movimientos));
      if (data.cuentas)     localStorage.setItem("cuentas", JSON.stringify(data.cuentas));
      if (data.comisiones)  localStorage.setItem("comisiones", JSON.stringify(data.comisiones));
      if (data.limiteDiario != null) localStorage.setItem("limiteDiario", data.limiteDiario);
      if (data.presupuestos) localStorage.setItem("presupuestos", JSON.stringify(data.presupuestos));
      if (data.metaAhorro != null)   localStorage.setItem("metaAhorro", data.metaAhorro);
      alert("✅ Backup restaurado correctamente.");
      location.reload();
    } catch(err) {
      alert("❌ Error al leer el archivo: " + err.message);
    }
  };
  reader.readAsText(file);
}

// ── Registro rápido ──
function toggleRegistroRapido() {
  // registro rápido siempre visible, sin toggle
}

function selRRCuenta(cuenta, btn) {
  rrCuentaActual = cuenta;
  document.querySelectorAll(".btn-rr-cuenta").forEach(b => b.classList.remove("selected"));
  btn.classList.add("selected");
}

function selRRCat(cat, btn) {
  rrCatActual = cat;
  document.querySelectorAll(".btn-rr-cat").forEach(b => b.classList.remove("selected"));
  btn.classList.add("selected");
}

function guardarRegistroRapido() {
  const cat    = rrCatActual;
  const monto  = parseFloat(document.getElementById("rr-monto").value);
  const moneda = document.getElementById("rr-moneda").value;
  const desc   = (document.getElementById("rr-desc")?.value || "").trim();
  if (!cat)               return alert("Selecciona una categoría.");
  if (!rrCuentaActual)    return alert("Selecciona una cuenta.");
  if (!monto || monto <= 0) return alert("Ingresa un monto válido.");

  const movs = JSON.parse(localStorage.getItem("movimientos") || "[]");
  movs.push({ tipo: "egreso", categoria: cat, detalle: desc, origen: rrCuentaActual, destino: "", monto, moneda, fecha: fechaPeruISO() });
  localStorage.setItem("movimientos", JSON.stringify(movs));

  document.getElementById("rr-monto").value = "";
  const rrDescEl = document.getElementById("rr-desc"); if (rrDescEl) rrDescEl.value = "";
  rrCatActual = "";
  rrCuentaActual = "";
  document.querySelectorAll(".btn-rr-cuenta").forEach(b => b.classList.remove("selected"));
  renderPanelInicio(); // recalcula top3 y refresca panel

  const btn = document.querySelector(".btn-rr-guardar");
  if (btn) { btn.style.background = "#52b788"; setTimeout(() => btn.style.background = "", 1200); }
}

function cambiarVista(id) {
  document.querySelectorAll(".vista").forEach(v => v.classList.remove("activa"));
  document.getElementById("vista-" + id).classList.add("activa");
  if (navigationStack[navigationStack.length - 1] !== id) {
    navigationStack.push(id);
  }
  tipoActual = id;
  if (["ingreso", "egreso", "intercambio"].includes(id)) {
    movimientoTipo = id;
  }
  if (id === "analisis") {
    cambiarSubvista("historial");
  }
  if (id === "configuracion") {
    document.getElementById("input-limite-diario").value = localStorage.getItem("limiteDiario") || "";
    document.getElementById("input-meta-ahorro").value = localStorage.getItem("metaAhorro") || "";
    renderGastosFijos();
    renderPresupuesto();
  }
  if (id === "inicio") {
    renderPanelInicio();
  }
}

function volver() {
  if (navigationStack.length > 1) {
    navigationStack.pop();
    const anterior = navigationStack[navigationStack.length - 1];
    document.querySelectorAll(".vista").forEach(v => v.classList.remove("activa"));
    document.getElementById("vista-" + anterior).classList.add("activa");
  } else {
    cambiarVista('inicio');
  }
}

// Selección de egreso/ingreso/intercambio
function seleccionarEgreso(cat) {
  categoriaActual = cat;
  cargarCuentas("cuenta", "Desde qué cuenta se pagó");
}

function seleccionarIngreso(fuente) {
  categoriaActual = fuente;
  cargarCuentas("cuenta", "¿Dónde se depositó?");
}

function usarIngresoManual() {
  const otra = document.getElementById("nuevo-ingreso").value.trim();
  if (!otra) return alert("Ingresa una fuente personalizada.");
  categoriaActual = otra;
  cargarCuentas("cuenta", "¿Dónde se depositó?");
}

function marcarComoTípico() {
  const nueva = document.getElementById("nuevo-ingreso").value.trim();
  if (!nueva) return alert("No hay ingreso para guardar");
  alert(`Se ha marcado "${nueva}" como ingreso típico. (Función aún no implementada)`);
}

function pasarAPaginaMonto(tipo) {
  tipoActual = tipo;
  origen = document.getElementById("cuenta-desde").value;
  destino = document.getElementById("cuenta-hacia").value;
  if (origen === destino) return alert("No puedes intercambiar a la misma cuenta.");
  cambiarVista("monto");
}

function cargarCuentas(vista, titulo) {
  document.getElementById("cuenta-titulo").innerText = titulo;
  cuentaSeleccionadaActual = "";
  document.querySelectorAll(".btn-cuenta-rapida").forEach(b => b.classList.remove("selected"));
  const cuentasRapidas = [
    "Yape (conectado a 0092)",
    "BCP - Cuenta de ahorro 0092",
    "BBVA - Cuenta de ahorro",
    "Efectivo"
  ];
  const sel = document.getElementById("cuenta-seleccionada");
  sel.innerHTML = "<option value=''>— Otras cuentas —</option>";
  getCuentas().filter(c => !cuentasRapidas.includes(c)).forEach(c => {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    sel.appendChild(opt);
  });
  cambiarVista(vista);
}

function seleccionarCuentaRapida(cuenta, btn) {
  cuentaSeleccionadaActual = cuenta;
  document.querySelectorAll(".btn-cuenta-rapida").forEach(b => b.classList.remove("selected"));
  btn.classList.add("selected");
  document.getElementById("cuenta-seleccionada").value = "";
}

function pasarAPaginaMontoDesdeCuenta() {
  const seleccion = document.getElementById("cuenta-seleccionada").value;
  console.log("Cuenta seleccionada:", seleccion);
  if (!seleccion) {
    alert("Por favor, selecciona una cuenta válida.");
    return;
  }
  if (!movimientoTipo || !["ingreso", "egreso"].includes(movimientoTipo)) {
    alert("Tipo de movimiento no definido o inválido. Por favor, inicia un nuevo registro.");
    cambiarVista("inicio");
    return;
  }
  if (movimientoTipo === "ingreso") {
    destino = seleccion;
    origen = "";
  } else if (movimientoTipo === "egreso") {
    origen = seleccion;
    destino = "";
  }
  cambiarVista("monto");
}

// Guardar movimiento
function guardarMovimiento() {
  if (movimientoTipo === "ingreso" || movimientoTipo === "egreso") {
    const seleccion = cuentaSeleccionadaActual || document.getElementById("cuenta-seleccionada").value;
    if (!seleccion) { alert("Por favor, selecciona una cuenta válida."); return; }
    if (movimientoTipo === "ingreso") { destino = seleccion; origen = ""; }
    else { origen = seleccion; destino = ""; }
    detalleActual = document.getElementById("detalle-movimiento").value;
    montoTemp = parseFloat(document.getElementById("monto-cuenta").value);
    monedaTemp = document.getElementById("moneda-cuenta").value;
  } else {
    montoTemp = parseFloat(document.getElementById("monto").value);
    monedaTemp = document.getElementById("moneda").value;
  }
  if (!montoTemp || isNaN(montoTemp) || montoTemp <= 0) {
    alert("Por favor, ingresa un monto válido mayor a 0.");
    return;
  }
  if (!movimientoTipo || !["ingreso", "egreso", "intercambio"].includes(movimientoTipo)) {
    alert("Tipo de movimiento inválido. Por favor, inicia un nuevo registro.");
    cambiarVista("inicio");
    return;
  }
  if (movimientoTipo !== "intercambio" && !categoriaActual) {
    alert("Por favor, selecciona una categoría.");
    return;
  }
  if (movimientoTipo === "ingreso" && !destino) {
    alert("Por favor, selecciona una cuenta de destino.");
    return;
  }
  if (movimientoTipo === "egreso" && !origen) {
    alert("Por favor, selecciona una cuenta de origen.");
    return;
  }
  if (movimientoTipo === "intercambio" && (!origen || !destino || origen === destino)) {
    alert("Por favor, selecciona cuentas de origen y destino válidas.");
    return;
  }
  document.getElementById("popup-confirmacion").classList.remove("oculto");
}

function confirmarGuardar() {
  if (!movimientoTipo || !["ingreso", "egreso", "intercambio"].includes(movimientoTipo)) {
    alert("Tipo de movimiento inválido. Por favor, inicia un nuevo registro.");
    cerrarPopup();
    cambiarVista("inicio");
    return;
  }

  if (movimientoTipo === "ingreso" && !destino) {
    alert("Por favor, selecciona una cuenta de destino para el ingreso.");
    return;
  }

  if (movimientoTipo === "egreso" && !origen) {
    alert("Por favor, selecciona una cuenta de origen para el egreso.");
    return;
  }

  if (movimientoTipo === "intercambio" && (!origen || !destino || origen === destino)) {
    alert("Por favor, selecciona cuentas de origen y destino válidas.");
    return;
  }

  const registro = {
    tipo: movimientoTipo,
    categoria: categoriaActual || "",
    detalle: detalleActual || "",
    origen: origen || "",
    destino: destino || "",
    monto: montoTemp,
    moneda: monedaTemp,
    fecha: fechaPeruISO()
  };

  console.log("Guardando movimiento:", registro);

  const datos = JSON.parse(localStorage.getItem("movimientos") || "[]");
  datos.push(registro);
  localStorage.setItem("movimientos", JSON.stringify(datos));

  // Limpiar inputs y variables
  document.getElementById("monto").value = "";
  document.getElementById("monto-cuenta").value = "";
  document.getElementById("detalle-movimiento").value = "";
  document.getElementById("nuevo-ingreso").value = "";
  cuentaSeleccionadaActual = "";
  document.querySelectorAll(".btn-cuenta-rapida").forEach(b => b.classList.remove("selected"));
  movimientoTipo = "";
  tipoActual = "";
  categoriaActual = "";
  detalleActual = "";
  origen = "";
  destino = "";
  montoTemp = 0;
  monedaTemp = "PEN";

  cerrarPopup();

  // Actualizar vistas solo si la subvista activa lo requiere
  const subvistaActiva = document.querySelector(".subvista.activa")?.id;
  try {
    if (subvistaActiva === "subvista-historial") {
      cargarHistorial();
    } else if (subvistaActiva === "subvista-graficos") {
      renderizarGraficos();
    } else if (subvistaActiva === "subvista-resumen") {
      renderResumenCuentas();
    }
  } catch (error) {
    console.error("Error al actualizar vistas:", error);
  }

  alert("✅ Movimiento guardado.");

  cambiarVista("analisis");
  cambiarSubvista("historial");
}

function cancelarGuardar() {
  cerrarPopup();
}

function cerrarPopup() {
  const popups = [
    "popup-confirmacion",
    "popup-nueva-cuenta",
    "popup-comision",
    "popup-editar-movimiento",
    "popup-configuracion"
  ];
  popups.forEach(id => {
    const popup = document.getElementById(id);
    if (popup) popup.classList.add("oculto");
  });
}

// Inicializar cuentas
function getCuentas() {
  return JSON.parse(localStorage.getItem("cuentas") || JSON.stringify(cuentasIniciales));
}

function guardarCuentas(cuentas) {
  localStorage.setItem("cuentas", JSON.stringify(cuentas));
}

// Subvistas
function cambiarSubvista(id) {
  try {
    const target = document.getElementById("subvista-" + id);
    if (!target) { console.error(`Subvista subvista-${id} no encontrada`); return; }
    // Toggle: clic en la misma pestaña activa vuelve al historial
    if (target.classList.contains("activa") && id !== "historial") {
      cambiarSubvista("historial");
      return;
    }
    document.querySelectorAll(".subvista").forEach(s => s.classList.remove("activa"));
    target.classList.add("activa");

    if (id === "historial") {
      const periodoEl = document.getElementById("filtro-periodo");
      const fechaEl = document.getElementById("filtro-fecha-base");
      periodoEl.value = "dia";
      fechaEl.type = "date";
      fechaEl.value = hoyPeru();
      cargarHistorial();
    } else if (id === "graficos") {
      renderizarGraficos();
    } else if (id === "resumen") {
      renderResumenCuentas();
    } else if (id === "ia") {
      renderInsightsLocales();
    } else if (id === "ahorros") {
      renderHistorialAhorros();
    }
  } catch (error) {
    console.error("Error al cambiar subvista:", error);
  }
}

// Historial
// Historial — helpers
function filtrarMovsPeriodo(movimientos, periodo, fechaBase, tipoFiltro) {
  return movimientos.map((m, i) => ({ ...m, index: i })).filter(m => {
    if (tipoFiltro && m.tipo !== tipoFiltro) return false;
    if (!fechaBase) return true;
    if (periodo === "dia") return m.fecha.slice(0, 10) === fechaBase.slice(0, 10);
    if (periodo === "mes") return m.fecha.slice(0, 7) === fechaBase.slice(0, 7);
    if (periodo === "anio") return m.fecha.slice(0, 4) === fechaBase.slice(0, 4);
    if (periodo === "trimestre") {
      const mesM = parseInt(m.fecha.slice(5, 7));
      const mesF = parseInt(fechaBase.slice(5, 7));
      return m.fecha.slice(0, 4) === fechaBase.slice(0, 4) &&
             Math.floor((mesM - 1) / 3) === Math.floor((mesF - 1) / 3);
    }
    return true;
  });
}

function calcularTotales(movimientos) {
  let ingresos = 0, egresos = 0;
  let ingresosUSD = 0, egresosUSD = 0;
  movimientos.forEach(m => {
    if (m.moneda === "USD") {
      if (m.tipo === "ingreso") ingresosUSD += m.monto;
      if (m.tipo === "egreso") egresosUSD += m.monto;
    } else {
      if (m.tipo === "ingreso") ingresos += m.monto;
      if (m.tipo === "egreso") egresos += m.monto;
    }
  });
  return {
    ingresos, egresos, saldo: ingresos - egresos,
    ingresosUSD, egresosUSD, saldoUSD: ingresosUSD - egresosUSD
  };
}

function renderResumenPeriodo(totales) {
  const colorSaldo = totales.saldo >= 0 ? "#0a9396" : "crimson";
  const iconSaldo = totales.saldo >= 0 ? "🟢" : "🔴";
  const usd = (val, color) => val !== 0
    ? `<div class="card-stat-usd" style="color:${color}">$ ${val.toFixed(2)}</div>`
    : "";
  document.getElementById("resumen-periodo").innerHTML = `
    <div class="cards-resumen">
      <div class="card-stat" style="border-top:3px solid #0a9396">
        <div class="card-stat-label">Ingresos</div>
        <div class="card-stat-monto" style="color:#0a9396">S/ ${totales.ingresos.toFixed(2)}</div>
        ${usd(totales.ingresosUSD, "#0a9396")}
      </div>
      <div class="card-stat" style="border-top:3px solid crimson">
        <div class="card-stat-label">Egresos</div>
        <div class="card-stat-monto" style="color:crimson">S/ ${totales.egresos.toFixed(2)}</div>
        ${usd(totales.egresosUSD, "crimson")}
      </div>
      <div class="card-stat" style="border-top:3px solid ${colorSaldo}">
        <div class="card-stat-label">Saldo ${iconSaldo}</div>
        <div class="card-stat-monto" style="color:${colorSaldo}">S/ ${totales.saldo.toFixed(2)}</div>
        ${usd(totales.saldoUSD, colorSaldo)}
      </div>
    </div>`;
}

function renderComparativas(hoy, ayer, semana) {
  const pctDelta = (a, b) => b === 0 ? null : Math.round((a - b) / b * 100);
  const deltaText = d => d === null ? "Sin datos" : d > 0 ? `▲ ${d}%` : d < 0 ? `▼ ${Math.abs(d)}%` : "Sin cambio";
  const deltaColor = d => d === null ? "#aaa" : d > 0 ? "crimson" : "#0a9396";

  const tarjeta = (titulo, pHoy, pRef, labelRef, egresosRef, delta) => {
    const dColor = deltaColor(delta);
    return `
      <div class="card-comp">
        <div class="card-comp-title">${titulo}</div>
        <div class="mini-bar-chart">
          <div class="barra-item">
            <div class="barra-wrap"><div class="barra-fill azul" style="height:${pHoy}%"></div></div>
            <span>Hoy</span>
          </div>
          <div class="barra-item">
            <div class="barra-wrap"><div class="barra-fill gris" style="height:${pRef}%"></div></div>
            <span>${labelRef}</span>
          </div>
        </div>
        <div class="card-comp-delta" style="color:${dColor}">${deltaText(delta)}</div>
        <div class="card-comp-sub">Hoy: S/ ${hoy.egresos.toFixed(2)}</div>
        <div class="card-comp-sub">${labelRef}: S/ ${egresosRef.toFixed(2)}</div>
      </div>`;
  };

  const maxAyer = Math.max(hoy.egresos, ayer.egresos, 0.01);
  const maxSem  = Math.max(hoy.egresos, semana.egresos, 0.01);

  document.getElementById("comparativa-periodo").innerHTML = `
    <div class="cards-comparativa">
      ${tarjeta("vs Ayer",
        Math.round(hoy.egresos / maxAyer * 100),
        Math.round(ayer.egresos / maxAyer * 100),
        "Ayer", ayer.egresos, pctDelta(hoy.egresos, ayer.egresos))}
      ${tarjeta("vs Hace 7 días",
        Math.round(hoy.egresos / maxSem * 100),
        Math.round(semana.egresos / maxSem * 100),
        "-7d", semana.egresos, pctDelta(hoy.egresos, semana.egresos))}
    </div>`;
}

function actualizarInputFecha() {
  const periodo = document.getElementById("filtro-periodo").value;
  const input = document.getElementById("filtro-fecha-base");
  const hoy = hoyPeru();
  if (periodo === "dia") {
    input.type = "date";
    if (!input.value || input.value.length === 7) input.value = hoy;
  } else {
    input.type = "month";
    if (!input.value || input.value.length === 10) input.value = hoy.slice(0, 7);
  }
}

// ── Análisis adicional ──────────────────────────────────────────
function renderAnalisisAdicional(movimientos, periodo, fechaBase) {
  const el = document.getElementById("analisis-adicional");
  if (!el) return;
  const todosMovs = JSON.parse(localStorage.getItem("movimientos") || "[]");
  const totales = calcularTotales(movimientos);
  const egresos = movimientos.filter(m => m.tipo === "egreso");
  const items = [];

  // 1. Tasa de ahorro
  if (totales.ingresos > 0) {
    const tasa = Math.round((totales.saldo / totales.ingresos) * 100);
    const color = tasa >= 0 ? "#0a9396" : "crimson";
    items.push(`<div class="extra-item"><span class="extra-label">💰 Tasa de ahorro</span><span class="extra-valor" style="color:${color}">${tasa}%</span></div>`);
  }

  // 2. Categoría con más gasto
  if (egresos.length > 0) {
    const porCat = {};
    egresos.forEach(m => {
      const monto = m.moneda === "USD" ? m.monto * 3.8 : m.monto;
      porCat[m.categoria] = (porCat[m.categoria] || 0) + monto;
    });
    const top = Object.entries(porCat).sort((a, b) => b[1] - a[1])[0];
    items.push(`<div class="extra-item"><span class="extra-label">📌 Mayor gasto</span><span class="extra-valor">${top[0]} <small>S/ ${top[1].toFixed(0)}</small></span></div>`);
  }

  // 3. Promedio diario (mes+)
  if (["mes", "trimestre", "anio"].includes(periodo) && egresos.length > 0) {
    const dias = new Set(egresos.map(m => m.fecha.slice(0, 10))).size;
    items.push(`<div class="extra-item"><span class="extra-label">📅 Gasto prom/día</span><span class="extra-valor">S/ ${(totales.egresos / dias).toFixed(2)}</span></div>`);
  }

  // 4. Días en rojo (mes+)
  if (["mes", "trimestre", "anio"].includes(periodo) && movimientos.length > 0) {
    const dias = [...new Set(movimientos.map(m => m.fecha.slice(0, 10)))];
    const rojos = dias.filter(dia => {
      const t = calcularTotales(movimientos.filter(m => m.fecha.slice(0, 10) === dia));
      return t.egresos > t.ingresos;
    }).length;
    const color = rojos > 0 ? "crimson" : "#0a9396";
    items.push(`<div class="extra-item"><span class="extra-label">🔴 Días en rojo</span><span class="extra-valor" style="color:${color}">${rojos} día${rojos !== 1 ? "s" : ""}</span></div>`);
  }

  // 5. Tendencia semanal
  if (fechaBase) {
    const d = new Date(fechaBase + "T12:00:00");
    const dow = d.getDay();
    const diffLun = dow === 0 ? -6 : 1 - dow;
    const lunes = new Date(d); lunes.setDate(d.getDate() + diffLun);
    const lunesPas = new Date(lunes); lunesPas.setDate(lunes.getDate() - 7);
    const domPas = new Date(lunesPas); domPas.setDate(lunesPas.getDate() + 6);
    const estaSem = calcularTotales(todosMovs.filter(m => {
      const f = m.fecha.slice(0, 10);
      return f >= stringFecha(lunes) && f <= fechaBase;
    }));
    const semPas = calcularTotales(todosMovs.filter(m => {
      const f = m.fecha.slice(0, 10);
      return f >= stringFecha(lunesPas) && f <= stringFecha(domPas);
    }));
    const diff = estaSem.egresos - semPas.egresos;
    const pct = semPas.egresos > 0 ? Math.round(diff / semPas.egresos * 100) : null;
    const arrow = pct === null ? "—" : pct > 0 ? `▲ ${pct}% más gasto` : pct < 0 ? `▼ ${Math.abs(pct)}% menos gasto` : "Sin cambio";
    const color = pct === null ? "#aaa" : pct > 0 ? "crimson" : "#0a9396";
    items.push(`<div class="extra-item extra-item-col"><span class="extra-label">📈 Esta semana vs semana pasada</span><span class="extra-valor" style="color:${color}">${arrow}</span><span class="extra-sub">Lun–hoy: S/ ${estaSem.egresos.toFixed(0)} · Sem. ant.: S/ ${semPas.egresos.toFixed(0)}</span></div>`);
  }

  el.innerHTML = items.length > 0 ? `<div class="analisis-extra">${items.join("")}</div>` : "";
}

function verificarLimiteDiario(egresos) {
  const limite = parseFloat(localStorage.getItem("limiteDiario") || "0");
  const el = document.getElementById("alerta-limite");
  if (!el) return;
  el.classList.remove("oculto");
  if (limite <= 0) {
    // Sin límite configurado
    if (egresos > 0) {
      el.className = "alerta-limite alerta-neutro";
      el.innerHTML = `📅 Egresos del día: S/ ${egresos.toFixed(2)}`;
    } else {
      el.classList.add("oculto");
    }
    return;
  }
  const pct = Math.round(egresos / limite * 100);
  if (egresos >= limite) {
    el.className = "alerta-limite alerta-excedido";
    el.innerHTML = `⚠️ Superaste el límite (${pct}%). Gastaste S/ ${egresos.toFixed(2)} de S/ ${limite.toFixed(0)}.`;
  } else if (egresos > 0) {
    el.className = "alerta-limite alerta-ok";
    el.innerHTML = `✅ Dentro del límite · S/ ${egresos.toFixed(2)} de S/ ${limite.toFixed(0)} (${pct}%)`;
  } else {
    el.className = "alerta-limite alerta-ok";
    el.innerHTML = `✅ Sin egresos este día · Límite disponible: S/ ${limite.toFixed(0)}`;
  }
}

function guardarLimiteDiario() {
  const val = parseFloat(document.getElementById("input-limite-diario").value) || 0;
  localStorage.setItem("limiteDiario", val);
  const btn = document.querySelector("#vista-configuracion .config-limite button");
  if (btn) { btn.textContent = "✔ Guardado"; setTimeout(() => btn.textContent = "✔ Guardar", 1500); }
}

function abrirConfiguracion() {
  cambiarVista("configuracion");
}

// ── Presupuesto por categoría ───────────────────────────────────
const CATEGORIAS_EGRESO = [
  "Transporte","Comida","Piqueos","Ropa","Suplementos","Medicina",
  "Estética","Gimnasio","Telefonía",
  "Membresías","Conciertos","Libros","Formación","Intereses TC","Otros"
];

function renderGastosFijos() {
  const el = document.getElementById("lista-gastos-fijos");
  if (!el) return;
  const lista = JSON.parse(localStorage.getItem("gastosFijos") || "[]");
  if (lista.length === 0) {
    el.innerHTML = '<p class="gf-vacio">Ninguno configurado aún</p>';
    return;
  }
  const total = lista.reduce((s, g) => s + (parseFloat(g.monto) || 0), 0);
  el.innerHTML = lista.map((g, i) =>
    `<div class="gf-item">
      <span class="gf-desc">${g.desc}</span>
      <span class="gf-monto">S/ ${parseFloat(g.monto).toFixed(0)}</span>
      <button class="gf-del" onclick="eliminarGastoFijo(${i})">&#x2715;</button>
    </div>`
  ).join("") +
  `<div class="gf-total"><span>Total fijos</span><span>S/ ${total.toFixed(0)}</span></div>`;
}

function agregarGastoFijo() {
  const desc = document.getElementById("gf-desc").value.trim();
  const monto = parseFloat(document.getElementById("gf-monto").value);
  if (!desc || !monto || monto <= 0) return;
  const lista = JSON.parse(localStorage.getItem("gastosFijos") || "[]");
  lista.push({ desc, monto });
  localStorage.setItem("gastosFijos", JSON.stringify(lista));
  document.getElementById("gf-desc").value = "";
  document.getElementById("gf-monto").value = "";
  renderGastosFijos();
  renderPanelInicio();
}

function eliminarGastoFijo(i) {
  const lista = JSON.parse(localStorage.getItem("gastosFijos") || "[]");
  lista.splice(i, 1);
  localStorage.setItem("gastosFijos", JSON.stringify(lista));
  renderGastosFijos();
  renderPanelInicio();
}

function renderPresupuesto() {
  const el = document.getElementById("lista-presupuestos");
  if (!el) return;
  const presupuestos = JSON.parse(localStorage.getItem("presupuestos") || "{}");
  const movimientos = JSON.parse(localStorage.getItem("movimientos") || "[]");
  const mesActual = hoyPeru().slice(0, 7);
  const gastado = {};
  movimientos.filter(m => m.tipo === "egreso" && m.fecha.slice(0, 7) === mesActual)
    .forEach(m => {
      const monto = m.moneda === "USD" ? m.monto * 3.8 : m.monto;
      gastado[m.categoria] = (gastado[m.categoria] || 0) + monto;
    });

  let html = "<div class=\"presup-grid\">";
  CATEGORIAS_EGRESO.forEach(cat => {
    const pres = presupuestos[cat] || 0;
    const gas = gastado[cat] || 0;
    const pct = pres > 0 ? Math.min(100, Math.round(gas / pres * 100)) : 0;
    const color = pct >= 100 ? "crimson" : pct >= 80 ? "#e07b00" : "#0a9396";
    const inputId = "presup-" + cat.replace(/[\s]/g, "-");
    html += `
      <div class="presup-item">
        <div class="presup-header">
          <span class="presup-cat">${cat}</span>
          <span class="presup-gastado" style="color:${pres > 0 && gas > pres ? "crimson" : "#555"}">
            S/ ${gas.toFixed(0)}${pres > 0 ? ` / ${pres.toFixed(0)}` : ""}
          </span>
        </div>
        ${pres > 0 ? `<div class="presup-barra-bg"><div class="presup-barra-fill" style="width:${pct}%;background:${color}"></div></div><div class="presup-pct" style="color:${color}">${pct}%</div>` : ""}
        <div class="presup-editar">
          <input type="number" id="${inputId}" value="${pres || ""}" placeholder="S/ máx" min="0" step="1">
          <button onclick="guardarPresupuestoCat('${cat}')">✔</button>
        </div>
      </div>`;
  });
  html += "</div>";
  el.innerHTML = html;
}

function guardarPresupuestoCat(cat) {
  const id = "presup-" + cat.replace(/[\s]/g, "-");
  const val = parseFloat(document.getElementById(id).value) || 0;
  const presupuestos = JSON.parse(localStorage.getItem("presupuestos") || "{}");
  if (val > 0) presupuestos[cat] = val; else delete presupuestos[cat];
  localStorage.setItem("presupuestos", JSON.stringify(presupuestos));
  renderPresupuesto();
}

function cargarHistorial() {
  const periodo = document.getElementById("filtro-periodo").value;
  const tipoFiltro = document.getElementById("filtro-tipo").value;
  const fechaBase = document.getElementById("filtro-fecha-base").value;
  const todosMovimientos = JSON.parse(localStorage.getItem("movimientos") || "[]");

  // Resetear alerta antes de recalcular
  const alertEl = document.getElementById("alerta-limite");
  if (alertEl) alertEl.classList.add("oculto");

  // Tarjetas de resumen: solo filtro de período (ignoran el tipo seleccionado)
  const filtradosPeriodo = filtrarMovsPeriodo(todosMovimientos, periodo, fechaBase, "");
  renderResumenPeriodo(calcularTotales(filtradosPeriodo));
  renderAnalisisAdicional(filtradosPeriodo, periodo, fechaBase);

  if (periodo === "dia" && fechaBase) {
    const egresosDia = filtrarMovsPeriodo(todosMovimientos, "dia", fechaBase, "egreso");
    verificarLimiteDiario(calcularTotales(egresosDia).egresos);
  } else {
    const alertEl = document.getElementById("alerta-limite");
    if (alertEl) alertEl.classList.add("oculto");
  }

  if (periodo === "dia" && fechaBase) {
    const ref = (dias) => {
      const d = new Date(fechaBase + "T12:00:00");
      d.setDate(d.getDate() - dias);
      return d.toISOString().slice(0, 10);
    };
    renderComparativas(
      calcularTotales(filtrarMovsPeriodo(todosMovimientos, "dia", fechaBase, "")),
      calcularTotales(filtrarMovsPeriodo(todosMovimientos, "dia", ref(1), "")),
      calcularTotales(filtrarMovsPeriodo(todosMovimientos, "dia", ref(7), ""))
    );
  } else {
    document.getElementById("comparativa-periodo").innerHTML = "";
  }

  // Lista de movimientos: filtro de período + tipo
  const filtradosTipo = filtrarMovsPeriodo(todosMovimientos, periodo, fechaBase, tipoFiltro);
  const ul = document.getElementById("lista-historial");
  ul.innerHTML = "";
  if (filtradosTipo.length === 0) {
    ul.innerHTML = "<li>Sin movimientos en ese período.</li>";
    return;
  }

  filtradosTipo.sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).forEach(mov => {
    const li = document.createElement("li");
    li.className = "mov-card";

    const cuentaStr = mov.tipo === "intercambio"
      ? `${mov.origen} ➝ ${mov.destino}`
      : (mov.origen || mov.destino || "");

    const signo = mov.tipo === "ingreso" ? "+" : mov.tipo === "egreso" ? "-" : "";

    const info = document.createElement("div");
    info.className = "mov-info";
    info.innerHTML = `
      <div class="mov-header">
        <span class="mov-tipo-cat">${mov.tipo.toUpperCase()} · ${mov.categoria}</span>
        <span class="mov-edit">✏️</span>
      </div>
      <div class="mov-sub">${mov.fecha.slice(0, 10)} · ${cuentaStr}</div>
      ${mov.detalle ? `<div class="mov-detalle">📝 ${mov.detalle}</div>` : ""}
    `;
    info.querySelector(".mov-edit").onclick = () => abrirPopupEditar(mov);

    const monto = document.createElement("div");
    monto.className = `mov-monto mov-${mov.tipo}`;
    monto.textContent = `${signo}${mov.moneda} ${mov.monto.toFixed(2)}`;

    li.appendChild(info);
    li.appendChild(monto);
    ul.appendChild(li);
  });
}

// Resumen de cuentas
function renderResumenCuentas() {
  try {
    const cuentas = getCuentas();
    const tbody = document.querySelector("#tabla-cuentas tbody");
    const movimientos = JSON.parse(localStorage.getItem("movimientos") || "[]");
    const comisiones = JSON.parse(localStorage.getItem("comisiones") || "[]");

    if (!tbody) {
      console.error("Elemento #tabla-cuentas tbody no encontrado");
      return;
    }

    console.log("Movimientos en renderResumenCuentas:", movimientos.map(m => ({ tipo: m.tipo, destino: m.destino, origen: m.origen, monto: m.monto, categoria: m.categoria })));

    // Cuentas vinculadas: los movimientos de la clave se acumulan en el valor
    const cuentasVinculadas = {
      "Yape (conectado a 0092)": "BCP - Cuenta de ahorro 0092"
    };

    const saldos = new Map(cuentas.map(nombre => [nombre, 0]));
    movimientos.forEach(m => {
      let monto = m.moneda === "USD" ? m.monto * 3.8 : m.monto;
      const dest = cuentasVinculadas[m.destino] || m.destino;
      const orig = cuentasVinculadas[m.origen] || m.origen;
      if (m.tipo === "ingreso" && dest && saldos.has(dest)) {
        saldos.set(dest, saldos.get(dest) + monto);
      }
      if (m.tipo === "egreso" && orig && saldos.has(orig)) {
        saldos.set(orig, saldos.get(orig) - monto);
      }
      if (m.tipo === "intercambio") {
        if (orig && saldos.has(orig)) {
          saldos.set(orig, saldos.get(orig) - monto);
        }
        if (dest && saldos.has(dest)) {
          saldos.set(dest, saldos.get(dest) + monto);
        }
      }
    });

    tbody.innerHTML = "";
    let total = 0;
    const saldosArray = [];

    // Cuentas débito/ahorro
    cuentas.filter(nombre => !CUENTAS_CREDITO.includes(nombre)).forEach(nombre => {
      // Ocultar cuentas vinculadas (su saldo ya está en la cuenta principal)
      if (cuentasVinculadas[nombre]) return;
      const saldo = saldos.get(nombre);
      total += saldo;
      saldosArray.push({ nombre, saldo });

      const comision = comisiones.find(c => c.cuenta === nombre);
      const comTxt = comision
        ? `💸 S/ ${comision.monto.toFixed(2)} (${comision.frecuencia})`
        : "—";

      const color = saldo > 0 ? "green" : saldo < 0 ? "crimson" : "#333";
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${nombre}</td>
        <td style="color: ${color}; font-weight: bold">S/ ${saldo.toFixed(2)}</td>
        <td>${comTxt}</td>
        <td><div style="display:flex;gap:4px;align-items:center">
          <button title="Editar comisión" onclick="abrirPopupComision('${nombre}')">🧾</button>
          <button title="Eliminar cuenta" onclick="eliminarCuenta('${nombre}')">🗑️</button>
        </div></td>
      `;
      tbody.appendChild(tr);
    });

    // Sección tarjetas de crédito
    const tcEnCuentas = cuentas.filter(nombre => CUENTAS_CREDITO.includes(nombre));
    if (tcEnCuentas.length > 0) {
      const trHeader = document.createElement("tr");
      trHeader.innerHTML = `<td colspan="4" style="background:#fff3f3;color:#c0392b;font-weight:bold;padding:6px 8px;font-size:0.85rem">&#x1F4B3; Tarjetas de cr&eacute;dito (deuda)</td>`;
      tbody.appendChild(trHeader);
      let deudaTC = 0;
      const tcMeta = getTCMetadata();
      tcEnCuentas.forEach(nombre => {
        const saldo = saldos.get(nombre) || 0;
        const deuda = saldo < 0 ? -saldo : 0;
        deudaTC += deuda;
        const color = deuda > 0 ? "crimson" : "#52b788";
        const deudaTxt = deuda > 0 ? `-S/ ${deuda.toFixed(2)}` : "S/ 0.00";
        const diaVenc = tcMeta[nombre]?.diaVencimiento;
        const diasVenc = diaVenc ? diasHastaVencimiento(diaVenc) : null;
        const vencTxt = diaVenc
          ? `📅 Día ${diaVenc}${diasVenc !== null && diasVenc <= 7 ? ` (${diasVenc}d)` : ""}`
          : "—";
        const vencColor = diaVenc && diasVenc <= 3 ? "crimson" : diaVenc && diasVenc <= 7 ? "#e76f51" : "#666";
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${nombre}</td>
          <td style="color: ${color}; font-weight: bold">${deudaTxt}</td>
          <td style="color:${vencColor};font-size:0.72rem">${vencTxt}</td>
          <td><div style="display:flex;gap:4px;align-items:center">
            <button title="Editar vencimiento" onclick="editarVencimientoTC('${nombre}')">&#x1F4C5;</button>
            <button title="Eliminar cuenta" onclick="eliminarCuenta('${nombre}')">&#x1F5D1;&#xFE0F;</button>
          </div></td>
        `;
        tbody.appendChild(tr);
      });
      const trTotal = document.createElement("tr");
      trTotal.innerHTML = `<td colspan="2" style="text-align:right;color:crimson;font-weight:bold;padding:4px 8px">Deuda total TC: S/ ${deudaTC.toFixed(2)}</td><td colspan="2"></td>`;
      tbody.appendChild(trTotal);
    }

    const totalDiv = document.getElementById("total-cuentas");
    if (totalDiv) {
      totalDiv.textContent = `Total: S/ ${total.toFixed(2)}`;
      totalDiv.style.color = total > 0 ? "green" : total < 0 ? "crimson" : "#333";
      totalDiv.style.fontWeight = "bold";
    } else {
      console.error("Elemento #total-cuentas no encontrado");
    }

    console.log("Cuentas:", cuentas);
    console.log("Saldos calculados:", saldosArray);
    console.log("Total:", total);
  } catch (error) {
    console.error("Error al renderizar resumen de cuentas:", error);
  }
}

// Añadir cuenta
function mostrarFormularioCuenta() {
  document.getElementById("nueva-cuenta-nombre").value = "";
  document.getElementById("popup-nueva-cuenta").classList.remove("oculto");
}

function agregarCuenta() {
  const nombre = document.getElementById("nueva-cuenta-nombre").value.trim();
  if (!nombre) return alert("Nombre inválido");
  const cuentas = getCuentas();
  if (cuentas.includes(nombre)) return alert("La cuenta ya existe");
  cuentas.push(nombre);
  guardarCuentas(cuentas);
  cerrarPopup();
  renderResumenCuentas();
}

// Eliminar cuenta
function eliminarCuenta(nombre) {
  if (!confirm(`¿Seguro que deseas eliminar la cuenta "${nombre}"?`)) return;
  let cuentas = getCuentas();
  cuentas = cuentas.filter(c => c !== nombre);
  guardarCuentas(cuentas);
  renderResumenCuentas();
}

// Comisiones
function abrirPopupComision(nombre) {
  cuentaComisionSeleccionada = nombre;
  document.getElementById("cuenta-comision-nombre").textContent = nombre;
  document.getElementById("popup-comision").classList.remove("oculto");
}

function editarVencimientoTC(nombre) {
  tcVencimientoSeleccionada = nombre;
  const meta = getTCMetadata();
  document.getElementById("tc-vencimiento-nombre").textContent = nombre;
  document.getElementById("input-dia-vencimiento").value = meta[nombre]?.diaVencimiento || "";
  document.getElementById("popup-vencimiento-tc").classList.remove("oculto");
}

function guardarVencimientoTC() {
  const dia = parseInt(document.getElementById("input-dia-vencimiento").value);
  if (!dia || dia < 1 || dia > 28) return alert("Ingresa un día válido entre 1 y 28");
  const meta = getTCMetadata();
  meta[tcVencimientoSeleccionada] = { ...meta[tcVencimientoSeleccionada], diaVencimiento: dia };
  guardarTCMetadata(meta);
  cerrarPopupVencimientoTC();
  renderResumenCuentas();
  renderPanelInicio();
}

function cerrarPopupVencimientoTC() {
  document.getElementById("popup-vencimiento-tc").classList.add("oculto");
  tcVencimientoSeleccionada = null;
}

function guardarComision() {
  const monto = parseFloat(document.getElementById("monto-comision").value);
  const frecuencia = document.getElementById("frecuencia-comision").value;
  if (!monto || monto <= 0) return alert("Monto inválido");

  const datos = JSON.parse(localStorage.getItem("comisiones") || "[]");
  datos.push({
    cuenta: cuentaComisionSeleccionada,
    monto,
    frecuencia,
    fecha: new Date().toISOString()
  });

  localStorage.setItem("comisiones", JSON.stringify(datos));
  cerrarPopup();
  alert("Comisión guardada.");
}

// IA
async function analizarConIA() {
  const el = document.getElementById("respuesta-ia");
  if (!el) return;
  el.classList.remove("ia-oculto");
  el.textContent = "⏳ Analizando tus finanzas...";

  const datos = JSON.parse(localStorage.getItem("movimientos") || "[]");
  const hoy = hoyPeru();
  const mesActual = hoy.slice(0, 7);
  const egresosMes = datos.filter(m => m.tipo === "egreso" && m.fecha?.slice(0, 7) === mesActual);
  const ingresosMes = datos.filter(m => m.tipo === "ingreso" && m.fecha?.slice(0, 7) === mesActual);
  const totalE = egresosMes.reduce((s, m) => s + (m.moneda === "USD" ? m.monto * 3.8 : m.monto), 0);
  const totalI = ingresosMes.reduce((s, m) => s + (m.moneda === "USD" ? m.monto * 3.8 : m.monto), 0);
  const freq = {};
  egresosMes.forEach(m => { if (m.categoria) freq[m.categoria] = (freq[m.categoria] || 0) + (m.moneda === "USD" ? m.monto * 3.8 : m.monto); });
  const porCategoria = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([cat, monto]) => `${cat}: S/ ${monto.toFixed(2)}`).join(", ");
  const metaAhorro = parseFloat(localStorage.getItem("metaAhorro") || "0");
  const limiteDiario = parseFloat(localStorage.getItem("limiteDiario") || "0");

  const prompt = `Eres un asesor financiero personal. Responde en español usando bullets (•).

RESUMEN FINANCIERO (${mesActual}):
• Ingresos del mes: S/ ${totalI.toFixed(2)}
• Egresos del mes: S/ ${totalE.toFixed(2)}
• Balance: S/ ${(totalI - totalE).toFixed(2)}
• Gastos por categoría: ${porCategoria || "sin datos"}
• Meta de ahorro mensual: ${metaAhorro > 0 ? `S/ ${metaAhorro}` : "no configurada"}
• Límite diario: ${limiteDiario > 0 ? `S/ ${limiteDiario}` : "no configurado"}

Historial reciente: ${JSON.stringify(datos.slice(-50))}

Dáme:
1. 📊 3 observaciones clave sobre mis patrones de gasto
2. 💡 2 sugerencias concretas para aumentar mi ahorro este mes
3. ⚠️ 1 alerta si ves algún riesgo financiero
4. 🎯 Proyección: si sigo este ritmo, ¿cómo termina el mes?

Sé directo, usa bullets y habla de "tú".`;

  try {
    const res = await fetch("/api/openai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt })
    });
    if (!res.ok) throw new Error(`${res.status} - ${res.statusText}`);
    const json = await res.json();
    el.textContent = json.respuesta || "No se pudo procesar la respuesta.";
  } catch (error) {
    console.error("Error en analizarConIA:", error);
    el.textContent = `Error al analizar: ${error.message}.`;
  }
}

function renderInsightsLocales() {
  const el = document.getElementById("ia-insights-grid");
  if (!el) return;

  const datos = JSON.parse(localStorage.getItem("movimientos") || "[]");
  const hoy = hoyPeru();
  const mesActual = hoy.slice(0, 7);
  const diaHoy = parseInt(hoy.slice(8, 10));
  const [y, m] = mesActual.split("-").map(Number);
  const prev = new Date(y, m - 2, 1);
  const mesPasado = prev.getFullYear() + "-" + String(prev.getMonth() + 1).padStart(2, "0");

  const egresosMes = datos.filter(m => m.tipo === "egreso" && m.fecha?.slice(0, 7) === mesActual);
  const egresosMesPas = datos.filter(m => m.tipo === "egreso" && m.fecha?.slice(0, 7) === mesPasado);
  const ingresosMes = datos.filter(m => m.tipo === "ingreso" && m.fecha?.slice(0, 7) === mesActual);
  const totalE = egresosMes.reduce((s, m) => s + (m.moneda === "USD" ? m.monto * 3.8 : m.monto), 0);
  const totalEP = egresosMesPas.reduce((s, m) => s + (m.moneda === "USD" ? m.monto * 3.8 : m.monto), 0);
  const totalI = ingresosMes.reduce((s, m) => s + (m.moneda === "USD" ? m.monto * 3.8 : m.monto), 0);
  const promDiario = diaHoy > 0 ? totalE / diaHoy : 0;

  const freq = {};
  egresosMes.forEach(m => { if (m.categoria) freq[m.categoria] = (freq[m.categoria] || 0) + (m.moneda === "USD" ? m.monto * 3.8 : m.monto); });
  const catTop = Object.entries(freq).sort((a, b) => b[1] - a[1])[0];

  let tendTxt = "—", tendColor = "#333";
  if (totalEP > 0) {
    const delta = (totalE - totalEP) / totalEP * 100;
    tendTxt = (delta > 0 ? "+" : "") + delta.toFixed(1) + "%";
    tendColor = delta > 10 ? "#ee6c4d" : delta > 0 ? "#f4a261" : "#52b788";
  }

  const limiteDiario = parseFloat(localStorage.getItem("limiteDiario") || "0");
  let diasExceso = 0;
  if (limiteDiario > 0) {
    const porDia = {};
    egresosMes.forEach(m => {
      const d = m.fecha?.slice(0, 10);
      if (d) porDia[d] = (porDia[d] || 0) + (m.moneda === "USD" ? m.monto * 3.8 : m.monto);
    });
    diasExceso = Object.values(porDia).filter(v => v > limiteDiario).length;
  }

  const balance = totalI - totalE;
  const balColor = balance >= 0 ? "#52b788" : "#ee6c4d";

  // Día de semana con más gasto
  const porDiaSemana = [0, 0, 0, 0, 0, 0, 0];
  egresosMes.forEach(m => {
    if (m.fecha) {
      const d = new Date(m.fecha.slice(0, 10) + "T12:00:00");
      porDiaSemana[d.getDay()] += (m.moneda === "USD" ? m.monto * 3.8 : m.monto);
    }
  });
  const dias = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const maxDia = porDiaSemana.indexOf(Math.max(...porDiaSemana));

  const cards = [
    { label: "Gasto promedio diario", valor: `S/ ${promDiario.toFixed(2)}`, sub: `${diaHoy} días transcurridos`, color: "#008cba" },
    { label: "Mayor categoría del mes", valor: catTop ? catTop[0] : "—", sub: catTop ? `S/ ${catTop[1].toFixed(2)}` : "Sin datos", color: "#6d28d9" },
    { label: "Tendencia vs mes anterior", valor: tendTxt, sub: `Anterior: S/ ${totalEP.toFixed(0)}`, color: tendColor },
    { label: "Balance del mes", valor: `S/ ${balance.toFixed(2)}`, sub: balance >= 0 ? "✅ Ahorro positivo" : "⚠️ Gasto mayor a ingresos", color: balColor },
    { label: "Día con más gasto", valor: dias[maxDia], sub: `S/ ${porDiaSemana[maxDia].toFixed(2)} acumulado`, color: "#e76f51" },
    ...(limiteDiario > 0 ? [{ label: "Días sobre el límite", valor: `${diasExceso} día${diasExceso !== 1 ? "s" : ""}`, sub: `Límite: S/ ${limiteDiario.toFixed(0)}/día`, color: diasExceso > 0 ? "#ee6c4d" : "#52b788" }] : [])
  ];

  el.innerHTML = cards.map(c => `
    <div class="ia-insight-card" style="border-left-color:${c.color}">
      <span class="ia-insight-label">${c.label}</span>
      <span class="ia-insight-valor" style="color:${c.color}">${c.valor}</span>
      <span class="ia-insight-sub">${c.sub}</span>
    </div>
  `).join("");
}

function preguntaRapidaIA(pregunta) {
  const input = document.getElementById("ia-pregunta-input");
  if (input) input.value = pregunta;
  enviarPreguntaIA();
}

async function enviarPreguntaIA() {
  const inputEl = document.getElementById("ia-pregunta-input");
  const respEl = document.getElementById("ia-chat-respuesta");
  if (!inputEl || !respEl) return;
  const pregunta = inputEl.value.trim();
  if (!pregunta) return;

  respEl.classList.remove("ia-oculto");
  respEl.textContent = "⏳ Pensando...";

  const datos = JSON.parse(localStorage.getItem("movimientos") || "[]");
  const hoy = hoyPeru();
  const mesActual = hoy.slice(0, 7);
  const totalE = datos.filter(m => m.tipo === "egreso" && m.fecha?.slice(0, 7) === mesActual).reduce((s, m) => s + (m.moneda === "USD" ? m.monto * 3.8 : m.monto), 0);
  const totalI = datos.filter(m => m.tipo === "ingreso" && m.fecha?.slice(0, 7) === mesActual).reduce((s, m) => s + (m.moneda === "USD" ? m.monto * 3.8 : m.monto), 0);
  const metaAhorro = parseFloat(localStorage.getItem("metaAhorro") || "0");

  const prompt = `Eres un asesor financiero personal. Responde en español de forma concisa y práctica.

Contexto del usuario (${mesActual}):
• Ingresos: S/ ${totalI.toFixed(2)}
• Egresos: S/ ${totalE.toFixed(2)}
• Balance: S/ ${(totalI - totalE).toFixed(2)}
• Meta de ahorro: ${metaAhorro > 0 ? `S/ ${metaAhorro}` : "no configurada"}
• Historial: ${JSON.stringify(datos.slice(-60))}

Pregunta: "${pregunta}"

Responde directamente, de forma corta y útil. Usa bullets si conviene.`;

  try {
    const res = await fetch("/api/openai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt })
    });
    if (!res.ok) throw new Error(`${res.status}`);
    const json = await res.json();
    respEl.textContent = json.respuesta || "Sin respuesta.";
  } catch (e) {
    respEl.textContent = `Error: ${e.message}`;
  }
  inputEl.value = "";
}

// Editar movimientos
function abrirPopupEditar(mov) {
  indiceEdicion = mov.index;
  document.getElementById("editar-tipo").value = mov.tipo;
  document.getElementById("editar-monto").value = mov.monto;
  document.getElementById("editar-moneda").value = mov.moneda || "PEN";
  document.getElementById("editar-detalle").value = mov.detalle || "";
  document.getElementById("editar-fecha").value = mov.fecha?.slice(0, 10) || "";

  const sel = document.getElementById("editar-cuenta");
  sel.innerHTML = "";
  getCuentas().forEach(c => {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    sel.appendChild(opt);
  });
  sel.value = mov.origen || mov.destino || "";

  document.getElementById("popup-editar-movimiento").classList.remove("oculto");
}

function guardarEdicionMovimiento() {
  const tipo = document.getElementById("editar-tipo").value;
  const cuenta = document.getElementById("editar-cuenta").value;
  const monto = parseFloat(document.getElementById("editar-monto").value);
  const moneda = document.getElementById("editar-moneda").value;
  const detalle = document.getElementById("editar-detalle").value;
  const fecha = document.getElementById("editar-fecha").value;

  if (!monto || !fecha) return alert("Monto o fecha inválidos.");

  const datos = JSON.parse(localStorage.getItem("movimientos") || "[]");
  datos[indiceEdicion] = {
    tipo,
    categoria: datos[indiceEdicion].categoria,
    origen: tipo === "ingreso" ? "" : cuenta,
    destino: tipo === "ingreso" ? cuenta : tipo === "egreso" ? "" : datos[indiceEdicion].destino,
    monto,
    moneda,
    detalle,
    fecha: fecha + "T12:00:00"
  };

  localStorage.setItem("movimientos", JSON.stringify(datos));
  cerrarPopupEditar();
  renderResumenCuentas();
  cargarHistorial();
  renderizarGraficos();
}

function confirmarEliminarMovimiento() {
  if (!confirm("¿Eliminar este movimiento?")) return;
  const datos = JSON.parse(localStorage.getItem("movimientos") || "[]");
  datos.splice(indiceEdicion, 1);
  localStorage.setItem("movimientos", JSON.stringify(datos));
  cerrarPopupEditar();
  renderResumenCuentas();
  cargarHistorial();
  renderizarGraficos();
}

function cerrarPopupEditar() {
  document.getElementById("popup-editar-movimiento").classList.add("oculto");
}

function cerrarPopupComision() {
  document.getElementById("popup-comision").classList.add("oculto");
}

function renderizarGraficos() {
  try {
    const movimientos = JSON.parse(localStorage.getItem("movimientos") || "[]");

    // ── Últimos 6 meses ──
    const hoy = hoyPeru();
    const [anioHoy, mesHoy] = hoy.split("-").map(Number);
    const mesesKeys = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(anioHoy, mesHoy - 1 - i, 1);
      mesesKeys.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`);
    }
    const labelsFormat = mesesKeys.map(m => {
      const [y, mo] = m.split("-");
      return new Date(parseInt(y), parseInt(mo)-1, 1)
        .toLocaleDateString("es-PE", { month: "short", year: "2-digit" });
    });

    const resumen = {};
    mesesKeys.forEach(m => resumen[m] = { ingreso: 0, egreso: 0 });
    movimientos.forEach(m => {
      if (m.tipo === "intercambio") return;
      const mes = m.fecha?.slice(0, 7);
      if (!mes || !resumen[mes]) return;
      const monto = m.moneda === "USD" ? m.monto * 3.8 : m.monto;
      if (m.tipo === "ingreso") resumen[mes].ingreso += monto;
      if (m.tipo === "egreso")  resumen[mes].egreso  += monto;
    });

    const ingresosData = mesesKeys.map(m => +resumen[m].ingreso.toFixed(2));
    const egresosData  = mesesKeys.map(m => +resumen[m].egreso.toFixed(2));
    const saldoData    = mesesKeys.map(m => +(resumen[m].ingreso - resumen[m].egreso).toFixed(2));

    const fmtPEN = v => `S/ ${v.toFixed(2)}`;

    // ── Chart 1: Barras ingresos vs egresos ──
    const cvBarras = document.getElementById("grafico-barras");
    if (chartBarras) chartBarras.destroy();
    chartBarras = new Chart(cvBarras, {
      type: "bar",
      data: {
        labels: labelsFormat,
        datasets: [
          { label: "Ingresos", data: ingresosData, backgroundColor: "#0a9396", borderRadius: 6, borderSkipped: false },
          { label: "Egresos",  data: egresosData,  backgroundColor: "#ee6c4d", borderRadius: 6, borderSkipped: false }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: "bottom", labels: { boxWidth: 12, padding: 14, font: { size: 11 } } },
          tooltip: { callbacks: { label: ctx => " " + fmtPEN(ctx.parsed.y) } }
        },
        scales: {
          y: { beginAtZero: true, grid: { color: "#f4f4f4" }, ticks: { font: { size: 10 }, callback: v => `S/${v}` } },
          x: { grid: { display: false }, ticks: { font: { size: 10 } } }
        }
      }
    });

    // ── Chart 2: Barras horizontales por categoría (mes actual) ──
    const mesActual = hoy.slice(0, 7);
    const porCat = {};
    movimientos
      .filter(m => m.tipo === "egreso" && m.fecha?.slice(0, 7) === mesActual)
      .forEach(m => {
        const monto = m.moneda === "USD" ? m.monto * 3.8 : m.monto;
        porCat[m.categoria] = (porCat[m.categoria] || 0) + monto;
      });
    const cats = Object.entries(porCat).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const catLabels = cats.length ? cats.map(c => c[0]) : ["Sin egresos"];
    const catData   = cats.length ? cats.map(c => +c[1].toFixed(2)) : [0];
    const catColors = cats.map((_, i) => {
      const t = cats.length > 1 ? i / (cats.length - 1) : 0;
      return `hsl(${185 - t * 40}, ${70 - t * 20}%, ${40 + t * 20}%)`;
    });

    const cvCat = document.getElementById("grafico-categorias");
    if (chartCategorias) chartCategorias.destroy();
    chartCategorias = new Chart(cvCat, {
      type: "bar",
      data: {
        labels: catLabels,
        datasets: [{
          data: catData,
          backgroundColor: cats.length ? catColors : ["#ddd"],
          borderRadius: 5,
          borderSkipped: false
        }]
      },
      options: {
        indexAxis: "y",
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => " " + fmtPEN(ctx.parsed.x) } }
        },
        scales: {
          x: { beginAtZero: true, grid: { color: "#f4f4f4" }, ticks: { font: { size: 10 }, callback: v => `S/${v}` } },
          y: { grid: { display: false }, ticks: { font: { size: 10 } } }
        }
      }
    });

    // ── Chart 3: Línea de balance neto mensual ──
    const cvTend = document.getElementById("grafico-tendencia");
    const ctx3 = cvTend.getContext("2d");
    const grad = ctx3.createLinearGradient(0, 0, 0, 200);
    grad.addColorStop(0, "rgba(10,147,150,0.25)");
    grad.addColorStop(1, "rgba(10,147,150,0.01)");

    if (chartTendencia) chartTendencia.destroy();
    chartTendencia = new Chart(cvTend, {
      type: "line",
      data: {
        labels: labelsFormat,
        datasets: [{
          label: "Balance neto",
          data: saldoData,
          borderColor: "#0a9396",
          backgroundColor: grad,
          borderWidth: 2.5,
          pointBackgroundColor: saldoData.map(v => v >= 0 ? "#0a9396" : "#ee6c4d"),
          pointBorderColor: "#fff",
          pointBorderWidth: 1.5,
          pointRadius: 5,
          pointHoverRadius: 7,
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => " " + fmtPEN(ctx.parsed.y) } }
        },
        scales: {
          y: { grid: { color: "#f4f4f4" }, ticks: { font: { size: 10 }, callback: v => `S/${v}` } },
          x: { grid: { display: false }, ticks: { font: { size: 10 } } }
        }
      }
    });

  } catch (e) {
    console.error("Error al renderizar gráficos:", e);
  }
}

// Inicialización
function init() {
  try {
    const desde = document.getElementById("cuenta-desde");
    const hacia = document.getElementById("cuenta-hacia");
    if (!desde || !hacia) {
      console.error("Elementos cuenta-desde o cuenta-hacia no encontrados");
      return;
    }
    getCuentas().forEach(c => {
      const o1 = document.createElement("option");
      const o2 = document.createElement("option");
      o1.value = o2.value = c;
      o1.textContent = o2.textContent = c;
      desde.appendChild(o1);
      hacia.appendChild(o2);
    });
    navigationStack.push("inicio");

    // Poblar select de registro rápido removido (ahora es dinámico en renderPanelInicio)

    cargarHistorial();
    renderResumenCuentas();
    renderizarGraficos();
    renderPanelInicio();
  } catch (error) {
    console.error("Error al inicializar la aplicación:", error);
  }
}
init();