import {
  blockedUsersTable,
  conversationDraftsTable,
  conversationMembershipsTable,
  conversationsTable,
  directConversationsTable,
  messageReactionsTable,
  messagesTable,
  pinnedMessagesTable,
  type DatabaseClient,
  usersTable,
} from '@megaconvert/database';
import {
  type ConversationDetail,
  type ConversationDraft,
  type ConversationListQuery,
  type ConversationMember,
  type ConversationSummary,
  type CreateDirectConversationInput,
  type CreateGroupConversationInput,
  type EditMessageInput,
  type Message,
  type MessageHistoryQuery,
  type MessageReaction,
  type MessageReference,
  type PaginatedConversations,
  type PaginatedMessages,
  type ReadState,
  type SendMessageInput,
  type UpdateConversationDraftInput,
  type UpdateReadStateInput,
  type UserProfileCard,
} from '@megaconvert/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, inArray, lt, or, sql } from 'drizzle-orm';

import { DATABASE_CLIENT } from '../../database/database.constants';
import { MessagingDomainError } from '../domain/messaging.errors';

import type {
  ConversationDraftMutationResult,
  ConversationMutationResult,
  MessageMutationResult,
  MessagingRepository,
  ReadStateMutationResult,
} from '../application/messaging.repository';

type DatabaseTransaction = Parameters<Parameters<DatabaseClient['transaction']>[0]>[0];
type DatabaseExecutor = DatabaseClient | DatabaseTransaction;
type ConversationRecord = typeof conversationsTable.$inferSelect;
type MembershipRecord = typeof conversationMembershipsTable.$inferSelect;
type MessageRecord = typeof messagesTable.$inferSelect;
type DraftRecord = typeof conversationDraftsTable.$inferSelect;
type UserRecord = typeof usersTable.$inferSelect;

interface ConversationWindowRow {
  conversation: ConversationRecord;
  membership: MembershipRecord;
}

const MAX_PINNED_MESSAGES = 8;

@Injectable()
export class PostgresMessagingRepository implements MessagingRepository {
  public constructor(
    @Inject(DATABASE_CLIENT) private readonly databaseClient: DatabaseClient,
  ) {}

  public async createOrGetDirectConversation(
    actorUserId: string,
    input: CreateDirectConversationInput,
  ): Promise<ConversationMutationResult> {
    const participant = await this.findUserByUsername(this.databaseClient, input.participantUsername);

    if (!participant) {
      throw new MessagingDomainError('participant_not_found');
    }

    if (participant.id === actorUserId) {
      throw new MessagingDomainError('direct_conversation_with_self');
    }

    const blockedRows = await this.databaseClient
      .select()
      .from(blockedUsersTable)
      .where(
        or(
          and(
            eq(blockedUsersTable.userId, actorUserId),
            eq(blockedUsersTable.blockedUserId, participant.id),
          ),
          and(
            eq(blockedUsersTable.userId, participant.id),
            eq(blockedUsersTable.blockedUserId, actorUserId),
          ),
        ),
      )
      .limit(1);
    const blocked = blockedRows[0] ?? null;

    if (blocked) {
      throw new MessagingDomainError('blocked_direct_message');
    }

    const [participantOneUserId, participantTwoUserId] = normalizeParticipantPair(
      actorUserId,
      participant.id,
    );

    const existingDirectRows = await this.databaseClient
      .select()
      .from(directConversationsTable)
      .where(
        and(
          eq(directConversationsTable.participantOneUserId, participantOneUserId),
          eq(directConversationsTable.participantTwoUserId, participantTwoUserId),
        ),
      )
      .limit(1);
    const existingDirect = existingDirectRows[0] ?? null;

    if (existingDirect) {
      return {
        conversation: await this.getConversationDetail(actorUserId, existingDirect.conversationId),
        created: false,
        memberIds: [actorUserId, participant.id],
      };
    }

    const createdConversationId = await this.databaseClient.transaction(async (transaction) => {
      const now = new Date();
      const conversation = (
        await transaction
        .insert(conversationsTable)
        .values({
          createdByUserId: actorUserId,
          kind: 'direct',
          lastActivityAt: now,
          updatedAt: now,
        })
        .returning()
      )[0]!;

      await transaction.insert(directConversationsTable).values({
        conversationId: conversation.id,
        participantOneUserId,
        participantTwoUserId,
      });

      await transaction.insert(conversationMembershipsTable).values([
        {
          conversationId: conversation.id,
          role: 'member',
          userId: actorUserId,
        },
        {
          conversationId: conversation.id,
          role: 'member',
          userId: participant.id,
        },
      ]);

      return conversation.id;
    });

    return {
      conversation: await this.getConversationDetail(actorUserId, createdConversationId),
      created: true,
      memberIds: [actorUserId, participant.id],
    };
  }

