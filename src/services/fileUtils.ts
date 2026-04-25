import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';

export const fileUtils = {
  /**
   * Save text content (JSON) to file
   */
  async saveTextFile(filename: string, content: string) {
    if (Capacitor.isNativePlatform()) {
      try {
        // Request permission if needed (handled by OS usually)
        
        // Write to Documents directory
        const result = await Filesystem.writeFile({
          path: filename,
          data: content,
          directory: Directory.Documents,
          encoding: Encoding.UTF8,
        });
        
        return { success: true, path: result.uri };
      } catch (e) {
        console.error('Save file error:', e);
        throw e;
      }
    } else {
      // Web Fallback
      const blob = new Blob([content], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return { success: true, path: 'Downloads' };
    }
  },

  /**
   * Save Base64 image to file
   */
  async saveImageFile(filename: string, base64Data: string) {
    if (Capacitor.isNativePlatform()) {
      try {
        // Remove header if present (data:image/png;base64,)
        const data = base64Data.replace(/^data:image\/\w+;base64,/, "");
        
        const result = await Filesystem.writeFile({
          path: filename,
          data: data,
          directory: Directory.Documents,
          // recursive: true
        });
        
        return { success: true, path: result.uri };
      } catch (e) {
        console.error('Save image error:', e);
        throw e;
      }
    } else {
      // Web Fallback
      const link = document.createElement('a');
      link.download = filename;
      link.href = base64Data;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return { success: true, path: 'Downloads' };
    }
  },

  /**
   * Read text file (for restore)
   * Note: On Android, we usually pick a file via <input type="file"> which gives a Blob/File object.
   * This method is for reading from the filesystem if we had a path, but for restore we usually use the File object directly.
   */
  async readFile(path: string) {
    const result = await Filesystem.readFile({
      path,
      directory: Directory.Documents,
      encoding: Encoding.UTF8,
    });
    return result.data;
  }
};
