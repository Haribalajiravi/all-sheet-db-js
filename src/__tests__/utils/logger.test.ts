/**
 * Logger utility tests
 */

import { logger, LogLevel } from '../../utils/logger';

describe('Logger', () => {
  const originalConsole = { ...console };

  beforeEach(() => {
    // Mock console methods
    console.debug = jest.fn();
    console.info = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();
  });

  afterEach(() => {
    // Restore original console
    console.debug = originalConsole.debug;
    console.info = originalConsole.info;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
    logger.setLevel(LogLevel.INFO);
  });

  describe('setLevel', () => {
    it('should set the log level', () => {
      logger.setLevel(LogLevel.DEBUG);
      expect(logger.getLevel()).toBe(LogLevel.DEBUG);
    });
  });

  describe('debug', () => {
    it('should log debug messages when level is DEBUG', () => {
      logger.setLevel(LogLevel.DEBUG);
      logger.debug('Test debug message');
      expect(console.debug).toHaveBeenCalled();
    });

    it('should not log debug messages when level is higher', () => {
      logger.setLevel(LogLevel.INFO);
      logger.debug('Test debug message');
      expect(console.debug).not.toHaveBeenCalled();
    });
  });

  describe('info', () => {
    it('should log info messages when level is INFO or lower', () => {
      logger.setLevel(LogLevel.INFO);
      logger.info('Test info message');
      expect(console.info).toHaveBeenCalled();
    });
  });

  describe('warn', () => {
    it('should log warn messages when level is WARN or lower', () => {
      logger.setLevel(LogLevel.WARN);
      logger.warn('Test warn message');
      expect(console.warn).toHaveBeenCalled();
    });
  });

  describe('error', () => {
    it('should always log error messages', () => {
      logger.setLevel(LogLevel.ERROR);
      logger.error('Test error message');
      expect(console.error).toHaveBeenCalled();
    });
  });
});
