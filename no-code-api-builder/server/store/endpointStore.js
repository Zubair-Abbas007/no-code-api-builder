/**
 * In-memory store for API endpoints.
 * In a production app this would be backed by a database.
 */

const { v4: uuidv4 } = require('uuid');

// Valid HTTP methods allowed for endpoints
const VALID_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

// Valid HTTP status codes range
const MIN_STATUS_CODE = 100;
const MAX_STATUS_CODE = 599;

let endpoints = [];

/**
 * Returns a shallow copy of all stored endpoints.
 * @returns {Array} list of endpoint objects
 */
function getAllEndpoints() {
  return [...endpoints];
}

/**
 * Finds a single endpoint by its unique ID.
 * @param {string} id - UUID of the endpoint
 * @returns {object|undefined} the endpoint or undefined if not found
 */
function getEndpointById(id) {
  if (!id || typeof id !== 'string') return undefined;
  return endpoints.find((ep) => ep.id === id);
}

/**
 * Validates the fields required to create or update an endpoint.
 * @param {object} data - raw input data
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateEndpointData(data) {
  const errors = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Request body must be a JSON object'] };
  }

  // Validate method
  if (!data.method) {
    errors.push('method is required');
  } else if (!VALID_METHODS.includes(data.method.toUpperCase())) {
    errors.push(`method must be one of: ${VALID_METHODS.join(', ')}`);
  }

  // Validate path
  if (!data.path) {
    errors.push('path is required');
  } else if (typeof data.path !== 'string') {
    errors.push('path must be a string');
  } else if (!data.path.startsWith('/')) {
    errors.push('path must start with /');
  }

  // Validate statusCode
  if (data.statusCode !== undefined) {
    const code = Number(data.statusCode);
    if (!Number.isInteger(code) || code < MIN_STATUS_CODE || code > MAX_STATUS_CODE) {
      errors.push(`statusCode must be an integer between ${MIN_STATUS_CODE} and ${MAX_STATUS_CODE}`);
    }
  }

  // Validate responseBody is serialisable JSON
  if (data.responseBody !== undefined) {
    try {
      JSON.stringify(data.responseBody);
    } catch {
      errors.push('responseBody must be JSON-serialisable');
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Creates a new endpoint and adds it to the store.
 * @param {object} data - { method, path, statusCode?, responseBody?, description? }
 * @returns {{ success: boolean, endpoint?: object, errors?: string[] }}
 */
function createEndpoint(data) {
  const { valid, errors } = validateEndpointData(data);
  if (!valid) return { success: false, errors };

  // Check for duplicate method + path combination
  const duplicate = endpoints.find(
    (ep) =>
      ep.method === data.method.toUpperCase() &&
      ep.path === data.path
  );
  if (duplicate) {
    return { success: false, errors: [`Endpoint ${data.method.toUpperCase()} ${data.path} already exists`] };
  }

  const endpoint = {
    id: uuidv4(),
    method: data.method.toUpperCase(),
    path: data.path,
    statusCode: data.statusCode ? Number(data.statusCode) : 200,
    responseBody: data.responseBody !== undefined ? data.responseBody : {},
    description: data.description || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  endpoints.push(endpoint);
  return { success: true, endpoint };
}

/**
 * Updates an existing endpoint by ID.
 * @param {string} id - UUID of the endpoint to update
 * @param {object} data - fields to update
 * @returns {{ success: boolean, endpoint?: object, errors?: string[] }}
 */
function updateEndpoint(id, data) {
  const index = endpoints.findIndex((ep) => ep.id === id);
  if (index === -1) {
    return { success: false, errors: [`Endpoint with id '${id}' not found`] };
  }

  const { valid, errors } = validateEndpointData({ ...endpoints[index], ...data });
  if (!valid) return { success: false, errors };

  // Check duplicate only if method or path changed
  const incoming = {
    method: (data.method || endpoints[index].method).toUpperCase(),
    path: data.path || endpoints[index].path,
  };
  const duplicate = endpoints.find(
    (ep, i) =>
      i !== index &&
      ep.method === incoming.method &&
      ep.path === incoming.path
  );
  if (duplicate) {
    return { success: false, errors: [`Endpoint ${incoming.method} ${incoming.path} already exists`] };
  }

  endpoints[index] = {
    ...endpoints[index],
    ...data,
    method: incoming.method,
    updatedAt: new Date().toISOString(),
  };

  return { success: true, endpoint: endpoints[index] };
}

/**
 * Deletes an endpoint by ID.
 * @param {string} id - UUID of the endpoint
 * @returns {{ success: boolean, errors?: string[] }}
 */
function deleteEndpoint(id) {
  const index = endpoints.findIndex((ep) => ep.id === id);
  if (index === -1) {
    return { success: false, errors: [`Endpoint with id '${id}' not found`] };
  }
  endpoints.splice(index, 1);
  return { success: true };
}

/**
 * Finds an endpoint matching a given HTTP method and URL path.
 * Supports simple path parameters (e.g. /users/:id).
 * @param {string} method - HTTP method
 * @param {string} urlPath - incoming request path
 * @returns {object|undefined}
 */
function findMatchingEndpoint(method, urlPath) {
  if (!method || !urlPath) return undefined;

  const upperMethod = method.toUpperCase();

  return endpoints.find((ep) => {
    if (ep.method !== upperMethod) return false;

    // Exact match
    if (ep.path === urlPath) return true;

    // Parametric match: /users/:id vs /users/123
    const epParts = ep.path.split('/');
    const urlParts = urlPath.split('/');
    if (epParts.length !== urlParts.length) return false;

    return epParts.every((part, i) => part.startsWith(':') || part === urlParts[i]);
  });
}

/**
 * Resets the store — used in tests only.
 */
function _reset() {
  endpoints = [];
}

module.exports = {
  getAllEndpoints,
  getEndpointById,
  validateEndpointData,
  createEndpoint,
  updateEndpoint,
  deleteEndpoint,
  findMatchingEndpoint,
  _reset,
};
