class ToastService {
  constructor() {
    this.subscribers = [];
  }

  subscribe(callback) {
    this.subscribers.push(callback);
    return () => {
      this.subscribers = this.subscribers.filter((s) => s !== callback);
    };
  }

  notify(message, type = 'info', durationMs = 3000) {
    const toastObj = { id: Date.now() + Math.random(), message, type, durationMs };
    this.subscribers.forEach((cb) => cb(toastObj));
  }

  success(message, durationMs) {
    this.notify(message, 'success', durationMs);
  }

  error(message, durationMs) {
    this.notify(message, 'error', durationMs);
  }

  info(message, durationMs) {
    this.notify(message, 'info', durationMs);
  }

  warning(message, durationMs) {
    this.notify(message, 'warning', durationMs);
  }
}

export const toastService = new ToastService();
