import Taro from '@tarojs/taro';

/**
 * 音效管理器
 */
class SoundManager {
  private audioContext: any = null;
  private enabled: boolean = true;

  constructor() {
    // 初始化音频上下文
    if (typeof window !== 'undefined' && (window as any).AudioContext) {
      this.audioContext = new (window as any).AudioContext();
    }
  }

  /**
   * 播放简单的提示音（使用Web Audio API生成）
   */
  private playBeep(frequency: number, duration: number, volume: number = 0.3) {
    if (!this.enabled || !this.audioContext) return;

    try {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      oscillator.frequency.value = frequency;
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(
        0.01,
        this.audioContext.currentTime + duration
      );

      oscillator.start(this.audioContext.currentTime);
      oscillator.stop(this.audioContext.currentTime + duration);
    } catch (error) {
      console.warn('音效播放失败:', error);
    }
  }

  /**
   * 投掷骰子音效
   */
  playDiceRoll() {
    // 快速的滚动音效
    this.playBeep(400, 0.1, 0.2);
    setTimeout(() => this.playBeep(500, 0.1, 0.2), 50);
    setTimeout(() => this.playBeep(600, 0.15, 0.25), 100);
  }

  /**
   * 购买建筑音效
   */
  playPurchase() {
    // 清脆的确认音
    this.playBeep(800, 0.15, 0.25);
    setTimeout(() => this.playBeep(1000, 0.2, 0.3), 100);
  }

  /**
   * 购买传奇建筑音效
   */
  playLegendaryPurchase() {
    // 华丽的三连音
    this.playBeep(800, 0.15, 0.3);
    setTimeout(() => this.playBeep(1000, 0.15, 0.3), 120);
    setTimeout(() => this.playBeep(1200, 0.25, 0.35), 240);
  }

  /**
   * 结算音效
   */
  playSettlement() {
    // 柔和的提示音
    this.playBeep(600, 0.2, 0.2);
  }

  /**
   * 回合结束音效
   */
  playEndTurn() {
    // 低沉的过渡音
    this.playBeep(300, 0.25, 0.2);
  }

  /**
   * 卖卡音效
   */
  playSellCard() {
    // 快速的金币音
    this.playBeep(700, 0.1, 0.25);
  }

  /**
   * 设置音效开关
   */
  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  /**
   * 获取音效状态
   */
  isEnabled(): boolean {
    return this.enabled;
  }
}

// 导出单例
export const soundManager = new SoundManager();
