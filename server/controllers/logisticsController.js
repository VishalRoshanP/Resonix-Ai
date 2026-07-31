const logisticsService = require('../services/logisticsService');
const ApiResponse = require('../utils/apiResponse');

const getLogistics = async (req, res, next) => {
  try {
    const records = await logisticsService.getAllLogistics(req.query);
    return ApiResponse.success(res, 200, 'Logistics records retrieved', { logistics: records });
  } catch (error) {
    next(error);
  }
};

const createDispatch = async (req, res, next) => {
  try {
    const dispatch = await logisticsService.createDispatch(req.body);
    return ApiResponse.success(res, 201, 'Dispatch created', { dispatch });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getLogistics,
  createDispatch,
};
