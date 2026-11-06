// =====================================================================
//  CONEXIÓN A LA BASE DE DATOS (PostgreSQL en la nube)
//  Usa un "pool": un grupo de conexiones que se reutilizan en cada consulta.
// =====================================================================
const { Pool } = require('pg');

// Si existe DATABASE_URL (Neon), se usa la cadena completa.
// Si no, se arma la conexión con DB_HOST, DB_USER, etc.
const config = process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL }
  : {
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT) || 5432,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      // Las BD en la nube casi siempre piden SSL
      ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
    };

const pool = new Pool(config);

// Neon "duerme" la base de datos cuando no se usa y cierra conexiones
// inactivas. Sin esta línea, eso tumbaría el servidor.
pool.on('error', (err) => {
  console.error('Aviso: se cerró una conexión inactiva con la BD:', err.message);
});

module.exports = pool;
