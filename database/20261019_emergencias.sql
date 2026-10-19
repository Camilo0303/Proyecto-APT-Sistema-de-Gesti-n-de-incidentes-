-- Actualización para bases V02/V03/V04 con tablas de alertas existentes.
-- Seleccionar la base con USE antes de ejecutar. No crea cuentas ni modifica usuarios.
INSERT INTO roles(nombre,descripcion)
SELECT 'Enfermería','Personal que recibe y atiende alertas internas'
WHERE NOT EXISTS(SELECT 1 FROM roles WHERE nombre='Enfermería');
