# CRUD Tienda: BD en la nube + Backend + Frontend

Proyecto completo para los 3 temas del examen:

| Tema | Dónde está |
|---|---|
| **Normalización** | `NORMALIZACION.md` (0FN → 1FN → 2FN → 3FN) y `database/schema.sql` |
| **Backend conectado a la BD** | `src/` (Node.js + Express + PostgreSQL en **Neon**, gratis en la nube) |
| **Frontend** | `public/` (HTML + CSS + JavaScript con `fetch`) |

```
crud-tienda/
├── database/
│   ├── schema.sql        ← crea las 5 tablas + datos de ejemplo
│   └── consultas.sql     ← JOINs y CRUD de práctica
├── src/
│   ├── server.js         ← servidor Express (arranca todo)
│   ├── db.js             ← conexión a la BD en la nube
│   └── routes/
│       ├── categorias.js ← CRUD /api/categorias
│       └── productos.js  ← CRUD /api/productos
├── public/
│   ├── index.html        ← interfaz
│   ├── styles.css
│   └── app.js            ← llama a la API (fetch)
├── .env.example          ← plantilla de tus credenciales
├── NORMALIZACION.md
└── package.json
```

**Cómo fluye un CRUD:**

```
[Navegador: app.js]  --fetch-->  [Express: routes/*.js]  --SQL-->  [PostgreSQL en Neon]
      Frontend                        Backend                     Base de datos (nube)
```

---

## Requisitos

- **Node.js 18 o más nuevo** (recomendado 20 o 22 LTS). Revisa con `node -v`. Si no lo tienes: https://nodejs.org
- Una cuenta gratuita en **Neon** (no pide tarjeta).
- Un editor (VS Code).

---

## Paso 1: Crear la base de datos en la nube (Neon)

1. Entra a **https://neon.com** → **Sign up** (puedes usar tu cuenta de Google o GitHub).
2. Crea un proyecto:
   - **Project name:** `tienda`
   - **Postgres version:** la que venga por defecto
   - **Region:** la más cercana (para Guatemala, alguna de **US East**)
3. Ejecuta el script de las tablas:
   - En el menú del proyecto entra a **SQL Editor**.
   - Abre `database/schema.sql`, copia **todo**, pégalo y presiona **Run**.
   - Al final debe salir una tabla con **8 productos**. ✅
4. Copia la cadena de conexión:
   - Presiona el botón **Connect** (arriba en el panel).
   - Copia el texto que empieza con `postgresql://...` (incluye usuario, contraseña y host).

> 💡 Puedes volver a correr `schema.sql` cuando quieras: borra todo y deja los datos de ejemplo limpios. Útil antes del examen.

---

## Paso 2: Configurar el proyecto

Abre una terminal **en la carpeta del proyecto** y ejecuta:

```bash
npm install
```

Crea tu archivo `.env` a partir de la plantilla:

```bash
# Windows (CMD o PowerShell)
copy .env.example .env

# Mac / Linux
cp .env.example .env
```

Abre `.env` y pega tu cadena de Neon en `DATABASE_URL`:

```env
DATABASE_URL=postgresql://neondb_owner:TU_CLAVE@ep-algo-123456-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require
PORT=3000
```

> ⚠️ El archivo se debe llamar exactamente `.env` (en Windows revisa que no quede como `.env.txt`).
> ⚠️ **Nunca** subas `.env` a GitHub: tiene tu contraseña. Ya está en `.gitignore`.

---

## Paso 3: Correr el proyecto

```bash
npm start
```

En la terminal debe salir:

```
Servidor corriendo en http://localhost:3000
Conectado a la base de datos "neondb" ✔
```

Abre **http://localhost:3000** en el navegador. Arriba a la derecha debe aparecer en verde **"Conectado a la BD"**.

Mientras programas usa `npm run dev`: reinicia el servidor solo cada vez que guardas un archivo.

---

## La API (Backend)

| Acción CRUD | Método | Ruta | Body (JSON) |
|---|---|---|---|
| Probar conexión | GET | `/api/health` | — |
| **Read** (todas) | GET | `/api/categorias` | — |
| **Read** (una) | GET | `/api/categorias/1` | — |
| **Create** | POST | `/api/categorias` | `{"nombre":"Impresoras","descripcion":"Láser"}` |
| **Update** | PUT | `/api/categorias/5` | `{"nombre":"Impresoras","descripcion":"Tinta"}` |
| **Delete** | DELETE | `/api/categorias/5` | — |
| **Read** (todos, con JOIN) | GET | `/api/productos` | — |
| **Read** (uno) | GET | `/api/productos/3` | — |
| **Create** | POST | `/api/productos` | `{"nombre":"Webcam","precio":549.90,"stock":4,"id_categoria":2}` |
| **Update** | PUT | `/api/productos/3` | `{"nombre":"Mouse","precio":99,"stock":40,"id_categoria":2}` |
| **Delete** | DELETE | `/api/productos/3` | — |

