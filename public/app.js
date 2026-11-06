// =====================================================================
//  FRONTEND — consume la API del backend con fetch()
//  Cada acción del CRUD llama a una ruta:
//    Crear      → POST   /api/...
//    Leer       → GET    /api/...
//    Actualizar → PUT    /api/.../:id
//    Eliminar   → DELETE /api/.../:id
// =====================================================================
const API = '/api';

// Datos en memoria (se recargan desde la BD después de cada cambio)
let productos = [];
let categorias = [];

// ---------- Utilidades ----------
const $ = (selector) => document.querySelector(selector);
const moneda = new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' });

// Llama a la API y devuelve el JSON. Si hay error, lanza el mensaje del backend.
async function api(ruta, opciones = {}) {
  const respuesta = await fetch(API + ruta, {
    headers: { 'Content-Type': 'application/json' },
    ...opciones,
  });
  const datos = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) throw new Error(datos.error || `Error ${respuesta.status}`);
  return datos;
}

// Evita que texto escrito por el usuario se interprete como HTML
function esc(texto) {
  return String(texto ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}

// Normaliza texto para buscar sin importar mayúsculas ni tildes
function normalizar(texto) {
  return String(texto ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

let temporizadorToast;
function avisar(mensaje, tipo = 'ok') {
  const toast = $('#toast');
  toast.textContent = mensaje;
  toast.className = `toast visible ${tipo === 'error' ? 'error' : ''}`;
  clearTimeout(temporizadorToast);
  temporizadorToast = setTimeout(() => toast.classList.remove('visible'), 3500);
}

// ---------- Pestañas ----------
document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('activa'));
    document.querySelectorAll('.panel').forEach((p) => p.classList.remove('activo'));
    tab.classList.add('activa');
    $(`#panel-${tab.dataset.tab}`).classList.add('activo');
    if (tab.dataset.tab === 'facturas') cargarFacturas();
  });
});

// ---------- Estado de la conexión a la BD ----------
async function verificarConexion() {
  const estado = $('#estado-bd');
  try {
    const info = await api('/health');
    estado.textContent = `Conectado a la BD: ${info.base_de_datos}`;
    estado.className = 'estado ok';
  } catch (err) {
    estado.textContent = 'Sin conexión a la BD';
    estado.className = 'estado error';
  }
}

// =====================================================================
//  CATEGORÍAS
// =====================================================================
async function cargarCategorias() {
  try {
    categorias = await api('/categorias'); // READ
  } catch (err) {
    categorias = [];
    avisar(`No se pudieron cargar las categorías: ${err.message}`, 'error');
  }
  pintarCategorias();
  llenarSelectCategorias();
}

