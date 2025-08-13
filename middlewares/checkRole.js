// middlewares/checkRole.js
const checkRole = (allowedRoles) => {
  return (req, res, next) => {
    // Pastikan req.user tersedia dari middleware autentikasi
    if (!req.user || !req.user.role) {
      return res.status(403).send('Akses ditolak. Role pengguna tidak ditemukan.');
    }
    

    // Periksa apakah role pengguna ada dalam daftar role yang diizinkan
    if (allowedRoles.includes(req.user.role)) {
      next(); // Lanjutkan ke route berikutnya
    } else {
      res.status(403).send('Akses ditolak. Anda tidak memiliki izin.');
    }
  };
};

module.exports = checkRole;