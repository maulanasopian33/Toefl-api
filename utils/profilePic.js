// utils/profilePic.js

/**
 * Generate deterministic color dari string (hashing sederhana)
 */
function stringToColor(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  let color = "";
  for (let i = 0; i < 3; i++) {
    const value = (hash >> (i * 8)) & 0xff;
    color += ("00" + value.toString(16)).slice(-2);
  }
  return color.toUpperCase();
}

/**
 * Tentukan warna teks agar kontras (hitam/putih)
 */
function getContrastYIQ(hexcolor) {
  const r = parseInt(hexcolor.substr(0, 2), 16);
  const g = parseInt(hexcolor.substr(2, 2), 16);
  const b = parseInt(hexcolor.substr(4, 2), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 128 ? "000000" : "FFFFFF";
}

/**
 * Generate profile picture URL dari nama
 * @param {string} name Nama user
 * @param {number} size Ukuran gambar (default 48)
 * @returns {string} URL profile picture
 */
function generateProfilePic(name, size = 48) {
  if (!name) return "";

  // ambil inisial (max 2 huruf)
  const initials = name
    .split(" ")
    .map((n) => n[0]?.toUpperCase())
    .join("")
    .slice(0, 2);

  const bgColor = stringToColor(name);
  const textColor = getContrastYIQ(bgColor);

  return `https://placehold.co/${size}x${size}/${bgColor}/${textColor}?text=${initials}`;
}

module.exports = { generateProfilePic };
