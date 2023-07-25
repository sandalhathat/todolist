// emailUtils.js

function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function sanitizeEmail(email) {
  return email.trim(); // Removes leading and trailing whitespaces
}

function formatEmailKey(email) {
  return email.replace(/\./g, ''); // Remove periods from email address
}

module.exports = {
  isValidEmail,
  sanitizeEmail,
  formatEmailKey,
};
