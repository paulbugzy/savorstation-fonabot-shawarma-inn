export enum OrderType {
  DELIVERY = 5,
  TAKEAWAY = 10,
  POS = 15,
  DINING_TABLE = 20,
}

export enum PosPaymentMethod {
  CASH = 1,
  CARD = 2,
  MOBILE_BANKING = 3,
  OTHER = 4,
}

export enum BranchId {
  CHICAGO = 1,
  PARK_RIDGE = 2,
}

export interface Customer {
  id: number;
  name: string;
  email?: string;
  phone: string;
  branch_id: number;
}

export interface Address {
  id: number;
  customer_id: number;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  zip: string;
  latitude?: string;
  longitude?: string;
}

export interface ItemVariation {
  attribute_id: number;
  attribute_name: string;
  variation_id: number;
  variation_name: string;
  extra_price: number;
}

export interface ItemExtra {
  extra_id: number;
  extra_name: string;
  qty: number;
  price: number;
}

export interface OrderItem {
  branch_id: number;
  item_id: number;
  quantity: number;
  discount: number;
  item_price: number;
  item_variations: ItemVariation[];
  item_extras: ItemExtra[];
  instruction?: string;
  item_variation_total: number;
  item_extra_total: number;
  total_price: number;
}

export interface PosOrderRequest {
  token: string;
  customer_id: number;
  branch_id: number;
  subtotal: number;
  discount: number;
  delivery_charge: number;
  total: number;
  order_type: OrderType;
  is_advance_order: 0 | 1;
  address_id?: number;
  delivery_time?: string;
  coupon_id?: number | null;
  source: number;
  tip_amount: number;
  pos_payment_method: PosPaymentMethod;
  pos_payment_note?: string;
  pos_received_amount?: number | null;
  items: string;
}

export interface MenuItem {
  id: number;
  name: string;
  price: number;
  branch_id: number;
  category_id: number;
  description?: string;
  is_active: boolean;
}

export interface Attribute {
  id: number;
  name: string;
  is_required: boolean;
}

export interface Variation {
  id: number;
  name: string;
  attribute_id: number;
  extra_price: number;
}

export interface Extra {
  id: number;
  name: string;
  price: number;
}

export interface Branch {
  id: number;
  name: string;
  latitude: string;
  longitude: string;
  zone?: string;
}

export interface CallSession {
  callSid: string;
  phone: string;
  startedAt: string;
  idempotencyToken: string;
  orderType?: OrderType;
  branchId?: number;
  customerId?: number;
  addressId?: number;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  deliveryCharge: number;
  tipAmount: number;
  total: number;
  paymentMethod?: PosPaymentMethod;
  paymentNote?: string;
  receivedAmount?: number;
  deliveryTime?: string;
  conversationHistory: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
    timestamp: string;
  }>;
}

export interface BranchZoneResponse {
  data: {
    id: number;
    name: string;
    latitude: string;
    longitude: string;
    zone: string;
  };
}

export interface GeocodingResult {
  latitude: number;
  longitude: number;
  formatted_address: string;
}
