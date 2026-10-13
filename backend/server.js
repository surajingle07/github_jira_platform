require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const connectDB = require('./config/db');
const integrationRoutes = require('./routes/integrationRoutes');
const githubRoutes = require('./routes/githubRoutes');
const jiraRoutes = require('./routes/jiraRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const syncRoutes = require('./routes/syncRoutes');

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || true, credentials: true }));
app.use(express.json());

app.get('/api/health', async (req, res) => {
  const dbStatus = global.isMongoConnected ? 'connected' : 'not-configured';
  res.json({
    status: 'ok',
    database: dbStatus,
    message: 'GitHub and Jira integration backend is running.',
  });
});

connectDB();

app.use('/api/integrations', integrationRoutes);
app.use('/api/github', githubRoutes);
app.use('/api/jira', jiraRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/sync', syncRoutes);

app.use((req, res) => {
  res.status(404).json({ message: 'Route not found.' });
});

app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ message: 'Internal server error.', error: err.message });
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
