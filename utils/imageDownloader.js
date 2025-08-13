const axios = require('axios');
const fs = require('fs');
const path = require('path');

const downloadImage = async (url, uid) => {
  try {
    if (!url) {
      console.log('URL gambar kosong.'); // Tambahkan log ini
      return null;
    }

    const publicDir = path.join(__dirname, '../public');
    const avatarsDir = path.join(publicDir, 'images', 'avatar');

    // Buat direktori jika belum ada
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir);
    }
    if (!fs.existsSync(avatarsDir)) {
      fs.mkdirSync(avatarsDir, { recursive: true });
    }

    const imagePath = path.join(avatarsDir, `${uid}.png`);

    const response = await axios({
      url,
      responseType: 'stream',
    });

    const writer = fs.createWriteStream(imagePath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => resolve(`/images/avatar/${uid}.png`));
      writer.on('error', (err) => {
        console.error('Error saat mengunduh gambar:', err);
        reject(null);
      });
    });
  } catch (error) {
    console.error('Error di utilitas downloadImage:', error.message); // Gunakan console.error
    return null;
  }
};

module.exports = { downloadImage };