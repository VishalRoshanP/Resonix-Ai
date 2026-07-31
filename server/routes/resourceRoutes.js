const express = require('express');
const router = express.Router();
const resourceController = require('../controllers/resourceController');
const validate = require('../middlewares/validationMiddleware');
const { validateCreateResource, validateUpdateResource } = require('../validations/resourceValidation');

router.get('/', resourceController.getResources);
router.get('/:id', resourceController.getResourceById);
router.post('/', validate(validateCreateResource), resourceController.createResource);
router.put('/:id', validate(validateUpdateResource), resourceController.updateResource);
router.delete('/:id', resourceController.deleteResource);

module.exports = router;
