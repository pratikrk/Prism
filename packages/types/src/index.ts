// finalize is a Celery chord callback, not a tracked job row — excluded here.
export type JobType =
  | 'orchestrator'
  | 'sprint'
  | 'keyword'
  | 'competitor'
  | 'content_audit'
  | 'llm_visibility'
  | 'synthesis';

export type JobStatus =
  | 'pending'
  | 'running'
  | 'awaiting_gate0'
  | 'awaiting_gate1'
  | 'complete'
  | 'complete_with_errors'
  | 'failed';

export type PlanStatus = 'draft' | 'approved' | 'superseded';
export type BriefStatus = 'draft' | 'approved';

export type ErrorKind =
  | 'rate_limit'
  | 'timeout'
  | 'external_error'
  | 'invalid_output'
  | 'invalid_input'
  | 'bug';

export interface JobError {
  kind: ErrorKind;
  message: string;
  retryable: boolean;
  provider?: string;
  trace_id?: string;
}

export interface Job {
  id: string;
  workspace_id: string;
  parent_job_id: string | null;
  type: JobType;
  status: JobStatus;
  input: Record<string, unknown>;
  result: Record<string, unknown> | null;
  error: JobError | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface Plan {
  id: string;
  job_id: string;
  workspace_id: string;
  intent: string;
  domain: string;
  competitors: string[];
  timeline_weeks: number;
  sprint_order: JobType[];
  version: number;
  feedback: string | null;
  plan_status: PlanStatus;
  parent_plan_id: string | null;
  traffic_target: number | null;
  feasibility_note: string | null;
}

export interface Workspace {
  id: string;
  user_id: string;
  org_id: string | null;
  name: string;
  domain: string;
}

export interface AgentStatusEvent {
  job_id: string;
  parent_job_id: string | null;
  workspace_id: string;
  type: JobType;
  status: JobStatus;
  at: string;
  error: JobError | null;
}

// ── Research result types ─────────────────────────────────────────────────

export interface KeywordRow {
  term: string;
  volume: number | null;
  difficulty: number | null;
  priority_score: number;
  cpc?: number;
  intent?: 'informational' | 'commercial' | 'transactional' | 'navigational';
  funnel_stage?: 'TOF' | 'MOF' | 'BOF' | 'NAV';
  trend?: number[];
  top_competitor?: string;
  estimated_monthly_traffic?: number;
}

export interface KeywordResult {
  keywords: KeywordRow[];
}

export interface GapKeyword {
  term: string;
  volume: number;
  kd: number;
  competitor: string;
  competitor_position: number;
}

export interface CompetitorSummary {
  domain: string;
  estimated_traffic: number;
  ranking_keywords: number;
  overlap_keywords: number;
}

export interface CompetitorResult {
  competitors: CompetitorSummary[];
  gap_keywords: GapKeyword[];
  quick_wins: GapKeyword[];
}

export interface AuditPage {
  url: string;
  title: string | null;
  top_keyword: string | null;
  position: number | null;
}

export interface ContentAuditResult {
  pages_found: number;
  ranking_pages: AuditPage[];
  missing_topics: string[];
  summary: string;
}

export interface LLMVisibilityResult {
  queries_tested: string[];
  brand_mentioned: boolean;
  mention_count: number;
  competitor_mentions: Record<string, number>;
  sample_response: string;
  note: string;
  llm_breakdown?: Array<{
    name: string;
    citation_rate: number;
    cited: number;
    total: number;
  }>;
  geo_recommendations?: Array<{
    action: string;
    impact_pct: number;
    effort: 'Low' | 'Med' | 'High';
  }>;
}

// ── Strategy Brief ────────────────────────────────────────────────────────

export interface ContentCluster {
  name: string;
  hub_page: string;
  spoke_pages: string[];
  target_keywords: string[];
  priority: number;
}

export interface Recommendation {
  title: string;
  rationale: string;
  estimated_impact: string;
  priority: number;
  phase?: 'bofu' | 'mofu' | 'tofu';
  action_type?: 'Create' | 'Fix' | 'Publish' | 'Monitor';
}

export interface StrategyBrief {
  id: string;
  workspace_id: string;
  plan_id: string;
  sprint_job_id: string;
  clusters: ContentCluster[];
  executive_summary: Recommendation[];
  share_token: string | null;
  status: BriefStatus;
  approved_at: string | null;
  created_at: string;
}

export interface FullBrief extends StrategyBrief {
  keyword_result: KeywordResult | null;
  competitor_result: CompetitorResult | null;
  content_audit_result: ContentAuditResult | null;
  llm_visibility_result: LLMVisibilityResult | null;
}

// ── Quick Audit ───────────────────────────────────────────────────────────

export type AuditSeverity = 'critical' | 'high' | 'medium' | 'quick_win';

export interface AuditActionItem {
  severity: AuditSeverity;
  title: string;
  rationale: string;
  effort_minutes: number | null;
}

export interface AuditScore {
  technical: number;
  content: number;
  ai_visibility: number;
  overall: number;
}

export interface QuickAuditResult {
  domain: string;
  domain_rating: number | null;
  estimated_monthly_traffic: number | null;
  top_keywords: string[];
  score: AuditScore;
  action_items: AuditActionItem[];
}

export interface ThreadAuditItem {
  type: 'audit';
  result: QuickAuditResult;
  created_at: string;
}

// ── Thread items ──────────────────────────────────────────────────────────

export interface ThreadGoalItem {
  type: 'goal';
  job_id: string;
  goal: string;
  feedback: string | null;
  job_status: JobStatus;
  created_at: string;
}

export interface ThreadPlanItem {
  type: 'plan';
  plan: Plan;
  job_status: JobStatus;
}

export interface ThreadResearchSectionItem {
  type: 'section';
  section_type: 'keyword' | 'competitor' | 'content_audit' | 'llm_visibility';
  job_id: string;
  job_status: JobStatus;
  result: KeywordResult | CompetitorResult | ContentAuditResult | LLMVisibilityResult | null;
}

export interface ThreadBriefItem {
  type: 'brief';
  brief_id: string;
  sprint_job_id: string;
  job_status: JobStatus;
  clusters: ContentCluster[];
  executive_summary: Recommendation[];
  share_token: string | null;
  brief_status: BriefStatus;
}

export interface ThreadJobsItem {
  type: 'jobs';
  sprint_job_id: string;
  sprint_status: JobStatus;
  children: Job[];
}

export interface ThreadErrorItem {
  type: 'error';
  job_id: string;
  error: JobError;
  created_at: string;
}

export type ThreadItem =
  | ThreadGoalItem
  | ThreadPlanItem
  | ThreadResearchSectionItem
  | ThreadBriefItem
  | ThreadJobsItem
  | ThreadErrorItem
  | ThreadAuditItem;
