// src/config/db.js
const mysql = require('mysql2/promise');
require('dotenv').config();

// Verifica se as variáveis estão carregando (isso aparecerá nos logs do Render)
console.log("Configurando conexão com host:", process.env.DB_HOST);

const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306, // Garante que use a porta correta
  ssl: {
    rejectUnauthorized: false // Essencial para o Railway
  },
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = db;