plugins {
    id("com.android.application")   // 内置 Kotlin 支持（AGP 9）
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

    buildTypes {
        debug {
            isMinifyEnabled = false
        }
        release {
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
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
