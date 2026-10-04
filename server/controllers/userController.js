const ApiResponse = require('../utils/apiResponse');
const ApiError = require('../utils/apiError');
const User = require('../models/User');
const logger = require('../utils/logger');

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
    let total = 0;

    if (User?.db?.readyState === 1) {
      try {
        const skip = (page - 1) * limit;
        const dbUsers = await User.find().select('-password').sort({ createdAt: -1 }).skip(skip).limit(limit);
        total = await User.countDocuments();
        if (dbUsers && dbUsers.length > 0) {
          users = dbUsers.map((u) => u.toObject());
        }
      } catch (dbErr) {
        logger.error(`[UserController] Failed to fetch users: ${dbErr.message}`);
      }
    }

    return ApiResponse.success(res, 200, 'Users retrieved successfully', {
      users,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
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

    return next(new ApiError(404, `User with ID '${id}' not found`));
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
        return next(dbErr);
      }
    }

    if (!newUser) {
      return next(new ApiError(500, 'Failed to create user account in database.'));
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
      } catch (dbErr) {
        return next(dbErr);
      }
    }

    if (!updatedUser) {
      return next(new ApiError(404, `User with ID '${id}' not found`));
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
      if (User?.db?.readyState === 1 && id) {
        updatedUser = await User.findByIdAndUpdate(
          id,
          { language },
          { new: true, runValidators: true }
        ).select('-password');
      }
    } catch (dbError) {
      logger.error(`[UserController] Failed to update language preference: ${dbError.message}`);
    }

    if (!updatedUser) {
      return next(new ApiError(404, `User with ID '${id}' not found`));
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

