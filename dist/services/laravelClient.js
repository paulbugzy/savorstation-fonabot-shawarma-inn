"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LaravelAPIError = void 0;
const axios_1 = __importDefault(require("axios"));
const env_1 = __importDefault(require("../config/env"));
const logger_1 = __importDefault(require("../utils/logger"));
class LaravelAPIError extends Error {
    code;
    path;
    statusCode;
    constructor(code, message, path, statusCode) {
        super(message);
        this.code = code;
        this.path = path;
        this.statusCode = statusCode;
        this.name = 'LaravelAPIError';
    }
}
exports.LaravelAPIError = LaravelAPIError;
class LaravelClient {
    client;
    token = null;
    tokenExpiry = 0;
    constructor() {
        this.client = axios_1.default.create({
            baseURL: env_1.default.BACKEND_BASE_URL,
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                'x-api-key': env_1.default.MIX_API_KEY,
            },
        });
        this.client.interceptors.response.use((response) => response, async (error) => {
            if (error.response?.status === 401 && this.token) {
                logger_1.default.warn('Token expired, re-authenticating...');
                this.token = null;
                this.tokenExpiry = 0;
                await this.ensureAuthenticated();
                if (error.config) {
                    error.config.headers.Authorization = `Bearer ${this.token}`;
                    return this.client.request(error.config);
                }
            }
            throw error;
        });
    }
    async ensureAuthenticated() {
        if (this.token && Date.now() < this.tokenExpiry) {
            return;
        }
        try {
            const response = await this.client.post('/api/auth/login', {
                email: env_1.default.BACKEND_EMAIL,
                password: env_1.default.BACKEND_PASSWORD,
            });
            this.token = response.data.token;
            this.tokenExpiry = Date.now() + 3600 * 1000;
            logger_1.default.info('Successfully authenticated with Laravel backend');
        }
        catch (error) {
            logger_1.default.error({ error }, 'Failed to authenticate with Laravel backend');
            throw new LaravelAPIError('AUTH_FAILED', 'Failed to authenticate with backend', '/api/auth/login');
        }
    }
    getAuthHeaders() {
        if (!this.token) {
            throw new LaravelAPIError('NO_TOKEN', 'Not authenticated', 'auth');
        }
        return {
            Authorization: `Bearer ${this.token}`,
            'x-api-key': env_1.default.MIX_API_KEY,
        };
    }
    extractDataArray(payload) {
        if (!payload) {
            return [];
        }
        if (Array.isArray(payload)) {
            return payload;
        }
        if (payload.data) {
            if (Array.isArray(payload.data)) {
                return payload.data;
            }
            if (Array.isArray(payload.data.data)) {
                return payload.data.data;
            }
            if (payload.data.data && Array.isArray(payload.data.data.data)) {
                return payload.data.data.data;
            }
        }
        if (Array.isArray(payload.results)) {
            return payload.results;
        }
        if (Array.isArray(payload.items)) {
            return payload.items;
        }
        return [];
    }
    deriveCountryCode(phone) {
        if (!phone) {
            return '+1';
        }
        const digits = phone.replace(/[^\d]/g, '');
        if (!digits.length) {
            return '+1';
        }
        if (digits.length > 10) {
            const dialCode = digits.slice(0, digits.length - 10);
            if (dialCode.length) {
                return `+${dialCode}`;
            }
        }
        const defaultCode = digits.slice(0, Math.min(3, digits.length)) || '1';
        return `+${defaultCode}`;
    }
    generateTemporaryPassword() {
        const random = Math.random().toString(36).slice(-8);
        return `Vo${random}1!`.slice(0, 12);
    }
    buildFullAddress(data) {
        if (data.address && data.address.trim()) {
            return data.address.trim();
        }
        const segments = [data.line1, data.line2, data.city, data.state, data.zip]
            .map((part) => part?.trim())
            .filter(Boolean);
        return segments.join(', ');
    }
    generateAddressLabel(fallback) {
        const timestampSuffix = `Voice-${Date.now()}`;
        const base = (fallback?.trim() || 'Address').replace(/\s+/g, ' ');
        const maxBaseLength = Math.max(0, 190 - timestampSuffix.length - 1);
        let trimmedBase = base.length > maxBaseLength ? base.slice(0, maxBaseLength) : base;
        if (!trimmedBase) {
            trimmedBase = 'Addr';
        }
        return `${trimmedBase}-${timestampSuffix}`;
    }
    normalizeCoordinate(value) {
        if (value === null || value === undefined) {
            return undefined;
        }
        if (typeof value === 'number') {
            return value.toString();
        }
        const text = String(value).trim();
        return text.length ? text : undefined;
    }
    async withRetry(operation, maxRetries = 3) {
        let lastError = null;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await operation();
            }
            catch (error) {
                lastError = error;
                const axiosError = error;
                if (axiosError.response?.status === 429 || (axiosError.response?.status && axiosError.response.status >= 500)) {
                    const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
                    logger_1.default.warn({ attempt, delay, status: axiosError.response?.status }, 'Retrying request after error');
                    await new Promise((resolve) => setTimeout(resolve, delay));
                    continue;
                }
                break;
            }
        }
        throw lastError;
    }
    async login() {
        await this.ensureAuthenticated();
        return this.token;
    }
    async searchCustomer(query) {
        await this.ensureAuthenticated();
        try {
            const response = await this.withRetry(() => this.client.get('/api/admin/customer', {
                params: { search: query, paginate: 0 },
                headers: this.getAuthHeaders(),
            }));
            const customers = this.extractDataArray(response.data);
            return customers;
        }
        catch (error) {
            const axiosError = error;
            if (axiosError.response?.status === 404 ||
                axiosError.response?.status === 405) {
                const fallbackResponse = await this.withRetry(() => this.client.get('/api/customer', {
                    params: { search: query, paginate: 0 },
                    headers: this.getAuthHeaders(),
                }));
                return this.extractDataArray(fallbackResponse.data);
            }
            logger_1.default.error({ error, query }, 'Failed to search customer');
            throw new LaravelAPIError('SEARCH_CUSTOMER_FAILED', axiosError.message, '/api/customer', axiosError.response?.status);
        }
    }
    async createCustomer(data) {
        await this.ensureAuthenticated();
        const password = data.password ?? this.generateTemporaryPassword();
        const payload = {
            name: data.name,
            email: data.email,
            phone: data.phone,
            branch_id: data.branch_id,
            status: data.status ?? 5,
            country_code: data.country_code ?? this.deriveCountryCode(data.phone),
            password,
            password_confirmation: data.password_confirmation ?? password,
            email_subscriber: data.email_subscriber ?? false,
            sms_subscriber: data.sms_subscriber ?? false,
            source: data.source ?? 'voice-ordering',
            notes: data.notes,
        };
        try {
            const response = await this.withRetry(() => this.client.post('/api/admin/customer', payload, {
                headers: this.getAuthHeaders(),
            }));
            return response.data.data || response.data;
        }
        catch (error) {
            const axiosError = error;
            if (axiosError.response?.status === 404 ||
                axiosError.response?.status === 405) {
                const fallbackResponse = await this.withRetry(() => this.client.post('/api/customer', payload, {
                    headers: this.getAuthHeaders(),
                }));
                return fallbackResponse.data.data || fallbackResponse.data;
            }
            logger_1.default.error({
                error,
                data: {
                    ...data,
                    password: '[REDACTED]',
                    password_confirmation: '[REDACTED]',
                },
            }, 'Failed to create customer');
            throw new LaravelAPIError('CREATE_CUSTOMER_FAILED', axiosError.message, '/api/customer', axiosError.response?.status);
        }
    }
    async createAddress(customerId, data) {
        await this.ensureAuthenticated();
        const addressText = this.buildFullAddress(data);
        if (!addressText) {
            throw new Error('Address text is required to create address');
        }
        const latitude = this.normalizeCoordinate(data.latitude);
        const longitude = this.normalizeCoordinate(data.longitude);
        if (!latitude || !longitude) {
            throw new Error('Latitude and longitude are required to create address');
        }
        const payload = {
            label: this.generateAddressLabel(data.label ?? data.line1),
            address: addressText,
            apartment: data.apartment ?? data.line2 ?? '',
            latitude,
            longitude,
        };
        try {
            const response = await this.withRetry(() => this.client.post(`/api/admin/customer/address/${customerId}`, payload, {
                headers: this.getAuthHeaders(),
            }));
            return response.data.data || response.data;
        }
        catch (error) {
            const axiosError = error;
            if (axiosError.response?.status === 404 ||
                axiosError.response?.status === 405) {
                const fallbackResponse = await this.withRetry(() => this.client.post(`/api/customer/address/${customerId}`, payload, {
                    headers: this.getAuthHeaders(),
                }));
                return fallbackResponse.data.data || fallbackResponse.data;
            }
            logger_1.default.error({ error, customerId, data }, 'Failed to create address');
            throw new LaravelAPIError('CREATE_ADDRESS_FAILED', axiosError.message, `/api/customer/address/${customerId}`, axiosError.response?.status);
        }
    }
    async getMenu(branchId) {
        await this.ensureAuthenticated();
        try {
            const response = await this.withRetry(() => this.client.get('/api/admin/item', {
                params: { paginate: 0, branch_id: branchId },
                headers: this.getAuthHeaders(),
            }));
            return response.data.data || response.data;
        }
        catch (error) {
            const axiosError = error;
            if (axiosError.response?.status === 404 ||
                axiosError.response?.status === 405) {
                const fallbackResponse = await this.withRetry(() => this.client.get('/api/item', {
                    params: { paginate: 0, branch_id: branchId },
                    headers: this.getAuthHeaders(),
                }));
                return fallbackResponse.data.data || fallbackResponse.data;
            }
            logger_1.default.error({ error, branchId }, 'Failed to get menu');
            throw new LaravelAPIError('GET_MENU_FAILED', axiosError.message, '/api/item', axiosError.response?.status);
        }
    }
    async getVariations(itemId) {
        await this.ensureAuthenticated();
        try {
            const response = await this.withRetry(() => this.client.get(`/api/admin/item/variation/${itemId}`, {
                headers: this.getAuthHeaders(),
            }));
            return response.data.data || response.data;
        }
        catch (error) {
            const axiosError = error;
            if (axiosError.response?.status === 404 ||
                axiosError.response?.status === 405) {
                const fallbackResponse = await this.withRetry(() => this.client.get(`/api/item/variation/${itemId}`, {
                    headers: this.getAuthHeaders(),
                }));
                return fallbackResponse.data.data || fallbackResponse.data;
            }
            logger_1.default.error({ error, itemId }, 'Failed to get variations');
            throw new LaravelAPIError('GET_VARIATIONS_FAILED', axiosError.message, `/api/item/variation/${itemId}`, axiosError.response?.status);
        }
    }
    async createPosOrder(data) {
        await this.ensureAuthenticated();
        try {
            const response = await this.withRetry(() => this.client.post('/api/admin/pos', data, {
                headers: this.getAuthHeaders(),
            }));
            return response.data.data || response.data;
        }
        catch (error) {
            const axiosError = error;
            if (axiosError.response?.status === 404 ||
                axiosError.response?.status === 405) {
                const fallbackResponse = await this.withRetry(() => this.client.post('/api/pos', data, {
                    headers: this.getAuthHeaders(),
                }));
                return fallbackResponse.data.data || fallbackResponse.data;
            }
            logger_1.default.error({ error, data: { ...data, items: '[REDACTED]' } }, 'Failed to create POS order');
            throw new LaravelAPIError('CREATE_ORDER_FAILED', axiosError.message, '/api/pos', axiosError.response?.status);
        }
    }
    async detectBranchByLocation(latitude, longitude) {
        try {
            const response = await this.withRetry(() => this.client.get('/api/frontend/branch/lat-long', {
                params: { latitude, longitude },
                headers: {
                    'x-api-key': env_1.default.MIX_API_KEY,
                    Accept: 'application/json',
                },
            }));
            const data = response.data;
            return data.data;
        }
        catch (error) {
            const axiosError = error;
            if (axiosError.response?.status === 422) {
                throw new LaravelAPIError('OUT_OF_SERVICE_AREA', 'Address is outside service area', '/api/frontend/branch/lat-long', 422);
            }
            logger_1.default.error({ error, latitude, longitude }, 'Failed to detect branch');
            throw new LaravelAPIError('BRANCH_DETECTION_FAILED', axiosError.message, '/api/frontend/branch/lat-long', axiosError.response?.status);
        }
    }
    async getAllBranches() {
        try {
            const response = await this.withRetry(() => this.client.get('/api/frontend/branch', {
                params: { paginate: 0 },
                headers: {
                    'x-api-key': env_1.default.MIX_API_KEY,
                    Accept: 'application/json',
                },
            }));
            return response.data.data || response.data;
        }
        catch (error) {
            const axiosError = error;
            logger_1.default.error({ error }, 'Failed to get all branches');
            throw new LaravelAPIError('GET_BRANCHES_FAILED', axiosError.message, '/api/frontend/branch', axiosError.response?.status);
        }
    }
}
exports.default = new LaravelClient();
//# sourceMappingURL=laravelClient.js.map