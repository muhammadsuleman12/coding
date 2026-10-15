import { Component } from '@forge/component';
import { debounce, fetchConfig } from '@forge/utilities';
import { cartPerformance } from '@forge/performance';

/**
 * A custom element that displays a cart note.
 */
class CartNote extends Component {
  /** @type {AbortController | null} */
  #activeFetch = null;

  /**
   * Handles updates to the cart note.
   * @param {InputEvent} event - The input event in our text-area.
   */
  updateCartNote = debounce(async (event) => {
    if (!(event.target instanceof HTMLTextAreaElement)) return;

    const note = event.target.value;
    if (this.#activeFetch) {
      this.#activeFetch.abort();
    }

    const abortController = new AbortController();
    this.#activeFetch = abortController;

    try {
      const config = fetchConfig('json', {
        body: JSON.stringify({ note }),
      });

      await fetch(Theme.routes.cart_update_url, {
        ...config,
        signal: abortController.signal,
      });
    } catch (error) {
    } finally {
      this.#activeFetch = null;
      cartPerformance.measureFromEvent('note-update:user-action', event);
    }
  }, 200);
}

if (!customElements.get('forge-cart-note')) {
  customElements.define('forge-cart-note', CartNote);
}
