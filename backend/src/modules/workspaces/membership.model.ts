import { workspaceRoleSchema } from '@mini-trello/shared';
import { model, Schema, type HydratedDocument, type InferSchemaType } from 'mongoose';

const membershipSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: workspaceRoleSchema.options, required: true },
  },
  { timestamps: true },
);

// One membership per user per workspace; also serves "is user X a member of workspace Y"
// (every authorization check) and "list members of workspace Y".
membershipSchema.index({ workspaceId: 1, userId: 1 }, { unique: true });
// "List the workspaces of user X".
membershipSchema.index({ userId: 1 });

export type Membership = InferSchemaType<typeof membershipSchema>;
export type MembershipDocument = HydratedDocument<Membership>;

export const MembershipModel = model('Membership', membershipSchema);
