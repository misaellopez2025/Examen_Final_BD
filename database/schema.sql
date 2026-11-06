-- =====================================================================
--  BASE DE DATOS: TIENDA (normalizada hasta 3FN)
--  Motor: PostgreSQL (Neon, Supabase, Aiven, local, etc.)
--
--  Cómo usarlo en Neon:
--    Console > tu proyecto > SQL Editor > pegar TODO este archivo > Run
--
--  OJO: las primeras líneas BORRAN las tablas si ya existen,
--  así puedes volver a ejecutarlo desde cero cuantas veces quieras.
-- =====================================================================

DROP TABLE IF EXISTS detalle_factura CASCADE;
DROP TABLE IF EXISTS factura         CASCADE;
DROP TABLE IF EXISTS cliente         CASCADE;
DROP TABLE IF EXISTS producto        CASCADE;
DROP TABLE IF EXISTS categoria       CASCADE;

-- ---------------------------------------------------------------------
-- 1) CATEGORIA  (sale de la 3FN: nombre_categoria dependía de id_categoria,
--    no del producto)
-- ---------------------------------------------------------------------
CREATE TABLE categoria (
    id_categoria  INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre        VARCHAR(50)  NOT NULL UNIQUE,
    descripcion   VARCHAR(200)
);

-- ---------------------------------------------------------------------
-- 2) PRODUCTO  (sale de la 2FN: nombre y precio dependían solo del producto,
--    no de la factura)
-- ---------------------------------------------------------------------
CREATE TABLE producto (
    id_producto   INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre        VARCHAR(100)  NOT NULL,
    precio        NUMERIC(10,2) NOT NULL CHECK (precio >= 0),
    stock         INT           NOT NULL DEFAULT 0 CHECK (stock >= 0),
    id_categoria  INT           NOT NULL,
    CONSTRAINT fk_producto_categoria
        FOREIGN KEY (id_categoria) REFERENCES categoria (id_categoria)
);

-- ---------------------------------------------------------------------
-- 3) CLIENTE  (sale de la 3FN: nombre/teléfono dependían del NIT,
--    no de la factura)
-- ---------------------------------------------------------------------
CREATE TABLE cliente (
    id_cliente  INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nit         VARCHAR(15)  NOT NULL UNIQUE,
    nombre      VARCHAR(100) NOT NULL,
    telefono    VARCHAR(15),
    correo      VARCHAR(100)
);

-- ---------------------------------------------------------------------
-- 4) FACTURA  (encabezado: datos que dependen solo del número de factura)
-- ---------------------------------------------------------------------
CREATE TABLE factura (
    id_factura  INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    fecha       DATE NOT NULL DEFAULT CURRENT_DATE,
    id_cliente  INT  NOT NULL,
    CONSTRAINT fk_factura_cliente
        FOREIGN KEY (id_cliente) REFERENCES cliente (id_cliente)
);

-- ---------------------------------------------------------------------
-- 5) DETALLE_FACTURA  (tabla intermedia N:M entre factura y producto)
--    PK compuesta = (id_factura, id_producto)
--    precio_unitario se guarda a propósito: es el precio AL MOMENTO de la
--    venta (dato histórico), no una copia redundante de producto.precio.
-- ---------------------------------------------------------------------
CREATE TABLE detalle_factura (
    id_factura       INT           NOT NULL,
    id_producto      INT           NOT NULL,
    cantidad         INT           NOT NULL CHECK (cantidad > 0),
    precio_unitario  NUMERIC(10,2) NOT NULL CHECK (precio_unitario >= 0),
    CONSTRAINT pk_detalle_factura PRIMARY KEY (id_factura, id_producto),
    CONSTRAINT fk_detalle_factura
        FOREIGN KEY (id_factura)  REFERENCES factura (id_factura) ON DELETE CASCADE,
    CONSTRAINT fk_detalle_producto
        FOREIGN KEY (id_producto) REFERENCES producto (id_producto)
);

-- =====================================================================
--  DATOS DE EJEMPLO
-- =====================================================================
INSERT INTO categoria (nombre, descripcion) VALUES
    ('Computadoras', 'Laptops y equipos de escritorio'),
    ('Accesorios',   'Mouse, teclados, audífonos y más'),
    ('Monitores',    'Pantallas y monitores'),
    ('Almacenamiento', 'Discos duros, SSD y memorias USB');

INSERT INTO producto (nombre, precio, stock, id_categoria) VALUES
    ('Laptop Lenovo IdeaPad 3',  4999.00, 10, 1),
    ('PC Escritorio HP ProDesk', 6250.50,  4, 1),
    ('Mouse Logitech M170',        95.00, 50, 2),
    ('Teclado mecánico Redragon', 375.00, 20, 2),
    ('Audífonos JBL Tune 510BT',  399.99, 15, 2),
    ('Monitor Samsung 24"',      1299.00,  8, 3),
    ('SSD Kingston 1TB',          650.00, 25, 4),
    ('Memoria USB SanDisk 64GB',   85.00, 60, 4);

INSERT INTO cliente (nit, nombre, telefono, correo) VALUES
    ('1234567-8', 'Ana López',     '5555-1111', 'ana@correo.com'),
    ('8765432-1', 'Carlos Pérez',  '5555-2222', 'carlos@correo.com'),
    ('CF',        'Consumidor Final', NULL,      NULL);

INSERT INTO factura (fecha, id_cliente) VALUES
    ('2026-10-01', 1),
    ('2026-10-03', 2),
    ('2026-10-05', 1);

INSERT INTO detalle_factura (id_factura, id_producto, cantidad, precio_unitario) VALUES
    (1, 1, 1, 4999.00),
    (1, 3, 2,   95.00),
    (2, 6, 2, 1299.00),
    (2, 4, 1,  375.00),
    (3, 7, 3,  650.00);

-- =====================================================================
--  VERIFICACIÓN RÁPIDA (debe devolver filas)
-- =====================================================================
SELECT p.id_producto, p.nombre, p.precio, p.stock, c.nombre AS categoria
FROM producto p
JOIN categoria c ON c.id_categoria = p.id_categoria
ORDER BY p.id_producto;
