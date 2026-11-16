import { randomUUID } from 'node:crypto';

import type {
  ApiErrorResponse,
  MemberListResponse,
  MemberResponse,
  WorkspaceDto,
  WorkspaceListResponse,
  WorkspaceResponse,
} from '@mini-trello/shared';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../../app';
import { registerUser, type TestUser } from '../../test/http';
import { startTestDatabase } from '../../test/mongo-memory';
import { MembershipModel } from './membership.model';
import { WorkspaceModel } from './workspace.model';

const app = createApp();
let stopDatabase: (() => Promise<void>) | undefined;

beforeAll(async () => {
  stopDatabase = await startTestDatabase();
});

afterAll(async () => {
  await stopDatabase?.();
});

async function createWorkspace(owner: TestUser, name = 'Team Space'): Promise<WorkspaceDto> {
  const res = await owner.client
    .post('/api/workspaces')
    .send({ name, requestId: randomUUID() })
    .expect(201);
  return (res.body as WorkspaceResponse).workspace;
}

async function addMember(admin: TestUser, workspaceId: string, member: TestUser): Promise<void> {
  await admin.client
    .post(`/api/workspaces/${workspaceId}/members`)
    .send({ email: member.user.email })
    .expect(201);
}

function errorCode(res: request.Response): string {
  return (res.body as ApiErrorResponse).error.code;
}

describe('creating and listing workspaces', () => {
  it('makes the creator an admin', async () => {
    const owner = await registerUser(app, 'Owner');
    const workspace = await createWorkspace(owner, '  Product Team  ');
    expect(workspace).toMatchObject({ name: 'Product Team', role: 'admin' });
  });

  it('returns the original workspace when a create request is retried', async () => {
    const owner = await registerUser(app, 'Retry');
    const body = { name: 'Retry Space', requestId: randomUUID() };

    const first = await owner.client.post('/api/workspaces').send(body).expect(201);
    const retry = await owner.client.post('/api/workspaces').send(body).expect(200);

    expect((retry.body as WorkspaceResponse).workspace.id).toBe(
      (first.body as WorkspaceResponse).workspace.id,
    );
    expect(await WorkspaceModel.countDocuments({ requestId: body.requestId })).toBe(1);
  });

  it('lists only the workspaces the user belongs to', async () => {
    const alice = await registerUser(app, 'Alice');
    const bob = await registerUser(app, 'Bob');
    const aliceSpace = await createWorkspace(alice, 'Alice Space');
    await createWorkspace(bob, 'Bob Space');

    const res = await alice.client.get('/api/workspaces').expect(200);
    const { workspaces } = res.body as WorkspaceListResponse;
    expect(workspaces.map((w) => w.id)).toEqual([aliceSpace.id]);
  });

  it('requires authentication', async () => {
    await request(app).get('/api/workspaces').expect(401);
  });

  it('validates input', async () => {
    const user = await registerUser(app, 'Validator');
    const res = await user.client
      .post('/api/workspaces')
      .send({ name: '', requestId: 'not-a-uuid' })
      .expect(400);
    expect(Object.keys((res.body as ApiErrorResponse).error.details ?? {}).sort()).toEqual([
      'name',
      'requestId',
    ]);
  });
});

describe('workspace isolation', () => {
  let admin: TestUser;
  let outsider: TestUser;
  let workspace: WorkspaceDto;

  beforeAll(async () => {
    admin = await registerUser(app, 'Admin');
    outsider = await registerUser(app, 'Outsider');
    workspace = await createWorkspace(admin);
  });

  it('hides the workspace from non-members on every endpoint (404, not 403)', async () => {
    const base = `/api/workspaces/${workspace.id}`;
    const attempts = [
      outsider.client.get(base),
      outsider.client.get(`${base}/members`),
      outsider.client.post(`${base}/members`).send({ email: outsider.user.email }),
      outsider.client.patch(`${base}/members/${admin.user.id}`).send({ role: 'member' }),
      outsider.client.delete(`${base}/members/${admin.user.id}`),
    ];
    for (const res of await Promise.all(attempts)) {
      expect(res.status).toBe(404);
      expect(errorCode(res)).toBe('NOT_FOUND');
    }
  });

  it('treats malformed and unknown ids as not found', async () => {
    await admin.client.get('/api/workspaces/not-an-id').expect(404);
    await admin.client.get('/api/workspaces/507f1f77bcf86cd799439011').expect(404);
  });
});

