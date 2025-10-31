"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderReducer = void 0;
const orderValidator_1 = require("./orderValidator");
const logger_1 = __importDefault(require("../utils/logger"));
class OrderReducer {
    static reduce(session, update) {
        const newSession = { ...session };
        switch (update.type) {
            case 'SET_ORDER_TYPE':
                newSession.orderType = update.payload;
                logger_1.default.debug({ orderType: update.payload }, 'Set order type');
                break;
            case 'SET_BRANCH':
                newSession.branchId = update.payload;
                logger_1.default.debug({ branchId: update.payload }, 'Set branch');
                break;
            case 'SET_CUSTOMER':
                newSession.customerId = update.payload;
                logger_1.default.debug({ customerId: update.payload }, 'Set customer');
                break;
            case 'SET_ADDRESS':
                newSession.addressId = update.payload;
                logger_1.default.debug({ addressId: update.payload }, 'Set address');
                break;
            case 'ADD_ITEM':
                const newItem = orderValidator_1.OrderValidator.normalizeItemForOrder(update.payload, newSession.branchId);
                newSession.items.push(newItem);
                newSession.subtotal = this.calculateSubtotal(newSession.items);
                newSession.total = this.calculateTotal(newSession);
                logger_1.default.debug({ itemId: newItem.item_id, total: newSession.total }, 'Added item');
                break;
            case 'REMOVE_ITEM':
                const indexToRemove = update.payload;
                if (indexToRemove >= 0 && indexToRemove < newSession.items.length) {
                    newSession.items.splice(indexToRemove, 1);
                    newSession.subtotal = this.calculateSubtotal(newSession.items);
                    newSession.total = this.calculateTotal(newSession);
                    logger_1.default.debug({ index: indexToRemove, total: newSession.total }, 'Removed item');
                }
                break;
            case 'UPDATE_ITEM':
                const { index, item } = update.payload;
                if (index >= 0 && index < newSession.items.length) {
                    newSession.items[index] = orderValidator_1.OrderValidator.normalizeItemForOrder({ ...newSession.items[index], ...item }, newSession.branchId);
                    newSession.subtotal = this.calculateSubtotal(newSession.items);
                    newSession.total = this.calculateTotal(newSession);
                    logger_1.default.debug({ index, total: newSession.total }, 'Updated item');
                }
                break;
            case 'SET_PAYMENT':
                const { method, note, amount } = update.payload;
                newSession.paymentMethod = method;
                newSession.paymentNote = note;
                newSession.receivedAmount = amount;
                logger_1.default.debug({ method, hasNote: !!note }, 'Set payment method');
                break;
            case 'SET_TIP':
                newSession.tipAmount = update.payload;
                newSession.total = this.calculateTotal(newSession);
                logger_1.default.debug({ tipAmount: update.payload, total: newSession.total }, 'Set tip');
                break;
            case 'SET_DELIVERY_TIME':
                newSession.deliveryTime = update.payload;
                logger_1.default.debug({ deliveryTime: update.payload }, 'Set delivery time');
                break;
            case 'SET_DELIVERY_CHARGE':
                newSession.deliveryCharge = update.payload;
                newSession.total = this.calculateTotal(newSession);
                logger_1.default.debug({ deliveryCharge: update.payload, total: newSession.total }, 'Set delivery charge');
                break;
            case 'SET_DISCOUNT':
                newSession.discount = update.payload;
                newSession.total = this.calculateTotal(newSession);
                logger_1.default.debug({ discount: update.payload, total: newSession.total }, 'Set discount');
                break;
            default:
                logger_1.default.warn({ type: update.type }, 'Unknown order update type');
        }
        return newSession;
    }
    static calculateSubtotal(items) {
        return items.reduce((sum, item) => sum + item.total_price, 0);
    }
    static calculateTotal(session) {
        return (session.subtotal -
            session.discount +
            session.deliveryCharge +
            session.tipAmount);
    }
}
exports.OrderReducer = OrderReducer;
exports.default = OrderReducer;
//# sourceMappingURL=orderReducer.js.map