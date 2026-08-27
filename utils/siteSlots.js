/* ==========================================================================
   SITE SLOTS — single source of truth for every editable element on the
   landing page. The admin "Site Editor" renders its form from this list,
   and GET /api/site/content returns overrides keyed by the same ids.

   Dynamic slots (saved from the inline editor, validated by pattern):
     service.{n}.title|desc          — services cards
     stories.{n}.title|couple|location|date|excerpt
     testi.{n}.quote|names|location  — testimonials
     story.{slug}.title|couple|location|date|excerpt|desc1|desc2
   ========================================================================== */

const TEXT_SLOTS = [
  { key: 'brand_name',         label: 'Brand name (top bar)',            type: 'text',     group: 'Brand & Hero' },
  { key: 'hero_kicker',        label: 'Hero — eyebrow line',             type: 'text',     group: 'Brand & Hero' },
  { key: 'hero_title_1',       label: 'Hero — headline line 1',          type: 'text',     group: 'Brand & Hero' },
  { key: 'hero_title_2',       label: 'Hero — headline line 2 (HTML ok)', type: 'html',    group: 'Brand & Hero' },
  { key: 'hero_lede',          label: 'Hero — supporting text',          type: 'textarea', group: 'Brand & Hero' },
  { key: 'hero_btn_primary',   label: 'Hero — primary button',           type: 'text',     group: 'Brand & Hero' },
  { key: 'hero_btn_secondary', label: 'Hero — secondary button',         type: 'text',     group: 'Brand & Hero' },

  { key: 'about_kicker',   label: 'About — eyebrow',            type: 'text',     group: 'About' },
  { key: 'about_heading',  label: 'About — heading',            type: 'text',     group: 'About' },
  { key: 'about_bio_1',    label: 'About — bio paragraph 1',    type: 'textarea', group: 'About' },
  { key: 'about_bio_2',    label: 'About — bio paragraph 2',    type: 'textarea', group: 'About' },
  { key: 'about_quote',    label: 'About — philosophy quote',   type: 'textarea', group: 'About' },
  { key: 'about_fact_1',   label: 'About — fact 1 (Experience)', type: 'text',    group: 'About' },
  { key: 'about_fact_2',   label: 'About — fact 2 (Location)',  type: 'text',     group: 'About' },
  { key: 'about_fact_3',   label: 'About — fact 3 (Specialties)', type: 'text',   group: 'About' },
  { key: 'about_caption',  label: 'About — portrait caption',   type: 'text',     group: 'About' },

  { key: 'sec_services_kicker', label: 'Services section — eyebrow',     type: 'text', group: 'Section headings' },
  { key: 'sec_services_title',  label: 'Services section — title',       type: 'text', group: 'Section headings' },
  { key: 'sec_stories_kicker',  label: 'Stories section — eyebrow',      type: 'text', group: 'Section headings' },
  { key: 'sec_stories_title',   label: 'Stories section — title',        type: 'text', group: 'Section headings' },
  { key: 'sec_gallery_kicker',  label: 'Gallery section — eyebrow',      type: 'text', group: 'Section headings' },
  { key: 'sec_gallery_title',   label: 'Gallery section — title',        type: 'text', group: 'Section headings' },
  { key: 'sec_wall_kicker',     label: 'Photo wall section — eyebrow',   type: 'text', group: 'Section headings' },
  { key: 'sec_wall_title',      label: 'Photo wall section — title',     type: 'text', group: 'Section headings' },
  { key: 'sec_testi_kicker',    label: 'Testimonials section — eyebrow', type: 'text', group: 'Section headings' },
  { key: 'sec_testi_title',     label: 'Testimonials section — title',   type: 'text', group: 'Section headings' },

  { key: 'contact_kicker',  label: 'Contact — eyebrow',        type: 'text',     group: 'Contact' },
  { key: 'contact_heading', label: 'Contact — heading',        type: 'text',     group: 'Contact' },
  { key: 'contact_intro',   label: 'Contact — intro text',     type: 'textarea', group: 'Contact' },
  { key: 'contact_email',   label: 'Contact — email address',  type: 'text',     group: 'Contact' },
  { key: 'contact_phone',   label: 'Contact — phone number',   type: 'text',     group: 'Contact' },
  { key: 'contact_studio',  label: 'Contact — studio address', type: 'text',     group: 'Contact' },

  { key: 'cta_heading', label: 'CTA — heading',          type: 'text',     group: 'CTA & Footer' },
  { key: 'cta_sub',     label: 'CTA — supporting text',  type: 'textarea', group: 'CTA & Footer' },
  { key: 'cta_button',  label: 'CTA — button label',     type: 'text',     group: 'CTA & Footer' },
  { key: 'footer_note', label: 'Footer — note',          type: 'text',     group: 'CTA & Footer' }
];

