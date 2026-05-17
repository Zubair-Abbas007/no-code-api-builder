# ⚡ No-Code API Builder

A real-world web application that lets users **create, manage, and test REST API mock endpoints visually** — no coding required.

Built with **Node.js + Express** backend and a vanilla JS/HTML/CSS frontend.

---

## 🚀 Features

- ➕ Create mock API endpoints (GET, POST, PUT, DELETE, PATCH)
- ✏️ Edit and update existing endpoints
- 🗑️ Delete endpoints
- 🧪 Test mock endpoints directly from the browser
- 📋 View all registered endpoints with method badges
- ✅ Input validation with helpful error messages

---

## 🛠️ Tech Stack

| Layer    | Technology          |
|----------|---------------------|
| Backend  | Node.js + Express   |
| Frontend | HTML + CSS + Vanilla JS |
| Testing  | Jest + Supertest    |
| Linting  | ESLint              |
| CI/CD    | GitHub Actions      |
| Deploy   | Render.com          |

---

## 📁 Project Structure

```
no-code-api-builder/
├── server/
│   ├── index.js              # Express app entry point
│   ├── routes/
│   │   ├── endpoints.js      # CRUD routes for endpoints
│   │   └── mock.js           # Mock response handler
│   └── store/
│       └── endpointStore.js  # In-memory data store + business logic
├── public/
│   ├── index.html            # Frontend UI
│   ├── style.css             # Dark-theme styles
│   └── app.js                # Frontend JavaScript
├── tests/
│   ├── endpointStore.test.js # Unit tests (store functions)
│   └── api.test.js           # Integration tests (HTTP routes)
├── .github/
│   └── workflows/
│       └── ci-cd.yml         # GitHub Actions CI/CD pipeline
├── .eslintrc.json
├── render.yaml               # Render.com deployment config
├── Deployment_URL.txt
└── package.json
```

---

## ⚙️ Local Setup

```bash
# 1. Clone the repo
git clone https://github.com/YOUR_USERNAME/no-code-api-builder.git
cd no-code-api-builder

# 2. Install dependencies
npm install

# 3. Start development server
npm run dev

# 4. Open in browser
# http://localhost:3000
```

---

## 🧪 Running Tests

```bash
npm test
```

Tests cover:
- `validateEndpointData` — normal, edge, invalid cases
- `createEndpoint` — including duplicate detection
- `updateEndpoint` — partial updates, not-found, conflict
- `deleteEndpoint` — success, not-found, isolation
- `findMatchingEndpoint` — exact match, parametric paths, method mismatch
- `getEndpointById` — found, not-found, null input
- HTTP routes — all CRUD endpoints + mock handler

---

## 🔄 CI/CD Pipeline

```
Push to main
    │
    ├── 🔍 Lint (ESLint)          ─┐
    │                              ├── Run in parallel
    └── 🧪 Test (Jest + coverage) ─┘
              │
              ▼ (both must pass)
         🏗️ Build (verify artifacts)
              │
              ▼ (main branch only)
         🚀 Deploy → Render.com
```

---

## 🌐 Live URL

See `Deployment_URL.txt` for the live application URL.

---

## 📸 AI Interactions

All AI interactions (code generation, refactoring, test generation, pipeline optimisation)
are documented with screenshots in the `pics/` folder.
