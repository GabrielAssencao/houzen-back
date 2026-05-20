const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');

const app = express();

// Definição da porta: O Render define a porta via variável de ambiente, 
// se não existir, usa 5000 para local.
const PORT = process.env.PORT || 5000;

// Configuração do CORS: 
// Em produção, é ideal permitir apenas o domínio da sua Vercel.
app.use(cors({
  origin: '*', // Você pode substituir '*' pelo domínio da sua Vercel para maior segurança
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'usuario-id'] // Adicionamos 'usuario-id' aqui!
}));

app.use(express.json());

// Rota de teste simples para verificar se o servidor está vivo no navegador
app.get('/', (req, res) => {
  res.send('Servidor Houzen Online!');
});

app.use('/api/auth', authRoutes);

app.listen(PORT, () => {
  console.log(`🚀 Servidor Houzen rodando na porta ${PORT}`);
});