import { Component } from '@forge/component';

/**
 * Handles copying text to clipboard, from an event like a click.
 * Optionally, reveals a success message after copying.
 * @extends {Component}
 */
class CopyToClipboardComponent extends Component {
  copyToClipboard() {
    const copyContent = this.getAttribute('text-to-copy');

    if (!copyContent) return;

    navigator.clipboard.writeText(copyContent);

    const copySuccessMessage = this.refs.copySuccessMessage;

    if (copySuccessMessage instanceof Element) {
      copySuccessMessage.classList.remove('forge-visually-hidden');
    }
  }
}

if (!customElements.get('forge-copy-to-clipboard-component')) {
  customElements.define('forge-copy-to-clipboard-component', CopyToClipboardComponent);
}
