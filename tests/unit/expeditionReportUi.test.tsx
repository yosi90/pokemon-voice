import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ExpeditionReportModal } from '../../src/components/ExpeditionReportModal.js';

const report = {
  mapId: 'map:tegueste:camphor-forest',
  newSecretIds: ['secret:pineco-tree'],
  newNpcIds: [],
  newConversationIds: ['conversation:camphor'],
  newCollectibleIds: [],
  newHintIds: [],
  newRouteIds: [],
  newResearchFactIds: ['research:rattata:behavior'],
  trainerExperienceGained: 20,
  discoveryPointsGained: 15,
  meaningfulInteractionCount: 2,
};

describe('informe de salida de expedición', () => {
  it('resume hallazgos y ganancias sin mostrar IDs internos', () => {
    render(<ExpeditionReportModal report={report} onClose={() => {}} />);
    expect(screen.getByRole('dialog', { name: 'De vuelta con Alcanfor' })).toHaveTextContent('3 hallazgos nuevos');
    expect(screen.getByText('+20')).toBeInTheDocument();
    expect(screen.queryByText('secret:pineco-tree')).not.toBeInTheDocument();
  });

  it('permite continuar y desaparece cuando no existe informe', () => {
    const onClose = vi.fn();
    const { rerender } = render(<ExpeditionReportModal report={report} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(onClose).toHaveBeenCalledOnce();
    rerender(<ExpeditionReportModal report={undefined} onClose={onClose} />);
    expect(screen.queryByTestId('expedition-report')).not.toBeInTheDocument();
  });
});
