
const db = require('../models')
const { downloadImage } = require('../utils/imageDownloader');

exports.handleLogin = async (req, res, next) => {
  try {
    const { uid, email, name, picture, email_verified, auth_time } = req.user;
    const localPicturePath = await downloadImage(picture, uid);
    // Use findOrCreate to handle both cases efficiently
    const [user, created] = await db.user.findOrCreate({
      where: { uid: uid },
      defaults: {
        uid: uid,
        email: email,
        name: name,
        email_verified: email_verified,
        picture: localPicturePath,
        lastLogin: new Date(auth_time * 1000) // Convert seconds to milliseconds
      }
    });

    // If the user already exists, update their data
    if (!created) {
      await user.update({
        email: email,
        name: name,
        email_verified: email_verified,
        picture: localPicturePath,
        lastLogin: new Date(auth_time * 1000)
      });
    }

    res.status(200).json({
      status: true,
      message: 'Login successful',
      role: user.role,
      data: req.user,
    });
  } catch (error) {
    next(error);
  }
};
exports.getUsers = async (req, res, next) => {
  try {

    const users = await db.user.findAll({
    //   include: [{ model: UserDetail }] // Sertakan data UserDetail
    });

    if (!users) {
      return res.status(404).json({ 
        status : false,
        message: 'List user tidak ditemukan.'
       });
    }

    res.status(200).json({
      message: 'List user berhasil diambil.',
      data: users
    });
  } catch (error) {
    next(error);
  }
};

exports.getUserByUid = async (req, res) => {
  const { uid } = req.user;
  try {
    const user = await db.user.findOne({
      where: { uid: uid },
      include: [{ model: db.userdetail }] // Sertakan data UserDetail
    });
    if (!user) {
      return res.status(404).json({ 
        status : false,
        message: "User tidak ditemukan."
     });
    }
    res.status(200).json({
        status : true,
        message: "User berhasil diambil.",
        data: user
    });
  } catch (err) {
    res.status(500).json({ 
        status  : false,
        message: "Terjadi kesalahan saat mengambil data user.",
        error: err.message
    });
  }
};