import UIKit
import WebKit

/// 全屏 WebView 容器，界面来自 www/index.html（由 web 工程 `npm run sync` 同步）。
final class DialViewController: UIViewController {

    private var webView: WKWebView!
    let bridge = Bridge()

    override func viewDidLoad() {
        super.viewDidLoad()

        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        // 界面是固定的 12/62/26 布局，捏合缩放会把布局撑坏
        config.suppressesIncrementalRendering = false

        // 必须在建 WebView 之前注册 message handler：
        // userContentController 一旦被 WebView 取用就固定了，事后 add 不生效
        let userContent = WKUserContentController()
        userContent.add(ScriptMessageProxy(target: bridge), name: "dianzhi")
        config.userContentController = userContent

        webView = WKWebView(frame: .zero, configuration: config)
        webView.scrollView.isScrollEnabled = false
        webView.scrollView.bounces = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.scrollView.delaysContentTouches = false
        // 界面自带深色底，先铺上免得首屏白闪
        webView.isOpaque = true
        webView.backgroundColor = UIColor(red: 0.07, green: 0.04, blue: 0.02, alpha: 1)
        webView.scrollView.backgroundColor = webView.backgroundColor
        webView.navigationDelegate = self

        bridge.webView = webView
        bridge.window = view.window

        view.addSubview(webView)
        webView.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: view.topAnchor),
            webView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor)
        ])

        loadPage()
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        bridge.window = view.window
    }

    private func loadPage() {
        guard let url = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "www"),
              let root = Bundle.main.resourceURL else {
            assertionFailure("找不到 www/index.html，先在 web 目录跑 npm run sync -- ios")
            return
        }
        // 放开整个 Bundle 的读权限，界面同目录下的字体等资源才能加载
        webView.loadFileURL(url, allowingReadAccessTo: root)
    }

    deinit {
        webView.configuration.userContentController
            .removeScriptMessageHandler(forName: "dianzhi")
    }
}

extension DialViewController: WKNavigationDelegate {
    /// 界面完全离线，拦掉一切外跳，只放行本地文件
    func webView(_ webView: WKWebView,
                  decidePolicyFor navigationAction: WKNavigationAction,
                  decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.cancel)
            return
        }
        let local = url.isFileURL || url.scheme == "about" || url.scheme == "data"
        decisionHandler(local ? .allow : .cancel)
    }
}