  public async createGroupConversation(
    actorUserId: string,
    input: CreateGroupConversationInput,
  ): Promise<ConversationMutationResult> {
    const requestedUsernames = input.memberUsernames.map((username: string) =>
      username.trim().toLowerCase(),
    );
    const uniqueUsernames = [...new Set(requestedUsernames)];

    if (uniqueUsernames.length !== requestedUsernames.length) {
      throw new MessagingDomainError('duplicate_group_members');
    }

    const actor = await this.findUserById(this.databaseClient, actorUserId);

    if (!actor) {
      throw new MessagingDomainError('participant_not_found');
    }

    const requestedMembers = await this.findUsersByUsernames(this.databaseClient, uniqueUsernames);

    if (requestedMembers.length !== uniqueUsernames.length) {
      throw new MessagingDomainError('participant_not_found');
    }

    const otherMembers = requestedMembers.filter((member) => member.id !== actorUserId);

    if (otherMembers.length === 0) {
      throw new MessagingDomainError('group_members_required');
    }

    const memberIds: string[] = [actorUserId, ...otherMembers.map((member) => member.id)];
    const conversationId = await this.databaseClient.transaction(async (transaction) => {
      const now = new Date();
      const conversation = (
        await transaction
        .insert(conversationsTable)
        .values({
          createdByUserId: actorUserId,
          kind: 'group',
          lastActivityAt: now,
          title: input.title,
          updatedAt: now,
        })
        .returning()
      )[0]!;

      await transaction.insert(conversationMembershipsTable).values([
        {
          conversationId: conversation.id,
          role: 'owner',
          userId: actorUserId,
        },
        ...otherMembers.map((member) => ({
          conversationId: conversation.id,
          role: 'member' as const,
          userId: member.id,
        })),
      ]);

      const sequenceRow = (
        await transaction
        .update(conversationsTable)
        .set({
          lastActivityAt: now,
          lastMessageAt: now,
          messageSequence: sql`${conversationsTable.messageSequence} + 1`,
          updatedAt: now,
        })
        .where(eq(conversationsTable.id, conversation.id))
        .returning({
          sequence: conversationsTable.messageSequence,
        })
      )[0]!;

      const systemMessage = (
        await transaction
        .insert(messagesTable)
        .values({
          authorUserId: null,
          body: `${actor.displayName} created ${input.title}.`,
          conversationId: conversation.id,
          kind: 'system',
          metadata: {
            affectedUserIds: memberIds,
            eventType: 'conversation_created',
            title: input.title,
          },
          sequence: sequenceRow.sequence,
          status: 'active',
          updatedAt: now,
        })
        .returning()
      )[0]!;

      await transaction
        .update(conversationsTable)
        .set({
          lastMessageId: systemMessage.id,
        })
        .where(eq(conversationsTable.id, conversation.id));

      await transaction
        .update(conversationMembershipsTable)
        .set({
          lastReadAt: now,
          lastReadMessageId: systemMessage.id,
          lastReadSequence: systemMessage.sequence,
          updatedAt: now,
        })
        .where(eq(conversationMembershipsTable.conversationId, conversation.id));

      return conversation.id;
    });

    return {
      conversation: await this.getConversationDetail(actorUserId, conversationId),
      created: true,
      memberIds,
    };
  }

  public async deleteMessage(
    actorUserId: string,
    conversationId: string,
    messageId: string,
  ): Promise<MessageMutationResult> {
    const mutation = await this.databaseClient.transaction(async (transaction) => {
      await this.getConversationAccess(transaction, actorUserId, conversationId);
      const message = await this.getOwnedMutableMessage(transaction, actorUserId, conversationId, messageId);

      if (message.status === 'deleted') {
        return {
          memberIds: await this.listConversationMemberIds(transaction, conversationId),
          message,
        };
      }

      const now = new Date();
      const updatedMessage = (
        await transaction
        .update(messagesTable)
        .set({
          body: null,
          deletedAt: now,
          status: 'deleted',
          updatedAt: now,
        })
        .where(eq(messagesTable.id, message.id))
        .returning()
      )[0]!;

      return {
        memberIds: await this.listConversationMemberIds(transaction, conversationId),
        message: updatedMessage,
      };
    });

    const [mappedMessage] = await this.buildMessages(this.databaseClient, actorUserId, [mutation.message]);

    return {
      memberIds: mutation.memberIds,
      message: mappedMessage!,
    };
  }

