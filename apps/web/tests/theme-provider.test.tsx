import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from '@/components/theme-provider';
import { ThemeToggle } from '@/components/theme-toggle';
import { describe, it, expect, beforeEach } from 'vitest';

describe('ThemeToggle', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark', 'light');
  });

  it('cycles through light / dark / system via the select', async () => {
    render(
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <ThemeToggle />
      </ThemeProvider>,
    );
    const select = await screen.findByRole('combobox', { name: /theme/i });
    fireEvent.change(select, { target: { value: 'dark' } });
    expect(document.documentElement).toHaveClass('dark');
    fireEvent.change(select, { target: { value: 'light' } });
    expect(document.documentElement).toHaveClass('light');
  });
});
