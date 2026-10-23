import 'package:flutter/material.dart';
import '../../core/network/api_client.dart';
import '../../core/theme/tkd_theme.dart';

class AthleteHomeScreen extends StatelessWidget {
  final Future<void> Function() onLogout;
  const AthleteHomeScreen({super.key, required this.onLogout});

  @override
  Widget build(BuildContext context) {
    final profile = TkdApiClient.profile;
    final user = Map<String, dynamic>.from(profile['user'] as Map? ?? {});
    final athleteName = profile['athleteName']?.toString() ??
        user['name']?.toString() ??
        'Atleta';
    final category = user['category']?.toString() ?? 'Perfil de atleta';
    final club = profile['clubId']?.toString().isNotEmpty == true
        ? profile['clubId'].toString()
        : 'Club afiliado';
    final initials = athleteName
        .split(' ')
        .take(2)
        .map((part) => part.isNotEmpty ? part[0] : '')
        .join()
        .toUpperCase();

    return Scaffold(
      appBar: AppBar(
        title: const Text('TKD HUB Mobile'),
        actions: [
          IconButton(
              icon: const Icon(Icons.logout),
              tooltip: 'Cerrar sesión',
              onPressed: onLogout)
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                    colors: [Color(0xFF0C192E), Color(0xFF0F2B48)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: TkdTheme.chongBlue.withOpacity(0.3)),
              ),
              child: Row(
                children: [
                  CircleAvatar(
                      radius: 28,
                      backgroundColor: TkdTheme.chongBlue,
                      child: Text(initials,
                          style: const TextStyle(
                              fontWeight: FontWeight.bold,
                              color: Colors.white))),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(athleteName,
                            style: const TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.bold,
                                color: Colors.white)),
                        const SizedBox(height: 2),
                        Text(category,
                            style: const TextStyle(
                                color: Colors.white70, fontSize: 12)),
                        Text(club,
                            style: const TextStyle(
                                color: TkdTheme.chongBlue, fontSize: 11)),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            const Text('Monitorización de entrenamiento',
                style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: Colors.white)),
            const SizedBox(height: 12),
            Card(
              child: ListTile(
                leading: const Icon(Icons.favorite, color: TkdTheme.hongRed),
                title: const Text('Entrenamiento Tabata y pulsómetro',
                    style: TextStyle(
                        fontWeight: FontWeight.bold, color: Colors.white)),
                subtitle: const Text(
                    'Usa el temporizador 20/10 o conecta un sensor BLE para compartir tus PPM.',
                    style: TextStyle(color: Colors.white70, fontSize: 12)),
                trailing: const Icon(Icons.arrow_forward_ios,
                    size: 14, color: Colors.white54),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
