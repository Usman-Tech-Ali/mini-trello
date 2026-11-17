import { taskPrioritySchema, taskRevisionActionSchema } from '@mini-trello/shared';
import { model, Schema, type InferSchemaType } from 'mongoose';

const changeSchema = new Schema(
  {
    field: { type: String, required: true },
    from: { type: String, default: null },
    to: { type: String, default: null },
  },
  { _id: false },
);

const snapshotSchema = new Schema(
  {
    title: { type: String, required: true },
    description: { type: String, default: '' },
    priority: { type: String, enum: taskPrioritySchema.options, required: true },
    assigneeId: { type: Schema.Types.ObjectId, default: null },
    dueDate: { type: String, default: null },
    columnId: { type: Schema.Types.ObjectId, required: true },
    columnName: { type: String, required: true },
  },
  { _id: false },
);

/**
 * One row per task version: who produced it, what changed (old → new) and a full snapshot, so
 * any earlier version can be shown or restored without replaying the chain.
 */
const taskRevisionSchema = new Schema(
  {
    taskId: { type: Schema.Types.ObjectId, required: true },
    boardId: { type: Schema.Types.ObjectId, ref: 'Board', required: true },
    version: { type: Number, required: true },
    actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, enum: taskRevisionActionSchema.options, required: true },
    restoredFrom: { type: Number, default: null },
    changes: { type: [changeSchema], default: [] },
    snapshot: { type: snapshotSchema, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// A task's history newest first, and "give me version N"; unique because a version is produced
// exactly once (the optimistic-concurrency check guarantees it).
taskRevisionSchema.index({ taskId: 1, version: -1 }, { unique: true });
// Remove a deleted board's history.
taskRevisionSchema.index({ boardId: 1 });

export type TaskRevision = InferSchemaType<typeof taskRevisionSchema>;

export const TaskRevisionModel = model('TaskRevision', taskRevisionSchema);
