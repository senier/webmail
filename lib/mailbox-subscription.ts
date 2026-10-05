import type { Mailbox } from "@/lib/jmap/types";

/**
 * Own folders the user has unsubscribed from (JMAP `isSubscribed: false`) are
 * hidden from navigation. System folders (anything with a role) and shared
 * accounts' folders are never hidden: shared folders routinely report
 * `isSubscribed: false` until the owner subscribes the user, and hiding a
 * system folder would strand the user.
 *
 * Filtering the flat list (rather than the tree) means a subscribed child of an
 * unsubscribed folder is promoted to the top level by `buildMailboxTree`
 * instead of disappearing with its parent.
 */
export function isMailboxHidden(mailbox: Mailbox): boolean {
  return mailbox.isSubscribed === false && !mailbox.role && !mailbox.isShared;
}

export function withoutHiddenMailboxes(mailboxes: Mailbox[]): Mailbox[] {
  return mailboxes.filter((mailbox) => !isMailboxHidden(mailbox));
}
