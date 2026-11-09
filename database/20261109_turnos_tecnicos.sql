-- Ejecutar sobre la base del proyecto. Conserva usuarios e incidencias existentes.
CREATE TABLE IF NOT EXISTS turnos_tecnicos (
  id_turno INT AUTO_INCREMENT PRIMARY KEY,
  id_usuario INT NOT NULL,
  fecha_inicio DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_fin DATETIME NULL,
  vence DATETIME NOT NULL,
  INDEX idx_turnos_usuario (id_usuario, fecha_fin, vence),
  CONSTRAINT fk_turnos_usuario FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
) ENGINE=InnoDB;
