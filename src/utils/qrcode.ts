/**
 * 二维码生成工具
 * 使用 qrcode 库生成真实的二维码
 */

import QRCode from 'qrcode';

export async function generateQRCodeDataURL(text: string, size: number = 300): Promise<string> {
  try {
    // 使用 qrcode 库生成真实的二维码
    const dataURL = await QRCode.toDataURL(text, {
      width: size,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      errorCorrectionLevel: 'M'
    });
    
    return dataURL;
  } catch (error) {
    console.error('生成二维码失败:', error);
    return '';
  }
}

/**
 * 生成连接信息文本（URL格式）
 * 格式：http://IP:PORT/#/pages/lan/connect/connect?ip=xxx&port=xxx&roomCode=xxx
 */
export function generateConnectionText(ip: string, port: string, roomCode: string): string {
  // 生成连接参数
  const params = new URLSearchParams({
    ip,
    port,
    roomCode,
    game: '盛世长安'
  });
  
  // 重要：使用传入的IP地址构建URL，而不是window.location
  // 这样扫码后可以直接用正确的IP地址连接
  const baseUrl = typeof window !== 'undefined' && window.location.port
    ? `http://${ip}:${window.location.port}/#/pages/lan/connect/connect`
    : `http://${ip}:10086/#/pages/lan/connect/connect`;
  
  return `${baseUrl}?${params.toString()}`;
}
