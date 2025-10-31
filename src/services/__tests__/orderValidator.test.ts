import { OrderValidator } from '../orderValidator';
import { OrderItem, Attribute, Variation } from '@/types';

describe('OrderValidator', () => {
  describe('validateItem', () => {
    it('should return error when required attribute is missing', () => {
      const item: OrderItem = {
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
      };

      const requiredAttributes: Attribute[] = [
        { id: 1, name: 'Protein', is_required: true },
      ];

      const availableVariations: Variation[] = [];

      const errors = OrderValidator.validateItem(
        item,
        requiredAttributes,
        availableVariations
      );

      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('Protein is required');
    });

    it('should pass validation when all required attributes are present', () => {
      const item: OrderItem = {
        branch_id: 1,
        item_id: 1,
        quantity: 1,
        discount: 0,
        item_price: 10.0,
        item_variations: [
          {
            attribute_id: 1,
            attribute_name: 'Protein',
            variation_id: 10,
            variation_name: 'Chicken',
            extra_price: 0,
          },
        ],
        item_extras: [],
        item_variation_total: 0,
        item_extra_total: 0,
        total_price: 10.0,
      };

      const requiredAttributes: Attribute[] = [
        { id: 1, name: 'Protein', is_required: true },
      ];

      const availableVariations: Variation[] = [
        {
          id: 10,
          name: 'Chicken',
          attribute_id: 1,
          extra_price: 0,
        },
      ];

      const errors = OrderValidator.validateItem(
        item,
        requiredAttributes,
        availableVariations
      );

      expect(errors).toHaveLength(0);
    });

    it('should return error for invalid quantity', () => {
      const item: OrderItem = {
        branch_id: 1,
        item_id: 1,
        quantity: 0,
        discount: 0,
        item_price: 10.0,
        item_variations: [],
        item_extras: [],
        item_variation_total: 0,
        item_extra_total: 0,
        total_price: 0,
      };

      const errors = OrderValidator.validateItem(item, [], []);

      expect(errors.some((e) => e.message.includes('Quantity must be greater than 0'))).toBe(
        true
      );
    });
  });

  describe('calculateItemTotal', () => {
    it('should calculate total correctly with variations and extras', () => {
      const item: OrderItem = {
        branch_id: 1,
        item_id: 1,
        quantity: 2,
        discount: 0,
        item_price: 10.0,
        item_variations: [
          {
            attribute_id: 1,
            attribute_name: 'Protein',
            variation_id: 10,
            variation_name: 'Chicken',
            extra_price: 2.0,
          },
        ],
        item_extras: [
          {
            extra_id: 1,
            extra_name: 'Garlic Sauce',
            qty: 1,
            price: 0.5,
          },
        ],
        item_variation_total: 2.0,
        item_extra_total: 0.5,
        total_price: 0,
      };

      const total = OrderValidator.calculateItemTotal(item);

      expect(total).toBe(25.0);
    });
  });

  describe('validateOrderTotals', () => {
    it('should pass validation when totals match', () => {
      const items: OrderItem[] = [
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
      ];

      const errors = OrderValidator.validateOrderTotals(items, 10.0, 0, 2.0, 1.0, 13.0);

      expect(errors).toHaveLength(0);
    });

    it('should return error when subtotal does not match', () => {
      const items: OrderItem[] = [
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
      ];

      const errors = OrderValidator.validateOrderTotals(items, 15.0, 0, 0, 0, 15.0);

      expect(errors.some((e) => e.field === 'subtotal')).toBe(true);
    });

    it('should return error for negative discount', () => {
      const items: OrderItem[] = [];

      const errors = OrderValidator.validateOrderTotals(items, 0, -5.0, 0, 0, 5.0);

      expect(errors.some((e) => e.message.includes('Discount cannot be negative'))).toBe(
        true
      );
    });
  });
});
