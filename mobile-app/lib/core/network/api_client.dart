import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class TkdApiClient {
  // URL base apuntando a Vercel en producción o localhost en desarrollo
  static String baseUrl = "https://tkdcore.vercel.app/api/v1";
  static String? _token;
  static Map<String, dynamic> profile = {};

  static Future<void> restoreSession() async {
    final prefs = await SharedPreferences.getInstance();
    _token = prefs.getString('tkd_token');
    profile = jsonDecode(prefs.getString('tkd_profile') ?? '{}')
        as Map<String, dynamic>;
  }

  static Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('tkd_token');
    await prefs.remove('tkd_profile');
    _token = null;
    profile = {};
  }

  static Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        if (_token != null) 'Authorization': 'Bearer $_token',
      };

  static void setBaseUrl(String url) {
    baseUrl = url;
  }

  /// Inicia sesión y obtiene credenciales y rol
  static Future<Map<String, dynamic>> login(
      String email, String password) async {
    final response = await http.post(
      Uri.parse('$baseUrl/auth'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'email': email, 'password': password}),
    );
    final result = jsonDecode(response.body) as Map<String, dynamic>;
    if (response.statusCode == 200 && result['success'] == true) {
      _token = result['token'] as String?;
      profile = Map<String, dynamic>.from(result['profile'] as Map? ?? {});
      profile['user'] = result['user'];
      final prefs = await SharedPreferences.getInstance();
      if (_token != null) await prefs.setString('tkd_token', _token!);
      await prefs.setString('tkd_profile', jsonEncode(profile));
    }
    return result;
  }

  /// Sincroniza telemetría de una sesión de entrenamiento con pulsómetro
  static Future<bool> syncTrainingSession(
      Map<String, dynamic> sessionData) async {
    final response = await http.post(
      Uri.parse('$baseUrl/trainings'),
      headers: _headers,
      body: jsonEncode(sessionData),
    );
    return response.statusCode == 200;
  }

  static Future<bool> publishLiveTelemetry(
      Map<String, dynamic> telemetry) async {
    final response = await http.post(
      Uri.parse('$baseUrl/telemetry/live'),
      headers: _headers,
      body: jsonEncode(telemetry),
    );
    return response.statusCode == 200;
  }

  static Future<List<dynamic>> fetchAIPlans() async {
    final athleteId = profile['athleteId']?.toString();
    if (athleteId == null || athleteId.isEmpty) {
      throw Exception('No hay un atleta asociado a esta cuenta.');
    }
    final response = await http.get(
      Uri.parse(
          '$baseUrl/ai/plans?athleteId=${Uri.encodeQueryComponent(athleteId)}'),
      headers: _headers,
    );
    final result = jsonDecode(response.body) as Map<String, dynamic>;
    if (response.statusCode != 200 || result['success'] != true) {
      throw Exception(
          result['error']?.toString() ?? 'No se pudieron cargar los planes.');
    }
    return result['data'] as List<dynamic>? ?? [];
  }

  static Future<List<dynamic>> fetchCorrectiveWork() async {
    final athleteId = profile['athleteId']?.toString();
    if (athleteId == null || athleteId.isEmpty) {
      throw Exception('No hay un atleta asociado a esta cuenta.');
    }
    final response = await http.get(
      Uri.parse(
          '$baseUrl/ai/corrective-work?athleteId=${Uri.encodeQueryComponent(athleteId)}'),
      headers: _headers,
    );
    final result = jsonDecode(response.body) as Map<String, dynamic>;
    if (response.statusCode != 200 || result['success'] != true) {
      throw Exception(result['error']?.toString() ??
          'No se pudieron cargar los trabajos correctivos.');
    }
    return result['data'] as List<dynamic>? ?? [];
  }

  static Future<Map<String, dynamic>> updateCorrectiveWork({
    required String workId,
    required String status,
    String? feedback,
  }) async {
    final athleteId = profile['athleteId']?.toString();
    if (athleteId == null || athleteId.isEmpty) {
      throw Exception('No hay un atleta asociado a esta cuenta.');
    }
    final response = await http.patch(
      Uri.parse('$baseUrl/ai/corrective-work'),
      headers: _headers,
      body: jsonEncode({
        'athleteId': athleteId,
        'workId': workId,
        'status': status,
        if (feedback != null) 'feedback': feedback,
      }),
    );
    final result = jsonDecode(response.body) as Map<String, dynamic>;
    if (response.statusCode != 200 || result['success'] != true) {
      throw Exception(result['error']?.toString() ??
          'No se pudo actualizar el trabajo correctivo.');
    }
    return Map<String, dynamic>.from(result['data'] as Map);
  }

  /// Registra el resultado de un combate de sparring con puntuación Daedo
  static Future<bool> recordSparringMatch(
      Map<String, dynamic> matchData) async {
    final response = await http.post(
      Uri.parse('$baseUrl/competitions'),
      headers: _headers,
      body: jsonEncode(matchData),
    );
    return response.statusCode == 200;
  }
}
