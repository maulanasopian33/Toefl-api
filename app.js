const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');

const indexRouter = require('./routes/index');
const usersRouter = require('./routes/users');
const authRouter = require('./routes/auth');
const detailUserRouter = require('./routes/detailUser');
const batchRouter = require('./routes/batchRoutes');
const batchSessionRouter = require('./routes/batchSessionRoutes');
const batchParticipantRoutes = require('./routes/batchParticipant');
const paymentRoutes = require('./routes/payment');
const resultRoutes = require('./routes/resultRoutes');
const questionRoutes = require('./routes/questionRoutes');
const optionRoutes = require('./routes/optionRoutes');
const userAnswerRoutes = require('./routes/userAnswerRoutes');
const userResultRoutes = require('./routes/userResultRoutes');
const groupRoutes = require('./routes/groupRoutes');
const sectionRoutes = require('./routes/sectionRoutes');
const groupAudioInstructionRoutes = require("./routes/groupAudioInstructionRoutes");
const adminStatsRoutes = require('./routes/adminStats');
const examRoutes = require('./routes/examRoutes');
const mediaRoutes = require('./routes/mediaRoutes');
const logRoutes = require('./routes/logRoutes');
const settingRoutes = require('./routes/settingRoutes');
const rolePermissionRoutes = require('./routes/rolePermissionRoutes');
const scoringRoutes = require('./routes/scoringRoutes');
const bankRoutes = require('./routes/bankRoutes');
const certificateTemplateRoutes = require('./routes/certificateTemplateRoutes');
const reportRoutes = require('./routes/reportRoutes');



const { httpLogger } = require('./utils/logger');

const { reconcilePendingResults } = require('./services/submissionQueue');

// Run reconciliation for any interrupted scoring jobs
reconcilePendingResults().catch(err => console.error('Reconciliation failed:', err));

const app = express();


const cors = require('cors');
const corsOptions = require('./config/cors');
const errorHandler = require('./middlewares/errorHandler');
const auditMiddleware = require('./middlewares/auditMiddleware');
const checkAuth = require('./middlewares/authMiddleware');


// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(cors(corsOptions));

// Security Headers
const helmet = require('helmet');
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow resource loading from other origins if needed (e.g., images)
}));

// Rate Limiting
const rateLimit = require('express-rate-limit');
// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 300, // Increased to 300 to accommodate multiple assets/reloads
//   standardHeaders: true,
//   legacyHeaders: false,
//   message: { status: false, message: 'Terlalu banyak permintaan, silakan coba lagi nanti.' }
// });
// app.use(limiter);

// Specific limiter for login to prevent brute force
const loginLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 5,
  message: { status: false, message: 'Terlalu banyak percobaan login, silakan tunggu 1 menit.' }
});
app.use('/auth/login', loginLimiter);

// Gunakan morgan untuk HTTP request logging dan arahkan outputnya ke Winston
app.use(morgan('combined', { stream: httpLogger.stream }));

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ limit: '2mb', extended: false }));
app.use(cookieParser());
app.use(auditMiddleware);
const storageUtil = require('./utils/storage');
app.use(express.static(storageUtil.getStorageDir()));

app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/auth', authRouter);
app.use('/user/detail', detailUserRouter);
app.use('/batch', batchRouter);
app.use('/batch-session', batchSessionRouter);
app.use('/participants', batchParticipantRoutes);
app.use('/payments', paymentRoutes);
app.use('/results', resultRoutes);
app.use('/questions', questionRoutes);
app.use('/options', optionRoutes);
app.use('/answers', userAnswerRoutes);
app.use('/results', userResultRoutes);
app.use('/groups', groupRoutes);
app.use('/sections', sectionRoutes);
app.use("/audio-instructions", groupAudioInstructionRoutes);
app.use('/admin', adminStatsRoutes);
app.use('/exams', examRoutes);
app.use('/media', mediaRoutes);
app.use('/logs', logRoutes);
app.use('/settings', settingRoutes);
app.use('/rbac', rolePermissionRoutes);
app.use('/scoring', scoringRoutes);
app.use('/bank', bankRoutes);
app.use('/certificate-templates', certificateTemplateRoutes);
app.use('/reports', reportRoutes);
app.use('/logs', logRoutes);
// Middleware untuk menangani route yang tidak ditemukan (404 Not Found)
app.use((req, res, next) => {
  const error = new Error('Not Found');
  error.status = 404;
  next(error);
});

// Daftarkan error handler global di bagian paling akhir
app.use(errorHandler);

module.exports = app;