describe('membership management', () => {
  let admin: TestUser;
  let member: TestUser;
  let workspace: WorkspaceDto;
  let base: string;

  beforeEach(async () => {
    admin = await registerUser(app, 'Admin');
    member = await registerUser(app, 'Member');
    workspace = await createWorkspace(admin);
    base = `/api/workspaces/${workspace.id}`;
    await addMember(admin, workspace.id, member);
  });

  it('lets members see the workspace and its members', async () => {
    const detail = await member.client.get(base).expect(200);
    expect((detail.body as WorkspaceResponse).workspace.role).toBe('member');

    const res = await member.client.get(`${base}/members`).expect(200);
    const { members } = res.body as MemberListResponse;
    expect(members.map((m) => [m.email, m.role])).toEqual([
      [admin.user.email, 'admin'],
      [member.user.email, 'member'],
    ]);
  });

  it('only lets admins manage other members (403 for members)', async () => {
    const third = await registerUser(app, 'Third');
    const attempts = [
      member.client.post(`${base}/members`).send({ email: third.user.email }),
      member.client.patch(`${base}/members/${admin.user.id}`).send({ role: 'member' }),
      member.client.delete(`${base}/members/${admin.user.id}`),
    ];
    for (const res of await Promise.all(attempts)) {
      expect(res.status).toBe(403);
      expect(errorCode(res)).toBe('FORBIDDEN');
    }
  });

  it('reports unknown and duplicate invitees', async () => {
    const unknown = await admin.client
      .post(`${base}/members`)
      .send({ email: 'nobody-here@example.com' })
      .expect(404);
    expect(errorCode(unknown)).toBe('USER_NOT_FOUND');

    const duplicate = await admin.client
      .post(`${base}/members`)
      .send({ email: member.user.email.toUpperCase() })
      .expect(409);
    expect(errorCode(duplicate)).toBe('ALREADY_MEMBER');
  });

  it('promotes and demotes members, keeping the admin count in sync', async () => {
    const promoted = await admin.client
      .patch(`${base}/members/${member.user.id}`)
      .send({ role: 'admin' })
      .expect(200);
    expect((promoted.body as MemberResponse).member.role).toBe('admin');
    expect((await WorkspaceModel.findById(workspace.id))?.adminCount).toBe(2);

    await admin.client.patch(`${base}/members/${member.user.id}`).send({ role: 'member' }).expect(200);
    expect((await WorkspaceModel.findById(workspace.id))?.adminCount).toBe(1);
  });

  it('never lets the last admin be demoted or removed', async () => {
    const demote = await admin.client
      .patch(`${base}/members/${admin.user.id}`)
      .send({ role: 'member' })
      .expect(409);
    expect(errorCode(demote)).toBe('LAST_ADMIN');

    const leave = await admin.client.delete(`${base}/members/${admin.user.id}`).expect(409);
    expect(errorCode(leave)).toBe('LAST_ADMIN');
  });

  it('keeps exactly one admin when two admins demote each other at the same time', async () => {
    await admin.client.patch(`${base}/members/${member.user.id}`).send({ role: 'admin' }).expect(200);

    const results = await Promise.all([
      admin.client.patch(`${base}/members/${member.user.id}`).send({ role: 'member' }),
      member.client.patch(`${base}/members/${admin.user.id}`).send({ role: 'member' }),
    ]);

    const statuses = results.map((r) => r.status).sort();
    expect(statuses[0]).toBe(200);
    expect([403, 409]).toContain(statuses[1]);
    expect(await MembershipModel.countDocuments({ workspaceId: workspace.id, role: 'admin' })).toBe(1);
    expect((await WorkspaceModel.findById(workspace.id))?.adminCount).toBe(1);
  });

  it('lets a member leave, after which they lose access', async () => {
    await member.client.delete(`${base}/members/${member.user.id}`).expect(204);
    await member.client.get(base).expect(404);
  });

  it('lets an admin remove a member', async () => {
    await admin.client.delete(`${base}/members/${member.user.id}`).expect(204);
    await member.client.get(base).expect(404);
  });

  it('rejects invalid roles and unknown members', async () => {
    await admin.client.patch(`${base}/members/${member.user.id}`).send({ role: 'owner' }).expect(400);
    await admin.client
      .patch(`${base}/members/507f1f77bcf86cd799439011`)
      .send({ role: 'admin' })
      .expect(404);
  });
});