  public async editMessage(
    actorUserId: string,
    conversationId: string,
    messageId: string,
    input: EditMessageInput,
  ): Promise<MessageMutationResult> {
    const mutation = await this.databaseClient.transaction(async (transaction) => {
      await this.getConversationAccess(transaction, actorUserId, conversationId);
      await this.getOwnedMutableMessage(transaction, actorUserId, conversationId, messageId);

      const now = new Date();
      const updatedMessage = (
        await transaction
        .update(messagesTable)
        .set({
          body: input.body,
          editedAt: now,
          status: 'edited',
          updatedAt: now,
        })
        .where(eq(messagesTable.id, messageId))
        .returning()
      )[0]!;

      return {
        memberIds: await this.listConversationMemberIds(transaction, conversationId),
        message: updatedMessage,
      };
    });

    const [mappedMessage] = await this.buildMessages(this.databaseClient, actorUserId, [mutation.message]);

    return {
      memberIds: mutation.memberIds,
      message: mappedMessage!,
    };
  }

  public async getConversationDetail(
    actorUserId: string,
    conversationId: string,
  ): Promise<ConversationDetail> {
    const access = await this.getConversationAccess(this.databaseClient, actorUserId, conversationId);
    const summary = (
      await this.buildConversationSummaries(this.databaseClient, actorUserId, [access])
    )[0]!;

    const members = await this.databaseClient
      .select({
        membership: conversationMembershipsTable,
        user: usersTable,
      })
      .from(conversationMembershipsTable)
      .innerJoin(usersTable, eq(conversationMembershipsTable.userId, usersTable.id))
      .where(eq(conversationMembershipsTable.conversationId, conversationId))
      .orderBy(asc(conversationMembershipsTable.joinedAt));

    const pinnedRows = await this.databaseClient
      .select({
        message: messagesTable,
        pinnedAt: pinnedMessagesTable.pinnedAt,
        pinnedBy: usersTable,
      })
      .from(pinnedMessagesTable)
      .innerJoin(messagesTable, eq(pinnedMessagesTable.messageId, messagesTable.id))
      .innerJoin(usersTable, eq(pinnedMessagesTable.pinnedByUserId, usersTable.id))
      .where(eq(pinnedMessagesTable.conversationId, conversationId))
      .orderBy(desc(pinnedMessagesTable.pinnedAt))
      .limit(MAX_PINNED_MESSAGES);

    const pinnedAuthorIds = pinnedRows
      .map((row) => row.message.authorUserId)
      .filter((value): value is string => value !== null);
    const pinnedAuthors = await this.findUsersByIds(this.databaseClient, pinnedAuthorIds);
    const pinnedAuthorMap = new Map(pinnedAuthors.map((user) => [user.id, mapUserToProfileCard(user)]));

    return {
      ...summary,
      members: members.map((row) => ({
        joinedAt: row.membership.joinedAt.toISOString(),
        role: row.membership.role,
        user: mapUserToProfileCard(row.user),
      })),
      pinnedMessages: pinnedRows.map((row) => ({
        message: mapMessageReference(row.message, pinnedAuthorMap.get(row.message.authorUserId ?? '') ?? null),
        pinnedAt: row.pinnedAt.toISOString(),
        pinnedBy: mapUserToProfileCard(row.pinnedBy),
      })),
    };
  }

  public async listConversationMessages(
    actorUserId: string,
    conversationId: string,
    query: MessageHistoryQuery,
  ): Promise<PaginatedMessages> {
    await this.getConversationAccess(this.databaseClient, actorUserId, conversationId);

    const rows = await this.databaseClient
      .select({
        message: messagesTable,
      })
      .from(messagesTable)
      .where(
        and(
          eq(messagesTable.conversationId, conversationId),
          query.beforeSequence ? lt(messagesTable.sequence, query.beforeSequence) : undefined,
        ),
      )
      .orderBy(desc(messagesTable.sequence))
      .limit(query.limit + 1);

    const hasMore = rows.length > query.limit;
    const pageRows = hasMore ? rows.slice(0, query.limit) : rows;
    const messages = await this.buildMessages(
      this.databaseClient,
      actorUserId,
      pageRows.map((row) => row.message).reverse(),
    );

    return {
      messages,
      nextBeforeSequence: hasMore ? (pageRows.at(-1)?.message.sequence ?? null) : null,
    };
  }

