import { describe, it, expect } from 'vitest';
import type { Mailbox } from '@/lib/jmap/types';
import { buildMailboxTree, type MailboxNode } from '@/lib/utils';
import { buildMoveTargets } from '../move-targets';
import { isMailboxHidden, withoutHiddenMailboxes } from '../mailbox-subscription';

function mb(id: string, name: string, extra: Partial<Mailbox> = {}): Mailbox {
  return {
    id, originalId: id, name, sortOrder: 0, totalEmails: 0, unreadEmails: 0, totalThreads: 0, unreadThreads: 0,
    myRights: { mayAddItems: true } as Mailbox['myRights'], isSubscribed: true, accountId: 'A', accountName: 'me@example.org',
    isShared: false, ...extra,
  } as Mailbox;
}

const flat = (nodes: MailboxNode[]): string[] => nodes.flatMap((n) => [n.id, ...flat(n.children)]);

describe('isMailboxHidden', () => {
  it('hides only unsubscribed, role-less, own folders', () => {
    expect(isMailboxHidden(mb('a', 'Old', { isSubscribed: false }))).toBe(true);
    expect(isMailboxHidden(mb('a', 'Old'))).toBe(false);
    expect(isMailboxHidden(mb('a', 'Old', { isSubscribed: undefined }))).toBe(false);
    expect(isMailboxHidden(mb('i', 'Inbox', { role: 'inbox', isSubscribed: false }))).toBe(false);
    expect(isMailboxHidden(mb('s', 'Shared', { isShared: true, isSubscribed: false }))).toBe(false);
  });
});

describe('withoutHiddenMailboxes', () => {
  const list = [
    mb('inbox', 'Inbox', { role: 'inbox' }),
    mb('inv', 'Invoices'),
    mb('inv25', '2025', { parentId: 'inv', isSubscribed: false }),
    mb('inv26', '2026', { parentId: 'inv' }),
  ];

  it('drops unsubscribed folders from the tree but keeps the rest', () => {
    expect(flat(buildMailboxTree(withoutHiddenMailboxes(list)))).toEqual(['inbox', 'inv', 'inv26']);
  });

  it('promotes subscribed children of an unsubscribed parent to the top level', () => {
    const l = [mb('inv', 'Invoices', { isSubscribed: false }), mb('inv26', '2026', { parentId: 'inv' })];
    expect(buildMailboxTree(withoutHiddenMailboxes(l)).map((n) => n.id)).toEqual(['inv26']);
  });

  it('does not modify the input list', () => {
    withoutHiddenMailboxes(list);
    expect(list).toHaveLength(4);
  });

  it('removes hidden folders from move targets', () => {
    const { tree, targetIds } = buildMoveTargets(list, { currentMailboxId: 'inbox', ownerAccountId: 'A' });
    expect(flat(tree)).toEqual(['inv', 'inv26']);
    expect(targetIds.has('inv25')).toBe(false);
  });
});
