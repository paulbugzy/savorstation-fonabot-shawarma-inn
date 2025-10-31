import { Customer, Address, MenuItem, Variation, Branch, PosOrderRequest } from '../types';
export declare class LaravelAPIError extends Error {
    code: string;
    path: string;
    statusCode?: number | undefined;
    constructor(code: string, message: string, path: string, statusCode?: number | undefined);
}
declare class LaravelClient {
    private client;
    private token;
    private tokenExpiry;
    constructor();
    private ensureAuthenticated;
    private getAuthHeaders;
    private extractDataArray;
    private deriveCountryCode;
    private generateTemporaryPassword;
    private buildFullAddress;
    private generateAddressLabel;
    private normalizeCoordinate;
    private withRetry;
    login(): Promise<string>;
    searchCustomer(query: string): Promise<Customer[]>;
    createCustomer(data: {
        name: string;
        email?: string;
        phone: string;
        branch_id: number;
        country_code?: string;
        status?: number;
        password?: string;
        password_confirmation?: string;
        email_subscriber?: boolean;
        sms_subscriber?: boolean;
        source?: string;
        notes?: string;
    }): Promise<Customer>;
    createAddress(customerId: number, data: {
        label?: string;
        address?: string;
        apartment?: string;
        line1?: string;
        line2?: string;
        city?: string;
        state?: string;
        zip?: string;
        latitude?: string | number;
        longitude?: string | number;
    }): Promise<Address>;
    getMenu(branchId: number): Promise<MenuItem[]>;
    getVariations(itemId: number): Promise<Variation[]>;
    createPosOrder(data: PosOrderRequest): Promise<{
        id: number;
        order_serial_no: string;
        total: number;
    }>;
    detectBranchByLocation(latitude: number, longitude: number): Promise<Branch>;
    getAllBranches(): Promise<Branch[]>;
}
declare const _default: LaravelClient;
export default _default;
//# sourceMappingURL=laravelClient.d.ts.map