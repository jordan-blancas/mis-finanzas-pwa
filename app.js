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
  "Interbank - Tarjeta de crédito VISA",
  "Banco de la Nación - Cuenta de ahorro",
  "Tarjeta OH",
  "AMEX Gold"
];

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
let chartBarras, chartTorta;
let indiceEdicion = -1;

// Navegación
const navigationStack = [];

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
    "popup-editar-movimiento"
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
    document.querySelectorAll(".subvista").forEach(s => s.classList.remove("activa"));
    const subvista = document.getElementById("subvista-" + id);
    if (!subvista) {
      console.error(`Subvista subvista-${id} no encontrada`);
      return;
    }
    subvista.classList.add("activa");

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
      const respuestaIA = document.getElementById("respuesta-ia");
      if (respuestaIA) {
        respuestaIA.textContent = ""; // Deja el área vacía
      }
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
  movimientos.forEach(m => {
    const monto = m.moneda === "USD" ? m.monto * 3.8 : m.monto;
    if (m.tipo === "ingreso") ingresos += monto;
    if (m.tipo === "egreso") egresos += monto;
  });
  return { ingresos, egresos, saldo: ingresos - egresos };
}

function renderResumenPeriodo(totales) {
  const colorSaldo = totales.saldo >= 0 ? "#0a9396" : "crimson";
  const iconSaldo = totales.saldo >= 0 ? "🟢" : "🔴";
  document.getElementById("resumen-periodo").innerHTML = `
    <div class="cards-resumen">
      <div class="card-stat" style="border-top:3px solid #0a9396">
        <div class="card-stat-label">Ingresos</div>
        <div class="card-stat-monto" style="color:#0a9396">S/ ${totales.ingresos.toFixed(2)}</div>
      </div>
      <div class="card-stat" style="border-top:3px solid crimson">
        <div class="card-stat-label">Egresos</div>
        <div class="card-stat-monto" style="color:crimson">S/ ${totales.egresos.toFixed(2)}</div>
      </div>
      <div class="card-stat" style="border-top:3px solid ${colorSaldo}">
        <div class="card-stat-label">Saldo ${iconSaldo}</div>
        <div class="card-stat-monto" style="color:${colorSaldo}">S/ ${totales.saldo.toFixed(2)}</div>
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

function cargarHistorial() {
  const periodo = document.getElementById("filtro-periodo").value;
  const tipoFiltro = document.getElementById("filtro-tipo").value;
  const fechaBase = document.getElementById("filtro-fecha-base").value;
  const todosMovimientos = JSON.parse(localStorage.getItem("movimientos") || "[]");

  const filtrados = filtrarMovsPeriodo(todosMovimientos, periodo, fechaBase, tipoFiltro);
  renderResumenPeriodo(calcularTotales(filtrados));

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

  const ul = document.getElementById("lista-historial");
  ul.innerHTML = "";
  if (filtrados.length === 0) {
    ul.innerHTML = "<li>Sin movimientos en ese período.</li>";
    return;
  }

  filtrados.sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).forEach(mov => {
    const li = document.createElement("li");
    li.className = "mov-card";

    const cuentaStr = mov.tipo === "intercambio"
      ? `${mov.origen} ➝ ${mov.destino}`
      : (mov.origen || mov.destino || "");

    const signo = mov.tipo === "ingreso" ? "+" : mov.tipo === "egreso" ? "-" : "";

    const info = document.createElement("div");
    info.className = "mov-info";
    info.innerHTML = `
      <div class="mov-tipo-cat">${mov.tipo.toUpperCase()} · ${mov.categoria}</div>
      <div class="mov-sub">${mov.fecha.slice(0, 10)} · ${cuentaStr}</div>
      ${mov.detalle ? `<div class="mov-detalle">📝 ${mov.detalle}</div>` : ""}
    `;

    const editBtn = document.createElement("span");
    editBtn.className = "mov-edit";
    editBtn.textContent = "✏️";
    editBtn.onclick = () => abrirPopupEditar(mov);

    const monto = document.createElement("div");
    monto.className = `mov-monto mov-${mov.tipo}`;
    monto.textContent = `${signo}${mov.moneda} ${mov.monto.toFixed(2)}`;

    li.appendChild(info);
    li.appendChild(monto);
    li.appendChild(editBtn);
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

    cuentas.forEach(nombre => {
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
        <td style="min-width: 180px">${nombre}</td>
        <td style="min-width: 100px; color: ${color}; font-weight: bold">S/ ${saldo.toFixed(2)}</td>
        <td style="min-width: 150px">${comTxt}</td>
        <td style="display: flex; gap: 0.5em; align-items: center">
          <button title="Editar comisión" onclick="abrirPopupComision('${nombre}')">🧾</button>
          <button title="Eliminar cuenta" onclick="eliminarCuenta('${nombre}')">🗑️</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

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
  const respuestaIA = document.getElementById("respuesta-ia");
  if (!respuestaIA) {
    console.error("Elemento respuesta-ia no encontrado");
    return;
  }

  respuestaIA.textContent = "Analizando, por favor espera...";

  const datos = JSON.parse(localStorage.getItem("movimientos") || "[]");
  const prompt = `Soy tu asistente financiero. Aquí tienes tus movimientos: ${JSON.stringify(datos, null, 2)} Analiza tus finanzas. ¿En qué podrías ahorrar más? ¿Qué gastos se repiten? ¿Tienes ingresos suficientes? ¿Qué podrías mejorar o eliminar para invertir más?`;

  try {
    const res = await fetch("/api/openai", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ prompt })
    });

    if (!res.ok) {
      throw new Error(`Error en la API: ${res.status} - ${res.statusText}`);
    }
    const json = await res.json();
    respuestaIA.textContent = json.respuesta || "No se pudo procesar la respuesta.";
  } catch (error) {
    console.error("Error en analizarConIA:", error);
    respuestaIA.textContent = `Error al analizar: ${error.message}. Si estás en local, despliega a Vercel.`;
  }
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
    const ingresos = movimientos.filter(m => m.tipo === "ingreso");
    const egresos = movimientos.filter(m => m.tipo === "egreso");

    console.log("Movimientos:", movimientos);
    console.log("Ingresos:", ingresos);
    console.log("Egresos:", egresos);

    const canvasBarras = document.getElementById("grafico-barras");
    const canvasTorta = document.getElementById("grafico-torta");
    if (!canvasBarras || !canvasTorta) {
      console.error("Lienzos de gráficos no encontrados en el DOM");
      return;
    }

    const resumenMensual = new Map();
    movimientos.forEach(m => {
      if (m.tipo === "intercambio") return;
      const mes = m.fecha?.slice(0, 7);
      if (!mes) {
        console.warn("Movimiento sin fecha válida:", m);
        return;
      }
      if (!resumenMensual.has(mes)) resumenMensual.set(mes, { ingreso: 0, egreso: 0 });
      const monto = m.moneda === "USD" ? m.monto * 3.8 : m.monto;
      if (m.tipo === "ingreso") resumenMensual.get(mes).ingreso += monto;
      if (m.tipo === "egreso") resumenMensual.get(mes).egreso += monto;
    });

    const labels = Array.from(resumenMensual.keys()).sort();
    const ingresosData = labels.map(m => resumenMensual.get(m).ingreso || 0);
    const egresosData = labels.map(m => resumenMensual.get(m).egreso || 0);

    console.log("Resumen mensual:", Object.fromEntries(resumenMensual));
    console.log("Labels:", labels);
    console.log("Ingresos data:", ingresosData);
    console.log("Egresos data:", egresosData);

    if (chartBarras) chartBarras.destroy();
    chartBarras = new Chart(canvasBarras, {
      type: "bar",
      data: {
        labels: labels.length ? labels : ["Sin datos"],
        datasets: [
          {
            label: "Ingresos",
            data: labels.length ? ingresosData : [0],
            backgroundColor: "green"
          },
          {
            label: "Egresos",
            data: labels.length ? egresosData : [0],
            backgroundColor: "crimson"
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: "bottom" },
          title: {
            display: !labels.length,
            text: "No hay movimientos registrados"
          }
        },
        scales: {
          y: { beginAtZero: true, title: { display: true, text: "Monto (S/)" } },
          x: { title: { display: true, text: "Mes" } }
        }
      }
    });

    const porCategoria = new Map();
    egresos.forEach(m => {
      const monto = m.moneda === "USD" ? m.monto * 3.8 : m.monto;
      porCategoria.set(m.categoria, (porCategoria.get(m.categoria) || 0) + monto);
    });

    console.log("Por categoría:", Object.fromEntries(porCategoria));

    if (chartTorta) chartTorta.destroy();
    chartTorta = new Chart(canvasTorta, {
      type: "pie",
      data: {
        labels: porCategoria.size ? Array.from(porCategoria.keys()) : ["Sin datos"],
        datasets: [
          {
            data: porCategoria.size ? Array.from(porCategoria.values()) : [1],
            backgroundColor: porCategoria.size
              ? [
                  "#f94144", "#f3722c", "#f8961e", "#f9844a", "#43aa8b",
                  "#577590", "#90be6d", "#277da1", "#ffb703", "#fb8500"
                ]
              : ["#cccccc"]
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: "right" },
          title: {
            display: !porCategoria.size,
            text: "No hay egresos registrados"
          }
        }
      }
    });
  } catch (error) {
    console.error("Error al renderizar gráficos:", error);
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

    cargarHistorial();
    renderResumenCuentas();
    renderizarGraficos();
  } catch (error) {
    console.error("Error al inicializar la aplicación:", error);
  }
}
init();