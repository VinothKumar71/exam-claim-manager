const API_BASE = window.location.protocol === 'file:' ? 'http://localhost:3000' : '';

class MockQueryBuilder {
  constructor(table) {
    this.table = table;
    this.op = null;
    this.payload = {};
  }

  select(columns = '*') {
    this.op = 'select';
    return this;
  }

  order(column, options = { ascending: true }) {
    this.payload.order = { column, ascending: options.ascending };
    return this;
  }

  insert(data) {
    this.op = 'insert';
    this.payload.data = data;
    return this;
  }

  update(data) {
    this.op = 'update';
    this.payload.data = data;
    return this;
  }

  delete() {
    this.op = 'delete';
    return this;
  }

  upsert(data) {
    this.op = 'upsert';
    this.payload.data = data;
    return this;
  }

  eq(column, value) {
    if (!this.payload.match) this.payload.match = {};
    this.payload.match[column] = value;
    return this;
  }

  async then(resolve, reject) {
    try {
      const res = await fetch(`${API_BASE}/api/db-query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operation: this.op, table: this.table, payload: this.payload })
      });
      if (!res.ok) {
        const error = await res.json();
        resolve({ data: null, error: new Error(error.error) });
        return;
      }
      const result = await res.json();
      resolve({ data: result, error: null });
    } catch (e) {
      resolve({ data: null, error: e });
    }
  }
}

export const supabase = {
  from: (table: string) => new MockQueryBuilder(table),
  auth: {
    getSession: async () => {
      const user = localStorage.getItem('local_user');
      if (user) {
        return { data: { session: { user: JSON.parse(user) } } };
      }
      return { data: { session: null } };
    },
    onAuthStateChange: (cb: any) => {
      window.__auth_cb = cb;
      return { data: { subscription: { unsubscribe: () => {} } } };
    },
    signInWithPassword: async ({ email, password }: any) => {
      try {
        const res = await fetch(`${API_BASE}/api/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const result = await res.json();
        if (result.success) {
          localStorage.setItem('local_user', JSON.stringify(result.user));
          if (window.__auth_cb) {
            window.__auth_cb('SIGNED_IN', { session: { user: result.user } });
          }
          return { data: result.user, error: null };
        }
        return { data: null, error: new Error(result.error) };
      } catch (e) {
        return { data: null, error: e };
      }
    },
    signOut: async () => {
      localStorage.removeItem('local_user');
      if (window.__auth_cb) {
        window.__auth_cb('SIGNED_OUT', null);
      }
      return { error: null };
    }
  }
} as any;
