import axios from 'axios';
import laravelClient, { LaravelAPIError } from './laravelClient';
import logger from '@/utils/logger';
import { Branch, GeocodingResult } from '@/types';
import env from '@/config/env';

interface Point {
  lat: number;
  lng: number;
}

class BranchDetectionService {
  private branchCache: Branch[] | null = null;
  private cacheExpiry: number = 0;
  private readonly CACHE_TTL = 3600 * 1000;

  async detectBranchForDelivery(address: string): Promise<Branch> {
    const geocoded = await this.geocodeAddress(address);

    try {
      return await laravelClient.detectBranchByLocation(
        geocoded.latitude,
        geocoded.longitude
      );
    } catch (error: any) {
      if (error instanceof LaravelAPIError && error.code === 'OUT_OF_SERVICE_AREA') {
        throw error;
      }

      logger.warn(
        { error, address },
        'API branch detection failed, trying local fallback'
      );

      return await this.detectBranchLocally(geocoded.latitude, geocoded.longitude);
    }
  }

  async detectBranchLocally(latitude: number, longitude: number): Promise<Branch> {
    const branches = await this.getAllBranches();

    for (const branch of branches) {
      if (!branch.zone) continue;

      try {
        const polygon = this.parseZoneData(branch.zone);
        if (!polygon) {
          logger.warn(
            { branchId: branch.id },
            'Branch zone data could not be parsed; skipping branch'
          );
          continue;
        }

        if (this.isPointInPolygon({ lat: latitude, lng: longitude }, polygon)) {
          logger.info(
            { branchId: branch.id, branchName: branch.name, latitude, longitude },
            'Branch detected locally'
          );
          return branch;
        }
      } catch (error) {
        logger.error(
          { error, branchId: branch.id },
          'Failed to parse zone polygon'
        );
      }
    }

    throw new Error('OUT_OF_SERVICE_AREA');
  }

  private parseZoneData(zoneData: unknown): Point[] | null {
    if (!zoneData) {
      return null;
    }

    let parsed: unknown = zoneData;

    if (typeof parsed === 'string') {
      try {
        parsed = JSON.parse(parsed);
      } catch {
        logger.error({ zoneData: parsed }, 'Failed to parse zone JSON string');
        return null;
      }

      if (typeof parsed === 'string') {
        try {
          parsed = JSON.parse(parsed);
        } catch {
          logger.error(
            { zoneData: parsed },
            'Failed to parse nested zone JSON string'
          );
          return null;
        }
      }
    }

    if (Array.isArray(parsed)) {
      return this.normalizePolygon(parsed);
    }

    if (parsed && typeof parsed === 'object' && 'zone' in parsed) {
      const zoneValue = (parsed as { zone: unknown }).zone;
      return this.parseZoneData(zoneValue);
    }

    return null;
  }

  private normalizePolygon(rawPolygon: any[]): Point[] | null {
    const points: Point[] = [];

    for (const entry of rawPolygon) {
      let pointData = entry;

      if (typeof pointData === 'string') {
        try {
          pointData = JSON.parse(pointData);
        } catch {
          logger.warn({ entry }, 'Skipping invalid stringified polygon point');
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

  private async getAllBranches(): Promise<Branch[]> {
    if (this.branchCache && Date.now() < this.cacheExpiry) {
      return this.branchCache;
    }

    this.branchCache = await laravelClient.getAllBranches();
    this.cacheExpiry = Date.now() + this.CACHE_TTL;

    logger.info({ count: this.branchCache.length }, 'Cached branches');
    return this.branchCache;
  }

  private isPointInPolygon(point: Point, polygon: Point[]): boolean {
    let inside = false;
    const x = point.lat;
    const y = point.lng;

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].lat;
      const yi = polygon[i].lng;
      const xj = polygon[j].lat;
      const yj = polygon[j].lng;

      const intersect =
        yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;

      if (intersect) {
        inside = !inside;
      }
    }

    return inside;
  }

  async geocodeAddress(address: string): Promise<GeocodingResult> {
    logger.info({ address }, 'Geocoding address');

    try {
      const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
        params: {
          address,
          key: env.GOOGLE_MAPS_API_KEY,
        },
      });

      const { status, results, error_message: errorMessage } = response.data;

      if (status !== 'OK' || !results || results.length === 0) {
        logger.error(
          { status, errorMessage, address },
          'Geocoding API returned no results'
        );
        throw new Error('GEOCODING_NO_RESULTS');
      }

      const { geometry, formatted_address: formattedAddress } = results[0];
      const { lat, lng } = geometry.location;

      return {
        latitude: lat,
        longitude: lng,
        formatted_address: formattedAddress,
      };
    } catch (error: any) {
      logger.error({ error, address }, 'Geocoding lookup failed');
      throw new Error('GEOCODING_FAILED');
    }
  }
}

export default new BranchDetectionService();
