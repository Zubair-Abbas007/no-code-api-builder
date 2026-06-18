/**
 * Code Generator Service
 * Produces realistic multi-file API code based on user options.
 */

'use strict';

/**
 * Main entry point — returns { filename: codeString } map.
 * @param {object} opts
 */
function generateApiFiles({ description, language, database, auth, extras }) {
  const lang   = (language || 'Node.js').toLowerCase();
  const db     = (database || 'None').toLowerCase();
  const authT  = (auth || 'None').toLowerCase();
  const ex     = (extras || []).map(e => e.toLowerCase());
  const name   = slugify(description.split(' ').slice(0, 4).join(' '));

  if (lang.includes('python')) return genPython({ description, db, authT, ex, name });
  if (lang.includes('go'))     return genGo({ description, db, authT, ex, name });
  return genNode({ description, db, authT, ex, name });
}

// ── Helpers ───────────────────────────────────────────────
function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function parseEndpoints(description) {
  const desc = description.toLowerCase();
  const endpoints = [];

  const resources = [];
  const resourceWords = ['user', 'product', 'order', 'task', 'project', 'post',
    'comment', 'category', 'item', 'message', 'payment', 'invoice',
    'subscription', 'notification', 'file', 'report', 'team', 'member'];

  resourceWords.forEach(r => {
    if (desc.includes(r)) resources.push(r);
  });

  if (resources.length === 0) resources.push('item');

  resources.slice(0, 4).forEach(r => {
    const plural = r.endsWith('s') ? r : r + 's';
    endpoints.push(
      { method: 'GET',    path: `/${plural}`,     desc: `List all ${plural}` },
      { method: 'POST',   path: `/${plural}`,     desc: `Create a new ${r}` },
      { method: 'GET',    path: `/${plural}/:id`, desc: `Get ${r} by ID` },
      { method: 'PUT',    path: `/${plural}/:id`, desc: `Update ${r}` },
      { method: 'DELETE', path: `/${plural}/:id`, desc: `Delete ${r}` }
    );
  });

  return endpoints;
}

module.exports = { generateApiFiles, parseEndpoints };

// ── Node.js Generator ─────────────────────────────────────
function genNode({ description, db, authT, ex, name }) {
  const endpoints = parseEndpoints(description);
  const useJwt    = authT.includes('jwt');
  const useDocker = ex.includes('docker');
  const useTests  = ex.includes('tests');
  const useOpenApi= ex.includes('openapi');
  const useMongo  = db.includes('mongo');
  const usePg     = db.includes('postgres') || db.includes('mysql');

  const files = {};

  // index.js
  files['index.js'] = nodeIndex(endpoints, useJwt, useMongo, usePg, description);

  // routes file
  files['routes/api.js'] = nodeRoutes(endpoints, useJwt);

  // middleware
  if (useJwt) files['middleware/auth.js'] = nodeAuthMiddleware();

  // db config
  if (useMongo) files['config/db.js'] = nodeMongoConfig();
  else if (usePg) files['config/db.js'] = nodePgConfig();

  // package.json
  files['package.json'] = nodePackageJson(name, useMongo, usePg, useJwt);

  // .env
  files['.env.example'] = nodeEnv(useMongo, usePg, useJwt);

  // docker
  if (useDocker) {
    files['Dockerfile'] = nodeDockerfile();
    files['docker-compose.yml'] = nodeDockerCompose(name, useMongo, usePg);
  }

  // openapi
  if (useOpenApi) files['openapi.yaml'] = genOpenApi(name, endpoints);

  // tests
  if (useTests) files['tests/api.test.js'] = nodeTests(endpoints);

  // README
  files['README.md'] = genReadme(name, 'Node.js', description, endpoints, useDocker);

  return files;
}

function nodeIndex(endpoints, useJwt, useMongo, usePg, description) {
  const dbImport = useMongo
    ? `const connectDB = require('./config/db');\nconnectDB();`
    : usePg ? `const { pool } = require('./config/db');` : '';

  return `const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const morgan  = require('morgan');
require('dotenv').config();
${dbImport}

const apiRoutes = require('./routes/api');

const app  = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api', apiRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error'
  });
});

app.listen(PORT, () => {
  console.log(\`🚀 Server running on http://localhost:\${PORT}\`);
});

module.exports = app;
`;
}

