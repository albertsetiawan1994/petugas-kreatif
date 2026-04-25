import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { FileOpener } from '@capacitor-community/file-opener';

const DOWNLOAD_NOTIFICATION_CHANNEL_ID = 'download-files';
let listenersInitialized = false;

type DownloadNotificationPayload = {
  filePath?: string;
  contentType?: string;
};

const isNativeMobile = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() !== 'web';

const ensureNotificationPermission = async () => {
  const permission = await LocalNotifications.checkPermissions();
  if (permission.display === 'granted') return true;

  const requested = await LocalNotifications.requestPermissions();
  return requested.display === 'granted';
};

const ensureNotificationChannel = async () => {
  if (Capacitor.getPlatform() !== 'android') return;

  await LocalNotifications.createChannel({
    id: DOWNLOAD_NOTIFICATION_CHANNEL_ID,
    name: 'Download File',
    description: 'Notifikasi file hasil download screenshot',
    importance: 4,
    visibility: 1,
  });
};

export const openDownloadedFile = async (payload?: DownloadNotificationPayload) => {
  if (!payload?.filePath) return false;

  try {
    await FileOpener.open({
      filePath: payload.filePath,
      contentType: payload.contentType || 'image/png',
      openWithDefault: true,
    });
    return true;
  } catch (error) {
    console.error('Gagal membuka file download:', error);
    return false;
  }
};

export const initializeNativeDownloadNotifications = async () => {
  if (!isNativeMobile() || listenersInitialized) return;

  try {
    await ensureNotificationChannel();
    await LocalNotifications.addListener('localNotificationActionPerformed', async ({ notification }) => {
      await openDownloadedFile(notification.extra as DownloadNotificationPayload);
    });
    listenersInitialized = true;
  } catch (error) {
    console.error('Gagal inisialisasi notifikasi download native:', error);
  }
};

export const notifyDownloadedFile = async ({
  title,
  body,
  filePath,
  contentType = 'image/png',
}: {
  title: string;
  body: string;
  filePath: string;
  contentType?: string;
}) => {
  if (!isNativeMobile()) return false;

  try {
    const granted = await ensureNotificationPermission();
    if (!granted) return false;

    await ensureNotificationChannel();
    await LocalNotifications.schedule({
      notifications: [
        {
          id: Date.now() % 2147483647,
          title,
          body,
          channelId: DOWNLOAD_NOTIFICATION_CHANNEL_ID,
          schedule: { at: new Date(Date.now() + 250) },
          extra: {
            filePath,
            contentType,
          },
        },
      ],
    });
    return true;
  } catch (error) {
    console.error('Gagal mengirim notifikasi download native:', error);
    return false;
  }
};
