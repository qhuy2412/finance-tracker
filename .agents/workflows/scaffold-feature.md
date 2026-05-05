---
description: Scaffold a full-stack feature — Express API route + React page — from just a feature name
---

---
description: Scaffold a full-stack feature — Express API route + React page — from just a feature name.
---

1. Ask the user:
   - Feature name? (e.g. "invoices", "products", "orders")
   - Auth required on API? (yes / no)
   - Any specific fields? (e.g. "name, price, quantity" — or say "figure it out")

2. Read existing project structure to match conventions:
   - Scan backend/src/routes/, controllers/, services/, models/ (or equivalent)
   - Scan frontend/src/pages/, components/, services/
   - Read one existing feature file end-to-end to understand the naming and pattern

3. Show the planned files before creating anything:

   Backend:
   - backend/src/validators/[feature].validator.js  → express-validator or Joi rules
   - backend/src/services/[feature].service.js      → DB logic, business rules
   - backend/src/controllers/[feature].controller.js → req/res, calls service
   - backend/src/routes/[feature].routes.js         → Express router
   - Register in backend/src/app.js (or index.js)

   Frontend:
   - frontend/src/services/[feature].service.js     → axios/fetch API calls
   - frontend/src/hooks/use[Feature].js             → custom hook (useState + useEffect or React Query)
   - frontend/src/pages/[Feature]Page.jsx           → list page with loading + error + empty states
   - frontend/src/components/[Feature]Card.jsx      → reusable card component
   - Add route in frontend/src/App.jsx

   Ask: "Looks good? Proceed? (yes / adjust)"

4. Create backend files in order:

   Validator — use express-validator or plain if/else checks:
   ```js
   // example with express-validator
   const { body } = require('express-validator')
   const create[Feature]Rules = [
     body('name').notEmpty().withMessage('name is required'),
     // add fields...
   ]
   module.exports = { create[Feature]Rules }
   ```

   Service — all DB logic here, no req/res:
   ```js
   // Pure functions, easy to test
   async function getAll() { ... }
   async function getById(id) { ... }
   async function create(data) { ... }
   async function update(id, data) { ... }
   async function remove(id) { ... }
   module.exports = { getAll, getById, create, update, remove }
   ```

   Controller — thin, just calls service and returns JSON:
   ```js
   const { validationResult } = require('express-validator')
   const service = require('../services/[feature].service')

   exports.getAll = async (req, res) => {
     try {
       const data = await service.getAll()
       res.json({ success: true, data })
     } catch (err) {
       res.status(500).json({ success: false, error: err.message })
     }
   }
   // repeat for getById, create, update, remove
   ```

   Router:
   ```js
   const router = require('express').Router()
   const ctrl = require('../controllers/[feature].controller')
   const { create[Feature]Rules } = require('../validators/[feature].validator')
   const auth = require('../middleware/auth') // only if needed

   router.get('/', ctrl.getAll)
   router.get('/:id', ctrl.getById)
   router.post('/', create[Feature]Rules, ctrl.create)
   router.put('/:id', ctrl.update)
   router.delete('/:id', ctrl.remove)

   module.exports = router
   ```

   Register in app.js:
   ```js
   app.use('/api/[feature]', require('./routes/[feature].routes'))
   ```

5. Create frontend files:

   API service (axios):
   ```js
   import axios from '../lib/axios' // use existing axios instance with baseURL

   export const get[Feature]List = () => axios.get('/api/[feature]')
   export const get[Feature]ById = (id) => axios.get(`/api/[feature]/${id}`)
   export const create[Feature] = (data) => axios.post('/api/[feature]', data)
   export const update[Feature] = (id, data) => axios.put(`/api/[feature]/${id}`, data)
   export const delete[Feature] = (id) => axios.delete(`/api/[feature]/${id}`)
   ```

   Custom hook:
   ```js
   import { useState, useEffect } from 'react'
   import { get[Feature]List } from '../services/[feature].service'

   export function use[Feature]() {
     const [data, setData] = useState([])
     const [loading, setLoading] = useState(true)
     const [error, setError] = useState(null)

     useEffect(() => {
       get[Feature]List()
         .then(res => setData(res.data.data))
         .catch(err => setError(err.message))
         .finally(() => setLoading(false))
     }, [])

     return { data, loading, error }
   }
   ```

   Card component — show key fields, keep simple.
   Page component — use the hook, handle loading/error/empty, render list of cards.
   Add route in App.jsx.

6. Start dev servers and open browser to verify page renders.
// turbo
7. Run `npm run dev` in both frontend and backend if not running.

8. Navigate browser to http://localhost:5173/[feature] and take screenshot.

9. Report:
   - Files created: [full list with paths]
   - API: GET POST PUT DELETE /api/[feature]
   - Frontend route: /[feature]
   - Auth: yes / no
   - Screenshot: [attach]
   - Next: add real DB queries inside service functions