// Avatar registry — all available avatars in the app
// Each has a unique `id`, a `name` (for display), and rendering info.

// 11 friend cartoon slots (image files go in public/avatars/friends/)
export const FRIEND_AVATARS = [
  { id: 'friend:dhanush', name: 'Dhanush', file: '/avatars/friends/dhanush.jpeg' },
  { id: 'friend:deepak', name: 'Deepak', file: '/avatars/friends/deepak.jpeg' },
  { id: 'friend:rohith', name: 'Rohith', file: '/avatars/friends/rohith.jpeg' },
  { id: 'friend:pramod', name: 'Pramod', file: '/avatars/friends/pramod.jpeg' },
  { id: 'friend:chaitanya', name: 'Chaitanya', file: '/avatars/friends/chaitanya.jpeg' },
  { id: 'friend:pk', name: 'PK', file: '/avatars/friends/pk.jpeg' },
  { id: 'friend:hari', name: 'Hari', file: '/avatars/friends/hari.jpeg' },
  { id: 'friend:bhavana', name: 'Bhavana', file: '/avatars/friends/bhavana.jpeg' },
  { id: 'friend:sindhu', name: 'Sindhu', file: '/avatars/friends/sindhu.jpeg', secretFlipFile: '/avatars/friends/sindhu-secret.png' },
  { id: 'friend:kavya', name: 'Kavya', file: '/avatars/friends/kavya.jpeg' },
  { id: 'friend:mani', name: 'Mani', file: '/avatars/friends/mani.jpeg' },
];

// Secret avatars — not shown in the picker by default. Unlocked by:
//   1) typing a matching name (case-insensitive, exact match), OR
//   2) triple-tapping the "Friends" label in the picker
// Once unlocked, behaves like a normal friend avatar.
export const SECRET_AVATARS = [
  {
    id: 'friend:sidhu',
    name: 'Sidhu',
    file: '/avatars/friends/sidhu.png',
    // Exact match (case-insensitive, trimmed) — won't trigger on partial matches
    triggers: ['sudarshan', 'sidhu', 'sid'],
  },
];

// Returns the secret avatar matching a name, or null
export function findSecretAvatarByName(name) {
  if (!name) return null;
  const normalized = name.toLowerCase().trim();
  return SECRET_AVATARS.find((a) =>
    (a.triggers || []).some((t) => t.toLowerCase() === normalized)
  ) || null;
}
// DiceBear cartoon avatars (loaded from the DiceBear API)
// 8 adventurer + 8 avataaars + 8 micah = 24 total
const ADVENTURER_SEEDS = ['fox', 'tiger', 'panda', 'rabbit', 'lion', 'otter', 'koala', 'bear'];
const AVATAAARS_SEEDS = ['ace', 'blaze', 'jet', 'nova', 'orbit', 'rex', 'sage', 'zen'];
const MICAH_SEEDS = ['sky', 'mint', 'rose', 'amber', 'coral', 'jade', 'plum', 'wave'];

function dicebearUrl(style, seed) {
  return `https://api.dicebear.com/9.x/${style}/svg?seed=${seed}&radius=50`;
}

export const DICEBEAR_AVATARS = [
  ...ADVENTURER_SEEDS.map((seed) => ({
    id: `dicebear:adventurer:${seed}`,
    name: seed,
    style: 'adventurer',
    url: dicebearUrl('adventurer', seed),
  })),
  ...AVATAAARS_SEEDS.map((seed) => ({
    id: `dicebear:avataaars:${seed}`,
    name: seed,
    style: 'avataaars',
    url: dicebearUrl('avataaars', seed),
  })),
  ...MICAH_SEEDS.map((seed) => ({
    id: `dicebear:micah:${seed}`,
    name: seed,
    style: 'micah',
    url: dicebearUrl('micah', seed),
  })),
];

// All avatars in one list (friends first, then secrets, then DiceBear)
// Secrets included so getAvatarById works for other players seeing them
export const ALL_AVATARS = [...FRIEND_AVATARS, ...SECRET_AVATARS, ...DICEBEAR_AVATARS];

// Lookup by id
export function getAvatarById(id) {
  if (!id) return null;
  return ALL_AVATARS.find((a) => a.id === id) || null;
}

// Get a random avatar from the gallery, excluding any already used
export function pickRandomAvatar(excludeIds = []) {
  const excluded = new Set(excludeIds);
  const available = DICEBEAR_AVATARS.filter((a) => !excluded.has(a.id));
  if (available.length === 0) return DICEBEAR_AVATARS[0];
  return available[Math.floor(Math.random() * available.length)];
}

// Get display name + image info for a given avatar id, with fallback
export function resolveAvatar(id) {
  const av = getAvatarById(id);
  if (!av) return { type: 'fallback', initial: '?' };
  if (av.id.startsWith('friend:')) {
    return {
      type: 'image',
      src: av.file,
      secretFlipSrc: av.secretFlipFile,
      name: av.name,
      isFriend: true
    };
  }
  return { type: 'image', src: av.url, name: av.name, style: av.style };
}

// Color for friend placeholder backgrounds (cycled by index)
export const FRIEND_PLACEHOLDER_COLORS = [
  '#f5d989', '#7ab8d4', '#c47ab8', '#b8c47a',
  '#e89e7e', '#9ec48d', '#d4a87a', '#8ec4b8',
  '#d47a9e', '#7ad4c4', '#c4a87a',
];