const MEDIA_SLOTS = [
  { slot: 'hero_video',     label: 'Hero — background video',      accept: 'video/mp4,video/webm', resourceType: 'video', group: 'Key visuals',
    defaultUrl: 'https://pub-591f6d27df904c329b1a0501db2e5be3.r2.dev/wedding/video/hero-video-desktop.mp4' },
  { slot: 'hero_poster',    label: 'Hero — poster/fallback image', accept: 'image/*', resourceType: 'image', group: 'Key visuals',
    defaultUrl: 'https://pub-591f6d27df904c329b1a0501db2e5be3.r2.dev/wedding/images/1519741497674-611481863552-2000.jpg' },
  { slot: 'about_portrait', label: 'About — portrait',             accept: 'image/*', resourceType: 'image', group: 'Key visuals',
    defaultUrl: 'https://pub-591f6d27df904c329b1a0501db2e5be3.r2.dev/wedding/images/1554080353-a576cf803bda-1000.jpg' },
  { slot: 'cta_bg',         label: 'CTA — background image',       accept: 'image/*', resourceType: 'image', group: 'Key visuals',
    defaultUrl: 'https://pub-591f6d27df904c329b1a0501db2e5be3.r2.dev/wedding/images/1465495976277-4387d4b0b4c6-2000.jpg' },
  { slot: 'service_1',  label: 'Services — card 1 image',  accept: 'image/*', resourceType: 'image', group: 'Services',
    defaultUrl: 'https://pub-591f6d27df904c329b1a0501db2e5be3.r2.dev/wedding/images/1511285560929-80b456fea0bc-900.jpg' },
  { slot: 'service_2',  label: 'Services — card 2 image',  accept: 'image/*', resourceType: 'image', group: 'Services',
    defaultUrl: 'https://pub-591f6d27df904c329b1a0501db2e5be3.r2.dev/wedding/images/1532712938310-34cb3982ef74-900.jpg' },
  { slot: 'service_3',  label: 'Services — card 3 image',  accept: 'image/*', resourceType: 'image', group: 'Services',
    defaultUrl: 'https://pub-591f6d27df904c329b1a0501db2e5be3.r2.dev/wedding/images/1529634806980-85c3dd6d34ac-900.jpg' },
  { slot: 'service_4',  label: 'Services — card 4 image',  accept: 'image/*', resourceType: 'image', group: 'Services',
    defaultUrl: 'https://pub-591f6d27df904c329b1a0501db2e5be3.r2.dev/wedding/images/1508214751196-bcfd4ca60f91-900.jpg' },
  { slot: 'service_5',  label: 'Services — card 5 image',  accept: 'image/*', resourceType: 'image', group: 'Services',
    defaultUrl: 'https://pub-591f6d27df904c329b1a0501db2e5be3.r2.dev/wedding/images/1502920917128-1aa500764cbd-900.jpg' },
  { slot: 'service_6',  label: 'Services — card 6 image',  accept: 'image/*', resourceType: 'image', group: 'Services',
    defaultUrl: 'https://pub-591f6d27df904c329b1a0501db2e5be3.r2.dev/wedding/images/1544078751-58fee2d8a03b-900.jpg' },
  { slot: 'service_7',  label: 'Services — card 7 image',  accept: 'image/*', resourceType: 'image', group: 'Services',
    defaultUrl: 'https://pub-591f6d27df904c329b1a0501db2e5be3.r2.dev/wedding/images/1591604466107-ec97de577aff-900.jpg' },
  { slot: 'service_8',  label: 'Services — card 8 image',  accept: 'image/*', resourceType: 'image', group: 'Services',
    defaultUrl: 'https://pub-591f6d27df904c329b1a0501db2e5be3.r2.dev/wedding/images/1494955870715-979ca4f13bf0-900.jpg' },
  { slot: 'story_1',    label: 'Stories — story 1 cover',  accept: 'image/*', resourceType: 'image', group: 'Stories',
    defaultUrl: 'https://pub-591f6d27df904c329b1a0501db2e5be3.r2.dev/wedding/images/1583939003579-730e3918a45a-1400.jpg' },
  { slot: 'story_2',    label: 'Stories — story 2 cover',  accept: 'image/*', resourceType: 'image', group: 'Stories',
    defaultUrl: 'https://pub-591f6d27df904c329b1a0501db2e5be3.r2.dev/wedding/images/1469371670807-013ccf25f16a-1400.jpg' },
  { slot: 'story_3',    label: 'Stories — story 3 cover',  accept: 'image/*', resourceType: 'image', group: 'Stories',
    defaultUrl: 'https://pub-591f6d27df904c329b1a0501db2e5be3.r2.dev/wedding/images/1522413452208-996ff3f3e740-1400.jpg' },
  { slot: 'story_4',    label: 'Stories — story 4 cover',  accept: 'image/*', resourceType: 'image', group: 'Stories',
    defaultUrl: 'https://pub-591f6d27df904c329b1a0501db2e5be3.r2.dev/wedding/images/1537633552985-df8429e8048b-1400.jpg' },
  { slot: 'story_5',    label: 'Stories — story 5 cover',  accept: 'image/*', resourceType: 'image', group: 'Stories',
    defaultUrl: 'https://pub-591f6d27df904c329b1a0501db2e5be3.r2.dev/wedding/images/1515934751635-c81c6bc9a2d8-1400.jpg' },
  { slot: 'gallery_1',  label: 'Gallery — photo 1',  accept: 'image/*', resourceType: 'image', group: 'Gallery',
    defaultUrl: 'https://pub-591f6d27df904c329b1a0501db2e5be3.r2.dev/wedding/images/1519741497674-611481863552-1100.jpg' },
  { slot: 'gallery_2',  label: 'Gallery — photo 2',  accept: 'image/*', resourceType: 'image', group: 'Gallery',
    defaultUrl: 'https://pub-591f6d27df904c329b1a0501db2e5be3.r2.dev/wedding/images/1606216794074-735e91aa2c92-1200.jpg' },
  { slot: 'gallery_3',  label: 'Gallery — photo 3',  accept: 'image/*', resourceType: 'image', group: 'Gallery',
    defaultUrl: 'https://pub-591f6d27df904c329b1a0501db2e5be3.r2.dev/wedding/images/1509927083803-4bd519298ac4-1100.jpg' },
  { slot: 'gallery_4',  label: 'Gallery — photo 4',  accept: 'image/*', resourceType: 'image', group: 'Gallery',
    defaultUrl: 'https://pub-591f6d27df904c329b1a0501db2e5be3.r2.dev/wedding/images/1537633552985-df8429e8048b-1400.jpg' },
  { slot: 'gallery_5',  label: 'Gallery — photo 5',  accept: 'image/*', resourceType: 'image', group: 'Gallery',
    defaultUrl: 'https://pub-591f6d27df904c329b1a0501db2e5be3.r2.dev/wedding/images/1519225421980-715cb0215aed-1300.jpg' },
  { slot: 'gallery_6',  label: 'Gallery — photo 6',  accept: 'image/*', resourceType: 'image', group: 'Gallery',
    defaultUrl: 'https://pub-591f6d27df904c329b1a0501db2e5be3.r2.dev/wedding/images/1508214751196-bcfd4ca60f91-900.jpg' },
  { slot: 'gallery_7',  label: 'Gallery — photo 7',  accept: 'image/*', resourceType: 'image', group: 'Gallery',
    defaultUrl: 'https://pub-591f6d27df904c329b1a0501db2e5be3.r2.dev/wedding/images/1591604466107-ec97de577aff-900.jpg' },
  { slot: 'gallery_8',  label: 'Gallery — photo 8',  accept: 'image/*', resourceType: 'image', group: 'Gallery',
    defaultUrl: 'https://pub-591f6d27df904c329b1a0501db2e5be3.r2.dev/wedding/images/1529634806980-85c3dd6d34ac-900.jpg' },
  { slot: 'gallery_9',  label: 'Gallery — photo 9',  accept: 'image/*', resourceType: 'image', group: 'Gallery',
    defaultUrl: 'https://pub-591f6d27df904c329b1a0501db2e5be3.r2.dev/wedding/images/1494955870715-979ca4f13bf0-900.jpg' },
  { slot: 'gallery_10', label: 'Gallery — photo 10', accept: 'image/*', resourceType: 'image', group: 'Gallery',
    defaultUrl: 'https://pub-591f6d27df904c329b1a0501db2e5be3.r2.dev/wedding/images/1519011985187-444d62641929-1200.jpg' },
  { slot: 'gallery_11', label: 'Gallery — photo 11', accept: 'image/*', resourceType: 'image', group: 'Gallery',
    defaultUrl: 'https://pub-591f6d27df904c329b1a0501db2e5be3.r2.dev/wedding/images/1519671482749-fd09be7ccebf-900.jpg' },
  { slot: 'gallery_12', label: 'Gallery — photo 12', accept: 'image/*', resourceType: 'image', group: 'Gallery',
    defaultUrl: 'https://pub-591f6d27df904c329b1a0501db2e5be3.r2.dev/wedding/images/1469371670807-013ccf25f16a-1300.jpg' },
  { slot: 'wall_1',     label: 'Photo wall — 1', accept: 'image/*', resourceType: 'image', group: 'Photo wall',
    defaultUrl: 'https://pub-591f6d27df904c329b1a0501db2e5be3.r2.dev/wedding/images/1511285560929-80b456fea0bc-1000.jpg' },
  { slot: 'wall_2',     label: 'Photo wall — 2', accept: 'image/*', resourceType: 'image', group: 'Photo wall',
    defaultUrl: 'https://pub-591f6d27df904c329b1a0501db2e5be3.r2.dev/wedding/images/1520854221256-17451cc331bf-1200.jpg' },
  { slot: 'wall_3',     label: 'Photo wall — 3', accept: 'image/*', resourceType: 'image', group: 'Photo wall',
    defaultUrl: 'https://pub-591f6d27df904c329b1a0501db2e5be3.r2.dev/wedding/images/1595407753234-0882f1e77954-1200.jpg' },
  { slot: 'wall_4',     label: 'Photo wall — 4', accept: 'image/*', resourceType: 'image', group: 'Photo wall',
    defaultUrl: 'https://pub-591f6d27df904c329b1a0501db2e5be3.r2.dev/wedding/images/1465495976277-4387d4b0b4c6-1400.jpg' },
  { slot: 'wall_5',     label: 'Photo wall — 5', accept: 'image/*', resourceType: 'image', group: 'Photo wall',
    defaultUrl: 'https://pub-591f6d27df904c329b1a0501db2e5be3.r2.dev/wedding/images/1525258946800-98cfd641d0de-1200.jpg' },
  { slot: 'wall_6',     label: 'Photo wall — 6', accept: 'image/*', resourceType: 'image', group: 'Photo wall',
    defaultUrl: 'https://pub-591f6d27df904c329b1a0501db2e5be3.r2.dev/wedding/images/1550005809-91ad75fb315f-1200.jpg' },
  { slot: 'wall_7',     label: 'Photo wall — 7', accept: 'image/*', resourceType: 'image', group: 'Photo wall',
    defaultUrl: 'https://pub-591f6d27df904c329b1a0501db2e5be3.r2.dev/wedding/images/1520390138845-fd2d229dd553-1200.jpg' },
  { slot: 'wall_8',     label: 'Photo wall — 8', accept: 'image/*', resourceType: 'image', group: 'Photo wall',
    defaultUrl: 'https://pub-591f6d27df904c329b1a0501db2e5be3.r2.dev/wedding/images/1546032996-6dfacbacbf3f-1200.jpg' },
  { slot: 'wall_9',     label: 'Photo wall — 9', accept: 'image/*', resourceType: 'image', group: 'Photo wall',
    defaultUrl: 'https://pub-591f6d27df904c329b1a0501db2e5be3.r2.dev/wedding/images/1522413452208-996ff3f3e740-1000.jpg' }
];

/* validation helpers for dynamic inline-editor slots */
const TEXT_KEY_RE = [
  /^story\.[a-z0-9\-]+\.(title|couple|location|date|excerpt|desc1|desc2)$/,
  /^service\.\d+\.(title|desc)$/,
  /^testi\.\d+\.(quote|names|location)$/
];
const MEDIA_KEY_RE = /^story\.[a-z0-9\-]+\.(cover|img1|img2|img3)$/;

function isValidTextKey(key) {
  if (TEXT_SLOTS.some(s => s.key === key)) return true;
  return TEXT_KEY_RE.some(re => re.test(key));
}

function isValidMediaSlot(slot) {
  if (MEDIA_SLOTS.some(m => m.slot === slot)) return true;
  return MEDIA_KEY_RE.test(slot);
}

module.exports = { TEXT_SLOTS, MEDIA_SLOTS, isValidTextKey, isValidMediaSlot };