  public async listConversations(
    actorUserId: string,
    query: ConversationListQuery,
  ): Promise<PaginatedConversations> {
    const cursor = decodeConversationCursor(query.cursor);
    const rows = await this.databaseClient
      .select({
        conversation: conversationsTable,
        membership: conversationMembershipsTable,
      })
      .from(conversationMembershipsTable)
      .innerJoin(conversationsTable, eq(conversationMembershipsTable.conversationId, conversationsTable.id))
      .where(
        and(
          eq(conversationMembershipsTable.userId, actorUserId),
          cursor
            ? or(
                lt(conversationsTable.lastActivityAt, cursor.lastActivityAt),
                and(
                  eq(conversationsTable.lastActivityAt, cursor.lastActivityAt),
                  lt(conversationsTable.id, cursor.id),
                ),
              )
            : undefined,
        ),
      )
      .orderBy(desc(conversationsTable.lastActivityAt), desc(conversationsTable.id))
      .limit(query.limit + 1);

    const hasMore = rows.length > query.limit;
    const pageRows = hasMore ? rows.slice(0, query.limit) : rows;
    const conversations = await this.buildConversationSummaries(this.databaseClient, actorUserId, pageRows);

    return {
      conversations,
      nextCursor: hasMore
        ? (() => {
            const lastRow = pageRows.at(-1);
            return lastRow
              ? encodeConversationCursor(lastRow.conversation.lastActivityAt, lastRow.conversation.id)
              : null;
          })()
        : null,
    };
  }

  public async removeReaction(
    actorUserId: string,
    conversationId: string,
    messageId: string,
    reaction: string,
  ): Promise<MessageMutationResult> {
    const mutation = await this.databaseClient.transaction(async (transaction) => {
      await this.getConversationAccess(transaction, actorUserId, conversationId);
      await this.requireMessage(transaction, conversationId, messageId);

      await transaction
        .delete(messageReactionsTable)
        .where(
          and(
            eq(messageReactionsTable.messageId, messageId),
            eq(messageReactionsTable.reaction, reaction),
            eq(messageReactionsTable.userId, actorUserId),
          ),
        );

      return {
        memberIds: await this.listConversationMemberIds(transaction, conversationId),
        message: await this.requireMessage(transaction, conversationId, messageId),
      };
    });

    const [mappedMessage] = await this.buildMessages(this.databaseClient, actorUserId, [mutation.message]);

    return {
      memberIds: mutation.memberIds,
      message: mappedMessage!,
    };
  }

  public async saveDraft(
    actorUserId: string,
    conversationId: string,
    input: UpdateConversationDraftInput,
  ): Promise<ConversationDraftMutationResult> {
    await this.getConversationAccess(this.databaseClient, actorUserId, conversationId);

    if (input.replyToMessageId) {
      await this.requireActiveReplyTarget(this.databaseClient, conversationId, input.replyToMessageId);
    }

    const body = input.body?.trim() ?? '';

    if (body.length === 0 && !input.replyToMessageId) {
      await this.databaseClient
        .delete(conversationDraftsTable)
        .where(
          and(
            eq(conversationDraftsTable.conversationId, conversationId),
            eq(conversationDraftsTable.userId, actorUserId),
          ),
        );

      return {
        conversationId,
        draft: null,
      };
    }

    const now = new Date();
    const draft = (
      await this.databaseClient
      .insert(conversationDraftsTable)
      .values({
        body,
        conversationId,
        replyToMessageId: input.replyToMessageId ?? null,
        updatedAt: now,
        userId: actorUserId,
      })
      .onConflictDoUpdate({
        set: {
          body,
          replyToMessageId: input.replyToMessageId ?? null,
          updatedAt: now,
        },
        target: [conversationDraftsTable.userId, conversationDraftsTable.conversationId],
      })
      .returning()
    )[0]!;

    return {
      conversationId,
      draft: mapDraft(draft),
    };
  }

