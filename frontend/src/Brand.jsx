export const APP_NAME = 'SplitR';

function Brand({ size = 36 }) {
  return (
    <span className="brand">
      <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
        <rect width="40" height="40" rx="10" fill="#4f46e5" />
        <circle cx="15" cy="20" r="8.5" fill="#ffffff" fillOpacity="0.95" />
        <circle cx="25" cy="20" r="8.5" fill="#a5b4fc" fillOpacity="0.9" />
      </svg>
      <span>{APP_NAME}</span>
    </span>
  );
}

export default Brand;
