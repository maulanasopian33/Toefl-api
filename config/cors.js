// config/cors.js

const corsOptions = {
  // Ganti 'http://localhost:3000' dengan URL front-end Anda
  // Anda juga bisa memasukkan beberapa URL dalam array
  origin: ['http://localhost:3000','https://toafl.maulanasopian.my.idss'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};

module.exports = corsOptions;