const { calculateUserResult } = require('../services/resultService');

exports.calculateResult = async (req, res) => {
  try {
    const { userId, batchId } = req.body;
    if (!userId || !batchId) {
      return res.status(400).json({ message: 'userId dan batchId wajib diisi' });
    }

    const result = await calculateUserResult(userId, batchId);
    res.json({ success: true, result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal menghitung hasil ujian' });
  }
};
