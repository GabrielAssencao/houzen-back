const express = require('express');
const router = express.Router();
const controller = require('../controllers/authController');

// Estas rotas agora serão acessadas via /dashboard/resumo, /obras, etc.
router.get('/dashboard/resumo', controller.getDashboardResumo);
router.get('/obras', controller.getObras);
router.get('/rh/funcionarios', controller.getFuncionarios);
router.get('/sedes', controller.getSedes);
router.get('/suprimentos', controller.getSuprimentos);
router.get('/frota', controller.getFrota);

module.exports = router;