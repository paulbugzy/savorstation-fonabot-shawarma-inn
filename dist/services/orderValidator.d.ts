import { OrderItem, Attribute, Variation } from '../types';
export interface ValidationError {
    field: string;
    message: string;
}
export declare class OrderValidator {
    static validateItem(item: OrderItem, requiredAttributes: Attribute[], availableVariations: Variation[]): ValidationError[];
    static calculateItemTotal(item: OrderItem): number;
    static validateOrderTotals(items: OrderItem[], subtotal: number, discount: number, deliveryCharge: number, tipAmount: number, total: number): ValidationError[];
    static normalizeItemForOrder(item: Partial<OrderItem>, branchId: number): OrderItem;
}
export default OrderValidator;
//# sourceMappingURL=orderValidator.d.ts.map