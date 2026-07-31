const Logistics = require('../models/Logistics');

const getAllLogistics = async (filters = {}) => {
  return await Logistics.find(filters).sort({ createdAt: -1 });
};

const createDispatch = async (dispatchData) => {
  return await Logistics.create(dispatchData);
};

module.exports = {
  getAllLogistics,
  createDispatch,
};
