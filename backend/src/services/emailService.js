const nodemailer = require("nodemailer");
const config = require("../config");

function isSmtpConfigured() {
  const smtp = config.smtp;
  return !!(smtp.host && smtp.port && smtp.user && smtp.pass && smtp.from);
}

function createTransporter() {
  if (!isSmtpConfigured()) {
    throw new Error("SMTP nao configurado");
  }

  return nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: {
      user: config.smtp.user,
      pass: config.smtp.pass,
    },
  });
}

async function sendMail({ to, subject, text, html }) {
  const transporter = createTransporter();
  return transporter.sendMail({
    from: config.smtp.from,
    to,
    subject,
    text,
    html,
  });
}

module.exports = {
  isSmtpConfigured,
  sendMail,
};
