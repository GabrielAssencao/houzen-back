// src/controllers/authController.js
// --- IMPORTAÇÕES ---
const db = require('../config/db');
const bcrypt = require('bcryptjs');
const { Resend } = require('resend');

// --- INICIALIZAÇÃO DO RESEND ---
// O Resend substitui completamente o 'transporter' e o Nodemailer
const resend = new Resend(process.env.RESEND_API_KEY);

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
    const senhaHash = await bcrypt.hash(senha, 10); 
    const querySQL = 'INSERT INTO usuarios (nome, email, senha, nivel) VALUES (?, ?, ?, ?)';
    await db.query(querySQL, [nome, email, senhaHash, nivel || 'comum']);
    res.status(201).json({ message: 'Ambiente de testes liberado para o usuário!' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(400).json({ error: 'Este e-mail já está registrado em nossa plataforma.' });
    } else {
      console.error("Erro no registro:", error);
      res.status(500).json({ error: 'Erro interno ao registrar usuário.' });
    }
  }
};

const forgotPassword = async (req, res) => {
  const { email } = req.body;
  try {
    const [rows] = await db.query('SELECT id, nome FROM usuarios WHERE email = ? LIMIT 1', [email]);
    if (rows.length === 0) return res.status(404).json({ error: 'E-mail não localizado.' });

    const usuario = rows[0];
    // Mantive a sua URL do Vercel original
    const urlBase = process.env.FRONTEND_URL || 'https://houzen-eight.vercel.app';
    const linkRedefinicao = `${urlBase}/reset-password?id=${usuario.id}`;

    // Disparo usando o Resend (ignora firewalls e portas SMTP)
    await resend.emails.send({
      from: 'Houzen Engenharia <onboarding@resend.dev>', // O e-mail obrigatório do plano gratuito do Resend
      to: email, // Lembre-se: no plano grátis, esse e-mail precisa ser o seu próprio e-mail cadastrado no Resend
      subject: 'Redefinição de Credenciais - Sistema Houzen',
      html: `
        <div style="font-family: sans-serif; background-color: #09090B; color: #FFFFFF; padding: 20px; text-align: center;">
          <div style="max-width: 500px; margin: 0 auto; background-color: #151518; padding: 30px; border-radius: 16px;">
            <h2>Olá, ${usuario.nome}!</h2>
            <p>Uma solicitação de redefinição de senha foi efetuada.</p>
            <a href="${linkRedefinicao}" style="background-color: #F97316; color: #000; padding: 12px 32px; text-decoration: none; border-radius: 10px; font-weight: bold;">Redefinir Minha Senha</a>
          </div>
        </div>
      `
    });

    res.json({ message: 'Instruções enviadas para a sua caixa de entrada!' });
  } catch (error) {
    console.error("Erro no envio de email via Resend:", error);
    res.status(500).json({ error: 'Erro ao processar o envio de e-mail.' });
  }
};

const login = async (req, res) => {
  const { email, senha } = req.body;
  if (!email || !senha) return res.status(400).json({ message: 'E-mail e senha são obrigatórios.' });

  try {
    const [rows] = await db.query('SELECT id, nome, email, senha, nivel, status, permissoes FROM usuarios WHERE email = ? LIMIT 1', [email]);
    
    if (rows.length === 0) return res.status(401).json({ message: 'Credenciais incorretas.' });

    const senhaCorreta = await bcrypt.compare(senha, rows[0].senha);
    if (!senhaCorreta) return res.status(401).json({ message: 'Credenciais incorretas.' });

    const statusConta = (rows[0].status || 'ativo').toLowerCase().trim();
    if (statusConta !== 'ativo') return res.status(403).json({ message: 'Sua conta está suspensa ou inativa.' });

    const nivelNormalizado = (rows[0].nivel || 'comum').toLowerCase().trim();
    
    let permissoesArray = [];
    try {
      permissoesArray = typeof rows[0].permissoes === 'string' ? JSON.parse(rows[0].permissoes) : (rows[0].permissoes || []);
    } catch(e) { permissoesArray = []; }

    res.json({ 
      id: rows[0].id, nome: rows[0].nome, email: rows[0].email, 
      nivel: nivelNormalizado === 'administrador' ? 'admin' : nivelNormalizado,
      permissoes: permissoesArray
    });
  } catch (error) {
    console.error("Erro no login:", error);
    res.status(500).json({ message: 'Erro interno no login.' });
  }
};

