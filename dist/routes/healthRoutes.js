"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const laravelClient_1 = __importDefault(require("../services/laravelClient"));
const logger_1 = __importDefault(require("../utils/logger"));
const router = (0, express_1.Router)();
router.get('/health', async (req, res) => {
    try {
        await laravelClient_1.default.login();
        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            services: {
                laravel: 'connected',
                supabase: 'connected',
            },
        });
    }
    catch (error) {
        logger_1.default.error({ error }, 'Health check failed');
        res.status(503).json({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
router.get('/ready', (req, res) => {
    res.json({
        status: 'ready',
        timestamp: new Date().toISOString(),
    });
});
exports.default = router;
//# sourceMappingURL=healthRoutes.js.map