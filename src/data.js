export const STATUS_CONFIG = {
  listed:    { label: 'Listed',    color: '#6B4FA0', bg: '#EDE5F7', border: '#D4C6E8', emoji: '🟣' },
  committed: { label: 'Committed', color: '#4C2C92', bg: '#D9CCF0', border: '#B89CD9', emoji: '🔮' },
  done:      { label: 'Done',      color: '#2D1A57', bg: '#C4B0E2', border: '#7B5EAD', emoji: '💜' },
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
    status: 'committed',
    businessArea: ['Customer Experience'],
    responsibility: 'QA Team',
    requirements: [
      { text: 'Cover all P0 user journeys', accepted: false },
      { text: 'Run in CI on every PR', accepted: false },
      { text: 'Report flakiness metrics', accepted: false },
      { text: 'Execution time under 10 minutes', accepted: false },
    ],
    dependencies: [],
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
    status: 'listed',
    businessArea: ['Operations'],
    responsibility: 'Platform Team',
    requirements: [
      { text: 'Zero-downtime deployments', accepted: false },
      { text: 'Automated rollback on error spike', accepted: false },
      { text: 'Deployment success rate > 99%', accepted: false },
    ],
    dependencies: [],
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
    status: 'done',
    businessArea: ['Growth'],
    responsibility: 'Product Team',
    requirements: [
      { text: 'Reduce steps from 8 to 4', accepted: false },
      { text: 'Add progress indicator', accepted: false },
      { text: 'Contextual help tooltips', accepted: false },
      { text: 'A/B test new vs old flow', accepted: false },
    ],
    dependencies: [],
    createdAt: '2026-02-01',
  },
]

export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

const STATUS_MIGRATION = {
  // original traffic-light keys
  green:       'done',
  yellow:      'committed',
  red:         'listed',
  // intermediate keys
  not_started: 'listed',
  ongoing:     'committed',
  blocked:     'listed',
}

export function loadData() {
  try {
    const raw = localStorage.getItem('improvements')
    if (!raw) return SAMPLE_DATA
    const items = JSON.parse(raw)
    return items.map(item => ({
      ...item,
      status: STATUS_CONFIG[item.status] ? item.status : (STATUS_MIGRATION[item.status] ?? 'listed'),
      dependencies: item.dependencies ?? [],
      requirements: (item.requirements ?? []).map(r =>
        typeof r === 'string' ? { text: r, accepted: false } : r
      ),
      businessArea: Array.isArray(item.businessArea)
        ? item.businessArea
        : item.businessArea ? [item.businessArea] : [],
    }))
  } catch {
    return SAMPLE_DATA
  }
}

export function saveData(items) {
  localStorage.setItem('improvements', JSON.stringify(items))
}
