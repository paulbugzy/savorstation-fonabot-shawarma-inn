import { CallSession } from '../types';
export interface OrderUpdate {
    type: 'SET_ORDER_TYPE' | 'SET_BRANCH' | 'SET_CUSTOMER' | 'SET_ADDRESS' | 'ADD_ITEM' | 'REMOVE_ITEM' | 'UPDATE_ITEM' | 'SET_PAYMENT' | 'SET_TIP' | 'SET_DELIVERY_TIME' | 'SET_DELIVERY_CHARGE' | 'SET_DISCOUNT';
    payload: any;
}
export declare class OrderReducer {
    static reduce(session: CallSession, update: OrderUpdate): CallSession;
    private static calculateSubtotal;
    private static calculateTotal;
}
export default OrderReducer;
//# sourceMappingURL=orderReducer.d.ts.map