// config/cors.js

module.exports = {
  origin: [
    'http://localhost:3000',
    'https://toafl.maulanasopian.my.id'
  ],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};