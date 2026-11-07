# ResumeFlow

ResumeFlow is a self-hosted job search tool made for people who are applying to many jobs and want a cleaner way to stay on top of everything.

Instead of managing jobs in a messy spreadsheet, you can keep everything in one place: applications, contacts, notes, resume match results, interview prep, and follow-ups.

It is built to make the job search process less stressful and more organized.

## What this app does

ResumeFlow helps you with the full job hunt:

- Track job applications from the moment you apply to the final response
- Save recruiter details, notes, interview dates, salary info, and follow-up status
- See which jobs are moving forward and which ones are going cold
- Compare your resume with a job description and check what matches
- Identify missing skills and know what to improve before interviews
- Practice job-specific questions and get feedback on your answers
- Search live jobs and spot suspicious or low-quality listings
- Prepare referral messages, interview debriefs, negotiation help, and outreach notes

## Why this project exists

A lot of people lose track of jobs because they are spread across email, LinkedIn, job boards, and random notes.

Sometimes tools only help with tracking, but they do not help with resume matching or interview preparation. Other tools help with writing, but they do not manage the whole application process.

ResumeFlow tries to bring all of it together in one place so you can focus on the actual job search instead of admin work.

## Main features

### Job tracking

You can organize applications through stages like:

- Wishlist
- Applied
- Screening
- Interview
- Offer
- Rejected

Each job card can hold all the important details, such as company name, role, salary, recruiter contact, notes, and timeline.

### Resume and job matching

The app checks your resume against a job description and shows:

- what matches well
- what is missing
- which skills are weak or underdeveloped
- what to work on before the interview

This helps you apply more strategically instead of blindly sending resumes everywhere.

### Interview preparation

You can practice questions based on the actual role you are targeting.

After answering, the app gives feedback on things like:

- clarity
- technical correctness
- structure
- problem-solving approach
- relevance to the role

This makes interview prep more realistic and more useful.

### Follow-up and outreach

ResumeFlow also supports:

- referral message drafting
- follow-up emails
- thank-you notes
- interview debrief summaries
- counter-offer and negotiation support

This is helpful when you want to stay proactive without sounding generic.

### Live job search

The app can pull in new job listings and highlight suspicious or low-quality ones.

This helps save time and avoid wasting effort on roles that are likely not worth pursuing.

## Tech stack

This project uses a practical modern stack that is easy to build, easy to run, and good for real-world job-search workflows.

### Frontend

- React: used to build the user interface and make the app feel fast and interactive.
- Vite: helps the frontend load quickly during development and makes the build process simple.
- Tailwind CSS: gives a clean UI with fast styling and responsive layout without a lot of custom CSS overhead.

Why this works well: the app is a dashboard-style product with lots of forms, cards, filters, and interactive panels, so React plus Tailwind is a strong fit.

### Backend

- Node.js: used for the server side because it works well with JavaScript-based apps and is quick to build with.
- Express: handles the API routes, authentication, job logic, and data processing.
- Socket.IO: used for real-time communication features, such as live updates and event-driven flows.
- WebRTC: used where real-time voice or video interaction is needed, especially for interview-style features and live communication experiences.

Why this works well: the app needs live interactions, quick API responses, and background processing, and Node.js + Express is well suited for that.

### Database and caching

- MongoDB: stores users, jobs, interviews, resumes, notes, and application data in a flexible document-based format.
- Redis: used for OTP codes, temporary sessions, fast in-memory caching, and support for real-time events.

Why this works well: MongoDB is flexible when data structures evolve, while Redis is fast and useful for short-lived values like verification codes and live communication state.

### Infrastructure and deployment

- Nginx: acts as a reverse proxy and helps serve the app efficiently while balancing traffic.
- Docker and Docker Compose: make setup easier and keep the app more portable across environments.
- JWT: used for secure authentication and protecting private routes.

Why this works well: the system is designed to be self-hosted and easier to deploy without a lot of manual setup.

