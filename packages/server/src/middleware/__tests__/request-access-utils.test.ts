import { describe, expect, it } from 'vitest';

import {
  classifyEndpoint,
  extractGraphqlOperation,
  hashGraphqlDocument,
  normalizeUrlPath,
  sanitizeHost,
  statusToLevel,
} from '../request-access-utils.js';

describe('request-access-utils', () => {
  describe('sanitizeHost', () => {
    it('returns null for undefined or empty values', () => {
      expect(sanitizeHost(undefined)).toBeNull();
      expect(sanitizeHost('')).toBeNull();
      expect(sanitizeHost('   ')).toBeNull();
    });

    it('strips ports and lowercases hostnames', () => {
      expect(sanitizeHost('API.EXAMPLE.COM:443')).toBe('api.example.com');
      expect(sanitizeHost('127.0.0.1:3000')).toBe('127.0.0.1');
    });

    it('uses first host from forwarded host chains', () => {
      expect(sanitizeHost('api.example.com, proxy.internal')).toBe('api.example.com');
      expect(sanitizeHost('[2001:db8::1]:8443, proxy.internal')).toBe('2001:db8::1');
    });
  });

  describe('normalizeUrlPath', () => {
    it('drops query strings and hash fragments', () => {
      expect(normalizeUrlPath('/graphql?token=secret#frag')).toBe('/graphql');
    });

    it('normalizes trailing slashes (except root)', () => {
      expect(normalizeUrlPath('/graphql/')).toBe('/graphql');
      expect(normalizeUrlPath('/')).toBe('/');
    });
  });

  describe('classifyEndpoint', () => {
    it('classifies graphql, mcp, snapshot, api and unknown', () => {
      expect(classifyEndpoint('/graphql')).toBe('graphql');
      expect(classifyEndpoint('/graphql/')).toBe('graphql');
      expect(classifyEndpoint('/mcp')).toBe('mcp');
      expect(classifyEndpoint('/mcp/tools')).toBe('mcp');
      expect(classifyEndpoint('/api/snapshot')).toBe('snapshot');
      expect(classifyEndpoint('/api/snapshot/run')).toBe('snapshot');
      expect(classifyEndpoint('/api/devices')).toBe('api');
      expect(classifyEndpoint('/health')).toBe('unknown');
    });
  });

  describe('statusToLevel', () => {
    it('maps status codes to log levels', () => {
      expect(statusToLevel(200)).toBe('info');
      expect(statusToLevel(302)).toBe('info');
      expect(statusToLevel(404)).toBe('warn');
      expect(statusToLevel(500)).toBe('error');
    });
  });

  describe('extractGraphqlOperation', () => {
    it('prefers client-provided operationName', () => {
      const result = extractGraphqlOperation({
        operationName: 'GetViewer',
        query: 'query SomethingElse { viewer { id } }',
      });

      expect(result).toEqual({
        operationName: 'GetViewer',
        operationType: 'query',
        opParseError: false,
      });
    });

    it('falls back to AST named operation for query/mutation/subscription', () => {
      expect(extractGraphqlOperation({ query: 'query GetViewer { viewer { id } }' })).toEqual({
        operationName: 'GetViewer',
        operationType: 'query',
        opParseError: false,
      });

      expect(extractGraphqlOperation({ query: 'mutation UpdateUser { updateUser(id: 1) { id } }' })).toEqual({
        operationName: 'UpdateUser',
        operationType: 'mutation',
        opParseError: false,
      });

      expect(extractGraphqlOperation({ query: 'subscription WatchUser { userChanged { id } }' })).toEqual({
        operationName: 'WatchUser',
        operationType: 'subscription',
        opParseError: false,
      });
    });

    it('uses anonymous operationName for anonymous operation', () => {
      const result = extractGraphqlOperation({ query: 'query { viewer { id } }' });
      expect(result).toEqual({
        operationName: 'anonymous',
        operationType: 'query',
        opParseError: false,
      });
    });

    it('sets parse error flag on invalid query and preserves client operationName when provided', () => {
      const withClientName = extractGraphqlOperation({ operationName: 'ClientProvidedName', query: 'not-valid {' });
      expect(withClientName).toEqual({
        operationName: 'ClientProvidedName',
        operationType: null,
        opParseError: true,
      });

      const withoutClientName = extractGraphqlOperation({ query: 'not-valid {' });
      expect(withoutClientName).toEqual({
        operationName: 'anonymous',
        operationType: null,
        opParseError: true,
      });
    });
  });

  describe('hashGraphqlDocument', () => {
    it('returns sha256 hex hash and null for empty input', () => {
      expect(hashGraphqlDocument('query GetViewer { viewer { id } }')).toBe(
        '4fca5ddb7f05288c5ac206df8b2b55876226920e113270bdd473c28fb79b04a1',
      );
      expect(hashGraphqlDocument('')).toBeNull();
      expect(hashGraphqlDocument('   ')).toBeNull();
      expect(hashGraphqlDocument(undefined)).toBeNull();
    });
  });
});
