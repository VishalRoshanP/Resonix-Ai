const express = require('express');
const router = express.Router();
const resourceController = require('../controllers/resourceController');
const validate = require('../middlewares/validationMiddleware');
const { authorizeResponder } = require('../middlewares/authMiddleware');
const {
  validateCreateResource,
  validateUpdateResource,
  validateAssignResource,
} = require('../validations/resourceValidation');

// Resource Collection Operations
router.get('/', resourceController.getResources);
router.post('/', authorizeResponder, validate(validateCreateResource), resourceController.createResource);

// Resource Assignment & Tactical Dispatch Operations
router.post('/assign', authorizeResponder, validate(validateAssignResource), resourceController.assignResource);
router.post('/release', authorizeResponder, resourceController.releaseResource);

// Single Resource Operations
router.get('/:id', resourceController.getResourceById);
router.put('/:id', authorizeResponder, validate(validateUpdateResource), resourceController.updateResource);
router.post('/:id/assign', authorizeResponder, validate(validateAssignResource), resourceController.assignResource);
router.post('/:id/release', authorizeResponder, resourceController.releaseResource);
router.delete('/:id', authorizeResponder, resourceController.deleteResource);

module.exports = router;

