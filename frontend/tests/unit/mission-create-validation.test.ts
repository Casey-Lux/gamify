import { describe, expect, it } from 'vitest';
import { createMission, MissionApiError, type NewMissionInput } from '../../src/lib/api/missions';

function baseInput(overrides: Partial<NewMissionInput> = {}): NewMissionInput {
  return {
    workspaceId: 'workspace-1',
    createdBy: 'user-1',
    assignedTo: 'user-1',
    skillId: 'skill-1',
    areaId: null,
    title: 'Leer 20 páginas',
    description: '',
    difficulty: 'EASY',
    xpReward: 10,
    coinReward: 5,
    dueAt: '',
    subtaskTitles: [],
    ...overrides
  };
}

describe('createMission validation', () => {
  it('rejects an empty title without ever calling the network', async () => {
    await expect(createMission(baseInput({ title: '   ' }))).rejects.toThrow(MissionApiError);
  });

  it('rejects a title over 120 characters', async () => {
    await expect(createMission(baseInput({ title: 'a'.repeat(121) }))).rejects.toThrow(
      MissionApiError
    );
  });

  it('rejects a description over 2000 characters', async () => {
    await expect(createMission(baseInput({ description: 'a'.repeat(2001) }))).rejects.toThrow(
      MissionApiError
    );
  });

  it('requires a skill (spec: "una misión no puede existir sin skill")', async () => {
    await expect(createMission(baseInput({ skillId: '' }))).rejects.toThrow(MissionApiError);
  });

  it('rejects a negative XP reward', async () => {
    await expect(createMission(baseInput({ xpReward: -1 }))).rejects.toThrow(MissionApiError);
  });

  it('rejects a non-integer XP reward', async () => {
    await expect(createMission(baseInput({ xpReward: 10.5 }))).rejects.toThrow(MissionApiError);
  });

  it('rejects a negative coin reward', async () => {
    await expect(createMission(baseInput({ coinReward: -1 }))).rejects.toThrow(MissionApiError);
  });
});
