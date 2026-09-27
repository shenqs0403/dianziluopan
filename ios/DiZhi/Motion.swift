import CoreMotion
import Foundation

/// 电子罗盘的姿态来源，接口与 Android 的 SensorManager 对应。
///
/// 参照系这件事很容易踩坑：`xArbitraryCorrectedZVertical` 的 X 轴指向
/// **任意** 水平方向，`attitude.yaw` 只是「相对启动时的朝向」，拿它当罗盘方位会
/// 完全指错。Apple 的文档明确说：罗盘/导航类应用要用 `xMagneticNorthZVertical`
/// 或 `xTrueNorthZVertical`。
///
/// 所以这里按可用性依次挑：真北 → 磁北 → 任意（并在 accuracy 里如实降级）。
/// 真北需要定位服务可用（磁偏角由系统算），拿不到就退磁北，行为与 Android 端
/// 「没有定位权限时用磁北」一致。
final class Motion {
    static let shared = Motion()

    private let mm = CMMotionManager()
    private var onReading: (([String: Any]) -> Void)?
    private var lastMag: Double?
    private var continuous: Double = 0
    private var lastEmit = Date.distantPast

    /// 与 Android 端的 SENSOR_DELAY_GAME 保持同一量级（约 30Hz）
    private static let interval: TimeInterval = 1.0 / 30.0

    /// 本次实际用上的参照系，决定 accuracy 报几
    private var northAligned = false
    private var trueNorth = false

    func start(_ cb: @escaping ([String: Any]) -> Void) {
        guard mm.isDeviceMotionAvailable else { return }
        onReading = cb
        lastMag = nil

        guard let frame = Self.preferredFrame() else { return }
        trueNorth = frame.rawValue == CMAttitudeReferenceFrame.xTrueNorthZVertical.rawValue
        northAligned = trueNorth
            || frame.rawValue == CMAttitudeReferenceFrame.xMagneticNorthZVertical.rawValue

        mm.deviceMotionUpdateInterval = Self.interval
        // 磁北/真北参照系需要磁力计已校准，这个开关让系统自己弹出「画 8 字」提示
        mm.showsDeviceMovementDisplay = true
        // 回调已在主线程（to: .main），后面调 evaluateJavaScript 不用再切线程
        mm.startDeviceMotionUpdates(using: frame, to: .main) { [weak self] data, _ in
            self?.publish(data)
        }
    }

    func stop() {
        mm.stopDeviceMotionUpdates()
        onReading = nil
        lastMag = nil
    }

    /// 真北最准（系统已含磁偏角），但要求定位服务可用；拿不到就退磁北。
    /// 用 rawValue 比较而不是 contains：CMAttitudeReferenceFrame 是 OptionSet，
    /// 逐位比较更稳，也避开不同 iOS 版本可用集合的差异。
    private static func preferredFrame() -> CMAttitudeReferenceFrame? {
        let available = CMAttitudeReferenceFrame.availableAttitudeReferenceFrames()
        let raws = Set(available.map { $0.rawValue })
        let order: [CMAttitudeReferenceFrame] = [
            .xTrueNorthZVertical,
            .xMagneticNorthZVertical,
            .xArbitraryCorrectedZVertical
        ]
        for frame in order where raws.contains(frame.rawValue) {
            return frame
        }
        return available.first
    }

    private func publish(_ motion: CMDeviceMotion?) {
        guard let m = motion, let cb = onReading else { return }

        // Z 轴偏航角。Z-vertical 参照系下它就是方位角，0=正北、顺时针增大
        let yaw = m.attitude.yaw * 180 / .pi
        guard yaw.isFinite else { return }

        // 展开 0/360 接缝，否则 359.9→0.1 会把指针和校对算法都打断
        let mag = ((yaw.truncatingRemainder(dividingBy: 360)) + 360)
            .truncatingRemainder(dividingBy: 360)
        if let last = lastMag {
            var d = mag - last
            if d > 180 { d -= 360 }
            if d < -180 { d += 360 }
            continuous += d
        } else {
            continuous = mag
        }
        lastMag = mag

        // 先归一化再保留两位小数：359.999 四舍五入会变成 360.00，越过 0~360 契约
        let azimuth = deg360(continuous)

        let now = Date()
        guard now.timeIntervalSince(lastEmit) >= Self.interval - 0.002 else { return }
        lastEmit = now

        // pitch 对齐 Android 端口径：发「与竖直方向的夹角」，竖直持握时为 0，
        // 顶部的水平仪就是靠 |pitch|<1.2 && |roll|<1.2 判「水平」
        let pitch = m.attitude.pitch * 180 / .pi + 90
        let roll = m.attitude.roll * 180 / .pi

        // accuracy：真北=3，磁北=2（方向对但没含磁偏角），任意参照系=1
        let accuracy: Int
        if !northAligned {
            accuracy = 1
        } else if m.headingAccuracy < 0 {
            // 系统自己说这次朝向不可信（磁力计未校准）
            accuracy = 1
        } else {
            accuracy = trueNorth ? 3 : 2
        }

        cb([
            "azimuth": azimuth,
            "pitch": clamp(pitch, -180, 180),
            "roll": clamp(roll, -90, 90),
            "accuracy": accuracy,
            "drift": 0,
            "timestamp": Int(now.timeIntervalSince1970 * 1000)
        ])
    }

    /// 归一到 0~360，保留两位小数，并把四舍五入到 360 的值归 0
    private func deg360(_ v: Double) -> Double {
        let n = ((v.truncatingRemainder(dividingBy: 360)) + 360).truncatingRemainder(dividingBy: 360)
        let r = (n * 100).rounded() / 100
        return r >= 360 ? 0 : r
    }

    private func clamp(_ v: Double, _ lo: Double, _ hi: Double) -> Double {
        min(max(v, lo), hi)
    }
}
