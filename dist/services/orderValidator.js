"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderValidator = void 0;
class OrderValidator {
    static validateItem(item, requiredAttributes, availableVariations) {
        const errors = [];
        const selectedAttributeIds = new Set(item.item_variations.map((v) => v.attribute_id));
        for (const attr of requiredAttributes) {
            if (attr.is_required && !selectedAttributeIds.has(attr.id)) {
                errors.push({
                    field: `item_${item.item_id}_attribute_${attr.id}`,
                    message: `${attr.name} is required for this item`,
                });
            }
        }
        for (const variation of item.item_variations) {
            const isValid = availableVariations.some((v) => v.id === variation.variation_id && v.attribute_id === variation.attribute_id);
            if (!isValid) {
                errors.push({
                    field: `item_${item.item_id}_variation_${variation.variation_id}`,
                    message: `Invalid variation: ${variation.variation_name}`,
                });
            }
        }
        if (item.quantity <= 0) {
            errors.push({
                field: `item_${item.item_id}_quantity`,
                message: 'Quantity must be greater than 0',
            });
        }
        return errors;
    }
    static calculateItemTotal(item) {
        const variationsTotal = item.item_variations.reduce((sum, v) => sum + v.extra_price, 0);
        const extrasTotal = item.item_extras.reduce((sum, e) => sum + e.price * e.qty, 0);
        return (item.item_price + variationsTotal + extrasTotal) * item.quantity;
    }
    static validateOrderTotals(items, subtotal, discount, deliveryCharge, tipAmount, total) {
        const errors = [];
        const calculatedSubtotal = items.reduce((sum, item) => {
            return sum + this.calculateItemTotal(item);
        }, 0);
        const calculatedTotal = calculatedSubtotal - discount + deliveryCharge + tipAmount;
        if (Math.abs(calculatedSubtotal - subtotal) > 0.01) {
            errors.push({
                field: 'subtotal',
                message: `Subtotal mismatch. Expected ${calculatedSubtotal.toFixed(2)}, got ${subtotal.toFixed(2)}`,
            });
        }
        if (Math.abs(calculatedTotal - total) > 0.01) {
            errors.push({
                field: 'total',
                message: `Total mismatch. Expected ${calculatedTotal.toFixed(2)}, got ${total.toFixed(2)}`,
            });
        }
        if (discount < 0) {
            errors.push({
                field: 'discount',
                message: 'Discount cannot be negative',
            });
        }
        if (deliveryCharge < 0) {
            errors.push({
                field: 'delivery_charge',
                message: 'Delivery charge cannot be negative',
            });
        }
        if (tipAmount < 0) {
            errors.push({
                field: 'tip_amount',
                message: 'Tip amount cannot be negative',
            });
        }
        return errors;
    }
    static normalizeItemForOrder(item, branchId) {
        const variationTotal = (item.item_variations || []).reduce((sum, v) => sum + v.extra_price, 0);
        const extraTotal = (item.item_extras || []).reduce((sum, e) => sum + e.price * e.qty, 0);
        const quantity = item.quantity || 1;
        const itemPrice = item.item_price || 0;
        return {
            branch_id: branchId,
            item_id: item.item_id,
            quantity,
            discount: item.discount || 0,
            item_price: itemPrice,
            item_variations: item.item_variations || [],
            item_extras: item.item_extras || [],
            instruction: item.instruction,
            item_variation_total: variationTotal,
            item_extra_total: extraTotal,
            total_price: (itemPrice + variationTotal + extraTotal) * quantity,
        };
    }
}
exports.OrderValidator = OrderValidator;
exports.default = OrderValidator;
//# sourceMappingURL=orderValidator.js.map