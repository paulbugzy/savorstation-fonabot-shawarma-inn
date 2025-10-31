"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const laravelClient_1 = __importStar(require("./laravelClient"));
const logger_1 = __importDefault(require("../utils/logger"));
const env_1 = __importDefault(require("../config/env"));
class BranchDetectionService {
    branchCache = null;
    cacheExpiry = 0;
    CACHE_TTL = 3600 * 1000;
    async detectBranchForDelivery(address) {
        const geocoded = await this.geocodeAddress(address);
        try {
            return await laravelClient_1.default.detectBranchByLocation(geocoded.latitude, geocoded.longitude);
        }
        catch (error) {
            if (error instanceof laravelClient_1.LaravelAPIError && error.code === 'OUT_OF_SERVICE_AREA') {
                throw error;
            }
            logger_1.default.warn({ error, address }, 'API branch detection failed, trying local fallback');
            return await this.detectBranchLocally(geocoded.latitude, geocoded.longitude);
        }
    }
    async detectBranchLocally(latitude, longitude) {
        const branches = await this.getAllBranches();
        for (const branch of branches) {
            if (!branch.zone)
                continue;
            try {
                const polygon = this.parseZoneData(branch.zone);
                if (!polygon) {
                    logger_1.default.warn({ branchId: branch.id }, 'Branch zone data could not be parsed; skipping branch');
                    continue;
                }
                if (this.isPointInPolygon({ lat: latitude, lng: longitude }, polygon)) {
                    logger_1.default.info({ branchId: branch.id, branchName: branch.name, latitude, longitude }, 'Branch detected locally');
                    return branch;
                }
            }
            catch (error) {
                logger_1.default.error({ error, branchId: branch.id }, 'Failed to parse zone polygon');
            }
        }
        throw new Error('OUT_OF_SERVICE_AREA');
    }
    parseZoneData(zoneData) {
        if (!zoneData) {
            return null;
        }
        let parsed = zoneData;
        if (typeof parsed === 'string') {
            try {
                parsed = JSON.parse(parsed);
            }
            catch {
                logger_1.default.error({ zoneData: parsed }, 'Failed to parse zone JSON string');
                return null;
            }
            if (typeof parsed === 'string') {
                try {
                    parsed = JSON.parse(parsed);
                }
                catch {
                    logger_1.default.error({ zoneData: parsed }, 'Failed to parse nested zone JSON string');
                    return null;
                }
            }
        }
        if (Array.isArray(parsed)) {
            return this.normalizePolygon(parsed);
        }
        if (parsed && typeof parsed === 'object' && 'zone' in parsed) {
            const zoneValue = parsed.zone;
            return this.parseZoneData(zoneValue);
        }
        return null;
    }
    normalizePolygon(rawPolygon) {
        const points = [];
        for (const entry of rawPolygon) {
            let pointData = entry;
            if (typeof pointData === 'string') {
                try {
                    pointData = JSON.parse(pointData);
                }
                catch {
                    logger_1.default.warn({ entry }, 'Skipping invalid stringified polygon point');
                    continue;
                }
            }
            if (!pointData || typeof pointData !== 'object') {
                continue;
            }
            const lat = Number(pointData.lat ?? pointData.latitude);
            const lng = Number(pointData.lng ?? pointData.longitude);
            if (Number.isFinite(lat) && Number.isFinite(lng)) {
                points.push({ lat, lng });
            }
        }
        if (points.length < 3) {
            return null;
        }
        return points;
    }
    async getAllBranches() {
        if (this.branchCache && Date.now() < this.cacheExpiry) {
            return this.branchCache;
        }
        this.branchCache = await laravelClient_1.default.getAllBranches();
        this.cacheExpiry = Date.now() + this.CACHE_TTL;
        logger_1.default.info({ count: this.branchCache.length }, 'Cached branches');
        return this.branchCache;
    }
    isPointInPolygon(point, polygon) {
        let inside = false;
        const x = point.lat;
        const y = point.lng;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const xi = polygon[i].lat;
            const yi = polygon[i].lng;
            const xj = polygon[j].lat;
            const yj = polygon[j].lng;
            const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
            if (intersect) {
                inside = !inside;
            }
        }
        return inside;
    }
    async geocodeAddress(address) {
        logger_1.default.info({ address }, 'Geocoding address');
        try {
            const response = await axios_1.default.get('https://maps.googleapis.com/maps/api/geocode/json', {
                params: {
                    address,
                    key: env_1.default.GOOGLE_MAPS_API_KEY,
                },
            });
            const { status, results, error_message: errorMessage } = response.data;
            if (status !== 'OK' || !results || results.length === 0) {
                logger_1.default.error({ status, errorMessage, address }, 'Geocoding API returned no results');
                throw new Error('GEOCODING_NO_RESULTS');
            }
            const { geometry, formatted_address: formattedAddress } = results[0];
            const { lat, lng } = geometry.location;
            return {
                latitude: lat,
                longitude: lng,
                formatted_address: formattedAddress,
            };
        }
        catch (error) {
            logger_1.default.error({ error, address }, 'Geocoding lookup failed');
            throw new Error('GEOCODING_FAILED');
        }
    }
}
exports.default = new BranchDetectionService();
//# sourceMappingURL=branchDetection.js.map