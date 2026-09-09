export type UsageGuideSectionId =
  | 'getting-started'
  | 'league-management'
  | 'match-control'
  | 'obs-setup'
  | 'replay-var-macros';

export interface UsageGuideVideo {
  label: string;
  url: string;
}

export interface UsageGuideSection {
  id: UsageGuideSectionId;
  title: string;
  description: string;
  steps: readonly string[];
  tip: string;
  video?: UsageGuideVideo;
}
