const nodemailer = require('nodemailer');
const { logger } = require('../utils/logger');

/**
 * Service to handle transactional email notifications.
 */
class MailService {
  constructor() {
    // These should ideally be in .env
    this.transporter = nodemailer.createTransport({
      host: process.env.MAIL_HOST || 'smtp.gmail.com',
      port: process.env.MAIL_PORT || 587,
      secure: process.env.MAIL_SECURE === 'true',
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS
      }
    });
  }

  /**
   * Send an email.
   * @param {string} to - Recipient email
   * @param {string} subject - Email subject
   * @param {string} html - HTML content
   */
  async sendMail(to, subject, html) {
    try {
      const info = await this.transporter.sendMail({
        from: `"${process.env.APP_NAME || 'TOAFL App'}" <${process.env.MAIL_USER}>`,
        to,
        subject,
        html
      });
      logger.info(`Email sent to ${to}: ${subject}`);
      return info;
    } catch (error) {
      logger.error('Mail Error:', error);
      throw error;
    }
  }

  // Templates
  async sendPaymentConfirmation(to, userName, invoiceNumber) {
    const subject = `Konfirmasi Pembayaran - ${invoiceNumber}`;
    const html = `
      <h1>Halo ${userName},</h1>
      <p>Pembayaran Anda untuk invoice <strong>${invoiceNumber}</strong> telah berhasil diverifikasi.</p>
      <p>Anda sekarang dapat mengakses materi ujian di dashboard Anda.</p>
      <br>
      <p>Terima kasih,</p>
      <p>Tim TOAFL</p>
    `;
    return this.sendMail(to, subject, html);
  }
}

module.exports = new MailService();
