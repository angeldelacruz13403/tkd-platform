import 'package:flutter/material.dart';
import 'core/theme/tkd_theme.dart';
import 'presentation/screens/athlete_home_screen.dart';
import 'presentation/screens/live_workout_screen.dart';
import 'presentation/screens/ai_coach_screen.dart';
import 'presentation/screens/mobile_login_screen.dart';
import 'core/network/api_client.dart';

void main() {
  runApp(const TkdMobileApp());
}

class TkdMobileApp extends StatelessWidget {
  const TkdMobileApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'TKD Global Hub',
      debugShowCheckedModeBanner: false,
      theme: TkdTheme.darkTheme,
      home: const MainNavigationScreen(),
    );
  }
}

class MainNavigationScreen extends StatefulWidget {
  const MainNavigationScreen({super.key});

  @override
  State<MainNavigationScreen> createState() => _MainNavigationScreenState();
}

class _MainNavigationScreenState extends State<MainNavigationScreen> {
  int _currentIndex = 0;
  bool _sessionReady = false;
  bool _authenticated = false;

  @override
  void initState() {
    super.initState();
    _restoreSession();
  }

  Future<void> _restoreSession() async {
    await TkdApiClient.restoreSession();
    if (!mounted) return;
    setState(() {
      _sessionReady = true;
      _authenticated = TkdApiClient.profile['athleteId'] != null;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (!_sessionReady) {
      return const MaterialApp(
          home: Scaffold(body: Center(child: CircularProgressIndicator())));
    }
    if (!_authenticated) {
      return MaterialApp(
        title: 'TKD Global Hub',
        debugShowCheckedModeBanner: false,
        theme: TkdTheme.darkTheme,
        home: MobileLoginScreen(
            onLoggedIn: () => setState(() => _authenticated = true)),
      );
    }
    final screens = [
      AthleteHomeScreen(onLogout: _logout),
      LiveWorkoutScreen(onLogout: _logout),
      const AiCoachScreen(),
    ];
    return Scaffold(
      body: screens[_currentIndex],
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: (index) => setState(() => _currentIndex = index),
        type: BottomNavigationBarType.fixed,
        backgroundColor: TkdTheme.darkBg,
        selectedItemColor: TkdTheme.chongBlue,
        unselectedItemColor: Colors.white54,
        selectedFontSize: 11,
        unselectedFontSize: 11,
        items: const [
          BottomNavigationBarItem(
            icon: Icon(Icons.dashboard_outlined),
            activeIcon: Icon(Icons.dashboard),
            label: "Dashboard",
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.fitness_center_outlined),
            activeIcon: Icon(Icons.fitness_center),
            label: "Entrenar",
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.psychology_outlined),
            activeIcon: Icon(Icons.psychology),
            label: "Coach IA",
          ),
        ],
      ),
    );
  }

  Future<void> _logout() async {
    await TkdApiClient.logout();
    if (mounted) setState(() => _authenticated = false);
  }
}
