const path = require('path');
const fs = require('fs');

/**
 * Utility to manage storage paths and URLs
 */
const storage = {
  /**
   * Get the base storage directory from environment or fallback to public/
   */
  getStorageDir: () => {
    const dir = process.env.CDN_STORAGE_DIR || path.join(__dirname, '../public');
    // Tambahkan log untuk debug di production
    if (process.env.NODE_ENV === 'production') {
      // Log storage directory selection if needed via logger
    }
    return dir;
  },

  /**
   * Extract relative path from a potentially full URL or already relative path
   */
  getRelativePath: (storedPath) => {
    if (!storedPath) return '';
    
    // Check if it's a full URL
    if (storedPath.startsWith('http://') || storedPath.startsWith('https://')) {
      try {
        const urlObj = new URL(storedPath);
        // urlObj.pathname will be like "/storage/certificates/file.pdf"
        return urlObj.pathname.startsWith('/') ? urlObj.pathname.slice(1) : urlObj.pathname;
      } catch (e) {
        // Fallback for malformed URLs
        return storedPath;
      }
    }
    
    // Fallback if it's already a relative path starting with /
    return storedPath.startsWith('/') ? storedPath.slice(1) : storedPath;
  },

  /**
   * Resolve an absolute path within the storage directory
   */
  resolvePath: (subPath = '') => {
    const baseDir = storage.getStorageDir();
    return path.resolve(path.join(baseDir, subPath));
  },

  /**
   * Ensure a directory exists within the storage directory
   */
  ensureDir: (subPath = '') => {
    const fullPath = storage.resolvePath(subPath);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }
    return fullPath;
  },

  /**
   * Get the public URL for a given relative storage path
   */
  getPublicUrl: (subPath = '') => {
    const CDN_BASE_URL = (process.env.CDN_BASE_URL || '').replace(/\/+$/, '');
    const normalizedSubPath = subPath.replace(/^\/+/, '');
    
    if (CDN_BASE_URL) {
      return `${CDN_BASE_URL}/${normalizedSubPath}`;
    }
    
    // Fallback to relative path if no CDN_BASE_URL is set
    return `/${normalizedSubPath}`;
  }
};

module.exports = storage;
