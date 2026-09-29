import type { InsightType } from '@synapse/shared';

export const INSIGHT_LABEL: Record<InsightType, string> = {
  key_finding: 'Key finding',
  theme: 'Theme',
  contradiction: 'Potential contradiction',
  research_gap: 'Research gap',
  unanswered_question: 'Unanswered question',
};
