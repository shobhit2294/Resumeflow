# CareerPilot

CareerPilot is a self-hosted AI career assistant for managing the complete job application journey.

It helps a job seeker store a resume, compare it with a job description, understand missing skills, tailor a resume, apply to a job, track application progress, practise interviews, and measure improvement over time.

## The complete user journey

The main flow is:

    Register or log in
            |
            v
    Add or upload your resume
            |
            v
    Open a job in Job Portal
            |
            v
    Compare resume with the job description
            |
            +-------------------------------+
            |                               |
            v                               v
    Improve the resume first          Apply without changes
            |                               |
            v                               |
    Review missing skills and gaps          |
            |                               |
            v                               |
    Create a tailored resume                |
            |                               |
            v                               |
    Save it or download it as PDF           |
            |                               |
            +---------------+---------------+
                            |
                            v
                    Submit the application
                            |
                            v
                    Track application stage
                            |
                            v
                    Reach interview stage
                            |
                            v
                    Practise with AI Interview
                            |
                            v
                    Review analytics and improve

This flow lets the user decide whether to improve the resume before applying. Both choices remain available.

## What CareerPilot provides

### Application pipeline

Track applications through useful stages such as:

- Wishlist
- Applied
- Screening
- Interview
- Offer
- Rejected

Each application can keep the company, role, job description, salary details, recruiter information, notes, dates, and current status.

### Job Portal

Job Portal is the single place for reviewing and applying to jobs. The separate duplicate Find Jobs page has been removed so users do not have to choose between two screens with the same purpose.

Before applying, CareerPilot can compare the saved resume with the selected job description and show:

- Overall match score
- Matching skills
- Missing skills
- Resume evidence
- Recommended improvements

### Resume comparison and tailoring

When a job has skill gaps, the user can choose to improve the resume first.

CareerPilot creates a reviewable tailored resume draft based on the existing resume and the job description. It is designed to improve wording and relevance without inventing experience.

The user can:

- Edit the generated draft
- Review changes
- Review skills that still need to be learned or verified
- Save the draft as the main resume
- Download the resume as a PDF
- Apply without changing the resume

### AI interview practice

After an application reaches the interview stage, the user can practise multiple times with AI-generated questions.

Each practice session can provide feedback about:

- Clarity
- Structure
- Technical correctness
- Problem-solving approach
- Relevance to the role
- Communication quality

The user can repeat practice sessions and compare results instead of relying on one practice attempt.

### Analytics and improvement tracking

Analytics shows how the job search is progressing and where improvement is needed.

It can include:

- Application stage breakdown
- Application movement over time
- Interview practice scores
- Score improvement between sessions
- Repeated weak areas
- Recommended next actions

The goal is to turn every application and interview attempt into useful feedback for the next attempt.

### Career support tools

CareerPilot also includes tools for:

- Company research
- Job readiness analysis
- Referral and outreach messages
- Follow-up messages
- Interview debriefs
- Thank-you notes
- Offer and salary negotiation preparation
- Reminders

## Authentication

CareerPilot uses normal email and password authentication.

- A new user registers with name, email, password, and optional job title.
- A returning user logs in with email and password.
- Existing password-based accounts continue to use the same login flow.
- OTP authentication is not part of the application.

## Themes and interface

The interface supports both light and dark themes.

- Desktop users can change the theme from the Appearance control in the top bar.
- Mobile users can use the theme icon in the mobile header.
- The theme choice is saved in the browser for the next visit.
- The interface uses simple icons and responsive layouts for desktop and mobile screens.

## Technology stack

### Frontend

- React 18 for the web interface
- Vite for development and production builds
- React Router for page navigation
- Tailwind CSS for responsive styling
- TanStack Query for server data and cache management
- Zustand for authentication state
- Recharts for analytics graphs
- Lucide React for interface icons

### Backend

