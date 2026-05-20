// src/index.js
const express = require('express');
const cors = require('cors');
require('dotenv').config();

// IMPORTANTE: Importamos APENAS as rotas de autenticação (onde juntamos tudo)
const authRoutes = require('./routes/authRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares Globais
app.use(cors());
app.use(express.json());

// Vincula todas as rotas do Houzen sob o prefixo /api/auth
app.use('/api/auth', authRoutes);

// Inicialização do Servidor Local
app.listen(PORT, () => {
  console.log(`🚀 Servidor Houzen rodando com sucesso na porta ${PORT}`);
  console.log(`🔒 Endpoints ativos em: http://localhost:${PORT}/api/auth`);
});