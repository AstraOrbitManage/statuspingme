import QRCodeSVG from 'react-qr-code';
import { cn } from '../../lib/utils';

interface QRCodeProps {
  value: string;
  size?: number;
  className?: string;
}

export function QRCode({ value, size = 128, className }: QRCodeProps) {
  return (
    <div className={cn('inline-flex items-center justify-center p-3 bg-white rounded-lg border border-gray-200', className)}>
      <QRCodeSVG
        value={value}
        size={size}
        level="M"
        bgColor="#ffffff"
        fgColor="#1f2937"
      />
    </div>
  );
}
