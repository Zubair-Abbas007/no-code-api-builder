const express = require('express');
const router = express.Router();
const store = require('../store/endpointStore');

/**
 * Catch-all route handler for mock API requests.
 * Matches incoming requests against registered endpoints and returns
 * the configured mock response.
 *
 * Example: If user registered GET /users, then GET /mock/users returns the mock response.
 */
router.all('*', (req, res) => {
  // Strip the /mock prefix to get the actual path
  const requestPath = req.path || '/';
  const method = req.method;

  const matched = store.findMatchingEndpoint(method, requestPath);

  if (!matched) {
    return res.status(404).json({
      success: false,
      message: `No mock endpoint found for ${method} ${requestPath}`,
      hint: 'Register this endpoint via POST /api/endpoints first',
    });
  }

  // Return the configured mock response
  res.status(matched.statusCode).json(matched.responseBody);
});

module.exports = router;
