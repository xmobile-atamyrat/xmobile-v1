'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.jobs = void 0;
const healthcheck_1 = require('./healthcheck');
const telekom_balance_1 = require('./telekom-balance');
exports.jobs = [
  healthcheck_1.healthcheckJob,
  telekom_balance_1.telekomBalanceJob,
];