  public async sendMessage(
    actorUserId: string,
    conversationId: string,
    input: SendMessageInput,
  ): Promise<MessageMutationResult> {
    if (input.replyToMessageId) {
      await this.requireActiveReplyTarget(this.databaseClient, conversationId, input.replyToMessageId);
    }

    if (input.clientRequestId) {
      const existing = await this.databaseClient.query.messagesTable.findFirst({
        where: and(
          eq(messagesTable.authorUserId, actorUserId),
          eq(messagesTable.clientRequestId, input.clientRequestId),
          eq(messagesTable.conversationId, conversationId),
        ),
      });

      if (existing) {
        const [mappedMessage] = await this.buildMessages(this.databaseClient, actorUserId, [existing]);

        return {
          memberIds: await this.listConversationMemberIds(this.databaseClient, conversationId),
          message: mappedMessage!,
        };
      }
    }

    const mutation = await this.databaseClient.transaction(async (transaction) => {
      await this.getConversationAccess(transaction, actorUserId, conversationId);

      const now = new Date();
      const sequenceRow = (
        await transaction
        .update(conversationsTable)
        .set({
          lastActivityAt: now,
          lastMessageAt: now,
          messageSequence: sql`${conversationsTable.messageSequence} + 1`,
          updatedAt: now,
        })
        .where(eq(conversationsTable.id, conversationId))
        .returning({
          sequence: conversationsTable.messageSequence,
        })
      )[0]!;

      const message = (
        await transaction
        .insert(messagesTable)
        .values({
          authorUserId: actorUserId,
          body: input.body,
          clientRequestId: input.clientRequestId ?? null,
          conversationId,
          kind: 'user',
          replyToMessageId: input.replyToMessageId ?? null,
          sequence: sequenceRow.sequence,
          status: 'active',
          updatedAt: now,
        })
        .returning()
      )[0]!;

      await transaction
        .update(conversationsTable)
        .set({
          lastMessageId: message.id,
        })
        .where(eq(conversationsTable.id, conversationId));

      await transaction
        .update(conversationMembershipsTable)
        .set({
          lastReadAt: now,
          lastReadMessageId: message.id,
          lastReadSequence: message.sequence,
          updatedAt: now,
        })
        .where(
          and(
            eq(conversationMembershipsTable.conversationId, conversationId),
            eq(conversationMembershipsTable.userId, actorUserId),
          ),
        );

      return {
        memberIds: await this.listConversationMemberIds(transaction, conversationId),
        message,
      };
    });

    const [mappedMessage] = await this.buildMessages(this.databaseClient, actorUserId, [mutation.message]);

    return {
      memberIds: mutation.memberIds,
      message: mappedMessage!,
    };
  }

  public async updateReadState(
    actorUserId: string,
    conversationId: string,
    input: UpdateReadStateInput,
  ): Promise<ReadStateMutationResult> {
    const access = await this.getConversationAccess(this.databaseClient, actorUserId, conversationId);
    const targetSequence = Math.min(
      access.conversation.messageSequence,
      Math.max(access.membership.lastReadSequence, input.lastReadSequence),
    );

    if (targetSequence === access.membership.lastReadSequence) {
      return {
        conversationId,
        memberIds: await this.listConversationMemberIds(this.databaseClient, conversationId),
        readState: mapReadState(access.membership),
      };
    }

    const targetMessage =
      targetSequence > 0
        ? (
            await this.databaseClient
              .select()
              .from(messagesTable)
              .where(
                and(
                  eq(messagesTable.conversationId, conversationId),
                  eq(messagesTable.sequence, targetSequence),
                ),
              )
              .limit(1)
          )[0] ?? null
        : null;

    const now = new Date();
    const membership = (
      await this.databaseClient
      .update(conversationMembershipsTable)
      .set({
        lastReadAt: now,
        lastReadMessageId: targetMessage?.id ?? null,
        lastReadSequence: targetSequence,
        updatedAt: now,
      })
      .where(
        and(
          eq(conversationMembershipsTable.conversationId, conversationId),
          eq(conversationMembershipsTable.userId, actorUserId),
        ),
      )
      .returning()
    )[0]!;

    return {
      conversationId,
      memberIds: await this.listConversationMemberIds(this.databaseClient, conversationId),
      readState: mapReadState(membership),
    };
  }

  public async upsertReaction(
    actorUserId: string,
    conversationId: string,
    messageId: string,
    reaction: string,
  ): Promise<MessageMutationResult> {
    const mutation = await this.databaseClient.transaction(async (transaction) => {
      await this.getConversationAccess(transaction, actorUserId, conversationId);
      const message = await this.requireMessage(transaction, conversationId, messageId);

      if (message.status === 'deleted') {
        throw new MessagingDomainError('message_edit_not_allowed');
      }

      await transaction
        .insert(messageReactionsTable)
        .values({
          messageId,
          reaction,
          userId: actorUserId,
        })
        .onConflictDoNothing();

      return {
        memberIds: await this.listConversationMemberIds(transaction, conversationId),
        message,
      };
    });

    const [mappedMessage] = await this.buildMessages(this.databaseClient, actorUserId, [mutation.message]);

    return {
      memberIds: mutation.memberIds,
      message: mappedMessage!,
    };
  }

