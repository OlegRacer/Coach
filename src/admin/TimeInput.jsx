import { useState } from 'react';
import { fmtTime } from '../lib/video.js';

// Час хв:сек для цифрової клавіатури: вводяться лише цифри, двокрапка ставиться сама.
// Цифри заповнюють справа наліво: 5 -> 0:05, 125 -> 1:25, 1030 -> 10:30.
const show = (digits) => {
  if (!digits) return '';
  const d = digits.padStart(3, '0');
  return `${d.slice(0, -2).replace(/^0+(?=\d)/, '')}:${d.slice(-2)}`;
};
const toSeconds = (digits) => {
  if (!digits) return 0;
  const d = digits.padStart(3, '0');
  return parseInt(d.slice(0, -2), 10) * 60 + parseInt(d.slice(-2), 10);
};

export default function TimeInput({ value, onChange, placeholder, label }) {
  const [digits, setDigits] = useState(value ? fmtTime(value).replace(':', '').replace(/^0+/, '') : '');
  const [focus, setFocus] = useState(false);
  return (
    <input
      className="field"
      inputMode="numeric"
      aria-label={label}
      placeholder={placeholder}
      value={focus ? show(digits) : value ? fmtTime(value) : ''}
      onFocus={() => {
        setFocus(true);
        setDigits(value ? fmtTime(value).replace(':', '').replace(/^0+/, '') : '');
      }}
      onBlur={() => setFocus(false)}
      onChange={(e) => {
        const d = e.target.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 5);
        setDigits(d);
        onChange(toSeconds(d));
      }}
    />
  );
}
