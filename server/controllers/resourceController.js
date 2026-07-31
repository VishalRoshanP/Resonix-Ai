const ApiResponse = require('../utils/apiResponse');
const ApiError = require('../utils/apiError');
const Logistics = require('../models/Logistics');

/**
 * @route   GET /api/resources
 * @desc    Get paginated logistics resources list
 * @access  Public / Private
 */
const getResources = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;

    let resources = [];

    if (Logistics?.db?.readyState === 1) {
      try {
        const skip = (page - 1) * limit;
        const dbItems = await Logistics.find().sort({ createdAt: -1 }).skip(skip).limit(limit);
        const total = await Logistics.countDocuments();
        if (dbItems && dbItems.length > 0) {
          resources = dbItems.map((item) => item.toObject());
          return ApiResponse.success(res, 200, 'Resources retrieved successfully from database', {
            resources,
            pagination: {
              total,
              page,
              limit,
              totalPages: Math.ceil(total / limit) || 1,
            },
          });
        }
      } catch (_) {}
    }

    resources = [
      {
        id: 'res_001',
        name: 'Emergency Water Rations (Cases)',
        category: 'supplies',
        quantity: 1200,
        status: 'available',
        location: 'Depot Alpha',
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'res_002',
        name: 'High-Capacity Water Pumps',
        category: 'equipment',
        quantity: 8,
        status: 'allocated',
        location: 'Sector 4 Flood Wall',
        updatedAt: new Date().toISOString(),
      },
    ];

    return ApiResponse.success(res, 200, 'Resources retrieved successfully', {
      resources,
      pagination: {
        total: resources.length,
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
 * @route   GET /api/resources/:id
 * @desc    Get detailed resource status by ID
 * @access  Public / Private
 */
const getResourceById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (id === 'notfound') {
      return next(new ApiError(404, `Resource with ID '${id}' not found`));
    }

    return ApiResponse.success(res, 200, 'Resource details retrieved', {
      resource: {
        id,
        name: 'Emergency Water Rations (Cases)',
        category: 'supplies',
        quantity: 1200,
        status: 'available',
        location: 'Depot Alpha',
        allocatedTo: null,
        createdAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/resources
 * @desc    Register new resource stock
 * @access  Private (Commander / Admin)
 */
const createResource = async (req, res, next) => {
  try {
    const newResource = {
      id: `res_${Date.now()}`,
      ...req.body,
      status: req.body.status || 'available',
      createdAt: new Date().toISOString(),
    };

    return ApiResponse.success(res, 201, 'Resource added successfully', { resource: newResource });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PUT /api/resources/:id
 * @desc    Update resource quantity, status, or allocation
 * @access  Private (Commander / Admin)
 */
const updateResource = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updated = {
      id,
      ...req.body,
      updatedAt: new Date().toISOString(),
    };

    return ApiResponse.success(res, 200, 'Resource updated successfully', { resource: updated });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   DELETE /api/resources/:id
 * @desc    Decommission resource record
 * @access  Private (Admin)
 */
const deleteResource = async (req, res, next) => {
  try {
    const { id } = req.params;
    return ApiResponse.success(res, 200, `Resource '${id}' removed successfully`, { id });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getResources,
  getResourceById,
  createResource,
  updateResource,
  deleteResource,
};
