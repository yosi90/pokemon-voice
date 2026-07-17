import { useState } from 'react';
import type { PokeVoiceSaveV1 } from '../../packages/contracts/src/index.js';
import {
  POKE_DISCOVER_SHOP_OFFERS,
  getPokeDiscoverShopContent,
} from '../data/adventure/pokeDiscoverShop.js';
import {
  getBrowserPokeVoiceSave,
  purchaseBrowserShopOffer,
  selectBrowserFieldTool,
} from '../store/browserPokeVoiceSaveStore.js';

const CATEGORY_LABELS = Object.freeze({
  tool: 'Herramienta',
  keyItem: 'Objeto clave',
  permission: 'Permiso',
  cosmetic: 'Cosmético',
});

const CATEGORY_ICONS = Object.freeze({ tool: '🧰', keyItem: '🔑', permission: '📜', cosmetic: '✨' });

function ownsContent(save: PokeVoiceSaveV1, category: keyof typeof CATEGORY_LABELS, contentId: string) {
  const inventory = save.pokeDiscover.inventory;
  if (category === 'tool') return inventory.toolIds.includes(contentId);
  if (category === 'keyItem') return inventory.keyItemIds.includes(contentId);
  if (category === 'permission') return inventory.permissionIds.includes(contentId);
  return inventory.cosmeticIds.includes(contentId);
}

export function PokeDiscoverShop({
  save,
  onSaveChange,
}: {
  save: PokeVoiceSaveV1;
  onSaveChange: (save: PokeVoiceSaveV1) => void;
}) {
  const [feedback, setFeedback] = useState('');
  const offers = POKE_DISCOVER_SHOP_OFFERS.map(offer => ({
    offer,
    content: getPokeDiscoverShopContent(offer.contentId),
  })).filter(entry => entry.content);

  const refresh = () => {
    const next = getBrowserPokeVoiceSave();
    onSaveChange(next);
    return next;
  };

  const purchase = (offer: (typeof POKE_DISCOVER_SHOP_OFFERS)[number]) => {
    const result = purchaseBrowserShopOffer(offer);
    refresh();
    if (result.status === 'purchased') setFeedback('Compra guardada permanentemente en PokeDiscover.');
    else if (result.status === 'alreadyOwned') setFeedback('Ya posees este artículo.');
    else setFeedback(`Te faltan ${result.missing} PD.`);
  };

  const equip = (toolId: string) => {
    selectBrowserFieldTool(toolId);
    refresh();
    setFeedback('Herramienta preparada para la próxima expedición.');
  };

  return (
    <div className="pokediscover-shop">
      <header className="pokediscover-shop__header">
        <div>
          <span>Suministros opcionales</span>
          <h4>Tienda de campo</h4>
          <p>Todo es permanente y abre rutas opcionales. Ninguna compra es necesaria para continuar la historia.</p>
        </div>
        <div className="pokediscover-shop__balance" aria-label={`${save.pokeDiscover.discoveryPoints} Puntos de Descubrimiento`}>
          <small>Saldo</small><strong>{save.pokeDiscover.discoveryPoints}</strong><span>PD</span>
        </div>
      </header>

      {feedback ? <p className="pokediscover-shop__feedback" role="status">{feedback}</p> : null}

      <div className="pokediscover-shop__grid">
        {offers.map(({ offer, content }) => {
          if (!content) return null;
          const owned = ownsContent(save, offer.category, offer.contentId);
          const equipped = offer.category === 'tool'
            && save.pokeDiscover.inventory.selectedToolId === offer.contentId;
          const missing = Math.max(0, offer.discoveryPointCost - save.pokeDiscover.discoveryPoints);
          return (
            <article className={`pokediscover-shop-card${owned ? ' is-owned' : ''}`} key={offer.offerId}>
              <div className="pokediscover-shop-card__icon" aria-hidden="true">{CATEGORY_ICONS[offer.category]}</div>
              <div className="pokediscover-shop-card__copy">
                <span>{CATEGORY_LABELS[offer.category]}</span>
                <h5>{content.displayName}</h5>
                <p>{content.description}</p>
                <small>{content.unlockHint}</small>
              </div>
              <div className="pokediscover-shop-card__action">
                {owned ? (
                  offer.category === 'tool' ? (
                    <button type="button" disabled={equipped} onClick={() => equip(offer.contentId)}>
                      {equipped ? 'Equipada' : 'Equipar'}
                    </button>
                  ) : <strong>Obtenido</strong>
                ) : (
                  <button type="button" disabled={missing > 0} onClick={() => purchase(offer)}>
                    {missing > 0 ? `Faltan ${missing} PD` : `${offer.discoveryPointCost} PD`}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
