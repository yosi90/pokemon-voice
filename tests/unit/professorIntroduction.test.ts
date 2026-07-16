import { describe, expect, it } from 'vitest';
import {
  PROFESSOR_FIRST_AUTOMATIC_DISCOVERY,
  PROFESSOR_INTRO_SEQUENCE_ID,
  PROFESSOR_RETURN_SEQUENCE_ID,
  createProfessorIntroductionStateV1,
  getProfessorIntroductionTrigger,
  normalizeNarrativeProgress,
  normalizeProfessorIntroduction,
  normalizeTrainerProfile,
} from '../../src/domain/narrative/professorIntroduction.js';

describe('introducción del profesor Alcanfor', () => {
  it('se activa desde la primera ficha registrada pero no antes de tener descubrimientos', () => {
    const introduction = createProfessorIntroductionStateV1();
    expect(getProfessorIntroductionTrigger({ introduction, discoveryCount: 0, source: 'discoveredDetail' })).toBeNull();
    expect(getProfessorIntroductionTrigger({ introduction, discoveryCount: 1, source: 'discoveredDetail' }))
      .toBe(PROFESSOR_INTRO_SEQUENCE_ID);
  });

  it('espera al quinto descubrimiento si nunca se abrió una ficha', () => {
    const introduction = createProfessorIntroductionStateV1();
    expect(getProfessorIntroductionTrigger({
      introduction,
      discoveryCount: PROFESSOR_FIRST_AUTOMATIC_DISCOVERY - 1,
      source: 'newDiscovery',
    })).toBeNull();
    expect(getProfessorIntroductionTrigger({
      introduction,
      discoveryCount: PROFESSOR_FIRST_AUTOMATIC_DISCOVERY,
      source: 'newDiscovery',
    })).toBe(PROFESSOR_INTRO_SEQUENCE_ID);
  });

  it('una invitación aplazada solo vuelve tras el siguiente descubrimiento nuevo', () => {
    const introduction = {
      ...createProfessorIntroductionStateV1(),
      status: 'postponed' as const,
      nextEligibleDiscoveryCount: 7,
    };
    expect(getProfessorIntroductionTrigger({ introduction, discoveryCount: 99, source: 'discoveredDetail' })).toBeNull();
    expect(getProfessorIntroductionTrigger({ introduction, discoveryCount: 6, source: 'newDiscovery' })).toBeNull();
    expect(getProfessorIntroductionTrigger({ introduction, discoveryCount: 7, source: 'newDiscovery' }))
      .toBe(PROFESSOR_RETURN_SEQUENCE_ID);
  });

  it('una aceptación permanente desactiva todas las invitaciones', () => {
    const introduction = {
      ...createProfessorIntroductionStateV1(),
      status: 'accepted' as const,
      acceptedAt: '2026-07-16T12:00:00.000Z',
    };
    expect(getProfessorIntroductionTrigger({ introduction, discoveryCount: 100, source: 'newDiscovery' })).toBeNull();
    expect(getProfessorIntroductionTrigger({ introduction, discoveryCount: 100, source: 'discoveredDetail' })).toBeNull();
  });

  it('normaliza contratos antiguos o corruptos sin inventar una aceptación', () => {
    expect(normalizeProfessorIntroduction(undefined)).toEqual(createProfessorIntroductionStateV1());
    expect(normalizeProfessorIntroduction({ status: 'accepted', acceptedAt: 'invalid' }).status).toBe('hidden');
    expect(normalizeNarrativeProgress({
      pendingSequenceIds: ['one', 'one', 2],
      completedSequenceIds: ['done'],
      activeSequence: { sequenceId: 'one', pageId: 'page', startedAt: 'invalid' },
    })).toEqual({
      schemaVersion: 1,
      pendingSequenceIds: ['one'],
      completedSequenceIds: ['done'],
    });
  });

  it('normaliza el protagonista y conserva nombres editados válidos', () => {
    expect(normalizeTrainerProfile(undefined)).toBeUndefined();
    expect(normalizeTrainerProfile({ avatarId: 'missingno', displayName: 'Glitch' })).toBeUndefined();
    expect(normalizeTrainerProfile({ avatarId: 'guayota', displayName: '  Naira   del Mar  ' })).toEqual({
      schemaVersion: 1,
      avatarId: 'guayota',
      displayName: 'Naira del Mar',
    });
    expect(normalizeTrainerProfile({ avatarId: 'achaman', displayName: '   ' })?.displayName).toBe('Achaman');
  });
});
