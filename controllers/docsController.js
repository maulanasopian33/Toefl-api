const db = require('../models');
const { logger } = require('../utils/logger');
const { getCache, setCache, deleteCache } = require('../services/cache.service');

const CACHE_KEY_ALL = 'docs:all:published';
const CACHE_KEY_ADMIN = 'docs:all:admin';
const CACHE_KEY_SLUG = (slug) => `docs:slug:${slug}`;
const CACHE_TTL = 600; // 10 menit

// Helper: generate slug from title
const generateSlug = (title) => {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
};

// Helper: ensure slug uniqueness
const ensureUniqueSlug = async (base, excludeId = null) => {
  let slug = base;
  let count = 0;
  while (true) {
    const where = { slug };
    if (excludeId) where.id = { [db.Sequelize.Op.ne]: excludeId };
    const exists = await db.doc.findOne({ where });
    if (!exists) break;
    count++;
    slug = `${base}-${count}`;
  }
  return slug;
};

/**
 * GET /api/docs
 * Kembalikan semua artikel AKTIF, dikelompokkan per kategori. Butuh auth.
 */
exports.getPublishedDocs = async (req, res, next) => {
  try {
    const cached = await getCache(CACHE_KEY_ALL);
    if (cached) return res.set('X-Cache', 'HIT').status(200).json(cached);

    const docs = await db.doc.findAll({
      where: { status: true },
      attributes: ['id', 'title', 'slug', 'category', 'category_icon', 'order_num'],
      order: [['category', 'ASC'], ['order_num', 'ASC'], ['title', 'ASC']]
    });

    // Group by category
    const grouped = docs.reduce((acc, doc) => {
      const key = doc.category;
      if (!acc[key]) {
        acc[key] = {
          category: key,
          icon: doc.category_icon || 'lucide:book-open',
          articles: []
        };
      }
      acc[key].articles.push({ id: doc.id, title: doc.title, slug: doc.slug, order_num: doc.order_num });
      return acc;
    }, {});

    const response = { status: true, data: Object.values(grouped) };
    await setCache(CACHE_KEY_ALL, response, CACHE_TTL);
    res.set('X-Cache', 'MISS').status(200).json(response);
  } catch (error) {
    logger.error('docsController.getPublishedDocs error:', error);
    next(error);
  }
};

/**
 * GET /api/docs/all
 * Admin only — semua artikel (aktif + draft), dengan content.
 */
exports.getAllDocs = async (req, res, next) => {
  try {
    const cached = await getCache(CACHE_KEY_ADMIN);
    if (cached) return res.set('X-Cache', 'HIT').status(200).json(cached);

    const docs = await db.doc.findAll({
      order: [['category', 'ASC'], ['order_num', 'ASC'], ['title', 'ASC']]
    });

    const response = { status: true, data: docs };
    await setCache(CACHE_KEY_ADMIN, response, CACHE_TTL);
    res.set('X-Cache', 'MISS').status(200).json(response);
  } catch (error) {
    logger.error('docsController.getAllDocs error:', error);
    next(error);
  }
};

/**
 * GET /api/docs/:slug
 * Baca isi artikel berdasarkan slug.
 */
exports.getDocBySlug = async (req, res, next) => {
  try {
    const { slug } = req.params;
    const cached = await getCache(CACHE_KEY_SLUG(slug));
    if (cached) return res.set('X-Cache', 'HIT').status(200).json(cached);

    const doc = await db.doc.findOne({ where: { slug, status: true } });
    if (!doc) {
      return res.status(404).json({ status: false, message: 'Artikel tidak ditemukan.' });
    }

    const response = { status: true, data: doc };
    await setCache(CACHE_KEY_SLUG(slug), response, CACHE_TTL);
    res.set('X-Cache', 'MISS').status(200).json(response);
  } catch (error) {
    logger.error('docsController.getDocBySlug error:', error);
    next(error);
  }
};

/**
 * POST /api/docs
 * Admin/Superadmin — buat artikel baru.
 */
exports.createDoc = async (req, res, next) => {
  try {
    const { title, category, category_icon, content_md, order_num, status } = req.body;
    if (!title) {
      return res.status(400).json({ status: false, message: 'Judul artikel wajib diisi.' });
    }

    const baseSlug = generateSlug(title);
    const slug = await ensureUniqueSlug(baseSlug);

    const doc = await db.doc.create({
      title,
      slug,
      category: category || 'Umum',
      category_icon: category_icon || 'lucide:book-open',
      content_md: content_md || '',
      order_num: order_num || 0,
      status: status !== undefined ? status : true
    });

    await Promise.all([
      deleteCache(CACHE_KEY_ALL),
      deleteCache(CACHE_KEY_ADMIN)
    ]);

    res.status(201).json({ status: true, message: 'Artikel berhasil dibuat.', data: doc });
  } catch (error) {
    logger.error('docsController.createDoc error:', error);
    next(error);
  }
};

/**
 * PUT /api/docs/:id
 * Admin/Superadmin — update artikel.
 */
exports.updateDoc = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, category, category_icon, content_md, order_num, status } = req.body;

    const doc = await db.doc.findByPk(id);
    if (!doc) {
      return res.status(404).json({ status: false, message: 'Artikel tidak ditemukan.' });
    }

    // Regenerate slug if title changed
    let slug = doc.slug;
    if (title && title !== doc.title) {
      const baseSlug = generateSlug(title);
      slug = await ensureUniqueSlug(baseSlug, id);
    }

    await doc.update({
      title: title || doc.title,
      slug,
      category: category !== undefined ? category : doc.category,
      category_icon: category_icon !== undefined ? category_icon : doc.category_icon,
      content_md: content_md !== undefined ? content_md : doc.content_md,
      order_num: order_num !== undefined ? order_num : doc.order_num,
      status: status !== undefined ? status : doc.status
    });

    await Promise.all([
      deleteCache(CACHE_KEY_ALL),
      deleteCache(CACHE_KEY_ADMIN),
      deleteCache(CACHE_KEY_SLUG(doc.slug)),
      deleteCache(CACHE_KEY_SLUG(slug))
    ]);

    res.status(200).json({ status: true, message: 'Artikel berhasil diperbarui.', data: doc });
  } catch (error) {
    logger.error('docsController.updateDoc error:', error);
    next(error);
  }
};

/**
 * DELETE /api/docs/:id
 * Admin/Superadmin — hapus artikel.
 */
exports.deleteDoc = async (req, res, next) => {
  try {
    const { id } = req.params;
    const doc = await db.doc.findByPk(id);
    if (!doc) {
      return res.status(404).json({ status: false, message: 'Artikel tidak ditemukan.' });
    }

    const { slug } = doc;
    await doc.destroy();

    await Promise.all([
      deleteCache(CACHE_KEY_ALL),
      deleteCache(CACHE_KEY_ADMIN),
      deleteCache(CACHE_KEY_SLUG(slug))
    ]);

    res.status(200).json({ status: true, message: 'Artikel berhasil dihapus.' });
  } catch (error) {
    logger.error('docsController.deleteDoc error:', error);
    next(error);
  }
};
