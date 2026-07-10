import React from 'react';

interface ImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string; // original image path (png/jpg/jpeg)
  alt: string;
  blurDataURL?: string; // optional small blurred placeholder data URL
  className?: string;
  sizes?: string;
}

export function Image({ src, alt, blurDataURL, className = '', sizes, ...props }: ImageProps) {
  // derive webp and avif variants if original has an extension we can replace
  const srcLower = src.toLowerCase();
  let webp = '';
  let avif = '';
  const match = srcLower.match(/(.+)\.(png|jpg|jpeg)$/);
  if (match) {
    const base = match[1];
    webp = `${base}.webp`;
    avif = `${base}.avif`;
  }

  const imgStyle: React.CSSProperties = blurDataURL
    ? {
        backgroundImage: `url(${blurDataURL})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        filter: 'blur(6px)',
      }
    : {};

  return (
    <picture>
      {avif && <source srcSet={avif} type="image/avif" />}
      {webp && <source srcSet={webp} type="image/webp" />}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        className={className}
        sizes={sizes}
        style={imgStyle}
        {...props}
      />
    </picture>
  );
}
