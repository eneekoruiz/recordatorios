declare module 'lucide-react';

declare module 'qrcode' {
  export interface QRCodeToDataURLOptions {
    margin?: number;
    width?: number;
    scale?: number;
    color?: {
      dark?: string;
      light?: string;
    };
  }
  export function toDataURL(text: string, options?: QRCodeToDataURLOptions): Promise<string>;
  export function toString(text: string, options?: Record<string, unknown>): Promise<string>;
  export function toCanvas(canvas: HTMLCanvasElement, text: string, options?: Record<string, unknown>): Promise<void>;
}