- Node.js
- Express
- Mongoose
- Socket.IO for real-time updates
- JWT for protected sessions
- bcryptjs for password hashing
- Groq SDK for AI-powered analysis and generation
- PDFKit for resume PDF creation

### Data and infrastructure

- MongoDB for users, resumes, jobs, applications, interviews, and analytics data
- Redis for caching and Socket.IO support
- Nginx as the reverse proxy and frontend server
- Docker Compose for the complete local deployment

## System flow

    Browser
       |
       v
    Nginx on port 80
       |
       +--> React frontend files
       |
       +--> Node.js API servers
                    |
                    +--> MongoDB
                    |
                    +--> Redis
                    |
                    +--> Groq AI API when an AI feature is used

The Docker setup runs three API server instances behind Nginx. MongoDB stores permanent application data, Redis supports fast temporary data and real-time communication, and the frontend is built into static files served by Nginx.

## Project structure

- client/
  - React frontend
  - Pages, components, authentication state, API helpers, theme styles, and analytics views
- server/
  - Express API
  - Database models, routes, authentication, resume analysis, interview logic, and analytics
- nginx/
  - Reverse proxy configuration
- docker-compose.yml
  - Docker services for the frontend build, Nginx, API servers, MongoDB, and Redis

## Running with Docker

Docker is the recommended way to run CareerPilot because it starts the frontend, backend, MongoDB, Redis, and Nginx together.

### Requirements

- Docker Desktop
- A Groq API key for AI features
- A JWT secret for authentication

### Setup

1. Open a terminal in the project folder.
2. Create or update the environment file used by Docker.
3. Set GROQ_API_KEY and JWT_SECRET.
4. Start the services with the Docker Compose command.
5. Open http://localhost in a browser.

The main Docker command is:

    docker compose up -d --build

To view service status:

    docker compose ps

To view service logs:

    docker compose logs -f

To stop the services:

    docker compose down

The MongoDB and Redis data volumes are kept by Docker when the services are stopped.

## Running locally without Docker

Install the dependencies from the project root:

    npm install
    cd server
    npm install
    cd ../client
    npm install

Start the backend and frontend from the project root:

    npm run dev

The development addresses are normally:

- Frontend: http://localhost:5173
- Backend: http://localhost:5000

When running without Docker, MongoDB and Redis must already be available and the server environment variables must be configured.

## Important environment variables

- PORT: API server port
- NODE_ENV: development or production mode
- MONGO_URI: MongoDB connection string
- JWT_SECRET: secret used to sign login tokens
- JWT_EXPIRES_IN: token lifetime, such as 7d
- GROQ_API_KEY: key for AI analysis and generation
- REDIS_URL: Redis connection URL
- CLIENT_URL: frontend URL allowed by the API

## Main API areas

- Authentication: registration, login, current user, profile, and password change
- Resume: resume content, resume-to-job comparison, tailored resume drafts, and PDF download
- Job Portal: job listings, resume comparison before applying, applications, and application stages
- Jobs: application cards, notes, stages, and backup import
- Readiness: job readiness analysis and saved reports
- Interviews: practice sessions, answers, scoring, and feedback
- Analytics: application funnel, interview progress, improvement areas, and insights
- Company Intel: company research, follow-ups, interview debriefs, referral messages, and negotiation support
- Recommendations: job suggestions based on profile and skill overlap

## Testing and verification

The project can be checked with:

    cd client
    npm run build

    cd ../server
    npm test

The Docker deployment can be checked with:

    docker compose up -d --build
    docker compose ps

The API health endpoint is available at:

    http://localhost/api/health

## Product principles

- Keep the application workflow in one clear place.
- Show the resume and job match before the user applies.
- Let the user decide whether to improve the resume or apply immediately.
- Never present generated resume content as verified experience unless the user confirms it.
- Make interview practice repeatable and measurable.
- Use analytics to show progress and recommend the next improvement.
- Keep authentication simple with normal password login and registration.
- Keep the entire application runnable through Docker.

## License

This project is licensed under the MIT License.
