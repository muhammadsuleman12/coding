import { DialogComponent } from '@forge/dialog';
import { CartAddEvent } from '@forge/events';

/**
 * A custom element that manages a cart drawer.
 *
 * @extends {DialogComponent}
 */
class CartDrawerComponent extends DialogComponent {
  connectedCallback() {
    super.connectedCallback();
    document.addEventListener(CartAddEvent.eventName, this.#handleCartAdd);
    // Pushed pages only: on the full theme the header already owns the cart.
    if (this.hasAttribute('claim-host-triggers')) {
      window.addEventListener('click', this.#claimHostThemeCartTriggers, { capture: true });
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener(CartAddEvent.eventName, this.#handleCartAdd);
    window.removeEventListener('click', this.#claimHostThemeCartTriggers, { capture: true });
  }

  #handleCartAdd = () => {
    if (this.hasAttribute('auto-open')) {
      this.showDialog();
    }
  };

  // Capture phase so this wins over the host theme's own cart-drawer handler.
  #claimHostThemeCartTriggers = (event) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    const target = /** @type {Element | null} */ (event.target);
    if (!target?.closest || target.closest('forge-cart-drawer-component')) return;
    const trigger = target.closest(
      '[aria-controls="cart-drawer"], a[href$="/cart"], a[href$="/cart/"], a[href*="/cart?"], cart-drawer-button, [data-cart-drawer-toggle]',
    );
    if (!trigger) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    this.open();
  };

  open() {
    this.showDialog();

    /**
     * Close cart drawer when installments CTA is clicked to avoid overlapping dialogs
     */
    customElements.whenDefined('shopify-payment-terms').then(() => {
      const installmentsContent = document.querySelector('shopify-payment-terms')?.shadowRoot;
      const cta = installmentsContent?.querySelector('#shopify-installments-cta');
      cta?.addEventListener('click', this.closeDialog, { once: true });
    });
  }

  close() {
    this.closeDialog();
  }
}

if (!customElements.get('forge-cart-drawer-component')) {
  customElements.define('forge-cart-drawer-component', CartDrawerComponent);
}
