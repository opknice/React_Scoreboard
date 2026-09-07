import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import TeamColorPreview from './TeamColorPreview';
import { DEFAULT_TEAM_COLOR_BROWSER_SETTINGS } from '../types/teamColorBrowserSettings';

describe('TeamColorPreview', () => {
  it('renders primary and secondary boxes for both teams', () => {
    render(
      <TeamColorPreview
        settings={DEFAULT_TEAM_COLOR_BROWSER_SETTINGS}
        colors={{
          A: { primary: '#ff0000', secondary: '#ffffff' },
          B: { primary: '#0000ff', secondary: '#000000' },
        }}
        showLabels
      />,
    );

    expect(screen.getByText('Team A · Primary')).toBeTruthy();
    expect(screen.getByText('Team A · Secondary')).toBeTruthy();
    expect(screen.getByText('Team B · Primary')).toBeTruthy();
    expect(screen.getByText('Team B · Secondary')).toBeTruthy();
  });
});
