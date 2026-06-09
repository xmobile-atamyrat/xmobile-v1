import { useEffect, useState } from 'react';

interface VisualViewportState {
  height: number;
  offsetTop: number;
}

export function useVisualViewport(): VisualViewportState | null {
  const [viewport, setViewport] = useState<VisualViewportState | null>(null);

  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (!vv) return undefined;

    const update = () => {
      setViewport({ height: vv.height, offsetTop: vv.offsetTop });
    };

    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    update();

    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);

  return viewport;
}
