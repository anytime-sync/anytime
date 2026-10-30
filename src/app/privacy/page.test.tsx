import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import PrivacyPage from './page';

vi.mock('next/link', () => ({
  default: (props: ComponentProps<'a'>) => <a {...props} />,
}));

function textContent(node: ReactTestInstance): string {
  return node.children.map(child => typeof child === 'string' ? child : textContent(child)).join('');
}

describe('privacy policy copy', () => {
  let page: ReactTestRenderer;

  beforeEach(() => { page = create(<PrivacyPage />); });
  afterEach(() => { page.unmount(); });

  function section(heading: string): ReactTestInstance {
    return page.root.findAllByType('section').find(node =>
      textContent(node.findByType('h2')) === heading
    )!;
  }

  it('renders the complete reviewed paragraph without an unsupported task-advertising claim', () => {
    const paragraphs = section("What we don't do").findAllByType('p');
    expect(paragraphs).toHaveLength(1);
    expect(textContent(paragraphs[0])).toBe(
      "We don't sell your data. We don't serve advertising. We don't share your tasks with third parties for marketing."
    );
  });

  it('preserves analytics providers, conditional loading, and the tracking caveat', () => {
    const copy = textContent(section('Cookies and analytics'));
    expect(copy).toContain('We use Vercel Analytics and Speed Insights');
    expect(copy).toContain('Google Analytics and Microsoft Clarity may also be loaded when configured');
    expect(copy).toContain('those services can collect additional usage information and use browser storage or cookies');
    expect(copy).toContain('This is not a tracking-free service.');
  });

  it('preserves provider disclosures and the qualified retention statement', () => {
    const storage = section('What we store');
    const copy = textContent(storage);
    expect(copy).toContain('Supabase-hosted Postgres database and storage services');
    expect(copy).toContain('We do not promise zero retention by Anthropic;');
    expect(copy).toContain('Voyage AI');
    expect(copy).toContain('Google Calendar, Telegram, email delivery and authorized MCP clients');
    expect(copy).toContain('Paid checkout is handled by Lemon Squeezy.');
    expect(storage.findByType('a').props.href).toBe(
      'https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data'
    );
  });
});
