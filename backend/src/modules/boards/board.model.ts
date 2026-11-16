import { model, Schema, type HydratedDocument, type InferSchemaType } from 'mongoose';

// Columns are embedded: a board has few of them, they are always read with the board,
// and their array order is the display order.
const columnSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 40 },
  // Dedupes retried "create column" requests.
  requestId: { type: String },
});

const boardSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    columns: { type: [columnSchema], default: [] },
    requestId: { type: String, required: true },
  },
  { timestamps: true },
);

// "List boards of workspace X", newest first.
boardSchema.index({ workspaceId: 1, createdAt: -1 });
// Dedupes retried "create board" requests from the same user.
boardSchema.index({ createdBy: 1, requestId: 1 }, { unique: true });

export type Board = InferSchemaType<typeof boardSchema>;
export type BoardDocument = HydratedDocument<Board>;

export const BoardModel = model('Board', boardSchema);
