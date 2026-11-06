// =====================================================================
//  CRUD DE FACTURAS   →   /api/facturas
//
//  GET    /api/facturas       → listar todas (cliente, total y resumen)
//  GET    /api/facturas/:id   → obtener una con su detalle (productos)
//  POST   /api/facturas       → crear factura + detalle   (TRANSACCIÓN)
//  PUT    /api/facturas/:id   → actualizar factura + detalle (TRANSACCIÓN)
//  DELETE /api/facturas/:id   → eliminar (el detalle se borra en cascada)
//
//  Una factura se guarda en DOS tablas: factura (encabezado) y
//  detalle_factura (una fila por producto). Por eso se usa una TRANSACCIÓN:
//  BEGIN → varios INSERT → COMMIT. Si algo falla, ROLLBACK deshace todo
//  y no quedan facturas a medias.
//
//  Body esperado (POST / PUT):
//  {
//    "id_cliente": 1,
//    "fecha": "2026-11-05",
//    "detalle": [
//      { "id_producto": 3, "cantidad": 2, "precio_unitario": 95.00 },
//      { "id_producto": 7, "cantidad": 1, "precio_unitario": 650.00 }
//    ]
//  }
// =====================================================================
const express = require('express');
const pool = require('../db');

const router = express.Router();

function leerId(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'El id debe ser un número entero positivo.' });
    return null;
  }
  return id;
}

function vacio(valor) {
  return valor === undefined || valor === null || valor === '';
}

