---
description: Create a new API endpoint that fully complies with project standard
---

Steps
1. Clarify requirements
Before writing any code, confirm:

HTTP method and path: e.g. POST /api/orders
Request body / query params shape
Response shape on success and error
Does it require authentication?
Any business rules or validations?

2. Create Zod validator
File: backend/src/validators/[resource].validator.ts

Define schema for request body / query params
Export the inferred TypeScript type from the schema
Add all necessary validations: required fields, min/max length, enum values, etc.

3. Create or update Service
File: backend/src/services/[resource].service.ts

Implement business logic here — no req/res objects
Use parameterized DB queries only
Handle errors by throwing typed custom errors (not returning them)
Keep each service function focused on one responsibility

4. Create Controller
File: backend/src/controllers/[resource].controller.ts

Import and call the validator — reject invalid input immediately (400)
Call the service function
Return consistent JSON: { success: true, data: result }
Wrap in asyncHandler() or try/catch — never let unhandled promises crash the server

5. Create or update Router
File: backend/src/routes/[resource].routes.ts

Register the route with correct HTTP method
Apply auth middleware if required
Apply rate limiting if it's a public or auth endpoint

6. Register Router in app.ts

Mount the router at the correct base path: /api/[resource]

7. Test the endpoint

Open browser DevTools Network tab (or use the app UI)
Send a valid request → verify 200/201 + correct response shape
Send invalid input → verify 400 + descriptive error message
Send request without auth token (if protected) → verify 401
Check no stack trace or sensitive data in error response

8. Summarize
Create a brief artifact:

Endpoint created: METHOD /api/path
Validator: what fields, what rules
Service: what it does
Auth required: yes/no
Test result: ✅ / ⚠️ / ❌