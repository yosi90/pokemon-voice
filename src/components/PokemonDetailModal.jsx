import { useEffect, useMemo, useRef, useState } from 'react';
import { ART_URL } from '../../scripts/utils.js';
import { getPokemonTypeTheme } from '../domain/catalog/pokemonTypeTheme.ts';
import { getClassifiedNarrative, getUnresearchedFieldNarrative } from '../domain/catalog/pokemonDetailNarrative.ts';
import { buildPokemonVariantGallery, formatVariantNote, formatVariantOrigin } from '../domain/catalog/pokemonVariantGallery.ts';
import { formatDex } from '../lib/pokemon.js';
import { fetchPokemonDetails } from '../services/pokemonDetails.ts';

const TYPE_LABELS = {
  normal: 'Normal', fire: 'Fuego', water: 'Agua', electric: 'Eléctrico', grass: 'Planta', ice: 'Hielo',
  fighting: 'Lucha', poison: 'Veneno', ground: 'Tierra', flying: 'Volador', psychic: 'Psíquico', bug: 'Bicho',
  rock: 'Roca', ghost: 'Fantasma', dragon: 'Dragón', dark: 'Siniestro', steel: 'Acero', fairy: 'Hada',
};

const RESEARCH_FIELDS = [
  { key: 'biometrics', label: 'Biometría' },
  { key: 'behavior', label: 'Conducta' },
  { key: 'habitat', label: 'Alimentación / hábitat' },
  { key: 'exceptional', label: 'Nota excepcional' },
];

const RESEARCH_STATUS_LABELS = {
  notSeen: 'No avistado',
  sighted: 'Avistado',
  partial: 'Investigación parcial',
  complete: 'Investigación completa',
};

function getResearchFieldCopy(pokemonId, discovered, entryState, fieldKey) {
  if (!discovered || !entryState?.researchVisible) return 'ACCESO DENEGADO';
  const progress = entryState.research?.fields?.[fieldKey];
  const factCount = progress?.discoveredFactIds?.length || 0;
  if (progress?.completed) return `CAMPO COMPLETO // ${factCount} hallazgo${factCount === 1 ? '' : 's'} verificado${factCount === 1 ? '' : 's'}`;
  if (factCount > 0) return `INVESTIGACIÓN PARCIAL // ${factCount} observación${factCount === 1 ? '' : 'es'}`;
  if (entryState.sighted) return 'AVISTAMIENTO REGISTRADO // faltan observaciones';
  return getUnresearchedFieldNarrative(pokemonId, fieldKey);
}

