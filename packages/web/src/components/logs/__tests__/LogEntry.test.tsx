import { describe, it, expect, afterEach } from 'bun:test';
import { render, cleanup } from '@testing-library/react';
import { LogEntryRow } from '../LogEntry';

afterEach(cleanup);

describe('LogEntryRow', () => {
  it('F4.1.2: displays time, level, module, message', () => {
    const { getByText } = render(<LogEntryRow time="14:05:04.615" level="INFO" module="tools" message="exec completed" />);
    expect(getByText('14:05:04.615')).toBeDefined();
    expect(getByText('INFO')).toBeDefined();
    expect(getByText('tools')).toBeDefined();
    expect(getByText('exec completed')).toBeDefined();
  });

  it('F4.1.3: ERROR has red color class', () => {
    const { getByText } = render(<LogEntryRow time="10:00" level="ERROR" module="test" message="fail" />);
    expect(getByText('ERROR').className).toContain('red');
  });

  it('F4.1.3: WARN has amber color class', () => {
    const { getByText } = render(<LogEntryRow time="10:00" level="WARN" module="test" message="slow" />);
    expect(getByText('WARN').className).toContain('amber');
  });

  it('F4.1.3: DEBUG has zinc/gray color class', () => {
    const { getByText } = render(<LogEntryRow time="10:00" level="DEBUG" module="test" message="trace" />);
    expect(getByText('DEBUG').className).toContain('zinc-600');
  });
});