  private async buildConversationSummaries(
    executor: DatabaseExecutor,
    actorUserId: string,
    rows: readonly ConversationWindowRow[],
  ): Promise<ConversationSummary[]> {
    if (rows.length === 0) {
      return [];
    }

    const conversationIds = rows.map((row) => row.conversation.id);
    const lastMessageIds = rows
      .map((row) => row.conversation.lastMessageId)
      .filter((value): value is string => value !== null);

    const [draftRows, memberRows, directRows, pinnedCountRows, lastMessageRows] = await Promise.all([
      executor
        .select()
        .from(conversationDraftsTable)
        .where(
          and(
            eq(conversationDraftsTable.userId, actorUserId),
            inArray(conversationDraftsTable.conversationId, conversationIds),
          ),
        ),
      executor
        .select({
          membership: conversationMembershipsTable,
          user: usersTable,
        })
        .from(conversationMembershipsTable)
        .innerJoin(usersTable, eq(conversationMembershipsTable.userId, usersTable.id))
        .where(inArray(conversationMembershipsTable.conversationId, conversationIds))
        .orderBy(asc(conversationMembershipsTable.joinedAt)),
      executor
        .select()
        .from(directConversationsTable)
        .where(inArray(directConversationsTable.conversationId, conversationIds)),
      executor
        .select({
          conversationId: pinnedMessagesTable.conversationId,
          count: sql<number>`count(*)`.mapWith(Number),
        })
        .from(pinnedMessagesTable)
        .where(inArray(pinnedMessagesTable.conversationId, conversationIds))
        .groupBy(pinnedMessagesTable.conversationId),
      lastMessageIds.length === 0
        ? Promise.resolve([])
        : executor
            .select({
              author: usersTable,
              message: messagesTable,
            })
            .from(messagesTable)
            .leftJoin(usersTable, eq(messagesTable.authorUserId, usersTable.id))
            .where(inArray(messagesTable.id, lastMessageIds)),
    ]);

    const draftMap = new Map(draftRows.map((draft) => [draft.conversationId, mapDraft(draft)]));
    const directMap = new Map(directRows.map((row) => [row.conversationId, row]));
    const pinnedCountMap = new Map(pinnedCountRows.map((row) => [row.conversationId, row.count]));
    const lastMessageMap = new Map(
      lastMessageRows.map((row) => [
        row.message.id,
        {
          author: row.author ? mapUserToProfileCard(row.author) : null,
          message: row.message,
        },
      ]),
    );

    const membersByConversation = new Map<string, ConversationMember[]>();
    for (const row of memberRows) {
      const existing = membersByConversation.get(row.membership.conversationId) ?? [];
      existing.push({
        joinedAt: row.membership.joinedAt.toISOString(),
        role: row.membership.role,
        user: mapUserToProfileCard(row.user),
      });
      membersByConversation.set(row.membership.conversationId, existing);
    }

    return rows.map((row) => {
      const members = membersByConversation.get(row.conversation.id) ?? [];
      const directConversation = directMap.get(row.conversation.id);
      const counterpartProfiles =
        row.conversation.kind === 'direct' && directConversation
          ? members.filter((member) => member.user.id !== actorUserId).map((member) => member.user)
          : members.filter((member) => member.user.id !== actorUserId).slice(0, 4).map((member) => member.user);
      const lastMessage = row.conversation.lastMessageId
        ? lastMessageMap.get(row.conversation.lastMessageId)
        : null;

      return {
        counterpartProfiles,
        createdAt: row.conversation.createdAt.toISOString(),
        draft: draftMap.get(row.conversation.id) ?? null,
        id: row.conversation.id,
        kind: row.conversation.kind,
        lastActivityAt: row.conversation.lastActivityAt.toISOString(),
        lastMessage: lastMessage
          ? {
              author: lastMessage.author,
              bodyPreview: buildBodyPreview(lastMessage.message.body),
              createdAt: lastMessage.message.createdAt.toISOString(),
              id: lastMessage.message.id,
              kind: lastMessage.message.kind,
              sequence: lastMessage.message.sequence,
              status: lastMessage.message.status,
            }
          : null,
        memberCount: members.length,
        pinnedMessageCount: pinnedCountMap.get(row.conversation.id) ?? 0,
        title: row.conversation.kind === 'group' ? row.conversation.title : null,
        viewer: {
          joinedAt: row.membership.joinedAt.toISOString(),
          lastReadAt: row.membership.lastReadAt?.toISOString() ?? null,
          lastReadMessageId: row.membership.lastReadMessageId,
          lastReadSequence: row.membership.lastReadSequence,
          role: row.membership.role,
          unreadCount: Math.max(row.conversation.messageSequence - row.membership.lastReadSequence, 0),
        },
      };
    });
  }

