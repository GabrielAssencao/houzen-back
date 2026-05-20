const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes'); 
const appRoutes = require('./routes/appRoutes'); // Certifique-se que o arquivo existe na pasta 'routes'

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE'], allowedHeaders: ['Content-Type', 'usuario-id'] }));
app.use(express.json());

// Rota de teste
app.get('/', (req, res) => { res.send('Servidor Houzen Online!'); });

// Rotas de Autenticação
app.use('/api/auth', authRoutes);

// Rotas de Dados (Atenção aqui: o prefixo é /api)
app.use('/api', appRoutes); 

app.listen(PORT, () => { console.log(`🚀 Servidor rodando na porta ${PORT}`); });