import { sensor } from '@kit.SensorServiceKit'
import { BusinessError } from '@kit.BasicServicesKit'
import { hilog } from '@kit.PerformanceAnalysisKit'

/**
 * 传感器数据源，对应 Android 端的 SensorManager 封装。
 *
 * 用 ORIENTATION（姿态角）而不是 ROTATION_VECTOR：
 *   - ORIENTATION 的回调类型 sensor.OrientationResponse 是明确的 alpha/beta/gamma，
 *     没有版本差异，读数就是「相对正北」的偏航角，正是罗盘要的量。
 *   - ROTATION_VECTOR 的响应结构在不同 SDK 上不一致，字段名/单位需要逐版本核对。
 *   - 两者都是磁力计融合结果，都不需要申请传感器权限。
 *
 * interval 单位是**纳秒**（老 API 的 frequency:30 那套已经废弃）。
 * 30Hz = 100_000_000 ns。
 */
const TAG = 'DiZhiSensor'
const INTERVAL_NS: number = 100_000_000 // 30Hz
const MIN_INTERVAL_NS: number = 5_000_000
const MAX_INTERVAL_NS: number = 200_000_000

export interface SensorReading {
  azimuth: number
  pitch: number
  roll: number
  accuracy: number
  drift: number
  timestamp: number
}

export class SensorBus {
  private static instance: SensorBus = new SensorBus()
  private running: boolean = false
  private lastMag: number = -1
  private continuous: number = 0
  private onReading: (r: SensorReading) => void = () => {}

  static get(): SensorBus {
    return SensorBus.instance
  }

  start(cb: (r: SensorReading) => void): void {
    if (this.running) {
      // 已经在跑了，只换回调，避免重复注册监听
      this.onReading = cb
      return
    }
    this.onReading = cb
    this.lastMag = -1

    const interval: sensor.SensorOptions = {
      interval: { type: sensor.IntervalType.NORMAL, value: INTERVAL_NS },
      maxInterval: { type: sensor.IntervalType.NORMAL, value: MAX_INTERVAL_NS },
      minInterval: { type: sensor.IntervalType.NORMAL, value: MIN_INTERVAL_NS }
    }

    try {
      sensor.on(sensor.SensorId.ORIENTATION, (data: sensor.OrientationResponse) => {
        this.publish(data)
      }, interval)
      this.running = true
      hilog.info(0x0000, TAG, 'ORIENTATION subscribed')
    } catch (error) {
      const e = error as BusinessError
      hilog.error(0x0000, TAG, 'subscribe failed: %{public}s', e.message)
    }
  }

  stop(): void {
    if (!this.running) {
      return
    }
    try {
      // 老 API 是 sensor.stop()，现在必须按 sensorId 取消，否则回调一直挂着耗电
      sensor.off(sensor.SensorId.ORIENTATION)
    } catch (error) {
      const e = error as BusinessError
      hilog.error(0x0000, TAG, 'unsubscribe failed: %{public}s', e.message)
    }
    this.running = false
    this.lastMag = -1
  }

  private publish(data: sensor.OrientationResponse): void {
    if (data == null) {
      return
    }
    // alpha 是绕 Z 轴的偏航角，弧度、范围 -PI..PI
    const yaw = data.alpha * 180 / Math.PI
    if (!Number.isFinite(yaw)) {
      return
    }

    // 展开 0/360 接缝：359.9 -> 0.1 不展开的话指针和校准算法都会被打断
    const mag = normalize360(yaw)
    if (this.lastMag >= 0) {
      let d = mag - this.lastMag
      if (d > 180) {
        d -= 360
      } else if (d < -180) {
        d += 360
      }
      this.continuous += d
    } else {
      this.continuous = mag
    }
    this.lastMag = mag

    // 先归一再保留两位：359.999 四舍五入会变成 360.00，越出 0~360 契约
    const azimuth = normalize360(round2(this.continuous))

    // beta/gamma 是绕 X/Y 的姿态角。对齐 Android 端口径发「与竖直方向的夹角」，
    // 顶栏水平仪判据是 |pitch|<1.2 && |roll|<1.2。
    // 注意：beta 的正负/90 度偏置各家 ROM 的传感器坐标约定不完全一致，
    // 真机上如果「水平」提示反向，就把这里的 +90 换成 -90 再试。
    const pitch = clamp(data.beta * 180 / Math.PI + 90, -180, 180)
    const roll = clamp(data.gamma * 180 / Math.PI, -90, 90)

    this.onReading({
      azimuth: azimuth,
      pitch: pitch,
      roll: roll,
      // ORIENTATION 是磁力计融合结果：方向对，但没做磁偏角修正，
      // 所以按「磁北」上报 accuracy=2，不冒充真北（真北=3）。
      accuracy: 2,
      drift: 0,
      timestamp: Date.now()
    })
  }
}

function normalize360(v: number): number {
  const n = ((v % 360) + 360) % 360
  return n >= 360 ? 0 : n
}

function round2(v: number): number {
  return Math.round(v * 100) / 100
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), hi)
}
