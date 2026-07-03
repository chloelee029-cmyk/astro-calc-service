"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
exports.parseDateParam = parseDateParam;
exports.parseScope = parseScope;
exports.parseOptionalCalcInput = parseOptionalCalcInput;
const validation_1 = require("../utils/validation");
function requireAuth(validateApiKey, c) {
    return validateApiKey(c.req.header('Authorization'));
}
function parseDateParam(value, fallback) {
    return typeof value === 'string' && value
        ? new Date(`${value}T12:00:00.000Z`)
        : fallback;
}
function parseScope(value) {
    return value === 'daily' || value === 'weekly' || value === 'monthly' ? value : 'weekly';
}
// 纯大环境星象不强依赖用户出生资料；缺省使用 UTC/0,0 作为计算壳。
function parseOptionalCalcInput(body, date) {
    return (0, validation_1.parseCalcInput)(body) || {
        birthTimeISO: date.toISOString(),
        lat: (0, validation_1.toFiniteNumber)(body.lat) ?? 0,
        lng: (0, validation_1.toFiniteNumber)(body.lng) ?? 0,
        timezone: typeof body.timezone === 'string' ? body.timezone : 'UTC',
    };
}