  private async buildMessages(
    executor: DatabaseExecutor,
    actorUserId: string,
    messages: readonly MessageRecord[],
  ): Promise<Message[]> {
    if (messages.length === 0) {
      return [];
    }

    const messageIds = messages.map((message) => message.id);
    const authorIds = messages
      .map((message) => message.authorUserId)
      .filter((value): value is string => value !== null);
    const replyIds = messages
      .map((message) => message.replyToMessageId)
      .filter((value): value is string => value !== null);

    const [authors, reactions, replyRows] = await Promise.all([
      this.findUsersByIds(executor, authorIds),
      executor
        .select()
        .from(messageReactionsTable)
        .where(inArray(messageReactionsTable.messageId, messageIds)),
      replyIds.length === 0
        ? Promise.resolve([])
        : executor
            .select({
              author: usersTable,
              message: messagesTable,
            })
            .from(messagesTable)
            .leftJoin(usersTable, eq(messagesTable.authorUserId, usersTable.id))
            .where(inArray(messagesTable.id, replyIds)),
    ]);

    const authorMap = new Map(authors.map((user) => [user.id, mapUserToProfileCard(user)]));
    const replyMap = new Map(
      replyRows.map((row) => [
        row.message.id,
        mapMessageReference(row.message, row.author ? mapUserToProfileCard(row.author) : null),
      ]),
    );
    const reactionsByMessage = groupReactionsByMessage(reactions, actorUserId);

    return messages.map((message) => ({
      author: message.authorUserId ? authorMap.get(message.authorUserId) ?? null : null,
      body: message.body,
      conversationId: message.conversationId,
      createdAt: message.createdAt.toISOString(),
      deletedAt: message.deletedAt?.toISOString() ?? null,
      editedAt: message.editedAt?.toISOString() ?? null,
      id: message.id,
      kind: message.kind,
      reactions: reactionsByMessage.get(message.id) ?? [],
      replyToMessage: message.replyToMessageId ? replyMap.get(message.replyToMessageId) ?? null : null,
      sequence: message.sequence,
      status: message.status,
      systemMetadata: mapSystemMetadata(message.metadata),
      updatedAt: message.updatedAt.toISOString(),
    }));
  }

  private async findUserById(executor: DatabaseExecutor, userId: string): Promise<UserRecord | null> {
    return (
      await executor
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, userId))
        .limit(1)
    )[0] ?? null;
  }

  private async findUserByUsername(executor: DatabaseExecutor, username: string): Promise<UserRecord | null> {
    return (
      await executor
        .select()
        .from(usersTable)
        .where(eq(usersTable.username, username.trim().toLowerCase()))
        .limit(1)
    )[0] ?? null;
  }

  private async findUsersByIds(executor: DatabaseExecutor, userIds: readonly string[]): Promise<UserRecord[]> {
    const uniqueUserIds = [...new Set(userIds)];
    if (uniqueUserIds.length === 0) {
      return [];
    }

    return executor.select().from(usersTable).where(inArray(usersTable.id, uniqueUserIds));
  }

  private async findUsersByUsernames(
    executor: DatabaseExecutor,
    usernames: readonly string[],
  ): Promise<UserRecord[]> {
    if (usernames.length === 0) {
      return [];
    }

    return executor
      .select()
      .from(usersTable)
      .where(inArray(usersTable.username, usernames.map((username) => username.trim().toLowerCase())));
  }

  private async getConversationAccess(
    executor: DatabaseExecutor,
    actorUserId: string,
    conversationId: string,
  ): Promise<ConversationWindowRow> {
    const rows = await executor
      .select({
        conversation: conversationsTable,
        membership: conversationMembershipsTable,
      })
      .from(conversationMembershipsTable)
      .innerJoin(conversationsTable, eq(conversationMembershipsTable.conversationId, conversationsTable.id))
      .where(
        and(
          eq(conversationMembershipsTable.conversationId, conversationId),
          eq(conversationMembershipsTable.userId, actorUserId),
        ),
      )
      .limit(1);

    const row = rows[0];

    if (!row) {
      throw new MessagingDomainError('conversation_not_found');
    }

    return row;
  }

  private async getOwnedMutableMessage(
    executor: DatabaseExecutor,
    actorUserId: string,
    conversationId: string,
    messageId: string,
  ): Promise<MessageRecord> {
    const message = await this.requireMessage(executor, conversationId, messageId);

    if (message.authorUserId !== actorUserId || message.kind !== 'user') {
      throw new MessagingDomainError('message_edit_not_allowed');
    }

    return message;
  }

  private async listConversationMemberIds(
    executor: DatabaseExecutor,
    conversationId: string,
  ): Promise<string[]> {
    const rows = await executor
      .select({
        userId: conversationMembershipsTable.userId,
      })
      .from(conversationMembershipsTable)
      .where(eq(conversationMembershipsTable.conversationId, conversationId));

    return rows.map((row) => row.userId);
  }

  private async requireActiveReplyTarget(
    executor: DatabaseExecutor,
    conversationId: string,
    messageId: string,
  ): Promise<void> {
    const message = await this.requireMessage(executor, conversationId, messageId);

    if (message.status === 'deleted') {
      throw new MessagingDomainError('message_reply_invalid');
    }
  }

  private async requireMessage(
    executor: DatabaseExecutor,
    conversationId: string,
    messageId: string,
  ): Promise<MessageRecord> {
    const message = (
      await executor
        .select()
        .from(messagesTable)
        .where(
          and(
            eq(messagesTable.conversationId, conversationId),
            eq(messagesTable.id, messageId),
          ),
        )
        .limit(1)
    )[0] ?? null;

    if (!message) {
      throw new MessagingDomainError('message_not_found');
    }

    return message;
  }
}

