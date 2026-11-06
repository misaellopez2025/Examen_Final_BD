// =====================================================================
//  CRUD DE CLIENTES   →   /api/clientes
//
//  GET    /api/clientes       → listar todos (con cuántas facturas tiene)
//  GET    /api/clientes/:id   → obtener uno
//  POST   /api/clientes       → crear
//  PUT    /api/clientes/:id   → actualizar
//  DELETE /api/clientes/:id   → eliminar (no deja si tiene facturas)
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

function texto(valor) {
  return typeof valor === 'string' ? valor.trim() : '';
}

function validarCliente(body = {}) {
  const nit = texto(body.nit).toUpperCase();
  const nombre = texto(body.nombre);
  const telefono = texto(body.telefono);
  const correo = texto(body.correo).toLowerCase();

  if (!nit) return { error: 'El NIT es obligatorio (usa CF para Consumidor Final).' };
  if (nit.length > 15) return { error: 'El NIT no puede pasar de 15 caracteres.' };
  if (!nombre) return { error: 'El nombre es obligatorio.' };
  if (nombre.length > 100) return { error: 'El nombre no puede pasar de 100 caracteres.' };
  if (telefono.length > 15) return { error: 'El teléfono no puede pasar de 15 caracteres.' };
  if (correo.length > 100) return { error: 'El correo no puede pasar de 100 caracteres.' };
  if (correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo))
    return { error: 'El correo no tiene un formato válido.' };

  return {
    datos: { nit, nombre, telefono: telefono || null, correo: correo || null },
  };
}

// ---------- READ: listar todos ----------
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT cl.id_cliente, cl.nit, cl.nombre, cl.telefono, cl.correo,
             COUNT(f.id_factura)::int AS total_facturas
      FROM cliente cl
      LEFT JOIN factura f ON f.id_cliente = cl.id_cliente
      GROUP BY cl.id_cliente, cl.nit, cl.nombre, cl.telefono, cl.correo
      ORDER BY cl.id_cliente
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
      'SELECT id_cliente, nit, nombre, telefono, correo FROM cliente WHERE id_cliente = $1',
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Cliente no encontrado.' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// ---------- CREATE ----------
router.post('/', async (req, res, next) => {
  const { error, datos } = validarCliente(req.body);
  if (error) return res.status(400).json({ error });
  try {
    const { rows } = await pool.query(
      `INSERT INTO cliente (nit, nombre, telefono, correo)
       VALUES ($1, $2, $3, $4)
       RETURNING id_cliente, nit, nombre, telefono, correo`,
      [datos.nit, datos.nombre, datos.telefono, datos.correo]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err); // NIT repetido → error 23505 (UNIQUE)
  }
});

// ---------- UPDATE ----------
router.put('/:id', async (req, res, next) => {
  const id = leerId(req, res);
  if (id === null) return;
  const { error, datos } = validarCliente(req.body);
  if (error) return res.status(400).json({ error });
  try {
    const { rows } = await pool.query(
      `UPDATE cliente
       SET nit = $1, nombre = $2, telefono = $3, correo = $4
       WHERE id_cliente = $5
       RETURNING id_cliente, nit, nombre, telefono, correo`,
      [datos.nit, datos.nombre, datos.telefono, datos.correo, id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Cliente no encontrado.' });
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
      'DELETE FROM cliente WHERE id_cliente = $1 RETURNING id_cliente, nombre',
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Cliente no encontrado.' });
    res.json({ mensaje: 'Cliente eliminado.', eliminado: rows[0] });
  } catch (err) {
    next(err); // si tiene facturas → error 23503 (FK)
  }
});

module.exports = router;
