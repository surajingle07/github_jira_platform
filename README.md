# GitHub & Jira Integration Dashboard

A MERN-style project for connecting GitHub and Jira data into a unified dashboard.

## Features

- GitHub user and repository overview
- Jira project and issue overview
- Pull request and commit correlation using Jira issue keys
- Search-friendly dashboard with summary cards
- Backend API layer for external integrations
- Demo/mock data support when live credentials are unavailable

## Project structure

- backend/ — Express API and service layer
- frontend/ — React dashboard UI

## Setup

1. Open the backend folder and create a `.env` file based on `.env.example`.
2. Start the backend:

```powershell
cd backend
node server.js
```

3. Start the frontend:

```powershell
cd frontend
npm install
npm run dev -- --host 127.0.0.1
```

4. Open the app in the browser:

```text
http://127.0.0.1:5173
```

## Live-demo behavior

This project currently supports demo/mock data if environment variables are not set, which helps the app run without private GitHub/Jira credentials.

## Production next steps

- Add real MongoDB connection
- Add GitHub App or OAuth flow
- Add Jira OAuth flow
- Add persistent sync and webhook processing
- Add authentication/authorization for user-specific access

## Verification

The project has a backend test suite for Jira key extraction and matching logic.

```powershell
cd backend
npm test
```
