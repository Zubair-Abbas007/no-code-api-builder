/**
 * POST /api/generate
 * Generates API code files based on user description + options.
 *
 * POST /api/download
 * Packages generated files into a ZIP and streams it back.
 */

const express = require('express');
const router  = express.Router();
const path    = require('path');
const { generateApiFiles } = require('../services/codeGenerator');
const { buildZip }         = require('../services/zipBuilder');

/**
 * POST /api/generate
 * Body: { description, language, database, auth, extras[] }
 */
router.post('/generate', async (req, res) => {
  const { description, language, database, auth, extras } = req.body;

  if (!description || description.trim().length < 10) {
    return res.status(400).json({ success: false, error: 'Description too short' });
  }

  try {
    const files = generateApiFiles({ description, language, database, auth, extras });
    res.json({ success: true, files });
  } catch (err) {
    console.error('Generate error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/download
 * Body: { files: { filename: code }, projectName }
 * Returns: application/zip
 */
router.post('/download', async (req, res) => {
  const { files, projectName } = req.body;

  if (!files || typeof files !== 'object') {
    return res.status(400).json({ success: false, error: 'No files provided' });
  }

  try {
    const zipBuffer = await buildZip(files, projectName || 'my-api');
    const safeName  = (projectName || 'my-api').replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase();

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}.zip"`);
    res.setHeader('Content-Length', zipBuffer.length);
    res.send(zipBuffer);
  } catch (err) {
    console.error('Download error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
