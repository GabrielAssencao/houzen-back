// src/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// ========================================================
// Rotas de Autenticação / Landing Page Pública
// ========================================================
router.post('/usuarios/registrar_teste', authController.registrarUsuarioTeste);
router.post('/forgot-password', authController.forgotPassword);
router.put('/reset-password', authController.resetPassword); // <-- ROTA DE NOVA SENHA ADICIONADA AQUI

// Rota de Login
router.post('/login', authController.login);


// ========================================================
// Rotas do Painel Geral (Dashboard)
// ========================================================
router.get('/dashboard/resumo', authController.getDashboardResumo);


// ========================================================
// Rotas do Módulo de Recursos Humanos (RH)
// ========================================================
router.get('/rh/funcionarios', authController.getFuncionarios);
router.post('/rh/funcionarios', authController.criarFuncionario);
router.put('/rh/funcionarios/:id', authController.editarFuncionario);
router.delete('/rh/funcionarios/:id', authController.deletarFuncionario);


// ========================================================
// Endpoints de Suprimentos & Sedes
// ========================================================
router.get('/suprimentos', authController.getSuprimentos);
router.post('/suprimentos', authController.criarSuprimento);
router.put('/suprimentos/:id', authController.editarSuprimento);
router.delete('/suprimentos/:id', authController.deletarSuprimento);
router.get('/sedes', authController.getSedes);
router.post('/sedes', authController.criarSede);


// ========================================================
// Rotas do Módulo de Frota
// ========================================================
router.get('/frota', authController.getFrota);
router.post('/frota', authController.criarFrota);
router.put('/frota/:id', authController.editarFrota);       
router.delete('/frota/:id', authController.deletarFrota);


// ========================================================
// Rotas do Módulo de Cronograma
// ========================================================
router.get('/cronograma', authController.getCronograma);
router.post('/cronograma', authController.criarCronograma);                   
router.put('/cronograma/:id', authController.atualizarStatusCronograma);       
router.delete('/cronograma/:id', authController.deletarCronograma);


// ========================================================
// Rotas do Módulo de Obras
// ========================================================
router.get('/obras', authController.getObras);
router.post('/obras', authController.criarObra);
router.put('/obras/:id', authController.editarObra);
router.delete('/obras/:id', authController.deletarObra);

// Rotas do Super Admin
router.get('/admin/usuarios', authController.listarUsuariosAdmin);
router.post('/admin/usuarios', authController.criarUsuarioEmpresa);
router.put('/admin/usuarios/:id', authController.atualizarAcessoUsuario);
router.delete('/admin/usuarios/:id', authController.excluirUsuario);

module.exports = router;