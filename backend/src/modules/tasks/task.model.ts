import { taskPrioritySchema } from '@mini-trello/shared';
import { model, Schema, type HydratedDocument, type InferSchemaType } from 'mongoose';

const taskSchema = new Schema(
  {
    boardId: { type: Schema.Types.ObjectId, ref: 'Board', required: true },
    // Denormalized from the board so authorization needs one lookup instead of two.
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
    columnId: { type: Schema.Types.ObjectId, required: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: '', maxlength: 5000 },
    priority: { type: String, enum: taskPrioritySchema.options, required: true, default: 'medium' },
    assigneeId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    dueDate: { type: Date, default: null },
    creatorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    // Sort key within the column; gaps let most moves update only the moved task.
    position: { type: Number, required: true },
    // Optimistic concurrency: every write must match the current version and increments it.
    version: { type: Number, required: true, default: 1 },
    requestId: { type: String, required: true },
  },
  { timestamps: true },
);

// Load a board's tasks in display order, and a column's tasks for ordering/emptiness checks.
taskSchema.index({ boardId: 1, columnId: 1, position: 1 });
// Unassign a removed member's tasks across a workspace.
taskSchema.index({ workspaceId: 1, assigneeId: 1 });
// Dedupes retried "create task" requests from the same user.
taskSchema.index({ creatorId: 1, requestId: 1 }, { unique: true });

export type Task = InferSchemaType<typeof taskSchema>;
export type TaskDocument = HydratedDocument<Task>;

export const TaskModel = model('Task', taskSchema);