function pintarCategorias() {
  const filtro = normalizar($('#buscar-categoria').value);
  const idEditando = $('#categoria-id').value;
  const lista = categorias.filter((c) =>
    normalizar(`${c.nombre} ${c.descripcion ?? ''}`).includes(filtro)
  );

  $('#badge-categorias').textContent = categorias.length;
  const tbody = $('#tbody-categorias');

  if (lista.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="vacio">${
      categorias.length ? 'Ninguna categoría coincide con la búsqueda.' : 'Todavía no hay categorías.'
    }</td></tr>`;
    return;
  }

  tbody.innerHTML = lista.map((c) => `
    <tr class="${String(c.id_categoria) === idEditando ? 'seleccionada' : ''}">
      <td class="id">${c.id_categoria}</td>
      <td><strong>${esc(c.nombre)}</strong></td>
      <td class="desc">${esc(c.descripcion) || '—'}</td>
      <td class="num">${c.total_productos}</td>
      <td class="col-acciones">
        <button class="btn-mini" data-accion="editar" data-id="${c.id_categoria}">Editar</button>
        <button class="btn-mini peligro" data-accion="eliminar" data-id="${c.id_categoria}">Eliminar</button>
      </td>
    </tr>`).join('');
}

function llenarSelectCategorias() {
  const select = $('#producto-categoria');
  const seleccionada = select.value;
  select.innerHTML =
    '<option value="" disabled selected>Selecciona una categoría…</option>' +
    categorias.map((c) => `<option value="${c.id_categoria}">${esc(c.nombre)}</option>`).join('');
  if (categorias.some((c) => String(c.id_categoria) === seleccionada)) select.value = seleccionada;
}

function limpiarFormCategoria() {
  $('#form-categoria').reset();
  $('#categoria-id').value = '';
  $('#titulo-form-categoria').textContent = 'Nueva categoría';
  $('#btn-guardar-categoria').textContent = 'Guardar categoría';
  $('#btn-cancelar-categoria').hidden = true;
  $('#form-categoria').classList.remove('editando');
  pintarCategorias();
}

// CREATE / UPDATE
$('#form-categoria').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = $('#categoria-id').value;
  const datos = {
    nombre: $('#categoria-nombre').value,
    descripcion: $('#categoria-descripcion').value,
  };
  const boton = $('#btn-guardar-categoria');
  boton.disabled = true;
  try {
    if (id) {
      await api(`/categorias/${id}`, { method: 'PUT', body: JSON.stringify(datos) });
      avisar('Categoría actualizada.');
    } else {
      await api('/categorias', { method: 'POST', body: JSON.stringify(datos) });
      avisar('Categoría creada.');
    }
    limpiarFormCategoria();
    await cargarCategorias();
    await cargarProductos(); // por si cambió el nombre de una categoría
  } catch (err) {
    avisar(err.message, 'error');
  } finally {
    boton.disabled = false;
  }
});

$('#btn-cancelar-categoria').addEventListener('click', limpiarFormCategoria);
$('#buscar-categoria').addEventListener('input', pintarCategorias);

// Botones Editar / Eliminar de la tabla
$('#tbody-categorias').addEventListener('click', async (e) => {
  const boton = e.target.closest('button[data-accion]');
  if (!boton) return;
  const id = boton.dataset.id;
  const categoria = categorias.find((c) => String(c.id_categoria) === id);
  if (!categoria) return;

  if (boton.dataset.accion === 'editar') {
    $('#categoria-id').value = categoria.id_categoria;
    $('#categoria-nombre').value = categoria.nombre;
    $('#categoria-descripcion').value = categoria.descripcion || '';
    $('#titulo-form-categoria').textContent = `Editando categoría #${categoria.id_categoria}`;
    $('#btn-guardar-categoria').textContent = 'Guardar cambios';
    $('#btn-cancelar-categoria').hidden = false;
    $('#form-categoria').classList.add('editando');
    $('#categoria-nombre').focus();
    pintarCategorias();
  }

  if (boton.dataset.accion === 'eliminar') {
    if (!confirm(`¿Eliminar la categoría "${categoria.nombre}"?`)) return;
    try {
      await api(`/categorias/${id}`, { method: 'DELETE' }); // DELETE
      avisar('Categoría eliminada.');
      if ($('#categoria-id').value === id) limpiarFormCategoria();
      await cargarCategorias();
    } catch (err) {
      avisar(err.message, 'error');
    }
  }
});

// =====================================================================
//  PRODUCTOS
// =====================================================================
async function cargarProductos() {
  try {
    productos = await api('/productos'); // READ
  } catch (err) {
    productos = [];
    avisar(`No se pudieron cargar los productos: ${err.message}`, 'error');
  }
  pintarProductos();
  refrescarProductosEnFactura();
}