function nodeRoutes(endpoints, useJwt) {
  const authImport = useJwt ? `const { authenticate } = require('../middleware/auth');\n` : '';
  const authGuard  = useJwt ? 'authenticate, ' : '';

  const groups = {};
  endpoints.forEach(ep => {
    const resource = ep.path.split('/')[1];
    if (!groups[resource]) groups[resource] = [];
    groups[resource].push(ep);
  });

  let routes = `const express = require('express');
const router  = express.Router();
${authImport}
// ── In-memory store (replace with DB queries) ──────────────
const store = {};
let nextId = 1;

`;

  Object.entries(groups).forEach(([resource, eps]) => {
    routes += `// ── ${resource.toUpperCase()} ──────────────────────────────────────────\n`;
    eps.forEach(ep => {
      const method = ep.method.toLowerCase();
      const path   = ep.path.replace(`/${resource}`, '');
      const isById = path.includes(':id');
      routes += `
/**
 * ${ep.method} /api${ep.path}
 * ${ep.desc}
 */
router.${method}('${ep.path}', ${authGuard}async (req, res) => {
  try {
${isById ? `    const { id } = req.params;
    if (!store[id]) return res.status(404).json({ success: false, message: '${resource.slice(0,-1)} not found' });
` : ''}${method === 'get' && !isById ? `    const items = Object.values(store);
    res.json({ success: true, count: items.length, data: items });` : ''}${method === 'post' ? `    const item = { id: String(nextId++), ...req.body, createdAt: new Date().toISOString() };
    store[item.id] = item;
    res.status(201).json({ success: true, data: item });` : ''}${method === 'get' && isById ? `    res.json({ success: true, data: store[id] });` : ''}${method === 'put' ? `    store[id] = { ...store[id], ...req.body, updatedAt: new Date().toISOString() };
    res.json({ success: true, data: store[id] });` : ''}${method === 'delete' ? `    delete store[id];
    res.json({ success: true, message: 'Deleted successfully' });` : ''}
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
`;
    });
  });

  routes += '\nmodule.exports = router;\n';
  return routes;
}

function nodeAuthMiddleware() {
  return `const jwt = require('jsonwebtoken');

/**
 * JWT Authentication Middleware
 * Verifies Bearer token from Authorization header.
 */
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'change-me-in-production');
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
}

/**
 * Generate a JWT token for a user.
 * @param {object} payload
 * @returns {string} token
 */
function generateToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET || 'change-me-in-production', {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
}

module.exports = { authenticate, generateToken };
`;
}

function nodeMongoConfig() {
  return `const mongoose = require('mongoose');

async function connectDB() {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/myapi');
    console.log(\`✅ MongoDB connected: \${conn.connection.host}\`);
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  }
}

module.exports = connectDB;
`;
}

function nodePgConfig() {
  return `const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

pool.on('connect', () => console.log('✅ PostgreSQL connected'));
pool.on('error', (err) => console.error('❌ PostgreSQL error:', err));

module.exports = { pool };
`;
}

function nodePackageJson(name, useMongo, usePg, useJwt) {
  const deps = {
    express: '^4.18.2',
    cors: '^2.8.5',
    helmet: '^7.1.0',
    morgan: '^1.10.0',
    dotenv: '^16.3.1'
  };
  if (useMongo) deps.mongoose = '^8.0.0';
  if (usePg)    deps.pg = '^8.11.3';
  if (useJwt)   deps.jsonwebtoken = '^9.0.2';

  return JSON.stringify({
    name: name || 'my-api',
    version: '1.0.0',
    description: 'Generated by APIForge',
    main: 'index.js',
    scripts: {
      start: 'node index.js',
      dev: 'nodemon index.js',
      test: 'jest --no-coverage'
    },
    dependencies: deps,
    devDependencies: {
      nodemon: '^3.0.2',
      jest: '^29.7.0',
      supertest: '^6.3.4'
    }
  }, null, 2);
}

function nodeEnv(useMongo, usePg, useJwt) {
  let env = `PORT=3000\nNODE_ENV=development\n`;
  if (useMongo) env += `MONGODB_URI=mongodb://localhost:27017/myapi\n`;
  if (usePg)    env += `DATABASE_URL=postgresql://user:password@localhost:5432/myapi\n`;
  if (useJwt)   env += `JWT_SECRET=your-super-secret-key-change-in-production\nJWT_EXPIRES_IN=7d\n`;
  return env;
}

