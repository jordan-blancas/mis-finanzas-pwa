const cuentasIniciales = [
  "BCP - Cuenta de ahorro 0092",
  "BCP - Cuenta Digital Soles 1062",
  "BCP - Cuenta Digital Soles 4017",
  "BCP - Cuenta Digital Dólares 0193",
  "BCP - Cuenta Corriente 2015",
  "Yape (conectado a 0092)",
  "BCP - Corriente VATIO S.A.C.",
  "BBVA - Cuenta de ahorro",
  "Interbank - Cuenta de ahorro",
  "Interbank - Tarjeta de crédito VISA",
  "Banco de la Nación - Cuenta de ahorro",
  "Tarjeta OH",
  "AMEX Gold",
  "Efectivo"
];

let tipoActual = "";
let categoriaActual = "";
let detalleActual = "";
let origen = "";
let destino = "";
let montoTemp = 0;
let monedaTemp = "PEN";
let cuentaComisionSeleccionada = "";

// Navegación
const navigationStack = [];

function cambiarVista(id) {
  document.querySelectorAll(".vista").forEach(v => v.classList.remove("activa"));
  document.getElementById("vista-" + id).classList.add("activa");
  if (navigationStack[navigationStack.length - 1] !== id) {
    navigationStack.push(id);
  }
  tipoActual = id;
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
  detalleActual = document.getElementById("detalle-egreso").value;
  cargarCuentas("cuenta", "Desde qué cuenta se pagó");
}

function seleccionarIngreso(fuente) {
  categoriaActual = fuente;
  detalleActual = document.getElementById("detalle-ingreso").value;
  cargarCuentas("cuenta", "¿Dónde se depositó?");
}

function usarIngresoManual() {
  const otra = document.getElementById("nuevo-ingreso").value.trim();
  if (!otra) return alert("Ingresa una fuente personalizada.");
  categoriaActual = otra;
  detalleActual = document.getElementById("detalle-ingreso").value;
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
  const sel = document.getElementById("cuenta-seleccionada");
  sel.innerHTML = "";
  getCuentas().forEach(c => {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    sel.appendChild(opt);
  });
  cambiarVista(vista);
}

function pasarAPaginaMontoDesdeCuenta() {
  const seleccion = document.getElementById("cuenta-seleccionada").value;
  if (tipoActual === "ingreso") {
    destino = seleccion;
  } else {
    origen = seleccion;
  }
  cambiarVista("monto");
}

// Guardar movimiento
function guardarMovimiento() {
  montoTemp = parseFloat(document.getElementById("monto").value);
  monedaTemp = document.getElementById("moneda").value;
  if (!montoTemp || montoTemp <= 0) {
    alert("Monto inválido");
    return;
  }
  document.getElementById("popup-confirmacion").classList.remove("oculto");
}

function confirmarGuardar() {
  const registro = {
    tipo: tipoActual,
    categoria: categoriaActual,
    detalle: detalleActual,
    origen,
    destino,
    monto: montoTemp,
    moneda: monedaTemp,
    fecha: new Date().toISOString()
  };

  const datos = JSON.parse(localStorage.getItem("movimientos") || "[]");
  datos.push(registro);
  localStorage.setItem("movimientos", JSON.stringify(datos));

  cerrarPopup();
  alert("Movimiento guardado");
  location.reload();
}

function cancelarGuardar() {
  cerrarPopup();
}

function cerrarPopup() {
  document.getElementById("popup-confirmacion").classList.add("oculto");
  document.getElementById("popup-nueva-cuenta")?.classList.add("oculto");
  document.getElementById("popup-comision")?.classList.add("oculto");
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
  document.querySelectorAll(".subvista").forEach(s => s.classList.remove("activa"));
  document.getElementById("subvista-" + id).classList.add("activa");
  if (id === "historial") cargarHistorial();
  if (id === "graficos") renderizarGraficos();
  if (id === "resumen") renderResumenCuentas();
}

