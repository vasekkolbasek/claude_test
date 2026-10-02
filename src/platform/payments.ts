/**
 * In-app purchases are intentionally NOT enabled: they require the owner to connect
 * monetization in the Yandex Games console first. This isolated module keeps the
 * integration point ready. To enable later:
 *  1. Add products in the console (Inapps tab) with ids from PRODUCTS below.
 *  2. Set PAYMENTS_ENABLED = true and implement `YandexPayments` via ysdk.getPayments().
 *  3. Grant rewards in `grant()` and call `payments.consumePurchase(token)`.
 */
export const PAYMENTS_ENABLED = false;

export interface Product {
  id: string;
  title: string;
  price: string;
}

export const PRODUCTS = ['bits_pack_small', 'bits_pack_large', 'no_ads'] as const;
export type ProductId = (typeof PRODUCTS)[number];

export interface Payments {
  readonly enabled: boolean;
  getCatalog(): Promise<Product[]>;
  purchase(id: ProductId): Promise<boolean>;
  restore(): Promise<ProductId[]>;
}

/** Stub used while payments are disabled: never sells anything. */
export class DisabledPayments implements Payments {
  readonly enabled = false;
  async getCatalog(): Promise<Product[]> {
    return [];
  }
  async purchase(_id: ProductId): Promise<boolean> {
    return false;
  }
  async restore(): Promise<ProductId[]> {
    return [];
  }
}

export const payments: Payments = new DisabledPayments();