function pintarProductos() {
  const filtro = normalizar($('#buscar-producto').value);
  const idEditando = $('#producto-id').value;
  const lista = productos.filter((p) =>
    normalizar(`${p.nombre} ${p.categoria}`).includes(filtro)
  );

  $('#badge-productos').textContent = productos.length;
  const tbody = $('#tbody-productos');

  if (lista.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="vacio">${
      productos.length ? 'Ningún producto coincide con la búsqueda.' : 'Todavía no hay productos.'
    }</td></tr>`;
    return;
  }

  tbody.innerHTML = lista.map((p) => `
    <tr class="${String(p.id_producto) === idEditando ? 'seleccionada' : ''}">
      <td class="id">${p.id_producto}</td>
      <td><strong>${esc(p.nombre)}</strong></td>
      <td><span class="chip">${esc(p.categoria)}</span></td>
      <td class="num">${moneda.format(Number(p.precio))}</td>
      <td class="num">${p.stock}${p.stock <= 5 ? '<span class="stock-bajo">bajo</span>' : ''}</td>
      <td class="col-acciones">
        <button class="btn-mini" data-accion="editar" data-id="${p.id_producto}">Editar</button>
        <button class="btn-mini peligro" data-accion="eliminar" data-id="${p.id_producto}">Eliminar</button>
      </td>
    </tr>`).join('');
}

function limpiarFormProducto() {
  $('#form-producto').reset();
  $('#producto-id').value = '';
  $('#titulo-form-producto').textContent = 'Nuevo producto';
  $('#btn-guardar-producto').textContent = 'Guardar producto';
  $('#btn-cancelar-producto').hidden = true;
  $('#form-producto').classList.remove('editando');
  pintarProductos();
}

// CREATE / UPDATE
$('#form-producto').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = $('#producto-id').value;
  const datos = {
    nombre: $('#producto-nombre').value,
    precio: $('#producto-precio').value,
    stock: $('#producto-stock').value,
    id_categoria: $('#producto-categoria').value,
  };
  const boton = $('#btn-guardar-producto');
  boton.disabled = true;
  try {
    if (id) {
      await api(`/productos/${id}`, { method: 'PUT', body: JSON.stringify(datos) });
      avisar('Producto actualizado.');
    } else {
      await api('/productos', { method: 'POST', body: JSON.stringify(datos) });
      avisar('Producto creado.');
    }
    limpiarFormProducto();
    await cargarProductos();
    await cargarCategorias(); // actualiza el conteo de productos por categoría
  } catch (err) {
    avisar(err.message, 'error');
  } finally {
    boton.disabled = false;
  }
});

$('#btn-cancelar-producto').addEventListener('click', limpiarFormProducto);
$('#buscar-producto').addEventListener('input', pintarProductos);

// Botones Editar / Eliminar de la tabla
$('#tbody-productos').addEventListener('click', async (e) => {
  const boton = e.target.closest('button[data-accion]');
  if (!boton) return;
  const id = boton.dataset.id;
  const producto = productos.find((p) => String(p.id_producto) === id);
  if (!producto) return;

  if (boton.dataset.accion === 'editar') {
    $('#producto-id').value = producto.id_producto;
    $('#producto-nombre').value = producto.nombre;
    $('#producto-precio').value = Number(producto.precio).toFixed(2);
    $('#producto-stock').value = producto.stock;
    $('#producto-categoria').value = producto.id_categoria;
    $('#titulo-form-producto').textContent = `Editando producto #${producto.id_producto}`;
    $('#btn-guardar-producto').textContent = 'Guardar cambios';
    $('#btn-cancelar-producto').hidden = false;
    $('#form-producto').classList.add('editando');
    $('#producto-nombre').focus();
    pintarProductos();
  }

  if (boton.dataset.accion === 'eliminar') {
    if (!confirm(`¿Eliminar el producto "${producto.nombre}"?`)) return;
    try {
      await api(`/productos/${id}`, { method: 'DELETE' }); // DELETE
      avisar('Producto eliminado.');
      if ($('#producto-id').value === id) limpiarFormProducto();
      await cargarProductos();
      await cargarCategorias();
    } catch (err) {
      avisar(err.message, 'error');
    }
  }
});

// =====================================================================
//  CLIENTES
// =====================================================================
let clientes = [];

async function cargarClientes() {
  try {
    clientes = await api('/clientes'); // READ
  } catch (err) {
    clientes = [];
    avisar(`No se pudieron cargar los clientes: ${err.message}`, 'error');
  }
  pintarClientes();
  llenarSelectClientesFactura();
}

