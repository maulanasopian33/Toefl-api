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
    return process.env.CDN_STORAGE_DIR || path.join(__dirname, '../public');
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
