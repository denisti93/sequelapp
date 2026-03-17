import { environment } from '../../../environments/environment';

const apiUrl = environment.apiUrl.replace(/\/+$/, '');

export function toAbsoluteProfileImageUrl(imageUrl?: string | null): string | null {
  if (!imageUrl) {
    return null;
  }

  if (imageUrl.startsWith('data:')) {
    return imageUrl;
  }

  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    try {
      const parsed = new URL(imageUrl);
      const path = decodeURIComponent(parsed.pathname || '');
      const filename = path.split('/').pop() || '';

      // Compatibilidade com imagens antigas salvas como URL direta do S3.
      if (path.includes('/profile_image/') && /^[A-Za-z0-9._-]+$/.test(filename)) {
        return `${apiUrl}/uploads/profiles/${filename}`;
      }
    } catch {
      // Se a URL vier inválida, devolve como está e deixa o browser tentar carregar.
    }

    return imageUrl;
  }

  const normalizedPath = imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`;
  return `${apiUrl}${normalizedPath}`;
}
