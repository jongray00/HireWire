import { useEffect, useRef, useState } from 'react';

/**
 * @param {Object} props
 * @param {string} props.value - currently selected phone number (E.164 or empty)
 * @param {(val: string) => void} props.onChange
 * @param {string} props.label
 * @param {string} [props.placeholder]
 * @param {{ spaceUrl: string, projectId: string, apiToken: string }} props.credentials
 * @param {"all" | "campaign-registry"} [props.source]
 *   "all" (default) — list every IncomingPhoneNumber on the project. Renders
 *   as a select with a "Custom number…" toggle.
 *   "campaign-registry" — list only numbers assigned to a TCR / 10DLC
 *   campaign. Renders as a single text input with an embedded caret button
 *   that opens a popover of registry numbers. Typing any number is always
 *   permitted.
 */
export default function PhoneNumberPicker({
  value,
  onChange,
  label,
  placeholder,
  credentials,
  source = 'all',
}) {
  const [phoneNumbers, setPhoneNumbers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [useCustom, setUseCustom] = useState(false);

  useEffect(() => {
    if (!credentials?.spaceUrl || !credentials?.projectId || !credentials?.apiToken) return;

    const endpoint =
      source === 'campaign-registry'
        ? '/api/signalwire/campaign-registry-numbers'
        : '/api/signalwire/phone-numbers';
    const qs = new URLSearchParams({
      spaceUrl: credentials.spaceUrl,
      projectId: credentials.projectId,
      apiToken: credentials.apiToken,
    });

    setLoading(true);
    fetch(`${endpoint}?${qs.toString()}`)
      .then(r => r.json())
      .then(data => {
        if (data.success) setPhoneNumbers(data.phoneNumbers || []);
      })
      .catch(err => console.error('Failed to load phone numbers:', err))
      .finally(() => setLoading(false));
  }, [credentials?.spaceUrl, credentials?.projectId, credentials?.apiToken, source]);

  const formatNumber = (num) => {
    if (!num) return '';
    const cleaned = num.replace(/\D/g, '');
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    }
    return num;
  };

  const fieldClasses =
    "w-full px-4 py-2 text-sm rounded-lg border " +
    "border-gray-300 dark:border-gray-600 " +
    "bg-white dark:bg-gray-700 " +
    "text-gray-900 dark:text-white " +
    "placeholder-gray-400 dark:placeholder-gray-500 " +
    "focus:ring-2 focus:ring-blue-500 focus:border-transparent";

  if (source === 'campaign-registry') {
    return (
      <ComboboxField
        value={value || ''}
        onChange={onChange}
        label={label}
        placeholder={placeholder || '+15551234567'}
        loading={loading}
        options={phoneNumbers}
        formatNumber={formatNumber}
      />
    );
  }

  // Default UI ("all" source): select with a "Custom number…" toggle.
  const isKnownNumber = phoneNumbers.some(p => p.phoneNumber === value);
  const showCustomInput = useCustom || (value && !isKnownNumber && phoneNumbers.length > 0);

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
        {label}
      </label>

      {loading ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading phone numbers...</p>
      ) : (
        <>
          <select
            value={showCustomInput ? '__custom__' : (value || '')}
            onChange={(e) => {
              if (e.target.value === '__custom__') {
                setUseCustom(true);
              } else {
                setUseCustom(false);
                onChange(e.target.value);
              }
            }}
            className={fieldClasses}
          >
            <option value="">— Select a number —</option>
            {phoneNumbers.map((pn) => (
              <option key={pn.sid || pn.phoneNumber} value={pn.phoneNumber}>
                {formatNumber(pn.phoneNumber)}{pn.friendlyName ? ` — "${pn.friendlyName}"` : ''}
              </option>
            ))}
            <option value="__custom__">Custom number...</option>
          </select>

          {showCustomInput && (
            <input
              type="text"
              value={value || ''}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder || '+15551234567'}
              className={`${fieldClasses} mt-2`}
            />
          )}
        </>
      )}
    </div>
  );
}

/**
 * Combobox: a single text input with a caret button that toggles a popover
 * listing pickable values. Typing in the input is always allowed; clicking a
 * popover row replaces the input value.
 */
function ComboboxField({ value, onChange, label, placeholder, loading, options, formatNumber }) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  // Close on click outside.
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const onEsc = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const inputClasses =
    "w-full pl-4 pr-10 py-2 text-sm rounded-lg border " +
    "border-gray-300 dark:border-gray-600 " +
    "bg-white dark:bg-gray-700 " +
    "text-gray-900 dark:text-white " +
    "placeholder-gray-400 dark:placeholder-gray-500 " +
    "focus:ring-2 focus:ring-blue-500 focus:border-transparent";

  const hasOptions = options.length > 0;
  const caretDisabled = loading || !hasOptions;

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
        {label}
      </label>
      <div ref={wrapperRef} className="relative">
        <input
          type="tel"
          inputMode="tel"
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => {
            if (!caretDisabled) setOpen(true);
          }}
          onClick={() => {
            if (!caretDisabled) setOpen(true);
          }}
          placeholder={placeholder}
          aria-haspopup="listbox"
          aria-expanded={open}
          className={inputClasses}
        />
        <button
          type="button"
          onClick={() => !caretDisabled && setOpen((o) => !o)}
          disabled={caretDisabled}
          aria-label={
            loading
              ? 'Loading campaign-registry numbers'
              : hasOptions
                ? `Pick from ${options.length} campaign-registry number${options.length === 1 ? '' : 's'}`
                : 'No campaign-registry numbers available'
          }
          aria-haspopup="listbox"
          aria-expanded={open}
          className={
            'absolute right-0 top-0 h-full px-3 flex items-center ' +
            'text-gray-500 dark:text-gray-400 ' +
            'hover:text-gray-700 dark:hover:text-gray-200 ' +
            'focus:outline-none focus:text-blue-600 ' +
            'disabled:opacity-50 disabled:cursor-not-allowed'
          }
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`}
          >
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z"
              clipRule="evenodd"
            />
          </svg>
        </button>

        {open && hasOptions && (
          <ul
            role="listbox"
            className={
              'absolute z-20 mt-1 w-full max-h-60 overflow-auto ' +
              'rounded-lg shadow-lg ring-1 ring-black ring-opacity-5 ' +
              'border border-gray-200 dark:border-gray-600 ' +
              'bg-white dark:bg-gray-700 ' +
              'py-1 text-sm'
            }
          >
            {options.map((pn) => {
              const selected = pn.phoneNumber === value;
              return (
                <li
                  key={pn.sid || pn.phoneNumber}
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    onChange(pn.phoneNumber);
                    setOpen(false);
                  }}
                  className={
                    'cursor-pointer px-4 py-2 ' +
                    'text-gray-900 dark:text-white ' +
                    'hover:bg-blue-50 dark:hover:bg-gray-600 ' +
                    (selected ? 'bg-blue-100 dark:bg-gray-600 font-medium' : '')
                  }
                >
                  <div>{formatNumber(pn.phoneNumber)}</div>
                  {pn.friendlyName && (
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {pn.friendlyName}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
