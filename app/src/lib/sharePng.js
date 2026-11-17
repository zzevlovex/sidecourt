// Turns a share card (SVG text) into a PNG file on this device. No server.

export const svgUrl = (svg) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

// Draws the card on a canvas at full size and returns the PNG (transparency is kept).
export async function cardToPng(card) {
  const img = new Image();
  img.src = svgUrl(card.svg);
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = card.width;
  canvas.height = card.height;
  canvas.getContext('2d').drawImage(img, 0, 0, card.width, card.height);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('This browser could not make the image.');
  return new File([blob], card.file, { type: 'image/png' });
}

export function download(file) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// True where the phone's share sheet accepts images (Instagram, Messenger, ...).
export const canShareFiles = () =>
  typeof navigator !== 'undefined' && Boolean(navigator.canShare?.({ files: [new File([''], 'x.png', { type: 'image/png' })] }));
