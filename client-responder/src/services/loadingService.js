class LoadingService {
  constructor() {
    this.activeTasks = new Set();
    this.subscribers = [];
  }

  subscribe(callback) {
    this.subscribers.push(callback);
    return () => {
      this.subscribers = this.subscribers.filter((s) => s !== callback);
    };
  }

  start(taskId = 'global') {
    this.activeTasks.add(taskId);
    this._notify();
  }

  stop(taskId = 'global') {
    this.activeTasks.delete(taskId);
    this._notify();
  }

  isLoading() {
    return this.activeTasks.size > 0;
  }

  _notify() {
    const loadingState = { isLoading: this.isLoading(), count: this.activeTasks.size };
    this.subscribers.forEach((cb) => cb(loadingState));
  }
}

export const loadingService = new LoadingService();
