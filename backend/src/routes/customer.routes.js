const express = require('express');
const customerController = require('../controllers/customer.controller');
const { requireAuth } = require('../middleware/auth.middleware');

const router = express.Router();

// All customer routes require a verified JWT and are isolated to req.user.id
router.use(requireAuth);

router.get('/', customerController.list);
router.get('/:id', customerController.getOne);
router.post('/', customerController.create);
router.put('/:id', customerController.update);
router.delete('/:id', customerController.remove);

module.exports = router;

