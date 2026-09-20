import { describe, expect, it } from 'vitest';

import { detailPageClasses } from '@/styles/classMaps/product/detail';

/**
 * The social links row sat above the title block with a -40px bottom margin,
 * which dragged the title up over the icons (net -24px against sideInfo's
 * mt-16px, since flex children do not collapse margins). Reported from device
 * testing as "some padding for SM icons".
 */
describe('product detail mobile spacing', () => {
  const videoRow = detailPageClasses.boxes.video.mobile;

  it('does not pull the following block up over the social icons', () => {
    expect(videoRow).not.toMatch(/mb-\[-\d/);
    expect(videoRow).not.toMatch(/-mb-/);
  });

  it('leaves the icon row and the info block clear of each other', () => {
    const sideInfoTop =
      detailPageClasses.boxes.sideInfo.mobile.match(/mt-\[(\d+)px\]/);

    expect(sideInfoTop).not.toBeNull();
    expect(Number(sideInfoTop?.[1])).toBeGreaterThan(0);
  });
});
