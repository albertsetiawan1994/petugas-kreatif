export type AlertType = 'error' | 'success' | 'info';

export const showAlert = (message: string, type: AlertType = 'error') => {
  const event = new CustomEvent('app-alert', { detail: { message, type } });
  window.dispatchEvent(event);
};
