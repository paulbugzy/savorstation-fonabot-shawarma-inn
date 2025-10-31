"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BranchId = exports.PosPaymentMethod = exports.OrderType = void 0;
var OrderType;
(function (OrderType) {
    OrderType[OrderType["DELIVERY"] = 5] = "DELIVERY";
    OrderType[OrderType["TAKEAWAY"] = 10] = "TAKEAWAY";
    OrderType[OrderType["POS"] = 15] = "POS";
    OrderType[OrderType["DINING_TABLE"] = 20] = "DINING_TABLE";
})(OrderType || (exports.OrderType = OrderType = {}));
var PosPaymentMethod;
(function (PosPaymentMethod) {
    PosPaymentMethod[PosPaymentMethod["CASH"] = 1] = "CASH";
    PosPaymentMethod[PosPaymentMethod["CARD"] = 2] = "CARD";
    PosPaymentMethod[PosPaymentMethod["MOBILE_BANKING"] = 3] = "MOBILE_BANKING";
    PosPaymentMethod[PosPaymentMethod["OTHER"] = 4] = "OTHER";
})(PosPaymentMethod || (exports.PosPaymentMethod = PosPaymentMethod = {}));
var BranchId;
(function (BranchId) {
    BranchId[BranchId["CHICAGO"] = 1] = "CHICAGO";
    BranchId[BranchId["PARK_RIDGE"] = 2] = "PARK_RIDGE";
})(BranchId || (exports.BranchId = BranchId = {}));
//# sourceMappingURL=index.js.map