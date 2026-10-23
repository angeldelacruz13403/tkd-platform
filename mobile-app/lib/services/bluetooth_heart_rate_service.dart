import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter_blue_plus/flutter_blue_plus.dart';

enum HeartRateZone {
  zone1Recovery, // 50-60%
  zone2Aerobic, // 60-70%
  zone3Tempo, // 70-80%
  zone4Threshold, // 80-90%
  zone5Anaerobic // >90%
}

class BluetoothHeartRateService extends ChangeNotifier {
  // UUIDs oficiales estándar Bluetooth SIG para Pulsómetros
  static const String heartRateServiceUuid =
      "0000180d-0000-1000-8000-00805f9b34fb";
  static const String heartRateMeasurementCharUuid =
      "00002a37-0000-1000-8000-00805f9b34fb";

  BluetoothDevice? connectedDevice;
  bool isScanning = false;
  bool isConnected = false;
  int currentBpm = 0;
  int maxBpmRecorded = 0;
  List<int> bpmHistory = [];
  int userMaxHr = 200; // Configurable por atleta

  StreamSubscription? _scanSubscription;
  StreamSubscription? _valueSubscription;

  void resetSessionMetrics() {
    bpmHistory = [];
    maxBpmRecorded = 0;
    notifyListeners();
  }

  /// Inicia escaneo de pulsómetros Bluetooth BLE cercanos
  Future<void> startScan(Function(List<ScanResult>) onResults) async {
    isScanning = true;
    notifyListeners();

    await FlutterBluePlus.startScan(
      withServices: [Guid(heartRateServiceUuid)],
      timeout: const Duration(seconds: 15),
    );

    _scanSubscription = FlutterBluePlus.scanResults.listen((results) {
      onResults(results);
    });
  }

  /// Conecta a un pulsómetro seleccionado (Polar, Garmin, etc.)
  Future<bool> connectToSensor(BluetoothDevice device) async {
    try {
      await device.connect(timeout: const Duration(seconds: 10));
      connectedDevice = device;
      isConnected = true;
      notifyListeners();

      // Descubrir servicios GATT
      List<BluetoothService> services = await device.discoverServices();
      for (var service in services) {
        if (service.uuid.toString().toLowerCase().contains("180d")) {
          for (var characteristic in service.characteristics) {
            if (characteristic.uuid.toString().toLowerCase().contains("2a37")) {
              await characteristic.setNotifyValue(true);
              _valueSubscription =
                  characteristic.onValueReceived.listen((value) {
                _parseHeartRateData(value);
              });
            }
          }
        }
      }
      return true;
    } catch (e) {
      debugPrint("Error conectando a pulsómetro: $e");
      return false;
    }
  }

  /// Decodifica el estándar de medición de pulso Bluetooth SIG (GATT 0x2A37)
  void _parseHeartRateData(List<int> data) {
    if (data.isEmpty) return;

    int flags = data[0];
    bool is16Bit = (flags & 0x01) != 0;

    int bpm;
    if (is16Bit && data.length >= 3) {
      bpm = data[1] + (data[2] << 8);
    } else if (data.length >= 2) {
      bpm = data[1];
    } else {
      return;
    }

    currentBpm = bpm;
    if (bpm > maxBpmRecorded) {
      maxBpmRecorded = bpm;
    }
    bpmHistory.add(bpm);
    notifyListeners();
  }

  /// Determina la zona fisiológica de entrenamiento actual
  HeartRateZone get currentZone {
    double pct = (currentBpm / userMaxHr) * 100;
    if (pct >= 90) return HeartRateZone.zone5Anaerobic;
    if (pct >= 80) return HeartRateZone.zone4Threshold;
    if (pct >= 70) return HeartRateZone.zone3Tempo;
    if (pct >= 60) return HeartRateZone.zone2Aerobic;
    return HeartRateZone.zone1Recovery;
  }

  /// Desconecta el pulsómetro
  Future<void> disconnect() async {
    await _valueSubscription?.cancel();
    await _scanSubscription?.cancel();
    await connectedDevice?.disconnect();
    isConnected = false;
    currentBpm = 0;
    notifyListeners();
  }
}
