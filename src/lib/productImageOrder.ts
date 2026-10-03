// The product form uploads files as `imageUrl<N>` multipart fields, so their
// final disk path is only known server-side. The client names each upload
// `file:<N>` in the order it sends, and every other image by its stored path.
export const fileToken = (index: number) => `file:${index}`;

export interface OrderableImage {
  token: string;
  path: string;
}

export function parseImageOrder(raw: string | undefined): string[] | null {
  if (raw == null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      Array.isArray(parsed) &&
      parsed.every((token) => typeof token === 'string')
    ) {
      return parsed;
    }
  } catch (_) {
    // fall through
  }
  return null;
}

// Rearranges `images` to follow `order`. It only ever permutes the set the
// server already accepted: unknown tokens are skipped and anything the order
// leaves out is appended, so a stale or tampered order can't add or lose an
// image.
export function applyImageOrder(
  images: OrderableImage[],
  order: string[] | null,
): string[] {
  if (order == null) return images.map((image) => image.path);
  const remaining = [...images];
  const result: string[] = [];
  order.forEach((token) => {
    const index = remaining.findIndex((image) => image.token === token);
    if (index === -1) return;
    result.push(remaining[index].path);
    remaining.splice(index, 1);
  });
  return [...result, ...remaining.map((image) => image.path)];
}
