export const STATUS_CONFIG = {
  not_started: { label: 'Not Started', color: '#64748b', bg: '#f8fafc', border: '#cbd5e1', emoji: '⚪' },
  ongoing:     { label: 'Ongoing',     color: '#d69e2e', bg: '#fffff0', border: '#f6e05e', emoji: '🟡' },
  blocked:     { label: 'Blocked',     color: '#e53e3e', bg: '#fff5f5', border: '#fc8181', emoji: '🔴' },
}

export const SAMPLE_DATA = [
  {
    id: '1',
    priority: 1,
    title: 'Automated regression test suite',
    tagline: 'Stop shipping bugs that tests would catch',
    description: 'Build a comprehensive automated regression suite covering all critical user flows.',
    area: 'Quality',
    subarea: 'Test Automation',
    status: 'ongoing',
    businessArea: 'Customer Experience',
    responsibility: 'QA Team',
    requirements: [
      'Cover all P0 user journeys',
      'Run in CI on every PR',
      'Report flakiness metrics',
      'Execution time under 10 minutes',
    ],
    createdAt: '2026-01-10',
  },
  {
    id: '2',
    priority: 2,
    title: 'Improve deployment pipeline reliability',
    tagline: 'Every failed deploy costs us trust and recovery time',
    description: 'Reduce failed deployments and add automatic rollback capability.',
    area: 'Engineering',
    subarea: 'DevOps',
    status: 'blocked',
    businessArea: 'Operations',
    responsibility: 'Platform Team',
    requirements: [
      'Zero-downtime deployments',
      'Automated rollback on error spike',
      'Deployment success rate > 99%',
    ],
    createdAt: '2026-01-15',
  },
  {
    id: '3',
    priority: 3,
    title: 'Onboarding flow redesign',
    tagline: 'Users who get stuck on day one never come back',
    description: 'Simplify the user onboarding to increase activation rate.',
    area: 'Product',
    subarea: 'UX',
    status: 'not_started',
    businessArea: 'Growth',
    responsibility: 'Product Team',
    requirements: [
      'Reduce steps from 8 to 4',
      'Add progress indicator',
      'Contextual help tooltips',
      'A/B test new vs old flow',
    ],
    createdAt: '2026-02-01',
  },
]

export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

export function loadData() {
  try {
    const raw = localStorage.getItem('improvements')
    return raw ? JSON.parse(raw) : SAMPLE_DATA
  } catch {
    return SAMPLE_DATA
  }
}

export function saveData(items) {
  localStorage.setItem('improvements', JSON.stringify(items))
}
