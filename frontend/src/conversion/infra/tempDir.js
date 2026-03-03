export const createTempNamespace = (jobId) => ({
  id: jobId,
  createdAt: Date.now(),
  resources: new Set(),
  track(resource) {
    if (resource) this.resources.add(resource);
  },
  cleanup() {
    this.resources.clear();
  }
});
