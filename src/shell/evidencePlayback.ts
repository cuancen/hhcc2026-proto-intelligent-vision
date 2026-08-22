import type { DemoTransportState } from './autoDemo';

export interface EvidencePlaybackGate {
  open(transport: DemoTransportState): boolean;
  close(): boolean;
  reset(): void;
}

/** 记录打开 Evidence 前的播放状态，确保只恢复原本正在运行的体验。 */
export function createEvidencePlaybackGate(): EvidencePlaybackGate {
  let opened = false;
  let resumeOnClose = false;

  return {
    open(transport) {
      if (!opened) {
        opened = true;
        resumeOnClose = transport === 'running';
      }
      return resumeOnClose;
    },
    close() {
      if (!opened) return false;
      opened = false;
      const shouldResume = resumeOnClose;
      resumeOnClose = false;
      return shouldResume;
    },
    reset() {
      opened = false;
      resumeOnClose = false;
    },
  };
}