function nodeDockerfile() {
  return `FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
EXPOSE 3000
CMD ["node", "index.js"]
`;
}

function nodeDockerCompose(name, useMongo, usePg) {
  const safeName = name || 'my-api';
  let compose = `version: '3.8'
services:
  api:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
`;
  if (useMongo) {
    compose += `      - MONGODB_URI=mongodb://mongo:27017/${safeName}
    depends_on:
      - mongo

  mongo:
    image: mongo:7
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db

volumes:
  mongo_data:
`;
  } else if (usePg) {
    compose += `      - DATABASE_URL=postgresql://postgres:postgres@postgres:5432/${safeName}
    depends_on:
      - postgres

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: ${safeName}
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - pg_data:/var/lib/postgresql/data

volumes:
  pg_data:
`;
  }
  return compose;
}

function nodeTests(endpoints) {
  const first = endpoints[0];
  return `const request = require('supertest');
const app     = require('../index');

describe('API Tests', () => {
  test('GET /health returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  test('GET /api${first ? first.path.replace('/:id', '') : '/items'} returns array', async () => {
    const res = await request(app).get('/api${first ? first.path.replace('/:id', '') : '/items'}');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('POST /api${first ? first.path.replace('/:id', '') : '/items'} creates item', async () => {
    const res = await request(app)
      .post('/api${first ? first.path.replace('/:id', '') : '/items'}')
      .send({ name: 'Test Item', description: 'Created by test' });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
  });

  test('GET /api/nonexistent returns 404', async () => {
    const res = await request(app).get('/api/nonexistent-route-xyz');
    expect(res.status).toBe(404);
  });
});
`;
}

// ── Python Generator ──────────────────────────────────────
function genPython({ description, db, authT, ex, name }) {
  const endpoints = parseEndpoints(description);
  const useJwt    = authT.includes('jwt');
  const useDocker = ex.includes('docker');
  const files = {};

  files['main.py'] = pythonMain(endpoints, useJwt, db);
  files['requirements.txt'] = pythonRequirements(db, useJwt);
  files['.env.example'] = `PORT=8000\nSECRET_KEY=change-me-in-production\n${db.includes('postgres') ? 'DATABASE_URL=postgresql://user:password@localhost:5432/myapi\n' : ''}`;
  if (useDocker) {
    files['Dockerfile'] = `FROM python:3.12-slim\nWORKDIR /app\nCOPY requirements.txt .\nRUN pip install --no-cache-dir -r requirements.txt\nCOPY . .\nEXPOSE 8000\nCMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]\n`;
  }
  files['README.md'] = genReadme(name, 'Python', description, endpoints, useDocker);
  return files;
}

function pythonMain(endpoints, useJwt, db) {
  const groups = {};
  endpoints.forEach(ep => {
    const r = ep.path.split('/')[1];
    if (!groups[r]) groups[r] = [];
    groups[r].push(ep);
  });

  let code = `from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import uvicorn
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Generated API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory store (replace with DB)
store = {}
next_id = 1


class Item(BaseModel):
    name: str
    description: Optional[str] = None


@app.get("/health")
def health():
    return {"status": "ok"}

`;

  Object.entries(groups).forEach(([resource, eps]) => {
    const plural = resource.endsWith('s') ? resource : resource + 's';
    code += `\n# ── ${resource.upper ? resource.toUpperCase() : resource.toUpperCase()} ──\n`;
    eps.forEach(ep => {
      const method = ep.method.toLowerCase();
      const isById = ep.path.includes(':id');
      const pyPath = ep.path.replace(':id', '{item_id}');
      if (method === 'get' && !isById) {
        code += `\n@app.get("/api${pyPath}")\ndef list_${plural}():\n    return {"success": True, "data": list(store.values())}\n`;
      } else if (method === 'post') {
        code += `\n@app.post("/api${pyPath}", status_code=201)\ndef create_${resource}(item: Item):\n    global next_id\n    new_item = {"id": str(next_id), **item.dict()}\n    store[str(next_id)] = new_item\n    next_id += 1\n    return {"success": True, "data": new_item}\n`;
      } else if (method === 'get' && isById) {
        code += `\n@app.get("/api${pyPath}")\ndef get_${resource}(item_id: str):\n    if item_id not in store:\n        raise HTTPException(status_code=404, detail="${resource} not found")\n    return {"success": True, "data": store[item_id]}\n`;
      } else if (method === 'put') {
        code += `\n@app.put("/api${pyPath}")\ndef update_${resource}(item_id: str, item: Item):\n    if item_id not in store:\n        raise HTTPException(status_code=404, detail="${resource} not found")\n    store[item_id].update(item.dict())\n    return {"success": True, "data": store[item_id]}\n`;
      } else if (method === 'delete') {
        code += `\n@app.delete("/api${pyPath}")\ndef delete_${resource}(item_id: str):\n    if item_id not in store:\n        raise HTTPException(status_code=404, detail="${resource} not found")\n    del store[item_id]\n    return {"success": True, "message": "Deleted"}\n`;
      }
    });
  });

  code += `\nif __name__ == "__main__":\n    uvicorn.run("main:app", host="0.0.0.0", port=int(os.getenv("PORT", 8000)), reload=True)\n`;
  return code;
}

