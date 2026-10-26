// useIsPhone: true on small screens (under 768px), so pages can show cards instead of wide tables.
import { useEffect, useState } from 'react';

const PHONE = '(max-width: 767.98px)';

export function useIsPhone() {
  const [phone, setPhone] = useState(() => typeof window !== 'undefined' && window.matchMedia(PHONE).matches);
  useEffect(() => {
    const mq = window.matchMedia(PHONE);
    const on = () => setPhone(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return phone;
}
