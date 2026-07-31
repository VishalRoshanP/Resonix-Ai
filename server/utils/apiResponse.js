class ApiResponse {
  static success(res, statusCode = 200, message = 'Success', data = null) {
    return res.status(statusCode).json({
      status: 'success',
      message,
      data,
    });
  }

  static error(res, statusCode = 500, message = 'Internal Server Error', errors = null) {
    return res.status(statusCode).json({
      status: `${statusCode}`.startsWith('4') ? 'fail' : 'error',
      message,
      errors,
    });
  }
}

module.exports = ApiResponse;
