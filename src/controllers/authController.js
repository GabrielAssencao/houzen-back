// src/controllers/authController.js
const db = require('../config/db');
const nodemailer = require('nodemailer');
const dns = require('dns');
const { promisify } = require('util');

const resolveMx = promisify(dns.resolveMx);

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// ========================================================
// 0. AUTENTICAÇÃO (Login, Cadastro e Recuperação)
// ========================================================

const registrarUsuarioTeste = async (req, res) => {
  const { nome, email, senha, nivel } = req.body;
  if (!nome || !email || !senha) return res.status(400).json({ error: 'Preencha todos os dados essenciais!' });

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'O formato do e-mail digitado é inválido.' });
  }

  try {
    const querySQL = 'INSERT INTO usuarios (nome, email, senha, nivel) VALUES (?, ?, ?, ?)';
    await db.query(querySQL, [nome, email, senha, nivel || 'comum']);
    res.status(201).json({ message: 'Ambiente de testes liberado para o usuário!' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(400).json({ error: 'Este e-mail já está registrado em nossa plataforma.' });
    } else {
      res.status(500).json({ error: 'Erro de banco.', detalhe: error.message });
    }
  }
};

const forgotPassword = async (req, res) => {
  const { email } = req.body;
  try {
    const [rows] = await db.query('SELECT id, nome FROM usuarios WHERE email = ? LIMIT 1', [email]);
    if (rows.length === 0) return res.status(404).json({ error: 'E-mail não localizado.' });

    const usuario = rows[0];
    const linkRedefinicao = `http://localhost:5173/reset-password?id=${usuario.id}`;

    const mailOptions = {
      from: `"Houzen Engenharia" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Redefinição de Credenciais - Sistema Houzen',
      html: `
        <div style="font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #09090B; color: #FFFFFF; padding: 40px 20px; text-align: center;">
          <div style="max-width: 500px; margin: 0 auto; background-color: #151518; border: 1px solid rgba(255,255,255,0.05); padding: 30px; border-radius: 16px; text-align: left;">
            <div style="display: inline-block; background-color: #F97316; padding: 10px; border-radius: 8px; margin-bottom: 20px;">
              <span style="color: #000000; font-weight: bold; font-size: 18px;">🏗️</span>
            </div>
            <h2 style="color: #FFFFFF; font-size: 24px; font-weight: bold; margin-top: 0; margin-bottom: 8px; letter-spacing: -0.5px;">Olá, ${usuario.nome}!</h2>
            <p style="color: #A1A1AA; font-size: 15px; line-height: 1.6; margin-bottom: 24px;">
              Uma solicitação de redefinição de senha foi efetuada para a sua conta na plataforma <strong>Houzen</strong>. 
            </p>
            <div style="text-align: center; margin-bottom: 28px;">
              <a href="${linkRedefinicao}" target="_blank" style="display: inline-block; background-color: #F97316; color: #000000; font-weight: bold; font-size: 15px; text-decoration: none; padding: 12px 32px; border-radius: 10px; box-shadow: 0 4px 15px rgba(249, 115, 22, 0.25);">
                Redefinir Minha Senha
              </a>
            </div>
          </div>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    res.json({ message: 'Instruções enviadas com sucesso para a sua caixa de entrada!' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao processar o envio de e-mail.', detalhe: error.message });
  }
};

const login = async (req, res) => {
  const { email, senha } = req.body;
  if (!email || !senha) return res.status(400).json({ message: 'E-mail e senha são obrigatórios.' });

  try {
    // 1. A Busca agora inclui 'status' e 'permissoes'
    const [rows] = await db.query('SELECT id, nome, email, senha, nivel, status, permissoes FROM usuarios WHERE email = ? LIMIT 1', [email]);
    
    if (rows.length === 0 || senha !== rows[0].senha) return res.status(401).json({ message: 'Credenciais incorretas.' });

    // 2. Bloqueio de Usuários Inativos/Inadimplentes
    const statusConta = rows[0].status ? rows[0].status.toLowerCase().trim() : 'ativo';
    if (statusConta !== 'ativo') {
      return res.status(403).json({ message: 'Sua conta está suspensa ou inativa. Entre em contato com o suporte.' });
    }

    // 3. Normalização do nível
    const nivelRaw = rows[0].nivel || 'comum';
    const nivelNormalizado = (nivelRaw.toLowerCase().trim() === 'administrador' || nivelRaw.toLowerCase().trim() === 'admin') 
      ? 'admin' 
      : nivelRaw.toLowerCase().trim();

    // 4. Tratamento do array de permissões para o React ler corretamente
    let permissoesArray = [];
    if (rows[0].permissoes) {
      try {
        permissoesArray = typeof rows[0].permissoes === 'string' ? JSON.parse(rows[0].permissoes) : rows[0].permissoes;
      } catch(e) {
        permissoesArray = [];
      }
    }

    // 5. Resposta completa com as permissões
    res.json({ 
      id: rows[0].id, 
      nome: rows[0].nome, 
      email: rows[0].email, 
      nivel: nivelNormalizado,
      permissoes: permissoesArray
    });
  } catch (error) {
    res.status(500).json({ message: 'Erro no login.', detalhe: error.message });
  }
};

const resetPassword = async (req, res) => {
  const { id, novaSenha } = req.body;
  if (!id || !novaSenha) return res.status(400).json({ error: 'ID do usuário e nova senha são obrigatórios.' });

  try {
    const [result] = await db.query('UPDATE usuarios SET senha = ? WHERE id = ?', [novaSenha, id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Usuário não encontrado ou link expirado.' });
    res.json({ message: 'Senha atualizada com sucesso!' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao redefinir a senha.', detalhe: error.message });
  }
};

const getUsuarioId = (req) => req.headers['usuario-id'];

// ========================================================
// 1. PAINEL GERAL & OBRAS
// ========================================================

const getDashboardResumo = async (req, res) => {
  const usuario_id = getUsuarioId(req);
  if (!usuario_id) return res.status(401).json({ error: 'Acesso negado.' });
  try {
    const [financeiro] = await db.query('SELECT SUM(receitas) AS receitas, SUM(despesas) AS despesas FROM obras WHERE usuario_id = ?', [usuario_id]);
    const [statusObras] = await db.query("SELECT COUNT(CASE WHEN status = 'Em Andamento' THEN 1 END) AS em_andamento, COUNT(CASE WHEN status = 'Finalizada' THEN 1 END) AS finalizadas FROM obras WHERE usuario_id = ?", [usuario_id]);
    const [funcs] = await db.query('SELECT COUNT(f.id) AS total FROM funcionarios f JOIN obras o ON f.obra_id = o.id WHERE o.usuario_id = ?', [usuario_id]);
    const [equips] = await db.query('SELECT COUNT(f.id) AS total FROM frota f JOIN obras o ON f.obra_id = o.id WHERE o.usuario_id = ?', [usuario_id]);
    const [listaObras] = await db.query('SELECT id, nome, status, receitas, despesas, (receitas - despesas) AS lucro FROM obras WHERE usuario_id = ?', [usuario_id]);

    res.json({
      despesas: financeiro[0].despesas || 0, receitas: financeiro[0].receitas || 0,
      obras_andamento: statusObras[0].em_andamento || 0, obras_finalizadas: statusObras[0].finalizadas || 0,
      funcionarios: funcs[0].total || 0, equipamentos: equips[0].total || 0, lista_obras: listaObras
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro no dashboard', detalhe: error.message });
  }
};

const getObras = async (req, res) => {
  const usuario_id = getUsuarioId(req);
  try {
    const [rows] = await db.query('SELECT * FROM obras WHERE usuario_id = ?', [usuario_id]);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao listar obras', detalhe: error.message });
  }
};

const criarObra = async (req, res) => {
  const usuario_id = getUsuarioId(req);
  const { nome, receitas, despesas, status } = req.body;
  try {
    const [result] = await db.query('INSERT INTO obras (nome, receitas, despesas, status, usuario_id) VALUES (?, ?, ?, ?, ?)', [nome, receitas || 0, despesas || 0, status || 'Em Andamento', usuario_id]);
    res.status(201).json({ id: result.insertId });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao cadastrar obra', detalhe: error.message });
  }
};

const deletarObra = async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM obras WHERE id = ?', [id]);
    res.json({ message: 'Obra excluída!' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao excluir', detalhe: error.message });
  }
};

const editarObra = async (req, res) => {
  const { id } = req.params;
  const { nome, receitas, despesas, status } = req.body;
  try {
    await db.query('UPDATE obras SET nome = ?, receitas = ?, despesas = ?, status = ? WHERE id = ?', [nome, receitas || 0, despesas || 0, status, id]);
    res.json({ id, nome, receitas, despesas, status });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao editar', detalhe: error.message });
  }
};

// ========================================================
// 2. RECURSOS HUMANOS, SUPRIMENTOS, FROTA, CRONOGRAMA, ADMIN
// ========================================================

const getFuncionarios = async (req, res) => {
    const usuario_id = getUsuarioId(req);
    try {
      const querySQL = `SELECT f.*, o.nome AS obra_nome, o.status AS obra_status FROM funcionarios f JOIN obras o ON f.obra_id = o.id WHERE o.usuario_id = ?`;
      const [rows] = await db.query(querySQL, [usuario_id]);
      res.json(rows);
    } catch (error) { res.status(500).json({ error: 'Erro de RH', detalhe: error.message }); }
};

const criarFuncionario = async (req, res) => {
    const { nome, cargo, departamento, horas, salario, status, obra_id } = req.body;
    try {
      const [result] = await db.query('INSERT INTO funcionarios (nome, cargo, departamento, horas, salario, status, obra_id) VALUES (?, ?, ?, ?, ?, ?, ?)', [nome, cargo, departamento, horas, salario, status, obra_id]);
      res.status(201).json({ id: result.insertId });
    } catch (error) { res.status(500).json({ error: 'Erro ao salvar funcionário', detalhe: error.message }); }
};

const editarFuncionario = async (req, res) => {
    const { id } = req.params;
    const { nome, cargo, departamento, horas, salario, status, obra_id } = req.body;
    try {
      await db.query('UPDATE funcionarios SET nome=?, cargo=?, departamento=?, horas=?, salario=?, status=?, obra_id=? WHERE id=?', [nome, cargo, departamento, horas, salario, status, obra_id, id]);
      res.json({ id });
    } catch (error) { res.status(500).json({ error: 'Erro ao atualizar RH', detalhe: error.message }); }
};

const deletarFuncionario = async (req, res) => {
    try {
      await db.query('DELETE FROM funcionarios WHERE id = ?', [req.params.id]);
      res.json({ message: 'Funcionário removido!' });
    } catch (error) { res.status(500).json({ error: 'Erro ao deletar' }); }
};

const getSuprimentos = async (req, res) => {
    const usuario_id = getUsuarioId(req);
    try {
      const querySQL = `SELECT s.*, o.nome AS obra_nome, sd.nome AS sede_nome FROM suprimentos s LEFT JOIN obras o ON s.obra_id = o.id LEFT JOIN sedes sd ON s.sede_id = sd.id WHERE o.usuario_id = ? OR sd.usuario_id = ?`;
      const [rows] = await db.query(querySQL, [usuario_id, usuario_id]);
      res.json({ itens: rows, notificacoes: [] });
    } catch (error) { res.status(500).json({ error: 'Erro no estoque', detalhe: error.message }); }
};

const criarSuprimento = async (req, res) => {
    const { nome, categoria, qtd, preco, fornecedor, status, obra_id, sede_id } = req.body;
    try {
      const [result] = await db.query('INSERT INTO suprimentos (nome, categoria, qtd, preco, fornecedor, status, obra_id, sede_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [nome, categoria, qtd, preco, fornecedor, status, obra_id, sede_id]);
      res.status(201).json({ id: result.insertId });
    } catch (error) { res.status(500).json({ error: 'Erro insumo', detalhe: error.message }); }
};

const editarSuprimento = async (req, res) => {
    const { id } = req.params;
    const { nome, categoria, qtd, preco, fornecedor, status, obra_id, sede_id } = req.body;
    try {
      await db.query('UPDATE suprimentos SET nome=?, categoria=?, qtd=?, preco=?, fornecedor=?, status=?, obra_id=?, sede_id=? WHERE id=?', [nome, categoria, qtd, preco, fornecedor, status, obra_id, sede_id, id]);
      res.json({ id, message: 'Material atualizado!' });
    } catch (error) { res.status(500).json({ error: 'Erro ao atualizar', detalhe: error.message }); }
};

const deletarSuprimento = async (req, res) => {
    try {
      await db.query('DELETE FROM suprimentos WHERE id = ?', [req.params.id]);
      res.json({ message: 'Removido!' });
    } catch (error) { res.status(500).json({ error: 'Erro ao deletar' }); }
};

const getSedes = async (req, res) => {
    const usuario_id = getUsuarioId(req);
    try {
      const [rows] = await db.query('SELECT * FROM sedes WHERE usuario_id = ?', [usuario_id]);
      res.json(rows);
    } catch (error) { res.status(500).json({ error: 'Erro nas sedes', detalhe: error.message }); }
};

const criarSede = async (req, res) => {
    const usuario_id = getUsuarioId(req);
    try {
      const [result] = await db.query('INSERT INTO sedes (nome, usuario_id) VALUES (?, ?)', [req.body.nome, usuario_id]);
      res.status(201).json({ id: result.insertId });
    } catch (error) { res.status(500).json({ error: 'Erro ao salvar sede' }); }
};

const getFrota = async (req, res) => {
    const usuario_id = getUsuarioId(req);
    try {
      const querySQL = `SELECT f.*, o.nome AS obra_nome, s.nome AS sede_nome FROM frota f LEFT JOIN obras o ON f.obra_id = o.id LEFT JOIN sedes s ON f.sede_id = s.id WHERE o.usuario_id = ? OR s.usuario_id = ?`;
      const [rows] = await db.query(querySQL, [usuario_id, usuario_id]);
      res.json(rows);
    } catch (error) { res.status(500).json({ error: 'Erro na frota', detalhe: error.message }); }
};

const criarFrota = async (req, res) => {
    const { nome, tipo, codigo, operador, manutencao, status, obra_id, sede_id } = req.body;
    try {
      const [result] = await db.query('INSERT INTO frota (nome, tipo, codigo, operador, manutencao, status, obra_id, sede_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [nome, tipo, codigo, operador, manutencao, status, obra_id, sede_id]);
      res.status(201).json({ id: result.insertId });
    } catch (error) { res.status(500).json({ error: 'Erro frota' }); }
};

const editarFrota = async (req, res) => {
    const { id } = req.params;
    const { nome, tipo, codigo, operador, manutencao, status, obra_id, sede_id } = req.body;
    try {
      await db.query('UPDATE frota SET nome=?, tipo=?, codigo=?, operador=?, manutencao=?, status=?, obra_id=?, sede_id=? WHERE id=?', [nome, tipo, codigo, operador, manutencao, status, obra_id, sede_id, id]);
      res.json({ id });
    } catch (error) { res.status(500).json({ error: 'Erro ao atualizar frota' }); }
};

const deletarFrota = async (req, res) => {
    try {
      await db.query('DELETE FROM frota WHERE id = ?', [req.params.id]);
      res.json({ message: 'Baixa!' });
    } catch (error) { res.status(500).json({ error: 'Erro' }); }
};

const getCronograma = async (req, res) => {
    const usuario_id = getUsuarioId(req);
    try {
      const [rows] = await db.query('SELECT c.* FROM cronograma c JOIN obras o ON c.obra_id = o.id WHERE o.usuario_id = ? ORDER BY c.ordem ASC', [usuario_id]);
      res.json(rows);
    } catch (error) { res.status(500).json({ error: 'Erro cronograma' }); }
};

const criarCronograma = async (req, res) => {
    const { fase, descricao, prazo, status, ordem, obra_id } = req.body;
    try {
      const [result] = await db.query('INSERT INTO cronograma (fase, descricao, prazo, status, ordem, obra_id) VALUES (?, ?, ?, ?, ?, ?)', [fase, descricao, prazo, status, ordem, obra_id]);
      res.status(201).json({ id: result.insertId });
    } catch (error) { res.status(500).json({ error: 'Erro cronograma' }); }
};

const atualizarStatusCronograma = async (req, res) => {
    try {
      await db.query('UPDATE cronograma SET status = ? WHERE id = ?', [req.body.status, req.params.id]);
      res.json({ message: 'Status atualizado' });
    } catch (error) { res.status(500).json({ error: 'Erro status' }); }
};

const deletarCronograma = async (req, res) => {
    try {
      await db.query('DELETE FROM cronograma WHERE id = ?', [req.params.id]);
      res.json({ message: 'Etapa deletada' });
    } catch (error) { res.status(500).json({ error: 'Erro' }); }
};

const listarUsuariosAdmin = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT id, nome, email, nivel, status, permissoes FROM usuarios ORDER BY id DESC');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao listar usuários' });
  }
};

const criarUsuarioEmpresa = async (req, res) => {
  const { nome, email, senha, nivel, status, permissoes } = req.body;
  try {
    const querySQL = 'INSERT INTO usuarios (nome, email, senha, nivel, status, permissoes) VALUES (?, ?, ?, ?, ?, ?)';
    await db.query(querySQL, [nome, email, senha, nivel || 'empresa', status || 'ativo', JSON.stringify(permissoes)]);
    res.status(201).json({ message: 'Empresa cadastrada!' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao criar empresa' });
  }
};

const atualizarAcessoUsuario = async (req, res) => {
  const { id } = req.params;
  const { nivel, status, permissoes } = req.body;
  try {
    await db.query('UPDATE usuarios SET nivel = ?, status = ?, permissoes = ? WHERE id = ?', [nivel, status, JSON.stringify(permissoes), id]);
    res.json({ message: 'Acessos atualizados!' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar acessos' });
  }
};

const excluirUsuario = async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM usuarios WHERE id = ?', [id]);
    res.json({ message: 'Removido com sucesso!' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao excluir' });
  }
};

module.exports = {
  forgotPassword,
  registrarUsuarioTeste,
  login,
  resetPassword,
  getDashboardResumo,
  getObras,
  criarObra,
  editarObra,
  deletarObra,
  getFuncionarios,
  criarFuncionario,
  editarFuncionario,
  deletarFuncionario,
  getSuprimentos,
  criarSuprimento,
  editarSuprimento,
  deletarSuprimento, 
  getSedes,
  criarSede,
  getFrota,
  criarFrota,
  editarFrota,
  deletarFrota,
  getCronograma,
  criarCronograma,
  atualizarStatusCronograma,
  deletarCronograma,
  listarUsuariosAdmin,
  criarUsuarioEmpresa,
  atualizarAcessoUsuario,
  excluirUsuario
};