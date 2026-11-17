import { activityActionSchema } from '@mini-trello/shared';
import { model, Schema, type InferSchemaType } from 'mongoose';

const activitySchema = new Schema(
  {
    boardId: { type: Schema.Types.ObjectId, ref: 'Board', required: true },
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
    // Not a live reference: the task may since have been deleted.
    taskId: { type: Schema.Types.ObjectId, required: true },
    actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, enum: activityActionSchema.options, required: true },
    // Snapshot, so the entry still reads correctly after a rename or delete.
    taskTitle: { type: String, required: true },
    // Small, action-specific payload (see ActivityDetails in @mini-trello/shared).
    details: { type: Schema.Types.Mixed, default: {} },
  },
  // Append-only log: entries are never edited.
  { timestamps: { createdAt: true, updatedAt: false }, minimize: false },
);

// The board feed, newest first; `_id` is the pagination cursor (ObjectIds increase over time).
activitySchema.index({ boardId: 1, _id: -1 });
// "What did this person do?" and "show only moves": each stays a single index range scan,
// newest first, even combined with the cursor and a date range on _id.
activitySchema.index({ boardId: 1, actorId: 1, _id: -1 });
activitySchema.index({ boardId: 1, action: 1, _id: -1 });

export type Activity = InferSchemaType<typeof activitySchema>;

export const ActivityModel = model('Activity', activitySchema);
