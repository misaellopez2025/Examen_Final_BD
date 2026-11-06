// =====================================================================
//  SERVIDOR (BACKEND) — Node.js + Express
//  - Sirve el frontend (carpeta /public)
//  - Expone la API REST en /api/...
// =====================================================================
require('dotenv').config(); // lee el archivo .env (debe ir PRIMERO)

const path = require('path');
const express = require('express');
const pool = require('./db');
const categoriasRouter = require('./routes/categorias');
const productosRouter = require('./routes/productos');
const clientesRouter = require('./routes/clientes');
const facturasRouter = require('./routes/facturas');

const app = express();
const PORT = process.env.PORT || 3000;

// ---------- Middlewares ----------
app.use(express.json()); // permite leer req.body cuando llega JSON
app.use(express.static(path.join(__dirname, '..', 'public'))); // frontend

// ---------- Ruta para probar la conexión a la BD ----------
app.get('/api/health', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT NOW() AS hora_servidor, current_database() AS base_de_datos'
    );
    res.json({ ok: true, ...rows[0] });
  } catch (err) {
    next(err);
  }
});

// ---------- Rutas CRUD ----------
app.use('/api/categorias', categoriasRouter);
app.use('/api/productos', productosRouter);
app.use('/api/clientes', clientesRouter);
app.use('/api/facturas', facturasRouter);

// ---------- 404 para rutas de la API que no existen ----------
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// ---------- Manejo central de errores ----------
// Traduce los códigos de error de PostgreSQL a mensajes entendibles.
app.use((err, req, res, next) => {
  console.error(`[${req.method} ${req.originalUrl}]`, err.code || '', err.message);

  switch (err.code) {
    case '23505': // unique_violation
      return res.status(409).json({ error: 'Ya existe un registro con ese valor (dato repetido).' });
    case '23503': // foreign_key_violation
      return res.status(409).json({
        error:
          req.method === 'DELETE'
            ? 'No se puede eliminar: tiene registros relacionados (una categoría con productos, un producto en una factura o un cliente con facturas).'
            : 'El registro relacionado no existe (revisa la categoría, el cliente o el producto seleccionado).',
      });
    case '23502': // not_null_violation
      return res.status(400).json({ error: 'Falta un campo obligatorio.' });
    case '23514': // check_violation
      return res.status(400).json({ error: 'Un valor no cumple las reglas (por ejemplo, precio o stock negativo).' });
    case '22001': // string_data_right_truncation
      return res.status(400).json({ error: 'Un texto es demasiado largo.' });
    case '22007': // invalid_datetime_format
    case '22008': // datetime_field_overflow
      return res.status(400).json({ error: 'La fecha no es válida.' });
    case '22003': // numeric_value_out_of_range
    case '22P02': // invalid_text_representation
      return res.status(400).json({ error: 'Un valor numérico no es válido.' });
  }

  // JSON mal formado u otros errores con status (ej. 400 de express.json)
  if (err.status && err.status < 500) {
    return res.status(err.status).json({ error: 'Solicitud inválida.' });
  }

  res.status(500).json({ error: 'Error interno del servidor. Revisa la consola del backend.' });
});

// ---------- Arrancar ----------
app.listen(PORT, async () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
  try {
    const { rows } = await pool.query('SELECT current_database() AS db');
    console.log(`Conectado a la base de datos "${rows[0].db}" ✔`);
  } catch (err) {
    console.error('✖ No se pudo conectar a la base de datos:', err.message);
    console.error('  Revisa tu archivo .env (DATABASE_URL o DB_HOST/DB_USER/...).');
  }
});
