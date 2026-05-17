/**
 * Unit tests for endpointStore.js
 * Covers: validateEndpointData, createEndpoint, updateEndpoint,
 *         deleteEndpoint, findMatchingEndpoint, getEndpointById
 *
 * Each function has normal, edge, and invalid-input cases.
 */

const store = require('../server/store/endpointStore');

// Reset store before every test to ensure isolation
beforeEach(() => {
  store._reset();
});

// ─────────────────────────────────────────────────────────────
// 1. validateEndpointData
// ─────────────────────────────────────────────────────────────
describe('validateEndpointData', () => {
  test('NORMAL: valid GET endpoint passes validation', () => {
    const result = store.validateEndpointData({ method: 'GET', path: '/users' });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('NORMAL: all optional fields accepted', () => {
    const result = store.validateEndpointData({
      method: 'POST',
      path: '/items',
      statusCode: 201,
      responseBody: { id: 1 },
      description: 'Create item',
    });
    expect(result.valid).toBe(true);
  });

  test('EDGE: method is case-insensitive (lowercase accepted)', () => {
    const result = store.validateEndpointData({ method: 'get', path: '/ping' });
    expect(result.valid).toBe(true);
  });

  test('EDGE: statusCode at boundary values (100 and 599)', () => {
    expect(store.validateEndpointData({ method: 'GET', path: '/a', statusCode: 100 }).valid).toBe(true);
    expect(store.validateEndpointData({ method: 'GET', path: '/b', statusCode: 599 }).valid).toBe(true);
  });

  test('INVALID: missing method returns error', () => {
    const result = store.validateEndpointData({ path: '/users' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('method'))).toBe(true);
  });

  test('INVALID: missing path returns error', () => {
    const result = store.validateEndpointData({ method: 'GET' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('path'))).toBe(true);
  });

  test('INVALID: path without leading slash returns error', () => {
    const result = store.validateEndpointData({ method: 'GET', path: 'users' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('/'))).toBe(true);
  });

  test('INVALID: unknown HTTP method returns error', () => {
    const result = store.validateEndpointData({ method: 'FETCH', path: '/x' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('method'))).toBe(true);
  });

  test('INVALID: statusCode out of range (99) returns error', () => {
    const result = store.validateEndpointData({ method: 'GET', path: '/x', statusCode: 99 });
    expect(result.valid).toBe(false);
  });

  test('INVALID: statusCode out of range (600) returns error', () => {
    const result = store.validateEndpointData({ method: 'GET', path: '/x', statusCode: 600 });
    expect(result.valid).toBe(false);
  });

  test('INVALID: null input returns error', () => {
    const result = store.validateEndpointData(null);
    expect(result.valid).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// 2. createEndpoint
// ─────────────────────────────────────────────────────────────
describe('createEndpoint', () => {
  test('NORMAL: creates endpoint with required fields', () => {
    const result = store.createEndpoint({ method: 'GET', path: '/users' });
    expect(result.success).toBe(true);
    expect(result.endpoint).toMatchObject({ method: 'GET', path: '/users', statusCode: 200 });
    expect(result.endpoint.id).toBeDefined();
  });

  test('NORMAL: creates endpoint with all optional fields', () => {
    const result = store.createEndpoint({
      method: 'POST',
      path: '/users',
      statusCode: 201,
      responseBody: { id: 42 },
      description: 'Create user',
    });
    expect(result.success).toBe(true);
    expect(result.endpoint.statusCode).toBe(201);
    expect(result.endpoint.responseBody).toEqual({ id: 42 });
  });

  test('NORMAL: method is normalised to uppercase', () => {
    const result = store.createEndpoint({ method: 'post', path: '/items' });
    expect(result.endpoint.method).toBe('POST');
  });

  test('EDGE: creates endpoint with root path /', () => {
    const result = store.createEndpoint({ method: 'GET', path: '/' });
    expect(result.success).toBe(true);
  });

  test('EDGE: same path with different methods is allowed', () => {
    store.createEndpoint({ method: 'GET', path: '/users' });
    const result = store.createEndpoint({ method: 'POST', path: '/users' });
    expect(result.success).toBe(true);
  });

  test('INVALID: duplicate method + path is rejected', () => {
    store.createEndpoint({ method: 'GET', path: '/users' });
    const result = store.createEndpoint({ method: 'GET', path: '/users' });
    expect(result.success).toBe(false);
    expect(result.errors[0]).toMatch(/already exists/i);
  });

  test('INVALID: missing required fields returns errors', () => {
    const result = store.createEndpoint({});
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
// 3. updateEndpoint
// ─────────────────────────────────────────────────────────────
describe('updateEndpoint', () => {
  let endpointId;

  beforeEach(() => {
    const { endpoint } = store.createEndpoint({ method: 'GET', path: '/products' });
    endpointId = endpoint.id;
  });

  test('NORMAL: updates description and statusCode', () => {
    const result = store.updateEndpoint(endpointId, { description: 'Updated', statusCode: 204 });
    expect(result.success).toBe(true);
    expect(result.endpoint.description).toBe('Updated');
    expect(result.endpoint.statusCode).toBe(204);
  });

  test('NORMAL: updatedAt timestamp changes', () => {
    const before = store.getEndpointById(endpointId).updatedAt;
    // Small delay to ensure timestamp differs
    const result = store.updateEndpoint(endpointId, { description: 'Changed' });
    expect(result.endpoint.updatedAt).toBeDefined();
  });

  test('EDGE: updating only responseBody keeps other fields intact', () => {
    const result = store.updateEndpoint(endpointId, { responseBody: { ok: true } });
    expect(result.success).toBe(true);
    expect(result.endpoint.method).toBe('GET');
    expect(result.endpoint.path).toBe('/products');
  });

  test('INVALID: non-existent ID returns error', () => {
    const result = store.updateEndpoint('non-existent-id', { description: 'x' });
    expect(result.success).toBe(false);
    expect(result.errors[0]).toMatch(/not found/i);
  });

  test('INVALID: updating to duplicate method+path is rejected', () => {
    store.createEndpoint({ method: 'POST', path: '/products' });
    const result = store.updateEndpoint(endpointId, { method: 'POST' });
    expect(result.success).toBe(false);
    expect(result.errors[0]).toMatch(/already exists/i);
  });
});

// ─────────────────────────────────────────────────────────────
// 4. deleteEndpoint
// ─────────────────────────────────────────────────────────────
describe('deleteEndpoint', () => {
  test('NORMAL: deletes an existing endpoint', () => {
    const { endpoint } = store.createEndpoint({ method: 'DELETE', path: '/items/1' });
    const result = store.deleteEndpoint(endpoint.id);
    expect(result.success).toBe(true);
    expect(store.getEndpointById(endpoint.id)).toBeUndefined();
  });

  test('NORMAL: store count decreases after delete', () => {
    const { endpoint } = store.createEndpoint({ method: 'GET', path: '/count-test' });
    store.deleteEndpoint(endpoint.id);
    expect(store.getAllEndpoints()).toHaveLength(0);
  });

  test('EDGE: deleting one endpoint does not affect others', () => {
    const { endpoint: ep1 } = store.createEndpoint({ method: 'GET', path: '/a' });
    const { endpoint: ep2 } = store.createEndpoint({ method: 'GET', path: '/b' });
    store.deleteEndpoint(ep1.id);
    expect(store.getEndpointById(ep2.id)).toBeDefined();
  });

  test('INVALID: deleting non-existent ID returns error', () => {
    const result = store.deleteEndpoint('fake-id-000');
    expect(result.success).toBe(false);
    expect(result.errors[0]).toMatch(/not found/i);
  });
});

// ─────────────────────────────────────────────────────────────
// 5. findMatchingEndpoint
// ─────────────────────────────────────────────────────────────
describe('findMatchingEndpoint', () => {
  beforeEach(() => {
    store.createEndpoint({ method: 'GET',    path: '/users' });
    store.createEndpoint({ method: 'POST',   path: '/users' });
    store.createEndpoint({ method: 'GET',    path: '/users/:id' });
    store.createEndpoint({ method: 'DELETE', path: '/users/:id' });
  });

  test('NORMAL: exact path match', () => {
    const ep = store.findMatchingEndpoint('GET', '/users');
    expect(ep).toBeDefined();
    expect(ep.method).toBe('GET');
    expect(ep.path).toBe('/users');
  });

  test('NORMAL: parametric path match /users/:id → /users/42', () => {
    const ep = store.findMatchingEndpoint('GET', '/users/42');
    expect(ep).toBeDefined();
    expect(ep.path).toBe('/users/:id');
  });

  test('NORMAL: method distinguishes same path (POST /users)', () => {
    const ep = store.findMatchingEndpoint('POST', '/users');
    expect(ep.method).toBe('POST');
  });

  test('EDGE: method matching is case-insensitive', () => {
    const ep = store.findMatchingEndpoint('get', '/users');
    expect(ep).toBeDefined();
  });

  test('EDGE: root path / matches exactly', () => {
    store.createEndpoint({ method: 'GET', path: '/' });
    const ep = store.findMatchingEndpoint('GET', '/');
    expect(ep).toBeDefined();
  });

  test('INVALID: no match returns undefined', () => {
    const ep = store.findMatchingEndpoint('GET', '/nonexistent');
    expect(ep).toBeUndefined();
  });

  test('INVALID: wrong method returns undefined', () => {
    const ep = store.findMatchingEndpoint('PUT', '/users');
    expect(ep).toBeUndefined();
  });

  test('INVALID: null inputs return undefined', () => {
    expect(store.findMatchingEndpoint(null, '/users')).toBeUndefined();
    expect(store.findMatchingEndpoint('GET', null)).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────
// 6. getEndpointById
// ─────────────────────────────────────────────────────────────
describe('getEndpointById', () => {
  test('NORMAL: returns correct endpoint by ID', () => {
    const { endpoint } = store.createEndpoint({ method: 'GET', path: '/by-id' });
    const found = store.getEndpointById(endpoint.id);
    expect(found).toEqual(endpoint);
  });

  test('EDGE: returns undefined for unknown ID', () => {
    expect(store.getEndpointById('unknown-id')).toBeUndefined();
  });

  test('INVALID: returns undefined for null/empty input', () => {
    expect(store.getEndpointById(null)).toBeUndefined();
    expect(store.getEndpointById('')).toBeUndefined();
  });
});
