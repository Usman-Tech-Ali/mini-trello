import { model, Schema, type HydratedDocument, type InferSchemaType } from 'mongoose';

const workspaceSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    // Denormalized count used by the last-admin guard: decrementing it conditionally inside a
    // transaction makes concurrent demotions conflict instead of both succeeding.
    adminCount: { type: Number, required: true, min: 0 },
    requestId: { type: String, required: true },
  },
  { timestamps: true },
);

// Dedupes retried "create workspace" requests from the same user.
workspaceSchema.index({ ownerId: 1, requestId: 1 }, { unique: true });

export type Workspace = InferSchemaType<typeof workspaceSchema>;
export type WorkspaceDocument = HydratedDocument<Workspace>;

export const WorkspaceModel = model('Workspace', workspaceSchema);