Puedes probarla con **Postman** o la extensión **Thunder Client** de VS Code.

**Respuestas de error** (las genera `server.js` a partir de los códigos de PostgreSQL):

| Situación | Código HTTP |
|---|---|
| Falta un dato o viene mal (precio negativo, nombre vacío) | 400 |
| El id no existe | 404 |
| Nombre de categoría repetido (`UNIQUE`) | 409 |
| Borrar una categoría que tiene productos (`FOREIGN KEY`) | 409 |

---

## Para explicarlo en el examen (guion corto)

1. **Normalización:** "Partí de una tabla de facturas sin normalizar con datos repetidos. En 1FN separé los valores múltiples; en 2FN quité las dependencias parciales (factura, producto, detalle); en 3FN quité las transitivas (cliente y categoría)." → enseña `NORMALIZACION.md`.
2. **Base de datos en la nube:** "Está en Neon, que es PostgreSQL administrado. Las tablas tienen PK, FK, UNIQUE y CHECK." → enseña el SQL Editor de Neon.
3. **Backend:** "Express expone una API REST. `db.js` crea un *pool* de conexiones con la cadena del `.env`. Cada ruta ejecuta una consulta con parámetros `$1, $2` para evitar inyección SQL." → enseña `routes/productos.js`.
4. **Frontend:** "`app.js` usa `fetch` para llamar a la API: POST para crear, GET para listar, PUT para editar y DELETE para borrar. Después de cada acción recarga la tabla." → haz un CRUD en vivo.
5. **Integridad referencial:** intenta borrar la categoría *Computadoras* y muestra que la BD no lo permite porque tiene productos.

---

## Si en el examen te dan OTRA base de datos

**Si es PostgreSQL** (lo más fácil): ejecuta `schema.sql` en esa BD y cambia solo el `.env`. Si te dan los datos por separado, comenta `DATABASE_URL` y llena:

```env
DB_HOST=servidor.que.te.den.com
DB_PORT=5432
DB_USER=usuario
DB_PASSWORD=clave
DB_NAME=nombre_bd
DB_SSL=true
```

**Si es MySQL u Oracle**, el frontend queda igual; cambia el backend así:

| | PostgreSQL (este proyecto) | MySQL | Oracle |
|---|---|---|---|
| Paquete npm | `pg` | `mysql2` | `oracledb` |
| Parámetros en SQL | `$1, $2` | `?, ?` | `:1, :2` o `:nombre` |
| Autoincremento | `GENERATED ALWAYS AS IDENTITY` | `AUTO_INCREMENT` | `GENERATED ALWAYS AS IDENTITY` (12c+) |
| Texto / número | `VARCHAR`, `NUMERIC` | `VARCHAR`, `DECIMAL` | `VARCHAR2`, `NUMBER` |
| `RETURNING *` | ✅ Sí | ❌ No (usa `insertId` + `SELECT`) | Solo `RETURNING col INTO :var` |
| Commit | Automático | Automático | ⚠️ **Manual**: usa `{ autoCommit: true }` |
| Nombres de columnas en el resultado | minúsculas | como en la tabla | MAYÚSCULAS por defecto |

Si te toca MySQL u Oracle, avísame y te paso las versiones de `db.js`, las rutas y `schema.sql` para ese motor.

---

## Problemas comunes

| Error | Solución |
|---|---|
| `Cannot find module 'express'` | Te faltó `npm install` en la carpeta del proyecto. |
| `No se pudo conectar a la base de datos` | Revisa el `.env`: que se llame `.env`, que la cadena esté completa y sin espacios. |
| `password authentication failed` | Vuelve a copiar la cadena desde **Connect** en Neon (o restablece la contraseña del rol). |
| La primera consulta tarda unos segundos | Normal: Neon "duerme" la BD cuando no se usa y la despierta sola. |
| `relation "producto" does not exist` | No ejecutaste `schema.sql`, o lo ejecutaste en otra base/rama de Neon. |
| `EADDRINUSE: address already in use :::3000` | Ya tienes el servidor abierto en otra terminal. Ciérralo o cambia `PORT=3001`. |
| La página carga pero sin datos | Abre la consola del navegador (F12) y la terminal del backend para ver el error. |

---

## (Opcional) Subir también el backend y frontend a la nube

El examen solo pide la BD en la nube, pero si quieres una URL pública:

1. Sube el proyecto a GitHub (sin el `.env`).
2. En **https://render.com** → **New** → **Web Service** → elige tu repositorio.
3. **Build command:** `npm install` · **Start command:** `npm start` · **Instance type:** Free.
4. En **Environment** agrega la variable `DATABASE_URL` con tu cadena de Neon.

En el plan gratis, Render apaga el servicio tras 15 minutos sin visitas y tarda cerca de un minuto en volver a encender. Ábrelo antes de presentarlo.
