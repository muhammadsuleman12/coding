import { ThemeEvents, VariantUpdateEvent } from '@forge/events';
import { morph } from '@forge/morph';

class ProductInventory extends HTMLElement {
  connectedCallback() {
    const closestSection = this.closest('.shopify-section, dialog');
    closestSection?.addEventListener(ThemeEvents.variantUpdate, this.updateInventory);
  }

  disconnectedCallback() {
    const closestSection = this.closest('.shopify-section, dialog');
    closestSection?.removeEventListener(ThemeEvents.variantUpdate, this.updateInventory);
  }

  /**
   * Updates the inventory.
   * @param {VariantUpdateEvent} event - The variant update event.
   */
  updateInventory = (event) => {
    if (event.detail.data.newProduct) {
      this.dataset.productId = event.detail.data.newProduct.id;
    } else if (event.target instanceof HTMLElement && event.target.dataset.productId !== this.dataset.productId) {
      return;
    }

    const newInventory = event.detail.data.html.querySelector('forge-product-inventory');

    if (!newInventory) return;

    morph(this, newInventory, { childrenOnly: true });
  };
}

if (!customElements.get('forge-product-inventory')) {
  customElements.define('forge-product-inventory', ProductInventory);
}