// HISTORIAL
function cargarHistorial() {
  const fechaBase = document.getElementById("filtro-fecha-base").value;
  const tipoFiltro = document.getElementById("filtro-tipo").value;
  const periodo = document.getElementById("filtro-periodo").value;
  const movimientos = JSON.parse(localStorage.getItem("movimientos") || "[]");

  const filtrados = movimientos.filter(mov => {
    if (tipoFiltro && mov.tipo !== tipoFiltro) return false;
    if (!fechaBase) return true;

    const fechaMov = new Date(mov.fecha);
    const fechaFiltro = new Date(fechaBase);
    if (periodo === "dia") return fechaMov.toDateString() === fechaFiltro.toDateString();
    if (periodo === "mes") return mov.fecha.slice(0, 7) === fechaBase;
    if (periodo === "anio") return mov.fecha.slice(0, 4) === fechaBase.slice(0, 4);
    if (periodo === "trimestre") {
      const mes = parseInt(mov.fecha.slice(5, 7));
      const q = Math.floor((mes - 1) / 3);
      const qFiltro = Math.floor((parseInt(fechaBase.slice(5, 7)) - 1) / 3);
      return mov.fecha.slice(0, 4) === fechaBase.slice(0, 4) && q === qFiltro;
    }
    return true;
  });

  const ul = document.getElementById("lista-historial");
  ul.innerHTML = "";
  if (filtrados.length === 0) {
    ul.innerHTML = "<li>Sin movimientos en ese período.</li>";
    return;
  }

  filtrados.sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).forEach(mov => {
    const li = document.createElement("li");
    let linea = `[${mov.fecha.slice(0,10)}] ${mov.tipo.toUpperCase()} - ${mov.categoria}: ${mov.moneda} ${mov.monto.toFixed(2)}`;
    if (mov.tipo === "intercambio") {
      linea += ` (${mov.origen} ➝ ${mov.destino})`;
    } else {
      linea += ` (${mov.origen || mov.destino})`;
    }
    if (mov.detalle) linea += `\n📝 ${mov.detalle}`;
    li.textContent = linea;
    ul.appendChild(li);
  });
}

// RESUMEN DE CUENTAS
function renderResumenCuentas() {
  const cuentas = getCuentas();
  const tbody = document.querySelector("#tabla-cuentas tbody");
  const movimientos = JSON.parse(localStorage.getItem("movimientos") || "[]");
  const comisiones = JSON.parse(localStorage.getItem("comisiones") || "[]");
  tbody.innerHTML = "";

  let total = 0;

  cuentas.forEach(nombre => {
    let saldo = 0;
    movimientos.forEach(m => {
      if (m.tipo === "ingreso" && m.destino === nombre) saldo += m.monto;
      if (m.tipo === "egreso" && m.origen === nombre) saldo -= m.monto;
      if (m.tipo === "intercambio") {
        if (m.origen === nombre) saldo -= m.monto;
        if (m.destino === nombre) saldo += m.monto;
      }
    });

    total += saldo;

    // 🔍 Aquí buscamos si la cuenta tiene comisión registrada
    const comision = comisiones.find(c => c.cuenta === nombre);
    const comTxt = comision
      ? `💸 S/ ${comision.monto.toFixed(2)} (${comision.frecuencia})`
      : "—";

    const color = saldo > 0 ? "green" : saldo < 0 ? "crimson" : "#333";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="min-width: 180px;">${nombre}</td>
      <td style="min-width: 100px; color: ${color}; font-weight: bold;">S/ ${saldo.toFixed(2)}</td>
      <td style="min-width: 150px;">${comTxt}</td>
      <td style="display: flex; gap: 0.5em; align-items: center;">
        <button title="Editar comisión" onclick="abrirPopupComision('${nombre}')">🧾</button>
        <button title="Eliminar cuenta" onclick="eliminarCuenta('${nombre}')">🗑️</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  const totalDiv = document.getElementById("total-cuentas");
  totalDiv.textContent = `Total: S/ ${total.toFixed(2)}`;
  totalDiv.style.color = total > 0 ? "green" : total < 0 ? "crimson" : "#333";
  totalDiv.style.fontWeight = "bold";
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
  const datos = JSON.parse(localStorage.getItem("movimientos") || "[]");
  const prompt = `
Soy tu asistente financiero. Aquí tienes tus movimientos:
${JSON.stringify(datos, null, 2)}
Analiza tus finanzas. ¿En qué podrías ahorrar más? ¿Qué gastos se repiten? ¿Tienes ingresos suficientes? ¿Qué podrías mejorar o eliminar para invertir más?
  `;

  document.getElementById("respuesta-ia").textContent = "Analizando, por favor espera...";

  const res = await fetch("/api/openai", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ prompt })
  });

  const json = await res.json();
  document.getElementById("respuesta-ia").textContent = json.respuesta || "Error al analizar.";
}


// Init
function init() {
  const desde = document.getElementById("cuenta-desde");
  const hacia = document.getElementById("cuenta-hacia");
  getCuentas().forEach(c => {
    const o1 = document.createElement("option");
    const o2 = document.createElement("option");
    o1.value = o2.value = c;
    o1.textContent = o2.textContent = c;
    desde.appendChild(o1);
    hacia.appendChild(o2);
  });
  navigationStack.push("inicio");
}
init();

// ========== EDITAR MOVIMIENTOS ==========

let indiceEdicion = -1;