function validarFactura(body = {}) {
  const idCliente = Number(body.id_cliente);
  const fecha = typeof body.fecha === 'string' ? body.fecha.trim() : '';
  const lineas = Array.isArray(body.detalle) ? body.detalle : [];

  if (!Number.isInteger(idCliente) || idCliente <= 0) return { error: 'Selecciona un cliente.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return { error: 'La fecha no es válida.' };
  if (lineas.length === 0) return { error: 'Agrega al menos un producto a la factura.' };

  const detalle = [];
  const usados = new Set();
  for (const [i, linea] of lineas.entries()) {
    const n = i + 1;
    const idProducto = Number(linea.id_producto);
    const cantidad = Number(linea.cantidad);
    const precio = Number(linea.precio_unitario);

    if (!Number.isInteger(idProducto) || idProducto <= 0)
      return { error: `Línea ${n}: selecciona un producto.` };
    if (!Number.isInteger(cantidad) || cantidad <= 0)
      return { error: `Línea ${n}: la cantidad debe ser un número entero mayor que 0.` };
    if (vacio(linea.precio_unitario) || !Number.isFinite(precio) || precio < 0)
      return { error: `Línea ${n}: el precio debe ser un número mayor o igual a 0.` };
    if (usados.has(idProducto))
      return { error: `Línea ${n}: ese producto ya está en la factura. Suma la cantidad en una sola línea.` };

    usados.add(idProducto);
    detalle.push({ idProducto, cantidad, precio });
  }

  return { datos: { idCliente, fecha, detalle } };
}

// Inserta las líneas del detalle usando la MISMA conexión de la transacción
async function insertarDetalle(conexion, idFactura, detalle) {
  for (const linea of detalle) {
    await conexion.query(
      `INSERT INTO detalle_factura (id_factura, id_producto, cantidad, precio_unitario)
       VALUES ($1, $2, $3, $4)`,
      [idFactura, linea.idProducto, linea.cantidad, linea.precio]
    );
  }
}

// ---------- READ: listar todas ----------
// to_char() devuelve la fecha como texto 'AAAA-MM-DD' para evitar
// problemas de zona horaria al convertirla a JSON.
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT f.id_factura,
             to_char(f.fecha, 'YYYY-MM-DD') AS fecha,
             f.id_cliente, cl.nombre AS cliente, cl.nit,
             COUNT(d.id_producto)::int AS total_lineas,
             COALESCE(SUM(d.cantidad * d.precio_unitario), 0) AS total,
             COALESCE(string_agg(p.nombre || ' ×' || d.cantidad, ', ' ORDER BY p.nombre), '') AS resumen
      FROM factura f
      JOIN cliente cl             ON cl.id_cliente = f.id_cliente
      LEFT JOIN detalle_factura d ON d.id_factura  = f.id_factura
      LEFT JOIN producto p        ON p.id_producto = d.id_producto
      GROUP BY f.id_factura, f.fecha, f.id_cliente, cl.nombre, cl.nit
      ORDER BY f.id_factura
    `);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// ---------- READ: obtener una con su detalle ----------
router.get('/:id', async (req, res, next) => {
  const id = leerId(req, res);
  if (id === null) return;
  try {
    const encabezado = await pool.query(
      `SELECT f.id_factura, to_char(f.fecha, 'YYYY-MM-DD') AS fecha,
              f.id_cliente, cl.nombre AS cliente, cl.nit
       FROM factura f
       JOIN cliente cl ON cl.id_cliente = f.id_cliente
       WHERE f.id_factura = $1`,
      [id]
    );
    if (encabezado.rows.length === 0) return res.status(404).json({ error: 'Factura no encontrada.' });

    const detalle = await pool.query(
      `SELECT d.id_producto, p.nombre AS producto, d.cantidad, d.precio_unitario,
              d.cantidad * d.precio_unitario AS subtotal
       FROM detalle_factura d
       JOIN producto p ON p.id_producto = d.id_producto
       WHERE d.id_factura = $1
       ORDER BY p.nombre`,
      [id]
    );

    res.json({ ...encabezado.rows[0], detalle: detalle.rows });
  } catch (err) {
    next(err);
  }
});

// ---------- CREATE (transacción) ----------
router.post('/', async (req, res, next) => {
  const { error, datos } = validarFactura(req.body);
  if (error) return res.status(400).json({ error });

  const conexion = await pool.connect(); // una sola conexión para toda la transacción
  try {
    await conexion.query('BEGIN');
    const { rows } = await conexion.query(
      'INSERT INTO factura (fecha, id_cliente) VALUES ($1, $2) RETURNING id_factura',
      [datos.fecha, datos.idCliente]
    );
    const idFactura = rows[0].id_factura;
    await insertarDetalle(conexion, idFactura, datos.detalle);
    await conexion.query('COMMIT');
    res.status(201).json({ mensaje: 'Factura creada.', id_factura: idFactura });
  } catch (err) {
    await conexion.query('ROLLBACK').catch(() => {}); // deshace todo
    next(err);
  } finally {
    conexion.release(); // devuelve la conexión al pool
  }
});

// ---------- UPDATE (transacción) ----------
// Se actualiza el encabezado y se reemplaza el detalle completo.
router.put('/:id', async (req, res, next) => {
  const id = leerId(req, res);
  if (id === null) return;
  const { error, datos } = validarFactura(req.body);
  if (error) return res.status(400).json({ error });

  const conexion = await pool.connect();
  try {
    await conexion.query('BEGIN');
    const { rows } = await conexion.query(
      'UPDATE factura SET fecha = $1, id_cliente = $2 WHERE id_factura = $3 RETURNING id_factura',
      [datos.fecha, datos.idCliente, id]
    );
    if (rows.length === 0) {
      await conexion.query('ROLLBACK');
      return res.status(404).json({ error: 'Factura no encontrada.' });
    }
    await conexion.query('DELETE FROM detalle_factura WHERE id_factura = $1', [id]);
    await insertarDetalle(conexion, id, datos.detalle);
    await conexion.query('COMMIT');
    res.json({ mensaje: 'Factura actualizada.', id_factura: id });
  } catch (err) {
    await conexion.query('ROLLBACK').catch(() => {});
    next(err);
  } finally {
    conexion.release();
  }
});

// ---------- DELETE ----------
// detalle_factura tiene ON DELETE CASCADE: al borrar la factura
// PostgreSQL borra sus líneas automáticamente.
router.delete('/:id', async (req, res, next) => {
  const id = leerId(req, res);
  if (id === null) return;
  try {
    const { rows } = await pool.query(
      'DELETE FROM factura WHERE id_factura = $1 RETURNING id_factura',
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Factura no encontrada.' });
    res.json({ mensaje: 'Factura eliminada.', eliminado: rows[0] });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