function pythonRequirements(db, useJwt) {
  let reqs = `fastapi==0.109.0\nuvicorn[standard]==0.27.0\npython-dotenv==1.0.0\npydantic==2.5.3\n`;
  if (db.includes('postgres')) reqs += `asyncpg==0.29.0\nsqlalchemy==2.0.25\n`;
  if (db.includes('mongo'))    reqs += `motor==3.3.2\n`;
  if (useJwt) reqs += `python-jose[cryptography]==3.3.0\npasslib[bcrypt]==1.7.4\n`;
  return reqs;
}

// ── Go Generator ──────────────────────────────────────────
function genGo({ description, db, authT, ex, name }) {
  const endpoints = parseEndpoints(description);
  const useDocker = ex.includes('docker');
  const files = {};
  const modName = name || 'my-api';

  files['main.go'] = goMain(endpoints, modName);
  files['go.mod']  = `module ${modName}\n\ngo 1.21\n\nrequire (\n\tgithub.com/gin-gonic/gin v1.9.1\n\tgithub.com/joho/godotenv v1.5.1\n)\n`;
  files['.env.example'] = `PORT=8080\n`;
  if (useDocker) {
    files['Dockerfile'] = `FROM golang:1.21-alpine AS builder\nWORKDIR /app\nCOPY go.* ./\nRUN go mod download\nCOPY . .\nRUN go build -o server .\n\nFROM alpine:latest\nWORKDIR /app\nCOPY --from=builder /app/server .\nEXPOSE 8080\nCMD ["./server"]\n`;
  }
  files['README.md'] = genReadme(modName, 'Go', description, endpoints, useDocker);
  return files;
}

