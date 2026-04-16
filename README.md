# 🏙️ CityPulse AI — SheharSetu Urban Intelligence Platform

> AI-driven civic issue reporting and urban management platform with real-time insights, automated classification, and an admin command center.

![CityPulse AI](https://img.shields.io/badge/CityPulse-AI%20Urban%20Intelligence-2563eb?style=for-the-badge)
![React](https://img.shields.io/badge/React-18-61dafb?style=flat-square&logo=react)
![Node.js](https://img.shields.io/badge/Node.js-20-339933?style=flat-square&logo=node.js)
![MongoDB](https://img.shields.io/badge/MongoDB-7-47A248?style=flat-square&logo=mongodb)

---

## 📸 Screenshots

| Login | Dashboard | Report Issue |
|-------|-----------|--------------|
| Split-panel login with OTP | City Health Index with live metrics | AI-powered issue classification |

---

## 🗂️ Project Structure

```
sheharsetu/
├── frontend/          React + Tailwind + Vite
│   └── src/
│       ├── pages/     All page components
│       ├── components/layout/  Sidebar, TopNav, AdminLayout
│       ├── context/   AuthContext
│       ├── services/  api.js (Axios)
│       └── utils/     helpers.js
│
├── backend/           Node.js + Express + MongoDB
│   ├── controllers/   Business logic
│   ├── routes/        API route definitions
│   ├── models/        Mongoose schemas
│   ├── middleware/    auth.js, upload.js
│   ├── services/      aiService.js
│   └── utils/         seed.js
│
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)
- npm or yarn

### 1. Clone & Setup Environment

```bash
git clone <repo-url>
cd sheharsetu

# Copy and configure environment files
cp .env.example backend/.env
cp frontend/.env.example frontend/.env
```

Edit `backend/.env`:
```env
MONGODB_URI=mongodb://localhost:27017/sheharsetu
JWT_SECRET=your_super_secret_key_here
```

### 2. Start Backend

```bash
cd backend
npm install
npm run seed    # Seeds demo data + users
npm run dev     # Starts on http://localhost:5000
```

### 3. Start Frontend

```bash
cd frontend
npm install
npm run dev     # Starts on http://localhost:5173
```

Open **http://localhost:5173** in your browser.

---

## 🔐 Demo Credentials

| Role    | Email                           | Password     |
|---------|---------------------------------|--------------|
| Admin   | admin@citypulse.gov             | admin123     |
| Manager | a.moore@infrastructure.gov      | manager123   |
| Citizen | rahul@citizen.in                | citizen123   |

> **Guest access**: Click "Continue as Guest" on the login page.

---

## 🐳 Docker Setup

```bash
cp .env.example .env
docker-compose up --build
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:5000/api
- MongoDB: localhost:27017

---

## 📡 API Endpoints

### Auth
| Method | Endpoint              | Description           |
|--------|----------------------|-----------------------|
| POST   | /api/auth/register    | Register new user     |
| POST   | /api/auth/login       | Login with email+pass |
| POST   | /api/auth/otp/send    | Send OTP to email     |
| POST   | /api/auth/otp/verify  | Verify OTP            |
| POST   | /api/auth/guest       | Guest login           |
| GET    | /api/auth/me          | Get current user      |

### Issues
| Method | Endpoint                    | Description              |
|--------|-----------------------------|--------------------------|
| POST   | /api/issues/report          | Report new issue         |
| GET    | /api/issues                 | Get all issues (admin)   |
| GET    | /api/issues/:id             | Get issue by ID          |
| GET    | /api/issues/track/:ticketId | Public complaint tracking|
| PATCH  | /api/issues/:id/status      | Update issue status      |
| PATCH  | /api/issues/:id/reassign    | Reassign to department   |

### AI Services
| Method | Endpoint          | Description                    |
|--------|-------------------|--------------------------------|
| POST   | /api/ai/classify  | Classify issue text            |
| POST   | /api/ai/detect    | Detect waste in image (mock)   |
| POST   | /api/ai/sentiment | Sentiment analysis             |

### Analytics
| Method | Endpoint                 | Description              |
|--------|--------------------------|--------------------------|
| GET    | /api/analytics/summary   | Dashboard stats          |
| GET    | /api/analytics/zones     | Live zone status         |

### Users (Admin)
| Method | Endpoint              | Description         |
|--------|-----------------------|---------------------|
| GET    | /api/users            | Get all users       |
| POST   | /api/users/invite     | Invite a user       |
| PATCH  | /api/users/:id        | Update user role    |

---

## 🧠 AI Classification

The AI service uses rule-based keyword matching to classify issues:

**Categories**: `waste`, `water`, `electricity`, `roads`, `infrastructure`, `public_safety`, `parks`, `traffic`

**Priority levels**: `critical`, `high`, `medium`, `low`

To extend with a real AI API (e.g., OpenAI), edit `backend/services/aiService.js`.

---

## 🖥️ Pages

| Page | Route | Access |
|------|-------|--------|
| Home / Landing | `/` | Public |
| Login | `/login` | Public |
| Report Issue | `/report` | Public |
| Track Complaint | `/track` | Public |
| Dashboard | `/dashboard` | Admin |
| Issue Logs | `/issues` | Admin |
| Issue Detail | `/issues/:id` | Admin |
| Map View | `/map` | Admin |
| Analytics | `/analytics` | Admin |
| User Management | `/users` | Admin |
| AI Analysis | `/ai-analysis` | Admin |

---

## 🛠️ Tech Stack

**Frontend**
- React 18 + Vite
- Tailwind CSS (custom design system)
- React Router v6
- React Hook Form
- Axios
- Recharts

**Backend**
- Node.js + Express
- MongoDB + Mongoose
- JWT Authentication
- Multer (file uploads)
- bcryptjs

**AI Services**
- Rule-based text classification
- Mock image detection (extensible)
- Sentiment analysis

---

## 📁 Key Files

```
backend/services/aiService.js      — AI classification logic
backend/models/Issue.js            — Issue schema with auto ticket IDs
backend/utils/seed.js              — Demo data seeder
frontend/src/services/api.js       — All API calls
frontend/src/context/AuthContext   — Global auth state
frontend/src/utils/helpers.js      — Shared constants & formatters
```

---

## 🔮 Extending the Platform

1. **Real AI**: Replace `aiService.js` logic with OpenAI/Gemini API calls
2. **Maps**: Integrate Mapbox or Google Maps in `MapViewPage.jsx`
3. **SMS**: Add Twilio to `authController.js` for real OTP delivery
4. **Notifications**: Add Socket.io for real-time status updates
5. **PWA**: Add service worker for offline reporting

---

## 📄 License

MIT © 2024 Digital Curator Systems
