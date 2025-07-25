console.log("app.js cargado correctamente");

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
let movimientoTipo = ""; // Nueva variable para el tipo de movimiento
let categoriaActual = "";
let detalleActual = "";
let origen = "";
let destino = "";
let montoTemp = 0;
let monedaTemp = "PEN";
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
  montoTemp = parseFloat(document.getElementById("monto").value);
  monedaTemp = document.getElementById("moneda").value;
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
    fecha: new Date().toISOString()
  };

  console.log("Guardando movimiento:", registro);

  const datos = JSON.parse(localStorage.getItem("movimientos") || "[]");
  datos.push(registro);
  localStorage.setItem("movimientos", JSON.stringify(datos));

  // Limpiar inputs y variables
  document.getElementById("monto").value = "";
  document.getElementById("detalle-egreso").value = "";
  document.getElementById("detalle-ingreso").value = "";
  document.getElementById("nuevo-ingreso").value = "";
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

    const saldos = new Map(cuentas.map(nombre => [nombre, 0]));
    movimientos.forEach(m => {
      let monto = m.moneda === "USD" ? m.monto * 3.8 : m.monto;
      if (m.tipo === "ingreso" && m.destino && saldos.has(m.destino)) {
        saldos.set(m.destino, saldos.get(m.destino) + monto);
        console.log(`Ingreso sumado: ${monto} a ${m.destino} (Categoría: ${m.categoria})`);
      }
      if (m.tipo === "egreso" && m.origen && saldos.has(m.origen)) {
        saldos.set(m.origen, saldos.get(m.origen) - monto);
        console.log(`Egreso restado: ${monto} de ${m.origen} (Categoría: ${m.categoria})`);
      }
      if (m.tipo === "intercambio") {
        if (m.origen && saldos.has(m.origen)) {
          saldos.set(m.origen, saldos.get(m.origen) - monto);
          console.log(`Intercambio restado: ${monto} de ${m.origen}`);
        }
        if (m.destino && saldos.has(m.destino)) {
          saldos.set(m.destino, saldos.get(m.destino) + monto);
          console.log(`Intercambio sumado: ${monto} a ${m.destino}`);
        }
      }
    });

    tbody.innerHTML = "";
    let total = 0;
    const saldosArray = [];

    cuentas.forEach(nombre => {
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
    fecha: new Date(fecha).toISOString()
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