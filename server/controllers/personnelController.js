const personnelService = require('../services/personnelService');
const ApiResponse = require('../utils/apiResponse');

const getPersonnel = async (req, res, next) => {
  try {
    const personnel = await personnelService.getAllPersonnel(req.query);
    return ApiResponse.success(res, 200, 'Personnel list retrieved', { personnel });
  } catch (error) {
    next(error);
  }
};

const getPersonnelById = async (req, res, next) => {
  try {
    const member = await personnelService.getPersonnelById(req.params.id);
    if (!member) return ApiResponse.error(res, 404, 'Personnel member not found');
    return ApiResponse.success(res, 200, 'Personnel member details', { personnel: member });
  } catch (error) {
    next(error);
  }
};

const updateBiometrics = async (req, res, next) => {
  try {
    const updated = await personnelService.updateBiometrics(req.params.id, req.body);
    return ApiResponse.success(res, 200, 'Biometrics updated', { personnel: updated });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPersonnel,
  getPersonnelById,
  updateBiometrics,
};
