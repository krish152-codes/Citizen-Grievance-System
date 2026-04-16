# 🛠️ Troubleshooting Guide — CityPulse AI

## 🔴 Problem: "Cannot connect to backend" on Login page

**Cause:** The backend server isn't running.

**Fix:**
```bash
# Open a NEW terminal, navigate to the backend folder:
cd sheharsetu/backend

# Install dependencies (first time only):
npm install

# Seed demo users into database:
npm run seed

# Start the backend:
npm run dev
```

You should see:
```
🚀 SheharSetu server running on http://localhost:5000
✅ MongoDB connected: localhost
```

Now go back to the browser — the green "Backend connected ✓" indicator will appear.

---

## 🔴 Problem: "MongoServerError" or MongoDB connection fails

**Cause:** MongoDB isn't installed or isn't running.

### Option A — Install MongoDB locally (recommended)
- Mac: `brew tap mongodb/brew && brew install mongodb-community && brew services start mongodb-community`
- Windows: Download from https://www.mongodb.com/try/download/community
- Ubuntu: `sudo apt install mongodb && sudo systemctl start mongodb`

### Option B — Use MongoDB Atlas (free cloud database)
1. Go to https://cloud.mongodb.com and create a free account
2. Create a free M0 cluster
3. Get your connection string: `mongodb+srv://username:password@cluster.mongodb.net/sheharsetu`
4. Edit `backend/.env`:
   ```
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/sheharsetu
   ```
5. Restart the backend

---

## 🔴 Problem: Login fails with "Invalid credentials"

**Cause:** Database hasn't been seeded yet.

**Fix:**
```bash
cd sheharsetu/backend
npm run seed
```

This creates these users:
| Email | Password | Role |
|-------|----------|------|
| admin@citypulse.gov | admin123 | Admin |
| a.moore@infrastructure.gov | manager123 | Manager |
| rahul@citizen.in | citizen123 | Citizen |

---

## 🔴 Problem: CORS error in browser console

**Cause:** Frontend URL doesn't match backend CORS config.

**Fix — check `backend/.env`:**
```env
FRONTEND_URL=http://localhost:5173
```

If your frontend runs on a different port (e.g. 3000):
```env
FRONTEND_URL=http://localhost:3000
```

Restart the backend after changing `.env`.

---

## 🔴 Problem: Frontend shows blank page or crashes

**Fix:**
```bash
cd sheharsetu/frontend

# Make sure .env exists:
cp .env.example .env

# Reinstall:
rm -rf node_modules
npm install
npm run dev
```

---

## 🔴 Problem: `npm run seed` fails

**Common causes:**

1. **MongoDB not running** — Start MongoDB first (see above)
2. **Wrong MONGODB_URI** — Check `backend/.env`
3. **Port conflict** — Another app using port 5000

**Fix port conflict:**
```bash
# Find what's on port 5000:
lsof -i :5000        # Mac/Linux
netstat -ano | findstr :5000  # Windows

# Change backend port in .env:
PORT=5001
```
Then update frontend `.env`:
```env
VITE_API_BASE_URL=http://localhost:5001/api
```

---

## 🔴 Problem: "Module not found" errors

**Fix:**
```bash
# Backend:
cd sheharsetu/backend
rm -rf node_modules package-lock.json
npm install

# Frontend:
cd sheharsetu/frontend
rm -rf node_modules package-lock.json
npm install
```

---

## 🔴 Problem: Frontend can't reach backend (network error)

**Check `frontend/.env`:**
```env
VITE_API_BASE_URL=http://localhost:5000/api
```

> ⚠️ Do NOT use `/api` as the base URL. Always use the full `http://localhost:5000/api`.

---

## ✅ Verify Everything Works

1. **Backend health check** — Open in browser:
   ```
   http://localhost:5000/api/health
   ```
   Should return: `{"success":true,"message":"SheharSetu API is operational"}`

2. **Frontend** — Open:
   ```
   http://localhost:5173
   ```
   Should show the login page with green "Backend connected ✓" badge.

3. **Test login:**
   - Email: `admin@citypulse.gov`
   - Password: `admin123`
   - Should redirect to `/dashboard`

---

## 📁 Required File Structure Check

Make sure these files exist:
```
sheharsetu/
├── backend/
│   ├── .env          ← MUST EXIST (copy from .env.example)
│   ├── server.js
│   └── node_modules/ ← created after npm install
│
├── frontend/
│   ├── .env          ← MUST EXIST (copy from .env.example)
│   ├── vite.config.js
│   └── node_modules/ ← created after npm install
```

---

## 🆘 Still stuck?

Run this diagnostic command:
```bash
# Check Node version (need 18+)
node -v

# Check if backend is running
curl http://localhost:5000/api/health

# Check if MongoDB is running (Mac/Linux)
pgrep mongod && echo "MongoDB running" || echo "MongoDB NOT running"
```
