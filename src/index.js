const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
// Importante: certifique-se de importar o arquivo onde estão as rotas de resumo, obras, etc.
// Se elas estiverem no mesmo authRoutes, você precisa movê-las para um novo arquivo 'appRoutes.js'
const appRoutes = require('./routes/appRoutes'); 

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'usuario-id']
}));

app.use(express.json());

app.get('/', (req, res) => {
  res.send('Servidor Houzen Online!');
});

// AQUI ESTÁ A MÁGICA:
// 1. Rotas de autenticação mantêm o prefixo
app.use('/api/auth', authRoutes);

// 2. Rotas de dados (dashboard, obras, etc) ficam na raiz da API
// Isso permite chamadas como /dashboard/resumo ou /obras
app.use('/', appRoutes);

app.listen(PORT, () => {
  console.log(`🚀 Servidor Houzen rodando na porta ${PORT}`);
});