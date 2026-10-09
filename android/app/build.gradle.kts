import java.util.Properties

plugins {
    id("com.android.application")   // 内置 Kotlin 支持（AGP 9）
}

// —— 发布签名 ——
// 凭据与密钥不入库：android/keystore.properties 已被 .gitignore（密钥文件 app/release.keystore 由 *.keystore 忽略）。
// 缺省时 release 退回未签名产物。首次生成（keytool）：
//   keytool -genkeypair -v -keystore app/release.keystore -alias dianziluopan \
//     -keyalg RSA -keysize 2048 -validity 10000 -storetype PKCS12
val keystoreProps = Properties()
val keystoreFile = rootProject.file("keystore.properties")
val hasReleaseKeystore = keystoreFile.exists()
if (hasReleaseKeystore) {
    keystoreFile.inputStream().use { keystoreProps.load(it) }
} else {
    println("警告：未找到 android/keystore.properties，release 将产出未签名 APK")
}

android {
    namespace = "com.linglongopc.dianziluopan"
    compileSdk = 36
    // 若本机只装了 android-36.1 平台，可改用下面两行：
    // compileSdk = 36
    // compileSdkMinor = 1

    defaultConfig {
        applicationId = "com.linglongopc.dianziluopan"
        minSdk = 24            // Android 7.0
        targetSdk = 36
        versionCode = 1
        versionName = "1.0"
    }

    signingConfigs {
        if (hasReleaseKeystore) {
            create("release") {
                storeFile = file(keystoreProps.getProperty("storeFile"))
                storePassword = keystoreProps.getProperty("storePassword")
                keyAlias = keystoreProps.getProperty("keyAlias")
                keyPassword = keystoreProps.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        debug {
            isMinifyEnabled = false
        }
        release {
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            if (hasReleaseKeystore) {
                signingConfig = signingConfigs.getByName("release")
            }
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    androidResources {
        // app/src/main/assets/www 由 web 侧 `cd ../web && npm run sync` 生成
        noCompress += listOf("woff2")
    }
}

kotlin {
    compilerOptions {
        jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
    }
}

// 纯原生 WebView 容器，不引入任何第三方依赖（无 AndroidX / 无 Material）
dependencies {}