export function PokemonDetailModal({ pokemon, discovered, entryState, onClose, onCry }) {
  const [details, setDetails] = useState(null);
  const [detailsUnavailable, setDetailsUnavailable] = useState(false);
  const panelRef = useRef(null);
  const closeRef = useRef(null);

  useEffect(() => {
    if (!pokemon || !discovered) {
      setDetails(null);
      setDetailsUnavailable(false);
      return undefined;
    }
    let active = true;
    setDetails(null);
    setDetailsUnavailable(false);
    fetchPokemonDetails(pokemon.id)
      .then(value => {
        if (active) setDetails(value);
      })
      .catch(() => {
        if (active) setDetailsUnavailable(true);
      });
    return () => { active = false; };
  }, [discovered, pokemon]);

  useEffect(() => {
    if (!pokemon) return undefined;
    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

    const handleKeyDown = event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = [...panelRef.current.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])')];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [onClose, pokemon]);

  const types = discovered ? details?.types || [] : [];
  const theme = useMemo(() => getPokemonTypeTheme(types), [types]);
  const displayName = discovered ? pokemon?.name.replace(/-/g, ' ') : 'DATOS CLASIFICADOS';
  const variants = useMemo(() => (
    pokemon && discovered
      ? buildPokemonVariantGallery({
        speciesId: pokemon.id,
        forms: entryState?.discoveredForms || [],
        appearances: entryState?.discoveredAppearances || [],
      })
      : []
  ), [discovered, entryState?.discoveredAppearances, entryState?.discoveredForms, pokemon]);
  if (!pokemon) return null;

  return (
    <div className="pv-modal pokemon-detail-modal" data-testid="pokemon-detail-modal">
      <div className="pv-modal__backdrop" onClick={onClose} />
      <section
        className="pokemon-detail-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pokemon-detail-title"
        data-primary-type={theme.primaryType}
        data-secondary-type={theme.secondaryType || ''}
        data-motif={theme.motif}
        style={{ '--type-primary': theme.primary, '--type-secondary': theme.secondary, '--type-glow': theme.glow }}
        ref={panelRef}
      >
        <span className="pokemon-detail-panel__hinge" aria-hidden="true" />
        <span className="pokemon-detail-panel__motif" aria-hidden="true" />
        <header className="pokemon-detail-header">
          <div>
            <span className="pokemon-detail-header__eyebrow">Entrada {formatDex(pokemon.id)}</span>
            <h2 id="pokemon-detail-title">{displayName}</h2>
          </div>
          <button className="icon-btn" type="button" aria-label="Cerrar ficha" onClick={onClose} ref={closeRef}>×</button>
        </header>

        <div className="pokemon-detail-body">
          <section className="pokemon-detail-display" aria-label="Identificación">
            <div className={`pokemon-detail-portrait ${discovered ? '' : 'is-classified'}`}>
              {discovered ? <img src={ART_URL(pokemon.id)} alt={displayName} /> : <span aria-hidden="true">?</span>}
            </div>
            {discovered ? (
              <>
                <div className="pokemon-type-list" aria-label="Tipos">
                  {types.map((type, index) => (
                    <span key={type} className={`pokemon-type pokemon-type--${index === 0 ? 'primary' : 'secondary'}`}>
                      {TYPE_LABELS[type] || type}
                    </span>
                  ))}
                  {!types.length && <span className="pokemon-type pokemon-type--unknown">{detailsUnavailable ? 'Tipo no disponible' : 'Analizando tipo…'}</span>}
                </div>
                <button className="pokemon-cry-button" type="button" onClick={() => onCry(pokemon.id)}>
                  <span aria-hidden="true">◉</span> Reproducir cry
                </button>
              </>
            ) : (
              <p className="pokemon-detail-classified">{getClassifiedNarrative(pokemon.id)}</p>
            )}
          </section>

          <section className="pokemon-research" aria-labelledby="pokemon-research-title">
            <div className="pokemon-research__heading">
              <span>Investigación</span>
              <strong id="pokemon-research-title">
                {discovered ? RESEARCH_STATUS_LABELS[entryState?.researchStatus || 'notSeen'] : 'Bloqueada'}
              </strong>
            </div>
            <div className="pokemon-research__grid">
              {RESEARCH_FIELDS.map(field => (
                <article key={field.key} className={`pokemon-research-field ${entryState?.research?.fields?.[field.key]?.completed ? 'is-complete' : ''}`}>
                  <h3>{field.label}</h3>
                  <p>{getResearchFieldCopy(pokemon.id, discovered, entryState, field.key)}</p>
                </article>
              ))}
            </div>
            {discovered && (
              <section className="pokemon-variants" aria-labelledby="pokemon-variants-title">
                <div className="pokemon-variants__heading">
                  <h3 id="pokemon-variants-title">Formas y apariencias</h3>
                  <span>{variants.length} descubierta{variants.length === 1 ? '' : 's'}</span>
                </div>
                <div className="pokemon-variants__list" role="list">
                  {variants.map(variant => (
                    <article className="pokemon-variant-card" key={variant.id} role="listitem">
                      <div className="pokemon-variant-card__portrait">
                        {variant.isDefault
                          ? <img src={ART_URL(pokemon.id)} alt="" />
                          : <span className="pokemon-variant-card__placeholder" aria-hidden="true">{variant.kind === 'form' ? '◇' : '★'}</span>}
                        <span className="pokemon-variant-card__badge" aria-hidden="true">{variant.kind === 'form' ? '◇' : '★'}</span>
                      </div>
                      <div className="pokemon-variant-card__copy">
                        <strong>{variant.label}</strong>
                        <small>{variant.kind === 'form' ? 'Forma' : 'Apariencia'}</small>
                        <p>{formatVariantOrigin(variant)}</p>
                        {variant.noteIds.map(noteId => (
                          <p className="pokemon-variant-card__note" key={noteId}>Nota · {formatVariantNote(noteId)}</p>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}
            {pokemon.id === 151 && discovered && !entryState?.sighted && (
              <p className="pokemon-detail-lore">Registrar un nombre no equivale a un avistamiento. Su rastro continúa siendo una leyenda.</p>
            )}
          </section>
        </div>
      </section>
    </div>
  );
}
