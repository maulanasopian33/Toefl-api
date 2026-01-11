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


const { httpLogger } = require('./utils/logger');

const app = express();


const cors = require('cors');
const corsOptions = require('./config/cors');
const errorHandler = require('./middlewares/errorHandler');


// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(cors(corsOptions));

// Gunakan morgan untuk HTTP request logging dan arahkan outputnya ke Winston
app.use(morgan('combined', { stream: httpLogger.stream }));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

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
app.use('/scoring-tables', scoringRoutes);
// Middleware untuk menangani route yang tidak ditemukan (404 Not Found)
app.use((req, res, next) => {
  const error = new Error('Not Found');
  error.status = 404;
  next(error);
});

// Daftarkan error handler global di bagian paling akhir
app.use(errorHandler);

module.exports = app;
