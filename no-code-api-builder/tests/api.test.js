/**
 * Integration tests for the REST API routes.
 * Uses supertest to make HTTP requests against the Express app.
 */

const request = require('supertest');
const app = require('../server/index');
const store = require('../server/store/endpointStore');

beforeEach(() => {
  store._reset();
});

// ─────────────────────────────────────────────────────────────
// GET /api/endpoints
// ─────────────────────────────────────────────────────────────
describe('GET /api/endpoints', () => {
  test('returns empty array when no endpoints exist', async () => {
    const res = await request(app).get('/api/endpoints');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([]);
    expect(res.body.count).toBe(0);
  });

  test('returns all created endpoints', async () => {
    store.createEndpoint({ method: 'GET', path: '/a' });
    store.createEndpoint({ method: 'POST', path: '/b' });
    const res = await request(app).get('/api/endpoints');
    expect(res.body.count).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────
// POST /api/endpoints
// ─────────────────────────────────────────────────────────────
describe('POST /api/endpoints', () => {
  test('creates a new endpoint and returns 201', async () => {
    const res = await request(app)
      .post('/api/endpoints')
      .send({ method: 'GET', path: '/hello', responseBody: { msg: 'hi' } });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.path).toBe('/hello');
  });

  test('returns 400 for invalid data', async () => {
    const res = await request(app)
      .post('/api/endpoints')
      .send({ method: 'INVALID', path: '/x' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('returns 400 for duplicate endpoint', async () => {
    await request(app).post('/api/endpoints').send({ method: 'GET', path: '/dup' });
    const res = await request(app).post('/api/endpoints').send({ method: 'GET', path: '/dup' });
    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────
// PUT /api/endpoints/:id
// ─────────────────────────────────────────────────────────────
describe('PUT /api/endpoints/:id', () => {
  test('updates an existing endpoint', async () => {
    const create = await request(app)
      .post('/api/endpoints')
      .send({ method: 'GET', path: '/update-me' });
    const id = create.body.data.id;

    const res = await request(app)
      .put(`/api/endpoints/${id}`)
      .send({ description: 'Updated desc', statusCode: 204 });
    expect(res.status).toBe(200);
    expect(res.body.data.description).toBe('Updated desc');
  });

  test('returns 404 for non-existent ID', async () => {
    const res = await request(app)
      .put('/api/endpoints/fake-id')
      .send({ description: 'x' });
    expect(res.status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────
// DELETE /api/endpoints/:id
// ─────────────────────────────────────────────────────────────
describe('DELETE /api/endpoints/:id', () => {
  test('deletes an existing endpoint', async () => {
    const create = await request(app)
      .post('/api/endpoints')
      .send({ method: 'DELETE', path: '/remove-me' });
    const id = create.body.data.id;

    const res = await request(app).delete(`/api/endpoints/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('returns 404 for non-existent ID', async () => {
    const res = await request(app).delete('/api/endpoints/no-such-id');
    expect(res.status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────
// GET /mock/* (mock endpoint handler)
// ─────────────────────────────────────────────────────────────
describe('Mock endpoint handler', () => {
  test('returns configured mock response', async () => {
    store.createEndpoint({
      method: 'GET',
      path: '/ping',
      statusCode: 200,
      responseBody: { pong: true },
    });
    const res = await request(app).get('/mock/ping');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ pong: true });
  });

  test('returns 404 for unregistered mock path', async () => {
    const res = await request(app).get('/mock/not-registered');
    expect(res.status).toBe(404);
  });

  test('returns custom status code from endpoint config', async () => {
    store.createEndpoint({
      method: 'POST',
      path: '/created',
      statusCode: 201,
      responseBody: { id: 99 },
    });
    const res = await request(app).post('/mock/created');
    expect(res.status).toBe(201);
  });
});

// ─────────────────────────────────────────────────────────────
// GET /health
// ─────────────────────────────────────────────────────────────
describe('Health check', () => {
  test('returns status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
