const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const validate = require('../middlewares/validationMiddleware');
const { validateCreateUser, validateUpdateUser } = require('../validations/userValidation');

router.get('/', userController.getUsers);
router.get('/:id', userController.getUserById);
router.post('/', validate(validateCreateUser), userController.createUser);
router.put('/:id', validate(validateUpdateUser), userController.updateUser);
router.put('/:id/language', userController.updateLanguagePreference);
router.delete('/:id', userController.deleteUser);

module.exports = router;
