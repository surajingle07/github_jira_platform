import { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Clock3,
  ExternalLink,
  Filter,
  GitBranch,
  GitCommitHorizontal,
  GitPullRequest,
  History,
  Layers,
  LayoutDashboard,
  LoaderCircle,
  MessageSquare,
  RefreshCw,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Terminal,
  Ticket,
  Workflow,
  X,
} from 'lucide-react';
import './App.css';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const navigation = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'correlation', label: 'Correlation Hub', icon: Workflow },
  { id: 'pull-requests', label: 'Pull Requests & CI', icon: GitPullRequest },
  { id: 'jira-issues', label: 'Jira Work Items', icon: Ticket },
  { id: 'commits', label: 'Commits & Branches', icon: GitCommitHorizontal },
  { id: 'diagnostics', label: 'Audit & Diagnostics', icon: History },
];

async function requestJson(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.message || 'The request could not be completed.');
  }
  return result;
}

function formatDate(value) {
  if (!value) return 'No date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'No date';
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function getDisplayName(value, fallback = 'Connected') {
  if (!value) return fallback;
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    return value.displayName || value.name || value.emailAddress || fallback;
  }
  return fallback;
}

function statusClass(value) {
  const state = String(value || '').toLowerCase();
  if (['merged', 'done', 'closed', 'success', 'approved'].includes(state)) return 'status status-good';
  if (['open', 'in progress', 'in_progress', 'to do'].includes(state)) return 'status status-active';
  if (['failure', 'changes_requested', 'blocked'].includes(state)) return 'status status-warning';
  return 'status';
}

