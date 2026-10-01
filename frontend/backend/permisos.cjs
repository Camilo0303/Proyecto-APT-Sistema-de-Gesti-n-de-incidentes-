function permitirRoles(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({
        mensaje: 'Debes iniciar sesión.',
      });
    }

    if (!rolesPermitidos.includes(req.usuario.rol)) {
      return res.status(403).json({
        mensaje: 'Tu cuenta no tiene permiso para esta función.',
      });
    }

    next();
  };
}

module.exports = { permitirRoles };