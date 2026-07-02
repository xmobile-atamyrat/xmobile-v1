import { usePlatform } from '@/pages/lib/PlatformContext';
import { Box, Skeleton } from '@mui/material';

// --- ProductCard ---
export function ProductCardSkeleton() {
  const platform = usePlatform();
  return (
    <Box
      sx={{
        width: platform === 'web' ? '280px' : '35vw',
        minHeight: platform === 'web' ? '427px' : '45vw',
        mx: '8px',
        my: platform === 'web' ? '15px' : '8px',
        borderRadius: '10px',
        overflow: 'hidden',
        border: '1px solid #f0f0f0',
        flexShrink: 0,
      }}
    >
      <Skeleton
        variant="rectangular"
        sx={{
          height: platform === 'web' ? '315px' : '45vw',
          width: '100%',
          bgcolor: '#ebebeb',
        }}
        animation="wave"
      />
      <Box sx={{ px: 1, pt: 1 }}>
        <Skeleton
          variant="text"
          width="80%"
          height={platform === 'web' ? 30 : 20}
          animation="wave"
        />
        <Skeleton
          variant="text"
          width="45%"
          height={platform === 'web' ? 30 : 20}
          animation="wave"
        />
      </Box>
    </Box>
  );
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <Box className="flex flex-wrap w-full">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </Box>
  );
}

// --- PromoBanner ---
export function BannerSkeleton() {
  const platform = usePlatform();
  return (
    <Skeleton
      variant="rectangular"
      animation="wave"
      sx={{
        width: '100%',
        aspectRatio: platform === 'web' ? '3 / 1' : '2 / 1',
        borderRadius: platform === 'web' ? '16px' : '12px',
        bgcolor: '#ebebeb',
      }}
    />
  );
}

// --- ProductDetail ---
export function ProductDetailSkeleton() {
  const platform = usePlatform();
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: platform === 'web' ? 'row' : 'column',
        gap: 3,
        p: 2,
        width: '100%',
      }}
    >
      <Skeleton
        variant="rectangular"
        animation="wave"
        sx={{
          width: platform === 'web' ? '50%' : '100%',
          height: platform === 'web' ? 400 : 300,
          borderRadius: 2,
          flexShrink: 0,
        }}
      />
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Skeleton variant="text" width="80%" height={44} animation="wave" />
        <Skeleton variant="text" width="40%" height={36} animation="wave" />
        {[1, 2, 3, 4].map((i) => (
          <Skeleton
            key={i}
            variant="text"
            width="90%"
            height={22}
            animation="wave"
          />
        ))}
        <Skeleton
          variant="rectangular"
          width="100%"
          height={48}
          animation="wave"
          sx={{ borderRadius: 1, mt: 2 }}
        />
      </Box>
    </Box>
  );
}

// --- Cart ---
export function CartItemSkeleton() {
  const platform = usePlatform();
  const imgSize = platform === 'web' ? 80 : 60;
  return (
    <Box
      sx={{
        display: 'flex',
        gap: 2,
        py: 2,
        borderBottom: '1px solid #f0f0f0',
        alignItems: 'center',
      }}
    >
      <Skeleton
        variant="rectangular"
        width={imgSize}
        height={imgSize}
        sx={{ borderRadius: 1, flexShrink: 0 }}
        animation="wave"
      />
      <Box sx={{ flex: 1 }}>
        <Skeleton variant="text" width="70%" height={22} animation="wave" />
        <Skeleton variant="text" width="40%" height={20} animation="wave" />
      </Box>
      <Skeleton
        variant="rectangular"
        width={80}
        height={36}
        sx={{ borderRadius: 1, flexShrink: 0 }}
        animation="wave"
      />
    </Box>
  );
}

export function CartPageSkeleton({ count = 4 }: { count?: number }) {
  return (
    <Box sx={{ width: '100%' }}>
      {Array.from({ length: count }).map((_, i) => (
        <CartItemSkeleton key={i} />
      ))}
    </Box>
  );
}

// --- Orders list ---
export function OrderCardSkeleton() {
  return (
    <Box sx={{ p: 2, mb: 2, borderRadius: 2, border: '1px solid #f0f0f0' }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 1,
        }}
      >
        <Skeleton variant="text" width="45%" height={26} animation="wave" />
        <Skeleton
          variant="rectangular"
          width={76}
          height={24}
          sx={{ borderRadius: 4 }}
          animation="wave"
        />
      </Box>
      <Skeleton variant="text" width="60%" height={20} animation="wave" />
      <Skeleton variant="text" width="30%" height={20} animation="wave" />
    </Box>
  );
}

export function OrderTableRowSkeleton() {
  return (
    <Box
      sx={{
        display: 'flex',
        gap: 2,
        py: 1.5,
        borderBottom: '1px solid #f0f0f0',
      }}
    >
      {[2, 1, 1.5, 1, 1].map((flex, i) => (
        <Skeleton
          key={i}
          variant="text"
          sx={{ flex, height: 22 }}
          animation="wave"
        />
      ))}
    </Box>
  );
}

export function OrderListSkeleton({ count = 5 }: { count?: number }) {
  const platform = usePlatform();
  return (
    <Box sx={{ width: '100%', mt: 1 }}>
      {Array.from({ length: count }).map((_, i) =>
        platform === 'web' ? (
          <OrderTableRowSkeleton key={i} />
        ) : (
          <OrderCardSkeleton key={i} />
        ),
      )}
    </Box>
  );
}

// --- Order detail ---
export function OrderDetailSkeleton() {
  const platform = usePlatform();
  return (
    <Box sx={{ p: platform === 'web' ? 3 : 2, width: '100%' }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
        }}
      >
        <Skeleton variant="text" width="40%" height={38} animation="wave" />
        <Skeleton
          variant="rectangular"
          width={100}
          height={32}
          sx={{ borderRadius: 4 }}
          animation="wave"
        />
      </Box>
      {[1, 2, 3].map((section) => (
        <Box key={section} sx={{ mb: 3 }}>
          <Skeleton
            variant="text"
            width="30%"
            height={28}
            animation="wave"
            sx={{ mb: 1 }}
          />
          <Skeleton variant="text" width="70%" height={20} animation="wave" />
          <Skeleton variant="text" width="55%" height={20} animation="wave" />
        </Box>
      ))}
      {[1, 2, 3, 4].map((i) => (
        <Skeleton
          key={i}
          variant="rectangular"
          width="100%"
          height={44}
          animation="wave"
          sx={{ mb: 1, borderRadius: 1 }}
        />
      ))}
    </Box>
  );
}

// --- Profile ---
export function ProfileSkeleton() {
  const platform = usePlatform();
  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: platform === 'web' ? 600 : '100%',
        mx: 'auto',
        p: 2,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Skeleton variant="circular" width={72} height={72} animation="wave" />
        <Box sx={{ flex: 1 }}>
          <Skeleton variant="text" width="60%" height={28} animation="wave" />
          <Skeleton variant="text" width="80%" height={20} animation="wave" />
        </Box>
      </Box>
      {Array.from({ length: 6 }).map((_, i) => (
        <Box key={i} sx={{ mb: 0.5 }}>
          <Skeleton
            variant="rectangular"
            width="100%"
            height={52}
            animation="wave"
            sx={{ borderRadius: 1 }}
          />
        </Box>
      ))}
    </Box>
  );
}
