import { useEffect, useState, type CSSProperties } from 'react';
import type { User } from '@supabase/supabase-js';
import { getUserDisplayName, getUserPhotoUrls } from '../services/supabaseAuthService';

interface UserAvatarProps {
  user: User;
  size: number;
  style?: CSSProperties;
}

export default function UserAvatar({ user, size, style }: UserAvatarProps) {
  const photoUrls = getUserPhotoUrls(user);
  const photoUrlsKey = photoUrls.join('|');
  const [failedUrlCount, setFailedUrlCount] = useState(0);
  const displayName = getUserDisplayName(user) || user.email || 'User';
  const imageUrl = photoUrls[failedUrlCount];

  useEffect(() => {
    setFailedUrlCount(0);
  }, [user.id, photoUrlsKey]);

  if (!imageUrl) {
    return (
      <span
        aria-label={displayName}
        title={displayName}
        style={{
          width: size,
          height: size,
          minWidth: size,
          borderRadius: '50%',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#334155',
          color: '#e2e8f0',
          fontSize: Math.max(10, Math.round(size * 0.42)),
          fontWeight: 700,
          overflow: 'hidden',
          ...style,
        }}
      >
        {displayName.charAt(0).toUpperCase()}
      </span>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={displayName}
      referrerPolicy="no-referrer"
      style={{ width: size, height: size, minWidth: size, borderRadius: '50%', objectFit: 'cover', ...style }}
      onError={() => setFailedUrlCount((current) => current + 1)}
    />
  );
}
