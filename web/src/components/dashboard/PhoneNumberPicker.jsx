import { useState, useEffect } from 'react';

export default function PhoneNumberPicker({ value, onChange, label, placeholder, credentials }) {
  const [phoneNumbers, setPhoneNumbers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [useCustom, setUseCustom] = useState(false);

  useEffect(() => {
    if (!credentials?.spaceUrl || !credentials?.projectId || !credentials?.apiToken) return;

    setLoading(true);
    fetch(`/api/signalwire/phone-numbers?spaceUrl=${encodeURIComponent(credentials.spaceUrl)}&projectId=${encodeURIComponent(credentials.projectId)}&apiToken=${encodeURIComponent(credentials.apiToken)}`)
      .then(r => r.json())
      .then(data => {
        if (data.success) setPhoneNumbers(data.phoneNumbers || []);
      })
      .catch(err => console.error('Failed to load phone numbers:', err))
      .finally(() => setLoading(false));
  }, [credentials?.spaceUrl, credentials?.projectId, credentials?.apiToken]);

  const formatNumber = (num) => {
    if (!num) return '';
    const cleaned = num.replace(/\D/g, '');
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    }
    return num;
  };

  // Check if current value matches any known number
  const isKnownNumber = phoneNumbers.some(p => p.phoneNumber === value);
  const showCustomInput = useCustom || (value && !isKnownNumber && phoneNumbers.length > 0);

  return (
    <div>
      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.25rem' }}>
        {label}
      </label>

      {loading ? (
        <p style={{ fontSize: '0.875rem', color: '#888' }}>Loading phone numbers...</p>
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
            style={{
              width: '100%',
              padding: '0.5rem',
              borderRadius: '0.375rem',
              border: '1px solid #d1d5db',
              backgroundColor: 'white',
              fontSize: '0.875rem',
            }}
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
              style={{
                width: '100%',
                padding: '0.5rem',
                borderRadius: '0.375rem',
                border: '1px solid #d1d5db',
                fontSize: '0.875rem',
                marginTop: '0.5rem',
              }}
            />
          )}
        </>
      )}
    </div>
  );
}
