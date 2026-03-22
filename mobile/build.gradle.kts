// Top-level build file where you can add configuration options common to all sub-projects/modules.
plugins {
    alias(libs.plugins.android.application) apply false
    alias(libs.plugins.android.test) apply false
    alias(libs.plugins.kotlin.android) apply false
    alias(libs.plugins.kotlin.compose) apply false
    alias(libs.plugins.baselineprofile) apply false
    alias(libs.plugins.ksp) apply false
    alias(libs.plugins.google.services) apply false
    id("com.google.firebase.crashlytics") version "3.0.2" apply false
    id("com.google.firebase.appdistribution") version "5.2.1" apply false
    id("org.owasp.dependencycheck") version "12.1.0" apply false
}
