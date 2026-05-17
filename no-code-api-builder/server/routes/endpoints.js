const express = require('express');
const router = express.Router();
const store = require('../store/endpointStore');

/**
 * GET /api/endpoints
 * Returns all registered endpoints.
 */
router.get('/', (req, res) => {
  const endpoints = store.getAllEndpoints();
  res.json({ success: true, count: endpoints.length, data: endpoints });
});

/**
 * GET /api/endpoints/:id
 * Returns a single endpoint by ID.
 */
router.get('/:id', (req, res) => {
  const endpoint = store.getEndpointById(req.params.id);
  if (!endpoint) {
    return res.status(404).json({ success: false, message: 'Endpoint not found' });
  }
  res.json({ success: true, data: endpoint });
});

/**
 * POST /api/endpoints
 * Creates a new endpoint.
 * Body: { method, path, statusCode?, responseBody?, description? }
 */
router.post('/', (req, res) => {
  const result = store.createEndpoint(req.body);
  if (!result.success) {
    return res.status(400).json({ success: false, errors: result.errors });
  }
  res.status(201).json({ success: true, data: result.endpoint });
});

/**
 * PUT /api/endpoints/:id
 * Updates an existing endpoint.
 */
router.put('/:id', (req, res) => {
  const result = store.updateEndpoint(req.params.id, req.body);
  if (!result.success) {
    const status = result.errors[0].includes('not found') ? 404 : 400;
    return res.status(status).json({ success: false, errors: result.errors });
  }
  res.json({ success: true, data: result.endpoint });
});

/**
 * DELETE /api/endpoints/:id
 * Deletes an endpoint by ID.
 */
router.delete('/:id', (req, res) => {
  const result = store.deleteEndpoint(req.params.id);
  if (!result.success) {
    return res.status(404).json({ success: false, errors: result.errors });
  }
  res.json({ success: true, message: 'Endpoint deleted successfully' });
});

module.exports = router;
