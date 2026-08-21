declare const gapi: any;
declare const google: any;

const GOOGLE_API_SCRIPT_URL = 'https://apis.google.com/js/api.js';
const CUSTOM_PICKER_KEY = 'ai_dich_truyen_google_picker_key';

class GooglePickerService {
  private scriptLoadingPromise: Promise<void> | null = null;
  private isPickerLoaded = false;

  private getInitialApiKey(): string {
    if (typeof window === 'undefined') return '';
    const stored = localStorage.getItem(CUSTOM_PICKER_KEY);
    if (stored && stored.trim()) return stored.trim();
    return (import.meta.env.VITE_GOOGLE_PICKER_API_KEY || '').trim();
  }

  public setPickerApiKey(apiKey: string): void {
    const cleanKey = (apiKey || '').trim();
    if (typeof window !== 'undefined') {
      if (cleanKey) {
        localStorage.setItem(CUSTOM_PICKER_KEY, cleanKey);
      } else {
        localStorage.removeItem(CUSTOM_PICKER_KEY);
      }
    }
  }

  public getPickerApiKey(): string {
    return this.getInitialApiKey();
  }

  /**
   * Tải động script Google API (apis.google.com/js/api.js) và nạp module picker
   */
  public async ensurePickerLoaded(): Promise<void> {
    if (this.isPickerLoaded && typeof google !== 'undefined' && google.picker) {
      return;
    }

    if (!this.scriptLoadingPromise) {
      this.scriptLoadingPromise = new Promise<void>((resolve, reject) => {
        if (typeof window === 'undefined') {
          resolve();
          return;
        }

        // Kiểm tra xem script đã có trong DOM chưa
        const existingScript = document.querySelector(`script[src="${GOOGLE_API_SCRIPT_URL}"]`);
        if (existingScript && typeof gapi !== 'undefined') {
          gapi.load('picker', () => {
            this.isPickerLoaded = true;
            resolve();
          });
          return;
        }

        const script = document.createElement('script');
        script.src = GOOGLE_API_SCRIPT_URL;
        script.async = true;
        script.defer = true;
        script.onload = () => {
          if (typeof gapi !== 'undefined') {
            gapi.load('picker', () => {
              this.isPickerLoaded = true;
              resolve();
            });
          } else {
            reject(new Error('Không thể tải Google API library (gapi).'));
          }
        };
        script.onerror = () => {
          reject(new Error('Không thể kết nối đến máy chủ Google Picker API (apis.google.com).'));
        };
        document.body.appendChild(script);
      });
    }

    return this.scriptLoadingPromise;
  }

  /**
   * Mở cửa sổ Google Picker cho phép cộng tác viên chọn thư mục dự án được chia sẻ
   */
  public async openFolderPicker(options: {
    accessToken: string;
    pickerApiKey?: string;
    onFolderSelected: (folderId: string, folderName: string) => void;
    onCancel?: () => void;
  }): Promise<void> {
    const { accessToken, onFolderSelected, onCancel } = options;
    const apiKey = (options.pickerApiKey || this.getPickerApiKey()).trim();

    if (!apiKey) {
      throw new Error(
        'Chưa cấu hình Google Picker API Key. Vui lòng nhập API Key trong phần Cài đặt Đồng bộ.'
      );
    }

    await this.ensurePickerLoaded();

    if (typeof google === 'undefined' || !google.picker) {
      throw new Error('Google Picker API chưa sẵn sàng. Vui lòng thử lại.');
    }

    // Tạo view chọn thư mục
    const view = new google.picker.DocsView(google.picker.ViewId.FOLDERS)
      .setSelectFolderEnabled(true)
      .setMimeTypes('application/vnd.google-apps.folder')
      .setIncludeFolders(true);

    const picker = new google.picker.PickerBuilder()
      .addView(view)
      .setOAuthToken(accessToken)
      .setDeveloperKey(apiKey)
      .setTitle('Chọn thư mục dự án được chia sẻ (AI Dịch Truyện)')
      .setCallback((data: any) => {
        if (data.action === google.picker.Action.PICKED) {
          const doc = data.docs && data.docs[0];
          if (doc && doc.id) {
            onFolderSelected(doc.id, doc.name || 'Thư mục dự án');
          }
        } else if (data.action === google.picker.Action.CANCEL) {
          onCancel?.();
        }
      })
      .build();

    picker.setVisible(true);
  }
}

export const googlePickerService = new GooglePickerService();
