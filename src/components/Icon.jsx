const paths = {
  barbell: (
    <>
      <path d="M6.5 6.5v11" />
      <path d="M17.5 6.5v11" />
      <path d="M3.5 9v6" />
      <path d="M20.5 9v6" />
      <path d="M6.5 12h11" />
    </>
  ),
  roller: (
    <>
      <rect x="3" y="8" width="18" height="8" rx="4" />
      <path d="M8 8v8" />
      <path d="M16 8v8" />
      <path d="M1.5 12h1.5" />
      <path d="M21 12h1.5" />
    </>
  ),
  mobility: (
    <>
      <circle cx="12" cy="4.5" r="2" />
      <path d="M12 7v6" />
      <path d="M5 9.5c4 .5 10 .5 14 0" />
      <path d="M12 13l-4 7" />
      <path d="M12 13l4 7" />
    </>
  ),
  anatomy: (
    <>
      <circle cx="12" cy="4" r="2" />
      <path d="M8 8.5h8l1.5 5-2 .8L14.5 21h-5l-1-6.7-2-.8z" />
      <path d="M12 9v5" />
    </>
  ),
  chevron: <path d="M9 5l7 7-7 7" />,
  arrow: (
    <>
      <path d="M5 12h14" />
      <path d="M13 6l6 6-6 6" />
    </>
  ),
  back: <path d="M15 5l-7 7 7 7" />,
  wifiOff: (
    <>
      <path d="M2 2l20 20" />
      <path d="M8.5 16.4a5 5 0 0 1 7 0" />
      <path d="M5 12.9a10 10 0 0 1 5.2-2.7" />
      <path d="M19 12.9a10 10 0 0 0-2-1.5" />
      <path d="M12 20h.01" />
    </>
  )
};

export default function Icon({ name, size = 24 }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}