function cargarHistorial() {
  const fechaBase = document.getElementById("filtro-fecha-base").value;
  const tipoFiltro = document.getElementById("filtro-tipo").value;
  const periodo = document.getElementById("filtro-periodo").value;
  const movimientos = JSON.parse(localStorage.getItem("movimientos") || "[]");

  const filtrados = movimientos.map((m, i) => ({ ...m, index: i })).filter(mov => {
    if (tipoFiltro && mov.tipo !== tipoFiltro) return false;
    if (!fechaBase) return true;

    const fechaMov = new Date(mov.fecha);
    const fechaFiltro = new Date(fechaBase);
    if (periodo === "dia") return fechaMov.toDateString() === fechaFiltro.toDateString();
    if (periodo === "mes") return mov.fecha.slice(0, 7) === fechaBase;
    if (periodo === "anio") return mov.fecha.slice(0, 4) === fechaBase.slice(0, 4);
    if (periodo === "trimestre") {
      const mes = parseInt(mov.fecha.slice(5, 7));
      const q = Math.floor((mes - 1) / 3);
      const qFiltro = Math.floor((parseInt(fechaBase.slice(5, 7)) - 1) / 3);
      return mov.fecha.slice(0, 4) === fechaBase.slice(0, 4) && q === qFiltro;
    }
    return true;
  });

  const ul = document.getElementById("lista-historial");
  ul.innerHTML = "";
  if (filtrados.length === 0) {
    ul.innerHTML = "<li>Sin movimientos en ese período.</li>";
    return;
  }

  filtrados.sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).forEach(mov => {
    const li = document.createElement("li");
    let linea = `[${mov.fecha.slice(0, 10)}] ${mov.tipo.toUpperCase()} - ${mov.categoria}: ${mov.moneda} ${mov.monto.toFixed(2)}`;
    if (mov.tipo === "intercambio") {
      linea += ` (${mov.origen} ➝ ${mov.destino})`;
    } else {
      linea += ` (${mov.origen || mov.destino})`;
    }
    if (mov.detalle) linea += `\n📝 ${mov.detalle}`;

    const span = document.createElement("span");
    span.textContent = " ✏️";
    span.style.cursor = "pointer";
    span.style.marginLeft = "6px";
    span.onclick = () => abrirPopupEditar(mov);

    li.textContent = linea;
    li.appendChild(span);
    ul.appendChild(li);
  });
}

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
    fecha: new Date(fecha).toISOString()
  };

  localStorage.setItem("movimientos", JSON.stringify(datos));
  cerrarPopupEditar();
  renderResumenCuentas();
  cargarHistorial();
  renderizarGraficos?.();
}

function confirmarEliminarMovimiento() {
  if (!confirm("¿Eliminar este movimiento?")) return;
  const datos = JSON.parse(localStorage.getItem("movimientos") || "[]");
  datos.splice(indiceEdicion, 1);
  localStorage.setItem("movimientos", JSON.stringify(datos));
  cerrarPopupEditar();
  renderResumenCuentas();
  cargarHistorial();
  renderizarGraficos?.();
}

function cerrarPopupEditar() {
  document.getElementById("popup-editar-movimiento").classList.add("oculto");
}

// ========== CORREGIR BOTÓN CANCELAR POPUP DE COMISIÓN ==========
function cerrarPopupComision() {
  document.getElementById("popup-comision").classList.add("oculto");
}

// ========== GRÁFICOS ==========

let chartBarras, chartTorta;

function renderizarGraficos() {
  const movimientos = JSON.parse(localStorage.getItem("movimientos") || "[]");
  const ingresos = movimientos.filter(m => m.tipo === "ingreso");
  const egresos = movimientos.filter(m => m.tipo === "egreso");

  // ========== Gráfico de barras ==========
  const resumenMensual = {};
  movimientos.forEach(m => {
    const mes = m.fecha?.slice(0, 7); // yyyy-mm
    if (!mes) return;
    if (!resumenMensual[mes]) resumenMensual[mes] = { ingreso: 0, egreso: 0 };
    resumenMensual[mes][m.tipo] += m.monto;
  });

  const labels = Object.keys(resumenMensual).sort();
  const ingresosData = labels.map(m => resumenMensual[m].ingreso);
  const egresosData = labels.map(m => resumenMensual[m].egreso);

  // Si ya hay un gráfico, lo destruimos antes de crear uno nuevo
  if (chartBarras) chartBarras.destroy();

  chartBarras = new Chart(document.getElementById("grafico-barras"), {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "Ingresos", data: ingresosData, backgroundColor: "green" },
        { label: "Egresos", data: egresosData, backgroundColor: "crimson" }
      ]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: "bottom" } }
    }
  });

  // ========== Gráfico de torta ==========
  const porCategoria = {};
  egresos.forEach(m => {
    if (!porCategoria[m.categoria]) porCategoria[m.categoria] = 0;
    porCategoria[m.categoria] += m.monto;
  });

  // Si ya hay un gráfico, lo destruimos antes de crear uno nuevo
  if (chartTorta) chartTorta.destroy();

  chartTorta = new Chart(document.getElementById("grafico-torta"), {
    type: "pie",
    data: {
      labels: Object.keys(porCategoria),
      datasets: [
        {
          data: Object.values(porCategoria),
          backgroundColor: [
            "#f94144", "#f3722c", "#f8961e", "#f9844a", "#43aa8b",
            "#577590", "#90be6d", "#277da1", "#ffb703", "#fb8500"
          ]
        }
      ]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: "right" } }
    }
  });
}
