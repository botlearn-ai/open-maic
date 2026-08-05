import { describe, expect, it } from 'vitest';

import { DEFAULT_TTS_VOICES, TTS_PROVIDERS } from '@/lib/audio/constants';

describe('audio provider defaults', () => {
  it('uses the configured Taiwanese female Doubao voice by default', () => {
    const voiceId = 'zh_female_xiaohe_uranus_bigtts';

    expect(DEFAULT_TTS_VOICES['doubao-tts']).toBe(voiceId);
    expect(TTS_PROVIDERS['doubao-tts'].voices.some((voice) => voice.id === voiceId)).toBe(true);
  });
});
