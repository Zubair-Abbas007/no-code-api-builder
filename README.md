# 🚀 No-Code API Builder

A backend system that allows users to create and manage REST APIs dynamically **without writing code**.

This project demonstrates how APIs can be generated at runtime based on user-defined configurations — making backend development faster and more flexible.

---

## 📌 Features

- ✅ Create API endpoints dynamically
- ✅ Support for multiple HTTP methods (GET, POST, PUT, DELETE)
- ✅ Define custom fields for each API
- ✅ Store API configurations
- ✅ Auto-generate working routes
- ✅ Perform CRUD operations on APIs
- ✅ Error handling and validation
- ✅ Unit testing with Jest
- ✅ CI/CD pipeline using GitHub Actions
- ✅ Live deployment on cloud

---

## 🧠 How It Works

1. User creates an API definition:
   - Endpoint name
   - HTTP method
   - Required fields

2. Server stores this configuration

3. A dynamic route is generated automatically

4. User can call the API like a normal REST endpoint

---

## 📥 Example Usage

### Create API
```json
POST /create-api
{
  "name": "users",
  "method": "POST",
  "fields": ["name", "email"]
}
