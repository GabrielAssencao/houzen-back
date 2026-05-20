// src/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Autenticação
router.post('/usuarios/registrar_teste', authController.registrarUsuarioTeste);
router.post('/forgot-password', authController.forgotPassword);
router.put('/reset-password', authController.resetPassword);
router.post('/login', authController.login);
router.post('/google', authController.googleLogin);

// Dashboard
router.get('/dashboard/resumo', authController.getDashboardResumo);

// RH
router.get('/rh/funcionarios', authController.getFuncionarios);
router.post('/rh/funcionarios', authController.criarFuncionario);
router.put('/rh/funcionarios/:id', authController.editarFuncionario);
router.delete('/rh/funcionarios/:id', authController.deletarFuncionario);

// Suprimentos & Sedes
router.get('/suprimentos', authController.getSuprimentos);
router.post('/suprimentos', authController.criarSuprimento);
router.put('/suprimentos/:id', authController.editarSuprimento);
router.delete('/suprimentos/:id', authController.deletarSuprimento);
router.get('/sedes', authController.getSedes);
router.post('/sedes', authController.criarSede);

// Frota
router.get('/frota', authController.getFrota);
router.post('/frota', authController.criarFrota);
router.put('/frota/:id', authController.editarFrota);
router.delete('/frota/:id', authController.deletarFrota);

// Cronograma
router.get('/cronograma', authController.getCronograma);
router.post('/cronograma', authController.criarCronograma);
router.put('/cronograma/:id', authController.atualizarStatusCronograma);
router.delete('/cronograma/:id', authController.deletarCronograma);

// Obras
router.get('/obras', authController.getObras);
router.post('/obras', authController.criarObra);
router.put('/obras/:id', authController.editarObra);
router.delete('/obras/:id', authController.deletarObra);

// Admin
router.get('/admin/usuarios', authController.listarUsuariosAdmin);
router.post('/admin/usuarios', authController.criarUsuarioEmpresa);
router.put('/admin/usuarios/:id', authController.atualizarAcessoUsuario);
router.delete('/admin/usuarios/:id', authController.excluirUsuario);

module.exports = router;