### AI and communication support

- Groq API: used for AI-powered features like job matching, readiness analysis, and content generation.
- SMTP / email OTP flow: helps with secure sign-in and verification using one-time codes.

Why this works well: the app depends on AI reasoning for resume analysis and interview support, and email-based OTP keeps the login flow simple and secure.

### Overall

This stack is chosen to balance speed, flexibility, and usability. The frontend is interactive and easy to navigate, the backend handles real-time and AI-driven features, and the infrastructure keeps the app easy to deploy and self-host.

## How to run it

### Option 1: Run with Docker

This is the easiest way to get started.

1. Make sure Docker is installed and running on your computer.
2. Open a terminal in the project folder.
3. Copy the environment file if it exists.
4. Add your required values, especially your Groq API key.
5. Start the app.
6. Open the app in your browser at http://localhost

To stop the app later, run the shutdown command.

### Option 2: Run locally

If you want to run it directly on your machine:

1. Install dependencies.
2. Set up the server environment variables.
3. Start the frontend and backend from the project root.

This usually runs:

- Frontend at http://localhost:5173
- Backend at http://localhost:5000

## Environment variables

The app needs a few environment values for database, auth, email, and AI features. Main ones include:

- PORT: server port
- NODE_ENV: development or production mode
- MONGO_URI: MongoDB connection string
- JWT_SECRET: secret key for user authentication
- JWT_EXPIRES_IN: token lifetime
- GROQ_API_KEY: API key for AI features
- REDIS_URL: Redis connection URL
- CLIENT_URL: allowed frontend origin
- SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS: email settings for OTP and notifications

## Project structure

The repo is organized like this:

- client/: frontend application
- server/: backend API and logic
- nginx/: reverse proxy configuration
- docker-compose.yml: main Docker setup
- docker-compose.dev.yml: development setup

Main folders inside the app:

- client/src/pages: job pages, resume pages, analytics, interviews, profile, and more
- client/src/components: reusable UI pieces such as cards and modals
- client/src/context: auth and app state
- server/routes: API endpoints
- server/models: database schemas
- server/utils: helper logic for Redis, OTP, emails, and other services

## API overview

The backend includes several main areas:

- auth: login, OTP verification, registration, and profile management
- jobs: job creation, tracking, updates, notes, and bulk import
- readiness: resume-to-job matching and readiness analysis
- analytics: job funnel and performance metrics
- intel: company research, interview support, outreach, and offer strategy
- recommendations: suggested jobs and profile matching

## Notes

This project is meant to be useful in a real job search, not just a demo.

It is designed to help you stay organized, understand your strengths and gaps, and make better decisions while applying and interviewing.

It is also self-hosted, so you can run it on your own machine and keep control of your setup.

A few important things to know before using it:

- This app is built for job seekers who are actively applying to multiple roles and need a system that stays organized over time.
- It is not just a resume builder or a simple tracker. It combines tracking, readiness analysis, interview preparation, and follow-up support in one workflow.
- The app works best when you keep your resume updated, because the resume-to-job matching is based on the content you upload and the job description you compare it against.
- Real-time features such as live updates and interview-like communication rely on services like Socket.IO and WebRTC, so they are most useful when the app is running with the correct infrastructure and environment values.
- AI-generated suggestions are meant to support your decisions, not replace your judgment. You should still review the output and adapt it to your own experience and goals.
- Because it is self-hosted, you are responsible for your own environment setup, secrets, and deployment configuration.
- The project is designed to be flexible, so it can be expanded with more features, integrations, or custom workflows later.
- If you are setting it up locally, make sure your database, Redis, and API keys are properly configured before starting the app.
- The product is especially useful if you are applying to many companies at once and want a structured way to track progress, prepare for interviews, and compare roles.
- The system is meant to save time, reduce confusion, and help you act more intentionally during the job search process.

In simple terms: this is a full job-search management app that helps you stay organized, prep better, and make smarter decisions while applying.


