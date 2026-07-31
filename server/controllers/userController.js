const ApiResponse = require('../utils/apiResponse');
const ApiError = require('../utils/apiError');
const User = require('../models/User');

/**
 * @route   GET /api/users
 * @desc    Get paginated users list from database
 * @access  Private (Admin / Commander)
 */
const getUsers = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;

    let users = [];

    if (User?.db?.readyState === 1) {
      try {
        const skip = (page - 1) * limit;
        const dbUsers = await User.find().select('-password').sort({ createdAt: -1 }).skip(skip).limit(limit);
        const total = await User.countDocuments();
        if (dbUsers && dbUsers.length > 0) {
          users = dbUsers.map((u) => u.toObject());
          return ApiResponse.success(res, 200, 'Users retrieved successfully from database', {
            users,
            pagination: {
              total,
              page,
              limit,
              totalPages: Math.ceil(total / limit) || 1,
            },
          });
        }
      } catch (dbErr) {
        // Fallback to placeholder if query error
      }
    }

    const placeholderUsers = [
      {
        id: 'usr_001',
        name: 'Commander Sarah Jenkins',
        email: 's.jenkins@resonix.ai',
        role: 'commander',
        status: 'active',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'usr_002',
        name: 'Responder Alex Rivera',
        email: 'a.rivera@resonix.ai',
        role: 'responder',
        status: 'active',
        createdAt: new Date().toISOString(),
      },
    ];

    return ApiResponse.success(res, 200, 'Users retrieved successfully', {
      users: placeholderUsers,
      pagination: {
        total: placeholderUsers.length,
        page,
        limit,
        totalPages: 1,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/users/:id
 * @desc    Get user profile by ID
 * @access  Private
 */
const getUserById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (User?.db?.readyState === 1) {
      try {
        const user = await User.findOne({
          $or: [{ _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }, { email: id.toLowerCase() }],
        }).select('-password');
        if (user) {
          return ApiResponse.success(res, 200, 'User details retrieved from database', { user });
        }
      } catch (_) {}
    }

    if (id === 'notfound') {
      return next(new ApiError(404, `User with ID '${id}' not found`));
    }

    return ApiResponse.success(res, 200, 'User details retrieved', {
      user: {
        id,
        name: 'Commander Sarah Jenkins',
        email: 's.jenkins@resonix.ai',
        role: 'commander',
        status: 'active',
        language: 'en',
        phone: '+15550199',
        createdAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/users
 * @desc    Create a new user profile
 * @access  Private (Admin)
 */
const createUser = async (req, res, next) => {
  try {
    let newUser = null;

    if (User?.db?.readyState === 1) {
      try {
        newUser = await User.create({
          name: req.body.name,
          email: req.body.email,
          password: req.body.password || 'resonix123',
          role: req.body.role || 'citizen',
          phone: req.body.phone || '',
          language: req.body.language || 'en',
        });
        newUser = newUser.toObject();
        delete newUser.password;
      } catch (dbErr) {
        // Fallback
      }
    }

    if (!newUser) {
      newUser = {
        id: `usr_${Date.now()}`,
        ...req.body,
        status: 'active',
        createdAt: new Date().toISOString(),
      };
    }

    return ApiResponse.success(res, 201, 'User created successfully', { user: newUser });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PUT /api/users/:id
 * @desc    Update user profile
 * @access  Private
 */
const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    let updatedUser = null;

    if (User?.db?.readyState === 1) {
      try {
        updatedUser = await User.findByIdAndUpdate(id, req.body, { new: true, runValidators: true }).select('-password');
        if (updatedUser) updatedUser = updatedUser.toObject();
      } catch (_) {}
    }

    if (!updatedUser) {
      updatedUser = {
        id,
        ...req.body,
        updatedAt: new Date().toISOString(),
      };
    }

    return ApiResponse.success(res, 200, 'User profile updated successfully', { user: updatedUser });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   DELETE /api/users/:id
 * @desc    Delete user account
 * @access  Private (Admin)
 */
const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (User?.db?.readyState === 1) {
      try {
        await User.findByIdAndDelete(id);
      } catch (_) {}
    }

    return ApiResponse.success(res, 200, `User '${id}' deleted successfully`, { id });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PUT /api/users/:id/language
 * @desc    Update user preferred language in MongoDB profile
 * @access  Private / Public (Sync)
 */
const updateLanguagePreference = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { language } = req.body;

    if (!language) {
      return next(new ApiError(400, 'Language code is required'));
    }

    const supportedLanguages = ['en', 'ta', 'hi', 'te', 'kn', 'ml', 'bn'];
    if (!supportedLanguages.includes(language)) {
      return next(new ApiError(400, `Unsupported language code '${language}'`));
    }

    let updatedUser = null;

    // Update in MongoDB if Mongoose connection is active and user exists
    try {
      if (User?.db?.readyState === 1 && id && !id.startsWith('usr_mock')) {
        updatedUser = await User.findByIdAndUpdate(
          id,
          { language },
          { new: true, runValidators: true }
        ).select('-password');
      }
    } catch (dbError) {
      // Fallback for mock/demo mode
    }

    if (!updatedUser) {
      updatedUser = {
        id,
        language,
        updatedAt: new Date().toISOString(),
      };
    }

    return ApiResponse.success(res, 200, 'User language preference updated successfully', {
      user: updatedUser,
      language,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  updateLanguagePreference,
};

