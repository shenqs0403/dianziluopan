import { UIAbility } from '@kit.AbilityKit'
import { window } from '@kit.ArkUI'
import { hilog } from '@kit.PerformanceAnalysisKit'

const TAG = 'DiZhiEntry'

export default class EntryAbility extends UIAbility {
  onCreate(): void {
    hilog.info(0x0000, TAG, 'onCreate')
  }

  onWindowStageCreate(windowStage: window.WindowStage): void {
    windowStage.loadContent('pages/Index', (error) => {
      if (error.code) {
        hilog.error(0x0000, TAG, 'loadContent failed: %{public}s', error.message)
        return
      }
      // 罗盘要一直亮着，别让人每看几秒就得解锁一次
      windowStage.getMainWindow().then((mainWindow) => {
        mainWindow.setWindowKeepScreenOn(true).catch(() => {
          hilog.warn(0x0000, TAG, 'keepScreenOn failed at launch')
        })
      }).catch(() => {
        hilog.warn(0x0000, TAG, 'getMainWindow failed')
      })
    })
  }

  onDestroy(): void {
    // 页面自己会在 aboutToDisappear 里停传感器，这里只兜底
    hilog.info(0x0000, TAG, 'onDestroy')
  }
}
