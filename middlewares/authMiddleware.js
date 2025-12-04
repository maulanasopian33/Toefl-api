const admin = require('../utils/firebase-auth');
const db = require('../models/index')
const checkAuth = async (req, res, next) => {
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    const idToken = req.headers.authorization.split('Bearer ')[1];
    try {
      // 1. Verifikasi token dari Firebase
      const decodedToken = await admin.auth().verifyIdToken(idToken);

      // 2. Jadikan decodedToken sebagai dasar untuk req.user
      req.user = {
        ...decodedToken,
      }; 
      
      // 3. Prioritaskan custom claim 'role' dari token.
      //    Jika tidak ada di token, baru cari di database lokal sebagai fallback.
      //    Ini memastikan sistem otorisasi bersifat stateless dan cepat.
      if (!decodedToken.role) {
        const user = await db.user.findOne({ where: { uid: decodedToken.uid }, attributes: ['role'] });
        if (user) {
          req.user.role = user.role;
        }
      }

      next();
    } catch (error) {
      console.log(error)
      res.status(403).send('Unauthorized');
    }
  } else {
    console.log("tidak ada ")
    res.status(403).send('Unauthorized');
  }
};

module.exports = checkAuth;