const express = require('express');
const githubService = require('../services/githubService');

const router = express.Router();

router.get('/me', async (req, res) => {
  try {
    const user = await githubService.getAuthenticatedUser();
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'GitHub user lookup failed.', error: error.message });
  }
});

router.get('/repositories', async (req, res) => {
  try {
    const repositories = await githubService.getRepositories();
    res.json(repositories);
  } catch (error) {
    res.status(500).json({ message: 'Unable to fetch repositories.', error: error.message });
  }
});

router.get('/repositories/:owner/:repo/branches', async (req, res) => {
  try {
    const branches = await githubService.getBranches(req.params.owner, req.params.repo);
    res.json(branches);
  } catch (error) {
    res.status(500).json({ message: 'Unable to fetch branches.', error: error.message });
  }
});

router.get('/repositories/:owner/:repo/pulls', async (req, res) => {
  try {
    const pulls = await githubService.getPullRequests(req.params.owner, req.params.repo);
    res.json(pulls);
  } catch (error) {
    res.status(500).json({ message: 'Unable to fetch pull requests.', error: error.message });
  }
});

router.get('/repositories/:owner/:repo/commits', async (req, res) => {
  try {
    const commits = await githubService.getCommits(req.params.owner, req.params.repo);
    res.json(commits);
  } catch (error) {
    res.status(500).json({ message: 'Unable to fetch commits.', error: error.message });
  }
});

module.exports = router;
