import { useEffect, useState } from 'react';
import {
  Activity,
  ArrowDownToLine,
  ArrowUpRight,
  Check,
  ChevronRight,
  CircleAlert,
  Clock3,
  GitBranch,
  GitCommitHorizontal,
  GitPullRequest,
  LayoutDashboard,
  LoaderCircle,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Ticket,
  Workflow,
} from 'lucide-react';
import './App.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

const navigation = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'pull-requests', label: 'Pull requests', icon: GitPullRequest },
  { id: 'jira-issues', label: 'Jira issues', icon: Ticket },
];

async function requestJson(path, options) {
  const response = await fetch(`${API_BASE}${path}`, options);
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
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date);
}

function statusClass(value) {
  const state = String(value || '').toLowerCase();
  if (['merged', 'done', 'closed', 'success'].includes(state)) return 'status status-good';
  if (['open', 'in progress', 'in_progress'].includes(state)) return 'status status-active';
  if (['failure', 'blocked'].includes(state)) return 'status status-warning';
  return 'status';
}

function App() {
  const [overview, setOverview] = useState(null);
  const [integrations, setIntegrations] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [activeView, setActiveView] = useState('overview');
  const [query, setQuery] = useState('');

  async function loadDashboard({ quiet = false, initial = false } = {}) {
    if (quiet) setRefreshing(true);
    else if (!initial) setLoading(true);
    if (!initial) setError('');
    try {
      const data = await requestJson('/dashboard/overview');
      setOverview(data);
      setLastUpdated(new Date());
      const connectionData = await requestJson('/integrations/status').catch(() => null);
      setIntegrations(connectionData);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadInitialDashboard() {
      try {
        const data = await requestJson('/dashboard/overview');
        if (cancelled) return;
        setOverview(data);
        setLastUpdated(new Date());
        const connectionData = await requestJson('/integrations/status').catch(() => null);
        if (!cancelled) setIntegrations(connectionData);
      } catch (loadError) {
        if (!cancelled) setError(loadError.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadInitialDashboard();
    return () => { cancelled = true; };
  }, []);

  async function runSync() {
    setSyncing(true);
    setNotice('');
    try {
      const result = await requestJson('/sync/all', { method: 'POST' });
      setNotice(`Sync complete · ${result.repositories} repositories, ${result.issues} issues, ${result.pullRequests} pull requests`);
      await loadDashboard({ quiet: true });
    } catch (syncError) {
      setNotice(`Sync failed · ${syncError.message}`);
    } finally {
      setSyncing(false);
    }
  }

  if (loading) {
    return <div className="loading-screen"><div className="loading-mark"><Workflow size={22} /></div><span>Preparing your workspace</span><LoaderCircle className="spin" size={17} /></div>;
  }

  if (error && !overview) {
    return (
      <div className="error-screen">
        <div className="error-card"><CircleAlert size={25} /><p className="eyebrow">Workspace unavailable</p><h1>Could not load your data</h1><p>{error}</p><button className="button button-primary" onClick={() => loadDashboard()}><RefreshCw size={16} /> Try again</button></div>
      </div>
    );
  }

  const summary = overview?.summary || {};
  const repositories = overview?.repositories || [];
  const pullRequests = overview?.pullRequests || [];
  const issues = overview?.issues || [];
  const activity = overview?.activity || [];
  const demoMode = integrations && (!integrations.githubConfigured || !integrations.jiraConfigured);
  const filteredPulls = pullRequests.filter((item) => `${item.title} ${item.issueKeys?.join(' ') || ''} ${item.state}`.toLowerCase().includes(query.toLowerCase()));
  const filteredIssues = issues.filter((item) => `${item.key} ${item.summary} ${item.status} ${item.assignee}`.toLowerCase().includes(query.toLowerCase()));

  const statCards = [
    { label: 'Repositories', value: summary.totalRepositories || 0, note: 'Across connected workspaces', icon: GitBranch, tone: 'mint' },
    { label: 'Jira issues', value: summary.totalIssues || 0, note: 'Recently updated issues', icon: Ticket, tone: 'blue' },
    { label: 'Open pull requests', value: summary.openPullRequests || 0, note: `${summary.mergedPullRequests || 0} merged in this view`, icon: GitPullRequest, tone: 'amber' },
    { label: 'Linked records', value: summary.linkedRecords || 0, note: 'GitHub activity matched to Jira', icon: Workflow, tone: 'rose' },
  ];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#overview" onClick={() => setActiveView('overview')}>
          <span className="brand-mark"><Workflow size={20} strokeWidth={2.2} /></span>
          <span className="brand-copy"><strong>Relay</strong><small>ENGINEERING OPS</small></span>
        </a>

        <div className="workspace-select"><span className="workspace-avatar">A</span><span><strong>Acme workspace</strong><small>Organization</small></span><ChevronRight size={15} /></div>

        <div className="side-label">WORKSPACE</div>
        <nav className="primary-nav" aria-label="Main navigation">
          {navigation.map(({ id, label, icon: Icon }) => (
            <button key={id} className={`nav-item ${activeView === id ? 'nav-item-active' : ''}`} onClick={() => { setActiveView(id); setQuery(''); }}>
              <Icon size={17} strokeWidth={1.8} /><span>{label}</span>
              {id === 'pull-requests' && <small>{pullRequests.length}</small>}
            </button>
          ))}
        </nav>

        <div className="side-label integrations-label">INTEGRATIONS</div>
        <div className="integration-item"><span className="integration-icon github-icon"><GitBranch size={16} /></span><span><strong>GitHub</strong><small>{integrations?.githubUser || 'Demo account'}</small></span><i className={integrations?.githubConfigured ? 'connection-dot connected' : 'connection-dot demo'} /></div>
        <div className="integration-item"><span className="integration-icon jira-icon"><Ticket size={16} /></span><span><strong>Jira Cloud</strong><small>{integrations?.jiraProjectCount ?? 0} projects</small></span><i className={integrations?.jiraConfigured ? 'connection-dot connected' : 'connection-dot demo'} /></div>

        <div className="sidebar-footer"><div className="avatar">SD</div><span><strong>Workspace admin</strong><small>Administrator</small></span><Settings2 size={17} /></div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumbs"><span>Workspace</span><ChevronRight size={14} /><strong>{navigation.find((item) => item.id === activeView)?.label}</strong></div>
          <div className="topbar-actions">
            <span className={`environment-pill ${demoMode ? 'environment-demo' : 'environment-live'}`}><i />{demoMode ? 'DEMO DATA' : 'CREDENTIALS SET'}</span>
            <span className="topbar-divider" />
            <button className="icon-button" aria-label="Refresh dashboard" title="Refresh dashboard" onClick={() => loadDashboard({ quiet: true })} disabled={refreshing}><RefreshCw size={16} className={refreshing ? 'spin' : ''} /></button>
            <button className="button button-primary sync-action" onClick={runSync} disabled={syncing}>{syncing ? <LoaderCircle className="spin" size={16} /> : <ArrowDownToLine size={16} />}{syncing ? 'Syncing' : 'Run sync'}</button>
          </div>
        </header>

        <div className="page-content">
          <section className="page-heading">
            <div><p className="eyebrow">ENGINEERING INTELLIGENCE</p><h1>{activeView === 'overview' ? 'Development overview' : activeView === 'pull-requests' ? 'Pull requests' : 'Jira issues'}</h1><p className="heading-subtitle">A clear view of delivery activity across your development tools.</p></div>
            <div className="last-updated"><Clock3 size={15} /><span>Updated {formatDate(lastUpdated)}</span></div>
          </section>

          {notice && <div className={`notice ${notice.startsWith('Sync failed') ? 'notice-error' : ''}`} role="status"><Check size={16} />{notice}<button aria-label="Dismiss notification" onClick={() => setNotice('')}>×</button></div>}
          {error && <div className="inline-error"><CircleAlert size={16} />Showing the last available data. Refresh failed: {error}</div>}

          {activeView === 'overview' && <>
            {demoMode && <div className="demo-banner"><span className="demo-symbol"><Activity size={17} /></span><div><strong>Preview workspace</strong><span>Sample activity is shown. Connect GitHub and Jira credentials to load live project data.</span></div><span className="demo-banner-meta">SETUP REQUIRED</span></div>}

            <section className="metrics-grid" aria-label="Workspace metrics">
              {statCards.map(({ label, value, note, icon: Icon, tone }, index) => <article className={`metric-card metric-${tone}`} key={label} style={{ animationDelay: `${index * 55}ms` }}><div className="metric-top"><span>{label}</span><span className="metric-icon"><Icon size={17} /></span></div><strong>{value}</strong><small>{note}</small></article>)}
            </section>

            <section className="overview-grid">
              <article className="surface repository-surface">
                <div className="surface-heading"><div><p className="eyebrow">CONNECTED SOURCE</p><h2>Repositories</h2></div><button className="text-action" onClick={() => setActiveView('pull-requests')}>View activity <ArrowUpRight size={15} /></button></div>
                {repositories.length ? <div className="repository-list">{repositories.slice(0, 5).map((repo) => <a className="repository-row" href={repo.html_url || '#'} target="_blank" rel="noreferrer" key={repo.id || repo.full_name || repo.name}><span className="repo-icon"><GitBranch size={17} /></span><span className="repo-details"><strong>{repo.name}</strong><small>{repo.owner?.login || repo.owner || 'Unknown owner'} / {repo.default_branch || 'main'}</small></span><span className={`visibility ${repo.private ? 'private' : ''}`}>{repo.private ? 'PRIVATE' : 'PUBLIC'}</span><ArrowUpRight className="row-link" size={15} /></a>)}</div> : <div className="empty-state">No repositories found for this workspace.</div>}
                <div className="surface-foot"><span><span className="live-dot" /> Repository inventory</span><span>{repositories.length} total</span></div>
              </article>

              <article className="surface activity-surface">
                <div className="surface-heading"><div><p className="eyebrow">LATEST UPDATES</p><h2>Recent activity</h2></div><span className="activity-counter">{activity.length} EVENTS</span></div>
                {activity.length ? <div className="timeline">{activity.slice(0, 6).map((item, index) => {
                  const isPull = item.type === 'pull_request';
                  const isCommit = item.type === 'commit';
                  const Icon = isPull ? GitPullRequest : isCommit ? GitCommitHorizontal : Ticket;
                  return <div className="timeline-item" key={`${item.type}-${item.title}-${index}`}><span className={`timeline-icon ${isPull ? 'timeline-pr' : isCommit ? 'timeline-commit' : 'timeline-jira'}`}><Icon size={15} /></span><div className="timeline-content"><strong>{item.title}</strong><span><span className={statusClass(item.status)}>{item.status || item.type}</span><time>{formatDate(item.time)}</time></span></div></div>;
                })}</div> : <div className="empty-state">No recent activity to show.</div>}
                <div className="surface-foot"><span><span className="live-dot" /> Activity stream</span><span>Most recent first</span></div>
              </article>
            </section>

            <article className="surface table-surface">
              <div className="surface-heading table-heading"><div><p className="eyebrow">CROSS-TOOL DELIVERY</p><h2>Open pull requests</h2></div><button className="text-action" onClick={() => setActiveView('pull-requests')}>All pull requests <ArrowUpRight size={15} /></button></div>
              <PullRequestTable records={pullRequests.slice(0, 5)} />
            </article>
          </>}

          {activeView !== 'overview' && <section className="surface table-surface full-table-surface">
            <div className="surface-heading table-heading"><div><p className="eyebrow">{activeView === 'pull-requests' ? 'GITHUB DELIVERY' : 'JIRA WORK QUEUE'}</p><h2>{activeView === 'pull-requests' ? 'All pull requests' : 'Recently updated issues'}</h2></div><label className="search-field"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search records" aria-label="Search records" /></label></div>
            {activeView === 'pull-requests' ? <PullRequestTable records={filteredPulls} /> : <IssueTable records={filteredIssues} />}
          </section>}

          <footer className="page-footer"><span><ShieldCheck size={15} /> Data sync is scoped to configured integrations</span><span>RELAY · ENGINEERING OPS</span></footer>
        </div>
      </main>
    </div>
  );
}

function PullRequestTable({ records }) {
  return <div className="table-scroll"><table><thead><tr><th>Pull request</th><th>Repository</th><th>Jira link</th><th>Status</th><th>Updated</th><th aria-label="Open" /></tr></thead><tbody>{records.length ? records.map((record) => <tr key={record.id || record.number || record.title}><td><span className="record-title"><GitPullRequest size={16} /><strong>{record.title}</strong></span><small className="record-subtitle">#{record.number || '—'} · {record.user?.login || 'Contributor'}</small></td><td>{record.base?.repo?.name || record.repository?.name || 'Unknown'}</td><td>{record.issueKeys?.length ? record.issueKeys.map((key) => <span key={key} className="issue-key">{key}</span>) : <span className="muted-text">Unlinked</span>}</td><td><span className={statusClass(record.state)}>{record.state || 'Unknown'}</span></td><td>{formatDate(record.updated_at)}</td><td>{record.html_url && <a className="external-link" href={record.html_url} target="_blank" rel="noreferrer" aria-label={`Open ${record.title}`}><ArrowUpRight size={15} /></a>}</td></tr>) : <tr><td colSpan="6" className="table-empty">No pull requests match this view.</td></tr>}</tbody></table></div>;
}

function IssueTable({ records }) {
  return <div className="table-scroll"><table><thead><tr><th>Issue</th><th>Project</th><th>Type</th><th>Priority</th><th>Status</th><th>Assignee</th></tr></thead><tbody>{records.length ? records.map((issue) => <tr key={issue.id || issue.key}><td><span className="issue-cell"><span className="issue-key">{issue.key}</span><strong>{issue.summary}</strong></span></td><td>{issue.projectKey || '—'}</td><td>{issue.issueType || '—'}</td><td><span className={`priority priority-${String(issue.priority || '').toLowerCase()}`}>{issue.priority || '—'}</span></td><td><span className={statusClass(issue.status)}>{issue.status || 'Unknown'}</span></td><td>{issue.assignee || 'Unassigned'}</td></tr>) : <tr><td colSpan="6" className="table-empty">No issues match this view.</td></tr>}</tbody></table></div>;
}

export default App;