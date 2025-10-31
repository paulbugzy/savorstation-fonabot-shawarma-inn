import { CallSession, OrderItem, OrderType, PosPaymentMethod } from '@/types';
import { OrderValidator } from './orderValidator';
import logger from '@/utils/logger';

export interface OrderUpdate {
  type: 'SET_ORDER_TYPE' | 'SET_BRANCH' | 'SET_CUSTOMER' | 'SET_ADDRESS' |
        'ADD_ITEM' | 'REMOVE_ITEM' | 'UPDATE_ITEM' | 'SET_PAYMENT' |
        'SET_TIP' | 'SET_DELIVERY_TIME' | 'SET_DELIVERY_CHARGE' | 'SET_DISCOUNT';
  payload: any;
}

export class OrderReducer {
  static reduce(session: CallSession, update: OrderUpdate): CallSession {
    const newSession = { ...session };

    switch (update.type) {
      case 'SET_ORDER_TYPE':
        newSession.orderType = update.payload as OrderType;
        logger.debug({ orderType: update.payload }, 'Set order type');
        break;

      case 'SET_BRANCH':
        newSession.branchId = update.payload as number;
        logger.debug({ branchId: update.payload }, 'Set branch');
        break;

      case 'SET_CUSTOMER':
        newSession.customerId = update.payload as number;
        logger.debug({ customerId: update.payload }, 'Set customer');
        break;

      case 'SET_ADDRESS':
        newSession.addressId = update.payload as number;
        logger.debug({ addressId: update.payload }, 'Set address');
        break;

      case 'ADD_ITEM':
        const newItem = OrderValidator.normalizeItemForOrder(
          update.payload,
          newSession.branchId!
        );
        newSession.items.push(newItem);
        newSession.subtotal = this.calculateSubtotal(newSession.items);
        newSession.total = this.calculateTotal(newSession);
        logger.debug({ itemId: newItem.item_id, total: newSession.total }, 'Added item');
        break;

      case 'REMOVE_ITEM':
        const indexToRemove = update.payload as number;
        if (indexToRemove >= 0 && indexToRemove < newSession.items.length) {
          newSession.items.splice(indexToRemove, 1);
          newSession.subtotal = this.calculateSubtotal(newSession.items);
          newSession.total = this.calculateTotal(newSession);
          logger.debug({ index: indexToRemove, total: newSession.total }, 'Removed item');
        }
        break;

      case 'UPDATE_ITEM':
        const { index, item } = update.payload as { index: number; item: Partial<OrderItem> };
        if (index >= 0 && index < newSession.items.length) {
          newSession.items[index] = OrderValidator.normalizeItemForOrder(
            { ...newSession.items[index], ...item },
            newSession.branchId!
          );
          newSession.subtotal = this.calculateSubtotal(newSession.items);
          newSession.total = this.calculateTotal(newSession);
          logger.debug({ index, total: newSession.total }, 'Updated item');
        }
        break;

      case 'SET_PAYMENT':
        const { method, note, amount } = update.payload as {
          method: PosPaymentMethod;
          note?: string;
          amount?: number;
        };
        newSession.paymentMethod = method;
        newSession.paymentNote = note;
        newSession.receivedAmount = amount;
        logger.debug({ method, hasNote: !!note }, 'Set payment method');
        break;

      case 'SET_TIP':
        newSession.tipAmount = update.payload as number;
        newSession.total = this.calculateTotal(newSession);
        logger.debug({ tipAmount: update.payload, total: newSession.total }, 'Set tip');
        break;

      case 'SET_DELIVERY_TIME':
        newSession.deliveryTime = update.payload as string;
        logger.debug({ deliveryTime: update.payload }, 'Set delivery time');
        break;

      case 'SET_DELIVERY_CHARGE':
        newSession.deliveryCharge = update.payload as number;
        newSession.total = this.calculateTotal(newSession);
        logger.debug({ deliveryCharge: update.payload, total: newSession.total }, 'Set delivery charge');
        break;

      case 'SET_DISCOUNT':
        newSession.discount = update.payload as number;
        newSession.total = this.calculateTotal(newSession);
        logger.debug({ discount: update.payload, total: newSession.total }, 'Set discount');
        break;

      default:
        logger.warn({ type: (update as any).type }, 'Unknown order update type');
    }

    return newSession;
  }

  private static calculateSubtotal(items: OrderItem[]): number {
    return items.reduce((sum, item) => sum + item.total_price, 0);
  }

  private static calculateTotal(session: CallSession): number {
    return (
      session.subtotal -
      session.discount +
      session.deliveryCharge +
      session.tipAmount
    );
  }
}

export default OrderReducer;
