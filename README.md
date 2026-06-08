# ResumeFlow — AI-Powered Job Tracker

A full-stack MERN application for tracking job applications with an AI mock interview coach, resume analyzer, and smart reminders.

---

## Features

- **Kanban pipeline** — drag jobs through Applied → Screening → Interview → Offer stages
- **List view** — sortable table view with filters
- **AI mock interviews** — real Claude AI-powered interview sessions with scoring (1–10) per answer
- **Resume AI scorer** — upload PDF, get skill breakdown, ATS check, keyword gap analysis
- **Bullet point improver** — paste any resume bullet, AI rewrites it with impact metrics
- **Analytics dashboard** — funnel chart, source breakdown, weekly trend line, AI insights
- **Reminders** — follow-up deadlines, offer deadlines, prep tasks with overdue detection
- **Job detail panel** — timeline, notes, resume match scores, contact info per job
- **JWT auth** — register, login, profile, change password

---

## Tech Stack

| Layer     | Technology                                    |
|-----------|-----------------------------------------------|
| Frontend  | React 18, Vite, Tailwind CSS, Zustand         |
| Routing   | React Router v6                               |
| Data      | TanStack Query (React Query v5)               |
| Charts    | Recharts                                      |
| Backend   | Node.js, Express 4                            |
| Database  | MongoDB + Mongoose                            |
| Auth      | JWT (jsonwebtoken) + bcryptjs                 |
| AI        | Anthropic Claude API (`claude-sonnet-4-20250514`) |
| File      | Multer + pdf-parse                            |
| Security  | Helmet, express-rate-limit, express-validator |

---

## Project Structure

```
resumeflow/
├── package.json              # Root — runs both server + client via concurrently
├── server/
│   ├── index.js              # Express app entry point
│   ├── .env.example          # Copy to .env and fill in
│   ├── models/
│   │   ├── User.js
│   │   ├── Job.js
│   │   ├── Interview.js
│   │   └── Reminder.js
│   ├── middleware/
│   │   └── auth.js           # JWT protect middleware
│   └── routes/
│       ├── auth.js
│       ├── jobs.js
│       ├── interview.js      # Claude AI sessions
│       ├── resume.js         # PDF upload + AI analysis
│       ├── analytics.js
│       └── reminders.js
└── client/
    ├── vite.config.js        # Proxies /api → localhost:5000
    ├── tailwind.config.js
    └── src/
        ├── main.jsx
        ├── App.jsx           # Routes + auth guards
        ├── index.css
        ├── utils/
        │   ├── api.js        # Axios instance with JWT interceptor
        │   └── constants.js  # Colors, helpers, stage config
        ├── context/
        │   └── authStore.js  # Zustand auth store
        ├── components/
        │   ├── layout/
        │   │   └── Layout.jsx
        │   └── jobs/
        │       ├── JobCard.jsx
        │       ├── JobDetailPanel.jsx
        │       ├── AddJobModal.jsx
        │       └── StageBadge.jsx
        └── pages/
            ├── LoginPage.jsx
            ├── RegisterPage.jsx
            ├── PipelinePage.jsx
            ├── AnalyticsPage.jsx
            ├── InterviewPage.jsx
            ├── InterviewSessionPage.jsx
            ├── ResumePage.jsx
            ├── RemindersPage.jsx
            └── ProfilePage.jsx
```

---

## Setup Instructions

### Prerequisites

- **Node.js** v18 or higher
- **MongoDB** running locally (`mongod`) OR a MongoDB Atlas connection string
- **Anthropic API key** — get one at https://console.anthropic.com

---

### 1. Clone and install

```bash
# Clone the repo
git clone https://github.com/yourname/resumeflow.git
cd resumeflow

# Install all dependencies (root + server + client)
npm run install-all
```

---

### 2. Configure the server

```bash
cd server
cp .env.example .env
```

Edit `server/.env`:

```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/resumeflow
JWT_SECRET=your_super_secret_key_here_make_it_long
JWT_EXPIRES_IN=7d
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxx
CLIENT_URL=http://localhost:5173
NODE_ENV=development
```

> **MongoDB Atlas**: Replace `MONGO_URI` with your Atlas connection string:
> `mongodb+srv://username:password@cluster.mongodb.net/resumeflow`

---

### 3. Start development

From the root directory:

```bash
npm run dev
```

This starts both:
- **Server** on http://localhost:5000
- **Client** on http://localhost:5173

Open http://localhost:5173 in your browser.

---

### 4. Create your account

- Click **Sign up free** on the login page
- Register with any name, email, and password (min 6 chars)
- You're in!

---

## API Reference

### Auth
| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Login, returns JWT |
| GET | `/api/auth/me` | Get current user |
| PUT | `/api/auth/profile` | Update name, title, skills, preferences |
| PUT | `/api/auth/change-password` | Change password |

### Jobs
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/jobs` | List all jobs (filter: stage, source, search) |
| POST | `/api/jobs` | Create job |
| GET | `/api/jobs/:id` | Get single job |
| PUT | `/api/jobs/:id` | Update job |
| PATCH | `/api/jobs/:id/stage` | Update stage only |
| DELETE | `/api/jobs/:id` | Delete job |
| POST | `/api/jobs/:id/notes` | Add note |
| DELETE | `/api/jobs/:id/notes/:noteId` | Delete note |
| POST | `/api/jobs/:id/timeline` | Add timeline event |

### Interview
| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/interview/start` | Start AI interview session |
| POST | `/api/interview/:id/message` | Send answer, get AI response + score |
| GET | `/api/interview` | List all sessions |
| GET | `/api/interview/:id` | Get session with full chat |
| DELETE | `/api/interview/:id` | Delete session |

### Resume
| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/resume/upload` | Upload PDF/TXT resume |
| POST | `/api/resume/analyze` | AI analysis (skill scores, ATS, suggestions) |
| POST | `/api/resume/improve` | Rewrite a bullet point |
| GET | `/api/resume` | Resume status and score |

### Analytics
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/analytics/overview` | Full stats: funnel, rates, weekly data |
| GET | `/api/analytics/insights` | AI-style insights |

### Reminders
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/reminders` | List reminders (filter: upcoming, completed) |
| POST | `/api/reminders` | Create reminder |
| PATCH | `/api/reminders/:id/complete` | Mark complete |
| DELETE | `/api/reminders/:id` | Delete |

---

## Production Build

```bash
# Build the React client
npm run build

# The built files go to client/dist/
# Serve them from your Node server or deploy to Vercel/Netlify
```

To serve the built client from Express, add to `server/index.js`:

```js
const path = require('path');
app.use(express.static(path.join(__dirname, '../client/dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});
```

---

## Deployment

### Backend (Railway / Render / Heroku)
1. Deploy the `server/` folder
2. Set all `.env` variables in the dashboard
3. Set `CLIENT_URL` to your frontend domain

### Frontend (Vercel / Netlify)
1. Deploy the `client/` folder
2. Set build command: `npm run build`
3. Set output directory: `dist`
4. Add env variable: `VITE_API_URL=https://your-backend.railway.app/api`

Then update `client/src/utils/api.js` baseURL:
```js
baseURL: import.meta.env.VITE_API_URL || '/api',
```

---

## Rate Limits

- General API: **100 requests / 15 minutes** per IP
- AI endpoints (interview, resume analyze): **10 requests / minute** per IP

---

## License

MIT