function goMain(endpoints, modName) {
  const groups = {};
  endpoints.forEach(ep => {
    const r = ep.path.split('/')[1];
    if (!groups[r]) groups[r] = [];
    groups[r].push(ep);
  });

  let code = `package main

import (
\t"net/http"
\t"os"
\t"sync"
\t"time"

\t"github.com/gin-gonic/gin"
)

// Store is a simple in-memory data store
type Store struct {
\tmu    sync.RWMutex
\titems map[string]map[string]interface{}
\tnext  int
}

var store = &Store{items: make(map[string]map[string]interface{}), next: 1}

func main() {
\tr := gin.Default()

\t// Health check
\tr.GET("/health", func(c *gin.Context) {
\t\tc.JSON(http.StatusOK, gin.H{"status": "ok", "timestamp": time.Now()})
\t})

`;

  Object.entries(groups).forEach(([resource, eps]) => {
    const plural = resource.endsWith('s') ? resource : resource + 's';
    eps.forEach(ep => {
      const method = ep.method;
      const isById = ep.path.includes(':id');
      const ginPath = ep.path.replace(':id', ':id');
      code += `\t// ${ep.desc}\n\tr.${method}("/api${ginPath}", func(c *gin.Context) {\n`;
      if (method === 'GET' && !isById) {
        code += `\t\tstore.mu.RLock()\n\t\tdefer store.mu.RUnlock()\n\t\titems := make([]interface{}, 0)\n\t\tfor _, v := range store.items {\n\t\t\titems = append(items, v)\n\t\t}\n\t\tc.JSON(http.StatusOK, gin.H{"success": true, "data": items})\n`;
      } else if (method === 'POST') {
        code += `\t\tvar body map[string]interface{}\n\t\tif err := c.ShouldBindJSON(&body); err != nil {\n\t\t\tc.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})\n\t\t\treturn\n\t\t}\n\t\tstore.mu.Lock()\n\t\tid := fmt.Sprintf("%d", store.next)\n\t\tstore.next++\n\t\tbody["id"] = id\n\t\tstore.items[id] = body\n\t\tstore.mu.Unlock()\n\t\tc.JSON(http.StatusCreated, gin.H{"success": true, "data": body})\n`;
      } else if (method === 'GET' && isById) {
        code += `\t\tid := c.Param("id")\n\t\tstore.mu.RLock()\n\t\titem, ok := store.items[id]\n\t\tstore.mu.RUnlock()\n\t\tif !ok {\n\t\t\tc.JSON(http.StatusNotFound, gin.H{"error": "${resource} not found"})\n\t\t\treturn\n\t\t}\n\t\tc.JSON(http.StatusOK, gin.H{"success": true, "data": item})\n`;
      } else if (method === 'PUT') {
        code += `\t\tid := c.Param("id")\n\t\tvar body map[string]interface{}\n\t\tc.ShouldBindJSON(&body)\n\t\tstore.mu.Lock()\n\t\tif _, ok := store.items[id]; !ok {\n\t\t\tstore.mu.Unlock()\n\t\t\tc.JSON(http.StatusNotFound, gin.H{"error": "not found"})\n\t\t\treturn\n\t\t}\n\t\tfor k, v := range body { store.items[id][k] = v }\n\t\tstore.mu.Unlock()\n\t\tc.JSON(http.StatusOK, gin.H{"success": true, "data": store.items[id]})\n`;
      } else if (method === 'DELETE') {
        code += `\t\tid := c.Param("id")\n\t\tstore.mu.Lock()\n\t\tdelete(store.items, id)\n\t\tstore.mu.Unlock()\n\t\tc.JSON(http.StatusOK, gin.H{"success": true, "message": "deleted"})\n`;
      }
      code += `\t})\n\n`;
    });
  });

  const port = `os.Getenv("PORT")`;
  code += `\tport := ${port}\n\tif port == "" { port = "8080" }\n\tr.Run(":" + port)\n}\n`;
  return code;
}

// ── OpenAPI Generator ─────────────────────────────────────
function genOpenApi(name, endpoints) {
  const paths = {};
  endpoints.forEach(ep => {
    const p = ep.path.replace(':id', '{id}');
    if (!paths[p]) paths[p] = {};
    paths[p][ep.method.toLowerCase()] = {
      summary: ep.desc,
      tags: [ep.path.split('/')[1]],
      responses: { '200': { description: 'Success' } }
    };
  });

  return `openapi: 3.0.3
info:
  title: ${name || 'Generated API'}
  version: 1.0.0
  description: Generated by APIForge
servers:
  - url: http://localhost:3000/api
paths:
${Object.entries(paths).map(([path, methods]) =>
  `  ${path}:\n` + Object.entries(methods).map(([method, op]) =>
    `    ${method}:\n      summary: ${op.summary}\n      tags: [${op.tags.join(', ')}]\n      responses:\n        '200':\n          description: Success`
  ).join('\n')
).join('\n')}
`;
}

// ── README Generator ──────────────────────────────────────
function genReadme(name, lang, description, endpoints, useDocker) {
  const title = name || 'My API';
  const epList = endpoints.slice(0, 10).map(ep =>
    `| \`${ep.method}\` | \`/api${ep.path}\` | ${ep.desc} |`
  ).join('\n');

  const startCmd = lang === 'Python' ? 'uvicorn main:app --reload'
    : lang === 'Go' ? 'go run main.go'
    : 'npm run dev';

  return `# ${title}

> Generated by **APIForge** — ${new Date().toLocaleDateString()}

## Description

${description}

## Tech Stack

- **Language:** ${lang}
- **Framework:** ${lang === 'Python' ? 'FastAPI' : lang === 'Go' ? 'Gin' : 'Express.js'}

## Getting Started

\`\`\`bash
# Install dependencies
${lang === 'Python' ? 'pip install -r requirements.txt' : lang === 'Go' ? 'go mod download' : 'npm install'}

# Copy environment variables
cp .env.example .env

# Start development server
${startCmd}
\`\`\`

${useDocker ? `## Docker\n\n\`\`\`bash\ndocker-compose up --build\n\`\`\`\n` : ''}

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
${epList}

## License

MIT
`;
}
