const Personnel = require('../models/Personnel');

const getAllPersonnel = async (filters = {}) => {
  return await Personnel.find(filters).sort({ name: 1 });
};

const getPersonnelById = async (id) => {
  return await Personnel.findById(id);
};

const updateBiometrics = async (id, biometrics) => {
  return await Personnel.findByIdAndUpdate(
    id,
    { biometrics, lastCheckIn: Date.now() },
    { new: true }
  );
};

module.exports = {
  getAllPersonnel,
  getPersonnelById,
  updateBiometrics,
};
