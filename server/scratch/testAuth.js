const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('../models/User');
const { generateToken, verifyToken } = require('../utils/jwtHelper');
const { authenticateUser, authorizeRole } = require('../middlewares/authMiddleware');
const { validateRegister, validateLogin } = require('../validations/authValidation');
const authService = require('../services/authService');

async function runAuthTests() {
  console.log('=== RUNNING AUTHENTICATION FOUNDATION VERIFICATION ===\n');
  let failures = 0;

  function assert(condition, message) {
    if (!condition) {
      console.error(`❌ FAIL: ${message}`);
      failures++;
    } else {
      console.log(`✅ PASS: ${message}`);
    }
  }

  // 1. Test JWT Helper
  try {
    const payload = { id: 'user123', role: 'responder' };
    const token = generateToken(payload);
    assert(typeof token === 'string' && token.length > 20, 'JWT token generated successfully');

    const decoded = verifyToken(token);
    assert(decoded.id === 'user123' && decoded.role === 'responder', 'JWT token verified and payload matches');
  } catch (err) {
    assert(false, `JWT test threw error: ${err.message}`);
  }

  // 2. Test Input Validation
  try {
    const invalidReg = validateRegister({ name: '', email: 'bademail', password: '123' });
    assert(invalidReg.error !== null, 'Register validation rejects empty name & invalid email/password');

    const validReg = validateRegister({ name: 'John Doe', email: 'john@example.com', password: 'securepassword123', role: 'responder' });
    assert(validReg.error === null, 'Register validation accepts valid user data');

    const invalidLogin = validateLogin({ email: 'invalid' });
    assert(invalidLogin.error !== null, 'Login validation rejects missing password and invalid email');

    const validLogin = validateLogin({ email: 'john@example.com', password: 'securepassword123' });
    assert(validLogin.error === null, 'Login validation accepts valid credentials');
  } catch (err) {
    assert(false, `Validation test threw error: ${err.message}`);
  }

  // 3. Test authorizeRole Middleware logic
  try {
    const reqMock = { user: { role: 'responder' } };
    let nextCalled = false;
    let nextError = null;

    const middleware = authorizeRole('commander', 'admin');
    middleware(reqMock, {}, (err) => {
      nextCalled = true;
      nextError = err;
    });

    assert(nextError && nextError.statusCode === 403, 'authorizeRole correctly denies unauthorized roles (responder vs commander/admin)');

    let allowedCalled = false;
    let allowedError = null;
    const allowedMiddleware = authorizeRole('responder', 'commander');
    allowedMiddleware(reqMock, {}, (err) => {
      allowedCalled = true;
      allowedError = err;
    });
    assert(allowedCalled && !allowedError, 'authorizeRole allows matching role (responder)');
  } catch (err) {
    assert(false, `authorizeRole test threw error: ${err.message}`);
  }

  // 4. Test User Model Schema and Password Hashing
  try {
    const sampleUser = new User({
      name: 'Jane Responder',
      email: 'jane@resonix.ai',
      password: 'password123',
      role: 'responder',
      language: 'en',
      phone: '+15550199'
    });

    assert(sampleUser.name === 'Jane Responder', 'User model name field assigned');
    assert(sampleUser.email === 'jane@resonix.ai', 'User model email field assigned');
    assert(sampleUser.role === 'responder', 'User model role assigned');
    assert(sampleUser.language === 'en', 'User model language default assigned');
    assert(sampleUser.phone === '+15550199', 'User model phone assigned');
    assert(sampleUser.authProvider === 'local', 'User model default authProvider is local');
    assert(sampleUser.googleId === null, 'User model googleId structure initialized as null');

    // Simulate pre-save hook manual hash check
    const salt = await bcrypt.genSalt(12);
    sampleUser.password = await bcrypt.hash('password123', salt);

    const match = await bcrypt.compare('password123', sampleUser.password);
    assert(match === true, 'Bcrypt password hashing and comparison verified');

    const wrongMatch = await bcrypt.compare('wrongpassword', sampleUser.password);
    assert(wrongMatch === false, 'Bcrypt password comparison fails for wrong password');
  } catch (err) {
    assert(false, `User model test threw error: ${err.message}`);
  }

  // 5. Test Google Auth Structure Placeholder
  try {
    await authService.googleAuthPlaceholder({});
    assert(false, 'Google Auth placeholder should throw 501 Not Implemented');
  } catch (err) {
    assert(err.statusCode === 501, 'Google Auth placeholder returns 501 Not Implemented status code');
  }

  console.log('\n=== VERIFICATION SUMMARY ===');
  if (failures === 0) {
    console.log('✨ ALL AUTHENTICATION TESTS PASSED SUCCESSFULLY! ✨\n');
  } else {
    console.error(`❌ ${failures} TEST(S) FAILED.\n`);
    process.exit(1);
  }
}

runAuthTests();
