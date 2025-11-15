
import { query, param, body } from 'express-validator';

// Common regex patterns
const SKU_REGEX = /^[A-Z0-9\-]+$/;

// Helper for required string
const requiredString = (field, msg = undefined) =>
  body(field)
    .exists({ checkFalsy: true }).withMessage(msg || `${field} is required`)
    .isString().withMessage(`${field} must be a string`)
    .trim();

// Helper for optional string
const optionalString = (field) =>
  body(field)
    .optional({ checkFalsy: true })
    .isString().withMessage(`${field} must be a string`)
    .trim();

// Validate SKU param
export const validateSkuParam = [
  param('sku')
    .exists({ checkFalsy: true }).withMessage('sku is required')
    .isString().withMessage('sku must be a string')
    .matches(SKU_REGEX).withMessage('sku must be uppercase letters, numbers, or hyphens')
    .trim(),
];

//Validate transactionIdParams
export const validateTransactionIdParam = [
  param('transaction_id')
    .exists({ checkFalsy: true }).withMessage('transaction_id is required')
    .isUUID(4).withMessage('transaction_id must be a valid UUID v4'),
];

// Validation middleware for add product input
export const validateProduct = [
  body('sku')
    .exists({ checkFalsy: true }).withMessage('sku is required')
    .isString().withMessage('sku must be a string')
    .matches(SKU_REGEX).withMessage('sku must be uppercase letters, numbers, or hyphens')
    .trim(),
  body('name')
    .exists({ checkFalsy: true }).withMessage('name is required')
    .isString().withMessage('name must be a string')
    .isLength({ min: 2 }).withMessage('name must be at least 2 characters')
    .trim(),
  optionalString('description'),
  body('price')
    .exists({ checkFalsy: true }).withMessage('price is required')
    .isFloat({ gt: 0 }).withMessage('price must be a positive number'),
  body('quantity')
    .exists({ checkFalsy: true }).withMessage('quantity is required')
    .isInt({ min: 0 }).withMessage('quantity must be a non-negative integer'),
  optionalString('category'),
  optionalString('supplier'),
];

// validate Add transaction
export const validateTransaction = [
  body('sku')
    .exists({ checkFalsy: true }).withMessage('sku is required')
    .isString().withMessage('sku must be a string')
    .matches(SKU_REGEX).withMessage('sku must be uppercase letters, numbers, or hyphens')
    .trim(),
  body('type')
    .exists({ checkFalsy: true }).withMessage('type is required')
    .isIn(['IN', 'OUT', 'ADJUSTMENT']).withMessage('type must be one of IN, OUT, ADJUSTMENT'),
  body('quantity')
    .exists({ checkFalsy: true }).withMessage('quantity is required')
    .isInt().withMessage('quantity must be an integer'),
  body('reason')
    .optional({ checkFalsy: true })
    .isString().withMessage('reason must be a string')
    .trim(),
];

// Validation middleware for getHistory endpoint
export const validateGetHistory = [
  ...validateSkuParam,
  query('size')
    .optional({ checkFalsy: true })
    .isInt({ min: 1 }).withMessage('size must be a positive integer'),
];

// Validate timestamp param as ISO8601 and sku together for the time-travel endpoint
export const validateInventoryAtParams = [
  ...validateSkuParam,
  param('timestamp')
    .exists({ checkFalsy: true }).withMessage('timestamp is required')
    .isISO8601().withMessage('timestamp must be a valid ISO8601 datetime'),
];