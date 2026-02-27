const axios = require('axios');
const fs = require('fs');
const path = require('path');

const downloadImage = async (url, uid) => {
  try {
    if (!url) {
      // Empty image URL
      return null;
    }

    const storageUtil = require('./storage');
    const avatarsDir = storageUtil.ensureDir(path.join('images', 'avatar'));
    const imagePath = path.join(avatarsDir, `${uid}.png`);

    const response = await axios({
      url,
      responseType: 'stream',
    });

    const writer = fs.createWriteStream(imagePath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => resolve(storageUtil.getPublicUrl(`images/avatar/${uid}.png`)));
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