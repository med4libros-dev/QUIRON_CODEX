import type { HighlightColor } from '../../types';

export interface SynthFragment {
  text: string;
  page?: number;
  color?: HighlightColor;
}

export interface SynthInput {
  title: string;
  fragments: SynthFragment[];
  notesText: string;
  sourceText: string;
}
