import com.google.firebase.appdistribution.gradle.firebaseAppDistribution
import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.ksp)
    id("com.google.firebase.crashlytics")
    id("com.google.firebase.appdistribution")
    id("org.owasp.dependencycheck")
    alias(libs.plugins.google.services) apply false
}

val localProperties = Properties().apply {
    val localPropertiesFile = rootProject.file("local.properties")
    if (localPropertiesFile.exists()) {
        localPropertiesFile.inputStream().use { stream ->
            load(stream)
        }
    }
}

fun localProperty(name: String, defaultValue: String): String {
    return (
        localProperties.getProperty(name)
            ?: providers.environmentVariable(name).orNull
            ?: defaultValue
        ).trim()
}

fun quoted(value: String): String {
    return "\"" + value
        .replace("\\", "\\\\")
        .replace("\"", "\\\"") + "\""
}

val releaseKeystorePath = localProperty("ANDROID_KEYSTORE_PATH", "")
val releaseKeystorePassword = localProperty("ANDROID_KEYSTORE_PASSWORD", "")
val releaseKeyAlias = localProperty("ANDROID_KEY_ALIAS", "")
val releaseKeyPassword = localProperty("ANDROID_KEY_PASSWORD", "")
val hasReleaseSigning = listOf(
    releaseKeystorePath,
    releaseKeystorePassword,
    releaseKeyAlias,
    releaseKeyPassword
).all { it.isNotBlank() }

android {
    namespace = "com.megaconvert.business"
    compileSdk {
        version = release(36) {
            minorApiLevel = 1
        }
    }

    defaultConfig {
        applicationId = "com.megaconvert.business"
        minSdk = 33
        targetSdk = 36
        versionCode = 1
        versionName = "1.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"

        buildConfigField(
            "String",
            "SIGNALING_WS_URL",
            quoted(localProperty("SIGNALING_WS_URL", "ws://10.0.2.2:8080"))
        )
        buildConfigField(
            "String",
            "SERVER_HTTP_BASE_URL",
            quoted(localProperty("SERVER_HTTP_BASE_URL", "http://10.0.2.2:8080"))
        )
        buildConfigField(
            "String",
            "SHEERID_VERIFICATION_URL",
            quoted(
                localProperty(
                    "SHEERID_VERIFICATION_URL",
                    "https://services.sheerid.com/verify/YOUR_PROGRAM_ID"
                )
            )
        )
        buildConfigField(
            "String",
            "SECURITY_REPORT_EMAIL",
            quoted(localProperty("SECURITY_REPORT_EMAIL", "security@megaconvert.business"))
        )
        buildConfigField(
            "String",
            "PINNED_CERT_DOMAIN",
            quoted(localProperty("PINNED_CERT_DOMAIN", "api.megaconvert.com"))
        )
        buildConfigField(
            "String",
            "PINNED_CERT_SHA256_PRIMARY",
            quoted(
                localProperty(
                    "PINNED_CERT_SHA256_PRIMARY",
                    "sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="
                )
            )
        )
        buildConfigField(
            "String",
            "PINNED_CERT_SHA256_BACKUP",
            quoted(
                localProperty(
                    "PINNED_CERT_SHA256_BACKUP",
                    "sha256/BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB="
                )
            )
        )
        buildConfigField(
            "String",
            "TURN_SERVER_URL",
            quoted(localProperty("TURN_SERVER_URL", ""))
        )
        buildConfigField(
            "String",
            "TURN_USERNAME",
            quoted(localProperty("TURN_USERNAME", ""))
        )
        buildConfigField(
            "String",
            "TURN_PASSWORD",
            quoted(localProperty("TURN_PASSWORD", ""))
        )
    }

    signingConfigs {
        if (hasReleaseSigning) {
            create("release") {
                storeFile = file(releaseKeystorePath)
                storePassword = releaseKeystorePassword
                keyAlias = releaseKeyAlias
                keyPassword = releaseKeyPassword
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            if (hasReleaseSigning) {
                signingConfig = signingConfigs.getByName("release")
            } else {
                logger.warn(
                    "Release signing secrets are missing. bundleRelease will be unsigned outside CI."
                )
            }
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            firebaseAppDistribution {
                artifactType = "APK"
                releaseNotes = "Alpha 1.0: E2EE Messages, Glass UI, WebRTC."
                groups = "alpha-testers"
            }
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
    buildFeatures {
        compose = true
        buildConfig = true
    }
}

configure<org.owasp.dependencycheck.gradle.extension.DependencyCheckExtension> {
    autoUpdate = true
    failBuildOnCVSS = 9.0f
    outputDirectory = layout.buildDirectory
        .dir("reports/dependency-check")
        .get()
        .asFile
        .absolutePath
    scanConfigurations = listOf(
        "implementation",
        "debugRuntimeClasspath",
        "releaseRuntimeClasspath"
    )
}

if (file("google-services.json").exists()) {
    apply(plugin = "com.google.gms.google-services")
} else {
    logger.warn("google-services.json is missing. Building without Google Services resources.")
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.lifecycle.viewmodel.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.datastore.preferences)
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.graphics)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.compose.material3)
    implementation("androidx.biometric:biometric-ktx:1.2.0-alpha05")
    implementation("androidx.navigation:navigation-compose:2.8.0")
    implementation("com.android.billingclient:billing-ktx:6.1.0")
    implementation(platform("com.google.firebase:firebase-bom:32.7.0"))
    implementation("com.google.firebase:firebase-auth-ktx")
    implementation("com.google.firebase:firebase-crashlytics-ktx")
    implementation(libs.androidx.profileinstaller)
    implementation(libs.androidx.room.runtime)
    implementation(libs.androidx.room.ktx)
    ksp(libs.androidx.room.compiler)
    implementation(libs.sqlcipher.android.database.sqlcipher)
    implementation(libs.androidx.security.crypto)
    implementation(libs.androidx.work.runtime.ktx)
    implementation(libs.okhttp)
    implementation("com.moizhassan.ffmpeg:ffmpeg-kit-16kb:6.0.0")
    implementation("com.tom-roush:pdfbox-android:2.0.27.0")
    implementation("com.infobip:google-webrtc:1.0.45036")
    testImplementation(libs.junit)
    androidTestImplementation(libs.androidx.junit)
    androidTestImplementation(libs.androidx.espresso.core)
    androidTestImplementation(platform(libs.androidx.compose.bom))
    androidTestImplementation(libs.androidx.compose.ui.test.junit4)
    debugImplementation(libs.androidx.compose.ui.tooling)
    debugImplementation(libs.androidx.compose.ui.test.manifest)
    debugImplementation("com.squareup.leakcanary:leakcanary-android:2.12")
}