function pintarClientes() {
  const filtro = normalizar($('#buscar-cliente').value);
  const idEditando = $('#cliente-id').value;
  const lista = clientes.filter((c) =>
    normalizar(`${c.nit} ${c.nombre} ${c.correo ?? ''}`).includes(filtro)
  );

  $('#badge-clientes').textContent = clientes.length;
  const tbody = $('#tbody-clientes');

  if (lista.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="vacio">${
      clientes.length ? 'Ningún cliente coincide con la búsqueda.' : 'Todavía no hay clientes.'
    }</td></tr>`;
    return;
  }

  tbody.innerHTML = lista.map((c) => `
    <tr class="${String(c.id_cliente) === idEditando ? 'seleccionada' : ''}">
      <td class="id">${c.id_cliente}</td>
      <td><span class="chip">${esc(c.nit)}</span></td>
      <td>
        <strong>${esc(c.nombre)}</strong>
        ${c.correo ? `<div class="sub">${esc(c.correo)}</div>` : ''}
      </td>
      <td class="nowrap">${esc(c.telefono) || '—'}</td>
      <td class="num">${c.total_facturas}</td>
      <td class="col-acciones">
        <button class="btn-mini" data-accion="editar" data-id="${c.id_cliente}">Editar</button>
        <button class="btn-mini peligro" data-accion="eliminar" data-id="${c.id_cliente}">Eliminar</button>
      </td>
    </tr>`).join('');
}

function limpiarFormCliente() {
  $('#form-cliente').reset();
  $('#cliente-id').value = '';
  $('#titulo-form-cliente').textContent = 'Nuevo cliente';
  $('#btn-guardar-cliente').textContent = 'Guardar cliente';
  $('#btn-cancelar-cliente').hidden = true;
  $('#form-cliente').classList.remove('editando');
  pintarClientes();
}

// CREATE / UPDATE
$('#form-cliente').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = $('#cliente-id').value;
  const datos = {
    nit: $('#cliente-nit').value,
    nombre: $('#cliente-nombre').value,
    telefono: $('#cliente-telefono').value,
    correo: $('#cliente-correo').value,
  };
  const boton = $('#btn-guardar-cliente');
  boton.disabled = true;
  try {
    if (id) {
      await api(`/clientes/${id}`, { method: 'PUT', body: JSON.stringify(datos) });
      avisar('Cliente actualizado.');
    } else {
      await api('/clientes', { method: 'POST', body: JSON.stringify(datos) });
      avisar('Cliente creado.');
    }
    limpiarFormCliente();
    await cargarClientes();
  } catch (err) {
    avisar(err.message, 'error');
  } finally {
    boton.disabled = false;
  }
});

$('#btn-cancelar-cliente').addEventListener('click', limpiarFormCliente);
$('#buscar-cliente').addEventListener('input', pintarClientes);

// Botones Editar / Eliminar de la tabla
$('#tbody-clientes').addEventListener('click', async (e) => {
  const boton = e.target.closest('button[data-accion]');
  if (!boton) return;
  const id = boton.dataset.id;
  const cliente = clientes.find((c) => String(c.id_cliente) === id);
  if (!cliente) return;

  if (boton.dataset.accion === 'editar') {
    $('#cliente-id').value = cliente.id_cliente;
    $('#cliente-nit').value = cliente.nit;
    $('#cliente-nombre').value = cliente.nombre;
    $('#cliente-telefono').value = cliente.telefono || '';
    $('#cliente-correo').value = cliente.correo || '';
    $('#titulo-form-cliente').textContent = `Editando cliente #${cliente.id_cliente}`;
    $('#btn-guardar-cliente').textContent = 'Guardar cambios';
    $('#btn-cancelar-cliente').hidden = false;
    $('#form-cliente').classList.add('editando');
    $('#cliente-nombre').focus();
    pintarClientes();
  }

  if (boton.dataset.accion === 'eliminar') {
    if (!confirm(`¿Eliminar al cliente "${cliente.nombre}"?`)) return;
    try {
      await api(`/clientes/${id}`, { method: 'DELETE' }); // DELETE
      avisar('Cliente eliminado.');
      if ($('#cliente-id').value === id) limpiarFormCliente();
      await cargarClientes();
    } catch (err) {
      avisar(err.message, 'error');
    }
  }
});

// =====================================================================
//  FACTURAS  (encabezado en "factura" + líneas en "detalle_factura")
// =====================================================================
let facturas = [];

// Fecha de hoy en formato AAAA-MM-DD (hora local)
function hoy() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

// '2026-10-01' → '01/10/2026'
function formatearFecha(iso) {
  const [a, m, d] = String(iso).split('-');
  return `${d}/${m}/${a}`;
}

async function cargarFacturas() {
  try {
    facturas = await api('/facturas'); // READ
  } catch (err) {
    facturas = [];
    avisar(`No se pudieron cargar las facturas: ${err.message}`, 'error');
  }
  pintarFacturas();
}

