import iconUrl from '../../../../resources/icon.png'

interface BrandLogoProps {
  className?: string
  size?: number
}

export function BrandLogo({ className, size = 44 }: BrandLogoProps): React.JSX.Element {
  return (
    <img
      className={className ?? 'brand-logo'}
      src={iconUrl}
      alt="Velox"
      width={size}
      height={size}
      draggable={false}
    />
  )
}
