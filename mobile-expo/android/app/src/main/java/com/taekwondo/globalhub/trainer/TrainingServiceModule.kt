package com.taekwondo.globalhub.trainer

import android.content.Intent
import android.os.Build
import com.facebook.react.bridge.*

/**
 * React Native bridge module that exposes startTrainingService() and stopTrainingService()
 * to JavaScript. This controls the Android Foreground Service that keeps BLE alive
 * when the screen is off.
 */
class TrainingServiceModule(reactContext: ReactApplicationContext)
    : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "TrainingService"

    @ReactMethod
    fun startTrainingService(promise: Promise) {
        try {
            val intent = Intent(reactApplicationContext, TrainingForegroundService::class.java).apply {
                action = TrainingForegroundService.ACTION_START
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                reactApplicationContext.startForegroundService(intent)
            } else {
                reactApplicationContext.startService(intent)
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SERVICE_ERROR", "No se pudo iniciar el servicio de entrenamiento: ${e.message}")
        }
    }

    @ReactMethod
    fun stopTrainingService(promise: Promise) {
        try {
            val intent = Intent(reactApplicationContext, TrainingForegroundService::class.java).apply {
                action = TrainingForegroundService.ACTION_STOP
            }
            reactApplicationContext.startService(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            // Service may not be running — that's fine
            promise.resolve(false)
        }
    }
}
