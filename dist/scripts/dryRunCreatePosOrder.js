"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const laravelClient_1 = __importDefault(require("../services/laravelClient"));
const logger_1 = __importDefault(require("../utils/logger"));
const types_1 = require("../types");
const env_1 = __importDefault(require("../config/env"));
async function dryRunCreatePosOrder() {
    try {
        logger_1.default.info('Starting dry run for POS order creation...');
        await laravelClient_1.default.login();
        logger_1.default.info('✓ Successfully authenticated with Laravel backend');
        const customerPhone = '+15555551234';
        logger_1.default.info({ phone: customerPhone }, 'Searching for existing customer...');
        let customers = await laravelClient_1.default.searchCustomer(customerPhone);
        let customer;
        if (customers.length === 0) {
            logger_1.default.info('Customer not found, creating new customer...');
            customer = await laravelClient_1.default.createCustomer({
                name: 'Test Voice Customer',
                phone: customerPhone,
                email: 'voicetest@example.com',
                branch_id: 1,
            });
            logger_1.default.info({ customerId: customer.id }, '✓ Created customer');
        }
        else {
            customer = customers[0];
            logger_1.default.info({ customerId: customer.id }, '✓ Found existing customer');
        }
        const deliveryAddress = {
            line1: '123 Main Street',
            city: 'Chicago',
            state: 'IL',
            zip: '60601',
            latitude: '41.8781',
            longitude: '-87.6298',
        };
        logger_1.default.info('Creating delivery address...');
        const address = await laravelClient_1.default.createAddress(customer.id, deliveryAddress);
        logger_1.default.info({ addressId: address.id }, '✓ Created address');
        logger_1.default.info('Fetching menu for branch 1...');
        const menu = await laravelClient_1.default.getMenu(1);
        logger_1.default.info({ itemCount: menu.length }, '✓ Fetched menu');
        if (menu.length === 0) {
            throw new Error('No menu items available');
        }
        const firstItem = menu[0];
        logger_1.default.info({ itemId: firstItem.id, itemName: firstItem.name }, 'Selected menu item');
        logger_1.default.info('Fetching variations for item...');
        const variations = await laravelClient_1.default.getVariations(firstItem.id);
        logger_1.default.info({ variationCount: variations.length }, '✓ Fetched variations');
        const items = [
            {
                branch_id: 1,
                item_id: firstItem.id,
                quantity: 2,
                discount: 0,
                item_price: firstItem.price,
                item_variations: variations.slice(0, 1).map((v) => ({
                    attribute_id: v.attribute_id,
                    attribute_name: 'Test Attribute',
                    variation_id: v.id,
                    variation_name: v.name,
                    extra_price: v.extra_price,
                })),
                item_extras: [],
                instruction: 'Extra sauce on the side',
                item_variation_total: variations[0]?.extra_price || 0,
                item_extra_total: 0,
                total_price: (firstItem.price + (variations[0]?.extra_price || 0)) * 2,
            },
        ];
        const subtotal = items.reduce((sum, item) => sum + item.total_price, 0);
        const deliveryCharge = 3.5;
        const tipAmount = 5.0;
        const total = subtotal + deliveryCharge + tipAmount;
        const orderData = {
            token: `DRYRUN-${Date.now()}`,
            customer_id: customer.id,
            branch_id: 1,
            subtotal,
            discount: 0,
            delivery_charge: deliveryCharge,
            total,
            order_type: types_1.OrderType.DELIVERY,
            is_advance_order: 0,
            address_id: address.id,
            delivery_time: '18:30 - 19:00',
            coupon_id: null,
            source: parseInt(env_1.default.AI_ORDER_SOURCE),
            tip_amount: tipAmount,
            pos_payment_method: types_1.PosPaymentMethod.CASH,
            pos_payment_note: undefined,
            pos_received_amount: total,
            items: JSON.stringify(items),
        };
        logger_1.default.info({ orderData: { ...orderData, items: '[ITEMS]' } }, 'Creating POS order...');
        const order = await laravelClient_1.default.createPosOrder(orderData);
        logger_1.default.info({
            orderId: order.id,
            orderSerialNo: order.order_serial_no,
            total: order.total,
        }, '✅ ORDER CREATED SUCCESSFULLY!');
        console.log('\n========================================');
        console.log('✅ DRY RUN COMPLETED SUCCESSFULLY!');
        console.log('========================================');
        console.log(`Order ID: ${order.id}`);
        console.log(`Order Serial No: ${order.order_serial_no}`);
        const resolvedTotal = typeof order.total === 'number'
            ? order.total
            : Number(order.total ?? total);
        console.log(`Total: $${resolvedTotal.toFixed(2)}`);
        console.log(`Source: ${env_1.default.AI_ORDER_SOURCE} (AI Orders)`);
        console.log('========================================\n');
    }
    catch (error) {
        logger_1.default.error({ error }, '❌ Dry run failed');
        console.error('\n❌ DRY RUN FAILED!');
        console.error(error);
        process.exit(1);
    }
}
dryRunCreatePosOrder();
//# sourceMappingURL=dryRunCreatePosOrder.js.map