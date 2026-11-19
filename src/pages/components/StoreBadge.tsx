import { MobileOs, storeUrlFor } from '@/pages/lib/appDownload';
import { appDownloadClasses } from '@/styles/classMaps/components/appDownload';
import { fontClassName } from '@/styles/theme';

// Drawn inline instead of the stores' badge files: no request to Apple's or
// Google's servers, and it stays sharp on both the light and the dark band.
// The wording is the stores' own, which they keep in English.
const BADGES = {
  ios: { caption: 'Download on the', name: 'App Store' },
  android: { caption: 'GET IT ON', name: 'Google Play' },
} as const;

function AppleLogo({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <path
        fill="currentColor"
        d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"
      />
    </svg>
  );
}

function PlayLogo({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <path
        fill="#00C3FF"
        d="M3.6 1.8 13.6 12 3.6 22.2c-.4-.2-.6-.7-.6-1.2V3c0-.5.2-1 .6-1.2z"
      />
      <path fill="#00E676" d="M3.6 1.8c.4-.2.9-.2 1.4.1l12 6.9-3.4 3.2z" />
      <path fill="#FF3D47" d="M13.6 12 17 15.2 5 22.1c-.5.3-1 .3-1.4.1z" />
      <path fill="#FFC400" d="m17 8.8 3.4 2c.8.5.8 1.9 0 2.4l-3.4 2L13.6 12z" />
    </svg>
  );
}

interface StoreBadgeProps {
  os: MobileOs;
  /** dark: black badge (light backgrounds, dark footer); light: white badge (navy banner). */
  tone?: 'dark' | 'light';
  size?: 'md' | 'sm';
  className?: string;
}

export default function StoreBadge({
  os,
  tone = 'dark',
  size = 'md',
  className = '',
}: StoreBadgeProps) {
  const { caption, name } = BADGES[os];
  const b = appDownloadClasses.badge;
  const s = b.size[size];
  return (
    <a
      href={storeUrlFor(os)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${caption} ${name}`}
      className={`${fontClassName.className} ${b.base} ${s.box} ${b[tone]} ${className}`}
    >
      {os === 'ios' ? (
        <AppleLogo className={s.icon} />
      ) : (
        <PlayLogo className={s.icon} />
      )}
      <span className={b.textCol}>
        <span className={`${b.caption} ${s.caption}`}>{caption}</span>
        <span className={`${b.name} ${s.name}`}>{name}</span>
      </span>
    </a>
  );
}
