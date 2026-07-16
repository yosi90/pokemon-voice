import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NarrativeScene } from '../../src/components/NarrativeScene.js';
import { PROFESSOR_INTRODUCTION_SEQUENCE } from '../../src/domain/narrative/professorIntroduction.js';

describe('escena de novela visual', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('acelera la frase con el primer clic y avanza con el siguiente', () => {
    const onAdvance = vi.fn();
    const page = PROFESSOR_INTRODUCTION_SEQUENCE.pages[0];
    render(<NarrativeScene open sequence={PROFESSOR_INTRODUCTION_SEQUENCE} page={page} onAdvance={onAdvance} onChoice={vi.fn()} onTextSubmit={vi.fn()} onDismiss={vi.fn()} />);
    const dialog = screen.getByRole('dialog', { name: 'Conversación con el profesor Alcanfor' });

    fireEvent.click(dialog.querySelector('.narrative-box') as Element);
    expect(screen.getByText(page.text)).toBeVisible();
    expect(onAdvance).not.toHaveBeenCalled();
    fireEvent.click(dialog.querySelector('.narrative-box') as Element);
    expect(onAdvance).toHaveBeenCalledOnce();
  });

  it('espera a completar el texto antes de mostrar elecciones', () => {
    const page = PROFESSOR_INTRODUCTION_SEQUENCE.pages.find(candidate => candidate.pageId === 'offer-one')!;
    render(<NarrativeScene open sequence={PROFESSOR_INTRODUCTION_SEQUENCE} page={page} onAdvance={vi.fn()} onChoice={vi.fn()} onTextSubmit={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.queryByRole('button', { name: '¡Sí, acepto!' })).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(page.text.length * 24));
    expect(screen.getByRole('button', { name: '¡Sí, acepto!' })).toBeVisible();
  });

  it('Escape aplaza y movimiento reducido elimina la espera', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })));
    const onDismiss = vi.fn();
    const page = PROFESSOR_INTRODUCTION_SEQUENCE.pages[0];
    render(<NarrativeScene open sequence={PROFESSOR_INTRODUCTION_SEQUENCE} page={page} onAdvance={vi.fn()} onChoice={vi.fn()} onTextSubmit={vi.fn()} onDismiss={onDismiss} />);
    act(() => vi.runOnlyPendingTimers());
    expect(screen.getByText(page.text)).toBeVisible();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('muestra ambos protagonistas y permite confirmar un nombre editable', () => {
    const selectionPage = PROFESSOR_INTRODUCTION_SEQUENCE.pages.find(candidate => candidate.pageId === 'trainer-choice')!;
    const onChoice = vi.fn();
    const { rerender } = render(<NarrativeScene open sequence={PROFESSOR_INTRODUCTION_SEQUENCE} page={selectionPage} onAdvance={vi.fn()} onChoice={onChoice} onTextSubmit={vi.fn()} onDismiss={vi.fn()} />);
    act(() => vi.advanceTimersByTime(selectionPage.text.length * 24));
    fireEvent.click(screen.getByRole('button', { name: 'Soy una chica' }));
    expect(onChoice).toHaveBeenCalledWith(expect.objectContaining({ previewAvatarId: 'guayota' }));

    const namePage = PROFESSOR_INTRODUCTION_SEQUENCE.pages.find(candidate => candidate.pageId === 'trainer-name')!;
    const onTextSubmit = vi.fn();
    rerender(<NarrativeScene open sequence={PROFESSOR_INTRODUCTION_SEQUENCE} page={namePage} trainerProfile={{ schemaVersion: 1, avatarId: 'guayota', displayName: 'Guayota' }} onAdvance={vi.fn()} onChoice={vi.fn()} onTextSubmit={onTextSubmit} onDismiss={vi.fn()} />);
    act(() => vi.advanceTimersByTime(namePage.text.length * 24));
    const input = screen.getByLabelText('Nombre del entrenador');
    fireEvent.change(input, { target: { value: 'Naira' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar nombre' }));
    expect(onTextSubmit).toHaveBeenCalledWith('Naira');
  });
});
