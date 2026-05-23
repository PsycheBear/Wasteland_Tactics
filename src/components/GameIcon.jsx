import React, { useState } from 'react';

/**
 * Renders a game icon as an <img> sourced from iconImg. The legacy `icon`
 * field used to hold an emoji glyph; the project no longer renders emojis,
 * so it is now used purely as the alt-text and a textual fallback. If the
 * <img> fails to load we hide it instead of showing a broken-image glyph.
 */
export function GameIcon({ iconImg, icon, size = 16, style = {}, className = '' }) {
  const [errored, setErrored] = useState(false);
  if (iconImg && !errored) {
    return (
      <img
        src={iconImg}
        alt={icon || ''}
        className={className}
        onError={() => setErrored(true)}
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
  // No iconImg (or it failed). The icon string is intentionally blank for
  // most data files, so this renders an empty span — a tiny graceful gap
  // instead of an emoji glyph or a broken-image symbol.
  return <span className={className} style={style}>{icon || ''}</span>;
}

/** For use in React.createElement calls (no JSX). Mirrors GameIcon. */
export function createGameIcon(iconImg, icon, size = 16, style = {}) {
  if (iconImg) {
    return React.createElement('img', {
      src: iconImg,
      alt: icon || '',
      onError: (e) => { e.currentTarget.style.display = 'none'; },
      style: {
        width: size,
        height: size,
        objectFit: 'contain',
        verticalAlign: 'middle',
        ...style,
      },
    });
  }
  return icon || '';
}
