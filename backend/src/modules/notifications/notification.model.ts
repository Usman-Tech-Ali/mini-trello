import { notificationTypeSchema } from '@mini-trello/shared';
import { model, Schema, type InferSchemaType } from 'mongoose';

const notificationSchema = new Schema(
  {
    // The recipient.
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: notificationTypeSchema.options, required: true },
    actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    // Snapshots, so a notification still reads correctly after renames, deletes or departures.
    actorName: { type: String, required: true },
    taskTitle: { type: String, required: true },
    excerpt: { type: String, default: null },
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
    boardId: { type: Schema.Types.ObjectId, ref: 'Board', required: true },
    taskId: { type: Schema.Types.ObjectId, required: true },
    // null = unread. A date (rather than a flag) records when it was read.
    readAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// A user's inbox, newest first; `_id` is the pagination cursor.
notificationSchema.index({ userId: 1, _id: -1 });
// The unread badge: count a user's unread notifications without scanning read ones.
notificationSchema.index({ userId: 1, readAt: 1 });
// Remove a deleted board's notifications.
notificationSchema.index({ boardId: 1 });

export type Notification = InferSchemaType<typeof notificationSchema>;

export const NotificationModel = model('Notification', notificationSchema);
