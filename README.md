# GitHub–Jira Integration Platform

A MERN stack application that integrates GitHub with Jira to connect software development activities with project management workflows.

## Tech Stack

- **Frontend:** React.js, JavaScript, HTML, CSS
- **Backend:** Node.js, Express.js
- **Database:** MongoDB
- **APIs:** GitHub REST API, Jira REST API
- **Tools:** Git, GitHub, Postman, VS Code

## Features

- GitHub API integration
- Jira REST API integration
- Environment-based configuration
- MongoDB database connectivity
- React-based user interface
- Backend API communication

*Note: Features may vary depending on the current implementation.*

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/surajingle07/github_jira_platform.git
cd github_jira_platform
```

### 2. Install Dependencies

Install dependencies in the frontend and backend directories:

```bash
cd backend
npm install
```

```bash
cd ../frontend
npm install
```

### 3. Configure Environment Variables

Create a `.env` file in the backend directory:

```env
PORT=8000
NODE_ENV=development
MONGODB_URI=your_mongodb_connection_string
FRONTEND_URL=http://localhost:5173
GITHUB_TOKEN=your_github_token
JIRA_BASE_URL=https://your-site.atlassian.net
JIRA_EMAIL=your_atlassian_email
JIRA_API_TOKEN=your_jira_api_token
```

Replace the placeholder values with your own credentials. Never commit your `.env` file or publish API tokens.

### 4. Run the Application

Start the backend:

```bash
cd backend
npm run dev
```

Start the frontend in a separate terminal:

```bash
cd frontend
npm run dev
```

Open the local frontend URL displayed in your terminal, typically `http://localhost:5173`.

> **Note:** Update the directory names and commands to match your actual project structure and `package.json` scripts.

## Environment Variables

| Variable | Description |
|---|---|
| `PORT` | Backend server port |
| `NODE_ENV` | Application environment |
| `MONGODB_URI` | MongoDB connection string |
| `FRONTEND_URL` | Frontend application URL |
| `GITHUB_TOKEN` | GitHub API token |
| `JIRA_BASE_URL` | Jira site URL |
| `JIRA_EMAIL` | Atlassian account email |
| `JIRA_API_TOKEN` | Jira API token |

## Security

- Store credentials in environment variables.
- Add `.env` to `.gitignore`.
- Use API tokens with minimum required permissions.
- Revoke and replace any exposed credentials.

## Author

**Suraj Ingle**

GitHub: [@surajingle07](https://github.com/surajingle07)

## Repository

[github_jira_platform](https://github.com/surajingle07/github_jira_platform)