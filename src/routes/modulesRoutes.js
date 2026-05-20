// src/routes/modulesRoutes.js
const express = require('express');
const router = express.Router();
const modulesController = require('../controllers/modulesController');

// Endpoints consumidos pelo Axios no React
router.get('/dashboard/resumo', modulesController.getDashboardResumo);
router.get('/rh/funcionarios', modulesController.getFuncionarios);
router.get('/suprimentos', modulesController.getSuprimentos);
router.get('/frota', modulesController.getFrota);
router.get('/cronograma', modulesController.getCronograma);

module.exports = router;