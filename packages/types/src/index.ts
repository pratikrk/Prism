// finalize is a Celery chord callback, not a tracked job row — excluded here.
export type JobType =
  | 'orchestrator'
  | 'sprint'
  | 'keyword'
  | 'competitor'
  | 'content_audit'
  | 'llm_visibility';

export type JobStatus =
  | 'pending'
  | 'running'
  | 'awaiting_gate0'
  | 'complete'
  | 'complete_with_errors'
  | 'failed';

export type PlanStatus = 'draft' | 'approved' | 'superseded';

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

export type ThreadItem =
  | ThreadGoalItem
  | ThreadPlanItem
  | ThreadJobsItem
  | ThreadErrorItem;

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
