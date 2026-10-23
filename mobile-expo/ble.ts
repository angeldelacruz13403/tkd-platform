/**
 * ble.ts — Módulo BLE para COOSPO HW9 y pulsómetros compatibles
 *
 * Protocolo: Bluetooth Heart Rate Service (UUID 0x180D)
 * Característica: Heart Rate Measurement (UUID 0x2A37)
 *
 * Uso:
 *   import { useBleHeartRate } from './ble';
 *   const { bpm, status, startScan, connect, disconnect, deviceName } = useBleHeartRate();
 *
 * IMPORTANTE: Requiere react-native-ble-plx instalado y los permisos de BLE
 * declarados en app.json (android.permissions y ios.infoPlist).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, PermissionsAndroid, AppState } from 'react-native';
import { BleManager, Device, Characteristic, State } from 'react-native-ble-plx';
import { Buffer } from 'buffer';

// ─── UUIDs estándar BLE ───────────────────────────────────────────────────────
const HR_SERVICE_UUID        = '0000180d-0000-1000-8000-00805f9b34fb'; // Heart Rate Service
const HR_MEASUREMENT_UUID    = '00002a37-0000-1000-8000-00805f9b34fb'; // Heart Rate Measurement
const BATTERY_SERVICE_UUID   = '0000180f-0000-1000-8000-00805f9b34fb'; // Battery Service (opcional)
const BATTERY_LEVEL_UUID     = '00002a19-0000-1000-8000-00805f9b34fb'; // Battery Level

// ─── Tipos ───────────────────────────────────────────────────────────────────
export type BleStatus =
  | 'idle'          // Sin actividad
  | 'scanning'      // Buscando dispositivos
  | 'connecting'    // Conectando al dispositivo
  | 'connected'     // Conectado y recibiendo datos
  | 'disconnected'  // Desconectado (por el usuario o el dispositivo)
  | 'error';        // Error

export interface BleHeartRateState {
  bpm: number | null;           // Último BPM recibido
  batteryLevel: number | null;  // Nivel de batería del sensor (0-100)
  status: BleStatus;            // Estado de la conexión BLE
  deviceName: string | null;    // Nombre del dispositivo conectado
  errorMessage: string | null;  // Mensaje de error si status === 'error'
  nearbyDevices: Device[];      // Pulsómetros y dispositivos BLE detectados
  startScan: () => void;        // Iniciar escaneo
  connect: (device: Device) => void; // Conectar a un dispositivo específico
  disconnect: () => void;       // Desconectar
  reconnect: () => void;        // Reconectar al último dispositivo (auto-reconnect)
}

let bleManagerInstance: BleManager | null = null;

function getBleManager(): BleManager | null {
  if (bleManagerInstance) return bleManagerInstance;
  try {
    bleManagerInstance = new BleManager();
    return bleManagerInstance;
  } catch (err) {
    console.log('[BLE] Módulo nativo no disponible en Expo Go. Activando simulador de pruebas.');
    return null;
  }
}

// ─── Parsear Heart Rate Measurement (Spec: BT SIG GATT 0x2A37) ───────────────
// Byte 0: Flags
//   Bit 0: 0 = BPM es uint8, 1 = BPM es uint16
//   Bit 4: 1 = RR-intervals presentes
// Byte 1 (o 1-2 si uint16): BPM
function parseHeartRateMeasurement(base64Value: string): number {
  const bytes = Buffer.from(base64Value, 'base64');
  const flags = bytes[0];
  const isUint16 = (flags & 0x01) !== 0;
  const bpm = isUint16
    ? bytes.readUInt16LE(1)  // Little-endian 16-bit
    : bytes[1];              // 8-bit
  return bpm;
}

// ─── Permisos Android ─────────────────────────────────────────────────────────
async function requestAndroidBlePermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;

  const apiLevel = Number.parseInt(String(Platform.Version), 10);

  if (apiLevel >= 31) {
    // Android 12+: BLUETOOTH_SCAN + BLUETOOTH_CONNECT
    const results = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    ]);
    return (
      results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN]  === 'granted' &&
      results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === 'granted'
    );
  } else {
    // Android < 12: ACCESS_FINE_LOCATION
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
    );
    return granted === 'granted';
  }
}

// ─── Hook principal ───────────────────────────────────────────────────────────
export function useBleHeartRate(): BleHeartRateState {
  const manager = getBleManager();

  const [bpm, setBpm] = useState<number | null>(null);
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [status, setStatus] = useState<BleStatus>('idle');
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [nearbyDevices, setNearbyDevices] = useState<Device[]>([]);

  const connectedDeviceRef = useRef<Device | null>(null);
  const lastConnectedDeviceRef = useRef<Device | null>(null); // Remember last device for reconnect
  const subscriptionRef = useRef<ReturnType<Characteristic['monitor']> | null>(null);
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const simTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isReconnectingRef = useRef(false);

  // Limpiar al desmontar
  useEffect(() => {
    return () => {
      _disconnect();
      if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
      if (simTimerRef.current) clearInterval(simTimerRef.current);
      if (manager) {
        try { manager.stopDeviceScan(); } catch {}
      }
    };
  }, [manager]);

  // ─── Desconectar ─────────────────────────────────────────────────────────
  const _disconnect = useCallback(async () => {
    if (simTimerRef.current) {
      clearInterval(simTimerRef.current);
      simTimerRef.current = null;
    }
    if (subscriptionRef.current) {
      try { subscriptionRef.current.remove(); } catch {}
      subscriptionRef.current = null;
    }
    if (connectedDeviceRef.current && manager) {
      try {
        await manager.cancelDeviceConnection(connectedDeviceRef.current.id);
      } catch { /* ignore */ }
      connectedDeviceRef.current = null;
    }
  }, [manager]);

  const disconnect = useCallback(async () => {
    await _disconnect();
    setStatus('disconnected');
    setBpm(null);
    setBatteryLevel(null);
    setDeviceName(null);
  }, [_disconnect]);

  // Solicitar permisos al abrir la app, antes de intentar descubrir sensores.
  useEffect(() => {
    if (!manager || Platform.OS !== 'android') return;

    let cancelled = false;
    requestAndroidBlePermissions().then((granted) => {
      if (cancelled || granted) return;
      setStatus('error');
      setErrorMessage('Se necesitan permisos de Bluetooth para buscar el pulsómetro. Actívalos en Ajustes.');
    }).catch(() => {
      if (!cancelled) {
        setStatus('error');
        setErrorMessage('No se pudieron solicitar los permisos de Bluetooth.');
      }
    });

    return () => {
      cancelled = true;
    };
  }, [manager]);

  // ─── Conectar a un dispositivo ────────────────────────────────────────────
  const connect = useCallback(async (device: Device) => {
    if (!manager) {
      // Modo simulación inteligente (Expo Go)
      setStatus('connecting');
      setErrorMessage(null);
      setNearbyDevices([]);
      setTimeout(() => {
        setStatus('connected');
        setDeviceName(device.name || 'COOSPO HW9 (Simulado)');
        setBatteryLevel(94);
        let currentBpm = 148;
        setBpm(currentBpm);
        simTimerRef.current = setInterval(() => {
          const delta = Math.floor(Math.random() * 7) - 3;
          currentBpm = Math.max(125, Math.min(188, currentBpm + delta));
          setBpm(currentBpm);
        }, 1200);
      }, 700);
      return;
    }

    // Detener escaneo si está activo
    manager.stopDeviceScan();
    if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);

    setStatus('connecting');
    setErrorMessage(null);
    setNearbyDevices([]);

    try {
      // Conectar
      const connectedDevice = await manager.connectToDevice(device.id, {
        requestMTU: 256,
      });
      connectedDeviceRef.current = connectedDevice;

      // Descubrir servicios
      await connectedDevice.discoverAllServicesAndCharacteristics();

      const name = connectedDevice.name || connectedDevice.localName || 'Pulsómetro BLE';
      setDeviceName(name);
      setStatus('connected');
      lastConnectedDeviceRef.current = connectedDevice; // Remember for auto-reconnect

      // Escuchar desconexiones — intentar reconectar automáticamente
      manager.onDeviceDisconnected(connectedDevice.id, () => {
        console.log('[BLE] Dispositivo desconectado, intentando reconectar...');
        connectedDeviceRef.current = null;
        subscriptionRef.current = null;
        // Don't reset status to 'disconnected' yet — try to reconnect first
        // Only mark disconnected if reconnect fails
        if (lastConnectedDeviceRef.current && !isReconnectingRef.current) {
          attemptReconnect();
        } else {
          setStatus('disconnected');
          setBpm(null);
          setDeviceName(null);
        }
      });

      // Leer nivel de batería (si el dispositivo lo soporta)
      try {
        const battChar = await connectedDevice.readCharacteristicForService(
          BATTERY_SERVICE_UUID,
          BATTERY_LEVEL_UUID
        );
        if (battChar.value) {
          const battBytes = Buffer.from(battChar.value, 'base64');
          setBatteryLevel(battBytes[0]);
        }
      } catch { /* COOSPO HW9 puede no soportar Battery Service */ }

      // Suscribir a Heart Rate Measurement notifications
      subscriptionRef.current = connectedDevice.monitorCharacteristicForService(
        HR_SERVICE_UUID,
        HR_MEASUREMENT_UUID,
        (error, characteristic) => {
          if (error) {
            console.warn('[BLE] Error en notificación HR:', error.message);
            setStatus('error');
            setErrorMessage(`Error de lectura BLE: ${error.message}`);
            return;
          }
          if (characteristic?.value) {
            const heartRate = parseHeartRateMeasurement(characteristic.value);
            setBpm(heartRate);
          }
        }
      );
    } catch (e: any) {
      setStatus('error');
      setErrorMessage(`No se pudo conectar: ${e?.message || 'Error desconocido'}`);
      connectedDeviceRef.current = null;
    }
  }, [manager]);

  // ─── Auto-reconectar ──────────────────────────────────────────────────────
  const attemptReconnect = useCallback(async () => {
    const device = lastConnectedDeviceRef.current;
    if (!device || !manager || isReconnectingRef.current) return;
    isReconnectingRef.current = true;
    setStatus('connecting');
    console.log('[BLE] Intentando reconexión automática...');

    // Retry up to 3 times with exponential backoff
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const isAlreadyConnected = await manager.isDeviceConnected(device.id);
        if (isAlreadyConnected) {
          // Device is still connected at native level — just re-subscribe
          const reconnected = await manager.devices([device.id]).then(ds => ds[0]);
          if (reconnected) {
            await reconnected.discoverAllServicesAndCharacteristics();
            connectedDeviceRef.current = reconnected;
            subscriptionRef.current = reconnected.monitorCharacteristicForService(
              HR_SERVICE_UUID,
              HR_MEASUREMENT_UUID,
              (error, characteristic) => {
                if (error) {
                  console.warn('[BLE] Error en notificación HR tras reconexión:', error.message);
                  return;
                }
                if (characteristic?.value) {
                  setBpm(parseHeartRateMeasurement(characteristic.value));
                }
              }
            );
            setStatus('connected');
            console.log('[BLE] Reconexión exitosa (dispositivo aún conectado)');
            isReconnectingRef.current = false;
            return;
          }
        }

        // Not connected — try full reconnect
        const reconnectedDevice = await manager.connectToDevice(device.id, { requestMTU: 256 });
        connectedDeviceRef.current = reconnectedDevice;
        await reconnectedDevice.discoverAllServicesAndCharacteristics();

        subscriptionRef.current = reconnectedDevice.monitorCharacteristicForService(
          HR_SERVICE_UUID,
          HR_MEASUREMENT_UUID,
          (error, characteristic) => {
            if (error) {
              console.warn('[BLE] Error HR tras reconexión:', error.message);
              return;
            }
            if (characteristic?.value) {
              setBpm(parseHeartRateMeasurement(characteristic.value));
            }
          }
        );

        manager.onDeviceDisconnected(reconnectedDevice.id, () => {
          connectedDeviceRef.current = null;
          subscriptionRef.current = null;
          if (!isReconnectingRef.current) attemptReconnect();
        });

        setStatus('connected');
        setDeviceName(reconnectedDevice.name || reconnectedDevice.localName || 'Pulsómetro BLE');
        console.log(`[BLE] Reconexión exitosa (intento ${attempt})`);
        isReconnectingRef.current = false;
        return;
      } catch (e: any) {
        console.warn(`[BLE] Reconexión intento ${attempt}/3 falló:`, e?.message);
        if (attempt < 3) {
          await new Promise((r) => setTimeout(r, attempt * 2000)); // 2s, 4s backoff
        }
      }
    }

    // All retries failed
    isReconnectingRef.current = false;
    setStatus('disconnected');
    setBpm(null);
    setDeviceName(null);
    console.log('[BLE] Reconexión fallida tras 3 intentos.');
  }, [manager]);

  // ─── AppState: reconectar al volver al primer plano ───────────────────────
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && lastConnectedDeviceRef.current && status === 'disconnected') {
        console.log('[BLE] App volvió al primer plano, intentando reconectar...');
        attemptReconnect();
      }
    });
    return () => subscription.remove();
  }, [attemptReconnect, status]);

  // ─── Escanear ─────────────────────────────────────────────────────────────
  const startScan = useCallback(async () => {
    // Desconectar si ya había conexión previa
    if (connectedDeviceRef.current) {
      await _disconnect();
    }

    setStatus('scanning');
    setNearbyDevices([]);
    setErrorMessage(null);

    if (!manager) {
      setStatus('error');
      setErrorMessage('El Bluetooth real requiere una compilación nativa. Expo Go no puede buscar sensores BLE.');
      return;
    }

    // Verificar que Bluetooth está encendido
    const bleState = await manager.state();
    if (bleState !== State.PoweredOn) {
      setStatus('error');
      setErrorMessage('Bluetooth está apagado. Actívalo en Ajustes del dispositivo.');
      return;
    }

    // Permisos Android
    const hasPermissions = await requestAndroidBlePermissions();
    if (!hasPermissions) {
      setStatus('error');
      setErrorMessage('Permiso de Bluetooth denegado. Actívalo en Ajustes de la app.');
      return;
    }

    const found = new Map<string, Device>();

    const isPossibleHeartRateDevice = (device: Device) => {
      const serviceUUIDs = Array.isArray(device.serviceUUIDs) ? device.serviceUUIDs.map((id) => id.toLowerCase()) : [];
      const deviceName = (device.name || device.localName || '').toLowerCase();
      return (
        serviceUUIDs.includes(HR_SERVICE_UUID.toLowerCase()) ||
        serviceUUIDs.some((id) => id.includes('180d') || id.includes('2a37')) ||
        deviceName.length > 0
      );
    };

    manager.startDeviceScan(null, { allowDuplicates: true }, (error, scannedDevice) => {
      if (error) {
        setStatus('error');
        setErrorMessage(`Error de escaneo: ${error.message}`);
        manager.stopDeviceScan();
        return;
      }

      if (!scannedDevice) return;

      if (isPossibleHeartRateDevice(scannedDevice) && !found.has(scannedDevice.id)) {
        found.set(scannedDevice.id, scannedDevice);
        setNearbyDevices(Array.from(found.values()));
      }
    });

    // Detener escaneo tras 15 segundos
    scanTimeoutRef.current = setTimeout(() => {
      manager.stopDeviceScan();
      if (found.size === 0) {
        setStatus('error');
        setErrorMessage(
          'No se encontró ningún pulsómetro BLE.\n' +
          'Asegúrate de que el pulsómetro está encendido, anunciado y cerca del móvil.'
        );
      } else {
        // Volver a idle si encontró dispositivos pero el usuario no ha elegido ninguno
        setStatus('idle');
      }
    }, 15000);
  }, [_disconnect]);

  return {
    bpm,
    batteryLevel,
    status,
    deviceName,
    errorMessage,
    nearbyDevices,
    startScan,
    connect,
    disconnect,
    reconnect: attemptReconnect,
  };
}
