import 'package:flutter/material.dart';
import '../../core/network/api_client.dart';
import '../../core/theme/tkd_theme.dart';

class MobileLoginScreen extends StatefulWidget {
  final VoidCallback onLoggedIn;
  const MobileLoginScreen({super.key, required this.onLoggedIn});

  @override
  State<MobileLoginScreen> createState() => _MobileLoginScreenState();
}

class _MobileLoginScreenState extends State<MobileLoginScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _loading = false;
  String? _error;

  Future<void> _login() async {
    setState(() { _loading = true; _error = null; });
    try {
      final result = await TkdApiClient.login(_email.text.trim(), _password.text);
      if (result['success'] == true) {
        final user = Map<String, dynamic>.from(result['user'] as Map? ?? {});
        if (user['role'] != 'ATHLETE' || TkdApiClient.profile['athleteId'] == null) {
          await TkdApiClient.logout();
          setState(() => _error = 'Esta app requiere un usuario ATHLETE vinculado a una ficha de atleta.');
        } else {
          widget.onLoggedIn();
        }
      } else {
        setState(() => _error = result['error']?.toString() ?? 'No se pudo iniciar sesión.');
      }
    } catch (_) {
      setState(() => _error = 'No se pudo conectar con TKD Global. Revisa Internet y la URL de API.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Icon(Icons.sports_martial_arts, size: 52, color: TkdTheme.chongBlue),
                const SizedBox(height: 16),
                const Text('TKD GLOBAL', textAlign: TextAlign.center, style: TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold)),
                const SizedBox(height: 8),
                const Text('Inicia sesión para transmitir tu frecuencia cardíaca al entrenador.', textAlign: TextAlign.center, style: TextStyle(color: Colors.white70)),
                const SizedBox(height: 28),
                TextField(controller: _email, keyboardType: TextInputType.emailAddress, textInputAction: TextInputAction.next, decoration: const InputDecoration(labelText: 'Email o usuario')),
                const SizedBox(height: 12),
                TextField(controller: _password, obscureText: true, onSubmitted: (_) => _login(), decoration: const InputDecoration(labelText: 'Contraseña')),
                if (_error != null) ...[
                  const SizedBox(height: 12),
                  Text(_error!, style: const TextStyle(color: TkdTheme.hongRed)),
                ],
                const SizedBox(height: 20),
                FilledButton(onPressed: _loading ? null : _login, child: Padding(padding: const EdgeInsets.symmetric(vertical: 12), child: Text(_loading ? 'Conectando...' : 'Iniciar sesión'))),
              ],
            ),
          ),
        ),
      ),
    );
  }
}