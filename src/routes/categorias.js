// =====================================================================
//  CRUD DE CATEGORÍAS   →   /api/categorias
//
//  GET    /api/categorias       → listar todas      (READ)
//  GET    /api/categorias/:id   → obtener una       (READ)
//  POST   /api/categorias       → crear             (CREATE)
//  PUT    /api/categorias/:id   → actualizar        (UPDATE)
//  DELETE /api/categorias/:id   → eliminar          (DELETE)
//
//  IMPORTANTE: siempre se usan parámetros ($1, $2...) en las consultas.
//  NUNCA concatenes texto del usuario en el SQL (evita inyección SQL).
// =====================================================================
const express = require('express');
const pool = require('../db');

const router = express.Router();

// Valida que el :id de la URL sea un entero positivo
function leerId(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'El id debe ser un número entero positivo.' });
    return null;
  }
  return id;
}

// Valida los datos que llegan del formulario
function validarCategoria(body = {}) {
  const nombre = typeof body.nombre === 'string' ? body.nombre.trim() : '';
  const descripcion = typeof body.descripcion === 'string' ? body.descripcion.trim() : '';

  if (!nombre) return { error: 'El nombre es obligatorio.' };
  if (nombre.length > 50) return { error: 'El nombre no puede pasar de 50 caracteres.' };
  if (descripcion.length > 200) return { error: 'La descripción no puede pasar de 200 caracteres.' };

  return { datos: { nombre, descripcion: descripcion || null } };
}

// ---------- READ: listar todas ----------
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT c.id_categoria, c.nombre, c.descripcion,
             COUNT(p.id_producto)::int AS total_productos
      FROM categoria c
      LEFT JOIN producto p ON p.id_categoria = c.id_categoria
      GROUP BY c.id_categoria, c.nombre, c.descripcion
      ORDER BY c.id_categoria
    `);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// ---------- READ: obtener una ----------
router.get('/:id', async (req, res, next) => {
  const id = leerId(req, res);
  if (id === null) return;
  try {
    const { rows } = await pool.query(
      'SELECT id_categoria, nombre, descripcion FROM categoria WHERE id_categoria = $1',
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Categoría no encontrada.' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// ---------- CREATE ----------
router.post('/', async (req, res, next) => {
  const { error, datos } = validarCategoria(req.body);
  if (error) return res.status(400).json({ error });
  try {
    const { rows } = await pool.query(
      `INSERT INTO categoria (nombre, descripcion)
       VALUES ($1, $2)
       RETURNING id_categoria, nombre, descripcion`,
      [datos.nombre, datos.descripcion]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// ---------- UPDATE ----------
router.put('/:id', async (req, res, next) => {
  const id = leerId(req, res);
  if (id === null) return;
  const { error, datos } = validarCategoria(req.body);
  if (error) return res.status(400).json({ error });
  try {
    const { rows } = await pool.query(
      `UPDATE categoria
       SET nombre = $1, descripcion = $2
       WHERE id_categoria = $3
       RETURNING id_categoria, nombre, descripcion`,
      [datos.nombre, datos.descripcion, id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Categoría no encontrada.' });
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
      'DELETE FROM categoria WHERE id_categoria = $1 RETURNING id_categoria, nombre',
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Categoría no encontrada.' });
    res.json({ mensaje: 'Categoría eliminada.', eliminado: rows[0] });
  } catch (err) {
    next(err); // si tiene productos, PostgreSQL lanza error 23503 (FK)
  }
});

module.exports = router;
