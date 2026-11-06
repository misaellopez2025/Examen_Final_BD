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
//  INICIO
// =====================================================================
(async function iniciar() {
  verificarConexion();
  await cargarCategorias();
  await cargarProductos();
})();
