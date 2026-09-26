// The HTTP/database integration suite isolates Redis too; production never uses this adapter.
export class SessionStore {
  private values = new Map<string, string>();
  async get(key: string) {
    return this.values.get(key) ?? null;
  }
  async set(key: string, value: string) {
    this.values.set(key, value);
  }
  async del(key: string) {
    this.values.delete(key);
  }
  async ping() {
    return 'PONG';
  }
  async epoch(userId: string, candidate: string) {
    const key = `auth:user:${userId}`;
    if (!this.values.has(key)) this.values.set(key, candidate);
    return this.values.get(key)!;
  }
  async rotate(key: string, expected: string, next: string) {
    if (this.values.get(key) !== expected) return false;
    this.values.set(key, next);
    return true;
  }
  async revokeUser(userId: string) {
    this.values.delete(`auth:user:${userId}`);
  }
}