function buildBodyPreview(body: string | null): string | null {
  if (!body) {
    return null;
  }

  return body.length > 280 ? `${body.slice(0, 277)}...` : body;
}

function decodeConversationCursor(cursor: string | undefined): {
  id: string;
  lastActivityAt: Date;
} | null {
  if (!cursor) {
    return null;
  }

  const decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as {
    id: string;
    lastActivityAt: string;
  };

  return {
    id: decoded.id,
    lastActivityAt: new Date(decoded.lastActivityAt),
  };
}

function encodeConversationCursor(lastActivityAt: Date, id: string): string {
  return Buffer.from(
    JSON.stringify({
      id,
      lastActivityAt: lastActivityAt.toISOString(),
    }),
    'utf8',
  ).toString('base64url');
}

function groupReactionsByMessage(
  reactions: readonly typeof messageReactionsTable.$inferSelect[],
  actorUserId: string,
): Map<string, MessageReaction[]> {
  const grouped = new Map<string, Map<string, typeof messageReactionsTable.$inferSelect[]>>();

  for (const reaction of reactions) {
    const byMessage = grouped.get(reaction.messageId) ?? new Map<string, typeof messageReactionsTable.$inferSelect[]>();
    const byValue = byMessage.get(reaction.reaction) ?? [];
    byValue.push(reaction);
    byMessage.set(reaction.reaction, byValue);
    grouped.set(reaction.messageId, byMessage);
  }

  const result = new Map<string, MessageReaction[]>();

  for (const [messageId, byValue] of grouped) {
    result.set(
      messageId,
      [...byValue.entries()].map(([value, items]) => ({
        count: items.length,
        participantIds: items.map((item) => item.userId).slice(0, 16),
        reactedByViewer: items.some((item) => item.userId === actorUserId),
        value,
      })),
    );
  }

  return result;
}

function mapDraft(record: DraftRecord): ConversationDraft {
  return {
    body: record.body,
    replyToMessageId: record.replyToMessageId,
    updatedAt: record.updatedAt.toISOString(),
  };
}

function mapMessageReference(message: MessageRecord, author: UserProfileCard | null): MessageReference {
  return {
    author,
    bodyPreview: buildBodyPreview(message.body),
    createdAt: message.createdAt.toISOString(),
    id: message.id,
    kind: message.kind,
    sequence: message.sequence,
    status: message.status,
  };
}

function mapReadState(membership: MembershipRecord): ReadState {
  return {
    lastReadAt: membership.lastReadAt?.toISOString() ?? null,
    lastReadMessageId: membership.lastReadMessageId,
    lastReadSequence: membership.lastReadSequence,
  };
}

function mapSystemMetadata(metadata: Record<string, unknown>): Message['systemMetadata'] {
  const eventType = typeof metadata.eventType === 'string' ? metadata.eventType : null;

  if (
    eventType !== 'conversation_created' &&
    eventType !== 'member_added' &&
    eventType !== 'member_removed' &&
    eventType !== 'title_updated'
  ) {
    return null;
  }

  return {
    affectedUserIds: Array.isArray(metadata.affectedUserIds)
      ? metadata.affectedUserIds.filter((value): value is string => typeof value === 'string')
      : [],
    eventType,
    title: typeof metadata.title === 'string' ? metadata.title : null,
  };
}

function mapUserToProfileCard(user: UserRecord): UserProfileCard {
  return {
    avatarUrl: user.avatarUrl,
    displayName: user.displayName,
    id: user.id,
    statusText: user.statusText,
    username: user.username,
  };
}

function normalizeParticipantPair(firstUserId: string, secondUserId: string): [string, string] {
  return firstUserId < secondUserId
    ? [firstUserId, secondUserId]
    : [secondUserId, firstUserId];
}
