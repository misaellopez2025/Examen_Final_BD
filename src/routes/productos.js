// =====================================================================
//  CRUD DE PRODUCTOS   →   /api/productos
//
//  GET    /api/productos       → listar todos (con JOIN a categoría)
//  GET    /api/productos/:id   → obtener uno
//  POST   /api/productos       → crear
//  PUT    /api/productos/:id   → actualizar
//  DELETE /api/productos/:id   → eliminar
//
//  Nota: PostgreSQL devuelve NUMERIC (precio) como texto, ej. "4999.00",
//  para no perder decimales. En el frontend se convierte con Number().
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

function validarProducto(body = {}) {
  const nombre = typeof body.nombre === 'string' ? body.nombre.trim() : '';
  const precio = Number(body.precio);
  const stock = vacio(body.stock) ? 0 : Number(body.stock);
  const idCategoria = Number(body.id_categoria);

  if (!nombre) return { error: 'El nombre es obligatorio.' };
  if (nombre.length > 100) return { error: 'El nombre no puede pasar de 100 caracteres.' };
  if (vacio(body.precio) || !Number.isFinite(precio) || precio < 0)
    return { error: 'El precio debe ser un número mayor o igual a 0.' };
  if (!Number.isInteger(stock) || stock < 0)
    return { error: 'El stock debe ser un número entero mayor o igual a 0.' };
  if (!Number.isInteger(idCategoria) || idCategoria <= 0)
    return { error: 'Selecciona una categoría válida.' };

  return { datos: { nombre, precio, stock, idCategoria } };
}

// ---------- READ: listar todos (JOIN para mostrar el nombre de la categoría) ----------
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT p.id_producto, p.nombre, p.precio, p.stock,
             p.id_categoria, c.nombre AS categoria
      FROM producto p
      JOIN categoria c ON c.id_categoria = p.id_categoria
      ORDER BY p.id_producto
    `);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// ---------- READ: obtener uno ----------
router.get('/:id', async (req, res, next) => {
  const id = leerId(req, res);
  if (id === null) return;
  try {
    const { rows } = await pool.query(
      `SELECT p.id_producto, p.nombre, p.precio, p.stock,
              p.id_categoria, c.nombre AS categoria
       FROM producto p
       JOIN categoria c ON c.id_categoria = p.id_categoria
       WHERE p.id_producto = $1`,
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Producto no encontrado.' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// ---------- CREATE ----------
router.post('/', async (req, res, next) => {
  const { error, datos } = validarProducto(req.body);
  if (error) return res.status(400).json({ error });
  try {
    const { rows } = await pool.query(
      `INSERT INTO producto (nombre, precio, stock, id_categoria)
       VALUES ($1, $2, $3, $4)
       RETURNING id_producto, nombre, precio, stock, id_categoria`,
      [datos.nombre, datos.precio, datos.stock, datos.idCategoria]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err); // si la categoría no existe → error 23503 (FK)
  }
});

// ---------- UPDATE ----------
router.put('/:id', async (req, res, next) => {
  const id = leerId(req, res);
  if (id === null) return;
  const { error, datos } = validarProducto(req.body);
  if (error) return res.status(400).json({ error });
  try {
    const { rows } = await pool.query(
      `UPDATE producto
       SET nombre = $1, precio = $2, stock = $3, id_categoria = $4
       WHERE id_producto = $5
       RETURNING id_producto, nombre, precio, stock, id_categoria`,
      [datos.nombre, datos.precio, datos.stock, datos.idCategoria, id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Producto no encontrado.' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// ---------- DELETE ----------
router.delete('/:id', async (req, res, next) => {
  const id = leerId(req, res);
  if (id === null) return;
  try {
    const { rows } = await pool.query(
      'DELETE FROM producto WHERE id_producto = $1 RETURNING id_producto, nombre',
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Producto no encontrado.' });
    res.json({ mensaje: 'Producto eliminado.', eliminado: rows[0] });
  } catch (err) {
    next(err); // si aparece en una factura → error 23503 (FK)
  }
});

module.exports = router;
