import { useTheme } from '../../theme/context';

interface BrandLogoProps {
  size?: number;
  className?: string;
}

export function BrandLogo({ size = 16, className = '' }: BrandLogoProps) {
  const { theme } = useTheme();
  const src = theme === 'dark' ? '/logo/icon-dark.svg' : '/logo/icon-light.svg';

  return <img src={src} alt="Claw Insights logo" width={size} height={size} className={className} />;
}
