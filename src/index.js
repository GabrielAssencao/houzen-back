const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes'); // Seu arquivo com todas as rotas

const app = express();
const PORT = process.env.PORT || 5000;

// Configuração do CORS permitindo o Header usuario-id
app.use(cors({
  origin: '*', 
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'usuario-id'] 
}));

app.use(express.json());

// Rota de teste simples
app.get('/', (req, res) => {
  res.send('Servidor Houzen Online!');
});

// Vincula todas as rotas do sistema ao prefixo /api/auth
app.use('/api/auth', authRoutes);

app.listen(PORT, () => {
  console.log(`🚀 Servidor Houzen rodando na porta ${PORT}`);
});