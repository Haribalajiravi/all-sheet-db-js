import { formatErrorMessage } from '../../utils/errors';

describe('formatErrorMessage', () => {
  it('formats Error instances', () => {
    expect(formatErrorMessage(new Error('oops'))).toBe('oops');
  });

  it('formats plain objects (Google-style)', () => {
    expect(formatErrorMessage({ error: 'popup_closed_by_user' })).toBe('popup_closed_by_user');
    expect(
      formatErrorMessage({
        error: 'idpiframe_initialization_failed',
        details: 'Not a valid origin',
      })
    ).toBe('idpiframe_initialization_failed: Not a valid origin');
  });

  it('formats gapi result.error', () => {
    expect(
      formatErrorMessage({
        result: {
          error: {
            status: 'PERMISSION_DENIED',
            message: 'Request had invalid authentication credentials.',
          },
        },
      })
    ).toBe('PERMISSION_DENIED — Request had invalid authentication credentials.');
  });

  it('falls back to JSON for unknown objects', () => {
    expect(formatErrorMessage({ foo: 1, bar: 'x' })).toBe('{"foo":1,"bar":"x"}');
  });
});
