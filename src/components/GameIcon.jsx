import React from 'react';

/**
 * Renders a game icon as an <img> if iconImg path exists, otherwise falls back to emoji text.
 * Used for items, traits, augments, bosses — anywhere an emoji icon was previously rendered in JSX.
 */
export function GameIcon({ iconImg, icon, size = 16, style = {}, className = '' }) {
  if (iconImg) {
    return (
      <img
        src={iconImg}
        alt={icon || ''}
        className={className}
        style={{
          width: size,
          height: size,
          objectFit: 'contain',
          verticalAlign: 'middle',
          imageRendering: size <= 20 ? 'auto' : undefined,
          ...style,
        }}
      />
    );
  }
  return <span className={className} style={style}>{icon}</span>;
}

/** For use in React.createElement calls (no JSX) */
export function createGameIcon(iconImg, icon, size = 16, style = {}) {
  if (iconImg) {
    return React.createElement('img', {
      src: iconImg,
      alt: icon || '',
      style: {
        width: size,
        height: size,
        objectFit: 'contain',
        verticalAlign: 'middle',
        ...style,
      },
    });
  }
  return icon;
}
