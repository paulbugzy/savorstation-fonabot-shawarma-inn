import { Branch, GeocodingResult } from '../types';
declare class BranchDetectionService {
    private branchCache;
    private cacheExpiry;
    private readonly CACHE_TTL;
    detectBranchForDelivery(address: string): Promise<Branch>;
    detectBranchLocally(latitude: number, longitude: number): Promise<Branch>;
    private parseZoneData;
    private normalizePolygon;
    private getAllBranches;
    private isPointInPolygon;
    geocodeAddress(address: string): Promise<GeocodingResult>;
}
declare const _default: BranchDetectionService;
export default _default;
//# sourceMappingURL=branchDetection.d.ts.map