import { describe, it, expect, beforeEach } from '@jest/globals';
import { OrderReducer } from '../orderReducer';
import { CallSession, OrderType, PosPaymentMethod } from '../../types';

describe('OrderReducer', () => {
  let initialSession: CallSession;

  beforeEach(() => {
    initialSession = {
      callSid: 'test-call-sid',
      phone: 'hashed-phone',
      startedAt: new Date().toISOString(),
      idempotencyToken: 'test-token',
      items: [],
      subtotal: 0,
      discount: 0,
      deliveryCharge: 0,
      tipAmount: 0,
      total: 0,
      conversationHistory: [],
    };
  });

  it('should set order type', () => {
    const updated = OrderReducer.reduce(initialSession, {
      type: 'SET_ORDER_TYPE',
      payload: OrderType.DELIVERY,
    });

    expect(updated.orderType).toBe(OrderType.DELIVERY);
  });

  it('should set branch', () => {
    const updated = OrderReducer.reduce(initialSession, {
      type: 'SET_BRANCH',
      payload: 1,
    });

    expect(updated.branchId).toBe(1);
  });

  it('should add item and update totals', () => {
    const sessionWithBranch: CallSession = { ...initialSession, branchId: 1 };

    const updated = OrderReducer.reduce(sessionWithBranch, {
      type: 'ADD_ITEM',
      payload: {
        item_id: 1,
        item_price: 10.0,
        quantity: 2,
        item_variations: [],
        item_extras: [],
      },
    });

    expect(updated.items).toHaveLength(1);
    expect(updated.subtotal).toBe(20.0);
    expect(updated.total).toBe(20.0);
  });

  it('should remove item and update totals', () => {
    const sessionWithItems = {
      ...initialSession,
      branchId: 1,
      items: [
        {
          branch_id: 1,
          item_id: 1,
          quantity: 1,
          discount: 0,
          item_price: 10.0,
          item_variations: [],
          item_extras: [],
          item_variation_total: 0,
          item_extra_total: 0,
          total_price: 10.0,
        },
      ],
      subtotal: 10.0,
      total: 10.0,
    };

    const updated = OrderReducer.reduce(sessionWithItems, {
      type: 'REMOVE_ITEM',
      payload: 0,
    });

    expect(updated.items).toHaveLength(0);
    expect(updated.subtotal).toBe(0);
    expect(updated.total).toBe(0);
  });

  it('should set tip and update total', () => {
    const sessionWithSubtotal = {
      ...initialSession,
      subtotal: 20.0,
      total: 20.0,
    };

    const updated = OrderReducer.reduce(sessionWithSubtotal, {
      type: 'SET_TIP',
      payload: 3.0,
    });

    expect(updated.tipAmount).toBe(3.0);
    expect(updated.total).toBe(23.0);
  });

  it('should set delivery charge and update total', () => {
    const sessionWithSubtotal = {
      ...initialSession,
      subtotal: 20.0,
      total: 20.0,
    };

    const updated = OrderReducer.reduce(sessionWithSubtotal, {
      type: 'SET_DELIVERY_CHARGE',
      payload: 5.0,
    });

    expect(updated.deliveryCharge).toBe(5.0);
    expect(updated.total).toBe(25.0);
  });

  it('should set payment method', () => {
    const updated = OrderReducer.reduce(initialSession, {
      type: 'SET_PAYMENT',
      payload: {
        method: PosPaymentMethod.CARD,
        note: '1234',
      },
    });

    expect(updated.paymentMethod).toBe(PosPaymentMethod.CARD);
    expect(updated.paymentNote).toBe('1234');
  });

  it('should calculate total correctly with all components', () => {
    let session: CallSession = OrderReducer.reduce(initialSession, {
      type: 'SET_BRANCH',
      payload: 1,
    });

    session = OrderReducer.reduce(session, {
      type: 'ADD_ITEM',
      payload: {
        item_id: 1,
        item_price: 10.0,
        quantity: 2,
        item_variations: [],
        item_extras: [],
      },
    });

    session = OrderReducer.reduce(session, {
      type: 'SET_DISCOUNT',
      payload: 2.0,
    });

    session = OrderReducer.reduce(session, {
      type: 'SET_DELIVERY_CHARGE',
      payload: 3.0,
    });

    session = OrderReducer.reduce(session, {
      type: 'SET_TIP',
      payload: 4.0,
    });

    expect(session.subtotal).toBe(20.0);
    expect(session.discount).toBe(2.0);
    expect(session.deliveryCharge).toBe(3.0);
    expect(session.tipAmount).toBe(4.0);
    expect(session.total).toBe(25.0);
  });
});
