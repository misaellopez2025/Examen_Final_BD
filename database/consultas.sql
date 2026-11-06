-- =====================================================================
--  CONSULTAS DE PRÁCTICA (ejecútalas en el SQL Editor de Neon)
--  Sirven para demostrar que la BD normalizada se puede "volver a armar"
--  con JOIN sin perder información.
-- =====================================================================

-- 1) Productos con el nombre de su categoría (JOIN 1:N)
SELECT p.nombre AS producto, p.precio, c.nombre AS categoria
FROM producto p
JOIN categoria c ON c.id_categoria = p.id_categoria
ORDER BY c.nombre, p.nombre;

-- 2) Cuántos productos hay por categoría (incluye categorías vacías)
SELECT c.nombre AS categoria, COUNT(p.id_producto) AS total_productos
FROM categoria c
LEFT JOIN producto p ON p.id_categoria = c.id_categoria
GROUP BY c.nombre
ORDER BY total_productos DESC;

-- 3) Detalle completo de cada factura (reconstruye la tabla original sin normalizar)
SELECT f.id_factura, f.fecha, cl.nit, cl.nombre AS cliente,
       p.nombre AS producto, d.cantidad, d.precio_unitario,
       d.cantidad * d.precio_unitario AS subtotal
FROM factura f
JOIN cliente cl        ON cl.id_cliente = f.id_cliente
JOIN detalle_factura d ON d.id_factura  = f.id_factura
JOIN producto p        ON p.id_producto = d.id_producto
ORDER BY f.id_factura, p.nombre;

-- 4) Total por factura
SELECT f.id_factura, f.fecha, cl.nombre AS cliente,
       SUM(d.cantidad * d.precio_unitario) AS total
FROM factura f
JOIN cliente cl        ON cl.id_cliente = f.id_cliente
JOIN detalle_factura d ON d.id_factura  = f.id_factura
GROUP BY f.id_factura, f.fecha, cl.nombre
ORDER BY f.id_factura;

-- 5) Total comprado por cliente
SELECT cl.nombre AS cliente, COALESCE(SUM(d.cantidad * d.precio_unitario), 0) AS total_comprado
FROM cliente cl
LEFT JOIN factura f         ON f.id_cliente = cl.id_cliente
LEFT JOIN detalle_factura d ON d.id_factura = f.id_factura
GROUP BY cl.nombre
ORDER BY total_comprado DESC;

-- =====================================================================
--  CRUD "a mano" (lo mismo que hace el backend)
-- =====================================================================
-- CREATE
-- INSERT INTO categoria (nombre, descripcion) VALUES ('Impresoras', 'Láser y tinta') RETURNING *;
-- READ
-- SELECT * FROM categoria ORDER BY id_categoria;
-- UPDATE
-- UPDATE categoria SET descripcion = 'Impresoras láser' WHERE id_categoria = 5 RETURNING *;
-- DELETE
-- DELETE FROM categoria WHERE id_categoria = 5 RETURNING *;
