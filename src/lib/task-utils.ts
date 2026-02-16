// ── Task Category Auto-Detection ──
// Parses task title keywords to assign a visual category tag

export const CATEGORY_RULES = [
  { pattern: /\b(AI|ML|model|inference|Hugging\s*Face|GPT|LLM)\b/i, label: 'AI/ML', color: '236, 72, 153' },
  { pattern: /\b(API|REST|endpoint|GraphQL|webhook|middleware|rate.?limit)\b/i, label: 'API', color: '96, 165, 250' },
  { pattern: /\b(test|E2E|Playwright|jest|spec|QA|suite)\b/i, label: 'Test', color: '74, 222, 128' },
  { pattern: /\b(doc|documentation|translate|README|guide)\b/i, label: 'Docs', color: '250, 204, 21' },
  { pattern: /\b(React|component|UI|CSS|frontend)\b/i, label: 'UI', color: '251, 146, 60' },
  { pattern: /\b(database|SQL|Postgres|Supabase|query|migrate|CockroachDB)\b/i, label: 'Data', color: '34, 211, 238' },
  { pattern: /\b(security|audit|auth|encryption)\b/i, label: 'Sec', color: '248, 113, 113' },
  { pattern: /\b(CI|CD|pipeline|deploy|GitHub\s*Actions|infra)\b/i, label: 'Ops', color: '167, 139, 250' },
  { pattern: /\b(scrape|parse|index|crawl|npm)\b/i, label: 'Crawl', color: '45, 212, 191' },
  { pattern: /\b(refactor|optimize|performance)\b/i, label: 'Perf', color: '253, 186, 116' },
  { pattern: /\b(design|schema|architect|marketplace)\b/i, label: 'Design', color: '196, 181, 253' },
  { pattern: /\b(analy[sz]e|pattern|log|metric|monitor|report)\b/i, label: 'Analytics', color: '129, 140, 248' },
  { pattern: /\b(build|create|implement|set\s*up|develop)\b/i, label: 'Build', color: '156, 163, 175' },
] as const

export function detectCategory(title: string): { label: string; color: string } | null {
  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(title)) return { label: rule.label, color: rule.color }
  }
  return null
}

export function timeAgo(dateStr?: string): string {
  if (!dateStr) return ''
  const ms = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(ms / 60000)
  if (m < 1) return 'now'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}