function pintarFacturas() {
  const filtro = normalizar($('#buscar-factura').value);
  const idEditando = $('#factura-id').value;
  const lista = facturas.filter((f) =>
    normalizar(`${f.id_factura} ${f.cliente} ${f.nit} ${f.resumen}`).includes(filtro)
  );

  $('#badge-facturas').textContent = facturas.length;
  const tbody = $('#tbody-facturas');

  if (lista.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="vacio">${
      facturas.length ? 'Ninguna factura coincide con la búsqueda.' : 'Todavía no hay facturas.'
    }</td></tr>`;
    return;
  }

  tbody.innerHTML = lista.map((f) => `
    <tr class="${String(f.id_factura) === idEditando ? 'seleccionada' : ''}">
      <td class="id">#${f.id_factura}</td>
      <td class="nowrap">${formatearFecha(f.fecha)}</td>
      <td>
        <strong>${esc(f.cliente)}</strong>
        <div class="sub nowrap">NIT ${esc(f.nit)}</div>
      </td>
      <td class="resumen">${esc(f.resumen) || '—'}</td>
      <td class="num"><strong>${moneda.format(Number(f.total))}</strong></td>
      <td class="col-acciones">
        <button class="btn-mini" data-accion="editar" data-id="${f.id_factura}">Editar</button>
        <button class="btn-mini peligro" data-accion="eliminar" data-id="${f.id_factura}">Eliminar</button>
      </td>
    </tr>`).join('');
}

function llenarSelectClientesFactura() {
  const select = $('#factura-cliente');
  const seleccionado = select.value;
  select.innerHTML =
    '<option value="" disabled selected>Selecciona un cliente…</option>' +
    clientes.map((c) => `<option value="${c.id_cliente}">${esc(c.nombre)} (${esc(c.nit)})</option>`).join('');
  if (clientes.some((c) => String(c.id_cliente) === seleccionado)) select.value = seleccionado;
}

function opcionesProductos(seleccionado) {
  return (
    `<option value="" disabled ${seleccionado ? '' : 'selected'}>Producto…</option>` +
    productos.map((p) => `
      <option value="${p.id_producto}" ${String(p.id_producto) === String(seleccionado) ? 'selected' : ''}>
        ${esc(p.nombre)}
      </option>`).join('')
  );
}

// Si cambia la lista de productos, actualiza los <select> de las líneas
function refrescarProductosEnFactura() {
  document.querySelectorAll('#factura-lineas .linea-producto').forEach((select) => {
    const actual = select.value;
    select.innerHTML = opcionesProductos(actual);
    if (productos.some((p) => String(p.id_producto) === actual)) select.value = actual;
  });
}

// Agrega una línea de producto al formulario
function agregarLinea(linea = {}) {
  const div = document.createElement('div');
  div.className = 'linea';
  const precio = linea.precio_unitario != null ? Number(linea.precio_unitario).toFixed(2) : '';
  div.innerHTML = `
    <select class="linea-producto" required aria-label="Producto">${opcionesProductos(linea.id_producto)}</select>
    <input class="linea-cantidad" type="number" min="1" step="1" required value="${linea.cantidad ?? 1}" aria-label="Cantidad" />
    <input class="linea-precio" type="number" min="0" step="0.01" required value="${precio}" placeholder="0.00" aria-label="Precio unitario" />
    <button type="button" class="btn-quitar" title="Quitar producto" aria-label="Quitar producto">×</button>`;
  $('#factura-lineas').appendChild(div);
  calcularTotal();
}

function leerLineas() {
  return [...document.querySelectorAll('#factura-lineas .linea')].map((div) => ({
    id_producto: div.querySelector('.linea-producto').value,
    cantidad: div.querySelector('.linea-cantidad').value,
    precio_unitario: div.querySelector('.linea-precio').value,
  }));
}

function calcularTotal() {
  const total = leerLineas().reduce(
    (suma, l) => suma + (Number(l.cantidad) || 0) * (Number(l.precio_unitario) || 0), 0
  );
  $('#factura-total').textContent = moneda.format(total);
}

// Al elegir un producto se copia su precio actual (se puede cambiar)
$('#factura-lineas').addEventListener('change', (e) => {
  if (e.target.classList.contains('linea-producto')) {
    const producto = productos.find((p) => String(p.id_producto) === e.target.value);
    const inputPrecio = e.target.closest('.linea').querySelector('.linea-precio');
    if (producto) inputPrecio.value = Number(producto.precio).toFixed(2);
  }
  calcularTotal();
});
$('#factura-lineas').addEventListener('input', calcularTotal);
$('#factura-lineas').addEventListener('click', (e) => {
  if (!e.target.classList.contains('btn-quitar')) return;
  if (document.querySelectorAll('#factura-lineas .linea').length === 1) {
    avisar('La factura debe tener al menos un producto.', 'error');
    return;
  }
  e.target.closest('.linea').remove();
  calcularTotal();
});
$('#btn-agregar-linea').addEventListener('click', () => agregarLinea());

function limpiarFormFactura() {
  $('#form-factura').reset();
  $('#factura-id').value = '';
  $('#factura-fecha').value = hoy();
  $('#factura-lineas').innerHTML = '';
  agregarLinea();
  $('#titulo-form-factura').textContent = 'Nueva factura';
  $('#btn-guardar-factura').textContent = 'Guardar factura';
  $('#btn-cancelar-factura').hidden = true;
  $('#form-factura').classList.remove('editando');
  pintarFacturas();
}

// CREATE / UPDATE
$('#form-factura').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = $('#factura-id').value;
  const datos = {
    id_cliente: $('#factura-cliente').value,
    fecha: $('#factura-fecha').value,
    detalle: leerLineas(),
  };
  const boton = $('#btn-guardar-factura');
  boton.disabled = true;
  try {
    if (id) {
      await api(`/facturas/${id}`, { method: 'PUT', body: JSON.stringify(datos) });
      avisar('Factura actualizada.');
    } else {
      const r = await api('/facturas', { method: 'POST', body: JSON.stringify(datos) });
      avisar(`Factura #${r.id_factura} creada.`);
    }
    limpiarFormFactura();
    await cargarFacturas();
    await cargarClientes(); // actualiza el conteo de facturas por cliente
  } catch (err) {
    avisar(err.message, 'error');
  } finally {
    boton.disabled = false;
  }
});

