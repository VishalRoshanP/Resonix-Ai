/**
 * Error Handling Utility for RESONIX AI Citizen Mobile (React Native)
 * 
 * Standardizes API, network, and submission errors into clean user messages.
 */

const errorHandler = {
  /**
   * Formats error object into user-friendly message string
   */
  formatError: (error) => {
    if (!error) return 'An unexpected error occurred.';
    
    if (typeof error === 'string') return error;

    if (error.response && error.response.data) {
      const data = error.response.data;
      if (data.message) return data.message;
      if (data.error) return typeof data.error === 'string' ? data.error : data.error.message || 'Server returned an error.';
    }

    if (error.message) {
      if (error.message.includes('Network Error') || error.message.includes('Failed to fetch') || error.message.includes('Network request failed')) {
        return 'Network connection unavailable. Emergency signal queued locally for auto-sync.';
      }
      if (error.message.includes('timeout')) {
        return 'Connection timed out. Retrying request...';
      }
      return error.message;
    }

    return 'Unable to process request. Please check connection and try again.';
  },
};

module.exports = errorHandler;