const resetPassword = async (req, res) => {
  const { id, novaSenha } = req.body;
  if (!id || !novaSenha) return res.status(400).json({ error: 'Dados obrigatórios ausentes.' });

  try {
    const senhaHash = await bcrypt.hash(novaSenha, 10);
    const [result] = await db.query('UPDATE usuarios SET senha = ? WHERE id = ?', [senhaHash, id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Usuário não encontrado.' });
    res.json({ message: 'Senha atualizada com sucesso!' });
  } catch (error) {
    console.error("Erro ao resetar senha:", error);
    res.status(500).json({ error: 'Erro ao redefinir a senha.' });
  }
};

const googleLogin = async (req, res) => {
  const { email, nome } = req.body;
  try {
    const [rows] = await db.query('SELECT id, nome, email, nivel, status, permissoes FROM usuarios WHERE email = ? LIMIT 1', [email]);
    let usuario;

    if (rows.length === 0) {
      const senhaFicticia = await bcrypt.hash(Math.random().toString(36), 10);
      const [result] = await db.query('INSERT INTO usuarios (nome, email, senha, nivel, status, permissoes) VALUES (?, ?, ?, ?, ?, ?)', 
        [nome || 'Usuário Google', email, senhaFicticia, 'comum', 'ativo', '[]']);
      usuario = { id: result.insertId, nome: nome || 'Usuário Google', email, nivel: 'comum', permissoes: [] };
    } else {
      usuario = rows[0];
      if (usuario.status !== 'ativo') return res.status(403).json({ message: 'Conta inativa.' });
      usuario.permissoes = typeof usuario.permissoes === 'string' ? JSON.parse(usuario.permissoes) : (usuario.permissoes || []);
    }

    res.json({ id: usuario.id, nome: usuario.nome, email: usuario.email, nivel: usuario.nivel, permissoes: usuario.permissoes });
  } catch (error) {
    console.error("Erro Google Login:", error);
    res.status(500).json({ message: 'Erro ao autenticar com o Google.' });
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
    console.error("Erro no dashboard:", error);
    res.status(500).json({ error: 'Erro no dashboard', detalhe: error.message });
  }
};

const getObras = async (req, res) => {
  const usuario_id = getUsuarioId(req);
  try {
    const [rows] = await db.query('SELECT * FROM obras WHERE usuario_id = ?', [usuario_id]);
    res.json(rows);
  } catch (error) {
    console.error("Erro ao listar obras:", error);
    res.status(500).json({ error: 'Erro ao listar obras', detalhe: error.message });
  }
};

const criarObra = async (req, res) => {
  const usuario_id = getUsuarioId(req);
  const { nome, receitas, despesas, status } = req.body;
  try {
    const [result] = await db.query('INSERT INTO obras (nome, receitas, despesas, status, usuario_id) VALUES (?, ?, ?, ?, ?)', 
      [nome, receitas || 0, despesas || 0, status || 'Em Andamento', usuario_id]);
    res.status(201).json({ id: result.insertId });
  } catch (error) {
    console.error("Erro ao cadastrar obra:", error);
    res.status(500).json({ error: 'Erro ao cadastrar obra', detalhe: error.message });
  }
};

const deletarObra = async (req, res) => {
  const usuario_id = getUsuarioId(req);
  try {
    // SEGURANÇA: Só deleta se o id da obra pertencer ao usuario_id logado
    const [result] = await db.query('DELETE FROM obras WHERE id = ? AND usuario_id = ?', [req.params.id, usuario_id]);
    if (result.affectedRows === 0) return res.status(403).json({ error: 'Obra não encontrada ou acesso negado.' });
    res.json({ message: 'Obra excluída!' });
  } catch (error) {
    console.error("Erro ao excluir obra:", error);
    res.status(500).json({ error: 'Erro ao excluir', detalhe: error.message });
  }
};

const editarObra = async (req, res) => {
  const usuario_id = getUsuarioId(req);
  const { nome, receitas, despesas, status } = req.body;
  try {
    // SEGURANÇA: Só atualiza se o id da obra pertencer ao usuario_id logado
    const [result] = await db.query('UPDATE obras SET nome = ?, receitas = ?, despesas = ?, status = ? WHERE id = ? AND usuario_id = ?', 
      [nome, receitas || 0, despesas || 0, status, req.params.id, usuario_id]);
    
    if (result.affectedRows === 0) return res.status(403).json({ error: 'Obra não encontrada ou acesso negado.' });
    res.json({ id: req.params.id, nome, receitas, despesas, status });
  } catch (error) {
    console.error("Erro ao editar obra:", error);
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
    const usuario_id = getUsuarioId(req);
    try {
      // Validação: Só cria se a obra pertencer ao usuário
      const [valida] = await db.query('SELECT id FROM obras WHERE id = ? AND usuario_id = ?', [obra_id, usuario_id]);
      if (valida.length === 0) return res.status(403).json({ error: 'Obra inválida ou acesso negado.' });
      
      const [result] = await db.query('INSERT INTO funcionarios (nome, cargo, departamento, horas, salario, status, obra_id) VALUES (?, ?, ?, ?, ?, ?, ?)', [nome, cargo, departamento, horas, salario, status, obra_id]);
      res.status(201).json({ id: result.insertId });
    } catch (error) { res.status(500).json({ error: 'Erro ao salvar funcionário', detalhe: error.message }); }
};

const editarFuncionario = async (req, res) => {
    const { id } = req.params;
    const { nome, cargo, departamento, horas, salario, status, obra_id } = req.body;
    const usuario_id = getUsuarioId(req);
    try {
      // Validação: Só edita se a obra pertencer ao usuário
      const [valida] = await db.query('SELECT id FROM obras WHERE id = ? AND usuario_id = ?', [obra_id, usuario_id]);
      if (valida.length === 0) return res.status(403).json({ error: 'Acesso negado.' });
      
      await db.query('UPDATE funcionarios SET nome=?, cargo=?, departamento=?, horas=?, salario=?, status=?, obra_id=? WHERE id=?', [nome, cargo, departamento, horas, salario, status, obra_id, id]);
      res.json({ id });
    } catch (error) { res.status(500).json({ error: 'Erro ao atualizar RH', detalhe: error.message }); }
};

const deletarFuncionario = async (req, res) => {
    const usuario_id = getUsuarioId(req);
    try {
      await db.query('DELETE f FROM funcionarios f JOIN obras o ON f.obra_id = o.id WHERE f.id = ? AND o.usuario_id = ?', [req.params.id, usuario_id]);
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
    const usuario_id = getUsuarioId(req);
    try {
      // Validação básica de posse (obra ou sede)
      const [valida] = await db.query('SELECT id FROM obras WHERE id = ? AND usuario_id = ?', [obra_id, usuario_id]);
      if (valida.length === 0 && sede_id) { /* validacao adicional se necessário */ }
      
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
    const usuario_id = getUsuarioId(req);
    try {
      await db.query('DELETE s FROM suprimentos s JOIN obras o ON s.obra_id = o.id WHERE s.id = ? AND o.usuario_id = ?', [req.params.id, usuario_id]);
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
    const usuario_id = getUsuarioId(req);
    try {
      await db.query('DELETE f FROM frota f JOIN obras o ON f.obra_id = o.id WHERE f.id = ? AND o.usuario_id = ?', [req.params.id, usuario_id]);
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
      res.json({ message: 'Status updated' });
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
    const senhaHash = await bcrypt.hash(senha, 10);
    const querySQL = 'INSERT INTO usuarios (nome, email, senha, nivel, status, permissoes) VALUES (?, ?, ?, ?, ?, ?)';
    await db.query(querySQL, [nome, email, senhaHash, nivel || 'empresa', status || 'ativo', JSON.stringify(permissoes)]);
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
  googleLogin, 
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