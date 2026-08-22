export interface LocalVideoFileLike {
  name: string;
  type: string;
  size: number;
}

export interface ObjectUrlApi {
  createObjectURL(blob: Blob): string;
  revokeObjectURL(url: string): void;
}

const VIDEO_EXTENSION = /\.(?:mp4|m4v|mov|webm|ogv|ogg)$/i;

/** 文件选择器的 MIME 在部分 Windows 浏览器中为空，因此同时校验常见扩展名。 */
export function validateLocalDmsVideo(file: LocalVideoFileLike): string | null {
  if (file.size <= 0) return 'The selected video is empty.';
  if (file.type.startsWith('video/') || VIDEO_EXTENSION.test(file.name)) return null;
  return 'Choose a browser-compatible video file.';
}

/** Object URL 是一次性租约；输入源切换和组件卸载都会走同一个幂等释放入口。 */
export function createObjectUrlLease(blob: Blob, api: ObjectUrlApi = URL) {
  const url = api.createObjectURL(blob);
  let released = false;
  return {
    url,
    release() {
      if (released) return;
      released = true;
      api.revokeObjectURL(url);
    },
  };
}

export function formatLocalVideoSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
