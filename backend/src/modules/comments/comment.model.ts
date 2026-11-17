import { model, Schema, type InferSchemaType } from 'mongoose';

const commentSchema = new Schema(
  {
    taskId: { type: Schema.Types.ObjectId, ref: 'Task', required: true },
    // Denormalized from the task: lets a board delete remove its comments in one query.
    boardId: { type: Schema.Types.ObjectId, ref: 'Board', required: true },
    authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    body: { type: String, required: true, trim: true, maxlength: 2000 },
    requestId: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// A task's thread in order; `_id` is the pagination cursor (ObjectIds increase over time).
commentSchema.index({ taskId: 1, _id: -1 });
// Remove a deleted board's comments.
commentSchema.index({ boardId: 1 });
// Dedupes retried "post comment" requests from the same user.
commentSchema.index({ authorId: 1, requestId: 1 }, { unique: true });

export type Comment = InferSchemaType<typeof commentSchema>;

export const CommentModel = model('Comment', commentSchema);
