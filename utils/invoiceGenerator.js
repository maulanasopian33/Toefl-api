// c:\Users\Thinkpad-ant\Documents\aplikasi\Toefl\node-be\utils\invoiceGenerator.js

const db = require('../models');
const { Op } = require('sequelize');

/**
 * Generate nomor invoice unik dengan format: INV-YYMMDD-XXXX
 * Contoh: INV-240102-0001
 * 
 * @returns {Promise<string>} Nomor invoice baru
 */
const generateInvoiceNumber = async () => {
  const prefix = 'INV';
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const dateCode = `${String(year).slice(-2)}${month}${day}`; // Hasil: 240102
  
  // Pattern untuk mencari invoice hari ini di DB: INV-YYMMDD-%
  const searchPattern = `${prefix}-${dateCode}-%`;

  try {
    // Cari invoice terakhir yang dibuat hari ini
    const lastInvoice = await db.payment.findOne({
      where: {
        invoiceNumber: {
          [Op.like]: searchPattern
        }
      },
      order: [['invoiceNumber', 'DESC']],
      attributes: ['invoiceNumber'],
      // paranoid: false // Uncomment jika ingin menghitung soft-deleted record juga
    });

    let sequence = 1;
    
    if (lastInvoice && lastInvoice.invoiceNumber) {
      // Ambil bagian nomor urut (bagian terakhir setelah split -)
      const parts = lastInvoice.invoiceNumber.split('-');
      const lastSeq = parseInt(parts[parts.length - 1], 10);
      
      if (!isNaN(lastSeq)) {
        sequence = lastSeq + 1;
      }
    }

    // Padding nomor urut menjadi 4 digit (misal: 1 -> 0001)
    const sequenceStr = String(sequence).padStart(4, '0');
    
    return `${prefix}-${dateCode}-${sequenceStr}`;
  } catch (error) {
    console.error('Error generating invoice number:', error);
    // Fallback jika error: gunakan timestamp agar tetap unik
    return `${prefix}-${dateCode}-ERR-${Date.now()}`;
  }
};

module.exports = { generateInvoiceNumber };