function App() {
  const [overview, setOverview] = useState(null);
  const [integrations, setIntegrations] = useState(null);
  const [diagnostics, setDiagnostics] = useState(null);
  const [syncLogs, setSyncLogs] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [activeView, setActiveView] = useState('overview');

  // Filters
  const [query, setQuery] = useState('');
  const [repoFilter, setRepoFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [correlationFilter, setCorrelationFilter] = useState('all');

  // Controlled Write Modals (FR-11)
  const [commentModalIssue, setCommentModalIssue] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  const [transitionModalIssue, setTransitionModalIssue] = useState(null);
  const [availableTransitions, setAvailableTransitions] = useState([]);
  const [selectedTransitionId, setSelectedTransitionId] = useState('');
  const [transitionComment, setTransitionComment] = useState('');
  const [submittingTransition, setSubmittingTransition] = useState(false);

  async function loadDashboard({ quiet = false, initial = false } = {}) {
    if (quiet) setRefreshing(true);
    else if (!initial) setLoading(true);
    if (!initial) setError('');
    try {
      const [overviewData, connectionData, diagData, syncData, auditData] = await Promise.all([
        requestJson('/dashboard/overview'),
        requestJson('/integrations/status').catch(() => null),
        requestJson('/dashboard/diagnostics').catch(() => null),
        requestJson('/sync/logs').catch(() => []),
        requestJson('/dashboard/audit-logs').catch(() => []),
      ]);
      setOverview(overviewData);
      setIntegrations(connectionData);
      setDiagnostics(diagData);
      setSyncLogs(syncData || []);
      setAuditLogs(auditData || []);
      setLastUpdated(new Date());
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadInitial() {
      try {
        const [overviewData, connectionData, diagData, syncData, auditData] = await Promise.all([
          requestJson('/dashboard/overview'),
          requestJson('/integrations/status').catch(() => null),
          requestJson('/dashboard/diagnostics').catch(() => null),
          requestJson('/sync/logs').catch(() => []),
          requestJson('/dashboard/audit-logs').catch(() => []),
        ]);
        if (cancelled) return;
        setOverview(overviewData);
        setIntegrations(connectionData);
        setDiagnostics(diagData);
        setSyncLogs(syncData || []);
        setAuditLogs(auditData || []);
        setLastUpdated(new Date());
      } catch (loadError) {
        if (!cancelled) setError(loadError.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadInitial();
    return () => {
      cancelled = true;
    };
  }, []);

  async function runSync(type = 'all') {
    setSyncing(true);
    setNotice('');
    try {
      const endpoint = type === 'github' ? '/sync/github' : type === 'jira' ? '/sync/jira' : '/sync/all';
      const result = await requestJson(endpoint, { method: 'POST' });
      setNotice(`Sync complete · ${result.records?.repositories || 0} repos, ${result.records?.issues || 0} Jira issues, ${result.records?.pullRequests || 0} PRs synced.`);
      await loadDashboard({ quiet: true });
    } catch (syncError) {
      setNotice(`Sync failed: ${syncError.message}`);
    } finally {
      setSyncing(false);
    }
  }

  async function openCommentModal(issue) {
    setCommentModalIssue(issue);
    setCommentText('');
  }

  async function handleAddComment(e) {
    e.preventDefault();
    if (!commentModalIssue || !commentText.trim()) return;

    setSubmittingComment(true);
    try {
      await requestJson(`/jira/issues/${commentModalIssue.key}/comment`, {
        method: 'POST',
        body: JSON.stringify({ comment: commentText, author: 'Dashboard User' }),
      });
      setNotice(`Comment posted successfully to ${commentModalIssue.key}`);
      setCommentModalIssue(null);
      setCommentText('');
      await loadDashboard({ quiet: true });
    } catch (err) {
      alert(`Failed to add comment: ${err.message}`);
    } finally {
      setSubmittingComment(false);
    }
  }

  async function openTransitionModal(issue) {
    setTransitionModalIssue(issue);
    setSelectedTransitionId('');
    setTransitionComment('');
    try {
      const transitions = await requestJson(`/jira/issues/${issue.key}/transitions`);
      setAvailableTransitions(transitions || []);
      if (transitions?.length > 0) {
        setSelectedTransitionId(transitions[0].id);
      }
    } catch (err) {
      alert(`Could not fetch transitions for ${issue.key}: ${err.message}`);
    }
  }

  async function handleTransitionSubmit(e) {
    e.preventDefault();
    if (!transitionModalIssue || !selectedTransitionId) return;

    setSubmittingTransition(true);
    try {
      await requestJson(`/jira/issues/${transitionModalIssue.key}/transitions`, {
        method: 'POST',
        body: JSON.stringify({
          transitionId: selectedTransitionId,
          comment: transitionComment,
          initiatedBy: 'Dashboard User',
        }),
      });
      setNotice(`Successfully transitioned ${transitionModalIssue.key}`);
      setTransitionModalIssue(null);
      await loadDashboard({ quiet: true });
    } catch (err) {
      alert(`Transition failed: ${err.message}`);
    } finally {
      setSubmittingTransition(false);
    }
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-mark">
          <Workflow size={24} />
        </div>
        <span>Connecting to GitHub & Jira Platforms</span>
        <LoaderCircle className="spin" size={18} />
      </div>
    );
  }

  if (error && !overview) {
    return (
      <div className="error-screen">
        <div className="error-card">
          <CircleAlert size={26} />
          <p className="eyebrow">Workspace unavailable</p>
          <h1>Could not load your integration data</h1>
          <p>{error}</p>
          <button className="button button-primary" onClick={() => loadDashboard()}>
            <RefreshCw size={16} /> Try again
          </button>
        </div>
      </div>
    );
  }

  const summary = overview?.summary || {};
  const repositories = overview?.repositories || [];
  const pullRequests = overview?.pullRequests || [];
  const issues = overview?.issues || [];
  const correlatedIssues = overview?.correlatedIssues || [];
  const commits = overview?.commits || [];
  const workflowRuns = overview?.workflowRuns || [];
  const activity = overview?.activity || [];
  const demoMode = integrations && (!integrations.github?.connected || !integrations.jira?.connected);

  // Filtered PRs
  const filteredPulls = pullRequests.filter((item) => {
    const matchesQuery = `${item.title} ${item.issueKeys?.join(' ') || ''} ${item.user?.login || ''} ${item.head?.ref || ''}`
      .toLowerCase()
      .includes(query.toLowerCase());
    const matchesStatus = statusFilter === 'all' || item.state === statusFilter;
    const matchesCorrelation =
      correlationFilter === 'all' ||
      (correlationFilter === 'linked' && item.correlation?.status === 'linked') ||
      (correlationFilter === 'ambiguous' && item.correlation?.status === 'ambiguous') ||
      (correlationFilter === 'unmatched' && item.correlation?.status === 'unmatched');
    return matchesQuery && matchesStatus && matchesCorrelation;
  });

  // Filtered Issues
  const filteredIssues = issues.filter((item) => {
    const matchesQuery = `${item.key} ${item.summary} ${item.status} ${item.assignee} ${item.projectKey}`
      .toLowerCase()
      .includes(query.toLowerCase());
    const matchesStatus = statusFilter === 'all' || item.status.toLowerCase() === statusFilter.toLowerCase();
    return matchesQuery && matchesStatus;
  });

  // Filtered Correlated Items
  const filteredCorrelated = correlatedIssues.filter((item) => {
    const matchesQuery = `${item.key} ${item.summary} ${item.status} ${item.assignee}`
      .toLowerCase()
      .includes(query.toLowerCase());
    const matchesCorrelation =
      correlationFilter === 'all' || item.correlationStatus === correlationFilter;
    return matchesQuery && matchesCorrelation;
  });

  // Filtered Commits
  const filteredCommits = commits.filter((item) => {
    const matchesQuery = `${item.message} ${item.sha} ${item.author?.login || ''} ${item.issueKeys?.join(' ') || ''}`
      .toLowerCase()
      .includes(query.toLowerCase());
    const matchesCorrelation =
      correlationFilter === 'all' ||
      (correlationFilter === 'linked' && item.correlation?.status === 'linked') ||
      (correlationFilter === 'ambiguous' && item.correlation?.status === 'ambiguous') ||
      (correlationFilter === 'unmatched' && item.correlation?.status === 'unmatched');
    return matchesQuery && matchesCorrelation;
  });

  const statCards = [
    {
      label: 'Connected Repositories',
      value: summary.totalRepositories || 0,
      note: 'Accessible GitHub repositories',
      icon: GitBranch,
      tone: 'mint',
    },
    {
      label: 'Jira Work Items',
      value: summary.totalIssues || 0,
      note: 'Active across authorized projects',
      icon: Ticket,
      tone: 'blue',
    },
    {
      label: 'Open Pull Requests',
      value: summary.openPullRequests || 0,
      note: `${summary.mergedPullRequests || 0} merged in current scope`,
      icon: GitPullRequest,
      tone: 'amber',
    },
    {
      label: 'Correlated Records',
      value: summary.linkedRecords || 0,
      note: `${summary.ambiguousRecords || 0} flagged for review`,
      icon: Workflow,
      tone: 'rose',
    },
  ];

  return (
    <div className="app-shell">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <a className="brand" href="#overview" onClick={() => setActiveView('overview')}>
          <span className="brand-mark">
            <Workflow size={22} strokeWidth={2.4} />
          </span>
          <span className="brand-copy">
            <strong>Relay</strong>
            <small>GITHUB + JIRA INTEGRATION</small>
          </span>
        </a>

        <div className="workspace-select">
          <span className="workspace-avatar">
            {integrations?.github?.user?.[0]?.toUpperCase() || 'S'}
          </span>
          <span>
            <strong>{integrations?.github?.user || 'surajingle07'}</strong>
            <small>Active Workspace</small>
          </span>
          <ChevronRight size={15} />
        </div>

        <div className="side-label">NAVIGATION</div>
        <nav className="primary-nav" aria-label="Main navigation">
          {navigation.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`nav-item ${activeView === id ? 'nav-item-active' : ''}`}
              onClick={() => {
                setActiveView(id);
                setQuery('');
                setStatusFilter('all');
                setCorrelationFilter('all');
              }}
            >
              <Icon size={17} strokeWidth={1.8} />
              <span>{label}</span>
              {id === 'pull-requests' && <small>{pullRequests.length}</small>}
              {id === 'jira-issues' && <small>{issues.length}</small>}
              {id === 'correlation' && summary.ambiguousRecords > 0 && (
                <span className="nav-badge-alert" title={`${summary.ambiguousRecords} ambiguous links`}>
                  {summary.ambiguousRecords}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="side-label integrations-label">INTEGRATION HEALTH</div>
        <div className="integration-item">
          <span className="integration-icon github-icon">
            <GitBranch size={16} />
          </span>
          <span>
            <strong>GitHub REST API</strong>
            <small>
              {integrations?.github?.connected
                ? `${integrations.github.user} · Rate ${integrations.github.rateLimit?.remaining || 5000}`
                : 'Demo fallback'}
            </small>
          </span>
          <i
            className={`connection-dot ${
              integrations?.github?.connected ? 'connected' : 'demo'
            }`}
          />
        </div>
        <div className="integration-item">
          <span className="integration-icon jira-icon">
            <Ticket size={16} />
          </span>
          <span>
            <strong>Jira Cloud API v3</strong>
            <small>
              {integrations?.jira?.connected
                ? `${integrations.jira.user} · ${integrations.jira.projectCount} proj`
                : 'Demo fallback'}
            </small>
          </span>
          <i
            className={`connection-dot ${
              integrations?.jira?.connected ? 'connected' : 'demo'
            }`}
          />
        </div>
        <div className="integration-item">
          <span className="integration-icon db-icon">
            <Layers size={16} />
          </span>
          <span>
            <strong>MongoDB Storage</strong>
            <small>
              {integrations?.database?.connected ? 'Persistent Connected' : 'Not configured'}
            </small>
          </span>
          <i
            className={`connection-dot ${
              integrations?.database?.connected ? 'connected' : 'demo'
            }`}
          />
        </div>

        <div className="sidebar-footer">
          <div className="avatar">SI</div>
          <span>
            <strong>Suraj Ingle</strong>
            <small>Admin · surajinglens@gmail.com</small>
          </span>
          <Settings2 size={17} />
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumbs">
            <span>Workspace</span>
            <ChevronRight size={14} />
            <strong>{navigation.find((item) => item.id === activeView)?.label}</strong>
          </div>
          <div className="topbar-actions">
            <span
              className={`environment-pill ${
                demoMode ? 'environment-demo' : 'environment-live'
              }`}
            >
              <i />
              {demoMode ? 'DEMO FALLBACK' : 'LIVE APIS CONNECTED'}
            </span>
            <span className="topbar-divider" />
            <button
              className="icon-button"
              aria-label="Refresh dashboard"
              title="Refresh dashboard"
              onClick={() => loadDashboard({ quiet: true })}
              disabled={refreshing}
            >
              <RefreshCw size={16} className={refreshing ? 'spin' : ''} />
            </button>
            <div className="sync-button-group">
              <button
                className="button button-primary sync-action"
                onClick={() => runSync('all')}
                disabled={syncing}
                title="Perform comprehensive GitHub and Jira sync with database persistence"
              >
                {syncing ? <LoaderCircle className="spin" size={16} /> : <ArrowDownToLine size={16} />}
                {syncing ? 'Syncing...' : 'Run Sync'}
              </button>
            </div>
          </div>
        </header>

        <div className="page-content">
          <section className="page-heading">
            <div>
              <p className="eyebrow">ENGINEERING DELIVERY INTELLIGENCE</p>
              <h1>
                {activeView === 'overview' && 'Development Overview'}
                {activeView === 'correlation' && 'Cross-Platform Correlation Hub'}
                {activeView === 'pull-requests' && 'Pull Requests & CI/CD Tracking'}
                {activeView === 'jira-issues' && 'Jira Work Items & Workflows'}
                {activeView === 'commits' && 'Commit History & Branches'}
                {activeView === 'diagnostics' && 'System Audit & Diagnostics'}
              </h1>
              <p className="heading-subtitle">
                {activeView === 'overview' &&
                  'Unified visibility into source control, pull requests, CI checks, and Jira delivery progress.'}
                {activeView === 'correlation' &&
                  'Explainable cross-platform linking with issue key verification and ambiguity handling.'}
                {activeView === 'pull-requests' &&
                  'Pull request states, review approvals, changed files, and GitHub Actions CI check outcomes.'}
                {activeView === 'jira-issues' &&
                  'Authorized Jira Cloud tasks, sprints, permitted workflow transitions, and controlled comments.'}
                {activeView === 'commits' &&
                  'Code commit stream correlated to Jira issue keys and associated pull requests.'}
                {activeView === 'diagnostics' &&
                  'Sync audit trails, webhook idempotency, API connection health, and diagnostic records.'}
              </p>
            </div>
            <div className="last-updated">
              <Clock3 size={15} />
              <span>Updated {formatDate(lastUpdated)}</span>
            </div>
          </section>

          {notice && (
            <div
              className={`notice ${notice.includes('failed') ? 'notice-error' : ''}`}
              role="status"
            >
              <Check size={16} />
              {notice}
              <button aria-label="Dismiss notification" onClick={() => setNotice('')}>
                ×
              </button>
            </div>
          )}

          {error && (
            <div className="inline-error">
              <CircleAlert size={16} />
              Showing cached data. Live refresh encountered: {error}
            </div>
          )}

          {/* VIEW: OVERVIEW */}
          {activeView === 'overview' && (
            <>
              <section className="metrics-grid" aria-label="Workspace metrics">
                {statCards.map(({ label, value, note, icon: Icon, tone }, index) => (
                  <article
                    className={`metric-card metric-${tone}`}
                    key={label}
                    style={{ animationDelay: `${index * 55}ms` }}
                  >
                    <div className="metric-top">
                      <span>{label}</span>
                      <span className="metric-icon">
                        <Icon size={17} />
                      </span>
                    </div>
                    <strong>{value}</strong>
                    <small>{note}</small>
                  </article>
                ))}
              </section>

              {/* Quick Correlation Highlight Banner */}
              <div className="correlation-highlight-card">
                <div className="ch-left">
                  <span className="ch-icon">
                    <Workflow size={20} />
                  </span>
                  <div>
                    <strong>Cross-Platform Linking Rules Active (FR-07)</strong>
                    <p>
                      Direct correlation links branch names, commit messages, and PR descriptions
                      to Jira issues. Separate semantics are preserved for PR merge state, CI
                      checks, and Jira workflow status.
                    </p>
                  </div>
                </div>
                <div className="ch-right">
                  <button
                    className="button button-outline"
                    onClick={() => setActiveView('correlation')}
                  >
                    Open Correlation Hub <ArrowUpRight size={15} />
                  </button>
                </div>
              </div>

              <section className="overview-grid">
                {/* Repositories Surface */}
                <article className="surface repository-surface">
                  <div className="surface-heading">
                    <div>
                      <p className="eyebrow">CONNECTED SOURCE</p>
                      <h2>Repositories</h2>
                    </div>
                    <button
                      className="text-action"
                      onClick={() => setActiveView('pull-requests')}
                    >
                      View PRs <ArrowUpRight size={15} />
                    </button>
                  </div>
                  {repositories.length ? (
                    <div className="repository-list">
                      {repositories.slice(0, 5).map((repo) => (
                        <a
                          className="repository-row"
                          href={repo.html_url || `https://github.com/${repo.full_name}`}
                          target="_blank"
                          rel="noreferrer"
                          key={repo.id || repo.full_name || repo.name}
                        >
                          <span className="repo-icon">
                            <GitBranch size={17} />
                          </span>
                          <span className="repo-details">
                            <strong>{repo.name}</strong>
                            <small>
                              {repo.owner?.login || repo.owner || 'surajingle07'} /{' '}
                              {repo.default_branch || 'main'}
                            </small>
                          </span>
                          <span className={`visibility ${repo.private ? 'private' : ''}`}>
                            {repo.private ? 'PRIVATE' : 'PUBLIC'}
                          </span>
                          <ArrowUpRight className="row-link" size={15} />
                        </a>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-state">No repositories discovered.</div>
                  )}
                  <div className="surface-foot">
                    <span>
                      <span className="live-dot" /> Repository inventory
                    </span>
                    <span>{repositories.length} total accessible</span>
                  </div>
                </article>

                {/* Activity Stream Surface (FR-09) */}
                <article className="surface activity-surface">
                  <div className="surface-heading">
                    <div>
                      <p className="eyebrow">CHRONOLOGICAL FEED (FR-09)</p>
                      <h2>Activity Timeline</h2>
                    </div>
                    <span className="activity-counter">{activity.length} EVENTS</span>
                  </div>
                  {activity.length ? (
                    <div className="timeline">
                      {activity.slice(0, 6).map((item, index) => {
                        const isPull = item.type === 'pull_request';
                        const isCommit = item.type === 'commit';
                        const isCi = item.type === 'ci_run';
                        const Icon = isPull
                          ? GitPullRequest
                          : isCommit
                          ? GitCommitHorizontal
                          : isCi
                          ? CheckCircle2
                          : Ticket;
                        return (
                          <div
                            className="timeline-item"
                            key={`${item.type}-${item.title}-${index}`}
                          >
                            <span
                              className={`timeline-icon ${
                                isPull
                                  ? 'timeline-pr'
                                  : isCommit
                                  ? 'timeline-commit'
                                  : isCi
                                  ? 'timeline-ci'
                                  : 'timeline-jira'
                              }`}
                            >
                              <Icon size={15} />
                            </span>
                            <div className="timeline-content">
                              <div className="timeline-title-row">
                                <strong>{item.title}</strong>
                                {item.issueKeys?.map((k) => (
                                  <span key={k} className="issue-key-badge">
                                    {k}
                                  </span>
                                ))}
                              </div>
                              <div className="timeline-meta">
                                <span className={statusClass(item.status)}>
                                  {item.status || item.event}
                                </span>
                                <span>by {item.author || 'User'}</span>
                                <time>{formatDate(item.time)}</time>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="empty-state">No recent activity recorded.</div>
                  )}
                  <div className="surface-foot">
                    <span>
                      <span className="live-dot" /> Live timeline stream
                    </span>
                    <span>Chronological ordering</span>
                  </div>
                </article>
              </section>

              {/* Cross-Tool Open PRs Preview */}
              <article className="surface table-surface">
                <div className="surface-heading table-heading">
                  <div>
                    <p className="eyebrow">CROSS-PLATFORM PULL REQUESTS</p>
                    <h2>Recent Pull Requests & Check Outcomes</h2>
                  </div>
                  <button
                    className="text-action"
                    onClick={() => setActiveView('pull-requests')}
                  >
                    All pull requests <ArrowUpRight size={15} />
                  </button>
                </div>
                <PullRequestTable
                  records={pullRequests.slice(0, 5)}
                  onOpenComment={openCommentModal}
                />
              </article>
            </>
          )}

          {/* VIEW: CORRELATION HUB (FR-07) */}
          {activeView === 'correlation' && (
            <section className="surface table-surface full-table-surface">
              <div className="surface-heading table-heading">
                <div>
                  <p className="eyebrow">CROSS-PLATFORM CORRELATION ENGINE (FR-07)</p>
                  <h2>Jira Work Items & Linked Development Activity</h2>
                </div>
                <div className="filter-bar">
                  <label className="search-field">
                    <Search size={16} />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search Jira keys, PR titles, authors"
                      aria-label="Search records"
                    />
                  </label>
                  <select
                    className="select-field"
                    value={correlationFilter}
                    onChange={(e) => setCorrelationFilter(e.target.value)}
                  >
                    <option value="all">All Link Statuses</option>
                    <option value="linked">Linked (Verified)</option>
                    <option value="ambiguous">Ambiguous (Needs Review)</option>
                    <option value="unlinked">Unlinked</option>
                  </select>
                </div>
              </div>

              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Jira Issue</th>
                      <th>Correlation Status</th>
                      <th>Linked Pull Requests & Branches</th>
                      <th>Correlated Commits</th>
                      <th>Jira Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCorrelated.length ? (
                      filteredCorrelated.map((item) => (
                        <tr key={item.key || item.id}>
                          <td>
                            <div className="issue-cell">
                              <span className="issue-key">{item.key}</span>
                              <strong>{item.summary}</strong>
                              <small className="muted-text">
                                {item.issueType || 'Task'} · Assignee: {item.assignee || 'Unassigned'}
                              </small>
                            </div>
                          </td>
                          <td>
                            {item.correlationStatus === 'linked' && (
                              <span className="badge badge-success">
                                <Check size={13} /> Linked
                              </span>
                            )}
                            {item.correlationStatus === 'ambiguous' && (
                              <span
                                className="badge badge-warning"
                                title="Multiple Jira keys detected in PR/commits; requires review."
                              >
                                <AlertTriangle size={13} /> Ambiguous
                              </span>
                            )}
                            {item.correlationStatus === 'unlinked' && (
                              <span className="badge badge-neutral">Unlinked</span>
                            )}
                          </td>
                          <td>
                            {item.linkedPullRequests?.length ? (
                              <div className="linked-pr-list">
                                {item.linkedPullRequests.map((pr) => (
                                  <div key={pr.id || pr.number} className="linked-pr-badge">
                                    <GitPullRequest size={14} />
                                    <span>#{pr.number} {pr.title}</span>
                                    <span className={statusClass(pr.state)}>{pr.state}</span>
                                    {pr.ciStatus && (
                                      <span
                                        className={`badge-ci ${
                                          pr.ciStatus === 'SUCCESS' ? 'ci-pass' : 'ci-fail'
                                        }`}
                                      >
                                        CI: {pr.ciStatus}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="muted-text">No PR attached</span>
                            )}
                          </td>
                          <td>
                            {item.linkedCommits?.length ? (
                              <div className="linked-commit-list">
                                {item.linkedCommits.map((c) => (
                                  <div key={c.sha} className="linked-commit-row">
                                    <code>{c.sha.slice(0, 7)}</code>
                                    <span>{c.message}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="muted-text">No commits found</span>
                            )}
                          </td>
                          <td>
                            <span className={statusClass(item.status)}>{item.status}</span>
                          </td>
                          <td>
                            <div className="table-action-buttons">
                              <button
                                className="btn-table-action"
                                title="Add Jira Comment"
                                onClick={() => openCommentModal(item)}
                              >
                                <MessageSquare size={14} /> Comment
                              </button>
                              <button
                                className="btn-table-action btn-transition"
                                title="Transition Jira Workflow Status"
                                onClick={() => openTransitionModal(item)}
                              >
                                <ChevronDown size={14} /> Transition
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="6" className="table-empty">
                          No correlated records match this filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* VIEW: PULL REQUESTS & CI (FR-03 & FR-05) */}
          {activeView === 'pull-requests' && (
            <section className="surface table-surface full-table-surface">
              <div className="surface-heading table-heading">
                <div>
                  <p className="eyebrow">GITHUB PULL REQUESTS & ACTIONS (FR-03, FR-05)</p>
                  <h2>Pull Requests, Reviews & CI Check Runs</h2>
                </div>
                <div className="filter-bar">
                  <label className="search-field">
                    <Search size={16} />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search title, branch, Jira key"
                      aria-label="Search records"
                    />
                  </label>
                  <select
                    className="select-field"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value="all">All PR States</option>
                    <option value="open">Open</option>
                    <option value="merged">Merged</option>
                    <option value="closed">Closed</option>
                  </select>
                  <select
                    className="select-field"
                    value={correlationFilter}
                    onChange={(e) => setCorrelationFilter(e.target.value)}
                  >
                    <option value="all">All Correlation</option>
                    <option value="linked">Linked</option>
                    <option value="ambiguous">Ambiguous</option>
                    <option value="unmatched">Unmatched</option>
                  </select>
                </div>
              </div>

              <PullRequestTable records={filteredPulls} onOpenComment={openCommentModal} />
            </section>
          )}

          {/* VIEW: JIRA ISSUES (FR-06 & FR-11) */}
          {activeView === 'jira-issues' && (
            <section className="surface table-surface full-table-surface">
              <div className="surface-heading table-heading">
                <div>
                  <p className="eyebrow">JIRA WORK TRACKING & CONTROLLED WRITE ACTIONS (FR-06, FR-11)</p>
                  <h2>Authorized Jira Issues, Sprints & Transitions</h2>
                </div>
                <div className="filter-bar">
                  <label className="search-field">
                    <Search size={16} />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search issue key, summary, assignee"
                      aria-label="Search records"
                    />
                  </label>
                  <select
                    className="select-field"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value="all">All Statuses</option>
                    <option value="To Do">To Do</option>
                    <option value="In Progress">In Progress</option>
                    <option value="In Review">In Review</option>
                    <option value="Done">Done</option>
                  </select>
                </div>
              </div>

              <IssueTable
                records={filteredIssues}
                onOpenComment={openCommentModal}
                onOpenTransition={openTransitionModal}
              />
            </section>
          )}

          {/* VIEW: COMMITS & BRANCHES (FR-02 & FR-04) */}
          {activeView === 'commits' && (
            <section className="surface table-surface full-table-surface">
              <div className="surface-heading table-heading">
                <div>
                  <p className="eyebrow">COMMIT LOG & BRANCH CROSS-REFERENCE (FR-04)</p>
                  <h2>Commits Correlated to Jira Work Items</h2>
                </div>
                <div className="filter-bar">
                  <label className="search-field">
                    <Search size={16} />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search commit messages, author, SHA"
                      aria-label="Search records"
                    />
                  </label>
                  <select
                    className="select-field"
                    value={correlationFilter}
                    onChange={(e) => setCorrelationFilter(e.target.value)}
                  >
                    <option value="all">All Correlation</option>
                    <option value="linked">Linked</option>
                    <option value="ambiguous">Ambiguous</option>
                    <option value="unmatched">Unmatched</option>
                  </select>
                </div>
              </div>

              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Commit</th>
                      <th>Author</th>
                      <th>Correlated Jira Key</th>
                      <th>Status</th>
                      <th>Date</th>
                      <th aria-label="Link" />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCommits.length ? (
                      filteredCommits.map((c) => (
                        <tr key={c.sha}>
                          <td>
                            <div className="commit-cell">
                              <code>{c.sha.slice(0, 8)}</code>
                              <strong>{c.message}</strong>
                            </div>
                          </td>
                          <td>{c.author?.login || c.commit?.author?.name || 'Developer'}</td>
                          <td>
                            {c.issueKeys?.length ? (
                              c.issueKeys.map((key) => (
                                <span key={key} className="issue-key-badge">
                                  {key}
                                </span>
                              ))
                            ) : (
                              <span className="muted-text">Unlinked</span>
                            )}
                          </td>
                          <td>
                            {c.correlation?.status === 'linked' && (
                              <span className="badge badge-success">Linked</span>
                            )}
                            {c.correlation?.status === 'ambiguous' && (
                              <span className="badge badge-warning">Ambiguous</span>
                            )}
                            {c.correlation?.status === 'unmatched' && (
                              <span className="badge badge-neutral">Unmatched</span>
                            )}
                          </td>
                          <td>{formatDate(c.commit?.author?.date || c.createdAt)}</td>
                          <td>
                            {c.html_url && (
                              <a
                                className="external-link"
                                href={c.html_url}
                                target="_blank"
                                rel="noreferrer"
                                aria-label="Open commit"
                              >
                                <ArrowUpRight size={15} />
                              </a>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="6" className="table-empty">
                          No commits match this filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* VIEW: DIAGNOSTICS & AUDIT LOGS (FR-12) */}
          {activeView === 'diagnostics' && (
            <div className="diagnostics-view">
              {/* System Diagnostics Health Grid */}
              <section className="metrics-grid">
                <article className="metric-card metric-mint">
                  <div className="metric-top">
                    <span>GitHub API Quota</span>
                    <GitBranch size={17} />
                  </div>
                  <strong>
                    {diagnostics?.github?.rateLimit?.remaining ?? 5000} /{' '}
                    {diagnostics?.github?.rateLimit?.limit ?? 5000}
                  </strong>
                  <small>
                    Latency: {diagnostics?.github?.latencyMs || 120}ms · Scopes:{' '}
                    {diagnostics?.github?.scopes || 'repo, read:org'}
                  </small>
                </article>

                <article className="metric-card metric-blue">
                  <div className="metric-top">
                    <span>Jira Cloud Site</span>
                    <Ticket size={17} />
                  </div>
                  <strong>{getDisplayName(diagnostics?.jira?.user, 'Connected')}</strong>
                  <small>
                    Site: {diagnostics?.jira?.siteUrl || 'https://surajsworkspace-44642302.atlassian.net'}
                  </small>
                </article>

                <article className="metric-card metric-amber">
                  <div className="metric-top">
                    <span>Database Status</span>
                    <Layers size={17} />
                  </div>
                  <strong>
                    {diagnostics?.database?.status === 'connected' ? 'Connected' : 'Offline'}
                  </strong>
                  <small>MongoDB Atlas with automatic reconnection</small>
                </article>

                <article className="metric-card metric-rose">
                  <div className="metric-top">
                    <span>Process Uptime</span>
                    <Activity size={17} />
                  </div>
                  <strong>{Math.floor((diagnostics?.uptimeSeconds || 0) / 60)} mins</strong>
                  <small>
                    Memory Heap: {diagnostics?.memory?.heapUsedMb || 45}MB · Node{' '}
                    {diagnostics?.nodeVersion || 'v20'}
                  </small>
                </article>
              </section>

              {/* Action Audit Logs Table (FR-11, FR-12) */}
              <article className="surface table-surface">
                <div className="surface-heading table-heading">
                  <div>
                    <p className="eyebrow">AUDIT TRAIL & WRITE ACTIONS (FR-11, FR-12)</p>
                    <h2>Controlled Actions & Webhook Audit Log</h2>
                  </div>
                  <span className="activity-counter">{auditLogs.length} AUDIT RECORDS</span>
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Action Type</th>
                        <th>Target</th>
                        <th>Entity</th>
                        <th>Outcome</th>
                        <th>Initiated By</th>
                        <th>Timestamp</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditLogs.length ? (
                        auditLogs.map((log, idx) => (
                          <tr key={log._id || idx}>
                            <td>
                              <span className="action-tag">{log.actionType}</span>
                            </td>
                            <td>
                              <span className="target-system-badge">{log.targetSystem}</span>
                            </td>
                            <td>
                              <strong>{log.targetEntity || '—'}</strong>
                            </td>
                            <td>
                              <span
                                className={`badge ${
                                  log.result === 'success' ? 'badge-success' : 'badge-warning'
                                }`}
                              >
                                {log.result}
                              </span>
                            </td>
                            <td>{log.initiatedBy}</td>
                            <td>{formatDate(log.createdAt)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="6" className="table-empty">
                            No audit logs available yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </article>

              {/* Sync History Table (FR-10, FR-12) */}
              <article className="surface table-surface" style={{ marginTop: '24px' }}>
                <div className="surface-heading table-heading">
                  <div>
                    <p className="eyebrow">DATA SYNCHRONIZATION LOGS (FR-10)</p>
                    <h2>Reconciliation & Incremental Sync Records</h2>
                  </div>
                  <button className="button button-outline" onClick={() => runSync('all')}>
                    Trigger Sync Now
                  </button>
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Provider</th>
                        <th>Type</th>
                        <th>Status</th>
                        <th>Records Fetched / Updated</th>
                        <th>Message</th>
                        <th>Timestamp</th>
                      </tr>
                    </thead>
                    <tbody>
                      {syncLogs.length ? (
                        syncLogs.map((log, idx) => (
                          <tr key={log._id || idx}>
                            <td>
                              <strong style={{ textTransform: 'uppercase' }}>{log.provider}</strong>
                            </td>
                            <td>{log.syncType}</td>
                            <td>
                              <span className="badge badge-success">{log.status}</span>
                            </td>
                            <td>
                              {log.recordsFetched} fetched / {log.recordsUpdated} updated
                            </td>
                            <td>{log.message}</td>
                            <td>{formatDate(log.completedAt || log.startedAt)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="6" className="table-empty">
                            No sync logs recorded yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </article>
            </div>
          )}

          <footer className="page-footer">
            <span>
              <ShieldCheck size={15} /> All operations adhere to GitHub & Jira API scopes and data
              access rules
            </span>
            <span>RELAY PLATFORM · GITHUB & JIRA INTEGRATION</span>
          </footer>
        </div>
      </main>

      {/* Controlled Write Action Modal: Add Comment (FR-11) */}
      {commentModalIssue && (
        <div className="modal-backdrop" onClick={() => setCommentModalIssue(null)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p className="eyebrow">CONTROLLED WRITE ACTION (FR-11)</p>
                <h3>Add Jira Comment</h3>
              </div>
              <button
                className="modal-close"
                onClick={() => setCommentModalIssue(null)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAddComment}>
              <div className="modal-body">
                <div className="modal-issue-preview">
                  <span className="issue-key">{commentModalIssue.key}</span>
                  <strong>{commentModalIssue.summary}</strong>
                </div>
                <label className="form-label" htmlFor="comment-text">
                  Comment Content
                </label>
                <textarea
                  id="comment-text"
                  className="form-textarea"
                  rows={4}
                  required
                  placeholder="e.g. Verified PR #4 merge. Automated checks passed and ready for testing."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                />
                <p className="form-help">
                  This action is recorded in the action audit log and submitted to Jira Cloud REST
                  API v3 in Atlassian Document Format.
                </p>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="button button-outline"
                  onClick={() => setCommentModalIssue(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="button button-primary"
                  disabled={submittingComment || !commentText.trim()}
                >
                  {submittingComment ? (
                    <LoaderCircle className="spin" size={15} />
                  ) : (
                    <Send size={15} />
                  )}
                  {submittingComment ? 'Posting...' : 'Post Comment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Controlled Write Action Modal: Workflow Transition (FR-11) */}
      {transitionModalIssue && (
        <div className="modal-backdrop" onClick={() => setTransitionModalIssue(null)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p className="eyebrow">WORKFLOW TRANSITION (FR-11)</p>
                <h3>Transition Jira Issue</h3>
              </div>
              <button
                className="modal-close"
                onClick={() => setTransitionModalIssue(null)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleTransitionSubmit}>
              <div className="modal-body">
                <div className="modal-issue-preview">
                  <span className="issue-key">{transitionModalIssue.key}</span>
                  <strong>{transitionModalIssue.summary}</strong>
                  <div style={{ marginTop: '6px' }}>
                    Current status: <span className={statusClass(transitionModalIssue.status)}>{transitionModalIssue.status}</span>
                  </div>
                </div>

                <label className="form-label" htmlFor="transition-select">
                  Target Status Transition
                </label>
                <select
                  id="transition-select"
                  className="select-field full-width"
                  value={selectedTransitionId}
                  onChange={(e) => setSelectedTransitionId(e.target.value)}
                  required
                >
                  {availableTransitions.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} (to: {t.to?.name || t.name})
                    </option>
                  ))}
                </select>

                <label className="form-label" htmlFor="transition-comment" style={{ marginTop: '12px' }}>
                  Optional Transition Note
                </label>
                <input
                  id="transition-comment"
                  type="text"
                  className="form-input"
                  placeholder="e.g. Moved to review following PR #4 approval."
                  value={transitionComment}
                  onChange={(e) => setTransitionComment(e.target.value)}
                />

                <p className="form-help">
                  Rule note: A merged PR does not automatically set an issue to Done unless explicitly
                  transitioned using permitted workflow rules.
                </p>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="button button-outline"
                  onClick={() => setTransitionModalIssue(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="button button-primary"
                  disabled={submittingTransition || !selectedTransitionId}
                >
                  {submittingTransition ? (
                    <LoaderCircle className="spin" size={15} />
                  ) : (
                    <Check size={15} />
                  )}
                  {submittingTransition ? 'Applying...' : 'Apply Transition'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function PullRequestTable({ records = [], onOpenComment }) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Pull Request</th>
            <th>Source & Target Branch</th>
            <th>Jira Correlation</th>
            <th>PR State</th>
            <th>Review Status</th>
            <th>CI Check</th>
            <th>Updated</th>
            <th aria-label="Open" />
          </tr>
        </thead>
        <tbody>
          {records.length ? (
            records.map((record) => (
              <tr key={record.id || record.number || record.title}>
                <td>
                  <span className="record-title">
                    <GitPullRequest size={16} />
                    <strong>{record.title}</strong>
                  </span>
                  <small className="record-subtitle">
                    #{record.number || '—'} by {record.user?.login || 'Contributor'}
                  </small>
                </td>
                <td>
                  <div className="branch-pair">
                    <code>{record.head?.ref || record.sourceBranch || 'feat'}</code>
                    <span>→</span>
                    <code>{record.base?.ref || record.targetBranch || 'main'}</code>
                  </div>
                </td>
                <td>
                  {record.issueKeys?.length ? (
                    <div className="jira-keys-col">
                      {record.issueKeys.map((key) => (
                        <span key={key} className="issue-key-badge">
                          {key}
                        </span>
                      ))}
                      {record.correlation?.status === 'ambiguous' && (
                        <span
                          className="badge badge-warning"
                          title="Multiple Jira keys detected"
                        >
                          Ambiguous
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="muted-text">Unlinked</span>
                  )}
                </td>
                <td>
                  <span className={statusClass(record.state)}>{record.state || 'Unknown'}</span>
                </td>
                <td>
                  <span
                    className={`review-badge ${
                      record.reviewStatus === 'APPROVED'
                        ? 'review-approved'
                        : record.reviewStatus === 'CHANGES_REQUESTED'
                        ? 'review-changes'
                        : 'review-pending'
                    }`}
                  >
                    {record.reviewStatus || 'PENDING'}
                  </span>
                </td>
                <td>
                  <span
                    className={`badge-ci ${
                      record.ciStatus === 'SUCCESS' ? 'ci-pass' : 'ci-fail'
                    }`}
                  >
                    {record.ciStatus || 'SUCCESS'}
                  </span>
                </td>
                <td>{formatDate(record.updated_at || record.createdAt)}</td>
                <td>
                  {record.html_url && (
                    <a
                      className="external-link"
                      href={record.html_url}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Open ${record.title}`}
                    >
                      <ArrowUpRight size={15} />
                    </a>
                  )}
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="8" className="table-empty">
                No pull requests match this filter view.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function IssueTable({ records = [], onOpenComment, onOpenTransition }) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Jira Issue</th>
            <th>Project</th>
            <th>Type</th>
            <th>Priority</th>
            <th>Status</th>
            <th>Assignee</th>
            <th>Actions</th>
            <th aria-label="Open" />
          </tr>
        </thead>
        <tbody>
          {records.length ? (
            records.map((issue) => (
              <tr key={issue.id || issue.key}>
                <td>
                  <span className="issue-cell">
                    <span className="issue-key">{issue.key}</span>
                    <strong>{issue.summary}</strong>
                  </span>
                </td>
                <td>{issue.projectKey || 'KAN'}</td>
                <td>{issue.issueType || 'Task'}</td>
                <td>
                  <span
                    className={`priority priority-${String(issue.priority || '').toLowerCase()}`}
                  >
                    {issue.priority || 'Medium'}
                  </span>
                </td>
                <td>
                  <span className={statusClass(issue.status)}>{issue.status || 'Unknown'}</span>
                </td>
                <td>{issue.assignee || 'Unassigned'}</td>
                <td>
                  <div className="table-action-buttons">
                    <button
                      className="btn-table-action"
                      onClick={() => onOpenComment(issue)}
                      title="Add Comment to Jira Issue"
                    >
                      <MessageSquare size={13} /> Comment
                    </button>
                    <button
                      className="btn-table-action btn-transition"
                      onClick={() => onOpenTransition(issue)}
                      title="Transition Status in Jira"
                    >
                      <ChevronDown size={13} /> Transition
                    </button>
                  </div>
                </td>
                <td>
                  {issue.url && (
                    <a
                      className="external-link"
                      href={issue.url}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Open ${issue.key}`}
                    >
                      <ArrowUpRight size={15} />
                    </a>
                  )}
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="8" className="table-empty">
                No Jira work items match this filter view.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default App;