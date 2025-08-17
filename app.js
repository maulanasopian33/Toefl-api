const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');

const indexRouter = require('./routes/index');
const usersRouter = require('./routes/users');
const authRouter = require('./routes/auth');
const detailUserRouter = require('./routes/detailUser');
const batchRouter = require('./routes/batchRoutes');
const app = express();
const cors = require('cors');
const corsOptions = require('./config/cors');
const errorHandler = require('./middlewares/errorHandler');


// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(cors(corsOptions));
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/auth', authRouter);
app.use('/user/detail', detailUserRouter);
app.use('/batch', batchRouter);

// Middleware untuk menangani route yang tidak ditemukan (404 Not Found)
app.use((req, res, next) => {
  const error = new Error('Not Found');
  error.status = 404;
  next(error);
});

// Daftarkan error handler global di bagian paling akhir
app.use(errorHandler);

module.exports = app;
