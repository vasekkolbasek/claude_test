/**
 * In-app purchases are intentionally NOT used in this release (monetisation is ads only).
 * This isolated stub keeps the integration point for a future store via the Yandex SDK
 * (ysdk.getPayments). Nothing in the game calls purchase() today.
 */
export interface Product { id: string; title: string; price: string }

export const payments = {
  available: false as const,
  async getCatalog(): Promise<Product[]> { return []; },
  async purchase(_id: string): Promise<boolean> { return false; },
  async consumePending(): Promise<void> { /* no purchases to consume */ },
};
