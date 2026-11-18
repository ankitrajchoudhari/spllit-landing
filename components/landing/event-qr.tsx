import QRCode from 'qrcode';

/**
 * A QR code drawn as dots, not pixels.
 *
 * The matrix comes from the `qrcode` package; the drawing is ours: round dots
 * for the data and rounded finder eyes in the three corners. Error correction
 * is Q (about a quarter of the code can be lost) to pay for the styling.
 *
 * Verified by decoding screenshots of the live ticket — tilted, on the black
 * board, at 1× and 3×, desktop and phone — with ZXing, the decoder behind
 * most phone scanners. Keep the dots at radius 0.48: at 0.44 decoders start
 * to lose them, so do not shrink them for looks.
 */
export function EventQr({
  value,
  className,
  color = '#0e0e0d',
}: {
  value: string;
  className?: string;
  color?: string;
}) {
  const qr = QRCode.create(value, { errorCorrectionLevel: 'Q' });
  const size = qr.modules.size;
  const on = (row: number, col: number) => qr.modules.get(row, col) === 1;

  // The three 7×7 finder patterns are drawn as shapes, not dots.
  const finders: [number, number][] = [
    [0, 0],
    [0, size - 7],
    [size - 7, 0],
  ];
  const inFinder = (row: number, col: number) =>
    finders.some(([r, c]) => row >= r && row < r + 7 && col >= c && col < c + 7);

  const dots: [number, number][] = [];
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (on(row, col) && !inFinder(row, col)) dots.push([row, col]);
    }
  }

  return (
    <svg
      viewBox={`-1 -1 ${size + 2} ${size + 2}`}
      className={className}
      role="img"
      aria-label="QR code for the registration form"
      shapeRendering="geometricPrecision"
    >
      {dots.map(([row, col]) => (
        <circle key={`${row}-${col}`} cx={col + 0.5} cy={row + 0.5} r={0.48} fill={color} />
      ))}
      {finders.map(([row, col]) => (
        <g key={`f-${row}-${col}`}>
          <rect
            x={col + 0.5}
            y={row + 0.5}
            width={6}
            height={6}
            rx={1.8}
            fill="none"
            stroke={color}
            strokeWidth={1}
          />
          <rect x={col + 2} y={row + 2} width={3} height={3} rx={0.9} fill={color} />
        </g>
      ))}
    </svg>
  );
}
