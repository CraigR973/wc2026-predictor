import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PinInput } from '../PinInput';

function renderPin(value = '', onChange = vi.fn()) {
  return { onChange, ...render(<PinInput value={value} onChange={onChange} />) };
}

describe('PinInput', () => {
  it('renders 4 cells', () => {
    renderPin();
    expect(screen.getByLabelText('PIN digit 1')).toBeTruthy();
    expect(screen.getByLabelText('PIN digit 2')).toBeTruthy();
    expect(screen.getByLabelText('PIN digit 3')).toBeTruthy();
    expect(screen.getByLabelText('PIN digit 4')).toBeTruthy();
  });

  it('auto-advances to next cell on digit input', () => {
    const onChange = vi.fn();
    render(<PinInput value="" onChange={onChange} />);
    const cell1 = screen.getByLabelText('PIN digit 1') as HTMLInputElement;
    fireEvent.change(cell1, { target: { value: '5' } });
    expect(onChange).toHaveBeenCalledWith('5');
  });

  it('fills all four digits correctly', () => {
    const onChange = vi.fn();
    const { rerender } = render(<PinInput value="" onChange={onChange} />);
    const cell1 = screen.getByLabelText('PIN digit 1') as HTMLInputElement;
    fireEvent.change(cell1, { target: { value: '1' } });
    rerender(<PinInput value="1" onChange={onChange} />);
    const cell2 = screen.getByLabelText('PIN digit 2') as HTMLInputElement;
    fireEvent.change(cell2, { target: { value: '2' } });
    expect(onChange).toHaveBeenLastCalledWith('12');
  });

  it('backspace on a filled cell clears it', () => {
    const onChange = vi.fn();
    render(<PinInput value="12" onChange={onChange} />);
    const cell2 = screen.getByLabelText('PIN digit 2') as HTMLInputElement;
    fireEvent.keyDown(cell2, { key: 'Backspace' });
    expect(onChange).toHaveBeenCalledWith('1');
  });

  it('backspace on an empty cell moves focus back and clears previous', () => {
    const onChange = vi.fn();
    render(<PinInput value="1" onChange={onChange} />);
    const cell2 = screen.getByLabelText('PIN digit 2') as HTMLInputElement;
    fireEvent.keyDown(cell2, { key: 'Backspace' });
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('paste of 4 digits fills all cells', () => {
    const onChange = vi.fn();
    render(<PinInput value="" onChange={onChange} />);
    const cell1 = screen.getByLabelText('PIN digit 1') as HTMLInputElement;
    fireEvent.paste(cell1, {
      clipboardData: { getData: () => '7 3 9 1'.replace(/ /g, '') },
    });
    expect(onChange).toHaveBeenCalledWith('7391');
  });

  it('paste strips non-digits', () => {
    const onChange = vi.fn();
    render(<PinInput value="" onChange={onChange} />);
    const cell1 = screen.getByLabelText('PIN digit 1');
    fireEvent.paste(cell1, {
      clipboardData: { getData: () => 'ab1234cd' },
    });
    expect(onChange).toHaveBeenCalledWith('1234');
  });
});