$('#btn-cancelar-factura').addEventListener('click', limpiarFormFactura);
$('#buscar-factura').addEventListener('input', pintarFacturas);

// Botones Editar / Eliminar de la tabla
$('#tbody-facturas').addEventListener('click', async (e) => {
  const boton = e.target.closest('button[data-accion]');
  if (!boton) return;
  const id = boton.dataset.id;

  if (boton.dataset.accion === 'editar') {
    try {
      const factura = await api(`/facturas/${id}`); // trae encabezado + detalle
      $('#factura-id').value = factura.id_factura;
      $('#factura-cliente').value = factura.id_cliente;
      $('#factura-fecha').value = factura.fecha;
      $('#factura-lineas').innerHTML = '';
      factura.detalle.forEach((linea) => agregarLinea(linea));
      if (factura.detalle.length === 0) agregarLinea();
      $('#titulo-form-factura').textContent = `Editando factura #${factura.id_factura}`;
      $('#btn-guardar-factura').textContent = 'Guardar cambios';
      $('#btn-cancelar-factura').hidden = false;
      $('#form-factura').classList.add('editando');
      pintarFacturas();
    } catch (err) {
      avisar(err.message, 'error');
    }
  }

  if (boton.dataset.accion === 'eliminar') {
    if (!confirm(`¿Eliminar la factura #${id}? También se borrará su detalle.`)) return;
    try {
      await api(`/facturas/${id}`, { method: 'DELETE' }); // DELETE
      avisar('Factura eliminada.');
      if ($('#factura-id').value === id) limpiarFormFactura();
      await cargarFacturas();
      await cargarClientes();
    } catch (err) {
      avisar(err.message, 'error');
    }
  }
});

// =====================================================================
//  INICIO
// =====================================================================
(async function iniciar() {
  verificarConexion();
  await cargarCategorias();
  await cargarProductos();
  await cargarClientes();
  await cargarFacturas();
  limpiarFormFactura(); // deja lista una factura nueva con la fecha de hoy
})();
