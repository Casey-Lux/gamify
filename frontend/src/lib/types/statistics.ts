export type StatGranularity = 'day' | 'week' | 'month';

export interface CompletionWithContext {
  id: string;
  completed_at: string;
  xp_awarded: number;
  coins_awarded: number;
  skill_id: string;
  skill_name: string;
  area_id: string | null;
  area_name: string | null;
}

export interface SkillProgress {
  skill_id: string;
  skill_name: string;
  level: number;
  xp: number;
}

export interface StatBucket {
  key: string;
  label: string;
  start: Date;
  end: Date;
}
